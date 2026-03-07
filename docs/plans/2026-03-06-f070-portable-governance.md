---
feature_ids: [F070]
topics: [governance, bootstrap, dispatch, knowledge-engineering]
doc_kind: plan
created: 2026-03-06
---

# F070 Portable Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** When a cat is dispatched to an external project, automatically bootstrap Cat Cafe's knowledge engineering methodology (with first-time confirmation), verify readiness via preflight gate, and show governance health in Hub.

**Architecture:** Three-layer approach — (1) define a versioned governance pack as content + types, (2) bootstrap service writes it to external projects via capability-orchestrator, (3) preflight gate in invoke-single-cat verifies before dispatch. Hub UI extends existing capability board with governance health.

**Tech Stack:** TypeScript, Node.js fs/path, existing capability-orchestrator patterns, React (Hub UI), Vitest tests.

---

## Phase A: Portable Governance Pack (Tasks 1-4)

AC coverage: AC-7, AC-8, AC-9, AC-10, AC-14

### Task 1: Governance Pack Type Definitions

**Files:**
- Modify: `packages/shared/src/types/capability.ts`
- Test: `packages/shared/src/types/capability.test.ts` (if exists, otherwise type-only)

**Step 1: Add governance types to capability.ts**

After the existing `CapabilityEntry` interface (~L48), add:

```typescript
/** F070: Governance rule categories for Conflict Contract */
export type GovernanceCategory = 'hard-constraint' | 'workflow' | 'methodology' | 'advisory';

/** F070: Single governance rule in the portable pack */
export interface GovernanceRule {
  readonly id: string;
  readonly category: GovernanceCategory;
  readonly description: string;
  /** If true, external project cannot override */
  readonly immutable: boolean;
}

/** F070: Versioned governance pack metadata */
export interface GovernancePackMeta {
  readonly packVersion: string;
  readonly checksum: string;
  readonly syncedAt: number;
  readonly confirmedByUser: boolean;
}

/** F070: Per-project governance health */
export interface GovernanceHealthSummary {
  readonly projectPath: string;
  readonly status: 'healthy' | 'stale' | 'missing' | 'never-synced';
  readonly packVersion: string | null;
  readonly lastSyncedAt: number | null;
  readonly findings: readonly GovernanceFinding[];
}

export interface GovernanceFinding {
  readonly category: GovernanceCategory;
  readonly name: string;
  readonly status: 'present' | 'missing' | 'stale';
}

/** F070: Bootstrap operation report */
export interface BootstrapReport {
  readonly projectPath: string;
  readonly timestamp: number;
  readonly packVersion: string;
  readonly actions: readonly BootstrapAction[];
  readonly dryRun: boolean;
}

export interface BootstrapAction {
  readonly file: string;
  readonly action: 'created' | 'updated' | 'skipped' | 'symlinked';
  readonly reason: string;
}
```

**Step 2: Extend CapabilitiesConfig**

Find `CapabilitiesConfig` interface, add:

```typescript
export interface CapabilitiesConfig {
  version: 1;
  capabilities: CapabilityEntry[];
  /** F070: Governance pack metadata for this project */
  governancePack?: GovernancePackMeta;
}
```

**Step 3: Build shared package**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: Clean build, no type errors.

**Step 4: Commit**

```
feat(F070): governance pack type definitions [布偶猫]
```

---

### Task 2: Governance Pack Content — Managed Block Templates

**Files:**
- Create: `packages/api/src/config/governance/governance-pack.ts`
- Test: `test/governance/governance-pack.test.ts`

**Step 1: Write test for managed block content**

```typescript
import { describe, it, assert } from 'vitest';
import { getGovernanceManagedBlock, GOVERNANCE_PACK_VERSION } from '../../packages/api/src/config/governance/governance-pack.js';

describe('governance-pack', () => {
  it('managed block has start/end markers', () => {
    const block = getGovernanceManagedBlock('claude');
    assert.ok(block.includes('<!-- CAT-CAFE-GOVERNANCE-START -->'));
    assert.ok(block.includes('<!-- CAT-CAFE-GOVERNANCE-END -->'));
  });

  it('managed block includes hard constraints', () => {
    const block = getGovernanceManagedBlock('claude');
    assert.ok(block.includes('3001'));
    assert.ok(block.includes('6399'));
    assert.ok(block.includes('self-review'));
  });

  it('pack version is semver', () => {
    assert.match(GOVERNANCE_PACK_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('checksum is stable for same content', () => {
    const { computePackChecksum } = require('../../packages/api/src/config/governance/governance-pack.js');
    const a = computePackChecksum();
    const b = computePackChecksum();
    assert.strictEqual(a, b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @cat-cafe/api exec vitest run test/governance/governance-pack.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement governance-pack.ts**

```typescript
import { createHash } from 'node:crypto';

export const GOVERNANCE_PACK_VERSION = '1.0.0';

const MANAGED_BLOCK_START = '<!-- CAT-CAFE-GOVERNANCE-START -->';
const MANAGED_BLOCK_END = '<!-- CAT-CAFE-GOVERNANCE-END -->';

/** Hard constraints that cannot be overridden by external projects */
const HARD_CONSTRAINTS = `
## Cat Cafe Governance Rules (Auto-managed)

### Hard Constraints (immutable)
- **Port 3001** is reserved for Cat Cafe frontend. Use 3002+ for other dev servers.
- **Redis port 6399** is Cat Cafe's production Redis. Never connect to it from external projects. Use 6398 for dev/test.
- **No self-review**: The same individual cannot review their own code. Cross-family review preferred.
- **Identity is constant**: Never impersonate another cat. Identity is a hard constraint.

### Collaboration Standards
- A2A handoff uses five-tuple: What / Why / Tradeoff / Open Questions / Next Action
- Vision Guardian: Read original requirements before starting. AC completion ≠ feature complete.
- Review flow: quality-gate → request-review → receive-review → merge-gate
`.trim();

const METHODOLOGY_INTRO = `
### Knowledge Engineering
- Documents use YAML frontmatter (feature_ids, topics, doc_kind, created)
- Three-layer info architecture: CLAUDE.md (≤100 lines) → Skills (on-demand) → refs/
- Backlog: BACKLOG.md (hot) → Feature files (warm) → raw docs (cold)
- Feature lifecycle: kickoff → discussion → implementation → review → completion
- SOP: See docs/SOP.md for the 6-step workflow
`.trim();

type Provider = 'claude' | 'codex' | 'gemini';

export function getGovernanceManagedBlock(provider: Provider): string {
  return [
    MANAGED_BLOCK_START,
    `> Pack version: ${GOVERNANCE_PACK_VERSION} | Provider: ${provider}`,
    '',
    HARD_CONSTRAINTS,
    '',
    METHODOLOGY_INTRO,
    MANAGED_BLOCK_END,
  ].join('\n');
}

export function computePackChecksum(): string {
  const content = HARD_CONSTRAINTS + METHODOLOGY_INTRO + GOVERNANCE_PACK_VERSION;
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

export { MANAGED_BLOCK_START, MANAGED_BLOCK_END };
```

**Step 4: Run tests**

Run: `pnpm --filter @cat-cafe/api exec vitest run test/governance/governance-pack.test.ts`
Expected: All PASS.

**Step 5: Commit**

```
feat(F070): governance pack content + managed block templates [布偶猫]
```

---

### Task 3: Methodology Skeleton Templates

**Files:**
- Create: `packages/api/src/config/governance/methodology-templates.ts`
- Test: `test/governance/methodology-templates.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, assert } from 'vitest';
import { getMethodologyTemplates } from '../../packages/api/src/config/governance/methodology-templates.js';

describe('methodology-templates', () => {
  it('returns all required template files', () => {
    const templates = getMethodologyTemplates();
    const paths = templates.map(t => t.relativePath);
    assert.ok(paths.includes('BACKLOG.md'));
    assert.ok(paths.includes('docs/SOP.md'));
    assert.ok(paths.includes('docs/features/.gitkeep'));
    assert.ok(paths.includes('docs/decisions/.gitkeep'));
  });

  it('BACKLOG template has frontmatter', () => {
    const templates = getMethodologyTemplates();
    const backlog = templates.find(t => t.relativePath === 'BACKLOG.md')!;
    assert.ok(backlog.content.includes('---'));
    assert.ok(backlog.content.includes('doc_kind:'));
  });

  it('templates have non-empty content', () => {
    const templates = getMethodologyTemplates();
    for (const t of templates) {
      if (!t.relativePath.endsWith('.gitkeep')) {
        assert.ok(t.content.length > 10, `${t.relativePath} should have content`);
      }
    }
  });
});
```

**Step 2: Run to verify fail, then implement**

`methodology-templates.ts` returns an array of `{ relativePath, content }` objects:
- `BACKLOG.md` — template with frontmatter + table header
- `docs/SOP.md` — condensed 6-step workflow template
- `docs/features/.gitkeep` — directory placeholder
- `docs/decisions/.gitkeep` — directory placeholder
- `docs/discussions/.gitkeep` — directory placeholder

Each template is a minimal starting point, not a copy of cat-cafe's full docs.

**Step 3: Run tests, commit**

```
feat(F070): methodology skeleton templates [布偶猫]
```

---

### Task 4: Governance Pack Registry (Dispatch Audit Trail)

**Files:**
- Create: `packages/api/src/config/governance/governance-registry.ts`
- Test: `test/governance/governance-registry.test.ts`

**Step 1: Write test**

```typescript
describe('governance-registry', () => {
  it('registers a new project bootstrap', async () => {
    const registry = new GovernanceRegistry(tmpDir);
    await registry.register('/path/to/project', {
      packVersion: '1.0.0',
      checksum: 'abc123',
      syncedAt: Date.now(),
      confirmedByUser: true,
    });
    const entry = await registry.get('/path/to/project');
    assert.ok(entry);
    assert.strictEqual(entry!.packVersion, '1.0.0');
  });

  it('lists all registered projects', async () => {
    const registry = new GovernanceRegistry(tmpDir);
    await registry.register('/a', { ... });
    await registry.register('/b', { ... });
    const all = await registry.listAll();
    assert.strictEqual(all.length, 2);
  });

  it('detects stale entries', async () => {
    const registry = new GovernanceRegistry(tmpDir);
    await registry.register('/a', { packVersion: '0.9.0', ... });
    const health = await registry.checkHealth('/a', '1.0.0');
    assert.strictEqual(health.status, 'stale');
  });
});
```

**Step 2: Implement**

Registry stores JSON at `.cat-cafe/governance-registry.json` (alongside existing `capabilities.json`). Simple read/write with `safePath()` pattern from capability-orchestrator.

**Step 3: Run tests, commit**

```
feat(F070): governance registry — dispatch audit trail [布偶猫]
```

---

## Phase B: Dispatch Bootstrap Adapter (Tasks 5-8)

AC coverage: AC-1, AC-2, AC-3, AC-5, AC-12, AC-13, AC-16, AC-18, AC-19

### Task 5: GovernanceBootstrapService — Core Logic

**Files:**
- Create: `packages/api/src/config/governance/governance-bootstrap.ts`
- Test: `test/governance/governance-bootstrap.test.ts`

**Step 1: Write test for empty project bootstrap**

```typescript
describe('GovernanceBootstrapService', () => {
  it('bootstraps empty project with all governance files', async () => {
    const service = new GovernanceBootstrapService(catCafeRoot);
    const report = await service.bootstrap(emptyProjectDir, { dryRun: false });

    assert.strictEqual(report.dryRun, false);
    // Check managed blocks written
    const claudeMd = fs.readFileSync(path.join(emptyProjectDir, 'CLAUDE.md'), 'utf8');
    assert.ok(claudeMd.includes('CAT-CAFE-GOVERNANCE-START'));
    // Check methodology skeleton
    assert.ok(fs.existsSync(path.join(emptyProjectDir, 'BACKLOG.md')));
    assert.ok(fs.existsSync(path.join(emptyProjectDir, 'docs/SOP.md')));
    // Check skills symlinks (3 providers)
    assert.ok(fs.lstatSync(path.join(emptyProjectDir, '.claude/skills')).isSymbolicLink());
    assert.ok(fs.lstatSync(path.join(emptyProjectDir, '.codex/skills')).isSymbolicLink());
    assert.ok(fs.lstatSync(path.join(emptyProjectDir, '.gemini/skills')).isSymbolicLink());
    // Check report
    const created = report.actions.filter(a => a.action === 'created');
    assert.ok(created.length > 0);
  });

  it('does not overwrite existing files', async () => {
    // Pre-create BACKLOG.md with custom content
    fs.writeFileSync(path.join(projectDir, 'BACKLOG.md'), '# My Backlog');
    const report = await service.bootstrap(projectDir, { dryRun: false });
    // Verify BACKLOG.md unchanged
    const content = fs.readFileSync(path.join(projectDir, 'BACKLOG.md'), 'utf8');
    assert.strictEqual(content, '# My Backlog');
    // Verify skipped in report
    const skipped = report.actions.find(a => a.file === 'BACKLOG.md');
    assert.strictEqual(skipped?.action, 'skipped');
  });

  it('appends managed block to existing CLAUDE.md', async () => {
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), '# My Project\n\nMy rules.');
    const report = await service.bootstrap(projectDir, { dryRun: false });
    const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
    assert.ok(content.startsWith('# My Project'));
    assert.ok(content.includes('CAT-CAFE-GOVERNANCE-START'));
  });

  it('updates managed block on version change', async () => {
    // First bootstrap
    await service.bootstrap(projectDir, { dryRun: false });
    // Simulate version bump by modifying the block
    const report2 = await service.bootstrap(projectDir, { dryRun: false });
    const updated = report2.actions.filter(a => a.action === 'updated');
    // Should be 'updated' not 'created' for managed blocks on re-run
  });

  it('is idempotent', async () => {
    const r1 = await service.bootstrap(projectDir, { dryRun: false });
    const r2 = await service.bootstrap(projectDir, { dryRun: false });
    // Second run should show all 'skipped' or 'updated' (no 'created')
    const created = r2.actions.filter(a => a.action === 'created');
    assert.strictEqual(created.length, 0);
  });

  it('dry-run writes nothing', async () => {
    const report = await service.bootstrap(emptyProjectDir, { dryRun: true });
    assert.strictEqual(report.dryRun, true);
    assert.ok(!fs.existsSync(path.join(emptyProjectDir, 'CLAUDE.md')));
  });
});
```

**Step 2: Implement GovernanceBootstrapService**

Core flow:
1. Read existing state (managed block markers, file existence)
2. Write/update managed blocks in CLAUDE.md, AGENTS.md, GEMINI.md (append if file exists, create if not; replace existing managed block on version change)
3. Create skills symlinks for 3 providers (if not exist)
4. Generate methodology skeleton (skip existing files)
5. Save bootstrap report to `.cat-cafe/governance-bootstrap-report.json`
6. Update governance registry

Follow `bootstrapCapabilities()` pattern from `capability-orchestrator.ts:254-289`.

**Step 3: Run tests, commit**

```
feat(F070): GovernanceBootstrapService — core bootstrap logic [布偶猫]
```

---

### Task 6: Integrate Bootstrap with Capability Orchestrator

**Files:**
- Modify: `packages/api/src/config/capabilities/capability-orchestrator.ts` (~L287)
- Modify: `packages/api/src/routes/capabilities.ts` (~L451)
- Test: `test/governance/governance-integration.test.ts`

**Step 1: Write integration test**

Test that `orchestrate()` with an external `projectRoot` triggers governance bootstrap check.

**Step 2: Add governance bootstrap call after MCP bootstrap**

In `capability-orchestrator.ts`, after the existing `bootstrapCapabilities()` return (~L287):

```typescript
// F070: Governance bootstrap for external projects
if (opts?.catCafeRepoRoot && projectRoot !== opts.catCafeRepoRoot) {
  const { GovernanceBootstrapService } = await import('../governance/governance-bootstrap.js');
  const govService = new GovernanceBootstrapService(opts.catCafeRepoRoot);
  const registry = govService.getRegistry();
  const existing = await registry.get(projectRoot);
  if (!existing?.confirmedByUser) {
    // First time — needs user confirmation (handled by UI/API layer)
    config.governancePack = { needsConfirmation: true };
  } else {
    await govService.bootstrap(projectRoot, { dryRun: false });
  }
}
```

**Step 3: Add governance health to capabilities response**

In `capabilities.ts`, after skill discovery (~L576), add governance health check to response payload.

**Step 4: Run tests, commit**

```
feat(F070): integrate governance bootstrap with capability-orchestrator [布偶猫]
```

---

### Task 7: First-Time Confirmation API

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
- Test: extend existing capability route tests

**Step 1: Add POST `/api/governance/confirm` endpoint**

```typescript
// POST /api/governance/confirm
// Body: { projectPath: string }
// Effect: Mark project as confirmed, trigger bootstrap
```

**Step 2: Test confirm → bootstrap flow**

**Step 3: Commit**

```
feat(F070): first-time confirmation API for governance bootstrap [布偶猫]
```

---

### Task 8: Preflight Gate in invoke-single-cat

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` (~L306)
- Create: `packages/api/src/config/governance/governance-preflight.ts`
- Test: `test/governance/governance-preflight.test.ts`

**Step 1: Write preflight gate test**

```typescript
describe('governance-preflight', () => {
  it('passes for cat-cafe project (no external dispatch)', async () => {
    const result = await checkGovernancePreflight(catCafeRoot, catCafeRoot);
    assert.strictEqual(result.ready, true);
  });

  it('fails for unbootstrapped external project', async () => {
    const result = await checkGovernancePreflight(externalDir, catCafeRoot);
    assert.strictEqual(result.ready, false);
    assert.ok(result.reason?.includes('governance'));
  });

  it('passes for bootstrapped external project', async () => {
    // Bootstrap first
    const service = new GovernanceBootstrapService(catCafeRoot);
    await service.bootstrap(externalDir, { dryRun: false });
    const result = await checkGovernancePreflight(externalDir, catCafeRoot);
    assert.strictEqual(result.ready, true);
  });
});
```

**Step 2: Implement checkGovernancePreflight**

Checks:
1. Is this an external project? (workingDirectory !== catCafeRoot) — if not, always pass
2. Does governance registry have a confirmed entry?
3. Are managed blocks present in CLAUDE.md/AGENTS.md/GEMINI.md?
4. Are skills symlinks valid?
5. Return `{ ready: boolean, reason?: string }`

**Step 3: Wire into invoke-single-cat**

After `workingDirectory` resolution (~L305), before provider setup (~L307):

```typescript
// F070: Preflight governance gate for external project dispatch
if (workingDirectory && workingDirectory !== findMonorepoRoot(process.cwd())) {
  const { checkGovernancePreflight } = await import('../../../../config/governance/governance-preflight.js');
  const preflight = await checkGovernancePreflight(workingDirectory, findMonorepoRoot(process.cwd()));
  if (!preflight.ready) {
    yield { type: 'system', catId, content: `[F070] Governance not ready: ${preflight.reason}`, timestamp: Date.now() };
    yield { type: 'done', catId, isFinal: params.isLastCat, timestamp: Date.now() };
    return;
  }
}
```

**Step 4: Run tests, commit**

```
feat(F070): preflight governance gate in invoke-single-cat [布偶猫]
```

---

## Phase C: Hub Integration + Return Path (Tasks 9-11)

AC coverage: AC-4, AC-6, AC-11, AC-15, AC-17

### Task 9: Governance Health API

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
- Test: extend capabilities route tests

**Step 1: Add GET `/api/governance/health` endpoint**

Returns `GovernanceHealthSummary[]` for all registered projects + any projects with threads but no governance.

**Step 2: Add GET `/api/governance/health/:projectPath` endpoint**

Returns detailed health for a single project.

**Step 3: Test, commit**

```
feat(F070): governance health API endpoints [布偶猫]
```

---

### Task 10: Hub UI — Governance Health Tab + Historical Catch-Up

**Files:**
- Create: `packages/web/src/components/HubGovernanceTab.tsx`
- Modify: `packages/web/src/components/Hub.tsx` (add tab)
- Modify: `packages/api/src/routes/capabilities.ts` (historical scan endpoint)

**Step 1: Add historical project scan API**

`GET /api/governance/discover` — scans all threads with external `projectPath`, cross-references governance registry, returns list of "never-synced" projects.

```typescript
// Scan threadStore for unique external projectPaths
// Filter out cat-cafe-root itself
// Cross-reference with governance registry
// Return: { unsynced: [{ projectPath, threadCount, lastActivity }] }
```

**Step 2: Build governance health component**

Display table of external projects with columns:
- Project name/path
- Governance status (healthy / stale / missing / never-synced)
- Pack version
- Last synced
- Thread count (how many threads use this project)
- Actions: Sync Now / Confirm First Time

**Step 3: First-deploy banner**

On first load after F070 deploy, if `discover` returns unsynced projects:
- Show banner: "N 个外部项目尚未同步猫咖治理规则"
- List project names with one-click "Bootstrap" button per project
- "全部同步" button for batch bootstrap (with confirmation)

**Step 4: Wire to Hub tabs**

Add "Governance" tab alongside existing Capability / Skills tabs.

**Step 5: Commit**

```
feat(F070): Hub governance health tab [布偶猫]
```

---

### Task 11: Mission Hub — External Execution Return Path

**Files:**
- Modify: `packages/web/src/components/MissionHubSituational.tsx` (or equivalent)
- Modify: `packages/api/src/routes/backlog.ts` (if exists)

**Step 1: Show governance status on dispatched threads**

For threads with external `projectPath`, show:
- Governance health badge (green/yellow/red)
- Link to governance health detail

**Step 2: Test, commit**

```
feat(F070): Mission Hub governance status for dispatched threads [布偶猫]
```

---

## Straight-Line Check

| Step | Stays in final system? | Testable after? | Cost of removal? |
|------|----------------------|-----------------|------------------|
| Task 1: Types | Yes (shared types) | Type check | All dependent code breaks |
| Task 2: Pack content | Yes (governance content) | Unit test | No governance rules to inject |
| Task 3: Templates | Yes (skeleton content) | Unit test | No methodology output |
| Task 4: Registry | Yes (audit trail) | Unit test | No health tracking |
| Task 5: Bootstrap service | Yes (core engine) | Integration test | No governance sync |
| Task 6: Orchestrator integration | Yes (auto-trigger) | Integration test | Manual-only sync |
| Task 7: Confirmation API | Yes (UX flow) | API test | Can't confirm first-time |
| Task 8: Preflight gate | Yes (safety net) | Unit + integration | Unbootstrapped projects can dispatch |
| Task 9: Health API | Yes (monitoring) | API test | No visibility |
| Task 10: Hub UI | Yes (user-facing) | Visual | No governance management UI |
| Task 11: Return path | Yes (traceability) | Visual | Can't track external execution |

No spikes. No throwaway scaffolding. Every task's output is final-form.

## Verification Matrix

| AC | Covered by Task |
|----|-----------------|
| AC-1 | Task 5 (empty project bootstrap) |
| AC-2 | Task 5 (existing files not overwritten) |
| AC-3 | Task 5 (idempotent) |
| AC-4 | Task 8 (preflight gate fail-closed) |
| AC-5 | Task 4 + 9 (registry detects stale, health API reports) |
| AC-6 | Task 10 (Hub governance tab) |
| AC-7 | Task 3 (docs/ template) |
| AC-8 | Task 3 (BACKLOG.md template) |
| AC-9 | Task 3 (SOP template) + Task 5 (skills symlink) |
| AC-10 | Task 2 (managed block includes shared-rules reference) |
| AC-11 | Task 5 + 8 (bootstrap + gate = full closed loop) |
| AC-12 | Task 6 (orchestrator) + Task 8 (invoke preflight) |
| AC-13 | Task 6 (extends orchestrator, no parallel system) |
| AC-14 | Task 2 (versioned pack + checksum) |
| AC-15 | Task 4 (registry with timestamps) |
| AC-16 | Task 5 (bootstrap report JSON) |
| AC-17 | Task 11 (Mission Hub governance badge) |
| AC-18 | Task 5 (dry-run + rollback list) |
| AC-19 | Task 5 (3 provider symlinks) |
