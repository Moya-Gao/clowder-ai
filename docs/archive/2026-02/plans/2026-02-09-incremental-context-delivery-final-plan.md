---
feature_ids: []
topics: [incremental, context, delivery]
doc_kind: plan
created: 2026-02-09
---

# Incremental Context Delivery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 彻底消除“旧内容重复发送”，改为严格增量发送（只发没发过的消息），并保证不丢失“用户 + 其他猫”的消息。

**Architecture:** 引入“每猫每线程投递游标（delivery cursor）”作为单一真相源（source of truth）。每次调用只读取 `cursor` 之后的未投递消息，并在成功完成后原子确认 `ack` 到边界消息 ID。上下文从“全量历史 prepend”改为“增量消息块”，并在串行链路中统一走消息存储，不再拼接 `previousResponses` 文本。

**Tech Stack:** Node.js + TypeScript, Fastify, Redis/ioredis, existing MessageStore/RedisMessageStore, Node test runner.

---

## Core Invariants (必须满足)

1. **No Duplicate Delivery:** 对任意 `(userId, catId, threadId)`，同一消息 ID 最多被投递一次（失败重试除外）。
2. **No Missing User/Peer Messages:** 每次给某猫投递的增量集合必须包含该猫游标之后的所有“用户消息 + 其他猫消息”。
3. **Monotonic Cursor:** 游标只能前进，绝不后退。
4. **Ack-on-Success:** 仅在该猫本轮 `done` 成功后更新游标。
5. **Single Path:** 串行/并行都走同一增量投递路径，避免双逻辑漂移。

---

### Task 1: Add Delivery Cursor Store

**Files:**
- Create: `packages/api/src/domains/cats/services/DeliveryCursorStore.ts`
- Modify: `packages/shared/src/utils/redis.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Test: `packages/api/test/delivery-cursor-store.test.js`

**Step 1: Write the failing test**

- 新建 `delivery-cursor-store.test.js`，覆盖：
  - `get` 默认 `undefined`
  - `ack` 后可读
  - 同一 key 多次 ack 取最大（单调）
  - key 维度为 `userId + catId + threadId`

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/delivery-cursor-store.test.js`
Expected: FAIL (模块不存在)

**Step 3: Write minimal implementation**

- 在 shared Redis key 定义里新增：`deliveryCursor(userId, catId, threadId)`
- 新建 `DeliveryCursorStore`：
  - `getCursor()`
  - `ackCursor()`（字符串比较 + 可选 CAS 逻辑，保证单调）

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/delivery-cursor-store.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/DeliveryCursorStore.ts packages/shared/src/utils/redis.ts packages/shared/src/utils/index.ts packages/api/test/delivery-cursor-store.test.js
git commit -m "feat(api): add per-cat delivery cursor store [缅因猫🐾]" -m "Why: enable exact incremental delivery with monotonic per-thread cursor."
```

---

### Task 2: Add MessageStore API for After-Cursor Fetch

**Files:**
- Modify: `packages/api/src/domains/cats/services/MessageStore.ts`
- Modify: `packages/api/src/domains/cats/services/RedisMessageStore.ts`
- Modify: `packages/api/src/domains/cats/services/message-keys.ts` (if needed)
- Test: `packages/api/test/message-store-after-cursor.test.js`
- Test: `packages/api/test/redis-message-store-after-cursor.test.js`

**Step 1: Write failing tests**

- 覆盖 `getByThreadAfter(threadId, afterId, limit?, userId?)`：
  - after 游标之后按时间正序返回
  - 同毫秒 ID 稳定排序正确
  - `limit` 生效
  - thread/user 过滤正确

**Step 2: Run tests to verify fail**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/message-store-after-cursor.test.js test/redis-message-store-after-cursor.test.js`
Expected: FAIL（接口不存在）

**Step 3: Implement API in both stores**

- `IMessageStore` 增加 `getByThreadAfter(...)`
- In-memory: 直接按 `id > afterId` + thread/user 过滤
- Redis: 基于 thread zset 做增量扫描，正确处理同 timestamp 的 `id > afterId`

**Step 4: Run tests**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/message-store-after-cursor.test.js test/redis-message-store-after-cursor.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/MessageStore.ts packages/api/src/domains/cats/services/RedisMessageStore.ts packages/api/test/message-store-after-cursor.test.js packages/api/test/redis-message-store-after-cursor.test.js
git commit -m "feat(api): support thread-after-cursor message fetch [缅因猫🐾]" -m "Why: incremental delivery requires exact unseen-message queries by cursor."
```

---

### Task 3: Build Delta Context Assembler (No Envelope Echo)

**Files:**
- Create: `packages/api/src/domains/cats/services/DeltaContextAssembler.ts`
- Modify: `packages/api/src/domains/cats/services/index.ts`
- Test: `packages/api/test/delta-context-assembler.test.js`

**Step 1: Write failing tests**

- 覆盖：
  - 只包含“用户 + 其他猫”消息（排除当前猫自言自语）
  - 保持消息 ID 与时间顺序
  - 对内容中的历史 envelope（如 `[对话历史 - 最近`）做剥离，防止递归回放
  - chunk 切分不拆消息行，chunk 合并后等于原集合（零丢失）

**Step 2: Run tests to verify fail**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/delta-context-assembler.test.js`
Expected: FAIL（模块不存在）

**Step 3: Implement assembler**

- 提供：
  - `assembleDelta(messages, { forCatId })`
  - `chunkDelta(deltaLines, maxChars)`
- 输出格式：
  - Header: `[增量上下文 - 未发送过 - N 条]`
  - Body: `[msgId] [HH:MM 角色] 内容`

**Step 4: Run tests**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/delta-context-assembler.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/DeltaContextAssembler.ts packages/api/src/domains/cats/services/index.ts packages/api/test/delta-context-assembler.test.js
git commit -m "feat(api): add delta context assembler with envelope stripping [缅因猫🐾]" -m "Why: prevent history-in-history replay and enforce unsent-only context blocks."
```

---

### Task 4: Refactor AgentRouter to Anchor on Stored User Message ID

**Files:**
- Modify: `packages/api/src/domains/cats/services/AgentRouter.ts`
- Modify: `packages/api/src/domains/cats/services/route-strategies.ts`
- Test: `packages/api/test/agent-router.test.js`

**Step 1: Write failing tests**

- 新增断言：
  - user message append 后拿到 `userMessageId`
  - 该 ID 传入路由策略作为本轮边界
  - 不再传递全量 `history` 做 prepend

**Step 2: Run tests to verify fail**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/agent-router.test.js`
Expected: FAIL

**Step 3: Implement router changes**

- 在 `AgentRouter.route()`：
  - 先 append 当前用户消息并拿到 stored message `id`
  - routeOptions 改为传 `currentUserMessageId`
  - 删除“每轮读取最近 history 再 prepend”的入口依赖

**Step 4: Run tests**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/agent-router.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/AgentRouter.ts packages/api/src/domains/cats/services/route-strategies.ts packages/api/test/agent-router.test.js
git commit -m "refactor(api): route with stored user message boundary id [缅因猫🐾]" -m "Why: enforce deterministic incremental boundary per invocation."
```

---

### Task 5: Replace Full-History Prepend with Exact Incremental Delivery

**Files:**
- Modify: `packages/api/src/domains/cats/services/route-strategies.ts`
- Modify: `packages/api/src/domains/cats/services/invoke-single-cat.ts`
- Modify: `packages/api/src/domains/cats/services/types.ts` (if sync flags needed)
- Test: `packages/api/test/route-strategies.test.js`

**Step 1: Write failing tests**

- 对 `routeSerial`/`routeParallel` 增加：
  - 第二轮 prompt 不包含第一轮已发送增量消息 ID
  - 必须包含上轮后新增的“用户 + 其他猫”消息 ID
  - 串行下后猫能看到前猫刚发出的回复（通过增量路径，而非 `previousResponses` 字符串拼接）

**Step 2: Run tests to verify fail**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/route-strategies.test.js`
Expected: FAIL

**Step 3: Implement incremental transport**

- 在每只猫调用前：
  - 读 `delivery cursor`
  - 拉取 `getByThreadAfter(cursor)`
  - 过滤掉当前猫自身历史 + 当前用户消息 ID
  - 组装增量上下文块
- 调用成功后（`done`）：`ackCursor(boundaryId)`
- 删除旧的 full-history prepend 逻辑与“历史截断降级提示”逻辑

**Step 4: Run tests**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/route-strategies.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/route-strategies.ts packages/api/src/domains/cats/services/invoke-single-cat.ts packages/api/src/domains/cats/services/types.ts packages/api/test/route-strategies.test.js
git commit -m "feat(api): exact incremental context delivery with cursor ack [缅因猫🐾]" -m "Why: eliminate duplicate replay while preserving all unseen user/peer messages."
```

---

### Task 6: End-to-End Proof Tests (No Duplicate, No Missing)

**Files:**
- Create: `packages/api/test/integration/incremental-delivery.test.js`
- Modify: `packages/api/test/integration/cross-cat-context.test.js`

**Step 1: Write failing integration tests**

- 场景 A：单猫 4 轮对话，断言每轮增量消息 ID 集合互不重叠。
- 场景 B：双猫串行，断言第二只猫看到第一只猫新消息且不重放旧消息。
- 场景 C：用户 + 两只猫交错发言，断言所有“用户 + 其他猫”消息最终都被投递到目标猫（无丢失）。

**Step 2: Run tests to verify fail**

Run: `pnpm -C packages/api build && cd packages/api && node --test test/integration/incremental-delivery.test.js`
Expected: FAIL

**Step 3: Fix edge cases until pass**

- 处理 aborted/error 时不 ack
- 处理空增量时仅发送当前用户消息
- 处理并发路由下游标竞争（同 key 单调更新）

**Step 4: Run full relevant suite**

Run:
- `pnpm -C packages/api build`
- `cd packages/api && node --test test/agent-router.test.js test/route-strategies.test.js test/integration/cross-cat-context.test.js test/integration/incremental-delivery.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/test/integration/incremental-delivery.test.js packages/api/test/integration/cross-cat-context.test.js
git commit -m "test(api): verify incremental delivery has no duplicates or missing messages [缅因猫🐾]" -m "Why: enforce hard invariants for exact unsent-only context propagation."
```

---

### Task 7: Docs + Backlog Hygiene

**Files:**
- Modify: `docs/bug-report/opus-resume-history-duplication/bug-report.md`
- Modify: `docs/BACKLOG.md`
- Create: `docs/mailbox/2026-02-09-incremental-delivery-final-plan-to-opus.md`

**Step 1: Update bug report status**

- 把根因条目升级为“已确认架构缺陷 + 最终修复路径”。

**Step 2: Update backlog**

- 标记“历史重复回放”债务项为进行中/完成（附 commit）。

**Step 3: Send handoff mail (WHY 5 要素)**

- What / Why / Tradeoff / Open Questions / Next Action 完整填写。

**Step 4: Commit docs**

```bash
git add docs/bug-report/opus-resume-history-duplication/bug-report.md docs/BACKLOG.md docs/mailbox/2026-02-09-incremental-delivery-final-plan-to-opus.md
git commit -m "docs(plan): publish final incremental delivery execution handoff [缅因猫🐾]" -m "Why: align team on zero-duplicate zero-missing context protocol and execution steps."
```

---

## Final Verification Checklist

Run all:

```bash
pnpm -C packages/api build
cd packages/api && node --test test/*.test.js
cd packages/api && node --test test/integration/*.test.js
```

Manual smoke:

1. 同一 thread 连续 5 轮，确认不再出现“历史包历史”。
2. `@布偶`、`@缅因` 串行两轮，确认第二只猫看到第一只猫新内容。
3. 从中途恢复 session 后继续对话，确认只发送未发送过的增量消息。

---

## Rollout Strategy

1. 先在开发环境跑 E2E 不少于 20 轮混合对话。
2. 再合入主干，观察审计日志中的“增量消息计数”和“重复率（应为 0）”。
3. 若出现异常，仅允许回滚整套增量协议，不引入临时截断降级逻辑。
