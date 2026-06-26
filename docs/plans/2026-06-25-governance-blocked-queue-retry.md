# Governance-Blocked Queue Retry Fix Implementation Plan

**Feature:** Bugfix touching `docs/features/F128-cat-create-thread.md`, `docs/features/F175-unified-message-queue.md`, `docs/features/F070-portable-governance.md`
**Goal:** Ensure proposal-approved initial messages that hit the governance gate stay retryable instead of being incorrectly finalized as succeeded.
**Acceptance Criteria:**
- Queue-driven invocations that emit `done.errorCode = GOVERNANCE_BOOTSTRAP_REQUIRED` must end in `failed`, not `succeeded`.
- The governance warning card for a newly approved external-project thread must be able to retry the blocked invocation after governance confirm.
- The first-time external project path flow must not leave a retry loop caused by a stale `succeeded` invocation record.
**Architecture cell:** `dispatch`
**Map delta:** none
**Map delta why:** This is a terminal-status bug inside the existing queue execution path; it does not add or move ownership boundaries.
**Architecture:** The fix stays inside `QueueProcessor`, where proposal-approved initial messages execute. We will mirror the existing `messages.ts` governance terminal handling so the queue path writes the same retryable failed state when governance blocks execution.
**Tech Stack:** TypeScript, Node test runner, Fastify queue/runtime dispatch path
**前端验证:** No direct UI code change; the user-visible recovery depends on backend invocation status being correct.

---

### Bug 诊断胶囊：proposal 初始消息治理拦截后被误写为 succeeded

| 栏位 | 内容 |
|------|------|
| **1. 现象** | `cat_cafe_propose_thread` 创建外部项目 thread 并批准后，thread 可正常创建，但治理 warning 卡片在 confirm 后提示 `Cannot retry invocation with status 'succeeded'`，反复重试无效。 |
| **2. 证据** | `GovernanceBlockedCard` 只会调用 `/api/invocations/:id/retry`；`invocations.ts` 仅允许 `failed/queued` 重试；`invoke-single-cat.ts` 在治理拦截时会发 `done.errorCode = GOVERNANCE_BOOTSTRAP_REQUIRED`；`messages.ts` 会把该 errorCode 写成 failed，但 `QueueProcessor.ts` 当前不会。 |
| **3. 问题假设或根因** | 我认为根因是 proposal 初始消息走 `QueueProcessor` 执行面，消费到治理 `done.errorCode` 后没有单独终态分支，后续仍落入通用 succeeded 写入。 |
| **4. 诊断策略** | 先用 `QueueProcessor` 单测复现 `done.errorCode` 场景，再对照 `messages.ts` 的治理终态处理补齐 queue 路径。 |
| **5. 超时策略** | 如果 `QueueProcessor` 单测不能稳定复现，再补查 proposal approve / queue integration 测试，必要时缩到更高层的 regression。 |
| **6. 预警策略** | 如果修复需要改 invocation retry 契约或前端卡片协议，说明不是单点队列问题，需要重新评估架构边界。 |
| **7. 用户可见交互修正** | 治理卡片在 confirm 后应能正常触发 retry，不再落入“已 succeeded 但仍显示可重试 warning”的僵尸状态。 |
| **8. 验收** | 新增 `QueueProcessor` 回归测试：治理 `done.errorCode` 时 invocation update 应写 `failed + GOVERNANCE_BOOTSTRAP_REQUIRED`，且不应写 `succeeded`。再跑对应目标测试文件确认通过。 |

### Task 1: Reproduce the queue-path terminal-state bug

**Files:**
- Modify: `packages/api/test/queue-processor.test.js`
- Test: `packages/api/test/queue-processor.test.js`

**Step 1: Write the failing test**

Add a `QueueProcessor` test where `router.routeExecution()` yields:
- a `system_info` governance payload
- a terminal `done` event with `errorCode: 'GOVERNANCE_BOOTSTRAP_REQUIRED'`

Assert:
- `invocationRecordStore.update(..., { status: 'failed', error: 'GOVERNANCE_BOOTSTRAP_REQUIRED' })` exists
- no `status: 'succeeded'` update exists

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @cat-cafe/api test -- queue-processor.test.js`
Expected: FAIL because current `QueueProcessor` only writes `succeeded` on the happy path.

### Task 2: Mirror governance terminal handling in queue execution

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Reference: `packages/api/src/routes/messages.ts`

**Step 3: Write minimal implementation**

Inside `QueueProcessor.executeEntry()`:
- track governance `done.errorCode` while consuming routed events
- before the success terminal write, branch on that error code
- write `status: 'failed'` plus the governance error, then return `failed`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @cat-cafe/api test -- queue-processor.test.js`
Expected: PASS for the new regression and existing nearby queue tests.

### Task 3: Verify no regression in proposal initial-message dispatch contract

**Files:**
- Optional check: `packages/api/test/proposal-approve-dispatch.test.js`

**Step 5: Run targeted proposal/queue verification**

Run:
- `pnpm --filter @cat-cafe/api test -- proposal-approve-dispatch.test.js`

Expected: PASS; no dispatch contract changes required beyond corrected invocation terminal status.
