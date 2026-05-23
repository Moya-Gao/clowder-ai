---
feature_ids: [F192]
topics: [harness-eval, eval-hub, e-pilot, a2a, verdict]
doc_kind: plan
created: 2026-05-22
---

# F192 E-pilot Live Verdict Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** Turn the merged `eval:a2a` contract mechanics into the first live, evidence-resolvable A2A verdict artifact without starting Eval Hub UI.
**Acceptance Criteria:** Extends Phase E-pilot AC-E8 and prepares AC-E9 by producing a live `eval:a2a` verdict from real runtime snapshot / attribution artifacts via a committed sanitized evidence bundle; preserves AC-E3/E7 invariants.
**Architecture cell:** harness-eval
**Map delta:** none
**Map delta why:** F192 Phase E already introduced the harness-eval cell; this slice only connects existing F167 snapshot / attribution artifacts to the existing Verdict Handoff Packet contract.
**Architecture:** Add a bundle resolver for `docs/harness-feedback/bundles/<verdict-id>/` and a generator that derives that bundle from raw runtime `snapshots/` + `attributions/`. Live verdict documents may cite `snapshot:` / `attribution:` only when those refs resolve to a committed sanitized bundle in the same PR; raw runtime artifacts stay gitignored.
**Tech Stack:** TypeScript, Zod, `yaml`, node:test, existing F192 harness-eval modules.
**前端验证:** No

---

## OQ-15 Decision: Hybrid Bundle Evidence SOT

Task 1 RED test uncovered an architecture blocker before implementation, and F192 owner decided **Option 3 hybrid**:

```text
docs/harness-feedback/
  verdicts/<verdict-id>.md
  bundles/<verdict-id>/
    snapshot.json
    attribution.json
    provenance.json
  snapshots/      # raw runtime generated, gitignored
  attributions/   # raw runtime generated, gitignored
```

Hard properties:

1. Bundle is the evidence SOT for `snapshot:` / `attribution:` refs. Verdict docs must point to bundle refs, not raw runtime paths.
2. Bundle is a sanitized subset: only fields / findings actually cited by the verdict are committed.
3. Bundle is re-derivable: `provenance.json` records raw input path, content hash, generatedAt, generator commit / version, and sanitize rules version.
4. Bundle and verdict are same-commit artifacts with a 1:1 `verdict-id` binding enforced by invariant tests.

Ref SOT classification:

| Ref 类型 | SOT |
|---|---|
| `snapshot:` / `attribution:` | committed `bundles/<verdict-id>/` |
| `trace:` | F153 trace store |
| `thread:` / `message:` | runtime DB |
| `pr:` / `commit:` | git / GitHub |

This is not a parser detail. It is the same evidence-integrity issue that blocked the E-pilot demo from pretending fixture data was live.

## Finish Line

One live verdict document exists under `docs/harness-feedback/verdicts/` with a matching `docs/harness-feedback/bundles/<verdict-id>/` bundle derived from the latest available `eval:a2a` snapshot / attribution pair, and tests prove:

- live verdict `snapshot:` / `attribution:` refs resolve to the committed bundle;
- bundle provenance can identify the raw runtime inputs and hashes;
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

### VerdictEvidenceBundle

```ts
interface VerdictEvidenceBundle {
  verdictId: string;
  bundleDir: string;
  snapshotPath: `${string}/snapshot.json`;
  attributionPath: `${string}/attribution.json`;
  provenancePath: `${string}/provenance.json`;
  snapshotRef: `snapshot:bundle/${string}/snapshot`;
  attributionRefs: `attribution:bundle/${string}/${string}`[];
  snapshot: A2aSnapshotSubset;
  attributionReport: AttributionReportSubset;
  provenance: {
    rawInputs: Array<{ path: string; sha256: string }>;
    generatedAt: string;
    generator: { name: string; version: string; commit?: string };
    sanitizeRulesVersion: string;
  };
}
```

### ResolvedHarnessEvalArtifacts

```ts
interface ResolvedHarnessEvalArtifacts {
  bundle: VerdictEvidenceBundle;
  snapshotRef: `snapshot:bundle/${string}/snapshot`;
  attributionRefs: `attribution:bundle/${string}/${string}`[];
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
    bundleDir: string;
    snapshotRef: string;
    attributionRefs: string[];
  };
  isLive: true;
}
```

---

## Task 1: Bundle Artifact Resolver for Live Verdict Evidence

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-a2a-artifact-resolver.ts`
- Test: `packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js`

**Step 1: Write failing resolver tests**

Tests:
- loads `bundles/<verdict-id>/snapshot.json`, `attribution.json`, and `provenance.json`.
- maps bundle snapshot / attribution subset fields to the existing adapter shape.
- resolves canonical refs `snapshot:bundle/<verdict-id>/snapshot` and `attribution:bundle/<verdict-id>/<finding-id>`.
- rejects refs that point to raw `snapshots/` / `attributions/` paths.
- rejects bundle / verdict id mismatch.
- rejects attribution evidence anchors that do not match any bundled snapshot component.
- rejects provenance missing raw input hashes or sanitize rules version.

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js
```

Expected: FAIL because resolver does not exist.

**Step 2: Implement bundle resolver**

Use plain JSON reads and Zod validation. Keep resolving narrow to F192 bundle refs; do not create a generic evidence URI framework.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js
git commit -m "feat(F192): resolve live eval:a2a evidence bundles [砚砚/GPT-5.5🐾]"
```

---

## Task 2: Live Verdict + Bundle Generator

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-a2a-live-verdict.ts`
- Test: `packages/api/test/harness-eval/eval-a2a-live-verdict.test.js`
- Create: `docs/harness-feedback/verdicts/2026-05-23-eval-a2a-live-verdict.md`
- Create: `docs/harness-feedback/bundles/2026-05-23-eval-a2a-live-verdict/{snapshot.json,attribution.json,provenance.json}`

**Step 1: Write failing generator tests**

Tests:
- builds a `VerdictHandoffPacket` from a committed bundle derived from a real raw snapshot / attribution pair.
- writes the sanitized bundle subset and provenance alongside the verdict.
- writes markdown with YAML frontmatter `feedback_type: live-verdict`, `domain_id: eval:a2a`, `packet_id`, and `source_snapshot`.
- uses bundle refs (`snapshot:bundle/...`, `attribution:bundle/...`) in the packet / markdown.
- includes a clear "Live Verdict" banner, not "Contract Demo Fixture".
- does not send or simulate a cross-thread message.

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-live-verdict.test.js
```

Expected: FAIL because generator does not exist.

**Step 2: Implement generator**

Read raw runtime snapshot / attribution paths only as generator inputs, sanitize them into `bundles/<verdict-id>/`, then call the existing `buildA2aVerdictHandoff()` through the bundle resolver. The markdown body should summarize:

- phenomenon;
- verdict;
- evidence refs;
- owner ask;
- acceptance / re-eval plan;
- counterarguments.

**Step 3: Dogfood on current artifacts**

Generate the first live verdict from:

```text
docs/harness-feedback/snapshots/2026-05-23-F167-eval.yaml
docs/harness-feedback/attributions/2026-05-23-F167-attribution.yaml
```

Do not cite those raw paths from the verdict. The generator must commit only the sanitized bundle + verdict. Do not auto-post to F167 owner. This slice creates an auditable artifact only.

Actual dogfood run used runtime API `http://localhost:3002` and generated the 2026-05-23 raw pair locally (ignored), then committed:

```text
docs/harness-feedback/verdicts/2026-05-23-eval-a2a-live-verdict.md
docs/harness-feedback/bundles/2026-05-23-eval-a2a-live-verdict/
```

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
- every live verdict has a same-id `docs/harness-feedback/bundles/<verdict-id>/` directory.
- every live verdict `snapshot:*` ref resolves to `bundles/<verdict-id>/snapshot.json`.
- every live verdict `attribution:*` ref resolves to a finding id or no-finding record in `bundles/<verdict-id>/attribution.json`.
- no live verdict cites raw `docs/harness-feedback/snapshots/` or `docs/harness-feedback/attributions/` paths.
- bundle `provenance.json` includes raw input hashes and sanitize rules version.
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
2026-05-23 | E-pilot live verdict slice — first live `eval:a2a` `keep_observe` verdict generated from runtime F167 telemetry with committed sanitized evidence bundle
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
