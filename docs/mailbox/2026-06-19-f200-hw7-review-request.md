---
feature_ids: [F200]
topics: [hw7, telemetry, shadow, eval, review, request]
doc_kind: mailbox
created: 2026-06-19
---

# Review Request: F200 HW-7 Telemetry 三態校准 + Shadow Baseline + Eval Adapter

Review-Target-ID: f200-hw7
Branch: feat/f200-hw7-telemetry-eval-correctness

## What

Three correctness fixes in the memory recall eval pipeline:

1. **Telemetry 三態校准** (`f188-library-health.ts`): `result_count=NULL` no longer conflated with zero-hit. Changed `p.resultCount ?? 0` → `p.resultCount` + null guard.
2. **Shadow baseline fix** (`SqliteEvidenceStore.ts`): In `on` mode, shadow stored post-rerank order (shadow≡live). Fix: snapshot pre-rerank BM25 order.
3. **Eval adapter** (`eval-memory-adapter.ts`): `search_zero_hit_rate` added to `recallMetricRefs()` + `libraryHealthValues()`.

## Why

Three bugs making eval pipeline unreliable:
- Part 1: inflated zero-hit count (~60% inflation from NULL conflation)
- Part 2: shadow vs live always ≈1.0 (useless for A/B comparison)
- Part 3: zero-hit rate (primary recall signal) missing from eval metric refs

## Original Requirements

> "那你最好先更新 f200 feat md commit push 之后再来 就开 worktree 从 ① 干起 然后最好给1和2 都挂🧶 毛线球"
- 来源: F200 HW-7 spec in `docs/features/F200-memory-recall-eval.md`
- **请对照 HW-7 三項 AC 判断交付物是否解决了 eval correctness 问题**

## Tradeoff

Tested via `computeLibraryHealth` full integration rather than `computeSearchQuality` directly — catches wiring bugs (the missing `opts` argument was only visible at integration level).

## Architecture Ownership

Architecture cell: memory-recall-eval
Map delta: none
Why: Only fixes computation logic in existing eval pipeline, no new stores/adapters/boundaries

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding

## Open Questions

### 技术 OQ（给 reviewer）

1. Part 2 `preRerankOrder` snapshot — confirm it captures the correct BM25 order before any reranking happens
2. Part 1 null guard — `rc != null && rc <= 2` vs original `rc <= 2` — verify no edge case with `rc === undefined`
3. Part 3 `search_zero_hit_rate` division — check for `totalSearches === 0` edge case

### 价值 OQ（给 CVO）
无 — 纯 eval pipeline correctness

## Next Action

请 review 三个 fix 的正确性，特别关注 shadow snapshot 时机和 NULL 三態语义。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f200-hw7/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 无前端改动，纯 API 测试即可

## 自检证据

### Spec 合规

- HW-7 Part 1 (三態校准): ✅ NULL/undefined excluded from zero-hit count
- HW-7 Part 2 (shadow baseline): ✅ pre-rerank BM25 order stored as shadow
- HW-7 Part 3 (adapter): ✅ `search_zero_hit_rate` in recallMetricRefs + libraryHealthValues

### 测试结果

```
f200-hw7-telemetry-eval-correctness.test.js: 3/3 pass ✅
f200-consumption-rerank.test.js: 11/11 pass ✅ (incl HW-7 shadow test)
Full memory suite: 1480/1482 pass (2 pre-existing unrelated failures)
pnpm check: 0 errors ✅
pnpm lint: 0 errors ✅
pnpm -r --if-present run build: exit 0 ✅
```

### Dogfood-Your-Slice
Scope verdict: 🆗 exempt — pure internal eval pipeline bugfix, not user/cat visible path

### 相关文档
- Feature: F200 Memory Recall Eval
- PR: #2427
