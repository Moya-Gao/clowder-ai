---
feature_ids: [F192]
topics: [harness-eval, eval-hub, e-pilot, a2a, verdict]
doc_kind: plan
created: 2026-05-22
---

# F192 E-pilot Live Verdict Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** Turn the merged `eval:a2a` contract mechanics into the first live, evidence-resolvable A2A verdict artifact without starting Eval Hub UI.
**Acceptance Criteria:** Extends Phase E-pilot AC-E8 and prepares AC-E9 by producing a live `eval:a2a` verdict from real snapshot / attribution artifacts; preserves AC-E3/E7 invariants.
**Architecture cell:** harness-eval
**Map delta:** none
**Map delta why:** F192 Phase E already introduced the harness-eval cell; this slice only connects existing F167 snapshot / attribution artifacts to the existing Verdict Handoff Packet contract.
**Architecture:** Add an artifact resolver that parses `docs/harness-feedback/snapshots/*.yaml` and `docs/harness-feedback/attributions/*.yaml`, validates their cross-refs, then feeds the existing `buildA2aVerdictHandoff()` adapter. Live verdict documents may be written only when every snapshot / attribution / metric / sample trace ref resolves; fixtures remain explicitly marked as fixtures.
**Tech Stack:** TypeScript, Zod, `yaml`, node:test, existing F192 harness-eval modules.
**前端验证:** No

---

## Finish Line

One live verdict document exists under `docs/harness-feedback/verdicts/` for the latest available `eval:a2a` snapshot / attribution pair, and tests prove:

- live verdict refs resolve to real snapshot / attribution artifacts;
- fixture verdicts cannot be mistaken for live verdicts;
- the live packet passes Verdict Handoff Packet schema + Verdict Matrix invariants;
- no cross-thread owner message is auto-sent in this slice.

## Not Building

- Eval Hub UI, cards, charts, or navigation.
- `eval:memory` adapter.
- Scheduled posting into the `eval:a2a` thread.
- Automatic cross-thread handoff to F167 owner.
- Sunset Trial executor / probe runner. This slice only preserves the `delete_sunset` trial contract if a live finding maps there.

## Terminal Schemas

### ResolvedHarnessEvalArtifacts

```ts
interface ResolvedHarnessEvalArtifacts {
  snapshotPath: string;
  attributionPath: string;
  snapshotRef: `snapshot:${string}`;
  attributionRefs: `attribution:${string}`[];
  snapshot: A2aSnapshotLike;
  attributionReport: AttributionReportLike;
}
```

### LiveVerdictArtifact

```ts
interface LiveVerdictArtifact {
  path: string;
  packet: VerdictHandoffPacket;
  markdown: string;
  refs: {
    snapshotPath: string;
    attributionPath: string;
  };
  isLive: true;
}
```

---

## Task 1: Artifact Resolver for Real F167 Snapshot / Attribution Docs

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-a2a-artifact-resolver.ts`
- Test: `packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js`

**Step 1: Write failing resolver tests**

Tests:
- loads a snapshot YAML file and maps `components[].id/name` to `componentId/componentName`.
- loads an attribution YAML file and maps snake_case doc fields to the adapter shape.
- rejects snapshot / attribution feature mismatch.
- rejects `eval_snapshot_id` that does not match the snapshot date/id.
- rejects attribution evidence anchors that do not match any snapshot component.

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js
```

Expected: FAIL because resolver does not exist.

**Step 2: Implement parser + resolver**

Use `yaml` and a small frontmatter splitter. Keep parsing narrow to current F167 artifacts; do not create a generic markdown ingestion framework.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js
git commit -m "feat(F192): resolve live eval:a2a artifacts [砚砚/GPT-5.5🐾]"
```

---

## Task 2: Live Verdict Generator

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-a2a-live-verdict.ts`
- Test: `packages/api/test/harness-eval/eval-a2a-live-verdict.test.js`
- Create: `docs/harness-feedback/verdicts/2026-05-22-eval-a2a-live-verdict.md`

**Step 1: Write failing generator tests**

Tests:
- builds a `VerdictHandoffPacket` from the latest real snapshot / attribution pair.
- writes markdown with YAML frontmatter `feedback_type: live-verdict`, `domain_id: eval:a2a`, `packet_id`, and `source_snapshot`.
- includes a clear "Live Verdict" banner, not "Contract Demo Fixture".
- does not send or simulate a cross-thread message.

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-live-verdict.test.js
```

Expected: FAIL because generator does not exist.

**Step 2: Implement generator**

Call the existing `buildA2aVerdictHandoff()` after resolver validation. The markdown body should summarize:

- phenomenon;
- verdict;
- evidence refs;
- owner ask;
- acceptance / re-eval plan;
- counterarguments.

**Step 3: Dogfood on current artifacts**

Generate the first live verdict from:

```text
docs/harness-feedback/snapshots/2026-05-22-F167-eval.yaml
docs/harness-feedback/attributions/2026-05-22-F167-attribution.yaml
```

Do not auto-post to F167 owner. This slice creates an auditable artifact only.

**Step 4: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-live-verdict.test.js
git commit -m "feat(F192): generate first live eval:a2a verdict [砚砚/GPT-5.5🐾]"
```

---

## Task 3: Evidence Integrity Invariant for Live Verdicts

**Files:**
- Modify: `packages/api/test/harness-eval/eval-a2a-artifacts.test.js`

**Step 1: Write failing invariant tests**

Tests:
- scans `docs/harness-feedback/verdicts/*.md` excluding `fixtures/`.
- every live verdict `snapshot:*` ref resolves to `docs/harness-feedback/snapshots/<date>-F167-eval.yaml`.
- every live verdict `attribution:*` ref resolves to a finding id or no-finding record in the matching attribution file.
- fixture verdicts must include "Contract Demo Fixture" and "representative data".

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifacts.test.js
```

Expected: FAIL until the live verdict generator produces resolvable refs.

**Step 2: Implement invariant helpers in test**

Keep this as a test-layer invariant for now. If E-hub needs the same resolver at runtime, promote shared helper later.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifacts.test.js
git commit -m "test(F192): enforce live verdict evidence refs [砚砚/GPT-5.5🐾]"
```

---

## Task 4: Verdict Matrix Regression Coverage

**Files:**
- Modify: `packages/api/test/harness-eval/eval-a2a-adapter.test.js`
- Modify: `packages/api/test/harness-eval/verdict-handoff.test.js`

**Step 1: Add table-driven verdict tests**

Cases:
- `harness-tune` + `harness_misfit` -> `fix`.
- `tool_gap` or `add-counter` -> `build`.
- `sunset-harness` -> `delete_sunset` with structured CVO gate.
- no finding record -> `keep_observe` with next eval window.

Negative cases:
- `delete_sunset` without governance gate is rejected.
- `keep_observe` without a next eval plan is rejected.
- live packet with empty evidence refs is rejected.

**Step 2: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-adapter.test.js packages/api/test/harness-eval/verdict-handoff.test.js
git commit -m "test(F192): lock verdict matrix semantics [砚砚/GPT-5.5🐾]"
```

---

## Task 5: Spec / Plan Sync + Quality Gate

**Files:**
- Modify: `docs/features/F192-socio-technical-harness-eval.md`
- Modify: `docs/plans/2026-05-22-f192-e-pilot-live-verdict.md`

**Step 1: Sync feature spec**

Add timeline entry:

```text
2026-05-22 | E-pilot live verdict slice ...
```

Do not mark AC-E9 complete; this is not Eval Hub UI.

**Step 2: Run focused verification**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js packages/api/test/harness-eval/eval-a2a-live-verdict.test.js packages/api/test/harness-eval/eval-a2a-artifacts.test.js packages/api/test/harness-eval/eval-a2a-adapter.test.js packages/api/test/harness-eval/verdict-handoff.test.js
pnpm check:features
```

**Step 3: Commit**

```bash
git commit -m "docs(F192): sync live verdict slice evidence [砚砚/GPT-5.5🐾]"
```

---

## Review Focus

Ask reviewer to focus on:

- live vs fixture evidence integrity;
- whether the live verdict overclaims "deep eval cat analysis" versus artifact transform;
- whether `delete_sunset` still only triggers trial and never directly deletes;
- whether Eval Hub can safely consume these live verdict docs later.
