---
topics: [gpt52, codex, runtime, cancel, session-mutex, reliability]
doc_kind: plan
created: 2026-04-21
updated: 2026-04-21
---

# GPT-5.4 Live Invocation Recovery Implementation Plan

**Feature:** Bug fix — `docs/bug-report/2026-04-21-gpt52-live-invocation-stuck-after-cancel/bug-report.md`
**Goal:** 解决 live invocation 卡住后 `cancel` 不能恢复同 thread 再次调度，以及 Codex reconnect/no-progress 场景 fail-fast 不足的问题。
**Acceptance Criteria:** 
- AC-A1: 同一 thread 中，某次 `@gpt52` live invocation 卡住后，用户点击 `cancel`，再次在**同一 thread** `@gpt52` 时，必须能创建新的健康 invocation，并至少看到 `spawn_started`。
- AC-A2: `cliSessionId` 对应的 `SessionMutex` 在 `cancel` / terminal path 下稳定释放；不再因为上一次卡住而把后续请求堵在 `acquire()` 前。
- AC-A3: 当 Codex 只输出 reconnect/error 噪音而无实质进展超过阈值时，当前 invocation 应 fail-fast，不再长时间悬挂。
- AC-A4: 新增诊断证据：`mutex_acquired` / `mutex_released` / `mutex_force_released` / `waiting_on_session_lock` 至少能在日志中区分。
- AC-A5: 回归测试覆盖“卡住→cancel→同 thread 重新 invoke”以及“reconnect/no-progress fail-fast”两条主链。
**Architecture:** 第一阶段优先做后端可靠性修复，不碰前端设计语言：通过 `SessionMutex` owner 化 + cancel 路径强制释放，打断“卡住后 thread 被污染”的链路。第二阶段再对 Codex reconnect/no-progress 增加 provider 级 fail-fast，避免 invocation 长时间挂起。日志与测试先行，避免一边修一边猜。
**Tech Stack:** Node.js, Fastify, Socket.IO, node:test
**前端验证:** No — 第一阶段不新增前端 UI，仅验证现有 `spawn_started` / `done` 行为恢复正常

---

## Straight-Line Check

### Finish Line

用户在同一个 thread 里，如果一次 `@gpt52` 卡住并手动 `cancel`，后续再次 `@gpt52` 不需要重启 Cat Cafe 就能恢复正常调度；同时，Codex reconnect/no-progress 不再拖成超长悬挂。

### Not Building

- 不在这一轮里把全部 native tool parity 一次性补完
- 不重做前端完整 liveness UI 设计
- 不先做大范围重构（例如重写 queue/session 架构）

### Terminal Schema

```ts
type NativeProgressState =
  | 'healthy'
  | 'approval_pending'
  | 'no_executor'
  | 'reconnect_storm'
  | 'stalled';

interface SessionLockOwner {
  sessionId: string;
  invocationId: string;
  threadId: string;
  catId: string;
  acquiredAt: number;
}
```

---

## Task 1: 先写最贴脸的复现测试

**Files:**
- Create: `packages/api/test/invoke-single-cat-session-mutex-recovery.test.js`
- Modify: `packages/api/test/cli-spawn.test.js`

**Step 1: 写红测 — 卡住后 cancel，再次同 thread invoke 必须能重新启动**

场景：
- 第一次 invocation 获取 `SessionMutex`
- 模拟 provider 深处挂住，不自然结束
- 触发 cancel
- 第二次 invocation 使用同一个 `cliSessionId`
- 断言：不会永远卡在 `SessionMutex.acquire()`，并能继续往下走

**Step 2: 跑单测，确认当前实现失败**

Run: `pnpm -C packages/api exec node --test test/invoke-single-cat-session-mutex-recovery.test.js`
Expected: FAIL — 第二次 invocation 被卡住或没有任何可见进展

**Step 3: 写红测 — reconnect/no-progress 只输出噪音时必须 fail-fast**

场景：
- `spawnCli` 只收到 `Reconnecting... n/5` / error 类事件
- 没有 text/tool result/done
- 超过阈值后应产生 terminal failure，而不是无限等

**Step 4: 跑单测，确认当前实现失败**

Run: `pnpm -C packages/api exec node --test test/cli-spawn.test.js`
Expected: FAIL — 当前实现把 reconnect/error 当成“有活动”，不会提前失败

---

## Task 2: SessionMutex owner 化 + cancel 强制释放

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/SessionMutex.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Modify: `packages/api/src/infrastructure/websocket/SocketManager.ts`

**Step 1: 扩展 SessionMutex 数据结构，记录 owner invocation**

把现有：

```ts
private held = new Map<string, { release: () => void }>();
```

扩成最终形态：

```ts
private held = new Map<string, {
  owner: SessionLockOwner;
  release: () => void;
}>();
```

**Step 2: `acquire()` 接受 owner 元数据**

从：

```ts
acquire(sessionId: string, signal?: AbortSignal)
```

改成：

```ts
acquire(owner: SessionLockOwner, signal?: AbortSignal)
```

**Step 3: 新增显式强制释放 API**

新增其中一个：

```ts
forceReleaseByInvocation(invocationId: string): boolean
```

或：

```ts
forceReleaseBySessionId(sessionId: string): boolean
```

推荐优先 `invocationId`，因为它最精确。

**Step 4: `invoke-single-cat.ts` 在获取锁时传入 owner**

owner 至少包含：
- `sessionId`
- `invocationId`
- `threadId`
- `catId`
- `acquiredAt`

**Step 5: `SocketManager` 的 `cancel_invocation` 成功后触发强制释放**

在已有：
- `invocationTracker.cancel/cancelAll`
- `queueProcessor.clearPause`
- `queueProcessor.releaseSlot`

之后，再加：

```ts
sessionMutex.forceReleaseByInvocation(...)
```

或基于 thread/cat 反查当前 invocation/session 后释放。

**Step 6: 跑 Task 1 的红测，确认转绿**

Run: `pnpm -C packages/api exec node --test test/invoke-single-cat-session-mutex-recovery.test.js`
Expected: PASS

**Step 7: 加诊断日志**

至少新增：
- `session_mutex_acquired`
- `session_mutex_released`
- `session_mutex_force_released_on_cancel`
- `session_mutex_wait_queued`

---

## Task 3: reconnect/no-progress watchdog

**Files:**
- Modify: `packages/api/src/utils/cli-spawn.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
- Test: `packages/api/test/cli-spawn.test.js`

**Step 1: 定义“实质进展”**

这些算实质进展：
- `text`
- `item.completed`（真实内容 / 工具结果）
- `done`

这些不算实质进展：
- `Reconnecting...`
- 重复 error
- 纯噪音 warning

**Step 2: 在 `cli-spawn.ts` 里增加 non-progress 计时**

新增字段（示意）：

```ts
let lastSubstantiveProgressAt = Date.now();
```

只有实质进展才更新时间戳。

**Step 3: 超过阈值直接 fail-fast**

例如：
- `NO_PROGRESS_TIMEOUT_MS = 180_000`

当只有 reconnect/error 输出而无实质进展超过阈值时：
- 终止 child
- yield 明确的 timeout/error 分类

**Step 4: 跑 reconnect/no-progress 红测，确认转绿**

Run: `pnpm -C packages/api exec node --test test/cli-spawn.test.js`
Expected: PASS

---

## Task 4: 回归验证

**Files:**
- Modify: `packages/api/test/invoke-single-cat-session-mutex-recovery.test.js`
- Modify: `packages/api/test/cli-spawn.test.js`

**Step 1: 同 thread cancel recovery 回归**

验证：
- 第一次卡住
- cancel
- 第二次同 thread 再 invoke
- 能看到新的 `spawn_started` 或等价健康信号

**Step 2: 不误伤正常长任务**

验证：
- 正常长工具调用有持续实质进展时
- 不会被 non-progress watchdog 误杀

**Step 3: 不误伤 approval pending**

验证：
- 需要审批的 WAITING 步骤
- 不被当成 reconnect/no-progress 直接 fail-fast

---

## Suggested Commit Rhythm

1. `test: reproduce same-thread re-invoke blocked by stuck session mutex`
2. `fix: force-release session mutex on cancel`
3. `test: reproduce codex reconnect no-progress hang`
4. `fix: fail fast on codex reconnect without substantive progress`

---

## Checkpoints

- Checkpoint A: 复现测试红
- Checkpoint B: SessionMutex cancel recovery 绿
- Checkpoint C: reconnect/no-progress watchdog 绿
- Checkpoint D: 定向回归全绿

---

## 下一步

这份计划先给布偶猫做一次“狠狠 review + challenge”。  
如果他对 `SessionMutex` 这条主假设放行，再开 `worktree` 进入实现。
