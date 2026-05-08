# Review Request: F188 Phase C — Graph Fidelity

Review-Target-ID: f188-graph-fidelity
Branch: feat/f188-graph-fidelity

## What

Fix 3 graph runtime bugs + add 3 new edge extraction sources + redesign graph UI:

1. **Schema V18 verification** (AC-C0a): 3 tests confirm edges table migration adds 5 columns correctly
2. **Silent skip fix** (AC-C0b): `GraphResolver.buildSubgraph` now shows unresolved anchors as placeholder nodes instead of silently dropping them
3. **Edge extraction** (AC-C1~C3): New `edge-extractors.ts` with 3 pure functions — `extractWikiLinkEdges`, `extractDocLinkEdges`, `extractFeatureRefEdges`. Integrated into IndexBuilder rebuild. 16 unit tests + 1 integration test
4. **Orphan edges stats** (AC-C4): Existing `CollectionReadModel.computeHealth()` already counts orphan edges; added verification test
5. **Graph UI redesign** (AC-C5): Kind-based fill colors, quadratic bezier curves, drop shadow, legend, edge type filter checkboxes. Force layout extracted to `graph-layout.ts` with better params (repulsion 5000, spring 160, 120 iterations)

12 files changed, 588 insertions, 127 deletions.

## Why

铲屎官 2026-05-06 反馈 graph 显示"孤零零的节点"+"太丑了"。根因三重：schema 不一致导致无边返回、silent skip 丢节点、只有 frontmatter 一种 edge 来源。

## Original Requirements

> "graph 到底是如何 link 起文档的？只看 frontmatter？还是会看文档里面的 ref？"
> "太丑了"
> "美观也很重要"
> "全量重建索引！我们现在好像是启动的时候才会？"（Phase A 已解决）

- 来源：`docs/features/F188-library-stewardship.md` Why 节（铲屎官原话 2026-05-06）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 保留自研 SVG force layout，未引入 D3/react-force-graph — 依赖轻、控制力强、已足够
- Edge labels 移除（用 color-coded edges + filter legend 替代）— 减少视觉噪音
- `feature_ref` regex 用 negative lookbehind `(?<!\[\[)` 避免与 WikiLink 双重计数 — 简洁但不支持嵌套场景（极罕见）

## Architecture Ownership

Architecture cell: `memory`
Map delta: none
Why: 扩展现有 memory cell（GraphResolver + IndexBuilder + CollectionGraph），无新 store/queue/router

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

1. **edge-extractors.ts 放 memory domain 是否合适？** — 纯文本提取函数，与 memory 强关联但理论上可复用。当前放 memory/ 因为唯一调用者是 IndexBuilder
2. **Graph UI 无设计稿**：铲屎官原话是定性要求（"太丑了"），无 wireframe。请 reviewer 主观评估改进是否足够
3. **`d > 0` guard in GraphResolver**: 初始查询 anchor 不存在时返回空 graph（保持原行为），只有 edge-discovered anchors 才显示 unresolved 占位。这个区分是否合理？

## Next Action

请 review 代码质量 + 架构一致性 + 原始需求对照。前端 UI 改动需浏览器验证。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f188-graph-fidelity/codex`
- Start Command: `pnpm review:start`
- Ports: reviewer 按标准流程分配

## 自检证据

### Spec 合规

Quality Gate Report 2026-05-07 — 8 ACs 全部 met:
- AC-C0a ✅ schema-v18-edges-verify.test.js (3 tests)
- AC-C0b ✅ GraphResolver silent skip → unresolved node
- AC-C0c ✅ frontmatter edges verified via schema fix + integration test
- AC-C1 ✅ WikiLink extraction (6 tests)
- AC-C2 ✅ doc_link extraction (4 tests)
- AC-C3 ✅ feature_ref extraction (6 tests)
- AC-C4 ✅ orphan edges count verified
- AC-C5 ✅ CollectionGraph redesign (6 existing tests green)

### 测试结果

```
pnpm test (API)  → 10308 tests, 10305 pass, 0 fail, 3 skipped
pnpm test (Web)  → 2873 tests, 2873 pass, 0 fail
pnpm lint        → 0 errors
pnpm biome check → 0 errors (changed files)
pnpm build       → exit 0
```

### 相关文档

- Feature: `docs/features/F188-library-stewardship.md`
- Plan: `docs/plans/2026-05-07-f188-graph-fidelity-phase-c.md`
