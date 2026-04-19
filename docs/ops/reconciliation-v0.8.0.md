---
title: Community Reconciliation v0.8.0
date: 2026-04-19
sync_pr: clowder-ai#538
source_range: ea19aa90..7fb0c42f
---

# Community Reconciliation: v0.8.0

## Synced Content

### Bug Fixes
- fix(public-tests): public contract tests now resolve compiled `dist/*.js` under Node 20 instead of importing `src/*.ts`
- fix(sync): temp-target install strips inherited production env so devDependencies are present during public gate validation
- fix(api): `packages/api` build copies marketplace catalog JSON via a cross-platform Node.js script instead of Unix-only `mkdir -p` / `cp`
- fix(F061): preserve thinking/tool-result tails and recoverable stream-error buffers across Antigravity failures
- fix(F167): tighten ball-ownership / exit-check governance so handoff ambiguity no longer silently stalls chains
- fix(web/startup): absorb already-merged community fixes from clowder-ai#527, #528, and #529

### Features
- feat(F168): Community Operations Board Phase A-C (triage orchestration, dispatch controls, repository/time-range filters, Workspace integration)
- feat(F146): capability marketplace groundwork, including curated catalog loaders and install governance surfaces
- feat(F163): memory entropy reduction / authority-backfill groundwork carried into the public snapshot

## Community Issue Review

Reviewed the release-intended sync payload and the already-merged community PRs included in this snapshot.

- **No additional GitHub issues are declared closed in this release gate.**
- Community fixes already merged upstream and included in this release snapshot:
  - clowder-ai#527 — env-prefixed API launch routing
  - clowder-ai#528 — opensource profile TTL hardening
  - clowder-ai#529 — per-slot cancel + active cat display correction
- Therefore this reconciliation report performs **zero new issue-close actions** at release time; `publish-release-tag.sh` validated it without issue-state checks.

## Actions Taken

- Verified sync PR `clowder-ai#538` merged after CI passed:
  - `Directory Size Guard`
  - `Lint`
  - `Build`
  - `Test (Public)`
  - `Test (Windows)`
- Rebuilt source snapshot provenance with:
  - source snapshot tag: `clowder-v0.8.0-source`
  - source commit: `7fb0c42f42bff01a1abc983015d9e83fde0e83db`
- Published sync baseline tag:
  - `sync/2026-04-19-145655`

## Release Provenance

- Sync PR: `clowder-ai#538`
- Sync merge commit: `3c0350e734c6b3ae31b0284fb03aa7d365845238`
- Source snapshot tag: `clowder-v0.8.0-source`
- Source commit: `7fb0c42f42bff01a1abc983015d9e83fde0e83db`
- Sync tag: `sync/2026-04-19-145655`
- Release tag: `v0.8.0` → `3c0350e734c6b3ae31b0284fb03aa7d365845238`
