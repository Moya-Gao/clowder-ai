---
feature_ids: [F102]
doc_kind: review-request
created: 2026-03-12
reviewer: codex
author: opus
---

# F102 Phase A Review Request — 记忆组件 Adapter 化重构

## What

新建 `packages/api/src/domains/memory/` 域，实现记忆组件的可插拔 Adapter 架构：

- **6 接口定义** (`interfaces.ts`): `IEvidenceStore`, `IIndexBuilder`, `IMarkerQueue`, `IMaterializationService`, `IReflectionService`, `IKnowledgeResolver` + 全部配套类型
- **SQLite 基座** (`SqliteEvidenceStore.ts` + `schema.ts`): `evidence_docs` + `evidence_fts` (FTS5 external-content) + `edges` + WAL 模式 + bm25 评分
- **IndexBuilder** (`IndexBuilder.ts`): 扫描 `docs/{features,decisions,plans}/*.md`，解析 YAML frontmatter，hash-based 增量 rebuild + FTS 一致性校验
- **MarkerQueue** (`MarkerQueue.ts`): YAML-backed marker candidate queue，真相源在 `docs/markers/*.yaml`（git-tracked）
- **HindsightAdapter** (`HindsightAdapter.ts`): 包装旧 `IHindsightClient` 为 `IEvidenceStore` 接口
- **ReflectionService + KnowledgeResolver + MaterializationService**: 独立服务实现
- **Factory + barrel** (`factory.ts` + `index.ts`): `createMemoryServices(config)` 按配置选 sqlite/hindsight

9 commits, 11 source files, 9 test files, **48 tests 全绿**。

## Why

Hindsight 已停用，`HindsightClient` 硬编码在路由中无法替换。需要可插拔接口 + 本地 SQLite 替代方案。

**约束**：面向终态设计（SQLite 是终态基座，Phase C 向量增强在同一个 sqlite 上加列/表），markers 工作流状态必须 git-tracked（rebuild 不能蒸发审核历史）。

## Original Requirements

> 铲屎官原话（thread `thread_mm4dj9jp0tij0ch3`）：
> "我们希望把我们自己的经验沉淀，自己写一个符合我们实践的记忆组件，就给自己用。"
> "面向终态设计，不要搞中间态脚手架。猫猫出征其他项目时，全局记忆跟猫走。"
> "把 Hindsight 给干掉…变成一个 adapter 的，可以接入任何东西的。"

来源：`docs/features/F102-memory-adapter-refactor.md`

**请对照判断**：本次交付是否解决了铲屎官的核心诉求？

## Tradeoff

| 选项 | 决策 | 理由 |
|------|------|------|
| FTS5 `tokenchars "_-"` | 降级为基础 `unicode61` + exact-anchor 旁路 | 当前 SQLite 版本不支持 tokenchars 语法。已补 exact-anchor bypass：`search()` 对 anchor-shaped 查询（如 `F042`、`ADR-005`）做直接 `WHERE anchor = ?` 查找，不依赖 FTS5 tokenizer。Phase C 向量增强解决的是语义检索，不是 tokenizer 精度 |
| 路由解耦（AC-A4） | **未闭合** — Factory 就绪，路由未迁移 | `evidence.ts` 有 164 行 Hindsight-specific 逻辑（freshness guard、reimport），需单独 PR 处理 |
| KnowledgeResolver 联邦检索（AC-A9） | **未闭合** — Phase A project-only 骨架 | Plan 明确标注全局 SQLite + RRF 是 Phase B |

## Open Questions（Review 重点）

1. **MarkerQueue YAML parser 手写** — 没用 `js-yaml` 等库，手写了简单的 YAML 解析器。够用但有没有 edge case 没覆盖到？
2. **FTS5 external-content triggers** — INSERT/DELETE/UPDATE 三个 trigger 保证 FTS 同步，consistency check 在 IndexBuilder。这个方案够健壮吗？
3. **superseded_by 降权策略** — 用 `ORDER BY (d.superseded_by IS NOT NULL), rank` 把过期条目排最后。是否需要完全过滤？

## Next Action

请 review 代码质量 + 接口设计 + 测试覆盖度。

```bash
# 查看改动
cd /Users/lysander/projects/relay-station/cat-cafe-f102-memory-adapter
git log --oneline feat/f102-memory-adapter --not main
node --test packages/api/test/memory/*.test.js
```

## Self-Check Evidence

- **Quality Gate**: Phase A 主体完成，AC-A4（路由解耦）和 AC-A9（联邦检索）为明确未闭合项，需 follow-up PR
- **Tests**: 49/49 pass, 0 fail（含新增 exact-anchor bypass test）
- **TypeScript**: 0 errors（`pnpm lint`）
- **Build**: exit 0（`pnpm --filter @cat-cafe/api build`）
- **Biome**: 0 errors, 13 warnings（memory domain files）
- **前端**: 无 UI 改动，无需截图
- **设计稿**: 无 .pen 文件匹配
