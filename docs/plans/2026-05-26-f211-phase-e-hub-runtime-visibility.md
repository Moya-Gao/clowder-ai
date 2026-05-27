---
feature_ids: [F211]
related_features: [F061, F102, F124, F178, F198, F200, F201, F209]
topics: [antigravity, hub-ui, runtime-session, session-chain, digest, visibility]
doc_kind: plan
created: 2026-05-26
---

# F211 Phase E Hub Runtime Visibility Implementation Plan

**Feature:** F211 - `docs/features/F211-cross-runtime-session-transparency.md`
**Goal:** Let users and cats see, open, and reason about Antigravity IDE-direct/runtime sessions from Hub and in-context session surfaces.
**Acceptance Criteria:**
- AC-E1: Hub/session-chain UI can display Antigravity cascade sessions with status and retire reason.
- AC-E2: In-context thread/handoff surface can point cats to external runtime session evidence when relevant.
- AC-E3: Deep-dive view links session record, cascadeId/conversation id, transcript/digest, and recovery metadata.
- AC-E4: Digest-level views fold repeated `context canceled` / MCP refused / canceled step noise into summarized diagnostics unless it changes the user-visible outcome.
**Architecture cell:** `identity-session` + `memory`
**Map delta:** none
**Map delta why:** Phase 0/B already added runtime-session ownership and external runtime registration surfaces. Phase E only exposes those existing surfaces in Hub and audit UI.
**Architecture:** Keep `SessionRecord` as the drilldown envelope and `RuntimeSessionMetadata` as the runtime sidecar. Reuse `GET /api/external-runtime-sessions[/:sessionId]` for list/read, reuse `/api/sessions/:id/events` and `/api/sessions/:id/digest` for transcript/digest, and add deterministic digest-noise folding before high-level digest display. Do not introduce a parallel Hub runtime session store.
**Tech Stack:** TypeScript, Fastify routes, `TranscriptWriter`/`TranscriptReader`, React, Vitest, existing settings Ops tabs, existing `AuditExplorerPanel` and `SessionEventsViewer`.
**前端验证:** Yes - reviewer must open the Hub Ops runtime-session tab and the right-panel audit runtime tab in browser/review sandbox.

---

## Finish Line

Phase E is done when a user can answer: "孟加拉猫上次在 IDE 里聊的那个是什么?" without asking a cat to run an MCP command manually.

The final state:

- Hub Ops has a runtime-session view listing recent Antigravity IDE-direct sessions by runtime, cat, status, retire reason, model, last observed time, and binding mode.
- The in-context right panel has a Runtime tab that points cats to the same external runtime session evidence without making hidden anchor threads visible in the normal thread list.
- Opening a runtime session shows cascade/runtimeSessionId, conversation id, identity history, lifecycle/recovery metadata, transcript events, and digest links.
- Repeated platform noise is summarized as diagnostics in digest-level views; raw events remain available in the Raw tab.

Not building:

- Phase D generic `Session.kind`.
- A full transcript importer for Antigravity IDE history.
- Orphan-to-thread binding/move UX.
- Visible anchor threads in the normal chat thread list.
- A new memory/search index. F209 remains the retrieval consumer.

## Terminal Contract

### Runtime Session List Item

Frontend code consumes the existing external runtime session API with one small additive field for identity history:

```ts
interface ExternalRuntimeSessionListItem {
  sessionId: string;
  threadId: string;
  runtime: 'antigravity-desktop';
  runtimeSessionId: string;
  runtimeConversationId?: string;
  catId: string;
  model?: string;
  identityHistory?: Array<{ catId: string; model?: string; observedAt: number; source?: string }>;
  title?: string;
  lastObservedAt: number;
  lifecycle: {
    state: string;
    sealReason?: string;
    drainResult?: string;
    conflictReason?: string;
    pendingSince?: number;
  };
  binding: { mode: 'orphan_anchor'; anchorThreadId: string } | { mode: 'thread'; threadId: string };
  provenance?: Record<string, unknown>;
  drilldown: {
    sessionRecord: string;
    events: string;
    digest: string;
  };
}
```

The UI must tolerate older responses without `identityHistory`.

### Digest Diagnostics

`digest.extractive.json` gains an additive `diagnostics.noise` field:

```ts
diagnostics?: {
  noise?: Array<{
    kind: 'context_canceled' | 'mcp_refused' | 'canceled_step';
    count: number;
    sample: string;
    invocationIds: string[];
    firstAt: number;
    lastAt: number;
    outcome: 'recovered' | 'terminal';
  }>;
};
```

Folding rule:

- Repeated matched noise with `outcome: 'recovered'` is removed from high-level `errors` and shown only under diagnostics.
- `outcome: 'terminal'` keeps one high-level `errors` entry plus the summarized diagnostic group, because the noise changed the user-visible outcome.
- Raw transcript events are never dropped.

## Task 1: Digest Noise Folding For AC-E4

**Files:**

- Modify: `packages/api/src/domains/cats/services/session/TranscriptWriter.ts`
- Modify: `packages/api/test/transcript-writer.test.js`

**Step 1: Write recovered-noise red test**

Add a `generateExtractiveDigest()` test:

```js
test('F211 E4: repeated recovered runtime noise is folded into digest diagnostics', async () => {
  const { TranscriptWriter } = await loadModules();
  const writer = new TranscriptWriter({ dataDir: tmpDir });
  writer.appendEvent(SESSION_INFO, { type: 'tool_result', is_error: true, content: 'context canceled' }, 'inv-1');
  writer.appendEvent(SESSION_INFO, { type: 'tool_result', is_error: true, content: 'context canceled' }, 'inv-1');
  writer.appendEvent(SESSION_INFO, { type: 'text', content: 'I recovered and finished the check.' }, 'inv-1');

  const digest = writer.generateExtractiveDigest(SESSION_INFO, sealTs());

  assert.deepEqual(digest.errors, []);
  assert.equal(digest.diagnostics.noise[0].kind, 'context_canceled');
  assert.equal(digest.diagnostics.noise[0].count, 2);
  assert.equal(digest.diagnostics.noise[0].outcome, 'recovered');
});
```

Expected before implementation: FAIL because repeated noise is promoted into `errors` and no `diagnostics.noise` exists.

**Step 2: Write terminal-noise red test**

Add a second test that appends repeated `MCP refused` or canceled step errors with no later visible successful text/event. Expected digest:

- `diagnostics.noise[0].outcome === 'terminal'`
- `errors.length === 1`
- the promoted error is a short representative message, not every repeated noise line

**Step 3: Implement classifier and grouping**

Inside `TranscriptWriter.generateExtractiveDigest(...)`:

- Add a small pure helper near the digest helpers, for example `classifyDigestNoise(message: string)`.
- Match:
  - `/context cancell?ed/i` -> `context_canceled`
  - `/mcp.*refus|refus.*mcp|status:\s*refused/i` -> `mcp_refused`
  - `/cancell?ed step|step .* cancell?ed|user_cancel/i` -> `canceled_step`
- Track later visible assistant text or non-error terminal success after each noise group to decide `recovered` vs `terminal`.
- Keep file-local helpers, no new store or route.

**Step 4: Run targeted API test**

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/transcript-writer.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/session/TranscriptWriter.ts \
  packages/api/test/transcript-writer.test.js
git commit -m "fix(F211): fold runtime noise in session digests" \
  -m "Why: Phase E digest-level views should summarize repeated platform noise without losing raw transcript detail."
```

## Task 2: External Runtime Read Contract For Deep Dive

**Files:**

- Modify: `packages/api/src/routes/external-runtime-sessions.ts`
- Modify: `packages/api/test/external-runtime-sessions-route.test.js`

**Step 1: Write failing route contract test**

Extend the read route test to assert:

- `identityHistory` is returned and preserves at least `catId`, `model`, `observedAt`, and `source` when present.
- `lifecycle.sealReason` and `lifecycle.drainResult` survive read formatting.
- `drilldown.sessionRecord`, `drilldown.events`, and `drilldown.digest` point at `/api/sessions/:sessionId...`.

Expected before implementation: FAIL on `identityHistory`.

**Step 2: Implement additive response field**

In `formatExternalRuntimeSession(...)`, include:

```ts
identityHistory: record.identityHistory,
```

No query behavior changes.

**Step 3: Run route test**

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/external-runtime-sessions-route.test.js
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/api/src/routes/external-runtime-sessions.ts \
  packages/api/test/external-runtime-sessions-route.test.js
git commit -m "feat(F211): expose runtime identity history for deep dive" \
  -m "Why: Phase E needs the UI drilldown to show model/cat identity transitions without inventing a new session model."
```

## Task 3: Runtime Session UI Types And Formatting

**Files:**

- Create: `packages/web/src/components/runtime-sessions/external-runtime-session-types.ts`
- Create: `packages/web/src/components/runtime-sessions/external-runtime-session-format.ts`
- Create: `packages/web/src/components/runtime-sessions/__tests__/external-runtime-session-format.test.ts`

**Step 1: Write failing formatter tests**

Cover:

- lifecycle states: `active`, `sealed`, `runtime_seal_pending`, `runtime_conflict_pending`
- seal reasons: `oversized_retire`, `user_initiated`, `empty_response`, `tool_conflict`, `runtime_disconnected`
- binding labels: orphan anchor vs explicit thread
- runtime id truncation and missing title/model fallback

Expected: FAIL because the helper files do not exist.

**Step 2: Implement pure helpers**

Keep helpers side-effect free:

- `formatRuntimeLabel(runtime)`
- `formatLifecycleBadge(lifecycle)`
- `formatSealReason(reason)`
- `formatBindingLabel(binding)`
- `formatRuntimeSessionTitle(session)`
- `shortRuntimeId(id)`

Use neutral console palette class names already used by `SessionChainPanel`, not a new one-note theme.

**Step 3: Run formatter test**

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/runtime-sessions/__tests__/external-runtime-session-format.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/web/src/components/runtime-sessions
git commit -m "feat(F211): add runtime session UI formatting helpers" \
  -m "Why: Phase E needs one shared display contract for Hub and in-context runtime session surfaces."
```

## Task 4: Reusable External Runtime Sessions Panel

**Files:**

- Create: `packages/web/src/components/runtime-sessions/ExternalRuntimeSessionsPanel.tsx`
- Create: `packages/web/src/components/runtime-sessions/__tests__/ExternalRuntimeSessionsPanel.test.tsx`
- Modify: `packages/web/src/components/runtime-sessions/index.ts` if a barrel is useful; otherwise import direct paths.

**Step 1: Write failing panel tests**

Mock `apiFetch` and assert:

- Initial load calls `/api/external-runtime-sessions?runtime=antigravity-desktop&limit=20`.
- Active and sealed sessions render status, retire reason, cat/model, runtime session id, conversation id, last observed time, and binding mode.
- Empty state renders without suggesting normal hidden anchor threads are visible.
- Error state is concise and retryable.
- Clicking "查看" calls `onViewSession(sessionId, catId)`.
- Optional status filter changes visible rows without a refetch.

Expected: FAIL because the component does not exist.

**Step 2: Implement panel**

Use a dense operational layout:

- Header with refresh button and runtime label.
- Segmented status filter: all / active / sealed / attention.
- Stable rows using `minmax(0, 1fr)`, `truncate`, and fixed button sizing.
- No nested cards inside cards; each session row is a list item.
- No visible instructional prose beyond labels and states.

**Step 3: Run panel test**

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/runtime-sessions/__tests__/ExternalRuntimeSessionsPanel.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/web/src/components/runtime-sessions
git commit -m "feat(F211): list external runtime sessions in reusable UI" \
  -m "Why: Hub and audit surfaces should consume the same runtime-session evidence view."
```

## Task 5: Hub Ops Runtime Sessions Tab

**Files:**

- Create: `packages/web/src/components/HubRuntimeSessionsTab.tsx`
- Modify: `packages/web/src/components/settings/OpsContent.tsx`
- Modify: `packages/web/src/components/settings/ops-nav-config.ts`
- Modify: `packages/web/src/components/settings/__tests__/OpsContent-deep-link.test.tsx`

**Step 1: Write failing deep-link test**

Add a test for `?s=ops&ops=runtime-sessions` that expects a mocked `HubRuntimeSessionsTab` to render.

Expected: FAIL because `runtime-sessions` is not a valid Ops subsection.

**Step 2: Implement Hub tab**

`HubRuntimeSessionsTab` wraps `ExternalRuntimeSessionsPanel`. For now, clicking "查看" stores a selected session in local component state and renders `SessionEventsViewer` below the list.

This keeps the first Hub implementation self-contained and avoids cross-page router state.

**Step 3: Run settings test**

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/settings/__tests__/OpsContent-deep-link.test.tsx
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/web/src/components/HubRuntimeSessionsTab.tsx \
  packages/web/src/components/settings/OpsContent.tsx \
  packages/web/src/components/settings/ops-nav-config.ts \
  packages/web/src/components/settings/__tests__/OpsContent-deep-link.test.tsx
git commit -m "feat(F211): add Hub runtime sessions tab" \
  -m "Why: Phase E must make IDE-direct Antigravity sessions visible to users, not only to MCP tools."
```

## Task 6: In-Context Audit Runtime Tab

**Files:**

- Modify: `packages/web/src/components/audit/AuditExplorerPanel.tsx`
- Modify: `packages/web/src/components/audit/__tests__/AuditExplorerPanel.test.ts`

**Step 1: Write failing audit-panel test**

Add a test that clicks the new `Runtime` tab, sees `ExternalRuntimeSessionsPanel`, and verifies selecting a session switches to the existing Session tab viewer.

Expected: FAIL because `AuditTab` does not include runtime sessions.

**Step 2: Integrate reusable panel**

Add `runtime` to `AuditTab`:

- Label: `Runtime`
- Content: `ExternalRuntimeSessionsPanel onViewSession={handleViewSession}`
- Existing external `SessionChainPanel` click behavior remains unchanged.

**Step 3: Run audit panel tests**

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/audit/__tests__/AuditExplorerPanel.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/web/src/components/audit/AuditExplorerPanel.tsx \
  packages/web/src/components/audit/__tests__/AuditExplorerPanel.test.ts
git commit -m "feat(F211): surface runtime sessions in audit panel" \
  -m "Why: Cats need in-context pointers to external runtime evidence without exposing hidden anchor threads."
```

## Task 7: Runtime Session Deep Dive Header

**Files:**

- Modify: `packages/web/src/components/audit/SessionEventsViewer.tsx`
- Modify: `packages/web/src/components/audit/__tests__/SessionEventsViewer.test.ts`

**Step 1: Write failing metadata test**

Mock event fetch plus `GET /api/external-runtime-sessions/s1`. Assert the viewer renders:

- runtime session id / cascade id
- conversation id
- lifecycle state and seal reason
- binding mode
- identity history count or latest model
- digest diagnostics summary when `/api/sessions/s1/digest` includes `diagnostics.noise`

Expected: FAIL because `SessionEventsViewer` only fetches events.

**Step 2: Write non-external regression test**

Mock external-runtime read as 404 and assert normal SessionEventsViewer still renders events without an error banner.

Expected before implementation may PASS by absence; keep it as a regression after adding metadata fetch.

**Step 3: Implement best-effort metadata fetch**

In `SessionEventsViewer`:

- Fetch external runtime metadata in a separate effect.
- Treat 404 as "normal session" and do not show error.
- Fetch digest only when metadata exists or when the active view needs digest diagnostics.
- Render a compact metadata header above tabs.
- Display folded `diagnostics.noise` as one row per kind with count/outcome.

Do not block event rendering on metadata/digest failure.

**Step 4: Run viewer tests**

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/audit/__tests__/SessionEventsViewer.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web/src/components/audit/SessionEventsViewer.tsx \
  packages/web/src/components/audit/__tests__/SessionEventsViewer.test.ts
git commit -m "feat(F211): add runtime metadata to session deep dive" \
  -m "Why: Phase E drilldown must connect runtime ids, recovery lifecycle, digest, and transcript in one view."
```

## Task 8: Docs, Browser Verification, And Final Gate

**Files:**

- Modify: `docs/features/F211-cross-runtime-session-transparency.md`
- Modify: `docs/plans/2026-05-26-f211-phase-e-hub-runtime-visibility.md` only if implementation finds plan deltas worth preserving.

**Step 1: Update feature doc**

Mark AC-E1 through AC-E4 checked only after code and browser verification are complete. Add a Timeline row with PR number, commit, test summary, and browser evidence.

**Step 2: Run focused test set**

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/transcript-writer.test.js packages/api/test/external-runtime-sessions-route.test.js

pnpm --filter @cat-cafe/web exec vitest run \
  packages/web/src/components/runtime-sessions/__tests__/external-runtime-session-format.test.ts \
  packages/web/src/components/runtime-sessions/__tests__/ExternalRuntimeSessionsPanel.test.tsx \
  packages/web/src/components/settings/__tests__/OpsContent-deep-link.test.tsx \
  packages/web/src/components/audit/__tests__/AuditExplorerPanel.test.ts \
  packages/web/src/components/audit/__tests__/SessionEventsViewer.test.ts

pnpm check:features
git diff --check
```

Expected: all PASS.

**Step 3: Browser verification**

Start a review/dev surface from the Phase E worktree, using 6398 only:

```bash
pnpm review:start
```

Open the assigned web port and verify:

- `/settings?s=ops&ops=runtime-sessions` renders the runtime-session list without layout overlap.
- The right panel `审计 & Session` card has a Runtime tab.
- Selecting a runtime session opens the session deep-dive metadata header and events.
- Mobile/narrow viewport keeps row text contained.

Capture screenshots for review notes.

**Step 4: Full gate**

```bash
pnpm gate
```

Expected: PASS.

**Step 5: Commit docs**

```bash
git add docs/features/F211-cross-runtime-session-transparency.md
git commit -m "docs(F211): sync phase E visibility progress" \
  -m "Why: Feature truth should reflect Hub runtime-session visibility only after tests and browser verification pass."
```

## Review Focus

Ask the architecture reviewer to check:

- Whether Phase E should proceed before Phase D. Current plan says yes because it consumes Phase B's runtime-specific API and does not need generic `Session.kind`.
- Whether AC-E4 should be storage-level digest diagnostics plus UI summary, or UI-only folding is sufficient. Current plan chooses storage-level additive diagnostics because the noise policy is about high-level digest memory, not just React presentation.
- Whether adding `identityHistory` to external runtime session read responses is enough for AC-E3, or if the route should expose more recovery metadata.

## Open Questions

### 技术 OQ

1. Does `TranscriptWriter` have enough event signal to distinguish recovered vs terminal noise? The plan uses later visible assistant text or non-error terminal success as recovered evidence, and keeps one promoted error when that evidence is absent.
2. Should Hub selection render `SessionEventsViewer` inline or use a route-level deep link? The plan chooses inline for Phase E because it is reversible and avoids adding router state.

### 价值 OQ

无。Phase E before Phase D is reversible and directly addresses the user-visible gap already called out by the Phase B/C vision reviews.
