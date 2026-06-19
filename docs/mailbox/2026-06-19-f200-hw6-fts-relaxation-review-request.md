# Review Request: F200 HW-6 FTS Progressive Relaxation

Review-Target-ID: f200-hw6
Branch: feat/f200-hw6-fts-relaxation

## What

Fix 75% empty search results caused by FTS5 AND-all query semantics. New `fts-query-builder.ts` module implements 3-level progressive relaxation:
1. **AND-all** (strictest, current behavior — works for ≤3 tokens)
2. **Strong-AND + weak-OR** (entity IDs / CJK / long words required, short words optional)
3. **OR-all** (loosest — BM25 naturally ranks multi-match higher)

Integrated into both `searchWithMeta` (doc search) and `searchPassages` (passage search) in `SqliteEvidenceStore.ts`. Caller tries each level in order; first to return results wins.

## Why

Production telemetry showed 75% of `search_evidence` calls returned empty results. Root cause: `SqliteEvidenceStore.ts:235-239` joined all query tokens with FTS5 implicit AND. For long multi-word queries (14+ tokens, mixed Chinese/English), no single document contains ALL tokens → 0 results.

This is the P0 item in F200 v1.2 recall crisis diagnosis (HW-6).

## Original Requirements
> "那你最好先更新 f200 feat md commit push 之后再来 就开 worktree 从 ① 干起 然后最好给1和2 都挂🧶 毛线球 哈哈哈最主要的是 等你干完1 我大概率会忘记有2 得你自己记得 都全部完成才行"
- 来源：CVO directive 2026-06-19, F200 v1.2 recall crisis triage session
- Spec: `docs/features/F200-memory-recall-eval.md` (HW-6 row, line 351)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**（HW-6 = item ①）

## Tradeoff

- **Not chosen**: Semantic fallback (embedding-based re-query) — would add latency + embedding dependency for what's fundamentally a lexical query construction bug
- **Not chosen**: Minimum-match threshold (`NEAR` operator) — FTS5 `NEAR` doesn't support flexible match counts; would need custom ranking function
- **Chosen**: Progressive relaxation with strong/weak token classification — zero new dependencies, preserves BM25 ranking, ≤3 token queries unchanged (no regression)

## Architecture Ownership
Architecture cell: memory (evidence store)
Map delta: none
Why: Extracting a helper module (`fts-query-builder.ts`) within the existing evidence store domain; no new Store/Queue/Router/Adapter

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `isStrongToken` heuristic — current thresholds: entity regex (`F042`, `ADR-005`, `LL-048`, `KD-7`, `HW-6`), CJK chars, ≥4 chars. Are these discriminating enough, or should the threshold be tunable?
2. `escapeToken` wraps each token in FTS5 double-quotes. Confirm this is sufficient for all Unicode inputs (CJK, emoji, special chars).

### 价值 OQ（给 CVO，如有）
无 — 技术选择，回滚成本 ≤1 commit

## Next Action

请 review 代码正确性 + FTS5 query semantics + 测试覆盖充分性。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f200-hw6/gpt52`
- Start Command: `pnpm review:start`
- Note: 纯后端 memory store 改动，无需启动 web/api — reviewer 可直接在沙盒跑 `pnpm --filter @cat-cafe/api run build && node --test test/memory/fts-progressive-relaxation.test.js`

## 自检证据

### Spec 合规
Quality Gate PASS (2026-06-19):
- 愿景覆盖: HW-6 spec 逐项对照 ✅
- AC 全覆盖: AND-all→relaxation ✅, BM25 排序保留 ✅, 无回归 ✅
- Architecture ownership: memory cell, map delta none ✅
- Dogfood: 11-token query → 2 results (F200 #1); 2-token query → 1 result (unchanged) ✅
- Artifact hygiene: CLEAN ✅

### 测试结果
- FTS progressive relaxation tests: 11/11 pass ✅
- Evidence store full suite: 36/36 pass ✅
- Full memory test suite: 1477/1477 pass ✅
- `pnpm --filter @cat-cafe/api run build` → exit 0 ✅
- `pnpm lint` (tsc --noEmit) → exit 0 ✅
- `pnpm biome check` → 0 errors ✅

### 相关文档
- Feature: `docs/features/F200-memory-recall-eval.md` (HW-6 row)
- Diagnosis: `docs/features/F200-memory-recall-eval.md` §v1.2 recall crisis

### Files Changed (3)
| File | Change | Lines |
|------|--------|-------|
| `packages/api/src/domains/memory/fts-query-builder.ts` | NEW | +88 |
| `packages/api/src/domains/memory/SqliteEvidenceStore.ts` | MODIFIED | +174/-88 |
| `packages/api/test/memory/fts-progressive-relaxation.test.js` | NEW | +181 |

Commit: `45a019f00` — "feat(F200): HW-6 FTS progressive relaxation — fix 75% empty search results"

[宪宪/Opus-46🐾]
