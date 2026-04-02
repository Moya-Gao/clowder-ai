---
doc_kind: review-request
feature_ids: [F148]
created: 2026-04-02
---

# Review Request: F148 Phase C — Importance Scoring + Anchors

Review-Target-ID: f148-phase-c
Branch: feat/f148-phase-c

## What

Phase C adds importance scoring and anchor extraction to the hierarchical context transport smart window. Three pure functions + integration into the existing `assembleSmartWindowContext` pipeline:

1. `scoreImportance()` — zero-cost scoring using structural signals (code blocks +3, @-mentions +2, tool events +2, long content +1), positional signals (primacy +5), and relevance signals (query term match +1 each)
2. `selectAnchors()` — top-N selection from omitted messages, guarantees primacy anchor (thread opener) always included, returns chronological order
3. `formatAnchors()` — labeled context lines with content truncation
4. Integration: tombstone → **anchors** → evidence → burst ordering; token trim degrades anchors before tombstone

### Changed files
- `packages/api/src/domains/cats/services/agents/routing/context-transport.ts` — 3 new exports + interfaces
- `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` — step 3.5, token trim update, assembly update
- `packages/api/src/config/hierarchical-context-config.ts` — `maxAnchors: 3`
- `packages/api/test/f148-context-transport.test.js` — 13 unit tests
- `packages/api/test/f148-assemble-incremental.test.js` — 1 integration test

## Why

GPT-5.4 愿景守护 scored Phase A+B at 70/100, identifying that the tombstone alone loses too much signal from omitted messages. Phase C addresses this by surfacing high-value messages (code blocks, @-mentions, thread openers) as anchors between the tombstone and hot tail, improving context quality without LLM cost.

## Original Requirements（必填）
> "我觉得感觉最重要的，增量上下文的传输"
> "最便宜的 haiku 把它带到沟里面去了"
- 来源：`docs/features/F148-hierarchical-context-transport.md` (铲屎官 2026-03-31 原话)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Chose zero-cost heuristic scoring over LLM-based summarization — matches Phase A philosophy of "no LLM cost in context assembly"
- Primacy anchor is always included even if it scores low — thread opener provides essential framing context
- Token trim drops anchors before tombstone — tombstone gives structural overview, anchors are supplementary detail

## Open Questions

1. **Scoring weights**: structural signals (+3/+2/+1) and primacy (+5) chosen by heuristic. Are these reasonable? Should reactions be a signal too (spec mentions it but we don't have reaction data in StoredMessage)?
2. **maxAnchors = 3**: Good default? Could make it dynamic based on budget.
3. **Cognitive complexity**: `assembleSmartWindowContext` is at 32 (limit 15) — pre-existing from Phase A. Worth refactoring now or defer?

## Next Action

请 review Phase C 实现，重点关注:
- scoring 信号权重是否合理
- primacy guarantee 的 edge cases
- token trim 降级顺序
- integration test 覆盖度

## 自检证据

### Spec 合规
| AC | Status | Verified |
|---|---|---|
| AC-C1: zero-cost importance scoring | ✅ | 6 unit tests, no LLM calls |
| AC-C2: top 2-3 anchors injected | ✅ | 5 unit + 1 integration test |
| AC-C3: primacy anchor always included | ✅ | dedicated unit test + integration test |

### 测试结果
```
node --test packages/api/test/f148-*.test.js → 65 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
npx tsc --noEmit → clean ✅
```

### 相关文档
- Plan: `docs/plans/2026-04-01-f148-phase-c-importance-scoring.md`
- Feature: `docs/features/F148-hierarchical-context-transport.md`
