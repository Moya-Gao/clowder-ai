# Review Request: F186 Phase A — Collection Manifest + LibraryResolver 契约

Review-Target-ID: f186
Branch: feat/f186-library-memory

## What

F186 Phase A: 图书馆记忆架构的 Collection 抽象 + N-collection 联邦检索。

核心变更（11 commits, 31 files, +1505 lines）：

1. **Collection types** — `CollectionManifest`, `CollectionKind`, `CollectionSensitivity`, `ReviewStatus`, `SearchDimension` in `collection-types.ts`; `CollectionGroup` + extended `SearchOptions`/`KnowledgeResult` in `interfaces.ts`
2. **LibraryCatalog** — In-memory collection registry with lifecycle CRUD: register/unbind/rename(alias)/updateSensitivity(widening/narrowing detection)
3. **KnowledgeResolver N-collection** — Generalized from 2-store to N-store fan-out via `resolveNCollection()` with `Promise.allSettled` + RRF fusion; legacy path unchanged
4. **Factory wiring** — Registers `project:cat-cafe` + `global:methods` as built-in collections
5. **Evidence route extension** — `dimension=library|collection` + `collections` comma-separated param; response includes `collectionGroups` envelope
6. **CollectionReadModel** — `computeOverview()` + `computeHealth()` as derived read-models (`indexable: false`)
7. **Library route** — `GET /api/library/catalog` + `GET /api/library/:collectionId`
8. **Marker routing** — 5 new fields on Marker interface + Schema V17 migration
9. **Privacy redactor** — `redactForTranscript()` strips private/restricted to metadata-only
10. **Hub Catalog skeleton** — `CollectionCatalog.tsx` with sensitivity badges + health indicators; MemoryNav gains 'catalog' tab
11. **Schema V17** — `collection_id` + `review_status` on evidence_docs; 5 routing columns on markers

## Why

铲屎官 (2026-05-03): "你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"

当前 F102 memory 绑在单 project 上。F186 Phase A 建立 Collection 抽象和联邦路由，使后续 Phase B-F 可以绑定非代码域（lexander 虚拟世界、金融笔记等）。

## Original Requirements（必填）

> "你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"
> "186 最好能够架构归一，必须归一"
> GBrain 拆解："人类可浏览层偏弱" — 铲屎官也想**浏览**图书馆里有什么

- 来源：`docs/features/F186-library-memory-architecture.md` (line 16-17, 21, 108-120)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **In-memory LibraryCatalog** vs SQLite-backed catalog: 选了 in-memory 因为 Phase A 只有 2 built-in collections，持久化不必要。Phase B+ 可升级。
- **privacy-redactor 只做 query-time**: AC-A9 spec 写了"所有持久化层"，Phase A plan 明确 scope 为 query-time only，persistence-layer redaction 属 Phase C。
- **CollectionCatalog.tsx 无 .pen 设计稿**: Phase A skeleton，数据卡片布局，不需要定制设计。

## Open Questions

1. **AC-A9 scope**: 当前 redactor 只覆盖 query-time path。Persistence-layer redaction（session transcripts, IndexBuilder FTS）是否应该标注为 Phase C blocker？
2. **evidence.ts at 349 lines**: Very close to 350 limit. Any additions will require extraction. Worth pre-emptively splitting?

## Next Action

请砚砚做 cross-family review。重点关注：
- Collection 抽象是否足够归一（不破坏 F102/F152/F163）
- KnowledgeResolver N-collection path 的错误处理和 fail-open 行为
- Privacy redactor 边界是否清晰
- Schema V17 migration 向前兼容性

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f186/codex`
- Start Command: `pnpm review:start`
- Ports: review:start 自动分配（3201/3202 起）

## 自检证据

### Spec 合规

Quality Gate PASS — 11/11 ACs met, 详见上方会话中的 Quality Gate Report。

### 测试结果

```
node --test packages/api/test/memory/*.test.js  # 555 passed, 1 failed (pre-existing f163-always-on)
pnpm --filter @cat-cafe/web test                 # 5 passed, 0 failed
pnpm lint                                        # 0 errors
pnpm check                                       # 0 errors
pnpm --filter @cat-cafe/api build                # exit 0
```

New F186 tests: 43 passing (10 test files).

### 相关文档

- Plan: `docs/plans/2026-05-03-f186-phase-a-collection-manifest.md`
- Feature: `docs/features/F186-library-memory-architecture.md`
