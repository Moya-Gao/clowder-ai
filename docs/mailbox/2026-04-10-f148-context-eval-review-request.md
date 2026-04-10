---
doc_kind: mailbox
created: 2026-04-10
---

# Review Request: F148 OQ-2 Context Quality Eval Signals

Review-Target-ID: f148-context-eval
Branch: feat/f148-context-eval

## What

在 briefing→invocation link 日志点增加自动化上下文质量信号，包括：
- `selfServeRetrievalCount`（search_evidence + get_thread_context 调用次数）
- `toolCallCount`（总工具调用次数）
- `responseTokenEstimate`（响应 token 估算）
- CoverageMap 摘要（burst/omitted/anchor/threadMemory/retrievalHint counts）

纯函数 `extractContextEvalSignals` 封装提取逻辑，route-serial 和 route-parallel 各集成一处。

## Why

砚砚提出三步路线（#1 F5 持久化 → #2 猫猫自评 → #3 阈值调优），这是 #2 的 Layer 1。用客观工具使用信号评估 smart window context 质量——如果猫在收到 briefing 后仍频繁调用 `search_evidence`，说明上下文不够。零 prompt 改动，零额外 LLM 成本，立刻有数据可分析。

## Original Requirements（必填）
> 铲屎官：「这些东西要如何让触发了你们获取摘要的当事猫打分评价呢？」
> 砚砚：「#2（猫猫自评分）可以直接开工。定义评分 payload：contextSufficiency、missingInfo、tombstoneHelpful。在 invocation 完成时落一条结构化 telemetry。」
- 来源：thread_mnemh4wwar0xdsc3（2026-04-09 对话）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

Layer 2（猫主动调用评分工具）需要 HTTP callback endpoint + system prompt 注入 + 条件工具注册，复杂度大增。本 PR 选择先落 Layer 1（自动化客观信号），Layer 2 视数据反馈再决定是否需要。

## Open Questions

1. `selfServeRetrievalCount` 的工具名匹配用 substring（`search_evidence`、`get_thread_context`），是否够全？
2. route-parallel 里新增了 `catCoverageMap` 和 `catToolNames` 两个 Map，生命周期是否合理？
3. Layer 2（猫主动打分）是否值得做成单独 PR？

## Next Action

请 review 代码质量、集成正确性、telemetry 字段设计。

## 自检证据

### Spec 合规
- ✅ Pure function with typed input/output
- ✅ route-serial + route-parallel 两处集成
- ✅ 零 prompt 改动
- ✅ 6 unit tests covering all branches

### 测试结果
```
node --test test/f148-*.test.js   # 118 passed, 0 failed
pnpm lint                         # 0 errors
pnpm biome check                  # 0 errors
pnpm -r build                     # exit 0
```

### 相关文档
- Feature: `docs/features/F148-hierarchical-context-transport.md`
- Context: PR #1028 (briefing→invocation link, merged)
