# Review Request: F186 Phase B — Scanner 渐进增强框架

Review-Target-ID: f186
Branch: feat/f186-scanner

## What

4 new source files + 5 test files implementing the collection scanner framework:
- **FlatScanner** (Level 0): Recursive markdown walk, no frontmatter required. Title from `#` heading or filename, summary from first paragraph, section headings as keywords.
- **StructuredScanner** (Level 1): Extends FlatScanner. Upgrades provenance to `authoritative` when frontmatter present, maps `doc_kind` → EvidenceKind, merges topics + WikiLinks into keywords.
- **scanner-resolver**: `resolveCollectionScanner(manifest)` dispatches `scannerLevel` (0/1/2/3/auto) to correct scanner. `detectScannerLevel(root)` auto-detects via SUMMARY.md or frontmatter density.
- **CollectionIndexBuilder**: Thin orchestrator — scanner.discover() → SHA-256 hash dedup → store.upsert() → stale anchor cleanup (prefix-scoped).
- Barrel exports added to `index.ts`.

## Why

F186 Phase A delivered CollectionManifest + LibraryCatalog but had no scanner to actually index collection content. Phase B fills this gap — any markdown directory can now be scanned and searched through the evidence store, with progressive enhancement when structure exists.

## Original Requirements（必填）
> 铲屎官原话（2026-05-03）："你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"
- 来源：`docs/features/F186-library-memory-architecture.md` Why 节
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Level 2/3 (suggest structure, progressive enhancement) are declared but not yet implemented — Phase B focuses on the read-only scan pipeline. Levels 2+ fall back to StructuredScanner.
- `cleanStale()` uses `store.getDb()` for prefix query — couples CollectionIndexBuilder to SqliteEvidenceStore rather than IEvidenceStore. Pragmatic choice since IEvidenceStore lacks a `listByPrefix` method and this is an internal orchestrator.

## Open Questions

1. `FlatScanner.matchGlob()` handles basic globs (`**`, `*`) — is this sufficient or should we use a library like `minimatch`?
2. `CollectionIndexBuilder` rebuilds synchronously (one file at a time). For large collections, should we batch upserts?

## Next Action

请 review 代码质量 + AC 覆盖。纯后端改动，无前端/无 runtime 依赖。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f186/codex`
- Start Command: `NODE_ENV=development pnpm --filter @cat-cafe/api build && node --test test/memory/flat-scanner.test.js test/memory/structured-scanner.test.js test/memory/scanner-resolver.test.js test/memory/collection-index-builder.test.js test/memory/collection-scanner-integration.test.js`
- Ports: N/A（纯后端，无服务启动）

## 自检证据

### Spec 合规
| AC | Requirement | Status |
|---|---|---|
| AC-B1 | Level 0 scanner indexes arbitrary markdown (no frontmatter) | ✅ 14 tests |
| AC-B2 | Level 1 scanner leverages frontmatter/WikiLink structure | ✅ 12 tests |
| AC-B3 | Scanner level configurable in manifest (auto/0/1/2/3) | ✅ 10 tests |

### 测试结果
```
node --test (5 suites)       # 45 passed, 0 failed ✅
pnpm lint (tsc --noEmit)     # 0 errors ✅
pnpm build                   # exit 0 ✅
Root artifact guard           # clean ✅
```

### 相关文档
- Feature: `docs/features/F186-library-memory-architecture.md`
- Plan: `docs/plans/2026-05-04-f186-phase-b-scanner-framework.md`

### Pre-register retraction conditions
如果判断错了我最可能错在:
1. `FlatScanner.matchGlob()` regex 转换遗漏边界 case（如 `?` 或 `[...]` 模式）
2. `CollectionIndexBuilder.cleanStale()` 的 LIKE 查询在 anchor 包含 SQL 通配符 `%`/`_` 时可能误匹配
3. `StructuredScanner` 的 keyword merge 在 topics 和 section keywords 大小写不同时可能出现伪去重
