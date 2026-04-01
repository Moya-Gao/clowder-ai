---
date: 2026-04-01
author: opus
reviewer: codex
status: pending
---

# Review Request: F148 Gap-1 Token Trigger + Gap-2 Precise Tombstone Hints

Review-Target-ID: f148-gap-fix
Branch: feat/f148-gap-fix

## What

Two targeted fixes from GPT-5.4's 愿景守护 review of F148 Phase A/B:

1. **Gap-1 (Token Trigger)**: Smart window trigger now uses `OR estimatedTokens > coldMentionTokenThreshold` alongside the existing `relevant.length > coldMentionThreshold`. Catches "few but fat" messages (e.g., 8 msgs × 10K chars) that previously bypassed smart windowing.

2. **Gap-2 (Precise Hints)**: `buildTombstone()` accepts optional `threadId` and generates targeted retrieval hints like `search_evidence("keyword", threadId="thread_abc")` instead of generic `search_evidence("keyword")`.

## Why

愿景守护 scored Phase A/B at 70/100, identifying these as the two highest-priority gaps:
- Gap-1: A thread with few but extremely long messages (e.g., pasted logs) would take the warm path, sending all content verbatim — defeating the purpose of smart windowing.
- Gap-2: Generic hints force the cat to do broad searches when threadId-scoped recall would be far more precise.

## Original Requirements
> 铲屎官: "我倾向先补 Gap 1（token 触发）+ Gap 2（精确 hints），走起 gap 3我们最好记录一下因为后面肯定要做的"
- 来源：当前会话（2026-04-01 06:32）
- GPT-5.4 愿景守护结论：A/B 70分, 3 gaps (token trigger, precise hints, Landy surface)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `coldMentionTokenThreshold` 默认 10,000 tokens。用真实 tokenizer (`estimateTokens`) 而非 chars/4 估算，精度更高但每次 cold-mention 检测多一次 reduce + encode。对于 <15 条消息场景，开销可忽略。
- Gap-3 (Landy-facing surface) 未在此 PR 实现，已记录到 project memory 留后续 Phase。

## Open Questions

1. `coldMentionTokenThreshold = 10,000` 是否合理？8 条 × 1,750 tokens ≈ 14K 能触发。Normal conversation (15 msgs × 100 tokens = 1,500) 不会误触。
2. Gap-1 token estimation 在 route-helpers 里用 `relevant.reduce((sum, m) => sum + estimateTokens(m.content), 0)` — 对 <15 条消息是 O(n) tokenize，是否需要缓存？

## Next Action

请 review 代码正确性 + 阈值合理性。5 files changed, +73 -3。

## 自检证据

### Spec 合规
- Gap-1: config 新增 `coldMentionTokenThreshold`，trigger 增加 OR 条件 ✅
- Gap-2: `buildTombstone` 新增 `threadId?` 参数，hints 含 threadId ✅
- Gap-3: 记录到 project memory ✅
- 无 UI 改动，无 .pen 设计稿

### 测试结果
- F148 tests: 50/50 pass ✅
- pnpm lint: 0 errors ✅
- pnpm check: 0 errors ✅
- pnpm -r --if-present run build: exit 0 ✅

### 相关文档
- Feature: F148 Hierarchical Context Transport
- Spec: `docs/features/F148-hierarchical-context-transport.md`
- Gap origin: GPT-5.4 愿景守护 review (2026-04-01)
