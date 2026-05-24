---
feature_ids: [F192, F200, F188]
topics: [harness-eval, eval-memory, scheduled-task-migration]
doc_kind: harness-feedback
created: 2026-05-24
---

# Eval Memory Legacy Task Dry Run

## Domain

- Domain: `eval:memory`
- Legacy scheduled task ids: `memory-recall-digest`
- New runtime: F192 Phase E-scale eval-cat invocation (unified eval runtime with `eval:memory` adapter)
- Source adapter: `f200-f188-memory-eval`

## Inventory

### Discovered tasks

| Task ID | Source | Trigger | Status | Domain overlap |
|---------|--------|---------|--------|----------------|
| `memory-recall-digest` | F200 memory recall eval | `cron: 0 6 * * 1` (weekly Monday 06:00) | enabled | `eval:memory` — recall metrics analysis |

### Tasks NOT found (searched but confirmed absent)

| Expected ID | Reason for search | Result |
|-------------|-------------------|--------|
| `f188-health-repair-reminder` | F188 library health governance has repair/dry-run/apply surface | No standalone scheduled task registered. F188 health checks run on-demand via `/api/f163/health-report` endpoint, not via scheduled task. |
| `library-stewardship-digest` | F188 library stewardship feature | No scheduled task found. F188 health is computed on-demand per request. |

**Conclusion**: Only `memory-recall-digest` needs migration attention. F188 has no legacy scheduled tasks to clean up.

## Dry Run Verdict

`memory-recall-digest` must be redirected or disabled when `eval:memory` is enabled in the unified eval runtime. Retaining both as enabled creates a double-trigger risk: two weekly reports can ask the eval cat to analyze the same memory recall data through different paths.

### Safety analysis (per `dryRunLegacyTaskCleanup` logic)

| Scenario | Action | `safeToApply` | Risks |
|----------|--------|---------------|-------|
| New runtime enabled, legacy enabled | `redirect` | true | None (redirect disables old, enables new) |
| New runtime enabled, propose `retain` | `none` | **false** | Double trigger: both old and new runtimes fire |
| New runtime disabled, legacy enabled | `redirect` | **false** | New eval runtime is disabled; redirect would leave no active evaluator |
| New runtime disabled, legacy disabled | `none` | **false** | No active evaluator for memory domain |

## Intended Action

1. Inventory complete (above).
2. Dry-run migration recorded with rollback data.
3. When `eval:memory` runtime is activated: redirect `memory-recall-digest` to the unified runtime, or disable it.
4. Re-run dry-run and verify `safeToApply=true` before any apply step.

## Rollback

Restore the previous task enabled state and trigger definition from the dry-run rollback record (saved per `dryRunLegacyTaskCleanup` output).

## Test Coverage

- `packages/api/test/harness-eval/legacy-task-cleanup.test.js`: 5 tests covering `eval:memory` domain (inventory detection, redirect proposal, double-trigger detection, no-active-evaluator detection, disabled-runtime safety).
