---
feature_ids: [F211]
topics: [review-request, implementation-review, hub-ui, runtime-session, antigravity]
doc_kind: mailbox
created: 2026-05-26
---

# Review Request: F211 Phase E Hub Runtime Visibility

Review-Target-ID: f211
Branch: `feat/f211-phase-e-hub-visibility`
Implementation gate SHA: `2ad0bdc3`

## What

Implemented F211 Phase E visibility:

- Hub Ops now has a Runtime sessions tab for Antigravity IDE-direct/runtime sessions.
- The in-context Audit panel has a Runtime tab that opens the same session evidence.
- Runtime session deep dive now shows runtime ids, conversation id, lifecycle/recovery metadata, identity history, and digest noise diagnostics.
- External runtime read API includes `identityHistory`.
- Session digest generation folds repeated recovered platform noise into `diagnostics.noise`, while terminal noise keeps one representative high-level error.

## Why

Phase B made IDE-direct/runtime sessions machine-discoverable through API/MCP, but users still could not browse them directly. Phase E closes that user-visible gap without waiting for Phase D's generic `Session.kind`.

## Original Requirements

> 我们的这个 antigravity 真的需要接入 session chain 也好或者什么也好，就是他的 session 得是透明的。
> The Phase E finish line: a user can answer "孟加拉猫上次在 IDE 里聊的那个是什么?" without asking a cat to run an MCP command manually.

- 来源：`docs/features/F211-cross-runtime-session-transparency.md` and `docs/plans/2026-05-26-f211-phase-e-hub-runtime-visibility.md`
- Please judge whether the UI and drilldown now make runtime sessions visible enough for this requirement.

## Tradeoff

Phase E uses the Phase B runtime-specific API (`/api/external-runtime-sessions`) instead of waiting for Phase D's generic `Session.kind`. That keeps the user-facing visibility work independent and reversible.

Digest noise folding is storage-level and additive. Raw transcript events are still available; high-level digest surfaces consume the summarized diagnostic field.

Hidden anchor threads remain hidden. The Hub and Audit panel show runtime session cards, not normal thread list entries.

## Architecture Ownership

Architecture cell: `identity-session` + `memory`
Map delta: none
Why: Phase 0/B already updated ownership for runtime-session registration and memory consumption; Phase E only exposes existing session evidence in Hub/Audit UI and adds digest diagnostics.

Please check:

- diff matches `Map delta: none`;
- no parallel `Store`, `Router`, `Binding`, or runtime-session truth source was introduced;
- `SessionRecord` remains the drilldown envelope and `RuntimeSessionMetadata` remains the runtime sidecar;
- anchor thread visibility remains excluded from normal thread list;
- digest noise folding does not drop raw events.

## Open Questions

### Technical OQ

- Is the Phase E before Phase D sequencing still sound in implementation, not just plan?
- Is the `SessionEventsViewer` runtime metadata guard strict enough to avoid showing malformed API data?
- Is storage-level digest noise folding correctly scoped to repeated platform noise and terminal outcome preservation?
- Are Hub and Audit panel entry points wired without exposing hidden anchor threads?

### Value OQ

None. Phase E before Phase D is reversible and directly addresses the user-visible gap called out by prior F211 vision reviews.

## Next Action

Return one of:

- `APPROVE`
- `BLOCKING`, with exact file/line or doc section and required change

Non-blocking polish is welcome, but please hold only for issues that invalidate Phase E behavior or the F211 visibility contract.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f211/opus45`
- Start Command: `pnpm review:start`
- Prior browser verification ports: `web=5112`, `api=3112` from the Phase E worktree; that server has been stopped. Reviewer sandbox may assign fresh review ports.

## Self-Check Evidence

### Spec Compliance

- `docs/features/F211-cross-runtime-session-transparency.md`: AC-E1 through AC-E4 are checked.
- `docs/plans/2026-05-26-f211-phase-e-hub-runtime-visibility.md`: implementation result and verification evidence recorded.
- Scope stayed within Phase E; no Phase D generic `Session.kind`, full transcript importer, orphan bind/move UX, visible anchor threads, or new memory/search index.

### Tests

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/transcript-writer.test.js packages/api/test/external-runtime-sessions-route.test.js
```

Result: 25 tests passed.

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/components/runtime-sessions/__tests__/external-runtime-session-format.test.ts \
  src/components/runtime-sessions/__tests__/ExternalRuntimeSessionsPanel.test.tsx \
  src/components/settings/__tests__/OpsContent-deep-link.test.tsx \
  src/components/audit/__tests__/AuditExplorerPanel.test.ts \
  src/components/audit/__tests__/SessionEventsViewer.test.ts
```

Result: 35 tests passed.

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 packages/api/test/services-lifecycle-failure-route.test.js
```

Result: 10 tests passed.

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 packages/api/test/tmux-agent-spawner.test.js
```

Result: 12 tests passed.

```bash
pnpm gate
```

Result: passed at `2ad0bdc3` after rebase onto `origin/main`.

### Browser Verification

- Desktop Hub: `/settings?s=ops&ops=runtime-sessions` showed the Ops Runtime sessions tab and empty state.
- Right-panel Audit: Runtime tab showed the same runtime-session surface and could open session evidence.
- Mobile Hub: 390px viewport layout verified for the Ops Runtime sessions tab.
- API: `GET /api/external-runtime-sessions?runtime=antigravity-desktop&limit=20` returned HTTP 200.

The temporary screenshots were deleted per user request and were not regenerated.

### Root Artifact Gate

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
find . -maxdepth 1 -name 'f211-phase-e-*.png' -print
```

Result: no matches.

### Related Docs

- Feature: `docs/features/F211-cross-runtime-session-transparency.md`
- Plan: `docs/plans/2026-05-26-f211-phase-e-hub-runtime-visibility.md`
