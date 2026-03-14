# F108 Phase A: Slot-Aware Runtime Implementation Plan

> **v2** — 吸收缅因猫(GPT-5.4) review 的 4 个 P1 缺口（2026-03-12）

**Feature:** F108 — `docs/features/F108-side-dispatch-concurrent-invocation.md`
**Goal:** InvocationTracker 从 per-thread 单锁改为 per-thread-per-cat 多槽（ExecutionSlot），使同一 thread 中不同猫可以并发执行
**Acceptance Criteria:**
- AC-A1: 同一 thread 中，两只不同的猫可以有并发 invocation，互不 abort
- AC-A2: 旁路 invocation 的消息在 thread 中对所有参与者可见
- AC-A3: 同一 catId 在同一 thread 仍保持单锁语义
- AC-A4: InvocationRecord runtime consumers 改为 slot-aware
- AC-A5: 现有 multi_mention 等编排工具向后兼容
- AC-A6: WorklistRegistry 按 parentInvocationId 绑定，A2A callback 不串台
- AC-A7: QueueProcessor slot-aware，一个 slot 完成不误推另一个 slot 的队列
- AC-A8: AgentMessage 携带 invocationId，前端可区分多 invocation 事件
- AC-A9: F086 MultiMention 收编到统一 SlotTracker
**Architecture:** 核心改动是 InvocationTracker 的 `active` Map key 从 `threadId` 改为 `${threadId}:${catId}` 复合键。所有 consumer（messages route、invocations route、ConnectorInvokeTrigger、QueueProcessor、SocketManager、queue.ts steer 路径、前端 stores）跟着适配。WorklistRegistry 改为 parentInvocationId 绑定，含完整 plumbing 链。
**Tech Stack:** TypeScript, Fastify, Zustand, Socket.IO
**前端验证:** Yes — Phase B（本计划不含前端 UX，仅含前端 store 适配）

### Review 修复记录

| # | 缅因猫 P1 | 修复 |
|---|-----------|------|
| P1-1 | WorklistRegistry plumbing 不完整 | Task 2 扩展为含完整透传链：callbacks.ts → callback-a2a-trigger.ts → routeExecution → routeSerial |
| P1-2 | queue.ts steer/immediate 路径漏了 | 新增 Task 6 覆盖 queue.ts 的 6 处 thread 级调用 |
| P1-3 | 前端状态模型不一致 + 漏 useSocket-background.ts | Task 10 改为 thread-scoped `Map<threadId, Map<invocationId, SlotState>>` + 补 useSocket-background.ts |
| P1-4 | AC-A9 与 Task 11 spike 矛盾 | Task 3 前置 DG-5 收编决策，AC-A9 必须在集成测试前完成 |

---

## Task 1: InvocationTracker → SlotTracker（核心）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts`
- Test: `packages/api/src/domains/cats/services/agents/invocation/__tests__/InvocationTracker.test.ts`

**What changes:**
- `active` Map key: `threadId` → `${threadId}:${catId}` (slotKey)
- `start(threadId, userId, catIds)` → `start(threadId, catId, userId, catIds)` — 只 abort 同 slot 的旧 invocation，不 abort 其他 cat 的
- `cancel(threadId)` → `cancel(threadId, catId)` — 精确到 slot
- `has(threadId)` → `has(threadId, catId?)` — 无 catId 时返回"thread 是否有任一活跃 slot"
- `complete(threadId, controller)` → `complete(threadId, catId, controller)`
- `getUserId(threadId)` → `getUserId(threadId, catId)`
- `guardDelete(threadId)` — 保持 thread 级（删 thread 需要 abort 所有 slot）
- 新增 `cancelAll(threadId)` — 替代原来 thread 级 cancel 的场景
- 新增 `getActiveSlots(threadId)` — 返回该 thread 所有活跃 slot 的 catId 列表
- 保留 `ActiveInvocation` 类型，增加 `catId` 字段

**Step 1: 写失败测试**

```typescript
// __tests__/InvocationTracker.test.ts
describe('SlotTracker: per-thread-per-cat isolation', () => {
  it('two different cats in same thread can have concurrent invocations', () => {
    const tracker = new InvocationTracker();
    const ctrl1 = tracker.start('t1', 'opus', 'user1', ['opus']);
    const ctrl2 = tracker.start('t1', 'codex', 'user1', ['codex']);
    expect(ctrl1.signal.aborted).toBe(false);
    expect(ctrl2.signal.aborted).toBe(false);
    expect(tracker.has('t1', 'opus')).toBe(true);
    expect(tracker.has('t1', 'codex')).toBe(true);
    expect(tracker.has('t1')).toBe(true);
  });

  it('same cat in same thread aborts previous invocation', () => {
    const tracker = new InvocationTracker();
    const ctrl1 = tracker.start('t1', 'opus', 'user1', ['opus']);
    const ctrl2 = tracker.start('t1', 'opus', 'user1', ['opus']);
    expect(ctrl1.signal.aborted).toBe(true);
    expect(ctrl2.signal.aborted).toBe(false);
  });

  it('cancel targets specific slot', () => {
    const tracker = new InvocationTracker();
    tracker.start('t1', 'opus', 'user1', ['opus']);
    tracker.start('t1', 'codex', 'user1', ['codex']);
    tracker.cancel('t1', 'opus');
    expect(tracker.has('t1', 'opus')).toBe(false);
    expect(tracker.has('t1', 'codex')).toBe(true);
  });

  it('cancelAll aborts all slots in thread', () => {
    const tracker = new InvocationTracker();
    tracker.start('t1', 'opus', 'user1', ['opus']);
    tracker.start('t1', 'codex', 'user1', ['codex']);
    tracker.cancelAll('t1');
    expect(tracker.has('t1')).toBe(false);
  });

  it('getActiveSlots returns all active catIds', () => {
    const tracker = new InvocationTracker();
    tracker.start('t1', 'opus', 'user1', ['opus']);
    tracker.start('t1', 'codex', 'user1', ['codex']);
    expect(tracker.getActiveSlots('t1')).toEqual(
      expect.arrayContaining(['opus', 'codex'])
    );
  });

  it('guardDelete blocks all slots and new starts', () => {
    const tracker = new InvocationTracker();
    tracker.start('t1', 'opus', 'user1', ['opus']);
    const guard = tracker.guardDelete('t1');
    expect(guard.acquired).toBe(false);
    tracker.cancel('t1', 'opus');
    const guard2 = tracker.guardDelete('t1');
    expect(guard2.acquired).toBe(true);
    const ctrl = tracker.start('t1', 'codex', 'user1', ['codex']);
    expect(ctrl.signal.aborted).toBe(true);
  });
});
```

**Step 2: RED** → `pnpm --filter @cat-cafe/api test -- --testPathPattern InvocationTracker`

**Step 3: 实现 SlotTracker**（改 InvocationTracker.ts，详见 v1 plan）

**Step 4: GREEN**

**Step 5: Commit** — `feat(F108): InvocationTracker → SlotTracker per-thread-per-cat [布偶猫🐾]`

---

## Task 2: WorklistRegistry + 完整 parentInvocationId plumbing（AC-A6）

> **缅因猫 P1-1 修复**：不只改 registry，完整透传链必须一起改。

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (line 81, 815)
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` (routeExecution opts)
- Modify: `packages/api/src/routes/callback-a2a-trigger.ts` (line 65-66)
- Modify: `packages/api/src/routes/callbacks.ts` (line 400-418)
- Test: `packages/api/test/worklist-registry.test.js` + `packages/api/test/callback-a2a-trigger.test.js`

**What changes (完整 plumbing 链):**

1. **WorklistRegistry.ts**: `registry` Map key `threadId` → `parentInvocationId`
   - `registerWorklist(parentInvocationId, worklist, maxDepth)`
   - `unregisterWorklist(parentInvocationId, owner?)`
   - `pushToWorklist(parentInvocationId, cats, callerCatId?)`
   - `hasWorklist(parentInvocationId)` / `getWorklist(parentInvocationId)`

2. **route-serial.ts**: `routeSerial` 需要接收 `parentInvocationId`
   - 签名增加 `opts.parentInvocationId?: string`
   - Line 81: `registerWorklist(opts.parentInvocationId ?? threadId, ...)` — 有 parentInvocationId 用它，没有 fallback threadId（向后兼容单猫场景）
   - Line 815: `unregisterWorklist(opts.parentInvocationId ?? threadId, ...)`

3. **AgentRouter.ts**: `routeExecution` opts 增加 `parentInvocationId`
   - 从 messages.ts 传入当前 invocation 的 ID

4. **callback-a2a-trigger.ts**: `enqueueA2ATargets` opts 增加 `parentInvocationId`
   - Line 65: `hasWorklist(opts.parentInvocationId)` — 用 parentInvocationId 查
   - Line 66: `pushToWorklist(opts.parentInvocationId, targetCats, callerCatId)`

5. **callbacks.ts**: post-message handler 透传 `record.invocationId` 作为 parentInvocationId
   - Line 400+: `enqueueA2ATargets(deps, { ...opts, parentInvocationId: record.invocationId })`

**Step 1: 写失败测试**

```typescript
describe('WorklistRegistry: parentInvocationId binding', () => {
  it('two concurrent invocations have independent worklists', () => {
    const entry1 = registerWorklist('inv-opus-1', ['codex', 'gemini'], 3);
    const entry2 = registerWorklist('inv-codex-1', ['opus'], 3);
    expect(hasWorklist('inv-opus-1')).toBe(true);
    expect(hasWorklist('inv-codex-1')).toBe(true);
    pushToWorklist('inv-opus-1', ['gpt52']);
    expect(entry1.list).toContain('gpt52');
    expect(entry2.list).not.toContain('gpt52');
  });

  it('unregister only removes matching invocation worklist', () => {
    const entry1 = registerWorklist('inv-1', ['codex'], 3);
    registerWorklist('inv-2', ['opus'], 3);
    unregisterWorklist('inv-1', entry1);
    expect(hasWorklist('inv-1')).toBe(false);
    expect(hasWorklist('inv-2')).toBe(true);
  });
});

describe('callback-a2a-trigger: parentInvocationId plumbing', () => {
  it('enqueueA2ATargets uses parentInvocationId to check worklist', () => {
    // Setup: mock router with parentInvocationId in opts
    // Verify pushToWorklist called with parentInvocationId, not threadId
  });
});
```

**Step 2: RED → Step 3: 改全链 → Step 4: GREEN → Step 5: Commit**

```bash
git commit -m "feat(F108): WorklistRegistry parentInvocationId + full plumbing chain [布偶猫🐾]"
```

---

## Task 3: DG-5 收编决策 — F086 MultiMention → SlotTracker（AC-A9）

> **缅因猫 P1-4 修复**：前置到 Task 3，不是最后的可选 spike。

**Files:**
- Read: `packages/api/src/domains/cats/services/agents/routing/callback-multi-mention-routes.ts` (line 135-170)
- Read: `packages/api/src/domains/cats/services/agents/routing/MultiMentionOrchestrator.ts` (line 212-257)
- Modify: 上述文件（如果收编方案确定）
- Output: 更新 F108 spec DG-5 + 本 plan

**收编分析（需要回答）：**
1. MultiMention 的 `abortByThread(threadId)` 能否改为 `abortBySlot(threadId, catId)` 或直接删除（由 SlotTracker cancel 替代）？
2. MultiMention 维护的 per-target AbortController 与 SlotTracker 的 per-slot controller 是否有 1:1 对应关系？
3. 如果可以收编：改 MultiMentionOrchestrator 使用 SlotTracker 的 controller 而非自己创建
4. 如果不能完全收编：明确哪些场景保留 MultiMention 独立 controller，哪些委托 SlotTracker

**Time-box: 60 min**（比 v1 的 30 min 加倍，因为必须产出可实现的方案，不能只是"推迟"）

**Step 1: 读代码分析 → Step 2: 写收编方案 → Step 3: 更新 DG-5 → Step 4: 实现 → Step 5: 测试 → Step 6: Commit**

```bash
git commit -m "feat(F108): F086 MultiMention → SlotTracker unification (DG-5) [布偶猫🐾]"
```

---

## Task 4: QueueProcessor slot-aware（AC-A7）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Test: `packages/api/src/domains/cats/services/agents/invocation/__tests__/QueueProcessor.test.ts`

**What changes:**
- `processingThreads: Set<string>` → `processingSlots: Set<string>` (slotKey)
- `pausedThreads: Map<string, ...>` → `pausedSlots: Map<string, ...>` (slotKey)
- `onInvocationComplete(threadId, status)` → `onInvocationComplete(threadId, catId, status)`
- `tryExecuteNextAcrossUsers(threadId)` → `tryExecuteNextAcrossUsers(threadId, catId)`
- `tryExecuteNextForUser(threadId, userId)` → `tryExecuteNextForUser(threadId, catId, userId)`
- `clearPause(threadId)` → `clearPause(threadId, catId)`
- `releaseThread(threadId)` → `releaseSlot(threadId, catId)`
- `executeEntry` 内调用 `invocationTracker.start` 和 `complete` 传入 catId

**Step 1: 写失败测试**

```typescript
describe('QueueProcessor: slot-aware', () => {
  it('slot completion does not dequeue entries for different slot', async () => {
    // Setup: opus executing in t1, codex queued in t1
    // Complete opus slot → should dequeue for opus slot only
  });

  it('processing mutex is per-slot, not per-thread', async () => {
    // Two different cats can execute concurrently in same thread
  });
});
```

**Step 2: RED → Step 3: 改 → Step 4: GREEN → Step 5: Commit**

```bash
git commit -m "feat(F108): QueueProcessor slot-aware mutex and dequeue [布偶猫🐾]"
```

---

## Task 5: messages.ts route 适配（SA-4 核心）

**Files:**
- Modify: `packages/api/src/routes/messages.ts`
- Test: 现有 messages route 测试 + 新增并发测试

**What changes:**
- Line 215: `invocationTracker.has(threadId)` → `invocationTracker.has(threadId, targetCat)` — 检查目标 cat 的 slot
- Line 301-323: force mode cancel → `invocationTracker.cancel(threadId, targetCat, userId)` — 只 cancel 目标 cat 的 slot
- Line 342: `invocationTracker.start(threadId, userId, targetCats)` → `invocationTracker.start(threadId, primaryCat, userId, targetCats)`
- Line 486+: invocation record 和消息 emit 补 `invocationId`
- 向 `routeExecution` 传入 `parentInvocationId`（与 Task 2 plumbing 接上）

**Step 1-5: TDD cycle → Commit**

```bash
git commit -m "feat(F108): messages route slot-aware dispatch [布偶猫🐾]"
```

---

## Task 6: queue.ts steer/immediate 路径适配

> **缅因猫 P1-2 修复**：v1 漏了这条路径。

**Files:**
- Modify: `packages/api/src/routes/queue.ts`
- Test: 现有 queue route 测试 + 新增 slot-aware 测试

**What changes (6 处，全在 steer immediate 路径 line 170-186):**

| Line | 现在 | 改为 |
|------|------|------|
| 171 | `invocationTracker.has(threadId)` | `invocationTracker.has(threadId, entry.targetCat)` — 检查目标 cat 的 slot |
| 172 | `invocationTracker.getUserId(threadId)` | `invocationTracker.getUserId(threadId, entry.targetCat)` |
| 177 | `invocationTracker.cancel(threadId, guard.userId)` | `invocationTracker.cancel(threadId, entry.targetCat, guard.userId)` |
| 179 | `getMultiMentionOrchestrator().abortByThread(threadId)` | 收编后由 SlotTracker 处理（Task 3 决策）；如未收编则改为 `abortBySlot(threadId, entry.targetCat)` |
| 184 | `queueProcessor.clearPause(threadId)` | `queueProcessor.clearPause(threadId, entry.targetCat)` |
| 185 | `queueProcessor.releaseThread(threadId)` | `queueProcessor.releaseSlot(threadId, entry.targetCat)` |

**关键**：steer immediate 本质是"我要打断某只猫然后替换执行"——在 slot 模型下应该只打断目标 cat 的 slot，不影响其他 cat。

**Step 1: 写失败测试**

```typescript
describe('queue.ts steer immediate: slot-aware', () => {
  it('steer immediate only cancels target cat slot, not other cats', async () => {
    // Setup: opus + codex both executing in t1
    // Steer immediate targeting opus
    // Verify: opus cancelled, codex still running
  });
});
```

**Step 2: RED → Step 3: 改 → Step 4: GREEN → Step 5: Commit**

```bash
git commit -m "feat(F108): queue.ts steer immediate slot-aware [布偶猫🐾]"
```

---

## Task 7: invocations.ts route 适配

**Files:**
- Modify: `packages/api/src/routes/invocations.ts`

**What changes:**
- Line 115: `invocationTracker.start(record.threadId, ...)` → 传入 `record.catId`
- Line 135, 242: `invocationTracker.complete(record.threadId, controller)` → 传入 catId
- retry/resume 路径，record 里已有 catId，直接透传

**Step 1-5: TDD cycle → Commit**

```bash
git commit -m "feat(F108): invocations route slot-aware retry [布偶猫🐾]"
```

---

## Task 8: ConnectorInvokeTrigger + SocketManager 适配

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts`
- Modify: `packages/api/src/infrastructure/websocket/SocketManager.ts`

**ConnectorInvokeTrigger changes:**
- Line 98, 106: `has(threadId)` → `has(threadId, catId)`
- Line 198: `cancel(threadId, userId)` → `cancel(threadId, catId, userId)`
- Line 267: `start(threadId, userId, targetCats)` → 传入 catId
- Line 442: `complete(threadId, controller)` → 传入 catId

**SocketManager changes:**
- Line 92-108: `cancel_invocation` payload 增加可选 `catId`
- 有 catId → `cancel(threadId, catId, userId)`
- 无 catId（向后兼容）→ `cancelAll(threadId)` — 老客户端仍能工作

**Step 1-5: TDD cycle → Commit**

```bash
git commit -m "feat(F108): ConnectorInvokeTrigger + SocketManager slot-aware [布偶猫🐾]"
```

---

## Task 9: AgentMessage 补 invocationId（AC-A8）

**Files:**
- Modify: `packages/shared/src/types/agent-message.ts`
- Modify: messages.ts、invocations.ts、ConnectorInvokeTrigger.ts — emit 时补 invocationId
- Modify: SocketManager.ts — broadcast 时透传 invocationId

**What changes:**
- AgentMessage 类型增加可选 `invocationId?: string` 字段
- 所有 emit 点补上 invocationId（从 invocation record 取）
- 前端 socket handler 可据此区分不同 invocation 的消息

**Step 1-5: TDD cycle → Commit**

```bash
git commit -m "feat(F108): AgentMessage carry invocationId [布偶猫🐾]"
```

---

## Task 10: 前端 thread-scoped activeInvocations（AC-A8 前端侧）

> **缅因猫 P1-3 修复**：thread-scoped Map + 补 useSocket-background.ts

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts`
- Modify: `packages/web/src/hooks/useSocket.ts`
- Modify: `packages/web/src/hooks/useAgentMessages.ts`
- Modify: `packages/web/src/hooks/useSocket-background.ts` ← **v1 漏了**
- Test: 对应 test 文件

**What changes:**

**chatStore.ts — thread-scoped 状态模型（匹配 DG-3）:**
- 新增 `activeInvocations` 嵌套结构：与现有 `threadStates` 集成
  - Active thread: `activeInvocations: Map<invocationId, SlotState>` 作为 flat state
  - Background thread: `threadStates[threadId].activeInvocations`
- `SlotState = { catId: string; mode: string }`
- `hasActiveInvocation` 变为 derived: `activeInvocations.size > 0`
- 新增 `addActiveInvocation(invocationId, catId, mode)` / `removeActiveInvocation(invocationId)`
- `setThreadHasActiveInvocation` / `resetThreadInvocationState` 改为操作 `activeInvocations` Map
- `intentMode`、`targetCats`、`catStatuses` — Phase A 保持现有行为（向后兼容），Phase B 改为 per-slot

**useAgentMessages.ts:**
- `done(isFinal)` handler (line 365-371): 只 `removeActiveInvocation(msg.invocationId)`，不清零整 thread
- 如果 `activeInvocations.size > 0` → `hasActiveInvocation` 保持 true

**useSocket-background.ts — 缅因猫指出的漏洞:**
- `markThreadInvocationComplete()` (line 165-167): 改为 `removeActiveInvocation`
  - 从 `msg.invocationId` 取 invocationId（Task 9 已补到 AgentMessage）
  - 如果该 thread 还有其他 active invocation → 不设 `hasActiveInvocation = false`
- `markThreadInvocationActive()` (line 155-163): 改为 `addActiveInvocation`

**useSocket.ts:**
- `intent_mode` handler (line 268-296): 用 `msg.invocationId` 操作 `activeInvocations`
- `queue_updated` handler: 同上

**Step 1: 写失败测试**

```typescript
describe('chatStore: thread-scoped multi-slot', () => {
  it('two active invocations → hasActiveInvocation stays true after one completes', () => {
    store.addActiveInvocation('inv-1', 'opus', 'execute');
    store.addActiveInvocation('inv-2', 'codex', 'execute');
    expect(store.getState().hasActiveInvocation).toBe(true);
    store.removeActiveInvocation('inv-1');
    expect(store.getState().hasActiveInvocation).toBe(true); // codex still active
    store.removeActiveInvocation('inv-2');
    expect(store.getState().hasActiveInvocation).toBe(false);
  });

  it('background thread invocation complete does not clear other slots', () => {
    // Set thread as background
    // Add two invocations to background thread
    // Complete one → the other stays active
  });

  it('thread switch preserves activeInvocations per thread', () => {
    // Thread A has opus active
    // Switch to Thread B
    // Thread B has codex active
    // Switch back to Thread A → opus still active
  });
});
```

**Step 2: RED → Step 3: 改 → Step 4: GREEN → Step 5: Commit**

```bash
git commit -m "feat(F108): frontend thread-scoped activeInvocations [布偶猫🐾]"
```

---

## Task 11: 集成测试 — 并发 side-dispatch 端到端（AC-A1~A9）

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/__tests__/side-dispatch-integration.test.ts`

**What it tests:**
1. 两只不同猫在同一 thread 并发执行，互不 abort（AC-A1）
2. 旁路消息在 thread 中对所有参与者可见（AC-A2）
3. 同 catId 同 thread 仍串行（AC-A3）
4. 向后兼容：单猫执行和旧式 cancel 行为不变（AC-A5）
5. A2A callback 使用 parentInvocationId 不串台（AC-A6）
6. QueueProcessor slot 完成不误推（AC-A7）
7. AgentMessage 携带 invocationId（AC-A8）
8. MultiMention 通过 SlotTracker 统一管理（AC-A9）

**Step 1: 写测试 → Step 2: RED → Step 3: 确认 GREEN → Step 4: Commit**

```bash
git commit -m "test(F108): side-dispatch integration tests covering AC-A1~A9 [布偶猫🐾]"
```

---

## Execution Order & Dependencies

```
Task 1 (SlotTracker 核心) ← 所有后续依赖此
  ↓
Task 2 (WorklistRegistry + plumbing 全链) ← A2A 相关 consumer 依赖此
  ↓
Task 3 (DG-5: F086 MultiMention 收编) ← queue.ts 的 abortByThread 依赖收编决策
  ↓
Task 4 (QueueProcessor) ← 依赖 Task 1
  ↓
Task 5 (messages.ts) ← 依赖 Task 1 + 2
Task 6 (queue.ts steer) ← 依赖 Task 1 + 3 + 4
Task 7 (invocations.ts) ← 依赖 Task 1
Task 8 (Connector + Socket) ← 依赖 Task 1
  ↓（以上 4 个互相独立可并行）
Task 9 (AgentMessage invocationId) ← 依赖 Task 5-8 的 emit 点
  ↓
Task 10 (前端 store) ← 依赖 Task 9
  ↓
Task 11 (集成测试) ← 依赖 Task 1-10 全部完成
```

## NOT Building (Phase A 明确不做)

- Phase B UX（锁头、猫选择器、执行状态面板）— 另开 plan
- 双写冲突检测 — Phase A 硬约束一写一读
- 前端消息分栏渲染 — Phase B
- Queue scopeKey 重设计 — DG-7 待验证，如果当前队列在 slot-aware tracker 下工作正常则不改
