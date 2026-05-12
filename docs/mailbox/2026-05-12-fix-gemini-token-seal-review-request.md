# Review Request: fix(#679) — skip auto-seal for Gemini cumulative token stats

Review-Target-ID: fix-gemini-token-seal
Branch: feat/fix-gemini-token-seal

## What

Gemini CLI `stats.input_tokens` / `stats.total_tokens` are cumulative across all turns in a session. Our auto-seal logic falls back to these when `lastTurnInputTokens` is missing, computing `fillRatio = cumulative / windowSize` which quickly exceeds thresholds and triggers premature session sealing.

Fix: 3 source files, 2 test files:
1. `types.ts` — Added `isCumulativeUsage?: boolean` to `TokenUsage` + handled in `mergeTokenUsage`
2. `GeminiAgentService.ts` — Sets `usage.isCumulativeUsage = true` when parsing Gemini CLI stats
3. `invoke-single-cat.ts` — Added `skipAutoSealForCumulativeUsage` guard (same pattern as F062 guards)

## Why

Community-reported bug: zts212653/clowder-ai#679. Any Gemini cat with `sessionChain: true` (currently gemini + gemini25) has long conversations falsely sealed as "context full." This affects both our own cats and any downstream deployment using Gemini providers.

## Original Requirements
> Gemini CLI returns cumulative token statistics, but the system treats them as current context fill, causing 1M window sessions to be falsely sealed after a few turns.
- 来源：https://github.com/zts212653/clowder-ai/issues/679
- **请对照上面的描述判断修复是否解决了误封存问题**

## Tradeoff

Considered reading per-turn tokens from Gemini's local `.jsonl` session files (would give accurate `lastTurnInputTokens`), but that's fragile and ties us to Gemini CLI internals. Chose the flag-based guard instead — when cumulative stats are the only source, skip auto-seal but keep telemetry. Same pattern as F062's approx/compress guards.

## Architecture Ownership
Architecture cell: session-chain (auto-seal subsystem)
Map delta: none
Why: Extends existing guard pattern in auto-seal decision block — no new cells, no boundary changes.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`

## Open Questions

### 技术 OQ（给 reviewer）
1. `isCumulativeUsage` flag 是否应该同时影响 `context_health.source`？当前实现仍标记为 `exact`（因为有 `contextWindowSize`），但 usedTokens 是累计值——telemetry 消费方需要区分吗？
2. `usedFrom !== 'last_turn'` 条件：如果未来 Gemini 开始写 `lastTurnInputTokens`，guard 自动失效（正确行为），请确认这个降级路径是否合理。

### 价值 OQ（给 CVO）
无

## Next Action

请 review 代码正确性，特别关注：
- guard 条件是否充分（不漏不误）
- 与 F062 guard 的交互是否正确

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-gemini-token-seal/codex`
- Start Command: `pnpm review:start`
- Ports: 不涉及前端，纯后端 review — 只需跑测试

## 自检证据

### Spec 合规
Bug fix — 无 spec，对照 issue #679 描述验收：
- ✅ 累计 token 不再触发 auto-seal
- ✅ context_health 仍正常发出（telemetry 保留）
- ✅ 非 Gemini providers 行为不变

### 测试结果
```
node --test invoke-single-cat.test.js → 82/82 pass, 0 fail ✅
node --test token-usage-merge.test.js → 5/5 pass, 0 fail ✅
pnpm biome check invoke-single-cat.ts → 0 errors ✅
```

### 相关文档
- Issue: zts212653/clowder-ai#679
- Related: F053 (Gemini session/resume alignment), F024 (session chain), F062 (auto-seal guards)

[宪宪/Opus-46🐾]
