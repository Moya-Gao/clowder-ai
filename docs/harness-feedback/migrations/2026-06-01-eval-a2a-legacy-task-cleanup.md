---
feature_ids: [F192]
topics: [harness-eval, eval-a2a, scheduled-task-migration, legacy-cleanup]
doc_kind: harness-feedback
created: 2026-06-01
---

# Eval A2A Legacy Task Cleanup — 2026-06-01

## Context

F192 Phase E eval-domain-daily has been running `eval:a2a` successfully since 2026-05-28
(verified via run ledger: RUN_DELIVERED on 5/28, 5/29, 5/30, 5/31, 6/1). Four legacy
F192 dynamic tasks were still enabled and firing in parallel, creating duplicate
snapshot/attribution work. They were registered as `template_id=reminder` (not
`harness-fit-digest`), so `inventoryLegacyTasks()` never matched them — the
`legacyCleanup.status` in verdict packets falsely reported `disabled`.

Cleanup rationale: **dedup/noise reduction**, not unblocking (eval:a2a was not blocked).

## Removed Tasks (4)

### Task 1: F192 Daily Eval Snapshot (duplicate A)
- id: `dyn-1778476002956-mfvbbs`
- template_id: `reminder`
- enabled: `true`
- trigger: cron `0 11 * * *` (UTC, = 04:00 PDT)
- label: "F192 Daily Eval Snapshot"
- description: "F192 Daily Eval: Run `node scripts/run-f167-eval.mjs --store --cookie $EVAL_SESSION_COOKIE` to capture today's F167 harness eval snapshot to docs/harness-feedback/snapshots/. Dedup is built-in (skips if today's file already exists)."
- delivery_thread_id: thread_motijq80q62n5wku (this F192 eval thread)

### Task 2: F192 Monthly Harness-Fit Digest (duplicate A)
- id: `dyn-1778476004262-r33yh3`
- template_id: `reminder`
- enabled: `true`
- trigger: cron `0 12 1 * *` (UTC, = 05:00 PDT on 1st of month)
- label: "F192 Monthly Harness-Fit Digest"
- description: "F192 Monthly Digest (harness-fit-digest): Run `node scripts/run-f167-eval.mjs --digest` to aggregate this month's daily snapshots into a monthly digest at docs/harness-feedback/digests/."
- delivery_thread_id: thread_motijq80q62n5wku

### Task 3: F192 Daily Eval Snapshot (duplicate B)
- id: `dyn-1778472180809-j6eg8w`
- template_id: `reminder`
- enabled: `true`
- trigger: cron `0 17 * * *` (UTC, = 10:00 PDT)
- label: "F192 Daily Eval Snapshot"
- description: "F192 Daily Eval: run `node scripts/run-f167-eval.mjs --store` to capture today's F167 eval snapshot. Requires session cookie from runtime."
- delivery_thread_id: thread_motijq80q62n5wku

### Task 4: F192 Monthly Harness-Fit Digest (duplicate B)
- id: `dyn-1778472182437-y3jbu9`
- template_id: `reminder`
- enabled: `true`
- trigger: cron `0 12 1 * *` (UTC)
- label: "F192 Monthly Harness-Fit Digest"
- description: same as Task 2
- delivery_thread_id: thread_motijq80q62n5wku

## Deletion Details

- Deleted by: [宪宪/Opus-47🐾]
- Deleted at: 2026-06-01T14:19Z (approx)
- Method: `cat_cafe_remove_scheduled_task` MCP tool, 4 parallel calls
- Commit: `465e46ec8` (docs/harness-feedback/eval-domains/eval-a2a.yaml update)
- Verification: `GET /api/schedule/tasks` confirmed 0 remaining F192 dynamic tasks

## Post-Deletion Verification

- `eval-domain-daily` still enabled and running (`eval:a2a` + `eval:memory`) ✅
- `eval-domain-weekly` still enabled (`eval:sop`) ✅
- `thread_eval_a2a` contains 6/1 fix verdict for C2 friction — system-level eval unaffected ✅
- No double-trigger risk remaining ✅

## Rollback Instructions

If any of these tasks need to be restored, recreate via `cat_cafe_register_scheduled_task`:

```json
{
  "templateId": "reminder",
  "trigger": { "type": "cron", "expression": "0 11 * * *", "timezone": "UTC" },
  "params": {
    "message": "F192 Daily Eval: Run `node scripts/run-f167-eval.mjs --store --cookie $EVAL_SESSION_COOKIE`..."
  },
  "deliveryThreadId": "thread_motijq80q62n5wku"
}
```

Note: rollback is NOT recommended — eval-domain-daily fully covers this functionality
with verdict handoff, trend analysis, and re-eval closure that the legacy tasks lacked.

## Known Gap (P3)

`inventoryLegacyTasks()` in `legacy-task-cleanup.ts` only matches by `task.id` or
`task.templateId` against `legacyScheduledTaskIds`. Tasks registered as
`template_id=reminder` with a descriptive label are invisible to inventory. This caused
`legacyCleanup.status: disabled` to be reported in verdict packets while the tasks were
still enabled and firing. No remaining legacy tasks to trigger this gap, but the code
should be hardened if new legacy tasks are ever registered.
