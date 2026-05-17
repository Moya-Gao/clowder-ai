# Review Request: F200 v1.1 Batch 2+3 — Dogfooding Fixes (DF-6/2/8/3/4/7/10)

Review-Target-ID: f200-v11-batch2
Branch: feat/f200-v11-batch2

## What

7 bug fixes from the F200 v1.1 dogfooding backlog (三猫 3-round eval):

| # | Fix | File |
|---|-----|------|
| DF-6 | `list_recent` returns nudge on empty scope/kinds intersection | RecentBrowseResolver.ts |
| DF-2 | `graph_resolve` hub-node degree cap (15 edges/node, 50 total nodes) | GraphResolver.ts |
| DF-8 | Hybrid RRF asymmetric NN boost (1.5x) for CJK queries | SqliteEvidenceStore.ts |
| DF-3 | Search explainability — `matchReason` always, `rankingFactors` with explain | SqliteEvidenceStore.ts |
| DF-4 | `list_recent(scope='trajectories')` with verified/filesRead/filesModified | RecentBrowseResolver.ts |
| DF-7 | Confidence normalization (trivial — already in [0,1]) | interfaces.ts |
| DF-10 | Cross-domain false positive penalty in graph candidate ranking | GraphQueryResolver.ts |

## Why

Three-cat eval (46+47+砚砚) identified these as P2/P3 blockers for consumption-weighted ranking usability. Without these fixes, new cats hitting the memory system get confusing empty results (DF-6), graph explosions (DF-2), or irrelevant cross-language results (DF-8).

## Original Requirements
> "Batch 2：DF-6/2/8/3/4，P2 可解释性 + 跨语言 Batch 3：DF-7/10，P3 hub-node 爆炸 + 跨域假阳性 → 那你开始？"
- 来源：铲屎官 thread 指令 (2026-05-16)
- Spec: `docs/features/F200-memory-recall-eval.md` lines 297-312
- **请对照 spec 的 Batch 2+3 表格逐项判断：每个 DF 的根因是否被正确修复**

## Tradeoff

- DF-8: 使用固定 CJK_NN_WEIGHT=1.5 而非动态调整。简单有效，trade off 是对非 CJK 混合查询不产生额外优化。可后续扩展。
- DF-2: 硬编码 MAX_EDGES_PER_NODE=15, MAX_TOTAL_NODES=50。可能对某些合法深度查询截断。返回 `truncated: true` flag 让调用方知情。
- DF-6: `list()` return type 从 `RecentItem[]` 改为 `{ items, nudge? }`。Breaking change 但只有 library.ts route 调用。

## Architecture Ownership
Architecture cell: memory-recall
Map delta: none
Why: All fixes extend existing resolvers (RecentBrowse/Graph/SqliteEvidence) within the memory-recall cell boundary. No new Store/Queue/Router/Adapter.

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. DF-8 CJK_NN_WEIGHT=1.5 是否合理？范围 (1.0, 2.0] 内取 1.5 作为 sweet spot——过高会让 NN-only 结果压制合法 BM25 双源命中。
2. DF-2 degree cap 常量 (15/50) 是否足够覆盖正常用例？production 里最大合法子图约 30 nodes。
3. DF-6 return type breaking change: 确认只有 `library.ts:429` 一处 caller 需要 adapt。

### 价值 OQ（给 CVO）
无

## Next Action

请 review 代码正确性 + test 覆盖度。特别关注 DF-8 (RRF权重) 和 DF-2 (截断逻辑) 的边界行为。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f200-v11-batch2/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
Quality gate PASSED (2026-05-16 23:50). 全部 7 项 DF 对照 spec 逐条覆盖。

### 测试结果
```
node --test test/memory/f200-v11-batch2.test.js test/recent-browse-resolver.test.js
→ 21/21 pass, 0 fail ✅
pnpm check → 0 errors ✅ (biome + followup-tails)
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F200-memory-recall-eval.md`
- Batch 1 (merged): PR #1714

### 如果判断错了我最可能错在哪
1. DF-8: CJK 检测的正则可能漏掉某些 Unicode 边界（韩文 Hangul 加了但没 test）
2. DF-2: `truncated` flag 只在 depth≥1 时可能 true，depth=0 的 edge case 未覆盖（depth=0 不太可能被实际调用）
3. DF-6: `listTrajectories()` 的 try/catch 吞了 SQL 错误，不只是 "table not exist"——如果 query 本身有 bug 也会被静默
