# F122 Phase B + F108 Phase B — 统一调度 + 双模发送 UX

**Feature:** F122 — `docs/features/F122-unified-dispatch-queue.md` + F108 — `docs/features/F108-side-dispatch-concurrent-invocation.md`
**Goal:** 所有执行通道（A2A/multi_mention/user/connector）入统一 InvocationQueue，前端支持悄悄话/广播双模发送，铲屎官能 steer 任何来源的排队任务。
**Acceptance Criteria:**
- F122B AC-B1: A2A callback 产出 queue entry（`source: 'agent'`），auto-execute
- F122B AC-B2: multi_mention 产出 queue entry，auto-execute
- F122B AC-B3: QueueProcessor 统一处理 user/connector/agent 三种 source
- F122B AC-B4: steer 可以管控所有 queue entry（含 agent-sourced）
- F108B AC-B1: 锁头按钮 → 猫选择器 → 悄悄话发送，不打断当前执行猫
- F108B AC-B2: 猫选择器灰掉当前正在执行的猫
- F108B AC-B3: 广播消息不打断当前执行猫，排队到下次拉起
- F108B AC-B4: 广播消息中 @ 特定空闲猫，该猫开始旁路执行
- F108B AC-B5: Thread 执行状态指示（头像 + 活跃状态）
- F108B AC-B6: Stop 按钮精确到每只猫
- F108B AC-B7: 输入框状态：给空闲猫发消息直接发送，不显示 Queue/Force
**Architecture:** 扩展 InvocationQueue 的 source 类型支持 `'agent'`，添加 `autoExecute` 标志；A2A trigger 和 multi_mention 改为 enqueue 而非直接 dispatch；QueueProcessor 的 auto-execute 链已存在（`onInvocationComplete → tryExecuteNextAcrossUsers`），只需让 agent-sourced entry 走同一条路；前端新增锁头模式、per-cat 状态、per-cat stop。
**Tech Stack:** TypeScript, Fastify, React, Socket.IO, InvocationTracker, InvocationQueue, QueueProcessor
**前端验证:** Yes — 双模发送、猫选择器、per-cat stop 必须用 Playwright/Chrome 实测

**NOT building:**
- WorklistRegistry 废弃（Phase B 不删 worklist，只旁路它；Phase C 再清理）
- 跨 thread 调度（每个 thread 独立）
- A2A 审批流（auto-execute = 自动，不需要人工确认）

---

## Straight-Line Check

**B = 终态**：铲屎官在一个 thread 里，看得到所有猫的执行状态（谁在忙、谁排队、谁空闲），发消息时可以选择悄悄话（给空闲猫旁路执行）或广播（排队），猫猫之间的 A2A handoff 也在 QueuePanel 可见、可被 steer。

**Terminal schema:**
```typescript
// InvocationQueue entry — 扩展 source
interface QueueEntry {
  // ... existing fields ...
  source: 'user' | 'connector' | 'agent';  // NEW: 'agent' for A2A/multi_mention
  autoExecute: boolean;  // NEW: true = QueueProcessor 自动执行，不等 steer
  callerCatId?: string;  // NEW: A2A 发起猫（用于 QueuePanel 显示"猫A handoff 给猫B"）
}

// 前端 thread 执行状态
interface ThreadExecutionState {
  activeCats: Array<{
    catId: string;
    status: 'executing' | 'queued';
    source: 'user' | 'connector' | 'agent';
  }>;
}
```

---

## Task 1: 扩展 QueueEntry source 类型

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts:22` — source 类型加 `'agent'`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts:15-28` — QueueEntry 接口加 `autoExecute` + `callerCatId`
- Test: `packages/api/test/invocation-queue.test.js` — 新增 agent source enqueue 测试

**Step 1: Write failing test**
```typescript
it('accepts agent source with autoExecute flag', () => {
  const result = queue.enqueue({
    threadId: 't1', userId: 'system', content: 'A2A handoff',
    source: 'agent', targetCats: ['opus'], intent: 'execute',
    autoExecute: true, callerCatId: 'codex',
  });
  assert.equal(result.outcome, 'enqueued');
  assert.equal(result.entry.source, 'agent');
  assert.equal(result.entry.autoExecute, true);
  assert.equal(result.entry.callerCatId, 'codex');
});
```

**Step 2:** Run → FAIL（TypeScript 类型不允许 `'agent'`）

**Step 3: Implement**
- `QueueEntry.source` 类型改为 `'user' | 'connector' | 'agent'`
- 加 `autoExecute: boolean`（default `false`）
- 加 `callerCatId?: string`
- `enqueue()` 方法把新字段透传到 entry

**Step 4:** Run → PASS

**Step 5:** Commit: `feat(F122B): extend QueueEntry with agent source + autoExecute`

---

## Task 2: QueueProcessor 支持 auto-execute agent entries

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` — `tryExecuteNextAcrossUsers` 逻辑
- Test: `packages/api/test/queue-processor-auto-execute.test.js` — 新测试文件

**Step 1: Write failing test**
```typescript
it('auto-executes agent entry immediately after enqueue', async () => {
  // Enqueue an agent entry with autoExecute: true
  queue.enqueue({
    threadId: 't1', userId: 'system', content: 'A2A',
    source: 'agent', targetCats: ['opus'], intent: 'execute',
    autoExecute: true, callerCatId: 'codex',
  });
  // Trigger processing
  await queueProcessor.onInvocationComplete('t1', 'codex', 'succeeded');
  // Agent entry should be picked up and executed
  assert.equal(executeEntryCalls.length, 1);
  assert.equal(executeEntryCalls[0].source, 'agent');
});

it('agent entries visible in QueuePanel data but not blockable by steer pause', async () => {
  // autoExecute entries should not be blocked by pause state
  queueProcessor.onInvocationComplete('t1', 'codex', 'failed'); // sets pause
  queue.enqueue({
    threadId: 't1', userId: 'system', content: 'A2A',
    source: 'agent', targetCats: ['opus'], intent: 'execute',
    autoExecute: true, callerCatId: 'codex',
  });
  // Auto-execute should still fire (agent bypass pause)
  // But steer can still override by removing the entry
});
```

**Step 2:** Run → FAIL

**Step 3: Implement**
- `onInvocationComplete` 已调用 `tryExecuteNextAcrossUsers`，这个链已存在
- 关键改动：当 A2A 产生新 entry 时，需要**主动触发** `tryExecuteNextAcrossUsers`（因为当前猫还在跑，不会触发 `onInvocationComplete`）
- 新增 `onAutoExecuteEnqueue(threadId)` — 在 enqueue 后立即调用，如果 entry 是 autoExecute 且目标猫 slot 空闲 → 直接 executeEntry
- 如果目标猫 slot 忙 → entry 保留在 queue，等 `onInvocationComplete` 自动链

**Step 4:** Run → PASS

**Step 5:** Commit: `feat(F122B): QueueProcessor auto-execute for agent entries`

---

## Task 3: A2A trigger 改为 enqueue

**Files:**
- Modify: `packages/api/src/routes/callback-a2a-trigger.ts:47-170` — `enqueueA2ATargets` 改为走 InvocationQueue
- Test: `packages/api/test/callback-a2a-trigger.test.js` — 更新现有测试

**Step 1: Write failing test**
```typescript
it('A2A post_message with @mention enqueues to InvocationQueue instead of pushToWorklist', async () => {
  // Cat calls post_message with @opus
  const result = await enqueueA2ATargets(deps, {
    threadId: 't1', callerCatId: 'codex', targetCats: ['opus'],
    content: 'handoff message', userId: 'system',
  });
  // Should enqueue, not pushToWorklist
  assert.equal(deps.invocationQueue.enqueue.mock.calls.length, 1);
  const enqueueCall = deps.invocationQueue.enqueue.mock.calls[0].arguments[0];
  assert.equal(enqueueCall.source, 'agent');
  assert.equal(enqueueCall.autoExecute, true);
  assert.equal(enqueueCall.callerCatId, 'codex');
});
```

**Step 2:** Run → FAIL

**Step 3: Implement**
- `enqueueA2ATargets` 新逻辑：
  1. 每个 targetCat 产出一个 `queue.enqueue({ source: 'agent', autoExecute: true, callerCatId })` entry
  2. 调用 `queueProcessor.onAutoExecuteEnqueue(threadId)` 触发自动执行
  3. 不再调用 `pushToWorklist` 或 `triggerA2AInvocation`
- **WorklistRegistry 暂保留**：`routeSerial` 内部的 worklist 迭代不变（它只管"本次 invocation 内多猫串行"），A2A handoff（跨 invocation）才走 queue
- 关键区分：`routeSerial` 里的多猫是**同一 invocation 内串行**（worklist）；A2A handoff 是**新 invocation**（走 queue）

**Step 4:** Run → PASS

**Step 5:** Commit: `feat(F122B): A2A trigger enqueue instead of pushToWorklist`

---

## Task 4: multi_mention 改为 enqueue

**Files:**
- Modify: `packages/api/src/routes/callback-multi-mention-routes.ts:89-220` — `dispatchToTarget` 改为 enqueue
- Test: `packages/api/test/multi-mention-routes.test.js` — 更新现有测试

**Step 1: Write failing test**
```typescript
it('multi_mention dispatches via InvocationQueue with agent source', async () => {
  // Multi-mention @opus @codex
  await registerMultiMentionRoutes(app, deps);
  const res = await app.inject({
    method: 'POST', url: '/api/callbacks/multi-mention',
    payload: { requestId: 'mm-1', threadId: 't1', targetCats: ['opus', 'codex'], ... },
  });
  // Should enqueue two entries (one per cat)
  assert.equal(deps.invocationQueue.enqueue.mock.calls.length, 2);
  const sources = deps.invocationQueue.enqueue.mock.calls.map(c => c.arguments[0].source);
  assert.deepEqual(sources, ['agent', 'agent']);
});
```

**Step 2:** Run → FAIL

**Step 3: Implement**
- `dispatchToTarget` 改为：
  1. `queue.enqueue({ source: 'agent', autoExecute: true, callerCatId, targetCats: [targetCatId] })`
  2. `queueProcessor.onAutoExecuteEnqueue(threadId)` 触发自动执行
  3. 不再直接调用 `invocationTracker.start` + `router.routeExecution`
- MultiMentionOrchestrator 的 `registerDispatch` / `recordResponse` / `flushResult` 机制需要适配：
  - `QueueProcessor.executeEntry` 完成后需要回调 `orch.recordResponse`
  - 方案：在 entry 上加 `onComplete` callback，或让 `onInvocationComplete` 检查 entry metadata

**Step 4:** Run → PASS

**Step 5:** Commit: `feat(F122B): multi_mention dispatch via InvocationQueue`

---

## Task 5: steer 管控 agent-sourced entries

**Files:**
- Modify: `packages/api/src/routes/queue.ts` — steer 逻辑覆盖 agent entries
- Test: `packages/api/test/queue-steer.test.js` — 新增 agent entry steer 测试

**Step 1: Write failing test**
```typescript
it('steer can override agent-sourced queue entry', async () => {
  // Enqueue agent entry
  queue.enqueue({ source: 'agent', autoExecute: true, ... });
  // User steers their own message ahead
  const res = await app.inject({
    method: 'POST', url: '/api/queue/steer',
    payload: { threadId: 't1', entryId: 'user-entry-id' },
  });
  assert.equal(res.statusCode, 200);
  // User entry should execute, agent entry stays queued
});
```

**Step 2-5:** Implement + verify + commit

**关键设计**：steer 逻辑已存在，只需确保 agent-sourced entries 在 steer 时正确排序。当前 steer 是"跳过队列立即执行"，agent entry 不需要特殊处理——steer 直接 abort + force 执行用户消息，agent entry 自然被推后。

Commit: `feat(F122B): steer covers agent-sourced queue entries`

---

## Task 6: 前端 — Thread 执行状态指示（F108B AC-B5）

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts` — ThreadExecutionState 类型
- Create: `packages/web/src/hooks/useThreadExecutionState.ts` — 从 socket 事件聚合 per-cat 状态
- Modify: `packages/web/src/components/ChatContainer.tsx` — 渲染 per-cat 活跃指示
- Modify: `packages/api/src/routes/messages.ts` — emit `thread_execution_state` 事件
- Test: `packages/web/src/hooks/__tests__/useThreadExecutionState.test.ts`

**Step 1: Write failing test** — hook 接收 socket 事件，聚合 activeCats 列表

**Step 3: Implement**
- 后端：每次 `invocationTracker.start`/`complete` 时 emit `thread_execution_state` 事件到 thread
  ```typescript
  socketManager.broadcastToThread(threadId, 'thread_execution_state', {
    threadId,
    activeCats: tracker.getActiveCats(threadId), // 新方法：返回 [{catId, userId, source}]
  });
  ```
- `InvocationTracker` 新增 `getActiveCats(threadId)` 方法
- 前端 hook 监听事件，存入 store
- ChatContainer 渲染猫头像 + 状态指示

Commit: `feat(F108B): thread execution state indicator`

---

## Task 7: 前端 — Per-cat Stop（F108B AC-B6）

**Files:**
- Modify: `packages/web/src/components/ChatContainer.tsx` — 每只活跃猫旁边加独立 Stop 按钮
- Modify: `packages/web/src/hooks/useSendMessage.ts` — per-cat cancel API
- Modify: `packages/api/src/routes/messages.ts` 或 `queue.ts` — per-cat cancel endpoint
- Test: `packages/web/src/components/__tests__/per-cat-stop.test.ts`

**Step 1: Write failing test** — 点击猫A的 Stop 不影响猫B

**Step 3: Implement**
- 后端已支持 per-slot cancel（`invocationTracker.cancel(threadId, catId)`）
- 前端：Stop 按钮调用 `POST /api/messages/cancel` 带 `{ threadId, catId }` 参数
- 当前 cancel 是 thread 级（cancel all），改为带 `catId` 参数时只 cancel 那只猫

Commit: `feat(F108B): per-cat stop button`

---

## Task 8: 前端 — 双模发送（F108B AC-B1~B4, B7）

**Files:**
- Create: `packages/web/src/components/WhisperModeSelector.tsx` — 锁头按钮 + 猫选择器
- Modify: `packages/web/src/components/ChatContainer.tsx` — 集成 WhisperModeSelector
- Modify: `packages/web/src/hooks/useSendMessage.ts` — whisper 模式参数
- Modify: `packages/api/src/routes/messages.ts` — whisper + side-dispatch 路径
- Test: `packages/web/src/components/__tests__/whisper-mode.test.ts`

**Step 1: Write failing test** — 锁头模式下发送消息带 `visibility: 'whisper'` + `whisperTo: [catId]`

**Step 3: Implement**
- **锁头按钮**（AC-B1）：切换 whisper 模式，显示猫选择器
- **猫选择器**（AC-B2）：列出所有猫，灰掉正在执行的猫（从 `useThreadExecutionState` 获取）
- **发送**：whisper 模式下，`deliveryMode: 'immediate'`（目标猫空闲所以直接执行），`visibility: 'whisper'`，`whisperTo: [selectedCat]`
- **广播模式**（AC-B3）：默认模式。消息带 `deliveryMode: 'queue'`（排队不打断）
- **广播 @ 空闲猫**（AC-B4）：消息中 @ 了空闲猫 → 该猫 side-dispatch 执行。后端逻辑：解析 mentions，空闲猫的 message 走 immediate，忙碌猫的走 queue
- **输入框状态**（AC-B7）：当目标猫空闲时不显示 Queue/Force 选择器，直接发送

Commit: `feat(F108B): whisper mode + broadcast non-interrupt`

---

## Task 9: QueuePanel 显示 agent entries

**Files:**
- Modify: `packages/web/src/components/QueuePanel.tsx` — 渲染 agent-sourced entries
- Test: `packages/web/src/components/__tests__/queue-panel-agent-entries.test.ts`

**Step 1: Write failing test** — QueuePanel 显示"猫A handoff 给猫B"格式的 agent entry

**Step 3: Implement**
- agent-sourced entry 显示为：`[猫A → 猫B] handoff 内容...`
- 区分 autoExecute（灰色，自动执行不可 steer）vs manual（可 steer）
- 实际上 autoExecute 的 entry 也可以被 steer 覆盖（用户强推自己的消息），只是 UI 上不鼓励

Commit: `feat(F122B): QueuePanel renders agent entries`

---

## Task 10: 回归测试 + 集成验证

**Files:**
- Modify: `packages/api/test/messages-delivery-mode.test.js` — 确认改动不破坏现有行为
- Modify: `packages/api/test/queue-gate-thread-level.test.js` — 同上
- Run: 全量 API 测试 + Web 测试

**Step 1:** `pnpm --filter @cat-cafe/api test` — all pass
**Step 2:** `pnpm --filter @cat-cafe/web test` — all pass
**Step 3:** `pnpm lint` + `pnpm check` — 0 errors
**Step 4:** Playwright 端到端：双模发送 → 锁头悄悄话 → per-cat stop → A2A 在 QueuePanel 可见

Commit: `test(F122B+F108B): regression + integration`

---

## 执行顺序 + 依赖图

```
Task 1 (QueueEntry source 扩展)
  └→ Task 2 (QueueProcessor auto-execute)
       ├→ Task 3 (A2A trigger enqueue)        ← F122B 后端核心
       ├→ Task 4 (multi_mention enqueue)      ← F122B 后端核心
       └→ Task 5 (steer agent entries)        ← F122B 后端补全
            └→ Task 9 (QueuePanel agent entries) ← F122B 前端

Task 6 (Thread 执行状态)                      ← F108B 基础
  ├→ Task 7 (per-cat Stop)                    ← F108B
  └→ Task 8 (双模发送 UX)                     ← F108B 核心

Task 10 (回归 + 集成)                         ← 最后

可并行：Task 1-5 (后端) 和 Task 6-8 (前端) 有部分并行空间
但 Task 8 需要 Task 5 的后端支持（广播排队语义）
```

## WorklistRegistry 处置

**Phase B 不删 worklist。** `routeSerial` 内部的多猫串行迭代仍用 worklist（同一 invocation 内的猫A→猫B→猫C 串行），这是 invocation 内部实现细节。

改变的是：**跨 invocation 的 A2A handoff** 从 `pushToWorklist`（直接注入当前 invocation 的 worklist）改为 `enqueue`（产出新的 queue entry → 新 invocation）。

Phase C（未来）再考虑是否完全废弃 worklist，当前保持稳定。

## F108 OQ 处置

| OQ | 决策 |
|---|---|
| F108 OQ-1: 多槽 scopeKey | 不改——QueueEntry 已有 per-user scope，agent entries 用 `userId: 'system'`，天然和用户 entries 隔离 |
| F108 OQ-2: A2A 精确路由 | 用 `targetCats` 字段精确指定，QueueProcessor 已按 targetCats 选猫 |
| F108 OQ-3: 旁路 system prompt | 不改——每个 invocation 独立拉 system prompt，不需要感知其他执行流 |
| F108 OQ-4: 交错 vs 分栏 | 保持交错（按时间排列），Thread 执行状态指示解决"谁在说话"的问题 |
