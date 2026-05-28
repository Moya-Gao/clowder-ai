---
feature_ids: [F024]
topics: [codex, token-usage, cumulative-usage]
doc_kind: bug-report
created: 2026-05-27
---

# Bug Report: Codex 单次调用 token usage 被累计值放大

## 现象

`invocation_usage` / SessionRecord `lastUsage` 里 Codex `inputTokens` 出现明显不符合单次
invocation 的大数。现场例子：

- CLI session `019e1e9b-702f-7f41-81df-6c53fc7608c4`
- 最新 `token_count.info.last_token_usage.input_tokens = 195340`
- 同一条 `token_count.info.total_token_usage.input_tokens = 181526393`
- SessionRecord `contextHealth.usedTokens = 195340`
- SessionRecord `lastUsage.inputTokens = 181526393`

也就是说 context health 已经读到了真实当前上下文使用量，但单次 usage 仍被会话累计值污染。

## 根因

`CodexAgentService` 先从 `turn.completed.usage` 写入 `metadata.usage`，再通过
`codex-session-context-snapshot` 读取本地 rollout `token_count`。

F24 只用 snapshot 覆盖了：

- `contextUsedTokens`
- `contextWindowSize`
- `lastTurnInputTokens`

但 `inputTokens` / `cacheReadTokens` / `outputTokens` 已经从 `turn.completed.usage` 写入后，
不会被 snapshot 覆盖。Codex CLI 的 `turn.completed.usage` 与
`token_count.info.total_token_usage` 在长 session 中表现为 CLI session cumulative usage，
不适合当作单次 invocation usage。

## 修复

`codex-session-context-snapshot` 继续读取 `total_token_usage` 作为诊断字段，同时新增读取
`last_token_usage.cached_input_tokens` 与 `last_token_usage.output_tokens`。

`CodexAgentService` 在 snapshot 可用时：

- 用 `last_token_usage.input_tokens` 覆盖 `inputTokens`
- 用同一个值覆盖 `lastTurnInputTokens` 与 `contextUsedTokens`
- 用 `last_token_usage.cached_input_tokens` 覆盖 `cacheReadTokens`
- 用 `last_token_usage.output_tokens` 覆盖 `outputTokens`
- 如果 snapshot 没有 last cache/output 字段，则删除先前来自 cumulative `turn.completed`
  的对应字段，避免继续把累计值写入 `invocation_usage`

## 验证

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/codex-session-context-snapshot.test.js
node --test packages/api/test/codex-agent-service.test.js
```
