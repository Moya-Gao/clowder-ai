# F139 Phase 1b — Actor Dispatch + Execute补全 + V1 Cleanup

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** 让统一调度器能"叫醒猫干活"——Task 声明需要什么角色的猫 + 成本偏好，系统自动匹配并 dispatch
**Acceptance Criteria:**
- AC-B1: actor.role resolver 从 cat-config.json 匹配猫
- AC-B2: MCP dispatch + receipt tracking 端到端
- AC-B3: costTier hint 影响选猫策略
- 补充: conflict-check / review-comments execute 补全通知路由
- 补充: 旧 TaskRunner V1 清理
**Architecture:** 扩展 TaskSpec_P1 增加 actor 维度（role + costTier），ActorResolver 查 cat-config roster 匹配猫，execute 通过 deliverConnectorMessage + ConnectorInvokeTrigger 发通知并唤醒猫，RunLedger 扩展 receipt 字段
**Tech Stack:** TypeScript, cat-config-loader, ConnectorInvokeTrigger, RunLedger SQLite
**前端验证:** No — 纯后端

---

## Part 1: V1 Cleanup (Task 1-2)

### Task 1: Delete old TaskRunner V1

**Files:**
- Delete: `packages/api/src/infrastructure/scheduler/TaskRunner.ts`
- Modify: `packages/api/src/infrastructure/scheduler/index.ts` (remove TaskRunner export)
- Modify: `packages/api/src/infrastructure/scheduler/types.ts` (remove ScheduledTask interface)
- Delete: `packages/api/test/scheduler/task-runner.test.js` (old V1 tests, if exist as standalone)

**Step 1:** Delete TaskRunner.ts

**Step 2:** Remove `ScheduledTask` interface from types.ts (lines 1-16), remove from barrel index.ts

**Step 3:** Grep for remaining imports of `TaskRunner` or `ScheduledTask` — fix any broken references

**Step 4:** Run `pnpm --filter @cat-cafe/api run build` — confirm no type errors

**Step 5:** Run tests `node --test packages/api/test/scheduler/*.test.js` — confirm no regressions

**Step 6:** Commit: `chore(F139): remove legacy TaskRunner V1 + ScheduledTask interface`

---

## Part 2: Execute 补全 — Notification Routing (Task 2-5)

### Task 2: Wire deliverConnectorMessage into ConflictCheckTaskSpec

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConflictCheckTaskSpec.ts`
- Modify: `packages/api/src/index.ts` (~line 1292, bootstrap wiring)
- Test: `packages/api/test/scheduler/conflict-check-spec.test.js`

**Step 1:** Write failing test — conflict-check execute calls deliverConnectorMessage

```typescript
it('execute delivers connector message for conflicting PR', async () => {
  const delivered: unknown[] = [];
  const spec = createConflictCheckTaskSpec({
    prTrackingStore: mockStore,
    checkMergeable: async () => 'CONFLICTING',
    deliverMessage: async (input) => { delivered.push(input); return { messageId: 'msg-1', content: input.content }; },
    log: noopLog,
  });
  // ... gate + execute ...
  assert.equal(delivered.length, 1);
  assert.ok(delivered[0].content.includes('merge conflict'));
});
```

**Step 2:** Run test → FAIL

**Step 3:** Add `deliverMessage` to ConflictCheckTaskSpecOptions. In execute:

```typescript
async execute(signal: ConflictSignal, subjectKey: string) {
  const { entry, mergeState } = signal;
  const content = `⚠️ PR #${entry.prNumber} (${entry.repoFullName}) has merge conflict (state: ${mergeState}). Please rebase.`;
  await opts.deliverMessage({
    threadId: entry.threadId,
    userId: entry.userId,
    catId: entry.catId,
    content,
    source: 'github_conflict_check' as ConnectorSource,
  });
  opts.log.info(`[conflict-check] ${subjectKey}: notified — ${mergeState}`);
}
```

**Step 4:** Run test → PASS

**Step 5:** Wire in index.ts — pass `deliverMessage: (input) => deliverConnectorMessage(deliveryDeps, input)` to createConflictCheckTaskSpec

**Step 6:** Commit: `feat(F139): conflict-check delivers connector message on merge conflict`

### Task 3: Wire deliverConnectorMessage into ReviewCommentsTaskSpec

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewCommentsTaskSpec.ts`
- Modify: `packages/api/src/index.ts` (~line 1310, bootstrap wiring)
- Test: `packages/api/test/scheduler/review-comments-spec.test.js`

**Step 1:** Write failing test — review-comments execute calls deliverMessage

**Step 2:** Run test → FAIL

**Step 3:** Add `deliverMessage` to ReviewCommentsTaskSpecOptions. In execute:

```typescript
async execute(signal: ReviewCommentsSignal, subjectKey: string) {
  const { entry, newComments } = signal;
  const preview = newComments.slice(0, 3).map(c => `> ${c.body.slice(0, 80)}`).join('\n');
  const content = `💬 ${newComments.length} new comment(s) on PR #${entry.prNumber}:\n${preview}`;
  await opts.deliverMessage({
    threadId: entry.threadId,
    userId: entry.userId,
    catId: entry.catId,
    content,
    source: 'github_review_comments' as ConnectorSource,
  });
  signal.commitCursor();
  opts.log.info(`[review-comments] ${subjectKey}: delivered ${newComments.length} comment(s)`);
}
```

**Step 4:** Run test → PASS. Also test: cursor NOT advanced when deliverMessage throws.

**Step 5:** Wire in index.ts

**Step 6:** Commit: `feat(F139): review-comments delivers connector message with comment preview`

---

## Part 3: Actor + CostTier + Receipt (Task 4-8)

### Task 4: Define ActorRole type + extend TaskSpec

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/types.ts`
- Test: `packages/api/test/scheduler/profiles.test.js` (extend with actor type checks)

**Step 1:** Add to types.ts:

```typescript
/** Actor capability namespace (Phase 1b) — NOT roster identity roles */
export type ActorRole = 'memory-curator' | 'repo-watcher' | 'health-monitor';

/** Cost tier hint for actor resolution */
export type CostTier = 'cheap' | 'deep';

/** Actor dimension (Phase 1b) */
export interface ActorSpec {
  role: ActorRole;
  costTier: CostTier;
}
```

**Step 2:** Add optional `actor` to TaskSpec_P1:

```typescript
export interface TaskSpec_P1<Signal = unknown> {
  // ... existing fields ...
  /** Phase 1b: actor resolution — which cat should handle this task */
  actor?: ActorSpec;
}
```

**Step 3:** Add `assignedCatId` to RunLedgerRow for receipt tracking:

```typescript
export interface RunLedgerRow {
  // ... existing fields ...
  assigned_cat_id: string | null;
}
```

**Step 4:** Run build + tests → PASS (optional field, backward compatible)

**Step 5:** Commit: `feat(F139): add ActorSpec + CostTier types to TaskSpec_P1`

### Task 5: Create ActorResolver

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/ActorResolver.ts`
- Test: `packages/api/test/scheduler/actor-resolver.test.js`

**Step 1:** Write failing tests:

```typescript
describe('ActorResolver', () => {
  it('resolves repo-watcher to available cat with peer-reviewer role', ...);
  it('costTier deep prefers lead cat', ...);
  it('costTier cheap prefers non-lead cat', ...);
  it('returns null when no cat matches role', ...);
  it('skips unavailable cats', ...);
});
```

**Step 2:** Implement ActorResolver:

```typescript
import { catHasRole, isCatAvailable, isCatLead, getRoster } from '../../config/cat-config-loader.js';

const ACTOR_ROLE_TO_ROSTER_ROLES: Record<ActorRole, string[]> = {
  'memory-curator': ['architect'],
  'repo-watcher': ['peer-reviewer', 'coder'],
  'health-monitor': ['architect', 'peer-reviewer'],
};

export function resolveActor(role: ActorRole, costTier: CostTier): string | null {
  const roster = getRoster();
  const requiredRoles = ACTOR_ROLE_TO_ROSTER_ROLES[role];

  const candidates = Object.keys(roster).filter(catId => {
    if (!isCatAvailable(catId)) return false;
    return requiredRoles.some(r => catHasRole(catId, r));
  });

  if (candidates.length === 0) return null;

  // costTier: deep → prefer lead, cheap → prefer non-lead
  candidates.sort((a, b) => {
    const aLead = isCatLead(a) ? 1 : 0;
    const bLead = isCatLead(b) ? 1 : 0;
    return costTier === 'deep' ? bLead - aLead : aLead - bLead;
  });

  return candidates[0];
}
```

**Step 3:** Run tests → PASS

**Step 4:** Commit: `feat(F139): ActorResolver maps actor.role + costTier to catId`

### Task 6: Extend RunLedger with receipt tracking

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/RunLedger.ts`
- Modify: `packages/api/src/domains/memory/schema.ts` (V6 migration: add assigned_cat_id column)
- Test: `packages/api/test/scheduler/run-ledger.test.js`

**Step 1:** Write failing test — record() accepts optional assignedCatId, query() returns it

**Step 2:** Add V6 migration: `ALTER TABLE task_run_ledger ADD COLUMN assigned_cat_id TEXT`

**Step 3:** Update RunLedger.record() to accept and write assignedCatId

**Step 4:** Run tests → PASS

**Step 5:** Commit: `feat(F139): RunLedger receipt tracking — assigned_cat_id column`

### Task 7: Wire actor resolution into TaskRunnerV2 pipeline

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Test: `packages/api/test/scheduler/task-runner-v2.test.js`

**Step 1:** Write failing test — pipeline calls resolveActor when task.actor is set, passes result to ledger

**Step 2:** In executePipeline, after gate returns workItems:

```typescript
// Actor resolution (Phase 1b)
const assignedCatId = task.actor
  ? this.actorResolver?.(task.actor.role, task.actor.costTier) ?? null
  : null;
```

Pass `assignedCatId` to `this.ledger.record(...)` for receipt tracking.

**Step 3:** Add optional `actorResolver` to TaskRunnerV2Options

**Step 4:** Run tests → PASS

**Step 5:** Commit: `feat(F139): TaskRunnerV2 integrates actor resolution + receipt tracking`

### Task 8: Set actor specs on TaskSpecs + bootstrap wiring

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConflictCheckTaskSpec.ts` (add actor)
- Modify: `packages/api/src/infrastructure/email/ReviewCommentsTaskSpec.ts` (add actor)
- Modify: `packages/api/src/infrastructure/email/CiCdCheckTaskSpec.ts` (add actor)
- Modify: `packages/api/src/domains/memory/SummaryCompactionTaskSpec.ts` (add actor)
- Modify: `packages/api/src/index.ts` (pass actorResolver to TaskRunnerV2)

**Step 1:** Add actor specs:
- summary-compact: `{ role: 'memory-curator', costTier: 'deep' }`
- cicd-check: `{ role: 'repo-watcher', costTier: 'cheap' }`
- conflict-check: `{ role: 'repo-watcher', costTier: 'cheap' }`
- review-comments: `{ role: 'repo-watcher', costTier: 'cheap' }`

**Step 2:** Wire resolveActor into TaskRunnerV2 constructor in index.ts

**Step 3:** Run full test suite: `node --test packages/api/test/scheduler/*.test.js packages/api/test/memory/*.test.js`

**Step 4:** Commit: `feat(F139): wire actor specs + resolver into all TaskSpecs`

---

## Verification

- `pnpm --filter @cat-cafe/api run build` — no type errors
- `pnpm check` — biome clean
- `pnpm lint` — tsc clean
- `node --test packages/api/test/scheduler/*.test.js packages/api/test/memory/*.test.js` — all pass
- `pnpm gate` — full gate pass

## What We're NOT Building

- UI for actor/task display (Phase 2)
- Cron/event triggers (Phase 2)
- Subject-level lease (deferred)
- Natural language task configuration (Phase 2)
- SQLite cursor persistence for review-comments (Phase 2)
