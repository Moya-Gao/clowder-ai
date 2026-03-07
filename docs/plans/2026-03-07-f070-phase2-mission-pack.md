# F070 Phase 2: Mission Pack + Hooks + Collaboration Standards

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** When cats are dispatched to external projects, they know why they're there (structured mission pack), have runtime guardrails (hooks), and understand collaboration expectations (enriched managed block).

**Architecture:** Three independent enhancements to the existing F070 governance bootstrap:
1. Mission pack injection via system prompt in `invoke-single-cat.ts` (reads thread metadata)
2. Hooks symlink in `governance-bootstrap.ts` (extends existing skills symlink pattern)
3. Managed block enrichment in `governance-pack.ts` (extends existing content, bumps version)

**Tech Stack:** TypeScript, Node.js fs/promises, existing governance infrastructure

---

### Task 1: Dispatch Mission Pack — Type Definition

**Files:**
- Modify: `packages/shared/src/types/capability.ts` (add DispatchMissionPack interface)
- Modify: `packages/shared/src/types/index.ts` (re-export if needed)

**Step 1: Define the DispatchMissionPack type**

Add to `capability.ts` after the governance types:

```typescript
/** F070 Phase 2: Structured mission context for external project dispatch */
export interface DispatchMissionPack {
  /** 1-3 sentences: what this dispatch is for */
  readonly mission: string;
  /** External project's own work item ID, or thread title as fallback */
  readonly workItem: string;
  /** Current workflow phase */
  readonly phase: string;
  /** Up to 3 completion criteria */
  readonly doneWhen: readonly string[];
  /** Related entry links */
  readonly links: readonly string[];
}
```

**Step 2: Rebuild shared**

Run: `pnpm --filter @cat-cafe/shared build`

**Step 3: Commit**

```
feat(F070-P2): DispatchMissionPack type definition
```

---

### Task 2: Dispatch Mission Pack — Builder + Tests

**Files:**
- Create: `packages/api/src/config/governance/mission-pack.ts`
- Create: `packages/api/test/governance/mission-pack.test.js`

**Step 1: Write the failing tests**

```javascript
// test/governance/mission-pack.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionPack, formatMissionPackPrompt } from '../../dist/config/governance/mission-pack.js';

describe('mission-pack', () => {
  it('builds pack from thread with backlogItemId and phase', () => {
    const pack = buildMissionPack({
      title: 'Implement auth flow',
      phase: 'implementing',
      backlogItemId: 'AUTH-001',
    });
    assert.equal(pack.workItem, 'AUTH-001');
    assert.equal(pack.phase, 'implementing');
    assert.ok(pack.mission.includes('Implement auth flow'));
  });

  it('falls back to thread title when no backlogItemId', () => {
    const pack = buildMissionPack({ title: 'Fix login bug' });
    assert.equal(pack.workItem, 'Fix login bug');
    assert.equal(pack.phase, 'unknown');
  });

  it('formats prompt block with all fields', () => {
    const prompt = formatMissionPackPrompt({
      mission: 'Implement OAuth2 login',
      workItem: 'AUTH-001',
      phase: 'implementing',
      doneWhen: ['Login endpoint returns JWT', 'Tests pass'],
      links: ['docs/features/F001-auth.md'],
    });
    assert.ok(prompt.includes('mission:'));
    assert.ok(prompt.includes('AUTH-001'));
    assert.ok(prompt.includes('implementing'));
    assert.ok(prompt.includes('Login endpoint returns JWT'));
  });

  it('handles empty doneWhen and links gracefully', () => {
    const prompt = formatMissionPackPrompt({
      mission: 'Quick fix',
      workItem: 'thread title',
      phase: 'unknown',
      doneWhen: [],
      links: [],
    });
    assert.ok(prompt.includes('mission:'));
    assert.ok(!prompt.includes('done_when:'));
  });
});
```

**Step 2: Run tests to see them fail**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/governance/mission-pack.test.js`
Expected: FAIL (module not found)

**Step 3: Implement mission-pack.ts**

```typescript
// packages/api/src/config/governance/mission-pack.ts
import type { DispatchMissionPack } from '@cat-cafe/shared';

interface ThreadContext {
  title?: string;
  phase?: string;
  backlogItemId?: string;
}

/**
 * Build a structured mission pack from thread metadata.
 * This is injected into the system prompt when dispatching to external projects.
 */
export function buildMissionPack(thread: ThreadContext): DispatchMissionPack {
  return {
    mission: thread.title ?? 'External project task',
    workItem: thread.backlogItemId ?? thread.title ?? 'unspecified',
    phase: thread.phase ?? 'unknown',
    doneWhen: [],
    links: [],
  };
}

/**
 * Format mission pack as a prompt block for system prompt injection.
 */
export function formatMissionPackPrompt(pack: DispatchMissionPack): string {
  const lines = [
    '## Dispatch Mission Context',
    '',
    `mission:    ${pack.mission}`,
    `work_item:  ${pack.workItem}`,
    `phase:      ${pack.phase}`,
  ];

  if (pack.doneWhen.length > 0) {
    lines.push(`done_when:`);
    for (const criterion of pack.doneWhen) {
      lines.push(`  - ${criterion}`);
    }
  }

  if (pack.links.length > 0) {
    lines.push(`links:`);
    for (const link of pack.links) {
      lines.push(`  - ${link}`);
    }
  }

  return lines.join('\n');
}
```

**Step 4: Build and run tests**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/governance/mission-pack.test.js`
Expected: 4 PASS

**Step 5: Commit**

```
feat(F070-P2): mission pack builder + formatter with 4 tests
```

---

### Task 3: Inject Mission Pack into invoke-single-cat

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` (~lines 307-324, after governance gate)

**Step 1: Add mission pack injection after governance preflight passes**

After the governance gate block (line ~323 `return { ready: true }`), before the provider profile injection (~line 325), add:

```typescript
// F070 Phase 2: Inject dispatch mission context for external projects
if (workingDirectory && workingDirectory !== catCafeRoot) {
  const thread = threadStore ? await threadStore.get(threadId) : undefined;
  if (thread) {
    const { buildMissionPack, formatMissionPackPrompt } = await import('../../../../../config/governance/mission-pack.js');
    const missionPack = buildMissionPack({
      title: thread.title,
      phase: thread.phase,
      backlogItemId: thread.backlogItemId,
    });
    const missionPrompt = formatMissionPackPrompt(missionPack);
    // Prepend mission context to the prompt (before system prompt injection)
    prompt = `${missionPrompt}\n\n${prompt}`;
  }
}
```

Note: `thread` was already fetched at line ~299 for projectPath resolution. Reuse that variable or fetch once and store.

**Step 2: Verify build**

Run: `pnpm --filter @cat-cafe/api run build`
Expected: Clean

**Step 3: Commit**

```
feat(F070-P2): inject mission pack into external project dispatch
```

---

### Task 4: Hooks Symlink in Bootstrap

**Files:**
- Modify: `packages/api/src/config/governance/governance-bootstrap.ts` (add hooks symlink logic)
- Modify: `packages/api/test/governance/governance-bootstrap.test.js` (add hooks test)

**Step 1: Write failing test**

Add to governance-bootstrap.test.js:

```javascript
it('creates hooks symlink for claude provider', async () => {
  const service = new GovernanceBootstrapService(catCafeRoot);
  await service.bootstrap(externalProject, { dryRun: false });

  const hooksPath = join(externalProject, '.claude', 'hooks');
  const stat = await lstat(hooksPath);
  assert.ok(stat.isSymbolicLink(), '.claude/hooks should be a symlink');
});
```

**Step 2: Run to see it fail**

Run: `node --test packages/api/test/governance/governance-bootstrap.test.js`
Expected: FAIL (hooks not created)

**Step 3: Add hooks symlink to bootstrap**

In `governance-bootstrap.ts`, add a `PROVIDER_HOOKS_DIRS` mapping and symlink logic in the `bootstrap()` method, after the skills symlink section. The source is `catCafeRoot/.claude/hooks/` (or `.codex/hooks/` etc.), target is `externalProject/.claude/hooks/`.

Only create symlink if source hooks directory exists. This handles the "implementation can be batched" principle — if `.codex/hooks/` doesn't exist yet, it's silently skipped.

**Step 4: Run tests**

Expected: 11+ PASS (original 10 + new hooks test)

**Step 5: Update preflight to check hooks symlink**

In `governance-preflight.ts`, after the skills symlink check, add an optional hooks check (warn but don't block — hooks are enhancement, not hard requirement).

**Step 6: Commit**

```
feat(F070-P2): hooks symlink in governance bootstrap
```

---

### Task 5: Enrich Managed Block with Collaboration Standards

**Files:**
- Modify: `packages/api/src/config/governance/governance-pack.ts` (enrich HARD_CONSTRAINTS)
- Modify: `packages/api/test/governance/governance-pack.test.js` (update assertions)

**Step 1: Enrich the collaboration standards section**

In `governance-pack.ts`, expand the `HARD_CONSTRAINTS` string's "Collaboration Standards" section:

```typescript
### Collaboration Standards
- A2A handoff uses five-tuple: What / Why / Tradeoff / Open Questions / Next Action
- Vision Guardian: Read original requirements before starting. AC completion ≠ feature complete.
- Review flow: quality-gate → request-review → receive-review → merge-gate
- Skills are available via symlinked cat-cafe-skills/ — load the relevant skill before each workflow step
- Shared rules: See cat-cafe-skills/refs/shared-rules.md for full collaboration contract
```

**Step 2: Bump GOVERNANCE_PACK_VERSION to '1.1.0'**

This triggers auto-sync for already-bootstrapped external projects.

**Step 3: Update pack test assertions**

The existing test "managed block includes hard constraints" should still pass. Add:

```javascript
it('collaboration standards reference shared-rules and skills', () => {
  const block = getGovernanceManagedBlock('claude');
  assert.ok(block.includes('shared-rules.md'));
  assert.ok(block.includes('cat-cafe-skills'));
});
```

**Step 4: Run all governance tests**

Run: `node --test packages/api/test/governance/*.test.js`
Expected: All pass (some tests may need checksum update since content changed)

**Step 5: Commit**

```
feat(F070-P2): enrich managed block with collaboration standards + bump v1.1.0
```

---

### Task 6: Integration Verification

**Step 1: Run full governance test suite**

Run: `node --test packages/api/test/governance/*.test.js`
Expected: All pass (50+ tests)

**Step 2: Run API build + type check**

Run: `pnpm --filter @cat-cafe/api run build && pnpm lint`
Expected: Clean

**Step 3: Run web build**

Run: `pnpm --filter @cat-cafe/web run build`
Expected: Clean

**Step 4: Final commit if any fixups needed**

---

## Execution Notes

- Tasks 1-3 are the mission pack chain (sequential)
- Task 4 (hooks) is independent of Tasks 1-3
- Task 5 (managed block) is independent of Tasks 1-4
- Task 6 is the integration gate (depends on all)

Parallel execution: Tasks 4 and 5 can run in parallel with Tasks 1-3.
