---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F245
thread_ids: [thread_mqjnm2ymjj17f1md, thread_mqg1ek0wfttbxt4l]
session_ids: []
cats: [codex, gpt52, opus-47, opus-48, opus]
primary_failure_class: harness_misfit
status: accepted
created: 2026-06-23
---

# Feature Fit Review — F245 Friction Signal Eval

## Trigger

F245 is itself a harness-eval feature close. It consolidated four friction channels that were previously scattered: `[爪感差]` text markers, task-outcome cancel signals, F222 confirmed user feedback, and existing eval-domain `frictionCounts`.

The close also exposed one harness-fit failure: F245 and F236 both needed new eval domains, but early F245 Phase C work shipped a hard enum-bump before the cross-thread Y-lite registration decision reached the implementation plan.

## Review

```yaml
feature_fit_review:
  feature_id: F245
  trigger: "Harness feature close + cross-feature eval-domain registration collision"
  cvo_signal: >
    CVO wanted a periodic, human-readable view of friction across channels,
    without making the user manually inspect tool/runtime details or raw thread
    messages.
  primary_failure_class: harness_misfit
  cat_translation: >
    The harness needed a read-model/eval layer, not a second canonical signal
    store. F245 should aggregate and classify friction while preserving the
    source-of-truth ownership of task-outcome, F222, and each eval domain.
  harness_path_taken:
    - "Phase A: paw-feel marker collector for dead text signals"
    - "Phase B: read-only 4-channel adapters + FrictionSignal intermediate type"
    - "Phase C: eval:friction domain, rollup report, Y-lite registration, every-3d cadence"
    - "Phase D: actionability split, followupDraft payload, Eval Hub friction sections"
  evidence:
    - "PR #2422: Phase A PawFeelAdapter"
    - "PR #2443: Phase B adapters + aggregator + clusterer"
    - "PR #2458/#2469: Phase C eval:friction producer + live sink"
    - "PR #2476: shared Y-lite eval-domain registration migration"
    - "PR #2483: N-day cadence + Redis last-run gate"
    - "PR #2504: Phase D actionability contract + Eval Hub view"
    - "docs/features/F245-friction-signal-eval.md: Close Gate Report"
  corrective_action:
    - "Keep F245 as read-only rollup/read-model; do not write back into canonical signal stores"
    - "Use Y-lite registered string + YAML registry validation for future eval domains"
    - "Keep actionability explicit: ①②③ actionable_candidate, ④ reference_only"
    - "Route repairs through eval-cat judgment + F128 propose_thread, never automatic thread creation"
```

## Lessons For Harness

- **Read-model beats ownership grab**: the clean boundary was not "move all signals into one store"; it was "read the canonical stores and publish a bounded rollup." That kept task-outcome, F222, and each eval domain responsible for their own lifecycle.
- **Cross-thread decisions need canonical propagation**: the Y-lite decision was sound, but it lived in an F236 thread while F245 Phase C was implemented elsewhere. The fix was the PR #2476 migration plus a clear feature-doc correction, not another enum patch.
- **Context control must happen before eval-cat invocation**: Top-N, tail folding, and a token cap are part of the product contract. Feeding raw signals to an eval cat would reproduce the original "too scattered to inspect" problem inside the model context.
- **Actionability is a user-safety boundary**: F245 can draft a repair thread, but it must not auto-create one. The eval cat decides whether a cluster deserves action; the user and normal merge/review gates remain in control.

## Suggested Harness Updates

- Treat future eval-domain registration as data registration plus explicit adapter wiring. A new domain should not require central enum fan-out unless a consuming contract genuinely changes.
- Add a close-gate check for cross-feature shared contracts: if two active features touch the same registry/packet contract, document the shared pattern in the owning feature doc before parallel implementation proceeds.
- Keep F245's own sunset signal active: if friction rollups produce repeated reference-only noise or low acted-on rate, tune the rollup rather than asking CVO to read more raw evidence.
