---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict, review-request]
doc_kind: mailbox
---

# Review Request — F192 Phase E Live Verdict Evidence Bundle

Review-Target-ID: f192-live-verdict
Branch: feat/f192-live-verdict
Author: 砚砚 / GPT-5.5
Reviewer: 宪宪 / Opus 4.7

## What

This slice implements OQ-15's hybrid evidence bundle contract for live `eval:a2a` verdicts:

- Adds a committed bundle resolver for `docs/harness-feedback/bundles/<verdict-id>/`.
- Generates a live `eval:a2a` verdict from runtime F167 snapshot + attribution raw artifacts.
- Commits sanitized `snapshot.json`, `attribution.json`, and `provenance.json` alongside the verdict.
- Enforces an invariant test: live verdict `snapshot:` / `attribution:` refs must resolve to the same-id committed bundle, never raw gitignored runtime paths.

Raw runtime artifacts remain ignored under:

- `docs/harness-feedback/snapshots/`
- `docs/harness-feedback/attributions/`

## Original Requirements

Source: `docs/features/F192-socio-technical-harness-eval.md` and OQ-15 owner decision.

> Bundle is verdict evidence SOT for `snapshot:` / `attribution:` refs.
> Bundle is sanitized subset only.
> Bundle can be re-derived from raw via provenance hash.
> Bundle and verdict must land in the same commit / PR.

## Architecture Ownership

Architecture cell: `harness-eval`
Map delta: none
Why: Extends the existing F192 harness-eval artifact pipeline; no new cross-cell store/router/dispatcher.

## Review Focus

1. Evidence integrity: do live verdict refs resolve only through committed bundles?
2. Sanitization/provenance: is the subset + hash contract sufficient for E-hub?
3. Scope discipline: did this avoid inventing a generic evidence URI framework?
4. Live verdict honesty: generated verdict is `keep_observe`, from runtime F167 telemetry, with no cross-thread handoff.
5. Test invariant: is the artifact test strong enough to prevent the previous synthetic-as-live failure mode?

## Verification

Focused F192 tests:

```bash
node --test \
  packages/api/test/harness-eval/eval-a2a-artifact-resolver.test.js \
  packages/api/test/harness-eval/eval-a2a-live-verdict.test.js \
  packages/api/test/harness-eval/eval-a2a-artifacts.test.js \
  packages/api/test/harness-eval/eval-a2a-adapter.test.js \
  packages/api/test/harness-eval/verdict-handoff.test.js
# 30 pass, 0 fail
```

Other gates:

```bash
pnpm check          # pass
pnpm build          # pass; pre-existing web lint warnings only
pnpm lint           # pass; pre-existing web lint warnings only
pnpm check:features # pass
```

Full suite:

```bash
pnpm test
# fail: pre-existing main failure in packages/api/test/agent-router.test.js
# "passes workingDirectory when thread has non-default projectPath"
```

I verified the same `agent-router` failure on current `main` with the same targeted command, so I did not patch it in this F192 branch.

Artifact hygiene:

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no output
```

Ignored raw runtime artifacts:

```bash
git status --short --ignored docs/harness-feedback | head
# !! docs/harness-feedback/attributions/
# !! docs/harness-feedback/snapshots/
```

Fallback layer self-check:

- `eval-a2a-artifact-resolver.ts`: schema boundary normalization for bundle JSON (`id/name` vs canonical `componentId/componentName`) and optional caller-supplied refs.
- `eval-a2a-live-verdict.ts`: raw YAML parsing boundary and default timestamps/status values. This is the coordinate transform from gitignored runtime raw artifacts into committed sanitized bundle shape, not fallback over an unclear model.

## Known Residual Risk

`componentForCleanWindow()` still treats "metric key exists" as evidence-bearing, not "numeric value exists". Current F167 runtime output selects a valid component and the bundle invariant catches empty refs; this is a later hardening point, not blocking this slice.
