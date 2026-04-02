---
doc_kind: mailbox
created: 2026-04-02
---

# Review Request: F102 Batch 3 — /memory 体验层收口

Review-Target-ID: f102-batch3
Branch: feat/f102-batch3-memory-ux

## What

Memory Hub 的两个体验层缺口补齐：

1. **project/global 维度切换器**（后端 + 前端）
   - `SearchOptions.dimension` 路由 KnowledgeResolver 到 project-only / global-only / all
   - `EvidenceResult.source` 标注来源维度
   - EvidenceSearch 新增"维度"下拉选择器 + 来源 badge
2. **Recall Feed snippet / source link / drill-down**
   - `parseTextResults` 扩展：提取 `anchor:` + `> snippet` 行
   - RecallCard 显示 snippet 预览（line-clamp-2）
   - 展开后显示"在搜索页查看详情 →"drill-down 链接

## Why

Batch 3 是 F102 收尾三批次的最后一批。Batch 1（IMaterializationService）和 Batch 2（Phase G 运行时验收）已合入。这批补齐铲屎官的体验入口：让铲屎官在 Memory Hub 里能选维度搜索，在 Recall Feed 里能看到 snippet 预览并跳转详情。

## Original Requirements（必填）

> 铲屎官原话："面向终态设计，不要搞中间态脚手架。猫猫出征其他项目时，全局记忆跟猫走。"
> 三方收敛原则："先补真相源闭环，再验运行时，再打磨人类入口。"
> Batch 3 验收标准："必须铲屎官亲手体验，才能说收口。"
- 来源：`docs/features/F102-memory-adapter-refactor.md` 收尾三批次 section
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Per-result source tagging**: 当 dimension=all（RRF fusion 模式）时，无法精确标记每个结果来自哪个 store（fusion 混合了排名）。选择只在单源模式（dimension=project 或 global）时标记 source badge。
- **Recall Feed drill-down**: 选择跳转到 `/memory/search?q=query` 而非 inline 展开详情，因为 Search 页已有完整的 mode/scope/depth 控制。

## Open Questions

1. **维度选择器默认值**：当前默认"全部"（federation），是否合理？铲屎官日常使用更多是项目维度？
2. **Recall Feed snippet 截断**：当前用 CSS `line-clamp-2`，是否足够？

## Next Action

请 review 以下 5 个文件的改动（P1/P2 only），特别关注：
- KnowledgeResolver dimension 路由逻辑是否正确（project-only / global-only / all）
- evidence.ts searchSchema 是否正确传递 dimension 到 searchOpts
- useRecallEvents parser 的 lookahead 逻辑是否健壮

## 自检证据

### Spec 合规

| # | AC | Status |
|---|-----|--------|
| B3a-1 | Backend dimension routing | ✅ 5 tests |
| B3a-2 | Backend source field | ✅ |
| B3a-3 | Frontend dimension selector | ✅ 3 tests |
| B3a-4 | Source badge on results | ✅ |
| B3b-1 | Parser extracts anchor+snippet | ✅ 3 tests |
| B3b-2 | Snippet display in RecallFeed | ✅ |
| B3b-3 | Drill-down link | ✅ |

### 测试结果

```
pnpm --filter @cat-cafe/api test (memory) → 227/227 pass, 0 failed ✅
pnpm --filter @cat-cafe/web test          → 1888/1888 pass, 0 failed ✅
pnpm check                                → 0 errors ✅
pnpm gate                                 → PASSED (SHA: 4ca87f25) ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-02-f102-batch3-memory-ux-polish.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Batch 1: PR #911 (merged) | Batch 2: PR #912 (merged)
