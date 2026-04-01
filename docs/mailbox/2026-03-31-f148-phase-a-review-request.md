---
type: review-request
from: opus
to: codex
feature: F148
date: 2026-03-31
---

# Review Request: F148 Phase A — Smart Window + Tombstone + Evidence Recall

## Review Target
- **Review-Target-ID**: f148
- **Branch**: `feat/f148-context-transport`
- **Commits**: 9 (from `49603ae47` to `8f26004a9`)

## What

将 `assembleIncrementalContext()` 从 flat N=200 投喂改为分层 context packet：

1. **Burst detection** — 从尾部反向查找 silence gap (≥15min)，提取最近交互 burst (4-12 条)，保护语义链 (Q→A, tool_use→tool_result)
2. **Coverage tombstone** — 被跳过的消息生成 ~40 tokens 的结构化摘要（count, time range, participants, keywords, retrieval hints），零 LLM 成本
3. **Evidence recall** — composite query (threadTitle + userMessage + recentMsgs) 跑 evidence.sqlite BM25 hybrid search，500ms timeout，fail-open
4. **Tool payload scrub** — 非最后一跳的 tool_result 压缩为 digest line
5. **Cold/warm split** — `messages.length > 15` 走 smart window，≤15 保持原有行为不变

## Why

冷启动 @-mention 场景下 flat delivery 消耗 160K-216K tokens，信噪比极低。Phase A 目标：降到 25K-40K tokens（-80%+），不依赖 threadMemory 覆盖率。

## Original Requirements（必填）

> "我觉得感觉最重要的，增量上下文的传输"
> "最便宜的 haiku 把它带到沟里面去了"（关于 cheap-model summarization 的失败实验）

- 来源：铲屎官 2026-03-31 设计讨论（F148 spec `docs/features/F148-hierarchical-context-transport.md`）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **不用 cheap-model summarization**（KD-1）：Haiku 实验证明 cheap 摘要误导 Opus。改用零 LLM 成本的 word frequency + structural signals
- **Phase A 容忍 L1 缺失**（KD-2）：96% thread 没有非空 threadMemory，tombstone + evidence 兜底
- **composite query 而非纯 @-mention text**（KD-3）："@opus 帮看下" 对 BM25 几乎没信号

## Open Questions

1. **burst 切分精度**：silence gap 15min 是否太激进？需要真实 thread 数据验证
2. **keyword 提取质量**：纯 word frequency + stopwords 是否足够？Phase C 会加 importance scoring
3. **cold/warm 阈值**：15 条是否最优？可配置但需数据

## Next Action

请 review：
- [ ] 纯函数逻辑正确性（`context-transport.ts`，325 行）
- [ ] 集成路径（`route-helpers.ts` 的 cold/warm split + `assembleSmartWindowContext`）
- [ ] 配置设计（`hierarchical-context-config.ts`）
- [ ] 现有行为不变（warm path 测试 + 原有 budget 测试兼容）
- [ ] 边界/异常处理（empty array, timeout, store error, token budget）

Reviewer 沙盒路径：`/tmp/cat-cafe-review/f148/codex`

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|-----|------|----------|----------|
| AC-A1 | context tokens 降低 ≥70% | ✅ | route-helpers.ts `assembleSmartWindowContext` | f148-assemble-incremental.test.js "cold mention produces far fewer tokens" |
| AC-A2 | semantic chain 不切断 | ✅ | context-transport.ts `protectSemanticChains` | f148-context-transport.test.js "does not split tool_use→tool_result" + "does not split user question→cat answer" |
| AC-A3 | tombstone 包含必要字段 | ✅ | context-transport.ts `buildTombstone` + `formatTombstone` | f148-context-transport.test.js "returns correct count, time range, participants" + f148-assemble-incremental.test.js "tombstone contains all required fields" |
| AC-A4 | evidence recall fail-open | ✅ | context-transport.ts `recallEvidence` | f148-context-transport.test.js "returns empty array on timeout" + "returns empty array on store error" + f148-assemble-incremental.test.js "evidence recall fail-open" |
| AC-A5 | tool payload scrub 非最后一跳 | ✅ | context-transport.ts `scrubToolPayloads` | f148-context-transport.test.js "scrubs earlier messages" + f148-assemble-incremental.test.js "tool payload scrub" |
| AC-A6 | warm path 行为不变 | ✅ | route-helpers.ts cold/warm split | f148-assemble-incremental.test.js "warm path produces unchanged output format" |

### 测试结果

```
pnpm --filter @cat-cafe/api test    → 132 passed, 0 failed ✅
pnpm lint                           → 0 errors ✅
pnpm check                          → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build      → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F148-hierarchical-context-transport.md`
- Plan: `docs/plans/2026-03-31-f148-phase-a-smart-window.md`
- Research: `docs/research/2026-03-31-hierarchical-context-transport-gpt-pro-consult.md`

### 改动文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/api/src/config/hierarchical-context-config.ts` | 新增 | 配置接口 + 默认值 |
| `packages/api/src/domains/cats/services/agents/routing/context-transport.ts` | 新增 | 5 个纯函数（burst, tombstone, format, scrub, recall） |
| `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` | 修改 | cold/warm split + assembleSmartWindowContext |
| `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` | 修改 | evidenceStore 注入 |
| `packages/api/src/index.ts` | 修改 | evidenceStore 传入 AgentRouter |
| `packages/api/test/f148-context-transport.test.js` | 新增 | 21 unit tests |
| `packages/api/test/f148-assemble-incremental.test.js` | 新增 | 7 integration tests |
| `packages/api/test/incremental-context-budget.test.js` | 修改 | 适配 cold path 行为 |
| `packages/api/test/incremental-context-token-budget.test.js` | 修改 | 适配 cold path 行为 |
| `docs/features/F148-hierarchical-context-transport.md` | 修改 | status → in-progress |
