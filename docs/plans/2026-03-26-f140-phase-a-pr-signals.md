---
feature_ids: [F140]
doc_kind: plan
created: 2026-03-26
---

# F140 Phase A: PR Signals — 冲突检测 + Review Feedback 投递

**Feature:** F140 — `docs/features/F140-github-pr-automation.md`
**Goal:** 已注册 PR 的冲突状态变化和 review feedback（comments + decision state）自动投递到 thread 并唤醒猫
**Acceptance Criteria:**
- AC-A1: MERGEABLE → CONFLICTING 时投递冲突消息
- AC-A2: 冲突消息 urgent 唤醒猫
- AC-A3: 新 comments（不限来源）投递到 thread
- AC-A4: Review decision 变化（approved/requested changes/dismissed）投递
- AC-A5: Review feedback 唤醒猫
- AC-A6: ConnectorSource `github-conflict` + `github-review-feedback` 注册 + 渲染
- AC-A7: 冲突状态迁移去重（MERGEABLE 时清 fingerprint，KD-9）
- AC-A8: Comments/review cursor 去重（cursor 仅 delivery 成功后推进，KD-10）
- AC-A9: ConflictRouter + ReviewFeedbackRouter 单元测试
- AC-A10: merge-gate / receive-review / opensource-ops SKILL.md 更新
- AC-A11: refs/pr-signals.md 新增
**Architecture:** 照搬 F133 CiCdRouter 模式：Router 负责 dedup + format + deliver，TaskSpec execute 调 Router + ConnectorInvokeTrigger
**Tech Stack:** TypeScript, node:test, MemoryPrTrackingStore, Redis Lua (RedisPrTrackingStore)
**前端验证:** No — 纯后端 + Skill 文档

**NOT building:**
- Phase B（自动 rebase / 自动处理 review）
- F141 Repo Inbox
- Issue tracking / labels / assignee

---

## Terminal Schema

```typescript
// --- Types (new) ---

interface PrFeedbackComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  commentType: 'inline' | 'conversation';
  filePath?: string;   // only for inline
  line?: number;       // only for inline
}

interface PrReviewDecision {
  id: number;
  author: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED' | 'COMMENTED';
  body: string;
  submittedAt: string;
}

interface ConflictStateFields {
  lastConflictFingerprint?: string;
  lastConflictNotifiedAt?: number;
}

// --- ConflictRouter ---

interface ConflictPollResult {
  repoFullName: string;
  prNumber: number;
  headSha: string;
  mergeState: string;  // MERGEABLE | CONFLICTING | UNKNOWN
}

type ConflictRouteResult =
  | { kind: 'notified'; threadId: string; catId: string; messageId: string; content: string }
  | { kind: 'deduped'; reason: string }
  | { kind: 'skipped'; reason: string };

// --- ReviewFeedbackRouter ---

interface ReviewFeedbackPollResult {
  repoFullName: string;
  prNumber: number;
  newComments: PrFeedbackComment[];
  newReviews: PrReviewDecision[];
}

type ReviewFeedbackRouteResult =
  | { kind: 'notified'; threadId: string; catId: string; messageId: string; content: string }
  | { kind: 'skipped'; reason: string };
```

---

## Task 1: ConnectorSource 注册

**Files:**
- Modify: `packages/shared/src/types/connector.ts` (CONNECTOR_DEFINITIONS array)
- Test: `packages/shared` build validation

**Step 1: Add github-conflict and github-review-feedback to CONNECTOR_DEFINITIONS**

在 `github-ci` 条目后新增两个 connector 定义：

```typescript
{
  id: 'github-conflict',
  displayName: 'PR Conflict',
  icon: 'github',
  color: { primary: '#D97706', secondary: '#FFFBEB' },
  description: 'GitHub PR 冲突状态通知',
  tailwindTheme: {
    avatar: 'bg-amber-100 ring-2 ring-amber-200',
    label: 'text-amber-700',
    labelLink: 'text-amber-700 hover:text-amber-900',
    bubble: 'border border-amber-200 bg-amber-50',
  },
},
{
  id: 'github-review-feedback',
  displayName: 'Review Feedback',
  icon: 'github',
  color: { primary: '#2563EB', secondary: '#EFF6FF' },
  description: 'GitHub PR review feedback 通知（comments + decisions）',
  tailwindTheme: {
    avatar: 'bg-slate-100 ring-2 ring-slate-200',
    label: 'text-slate-700',
    labelLink: 'text-slate-700 hover:text-slate-900',
    bubble: 'border border-slate-200 bg-slate-50',
  },
},
```

**Step 2: Build shared**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(F140): register github-conflict + github-review-feedback ConnectorSource
```

---

## Task 2: PrTrackingStore — ConflictStateFields + patchConflictState

**Files:**
- Modify: `packages/api/src/infrastructure/email/PrTrackingStore.ts`
- Modify: `packages/api/src/infrastructure/email/RedisPrTrackingStore.ts`

**Step 1: Add ConflictStateFields + extend PrTrackingEntry + IPrTrackingStore**

In `PrTrackingStore.ts`:

```typescript
// After CiStateFields interface
export interface ConflictStateFields {
  lastConflictFingerprint?: string;
  lastConflictNotifiedAt?: number;
}

// PrTrackingEntry: add after ciTrackingEnabled
readonly lastConflictFingerprint?: string;
readonly lastConflictNotifiedAt?: number;

// IPrTrackingStore: add after patchCiState
/** F140: Partial update conflict state fields without touching registration data. */
patchConflictState(repoFullName: string, prNumber: number, fields: ConflictStateFields): void | Promise<void>;
```

**Step 2: Implement in MemoryPrTrackingStore**

```typescript
patchConflictState(repoFullName: string, prNumber: number, fields: ConflictStateFields): void {
  const key = makeKey(repoFullName, prNumber);
  const existing = this.entries.get(key);
  if (!existing) return;
  this.entries.set(key, { ...existing, ...fields });
}
```

**Step 3: Implement in RedisPrTrackingStore**

Reuse same Lua script pattern (PATCH_CI_STATE_LUA works generically):

```typescript
async patchConflictState(repoFullName: string, prNumber: number, fields: ConflictStateFields): Promise<void> {
  const updates: Record<string, string> = {};
  if (fields.lastConflictFingerprint !== undefined) updates.lastConflictFingerprint = fields.lastConflictFingerprint;
  if (fields.lastConflictNotifiedAt !== undefined) updates.lastConflictNotifiedAt = String(fields.lastConflictNotifiedAt);
  if (Object.keys(updates).length === 0) return;
  const key = PrTrackingKeys.detail(repoFullName, prNumber);
  const argv = Object.entries(updates).flat();
  await this.redis.eval(PATCH_CI_STATE_LUA, 1, key, ...argv);
}
```

**Step 4: Build + verify types**

Run: `pnpm lint` (tsc --noEmit)
Expected: PASS

**Step 5: Commit**

```
feat(F140): add patchConflictState to PrTrackingStore (KD-12)
```

---

## Task 3: ConflictRouter — TDD

**Files:**
- Create: `packages/api/src/infrastructure/email/ConflictRouter.ts`
- Create: `packages/api/test/conflict-router.test.js`

**Step 1: Write failing tests**

Test matrix (following CiCdRouter test pattern):
1. `route() → notified`: tracked PR + CONFLICTING + no prior fingerprint → delivers message
2. `route() → deduped`: same fingerprint → no duplicate notification
3. `route() → skipped`: UNKNOWN state → skip
4. `route() → skipped`: untracked PR → skip
5. `route() → notified after MERGEABLE reset`: CONFLICTING → MERGEABLE (clears fingerprint) → CONFLICTING again → re-notifies (KD-9)
6. Message format: includes PR number, repo, merge state

**Step 2: Run tests, verify RED**

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern ConflictRouter`
Expected: 6 FAIL

**Step 3: Implement ConflictRouter**

Key behaviors:
- `route(poll: ConflictPollResult)`: check tracking → skip UNKNOWN → dedup by fingerprint → deliver
- When `mergeState === 'MERGEABLE'`: clear `lastConflictFingerprint` via `patchConflictState({lastConflictFingerprint: ''})` (KD-9)
- When `mergeState === 'CONFLICTING'`: check fingerprint dedup → deliver + patch
- ConnectorSource: `{ connector: 'github-conflict', label: 'PR Conflict', icon: 'github', url: PR URL }`

**Step 4: Run tests, verify GREEN**

Expected: 6 PASS

**Step 5: Commit**

```
feat(F140): ConflictRouter with state-transition dedup (AC-A1, AC-A7)
```

---

## Task 4: ConflictCheckTaskSpec execute 补完

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConflictCheckTaskSpec.ts`
- Modify: `packages/api/test/scheduler/conflict-check-spec.test.js`

**Step 1: Write failing test — execute delivers via ConflictRouter + triggers**

Add test: execute with mock ConflictRouter returns 'notified' → trigger called with urgent policy

**Step 2: Run, verify RED**

**Step 3: Extend ConflictCheckTaskSpec**

- Add `conflictRouter` and `invokeTrigger` to options
- Expand gate: also pass `headSha` in signal (need to extend `checkMergeable` return or add separate check)
- Execute: `conflictRouter.route()` → if `notified` → `invokeTrigger.trigger(priority: 'urgent')` (AC-A2)

**Step 4: Run, verify GREEN**

**Step 5: Commit**

```
feat(F140): ConflictCheckTaskSpec execute补完 — Router + Trigger (AC-A2)
```

---

## Task 5: ReviewFeedbackRouter — TDD

**Files:**
- Create: `packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts`
- Create: `packages/api/test/review-feedback-router.test.js`

**Step 1: Write failing tests**

Test matrix:
1. `route() → notified`: comments + reviews → aggregated message delivered
2. `route() → notified`: only comments, no reviews → message with comments section only
3. `route() → notified`: only reviews, no comments → message with decisions section only
4. `route() → skipped`: empty comments + empty reviews → skip
5. `route() → skipped`: untracked PR → skip
6. Message format: three sections (Review Decisions / Inline Comments / PR Conversation)
7. Snippet truncation: long comment body truncated to 200 chars
8. Priority: requested_changes → urgent, approved → normal, comments-only → normal

**Step 2: Run, verify RED**

**Step 3: Implement ReviewFeedbackRouter**

Key behaviors:
- `route(poll: ReviewFeedbackPollResult)`: check tracking → build message → deliver
- Message builder: `buildReviewFeedbackContent()` with three sections
- ConnectorSource: `{ connector: 'github-review-feedback', label: 'Review Feedback', icon: 'github', url: PR URL }`
- Return priority hint for trigger: `{ priority: hasRequestedChanges ? 'urgent' : 'normal' }`

**Step 4: Run, verify GREEN**

**Step 5: Commit**

```
feat(F140): ReviewFeedbackRouter with aggregated three-section messages (AC-A3, AC-A4)
```

---

## Task 6: ReviewFeedbackTaskSpec — TDD (replaces ReviewCommentsTaskSpec)

**Files:**
- Create: `packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts`
- Create: `packages/api/test/scheduler/review-feedback-spec.test.js`

**Step 1: Write failing tests**

Test matrix:
1. Gate: no tracked PRs → run:false
2. Gate: tracked PR with new comments + new reviews → run:true with workItems
3. Gate: tracked PR with no new comments/reviews → run:false
4. Gate: cursor filters out already-seen comments/reviews
5. Execute: calls ReviewFeedbackRouter.route() + commitCursor on success
6. Execute: cursor advances AFTER delivery success, BEFORE trigger (KD-10)
7. Execute: trigger failure does NOT block cursor commit (KD-10)

**Step 2: Run, verify RED**

**Step 3: Implement ReviewFeedbackTaskSpec**

Key design:
- Options: `{ prTrackingStore, fetchComments, fetchReviews, reviewFeedbackRouter, invokeTrigger, log }`
- Gate: list PRs → for each: fetch comments + reviews → filter by dual cursor → workItems
- Signal: `{ entry, newComments, newReviews, commitCommentsCursor, commitReviewsCursor }`
- Execute sequence (KD-10):
  ```
  router.route(signal) → result
  if (result.kind === 'notified'):
    signal.commitCommentsCursor()   // ← cursor commit BEFORE trigger
    signal.commitReviewsCursor()
    try { invokeTrigger.trigger(...) } catch { log.warn('trigger failed, best-effort') }
  ```
- TaskSpec id: `'review-feedback'` (new, not `'review-comments'`)
- PrFeedbackComment richer model (KD-8): fetchComments returns enriched data

**Step 4: Run, verify GREEN**

**Step 5: Commit**

```
feat(F140): ReviewFeedbackTaskSpec replaces ReviewCommentsTaskSpec (KD-11, AC-A5, AC-A8)
```

---

## Task 7: Bootstrap wiring in index.ts

**Files:**
- Modify: `packages/api/src/index.ts` (lines 1285-1346)

**Step 1: Wire ConflictRouter + update ConflictCheckTaskSpec registration**

```typescript
// After CiCdRouter construction (line 1289)
const conflictRouter = new ConflictRouter({
  prTrackingStore,
  deliveryDeps: { messageStore, socketManager },
  log: app.log,
});

// Replace existing ConflictCheckTaskSpec registration
taskRunnerV2.register(createConflictCheckTaskSpec({
  prTrackingStore,
  conflictRouter,
  invokeTrigger,
  checkMergeable: async (repo, pr) => { /* existing gh api call */ },
  log: app.log,
}));
```

**Step 2: Wire ReviewFeedbackRouter + replace ReviewCommentsTaskSpec registration**

```typescript
const reviewFeedbackRouter = new ReviewFeedbackRouter({
  prTrackingStore,
  deliveryDeps: { messageStore, socketManager },
  log: app.log,
});

// Replace createReviewCommentsTaskSpec with createReviewFeedbackTaskSpec
taskRunnerV2.register(createReviewFeedbackTaskSpec({
  prTrackingStore,
  reviewFeedbackRouter,
  invokeTrigger,
  fetchComments: async (repo, pr) => { /* enriched version of existing fetcher */ },
  fetchReviews: async (repo, pr) => { /* new: gh api /repos/{repo}/pulls/{pr}/reviews */ },
  log: app.log,
}));
```

**Step 3: Update log line**

```typescript
app.log.info('[api] F139+F140: cicd-check, conflict-check, review-feedback specs registered');
```

**Step 4: Build + verify**

Run: `pnpm lint && pnpm --filter @cat-cafe/api test`
Expected: ALL PASS

**Step 5: Commit**

```
feat(F140): wire ConflictRouter + ReviewFeedbackRouter in bootstrap (AC-A6)
```

---

## Task 8: Skill/SOP 更新

**Files:**
- Modify: `cat-cafe-skills/merge-gate/SKILL.md`
- Modify: `cat-cafe-skills/receive-review/SKILL.md`
- Modify: `cat-cafe-skills/opensource-ops/SKILL.md`
- Create: `cat-cafe-skills/refs/pr-signals.md`

**Step 1: merge-gate SKILL.md**

在 `register_pr_tracking` 步骤后补充说明：
> 注册后系统自动追踪三类信号：CI 状态（F133）、冲突检测（F140）、review feedback（F140）。

**Step 2: receive-review SKILL.md**

补充 GitHub PR review feedback connector 入口：
> 当你从 `github-review-feedback` connector 收到通知时，按本 skill 流程处理：
> - `requested changes` → Red→Green 修复流程
> - `approved` → 确认 merge readiness，推进 merge-gate
> - `dismissed` → 确认是否需要重新请求 review

**Step 3: opensource-ops SKILL.md**

在 Community PR 处理流程中补充：
> 社区 PR 注册追踪后，关注冲突通知——如果 contributor PR 有冲突，评估是通知 contributor 还是 maintainer 帮忙 rebase。

**Step 4: refs/pr-signals.md**

新增 PR Signals 参考文档：
- 三类 PR 信号概述（CI/Conflict/Review Feedback）
- 消息格式示例
- 触发优先级表（CI fail=urgent, Conflict=urgent, Review feedback=urgent for requested_changes, normal for others）
- 去重机制说明

**Step 5: Commit**

```
docs(F140): Skill/SOP updates — merge-gate, receive-review, opensource-ops, refs/pr-signals (AC-A10, AC-A11)
```

---

## Execution Order Summary

| Task | AC 覆盖 | 依赖 |
|------|---------|------|
| 1. ConnectorSource | AC-A6 | 无 |
| 2. PrTrackingStore 扩展 | AC-A7 前置 | 无 |
| 3. ConflictRouter TDD | AC-A1, AC-A7 | Task 1, 2 |
| 4. ConflictCheckTaskSpec 补完 | AC-A2 | Task 3 |
| 5. ReviewFeedbackRouter TDD | AC-A3, AC-A4 | Task 1 |
| 6. ReviewFeedbackTaskSpec TDD | AC-A5, AC-A8 | Task 5 |
| 7. Bootstrap wiring | AC-A6 | Task 4, 6 |
| 8. Skill/SOP | AC-A10, AC-A11 | 无（可并行） |

Task 1 + 2 无依赖可先做。Task 3→4 和 Task 5→6 两条线可并行。Task 7 等两条线完成。Task 8 随时可做。

**AC-A9**（测试覆盖）通过 Task 3-6 的 TDD 过程自动满足。
