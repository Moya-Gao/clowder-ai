---
feature_ids: [F102]
type: review-request
author: opus
reviewer: codex
created: 2026-03-13
---

# Review Request: F102 Phase C — Vector Enhancement (Semantic Rerank)

## What

在 Phase B FTS5 lexical search 基础上，增加 embedding 向量增强层：
- `EmbedConfig` 三态开关 (`off|shadow|on`)，默认 `off`
- `EmbeddingService` — Transformers.js ONNX 加载 + MRL 截断 + L2 re-norm
- `VectorStore` — sqlite-vec `vec0` 虚拟表 CRUD + `embedding_meta` 版本锚
- `SemanticReranker` — 纯函数 distance-sorted merge
- `SqliteEvidenceStore.search()` rerank 集成 — mode switch + fail-open
- `IndexBuilder` rebuild/incrementalUpdate 自动生成 embedding + 版本变更全量重建
- `factory.ts` 生命周期编排

11 commits, 39 files changed, +3034/-55 lines (纯后端 `packages/api`)。

## Why

Phase B lexical FTS 对语义查询（中文/英文同义词）无能为力。Eval corpus 证明：lexical Recall@5 = 86.7% (13/15)，S-01 ("记忆组件怎么存储") 和 S-02 ("how does the cat communication work") 是预期 miss。Phase C embedding rerank 是 spec 预期路径。

## Original Requirements（必填）

> 铲屎官原话："纯 lexical 不够，Phase C 向量增强是预期路径"
> "面向终态设计，不要搞中间态脚手架"
> "我们希望把我们自己的经验沉淀，自己写一个符合我们实践的记忆组件"

- 来源：`docs/features/F102-memory-adapter-refactor.md` L48, L22, L21
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 选择 | 原因 |
|------|------|------|
| 独立向量库 (Qdrant/Chroma) | ❌ | 违反"面向终态 + 单 SQLite"设计，运维成本高 |
| 立即替换 FTS | ❌ | AC-C8 明确"rerank on FTS candidates, not replace" |
| 默认 `on` | ❌ | 模型 614MB，CI/本地首次体验要可控；默认 `off` + 渐进启用 |
| evidence_passages 分片 | defer | AC-C9 "1000+ docs 时再做"，当前规模不需要 |

## Open Questions

1. **P1 关注**：`IndexBuilder.embedIndexedItems()` 全量重建时一次 batch embed 所有 docs — 如果 docs 量大（>500），单次 `embed()` 调用可能超时。当前 `embedTimeoutMs` 只保护单次调用，未做分批。
2. **P2 关注**：`SemanticReranker.rerankWithDistances()` 是 O(n*m) 双循环匹配（candidates × vecResults）。当前规模 OK，但 1000+ 候选时需优化为 Map lookup。
3. **设计确认**：`EmbedDeps` 作为可选依赖注入到 Store 和 Builder，是否符合你对 Phase D 扩展的预期？

## Next Action

请做 P0/P1 审查。重点关注：
- fail-open 路径完整性（factory → store → builder 三层）
- 版本锚 + 全量重建逻辑的正确性
- 三态开关语义（特别是 shadow mode 行为）

## 自检证据

### Spec 合规

AC-C1~C9 全部满足（C9 按 spec 标注 deferred）。详见上方 Quality Gate Report。

### 测试结果

```
pnpm --filter @cat-cafe/api run build   → exit 0 ✅
pnpm check                               → 0 errors ✅ (biome format + lint)
node --test packages/api/test/memory/*.test.js → 139/139 pass, 0 fail ✅
```

Phase C 新增 30 tests：
- embed-config: 4 | embedding-service: 6 | vector-store: 7
- store-rerank-integration: 5 | index-builder (new): 5 | embed-eval: 3

### 风险与已知非阻塞项

| 项目 | 说明 | 阻塞？ |
|------|------|--------|
| `packages/web` 2 个 lint errors | unused vars — 非本次引入 | ❌ |
| Eval Recall S-01/S-02 miss | lexical 预期 miss，embedding 要解决的 | ❌ |
| AC-C9 deferred | spec 明确标注 | ❌ |

### 相关文档

- Spec: `docs/features/F102-memory-adapter-refactor.md`
- Plan: `docs/plans/2026-03-12-f102-phase-c-vector-enhancement.md`
- Feature: F102 / BACKLOG

### 分支信息

- Branch: `feat/f102-phase-c`
- Worktree: `cat-cafe-f102-phase-c`
- Commits: 11 (from `8408c6bd` to `e20c2c8f`)
- Diff: `git diff --stat origin/main..feat/f102-phase-c`
