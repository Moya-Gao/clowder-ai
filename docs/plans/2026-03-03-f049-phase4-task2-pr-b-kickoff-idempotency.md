---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-b, kickoff-idempotency]
doc_kind: plan
created: 2026-03-03
---

# F049 Phase4 Task2 PR-B（kickoff 一次性硬化）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 消除 PR-A 已知崩溃窗：`append` 成功但 `kickoffMessageId` 未落盘时，重试不会重复写 kickoff 消息。

**Architecture:** 在 `messageStore.append` 增加 `idempotencyKey` 协议（userId + threadId + key），`dispatchApprovedItem` 用 `backlogItemId + dispatchAttemptId` 生成固定 key。重试时复用同一 messageId，再补写 `kickoffMessageId`，保证同一次 dispatch attempt 最多一条 kickoff。

**Tech Stack:** Fastify + TypeScript + ioredis + Node test runner。

---

### Task 1: MessageStore idempotency 契约

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis-keys/message-keys.ts`

**Step 1: Write failing tests**
- `packages/api/test/message-store.test.js` 新增同 key 重试返回同 message 的红灯用例。
- `packages/api/test/redis-message-store.test.js` 新增 Redis 同 key 重试回归。

**Step 2: Implement minimal contract**
- `AppendMessageInput` 增加 `idempotencyKey?: string`。
- 内存/Redis store 实现 key 命中复用；无命中则正常写入。

**Step 3: Verify**
- `env -u REDIS_URL node --test packages/api/test/message-store.test.js`
- `pnpm --dir packages/api run test:redis -- node --test test/redis-message-store.test.js`

---

### Task 2: Dispatch kickoff 去重落地

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-routes.test.js`

**Step 1: Write failing test**
- 新增窗口B故障注入：首次 approve 在 kickoff append 成功后、`updateDispatchProgress(kickoffMessageId)` 抛错；重试 approve 只能复用旧 kickoff message，禁止新增第二条。

**Step 2: Implement minimal fix**
- `dispatchApprovedItem()` 调用 `messageStore.append` 传 `idempotencyKey = kickoff:{backlogItemId}:{dispatchAttemptId}`。

**Step 3: Verify**
- `env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js`

---

### Task 3: Gate & handoff

**Files:**
- Create: `docs/mailbox/2026-03-03-f049-phase4-task2b-quality-gate.md`
- Create: `docs/mailbox/2026-03-03-f049-phase4-task2b-review-request-to-gpt52.md`

**Step 1: Run validation set**
- `env -u REDIS_URL pnpm --dir packages/api run build`
- `env -u REDIS_URL node --test packages/api/test/message-store.test.js packages/api/test/backlog-routes.test.js`
- `pnpm --dir packages/api run test:redis -- node --test test/redis-message-store.test.js`
- `pnpm --dir packages/api run lint`

**Step 2: Record evidence and request local review**
- 汇总命令结果、核心不变量、已知边界，发给 `@gpt52` 做本地全量复核。

