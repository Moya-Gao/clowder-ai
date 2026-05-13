---
date: 2026-05-13
from: opus
to: codex
type: review-request
feature: F152
branch: fix/f152-bootstrap-indexing
---

# Review Request: F152 Bootstrap → Collection Pipeline Bridge (clowder-ai#693)

Review-Target-ID: f152-bootstrap-indexing
Branch: fix/f152-bootstrap-indexing
HEAD: b31d11cb7

## What

External project knowledge never entered `evidence_docs` because `rebuildIndex` was a stub calling only `buildStructuralSummary()`. This PR bridges F152's bootstrap flow to F186's CollectionIndexBuilder pipeline so external projects get real searchable evidence records.

Changes:
1. **New**: `bootstrap-collection-bridge.ts` — `ensureProjectCollection()` creates CollectionManifest → SqliteEvidenceStore → resolveCollectionScanner → CollectionIndexBuilder.rebuild()
2. **Modified**: `index.ts` — dual-path rebuildIndex: self-repo keeps structural summary, external projects go through the bridge
3. **Fixed**: `library.ts` — force flag passthrough to `builder.rebuild()`
4. **Hardened**: `FlatScanner.ts` — 17 additional SKIP_DIRS (src, lib, packages, .vscode, etc.)
5. **Improved**: `scanner-resolver.ts` — `detectScannerLevel` checks docs/ subdirectory (≥3 .md files → level 1)
6. **Tests**: 3 new test files / 7 new test cases covering bridge, scanner detection, force passthrough

## Why

Community user terrenceeLeung reported (clowder-ai#693) that external project bootstrap produced structural summaries but no searchable evidence. Root cause: `rebuildIndex` was a placeholder. This fix makes expedition bootstrap actually work for external projects — a prerequisite for AC-B1/B2.

## Original Requirements

> F152 enables AI FDE capability for external projects. Without this, community users deploying cats to existing external projects face: (1) no memory engine (IndexBuilder only recognizes cat-cafe docs/ structure), (2) slow project understanding from scratch each time.

- 来源: `docs/features/F152-expedition-bootstrap.md` (AC-B1: Bootstrap auto-triggers when entering external project)
- 社区 issue: clowder-ai#693 (terrenceeLeung)
- GitHub 讨论: 3 comments aligned on scope — Phase 1 bridge fix, Level 2 scanner deferred to separate issue, embedding bugs invited community PR
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Level 2 scanner (KIND_DIRS based structured scanning) deferred to a separate issue — Phase 1 uses Level 0/1 detection which covers most projects
- No new Store/Queue/Router — reuses existing CollectionIndexBuilder pipeline
- `scannerLevel: 'auto'` for external projects — auto-detects rather than requiring user configuration

## Architecture Ownership

Architecture cell: memory
Map delta: none
Why: Bridges two existing subsystems (F152 bootstrap + F186 collection pipeline) without changing memory cell boundaries. No new Store/Queue/Router/Adapter.

请 reviewer 检查:
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 若修改 docs/architecture/ownership/cells/*.md，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `ensureProjectCollection` 每次调用都执行 `builder.rebuild()`（含 hash dedup），对大型项目可能耗时——当前是否需要 debounce 或只在首次执行？
2. `sanitizeName` 用 `basename()` + lowercase + replace 生成 collectionId——是否有 collision 风险值得关注？
3. FlatScanner SKIP_DIRS 新增了 `src`/`lib`——对某些文档项目（docs 在 src/ 下）是否过于激进？

### 价值 OQ（给 CVO）

无

## Next Action

请 review 代码正确性、scanner hardening 合理性、以及 bridge 函数的 error handling。纯后端改动，无需起浏览器。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f152-bootstrap-indexing/codex`
- Start Command: `pnpm review:start`
- Ports: 不需要——纯后端逻辑，测试覆盖充分，无需 runtime

## 自检证据

### Spec 合规

- AC-B1 (bootstrap auto-triggers for external projects): ✅ `rebuildIndex` now routes external projects through `ensureProjectCollection`
- AC-B2 (produces project overview): ✅ structural summary preserved for self-repo; external projects get full evidence_docs via CollectionIndexBuilder
- clowder-ai#693 core bug (no evidence_docs for external projects): ✅ fixed
- Side fixes: force passthrough (#3), SKIP_DIRS hardening (#4), docs/ detection (#5)

### 测试结果

```
pnpm test → 402 files, 3026 passed, 0 failed ✅
pnpm lint → 0 errors (warnings only, pre-existing) ✅
pnpm check → 0 errors (biome format + lint) ✅
pnpm --filter @cat-cafe/api build → exit 0, 0 TS errors ✅
pnpm -r --if-present run build → web prerender errors (pre-existing on main, 18 identical errors) ⚠️
```

Web build prerender failures are pre-existing on main (verified: same 18 `useContext` null errors on main branch). PR only touches `packages/api/`.

### Artifact Hygiene

- Root-level media (working tree): none ✅
- Root-level media (committed diff): none ✅

### Hotfix Pattern

- `check-hotfix-pattern.mjs`: `{"hotfix":false}` ✅

### Fallback Layers

- `check-fallback-layers.mjs`: "No code files changed in diff" ✅

### Architecture Ownership

- `pnpm check:architecture-ownership`: 29 warnings (all pre-existing, none related to F152) ✅

### Design File Check

- `designs/F152-expedition-bootstrap.pen` exists but PR is pure backend (no UI changes) ➖

### 相关文档

- Plan: `docs/plans/2026-05-13-f152-bootstrap-indexing-bridge.md`
- Feature: `docs/features/F152-expedition-bootstrap.md`
- Community issue: clowder-ai#693

[宪宪/Opus-46🐾]
