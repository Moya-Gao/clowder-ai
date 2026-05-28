---
feature_ids: [F141]
topics: [github, repo-inbox, reconciliation, token-usage, scheduler]
doc_kind: bug-report
created: 2026-05-27
---

# Bug Report: F141 reconciliation first-run event flood

## Reporter

Landy reported that the `clowder-ai` repo inbox suddenly delivered many
reconciliation events into the maintainer thread, consuming excessive Codex
tokens.

## Reproduction

1. Enable F141 repo inbox reconciliation for a repo with existing open PRs or
   issues.
2. Start the repo scan task with an empty business-dedup keyspace.
3. Observe that every open non-draft PR and every open issue is emitted as an
   individual `(reconciliation)` message and each message triggers the inbox cat.

Expected: first activation should not replay historical backlog into the active
agent context; recurring scans should not re-notify the same long-open item.

Actual: the first scan treated all current open items as missed events. Existing
items could also reappear after the 7-day business-dedup TTL expired.

## Root Cause

`RepoScanTaskSpec` had no persistent first-activation baseline. With an empty
`ReconciliationDedup` keyspace, every currently open item looked unnotified.
The scheduler's `lastRunAt` is process-local, so it cannot safely represent
"this repo has already been baselined" across runtime restarts.

`ReconciliationDedup` also wrote `f141:notified:*` keys with a 7-day TTL. That
made "already notified" a temporary fact, so still-open issues and PRs could
return as new reconciliation work later.

## Fix

- `ReconciliationDedup` now stores notified markers persistently and migrates
  old TTL-backed markers when they are observed.
- `ReconciliationDedup` also stores a persistent per-repo baseline marker.
- `RepoScanTaskSpec` now baselines existing open items only before that
  persistent repo baseline exists, instead of using process-local scheduler
  state.
- Subsequent reconciliation scans are capped to a small rotating batch per run
  so a webhook outage cannot wake the cat once per backlog item in a single
  tick, and a permanently failing prefix cannot starve later items.

## Verification

- `pnpm --filter @cat-cafe/api build`
- `node --test packages/api/test/repo-scan-task-spec.test.js`
- `node --test packages/api/test/reconciliation-dedup.test.js`
