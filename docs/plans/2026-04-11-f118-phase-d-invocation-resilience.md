---
feature_ids: [F118]
related_features: [F122]
topics: [reliability, cli, session-recovery, ux]
doc_kind: plan
created: 2026-04-11
---

# F118 Phase D: Invocation Resilience — Circuit Breaker Fix + Spawn Feedback

**Feature:** F118 — `docs/features/F118-cli-liveness-watchdog.md`
**Origin:** 侦探猫猫调查（thread_mnv8t1a5lb4waz4a, 2026-04-11）— 铲屎官报告两个线程的砚砚 @mention 5+ 分钟无响应
**Investigators:** 砚砚(GPT-5.4, 冠军)、宪宪(Opus)、烁烁(Gemini, 裁判)

## Why

### 事件还原

2026-04-11 21:00-21:10，`thread_mntwt5b8petacm1f` 和 `thread_mnuvv7bkwz5jdg1u` 的 `@gpt52` mention 均超过 5 分钟无响应。三猫联合调查后定位到以下故障链：

```
用户 @gpt52
  → CLI 正常 spawn → session_init + turn.started
  → CLI 内部卡住（上游 Codex CLI/MCP hang）
  → 前端无反馈（intent_mode 推迟到首帧，#768）
  → 5-7 分钟后 stall-kill → session sealed (cli_session_replaced)
  → fresh retry → 新 session 创建，但 failure count = 0（bug）
  → 新 session 也卡 → 同样循环
  → 熔断器永远不触发 → 用户持续无反馈
```

### 根因（按重要性排序）

1. **AC-C6 实现 bug：failure count 在 `cli_session_replaced` 时被洗掉**（砚砚发现）
   - `invoke-single-cat.ts:1662-1668`：resume 超时后 `consecutiveRestoreFailures` 在当前 active session +1
   - `invoke-single-cat.ts:1109`：收到新 `session_init` 时 `create()` 新 session，不继承 failure count
   - 效果：每次换壳 count 归零 → 熔断器（阈值 3）永远不触发

2. **spawn 后到首帧之间的 UX 盲区**
   - `messages.ts:772`：`intent_mode` 推迟到 CLI 首帧 NDJSON（#768 fix）
   - 发送后有全局 `loading` 状态，但缺少显式的 per-cat `spawning` 阶段 — 用户无法区分"消息已发送"和"猫在启动中"
   - F118 Phase C 的 liveness warning UI 已实装，但只有 `alive_but_silent`（2min）和 `suspected_stall`（5min）才触发；0-2min 窗口缺少 per-cat 反馈

3. **InvocationTracker 无 TTL 防护**（宪宪发现，本次非根因但是防御性缺口）
   - 纯内存 `Map`，如果 `finally` 块未执行（Node 崩溃等极端场景），slot 永久泄漏
   - 本次事件中 cleanup 正常执行，不是根因

### 上游 Codex CLI 已知问题

- `openai/codex#14470`：`codex exec --json resume` 在 macOS 上可无声挂死
- `openai/codex#14115`：外部 MCP `tools/list` 后不再 `tools/call`
- `openai/codex#6664`：把 Codex 自己的 MCP server 挂进去会直接卡死
- `openai/codex#7187`, `#5575`：Working forever / reconnecting forever

我们无法修上游，但需要让本地防御机制在上游 hang 时正确工作。

## What

### D1 — Circuit Breaker Fix：failure count 跨 session 继承

**问题**：`cli_session_replaced` 时新 session 的 `consecutiveRestoreFailures` 从 0 开始。

**注意**：`CreateSessionInput` 接口（`SessionChainStore.ts:11-16`）不含 `consecutiveRestoreFailures`，`create()` 无法直接传入。

**修法（create + immediate update）**：
```typescript
// invoke-single-cat.ts:1109 附近
const inheritedFailures = existing.consecutiveRestoreFailures ?? 0;
const newRec = await deps.sessionChainStore.create({
  cliSessionId: msg.sessionId,
  threadId,
  catId,
  userId,
});
// 继承 failure count — create 后立即 update
if (inheritedFailures > 0) {
  await deps.sessionChainStore.update(newRec.id, {
    consecutiveRestoreFailures: inheritedFailures,
  });
}
```

`SessionRecordPatch` 已包含 `consecutiveRestoreFailures`（`SessionChainStore.ts:30`），所以 `update()` 路径无需改契约。

**排除路径**：`ephemeralSession`（ACP transport）走 `invoke-single-cat.ts:1070-1076` 的 `update(cliSessionId)` 分支，不经过 `create()` → 不继承 failure count。这是正确的——ephemeral session 每次都是独立的，不存在 restore failure 语义。

同时：fresh retry（`shouldRetryWithoutSession`）也产生 `session_init` → `cli_session_replaced` → `create()` 路径。确保该路径也继承 count。

### D2 — Spawn Acknowledgment：秒级反馈

**问题**：CLI spawn 后到首帧之间缺少 per-cat spawning 状态。发送后有全局 `loading`，但 `ThinkingIndicator` 依赖 `intentMode + targetCats`（来自 `intent_mode` socket 事件），而 `intent_mode` 推迟到 CLI 首帧（#768）。

**修法：A-lite（后端 yield `spawn_started`，不改 `intent_mode` 语义）**

- `invoke-single-cat.ts`：在进入 `service.invoke()` 前 yield `{ type: 'spawn_started', catId, targetCats }`
- `messages.ts` background coroutine：broadcast 这个事件
- 前端 `useChatSocketCallbacks`：监听 `spawn_started`，设置 per-cat `spawning` 状态
- `ThinkingIndicator`：响应 `spawning` 状态，展示"正在唤醒..."
- `intent_mode` 保持现有语义不变（"CLI 有首帧"才发），#768 不受影响

**为什么不选 B（纯前端 202）**：HTTP 202 响应不含 `targetCats`/`mode`（砚砚 review P2），前端无法知道是哪只猫在启动，只能做全局 loading（已有），无法做 per-cat 反馈。

### D3 — InvocationTracker TTL Guard（防御性）

**问题**：`InvocationTracker.active` 是纯内存 `Map`，无 TTL。
**修法**：
- `ActiveInvocation` 已有 `startedAt` 字段
- `has()` 方法加 TTL check：如果 `Date.now() - startedAt > MAX_SLOT_TTL_MS`，自动 delete 并返回 false
- **TTL 计算**：必须 > invocation hard timeout（`2 * CLI_TIMEOUT_MS`，默认 60min）+ 安全余量。默认值 `75 * 60 * 1000`（75min），或动态绑定 `2.5 * resolveCliTimeoutMs()`
- 同时在 `tryAutoExecute` 的 tracker 检查处也加 TTL check
- 多猫并发场景：TTL sweep 只清理目标 slot，不影响同 thread 其他 cat 的 slot

### D4 — QueueProcessor.processingSlots Zombie Defense（防御性）

**问题**：`processingSlots` 是纯 `Set<string>`，无 timestamp。
**修法**：改为 `Map<string, number>`（value = processingStartedAt），在 `tryAutoExecute` 和 `tryExecuteNextAcrossUsers` 入口加 zombie sweep。

**安全阈值**：与 D3 联动，建议同样使用 `75min` 或 `2.5 * resolveCliTimeoutMs()`。

**额外安全守卫**（砚砚 review）：sweep 前先检查 `invocationTracker.has(threadId, catId)` — 如果 tracker 仍有活跃 slot，说明 invocation 确实还在跑（只是慢），不释放 processingSlot。只有 tracker 也没有对应 slot 时才判定为 zombie 并释放。

## Acceptance Criteria

### Phase D1（Circuit Breaker Fix）— 必须
- AC-D1: `cli_session_replaced` 创建新 session 时继承 `consecutiveRestoreFailures`
- AC-D2: 连续 3 次 resume→timeout→replace 后，第 4 次触发 overflow circuit breaker（seal + 不再 resume）
- AC-D3: 回归测试：模拟连续失败的 replace 链，验证熔断器在第 N 次触发

### Phase D2（Spawn Feedback）— 必须
- AC-D4: 后端在 CLI spawn 前 yield `spawn_started` 事件（含 catId + targetCats）
- AC-D5: 前端收到 `spawn_started` 后展示 per-cat "正在唤醒" 状态，CLI 首帧到达后过渡到 thinking/streaming
- AC-D5b: `intent_mode` 语义不变（仍在 CLI 首帧后才 broadcast），#768 不回归

### Phase D3（Tracker TTL）— 推荐
- AC-D6: `InvocationTracker.has()` 对超过 TTL（默认 75min）的 slot 返回 false 并自动清理
- AC-D7: TTL 清理有单元测试（含长工具调用 >10min 的回归测试，确认不误清理）
- AC-D7b: 多猫并发场景：清理只影响超时的特定 slot，不波及同 thread 其他 cat

### Phase D4（Processing Slots Zombie）— 推荐
- AC-D8: `QueueProcessor.processingSlots` 超过阈值（与 D3 联动，默认 75min）且 `invocationTracker.has()` 为 false 时自动清理
- AC-D9: zombie 清理有单元测试（含 tracker 仍活跃时不误清理的回归测试）

## Implementation Steps

### Step 1: D1 — Circuit Breaker Fix（~30 行，先红后绿）
1. 写红测：模拟 resume→timeout→cli_session_replaced→create 链，断言 failure count 被继承
2. 修 `invoke-single-cat.ts:1109`：create 后 immediate update 继承 `consecutiveRestoreFailures`
3. 写红测：连续 3 次 replace 后断言 overflow breaker 触发
4. 写红测：ephemeralSession 路径不继承 failure count（不污染 ACP transport）
5. 验证绿灯

### Step 2: D2 — Spawn Feedback（~50 行 后端 + ~30 行前端）
1. 后端：`invoke-single-cat.ts` 在进入 `service.invoke()` 前 yield `{ type: 'spawn_started', catId, targetCats }`
2. 后端：`messages.ts` background coroutine broadcast `spawn_started`
3. 前端：`useChatSocketCallbacks` 监听 `spawn_started`，设置 per-cat `spawning` 状态
4. 前端：`ThinkingIndicator` 响应 `spawning`，展示"正在唤醒..."
5. 验证：`intent_mode` 仍在 CLI 首帧才发（#768 不回归）
6. 验证：split-pane 场景的 `spawn_started` 状态同步

### Step 3: D3 — Tracker TTL（~40 行）
1. 红测：slot 超过 TTL 后 `has()` 返回 false
2. 红测：slot 未超 TTL 时 `has()` 正常返回 true（长工具回归）
3. 红测：多猫并发 — 清理 catA 不影响 catB 的 slot
4. 修 `InvocationTracker.has()` 加 TTL check，TTL 默认 `75 * 60_000`（> 2x CLI timeout + 安全余量）
5. 绿灯

### Step 4: D4 — Processing Slots Zombie（~30 行）
1. 红测：processingSlot 超过阈值 + tracker 无对应 slot → 自动清理
2. 红测：processingSlot 超过阈值但 tracker 仍有对应 slot → 不清理
3. 改 `processingSlots` 从 `Set` 到 `Map<string, number>`
4. 在 `tryAutoExecute` 入口加 zombie sweep（先查 tracker 再决定是否释放）
5. 绿灯

## Risk

| 风险 | 缓解 |
|------|------|
| D1 failure count 继承可能让正常的 session 升级也累积 count | `consecutiveRestoreFailures` 在有 substantive output 时重置为 0（line 1628），正常 session 不受影响 |
| D1 ephemeralSession 路径不该继承 | ephemeralSession 走不同分支（line 1070-1076），不经过 `create()` 路径，天然隔离 |
| D2 前端"正在唤醒"可能在极快响应时闪烁 | 加最小显示时间（如 500ms）或用 transition 过渡 |
| D2 `spawn_started` 新事件类型需要 AgentMessage 扩展 | 只加一个新 type，不修改现有 type 语义 |
| D3 TTL 误杀长时间运行但正常的 invocation | TTL=75min > invocation hard timeout（2x CLI timeout = 60min）+ 15min 余量；busy-silent 扩展不会超过 hard cap |
| D4 zombie sweep 误删正在执行的 slot | 先查 invocationTracker.has() — tracker 有活跃 slot 则不释放（砚砚 review 双重守卫） |

## Dependencies

- D1 无阻塞依赖
- D2 需要前端 store 改动（`useChatStore` 或类似）
- D3/D4 无阻塞依赖

## Priority & Ordering

D1 > D2 > D3 ≥ D4

D1 是 bug fix（熔断器不工作），可以先独立修+merge。D2 是 UX 改善。D3/D4 是防御性加固，可以后续或合并做。
