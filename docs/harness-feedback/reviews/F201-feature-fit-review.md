---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F201
thread_ids: []
session_ids: []
cats: [codex, opus-47]
primary_failure_class: environment_drift
status: candidate
created: 2026-05-19
---

# Feature Fit Review — F201 Antigravity Reliability Contract

## Trigger

F201 reached AC-G8 alpha smoke after the liveness/supervisor/controlled-YOLO work merged, but alpha still returned HTTP 500. The visible error pointed at CSS loader behavior, yet the real root cause was environment drift: the shell had `NODE_ENV=production`, and `scripts/start-dev.sh` did not override it for the frontend `next dev` path.

## Review

```yaml
feature_fit_review:
  feature_id: F201
  trigger: "AC-G8 alpha 500 under NODE_ENV=production shell"
  cvo_signal: "长任务不可用 = F201 未完成; 不接受只剩 STOP_REASON_CLIENT_STREAM_ERROR"
  primary_failure_class: environment_drift
  cat_translation: >
    The reliability issue was not only an upstream Antigravity instability.
    Our harness had to own the local environment contract, liveness contract,
    and recovery contract around Antigravity.
  harness_path_taken:
    - "Phase A-E: classify side effects, centralize recovery, surface typed cards"
    - "Phase F: bounded liveness probes, durable supervisor, receipt conflict split, resume tiers, controlled YOLO"
    - "AC-G8 unblock: static-link app CSS that does not need Next processing, then fix the real NODE_ENV contamination"
  evidence:
    - "PR #1749: liveness/supervisor evidence bundle"
    - "PR #1751: controlled YOLO timeout and hard-refusal ordering"
    - "PR #1756/#1760: alpha static CSS unblock chain"
    - "PR #1773: frontend dev path pins NODE_ENV=development; regression test proves ambient production env is overridden"
    - "AC-G8 alpha smoke: NODE_ENV=production shell now returns / 200 and /settings 200; PostCSS loader chain restored"
  corrective_action:
    - "start-dev.sh frontend dev path must pin NODE_ENV=development just like API pins its mode"
    - "alpha smoke should include polluted-shell reproduction when the bug involved inherited environment"
    - "close reports must distinguish defense-in-depth fixes from root-cause fixes"
```

## Lessons For Harness

- **Environment belongs to the harness**: if `pnpm alpha:start` is the blessed acceptance channel, it must normalize the environment it needs. Relying on the caller shell to have a sane `NODE_ENV` is not acceptable.
- **Smoke should replay the failure condition**: the decisive AC-G8 smoke used `NODE_ENV=production` explicitly. A clean shell pass would have missed the original bug class.
- **Loader failures need environment evidence early**: before moving more CSS out of Next, capture the actual child process environment and loader chain. Otherwise we risk turning a one-line environment bug into a sequence of file-specific workarounds.
- **Scope corrections are close-gate artifacts**: AC-B2/C2/C3 changed meaning after Phase F. The close report records those deletions/scope corrections and requires CVO signoff instead of hiding them.

## Suggested Harness Updates

- Add "dump child process env for alpha 500 / CSS loader failures" to alpha-debug SOP.
- Add a close-gate reminder: if an old AC is superseded by a later CVO decision, mark it as `deleted` or `scoped_out` in CloseGateReport with a concrete reason.
- Add a review heuristic for execution-policy PRs: prove safety invariant ordering, not only final error shape.
