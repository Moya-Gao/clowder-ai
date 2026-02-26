---
feature_ids: []
topics: [context, health, inflated]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: ContextHealthBar 显示严重偏高

## 报告人
铲屎官 (2026-02-13)，在 thread `thread_mllf4gzgabe81b4m` 中观察到。

## 复现步骤

**期望 vs 实际行为**：

| 猫猫 | CLI 报告 | 前端 ContextHealthBar 显示 | 偏差 |
|------|----------|---------------------------|------|
| 缅因猫 (Codex) | 83% context left (= 17% used) | 68% used | +51 pp |
| 布偶猫 (Claude) | 44k/200k tokens (22% used) | 96% used | +74 pp |

前端 ContextHealthBar 显示的百分比远高于 CLI 实际报告的 context 使用率。

## 根因分析

### 数据流追踪

```
AgentService.invoke()
  → extractClaudeUsage() / turn.completed handler
    → metadata.usage.inputTokens (AGGREGATED across all turns!)
      → invoke-single-cat.ts: usedTokens = inputTokens
        → fillRatio = inputTokens / windowSize  ← BUG HERE
          → system_info { type: 'context_health', health }
            → frontend ContextHealthBar
```

### 根因 #1: Claude 使用 result/success 聚合数据计算 context fill

`ClaudeAgentService.ts` 的 `extractClaudeUsage()` 从 `result/success` 事件提取 usage。
该事件包含**整次 invocation 的聚合用量**（所有 API turns 的总和）。

```typescript
// extractClaudeUsage() — 从 result/success 提取
const totalInput = rawInput + cacheRead + cacheCreate;
result.inputTokens = totalInput;  // 这是多轮总和！
```

每个 turn 的 input 都包含完整对话历史，因此聚合值远大于实际 context 填充：

**示例**（3 turn session，实际 context 44k/200k = 22%）：
- Turn 1: 30k new + 0 cached = 30k total input
- Turn 2: 5k new + 30k cached = 35k total input
- Turn 3: 9k new + 35k cached = 44k total input

聚合后 `result/success.usage`:
- input_tokens = 44k (new across all turns)
- cache_read = 65k (cached across all turns)
- cache_create = 30k
- **我们的 totalInput = 44k + 65k + 30k = 139k**
- **fillRatio = 139k / 200k = 70%**（实际只有 22%！）

更多 turns → 偏差更大。5+ turns 时轻松达到 > 95%。

### 根因 #2: Codex turn.completed 可能也是聚合数据

`CodexAgentService.ts` 从 `turn.completed` 事件提取 usage：

```typescript
if (raw['type'] === 'turn.completed') {
  metadata.usage = usage;  // 覆盖写入
}
```

虽然用覆盖方式（只保留最后一个 turn），但 Codex CLI 的 `turn.completed.usage`
可能本身就是会话级聚合，而非单 turn 的数据。

17% used → 128k window → ~22k 实际。但 68% → ~87k → 约 4x 放大。

### 根因 #3: Codex 的 fallback window size 可能不准

`cat-config.json` 中 Codex 模型为 `gpt-5.3-codex`。
`getContextWindowFallback('gpt-5.3-codex')` prefix-match 命中 `gpt-5.3` → 128k。
但 `gpt-5.3-codex` 的实际 context window 可能更大（如 200k 或 400k）。

## 修复方案

### Claude 修复: 从 message_start 提取 per-turn input tokens

Anthropic 的 streaming API 在每个 `message_start` 事件中包含该次 API 调用的 per-call usage：

```json
{ "type": "message_start", "message": { "usage": {
    "input_tokens": N,
    "cache_creation_input_tokens": M,
    "cache_read_input_tokens": K
}}}
```

`N + M + K` = 该次 API 调用的总 input = 实际 context fill。

**修改**：
1. `TokenUsage` 新增 `lastTurnInputTokens?: number` 字段
2. `ClaudeAgentService`: 在 `message_start` stream event 中提取 usage，追踪最后一个的值
3. `invoke-single-cat.ts`: context health 使用 `lastTurnInputTokens`（fallback 到 `inputTokens`）

### Codex 修复: 待验证具体行为

需要确认 `turn.completed.usage` 是 per-turn 还是 cumulative。
如果是 cumulative，需要改为追踪相邻 turn 的 delta。

### 放弃的备选方案

- `inputTokens / numTurns`：不够准确（context 随 turn 增长，不是均匀分布）
- 只改 `invoke-single-cat.ts`：治标不治本，源头数据就是聚合的

## 验证方式

1. 启动 API + 前端
2. 在一个 thread 中发送消息给布偶猫（触发多 turn invocation）
3. 检查 ContextHealthBar 显示的百分比是否接近 CLI 报告的值
4. 同样验证缅因猫
