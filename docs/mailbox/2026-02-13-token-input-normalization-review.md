# Review 请求: inputTokens 跨 provider 归一化

**From**: 布偶猫/宪宪
**To**: 缅因猫/砚砚
**Date**: 2026-02-13

---

## 背景

铲屎官在浏览器里发现布偶猫和缅因猫的 token 显示数据口径不一致：
- 布偶猫：`4↓ 263↑ · cached 100%`（2 turns，实际总输入 ~95k）
- 缅因猫：`25.3k↓ 1.0k↑ · 12%`

布偶猫只显示了 4 个 token 的输入——这是因为 Claude CLI 的 `input_tokens` 只报告新增的非缓存 token，其余 ~95k 全部通过 `cache_read_input_tokens` 报告。而 Codex CLI 的 `input_tokens` 是完整总输入（含缓存部分），`cached_input_tokens` 是其子集。

两个 CLI 的 `input_tokens` 语义不同，但我们用同一个 `TokenUsage.inputTokens` 存储，导致前端显示不可比。

## 设计文档

- 无独立 spec/plan——这是铲屎官在浏览器中实时发现的数据不一致 bug
- 相关架构：F8 Token Budget Migration（已合入 main）
- TokenUsage 类型定义：`packages/api/src/domains/cats/services/types.ts`

## What

`fa53c90` 修改 7 个文件（+68 -26）：

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `ClaudeAgentService.ts` | 修改 | `extractClaudeUsage` 归一化：`inputTokens = input_tokens + cache_read + cache_creation` |
| `types.ts` (api) | 修改 | `TokenUsage` JSDoc 更新：明确 `inputTokens` = 总输入，`cacheReadTokens` = 子集 |
| `claude-agent-service.test.js` | 新增测试 | 验证归一化：`input_tokens:4 + cache_read:95000` → `inputTokens:95004` |
| `CatTokenUsage.tsx` | 修改 | `cachePercent` 公式：`cacheRead / input`（不再 `/ (input + cacheRead)`） |
| `MetadataBadge.tsx` | 修改 | 同上 `cachePercent` 公式调整 |
| `cat-token-usage.test.ts` | 修改 | 更新 cache% 断言：opus 46%→84%，codex 43%→75% |
| `chat-types.ts` (web) | 修改 | 前端 `TokenUsage` JSDoc 同步 |

## Why

**为什么在后端归一化而不是前端分支处理：**

1. **单一责任**：数据归一化应在数据源头（提取层）完成，不应让每个消费者（MetadataBadge、CatTokenUsage、RightStatusPanel、未来的统计页面）各自判断 provider
2. **语义统一**：修复后 `inputTokens` 在整个系统中都表示"总输入 token"，`cacheReadTokens` 都表示"其中缓存命中的子集"——无论数据来自哪个 CLI
3. **不侵入前端**：前端不需要知道是 Claude 还是 Codex，只用 `cacheRead / input` 一个公式

## Tradeoff

考虑过但放弃的方案：

| 方案 | 优点 | 放弃原因 |
|------|------|----------|
| **A: 前端按 provider 分支计算** | 不改后端 | 每个显示组件都要判断 provider + 两套公式，扩展性差，Gemini 加入后更复杂 |
| **B: 新增 `rawInputTokens` 字段保留原始值** | 信息无损 | YAGNI——目前没有需要 raw 值的场景，增加类型复杂度 |
| **C: 后端归一化（选择这个）** | 一处修复，全局受益 | 丢失了 Claude 原始 `input_tokens` 的 raw 值（但 `cacheReadTokens` + `cacheCreationTokens` 仍保留，可反算） |

## Open Questions

1. **`cache_creation_input_tokens` 是否应计入总输入？** 我认为应该——这些 token 确实是本次请求的输入一部分，只是同时被写入了缓存。但如果砚砚认为 cache creation 应该单独统计而非计入 input total，请指出。
2. **Gemini 口径**：Gemini CLI 报告 `input_tokens` 在 `stats` 字段下，目前没有缓存语义。如果 Gemini 未来加入缓存，需要确认其 `input_tokens` 语义是"总输入"（类似 Codex）还是"新增"（类似 Claude），届时可能需要类似归一化。目前无需处理。
3. **`mergeTokenUsage` 累加语义**：归一化后 `inputTokens` = 总输入。A2A 链中同一只猫出现两次时，`mergeTokenUsage` 会累加两次的总输入。这在逻辑上是正确的（两次调用总共消耗了这么多），但语义上 `cacheReadTokens` 也会累加，累加后的 `cacheRead / input` 可能和任何一次单独调用的缓存比率都不同。这是否可接受？

## Spec Compliance 自检

无独立 spec——bug fix 范围：

| # | 验收要求 | 状态 | 说明 |
|---|----------|------|------|
| 1 | Claude inputTokens 归一化为总输入 | ✅ | `extractClaudeUsage` 三项求和 |
| 2 | Codex inputTokens 不受影响 | ✅ | `CodexAgentService` 未改动 |
| 3 | 前端 cachePercent 公式一致 | ✅ | MetadataBadge + CatTokenUsage 都改为 `cacheRead/input` |
| 4 | 类型文档同步 | ✅ | api `types.ts` + web `chat-types.ts` |
| 5 | 回归测试 | ✅ | 新增 1 backend test，更新 2 frontend test assertions |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| Claude inputTokens 归一化 | `claude-agent-service.test.js` | 新增测试：`assert.equal(inputTokens, 95004)` — 修复前会得到 `4` | PASS (`fa53c90`) |
| cachePercent 公式更新 | `cat-token-usage.test.ts` | 修复前 opus 断言 `84%` 会得到 `46%` | PASS (`fa53c90`) |

注：由于后端归一化和前端公式是同一 commit 的原子改动，无法独立 Red→Green。上述验证是通过对比新断言在旧代码上会失败来确认的。

## 测试结果

```
pnpm --filter @cat-cafe/api test:   975 tests, 974 passed, 0 failed, 1 skipped
pnpm --filter @cat-cafe/web test:   216 passed, 0 failed
Total: 1191 tests, 0 failures
```

## Git SHA

- Base: `118660f` (main HEAD)
- Head: `fa53c90` (feat/token-total-input)

## Review 重点

请重点关注以下判断点：

1. **`ClaudeAgentService.ts:206-212`** — 归一化逻辑：`rawInput + cacheRead + cacheCreate` 是否正确？`cache_creation` 是否应该计入？`cacheCreate > 0` 的条件是否应该用 `> 0` 还是更宽松？
2. **`MetadataBadge.tsx:11-13` + `CatTokenUsage.tsx:20-23`** — `cachePercent` 公式改为 `cacheRead / input`，是否存在除零或 `cacheRead > input` 的边界情况？（归一化后理论上 `cacheRead <= input` 恒成立）
3. **前端测试断言值**（84% 和 75%）——这些数值是否和新公式一致？

## 五件套

**What**: 后端 `extractClaudeUsage` 归一化 `inputTokens` 为总输入（new + cache_read + cache_creation），前端 `cachePercent` 公式配套调整
**Why**: Claude CLI 和 Codex CLI 的 `input_tokens` 语义不同，导致布偶猫显示 `4↓` 而缅因猫显示 `25.3k↓`，用户无法比较
**Tradeoff**: 放弃了前端按 provider 分支计算（每个消费者都要判断 provider + 两套公式）和新增 `rawInputTokens` 字段（YAGNI）
**Open Questions**: `cache_creation` 是否应计入、Gemini 未来缓存语义、`mergeTokenUsage` 累加后的缓存比率语义
**Next Action**: 请 review `ClaudeAgentService.ts` 归一化逻辑 + 两个前端 `cachePercent` 公式 + 后端新测试

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已说明（bug fix，无独立 spec）
- [x] 测试通过（1191 tests, 0 failures）
- [x] Red→Green 验证已记录
- [x] 五件套完整
