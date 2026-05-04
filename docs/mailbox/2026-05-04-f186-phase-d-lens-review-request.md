---
type: review-request
feature: F186
date: 2026-05-04
author: opus-46
reviewer: codex
---

# Review Request: F186 Phase D Overview Lens enrichment

Review-Target-ID: f186-phase-d-lens
Branch: feat/f186-phase-d-lens

## What

Enriches the Human-Browsable Layer (AC-D2) beyond the Phase A skeleton:

1. **Backend**: `GET /api/library/:collectionId/documents` — returns documents grouped by `kind` with anchor, title, updatedAt, status. Same sensitivity guard as detail endpoint (private/restricted -> 404).
2. **Frontend**: `CollectionCatalog` cards are now expandable — click to see grouped document list via `CollectionDetail` sub-component.
3. **Tests**: 3 new test cases (grouped docs, unknown 404, private 404). Total: 17/17 green.

Files changed (4):
- `packages/api/src/domains/memory/CollectionReadModel.ts` — `+computeDocumentGroups()`
- `packages/api/src/routes/library.ts` — `+GET /:collectionId/documents`
- `packages/api/test/memory/library-register-rebuild.test.js` — +3 tests
- `packages/web/src/components/memory/CollectionCatalog.tsx` — expandable cards + `CollectionDetail`

## Why

铲屎官 tested Phase D after merge and said: "但是好像只有一个总体的预览？" — the Overview Lens was still Phase A skeleton (summary cards only). Spec line 114 says "Phase A 骨架 / Phase D 充实" — this PR delivers the "充实".

## Original Requirements（必填）

> 铲屎官（2026-05-04）："但是好像只有一个总体的预览？"
> 铲屎官："GBrain能做到什么程度？我们当时设计的ux到底是怎么样的？"
> Spec line 114："Collection Overview Lens：每个 Collection 在 Hub 里有一个人类可读的概览（里面有什么主题、关键 anchor、最近变更），不是搜索结果而是浏览入口"

- 来源：session 对话 + `docs/features/F186-library-memory-architecture.md` line 108-120
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Documents API returns all docs per collection (not paginated). Lexander has 343 docs — acceptable for now. Pagination can be added later if collections grow larger.
- All 343 lexander docs are `kind: research` (FlatScanner Level 0 assigns `research` by default). Richer kind differentiation requires StructuredScanner (Level 1+) with frontmatter `doc_kind` parsing. The grouping infrastructure is ready for when richer metadata exists.

## Open Questions

1. **Frontend browser verification blocked**: Shell `NODE_ENV=production` prevents Next.js dev server from compiling pages on-demand. Backend fully verified (curl + tests). Please verify the expandable UI in your review sandbox.
2. The `collectionId` param in `computeDocumentGroups` is unused (kept for API consistency with sibling methods). Worth removing?

## Next Action

Please review code quality + verify the frontend expandable behavior in browser.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f186-phase-d-lens/codex`
- Start Command: `pnpm review:start`
- Ports: assigned by review:start (default 3201/3202 range)

## 自检证据

### Spec 合规

- AC-D2 "Human-Browsable Layer" — now enriched with document-level browsing
- Vision check: spec says "里面有什么主题、关键 anchor、最近变更" — endpoint returns grouped documents with anchors/titles/dates, UI renders expandable view

### 测试结果

```
pnpm --filter @cat-cafe/api test (library suite) → 17 passed, 0 failed
pnpm lint                                         → 0 errors
pnpm check                                        → 0 errors (after biome auto-fix)
pnpm --filter @cat-cafe/api build                 → exit 0
Full API suite                                    → 10109 passed, 0 failed
```

### Artifact Hygiene

- Root artifacts (working tree): none
- Root artifacts (committed diff): none

### 相关文档

- Feature: `docs/features/F186-library-memory-architecture.md`
- Plan: `docs/plans/2026-05-04-f186-phase-d-lexander-pilot.md`
- Discussion: `docs/discussions/2026-05-03-gbrain-deep-dive/memory-comparison.md`
