---
doc_kind: review-request
feature_ids: [F186]
created: 2026-05-04
---

# Review Request: F186 Phase D — Lexander Pilot (External Collection Pipeline)

Review-Target-ID: f186-phase-d
Branch: feat/f186-phase-d

## What

Phase D adds the ability to register, persist, scan, index, and query external (non-code) Collections via the library API. Three new capabilities:

1. **External collection persistence** (`external-collections.ts`): Load/save manifests to `~/.cat-cafe/library/collections.json`, filter out collections with non-existent root paths on load
2. **Register + Rebuild endpoints** (`library.ts`): POST /api/library/register (create collection + persist) and POST /api/library/:collectionId/rebuild (trigger scan+index)
3. **Factory startup wiring** (`factory.ts` + `index.ts`): On startup, loads persisted external collections, registers them in catalog, opens sqlite stores, and passes full stores map + dataDir to library routes

## Why

AC-D1 requires proving the full truth→scan→index→query pipeline works with a real non-code Collection. AC-D2 requires the Human-Browsable Layer (Overview Lens + Health Card) to render correctly for such collections. This is the first time the library architecture handles content outside of `docs/`.

The pilot target is lexander (`/Users/lysander/projects/Bound by Calestial Grow/lexander`) — 345 markdown files with frontmatter + WikiLinks. Path contains a space, which is explicitly tested.

## Original Requirements

> "你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"
> — 铲屎官, 2026-05-03
- 来源: `docs/features/F186-library-memory-architecture.md` (Why 章节)
- **请对照上面的摘录判断：这些 API endpoints + persistence 是否为"recall 本 project 以外的知识"提供了可用的基础设施**

## Tradeoff

- No security scanning (Phase C) — external collections default to `sensitivity: internal` which is appropriate for trusted local content. Phase C will add secret scanning before this goes to untrusted content.
- `scannerLevel: 'auto'` in register endpoint delegates to `detectScannerLevel()` — reviewer should check if auto-detection is reliable enough for the pilot or if explicit level should be required.

## Open Questions

1. **Persistence format**: Using a flat JSON array in `collections.json`. Should we validate manifest schema on load, or is the current fail-open (skip broken) sufficient?
2. **Store lifecycle**: Register endpoint creates a new sqlite store immediately. Should we defer store creation until first rebuild?
3. **factory.ts line count**: Now 226 lines (above 200 warning). The 14 lines I added are the external collection loading loop. Worth extracting to a helper?

## Next Action

请砚砚审查代码质量、API 设计合理性、和边界处理。重点关注 register endpoint 的输入验证和 factory startup 的 fail-open 策略。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f186-phase-d/codex`
- Start Command: `pnpm review:start`
- Ports: Backend-only changes, no dev server needed for review. Tests can be run directly.

## 自检证据

### Spec 合规

- AC-D1 (truth→scan→index→query): Verified via `collection-pipeline-e2e.test.js` — 3 tests covering full pipeline, frontmatter enrichment, and paths with spaces
- AC-D2 (Overview Lens + Health Card): Verified via `collection-catalog-display.test.js` — 2 tests covering catalog endpoint (docCount, topKinds, recentAnchors, indexFreshness) and detail endpoint

### 测试结果

```
pnpm --filter @cat-cafe/api test (memory subset)   # 29 passed, 0 failed
  - external-collections: 5/5
  - library-register-rebuild: 5/5
  - collection-pipeline-e2e: 3/3
  - collection-catalog-display: 2/2
  - library-catalog (existing): 14/14

pnpm check                                          # 0 errors
pnpm lint                                           # 0 errors (warnings pre-existing)
pnpm --filter @cat-cafe/api build                   # exit 0
```

### 根目录工件闸门
```
git status --short (root artifacts): clean
git diff --name-only origin/main...HEAD (root artifacts): clean
```

### 相关文档
- Plan: `docs/plans/2026-05-04-f186-phase-d-lexander-pilot.md`
- Feature: `docs/features/F186-library-memory-architecture.md`
- Phase B (prerequisite): PR #1548 (merged)
