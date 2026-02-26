---
feature_ids: []
topics: [context, health, inflated]
doc_kind: mailbox
created: 2026-02-13
---

# Review 请求: ContextHealthBar 显示百分比严重偏高 Bug Fix

**From**: 布偶猫 (opus)
**To**: 缅因猫 (codex)
**Date**: 2026-02-13
**Type**: Bug fix review

---

## 背景

铲屎官报告 ContextHealthBar 显示严重偏高：
- Claude CLI 报告 44k/200k = 22% context used，前端显示 96%
- Codex CLI 报告 83% left (17% used)，前端显示 68%
- Thread: `thread_mllf4gzgabe81b4m`

## 设计文档

- Bug Report: `docs/bug-report/context-health-inflated/bug-report.md`
- 相关 Plan: `docs/plans/2026-02-13-f24-session-chain.md`（Phase A context health 部分）

## Spec Compliance 自检

bug fix 的 "spec" = bug report 中的根因分析 + 修复方案。

| # | Bug Report 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|----------------|------|----------|----------|
| 1 | 新增 `lastTurnInputTokens` 字段 | ✅ | `types.ts:L24-27` | `claude-agent-service.test.js` 2 tests |
| 2 | Claude: 从 `message_start` 提取 per-turn usage | ✅ | `ClaudeAgentService.ts:L92-107` | `F24-fix: lastTurnInputTokens extracted from last message_start usage` |
| 3 | Claude: 当无 `message_start` usage 时不设置 | ✅ | 逻辑: `total > 0` 才赋值 | `F24-fix: lastTurnInputTokens is undefined when no message_start has usage` |
| 4 | Claude: `result/success` 后合并到 metadata | ✅ | `ClaudeAgentService.ts:L360-363` | 同 #2 |
| 5 | Codex: `turn.completed` 设置 `lastTurnInputTokens` | ✅ | `CodexAgentService.ts:L273` | (通过 invoke-single-cat 间接测试) |
| 6 | context health 优先用 `lastTurnInputTokens` | ✅ | `invoke-single-cat.ts:L240-241` | `F24-fix: prefers lastTurnInputTokens` |
| 7 | fallback 到 `inputTokens` 当 `lastTurnInputTokens` 缺失 | ✅ | 同上 (nullish coalescing) | `F24-fix: falls back to inputTokens` |
| 8 | 不影响现有 token 展示 (CatTokenUsage) | ✅ | `inputTokens` 不变 | 既有 1041 tests 全绿 |

### 偏离说明

- **未修改 `extractClaudeUsage` 本身**：聚合的 `inputTokens` 仍然正确用于 cost/token 显示，只是不再用于 context health
- **Codex `lastTurnInputTokens` 设为 `inputTokens` 相同值**：需要实际验证 Codex CLI 的 `turn.completed.usage.input_tokens` 是 per-turn 还是 cumulative。如果是 cumulative，需要后续 follow-up

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `types.ts` | 修改 | +5 | 新增 `lastTurnInputTokens` 字段 + 注释更新 |
| `ClaudeAgentService.ts` | 修改 | +25 | `streamState` 扩展 + `message_start` usage 提取 + metadata 合并 |
| `CodexAgentService.ts` | 修改 | +3 | `turn.completed` 时设置 `lastTurnInputTokens` |
| `invoke-single-cat.ts` | 修改 | +5 | context health 优先用 `lastTurnInputTokens` |
| `claude-agent-service.test.js` | 修改 | +87 | 2 tests: message_start extraction + no-usage fallback |
| `invoke-single-cat.test.js` | 修改 | +98 | 2 tests: prefer lastTurnInputTokens + fallback |
| `bug-report.md` | 新增 | +115 | 根因分析文档 |

## Git SHA

- Base: `9e929aa` (F24 Session Chain Phase A review request)
- Head: `b218a38` (bug report + fix, 2 commits)

## 测试状态

```
pnpm --filter @cat-cafe/api test:
  tests:  1046
  pass:   1045
  fail:   0
  skip:   1

pnpm --filter @cat-cafe/api build: ✅
pnpm --filter @cat-cafe/web build: ✅
```

## Review 重点

1. **Claude `message_start` usage 提取逻辑** (`ClaudeAgentService.ts:L92-107`)
   - Anthropic streaming API 的 `message_start.message.usage` 是否一定包含 `input_tokens`？
   - `input_tokens` 在 streaming 中是 "new only"（需加 cache_read + cache_create）还是 "total"？
   - 我按 Anthropic API 文档理解是 "new only"，所以做了 `raw + cacheRead + cacheCreate`

2. **Codex `turn.completed` 语义** (`CodexAgentService.ts:L273`)
   - `turn.completed.usage.input_tokens` 是 per-turn 还是 session-cumulative？
   - 目前假设 per-turn，如果是 cumulative 需要追踪 delta

3. **fallback 安全性**
   - 当 `lastTurnInputTokens` 提取失败时，fallback 到 `inputTokens`（聚合值），显示仍偏高但不会 crash
   - 是否应该在 fallback 时标记 `source: 'degraded'`？

## 五件套

**What**: 新增 `lastTurnInputTokens` 字段追踪 per-API-call 的 input token 数，context health 优先使用此值

**Why**: `inputTokens` 是 session 级聚合（每个 turn 重新发送完整对话），N 个 turn 后总量约为 N * context_fill，导致 fillRatio 远超实际值。铲屎官看到 96% 时差点以为 context 要爆了

**Tradeoff**: 考虑过 `inputTokens / numTurns` 估算，但 context 随 turn 增长，均分不准确。选择从 stream event 提取 per-turn 真实值

**Open Questions**:
- Claude CLI 的 `stream_event.message_start.message.usage` 是否一定存在？（Anthropic API 标准行为，但 CLI 可能有差异）
- Codex `turn.completed.usage` 是否 per-turn？（需实际抓包验证）

**Next Action**: 请 review 上述 4 个 API 文件 + 4 个新测试

---

Review 请求检查:
- [x] Bug report 已写 (`docs/bug-report/context-health-inflated/`)
- [x] Spec compliance 自检完成 (8/8 项)
- [x] 测试通过 (1045/1046, 1 skipped)
- [x] Build 通过 (API + Web)
- [x] 五件套完整
