---
title: Community Reconciliation v0.9.0
date: 2026-04-27
sync_pr: clowder-ai#596
source_commit: 8f1f1fd95d345602136d5737f3836c2c3da5959f
target_commit: 93f08ada5f0a0ea26c52182b50cead3b9b4cbe92
---

# Community Reconciliation: v0.9.0

## Synced Content

### Bug Fixes

- fix(telegram): validate BotFather token shape and keep startup alive when Telegram is misconfigured.
- fix(telegram): recover from `getUpdates` 409 polling conflicts with bounded backoff instead of crashing the runtime.
- fix(stream): request stream catch-up after invocation timeout so persisted messages can be recovered by the frontend.
- fix(public-sync): align public runtime ports, public review-start guardrails, and Node 20 test loader coverage discovered during the sync PR.

### Features / Updates

- feat(F171): First-Run Quest onboarding and empty-bootstrap setup flow.
- feat(F172): generated image publication support.
- feat(F173): frontend message pipeline and thread-runtime ledger updates.
- feat(F174/F178): callback auth lifecycle and persistent MCP agent-key auth plumbing.
- feat(F168): community ops board and guardian/sign-off workflow updates.
- docs: refresh public feature index, README/setup docs, roadmap, public lessons, and governance docs.

## Community Issue Review

| Issue | Scope | Verdict | Evidence / action |
|---|---|---|---|
| clowder-ai#541 | Telegram polling 409 crashes runtime | closed | Fixed by PR #596; closed with release comment after merge. |
| clowder-ai#582 | Telegram startup/deleteWebhook invalid token crashes Windows launcher | closed | Fixed by PR #596; closed with release comment after merge. |
| clowder-ai#524 | Telegram streaming placeholder duplicate messages | open | Reviewed during reconciliation; not fixed by this release payload. |
| clowder-ai#595 | queued user messages never dequeue | open | Reviewed during reconciliation; not fixed by this release payload. |

## Actions Taken

- Verified sync PR `clowder-ai#596` merged after CI passed:
  - `Directory Size Guard`
  - `Lint`
  - `Build`
  - `Test (Public)`
  - `Test (Windows)`
- Verified cloud Codex review returned clean on the release PR.
- Published sync baseline tag:
  - `sync/2026-04-27-141820`
- Closed release-covered community issues:
  - clowder-ai#541
  - clowder-ai#582

## Release Provenance

- Sync PR: `clowder-ai#596`
- Sync merge commit: `93f08ada5f0a0ea26c52182b50cead3b9b4cbe92`
- Source snapshot tag: `clowder-v0.9.0-source`
- Source commit: `8f1f1fd95d345602136d5737f3836c2c3da5959f`
- Sync tag: `sync/2026-04-27-141820`
- Release tag: `v0.9.0` -> `93f08ada5f0a0ea26c52182b50cead3b9b4cbe92`

## Follow-Up Back Home

The public sync PR exposed source-owned sync sanitizer gaps. These should be merged back into `cat-cafe` after the release:

- keep public `api-client` tests aligned with the 3003/3004 port convention;
- run sanitizer rules over `.cjs` test files;
- transform `review-start` reserved runtime ports and matching public tests;
- remove public `desktop:*` scripts when `desktop/` is not synced;
- make `install-git-guards.sh` tolerate public repos without `.githooks/`;
- load `tsx/esm` in `orphan-chrome-cleaner.test.js` for Node 20 public CI.

