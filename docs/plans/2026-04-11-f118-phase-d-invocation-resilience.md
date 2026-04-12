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
   - CLI 挂住时前端 0 反馈 — 无 spinner、无状态、无"正在唤醒"提示
   - F118 Phase C 的 liveness warning UI 已实装，但只有 `alive_but_silent`（2min）和 `suspected_stall`（5min）才触发；0-2min 窗口是盲区

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
**修法**：`invoke-single-cat.ts:1109` 的 `create()` 调用传入继承的 failure count。

```typescript
// invoke-single-cat.ts:1109 附近
await deps.sessionChainStore.create({
  cliSessionId: msg.sessionId,
  threadId,
  catId,
  userId,
+ consecutiveRestoreFailures: existing.consecutiveRestoreFailures ?? 0,
});
```

同时：fresh retry（`shouldRetryWithoutSession`）也产生 `session_init` → `cli_session_replaced` → `create()` 路径。确保该路径也继承 count。

### D2 — Spawn Acknowledgment：秒级反馈

**问题**：CLI spawn 后到首帧之间用户看不到任何反馈。
**修法**：在 CLI spawn 后（`cli-spawn.ts` 产出第一个事件前）或 `invoke-single-cat.ts` 开始执行时，立即发一个轻量 `spawn_started` 事件。

两种候选路径：
- **A（后端 → 前端 socket）**：`invoke-single-cat.ts` 在进入 `service.invoke()` 前 yield 一个 `{ type: 'spawn_started', catId }` → `messages.ts` broadcast → 前端展示"正在唤醒..."
- **B（纯前端）**：收到 HTTP 202 `{ status: 'processing' }` 后立即展示"正在唤醒..."，不等 socket 事件

推荐 B（纯前端），改动最小且不依赖后端新事件。如果走 A，需要 `AgentMessage` type 扩展。

### D3 — InvocationTracker TTL Guard（防御性）

**问题**：`InvocationTracker.active` 是纯内存 `Map`，无 TTL。
**修法**：
- `ActiveInvocation` 已有 `startedAt` 字段
- `has()` 方法加 TTL check：如果 `Date.now() - startedAt > MAX_SLOT_TTL_MS`（默认 35 分钟 > 30 分钟 CLI 超时），自动 delete 并返回 false
- 同时在 `tryAutoExecute` 的 tracker 检查处也加 TTL check

### D4 — QueueProcessor.processingSlots Zombie Defense（防御性）

**问题**：`processingSlots` 是纯 `Set<string>`，无 timestamp。
**修法**：改为 `Map<string, number>`（value = processingStartedAt），在 `tryAutoExecute` 和 `tryExecuteNextAcrossUsers` 中加 zombie check：超过 `STALE_PROCESSING_THRESHOLD_MS`（对齐 InvocationQueue 的 600_000）的 slot 自动释放。

## Acceptance Criteria

### Phase D1（Circuit Breaker Fix）— 必须
- AC-D1: `cli_session_replaced` 创建新 session 时继承 `consecutiveRestoreFailures`
- AC-D2: 连续 3 次 resume→timeout→replace 后，第 4 次触发 overflow circuit breaker（seal + 不再 resume）
- AC-D3: 回归测试：模拟连续失败的 replace 链，验证熔断器在第 N 次触发

### Phase D2（Spawn Feedback）— 必须
- AC-D4: 用户发送 @mention 后 < 1s 内前端展示"正在唤醒"状态（不等 CLI 首帧）
- AC-D5: CLI 产出首帧后过渡到正常 thinking/streaming 动画

### Phase D3（Tracker TTL）— 推荐
- AC-D6: `InvocationTracker.has()` 对超过 TTL 的 slot 返回 false 并自动清理
- AC-D7: TTL 清理有单元测试

### Phase D4（Processing Slots Zombie）— 推荐
- AC-D8: `QueueProcessor.processingSlots` 超过 10 分钟的条目自动清理
- AC-D9: zombie 清理有单元测试

## Implementation Steps

### Step 1: D1 — Circuit Breaker Fix（~20 行，先红后绿）
1. 写红测：模拟 resume→timeout→cli_session_replaced→create 链，断言 failure count 被继承
2. 修 `invoke-single-cat.ts:1109`：create 时传入 `consecutiveRestoreFailures`
3. 写红测：连续 3 次 replace 后断言 overflow breaker 触发
4. 验证绿灯

### Step 2: D2 — Spawn Feedback（~30 行）
1. 前端：`messages.ts` POST 返回 `{ status: 'processing' }` 后立即在 store 中设置 cat 状态为 `spawning`
2. 前端：ThinkingIndicator 响应 `spawning` 状态，展示"正在唤醒..."
3. 验证：@mention 后立即可见反馈

### Step 3: D3 — Tracker TTL（~30 行）
1. 红测：slot 超过 TTL 后 `has()` 返回 false
2. 修 `InvocationTracker.has()` 和 `complete()` 加 TTL check
3. 绿灯

### Step 4: D4 — Processing Slots Zombie（~20 行）
1. 红测：processingSlot 超过阈值后被自动清理
2. 改 `processingSlots` 从 `Set` 到 `Map<string, number>`
3. 在 `tryAutoExecute` 入口加 zombie sweep
4. 绿灯

## Risk

| 风险 | 缓解 |
|------|------|
| D1 failure count 继承可能让正常的 session 升级也累积 count | `consecutiveRestoreFailures` 在有 substantive output 时重置为 0（line 1628），正常 session 不受影响 |
| D2 前端"正在唤醒"可能在极快响应时闪烁 | 加最小显示时间（如 500ms）或用 transition 过渡 |
| D3 TTL 误杀长时间运行但正常的 invocation | TTL 设为 35min > 30min CLI 超时 + busy-silent extension，正常 invocation 不会超过 |
| D4 zombie sweep 误删正在执行的 slot | 阈值 10min >> 正常 invocation 时间；且只在 tryAutoExecute 入口 sweep |

## Dependencies

- D1 无阻塞依赖
- D2 需要前端 store 改动（`useChatStore` 或类似）
- D3/D4 无阻塞依赖

## Priority & Ordering

D1 > D2 > D3 ≥ D4

D1 是 bug fix（熔断器不工作），可以先独立修+merge。D2 是 UX 改善。D3/D4 是防御性加固，可以后续或合并做。
