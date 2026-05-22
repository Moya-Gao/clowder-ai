---
feature_ids: [F192]
topics: [harness-eval, eval-a2a, scheduled-task-migration]
doc_kind: harness-feedback
created: 2026-05-21
---

# Eval A2A Legacy Task Dry Run

## Domain

- Domain: `eval:a2a`
- Legacy scheduled task ids: `harness-fit-digest`
- New runtime: F192 Phase E-pilot eval-cat invocation packet

## Dry Run Verdict

`harness-fit-digest` must be redirected or disabled when `eval:a2a` is enabled in the unified eval runtime. Retaining both as enabled scheduled tasks creates a double-trigger risk: two daily/monthly reports can ask cats to analyze the same harness drift through different paths.

## Intended Action

1. Inventory legacy dynamic/builtin scheduled task definitions matching `harness-fit-digest`.
2. Dry-run the migration and record rollback data.
3. Redirect the old task to the unified eval runtime, or disable it if redirect is not supported.
4. Re-run dry-run and verify `safeToApply=true` before any apply step.

## Rollback

Restore the previous task enabled state and trigger definition from the dry-run rollback record.
