---
title: Community Reconciliation v0.7.0
date: 2026-04-12
sync_pr: clowder-ai#453
source_range: b07d6705..966d3cf7f
---

# Community Reconciliation: v0.7.0

## Synced Content

### Bug Fixes (P1/P2)
- fix(release): reconciliation issue closure is now a hard gate before release tagging
- fix(windows): `pnpm start` routes through the cross-platform entry point
- fix(windows): Redis bootstrap cancellation no longer falls back to memory storage
- fix(chat): preserve bottom anchor when bottom chrome grows
- fix(chat): keep CLI payload when same-id hydration replaces a message
- fix(sync/setup): restore private-network guidance in `.env.example` / `SETUP`
- fix(runtime catalog): authoritative source stamping + account/catalog resolution cleanup

### Features
- feat(F118): CLI liveness watchdog Phase D1 + D2
- feat(F153): Observability Infrastructure baseline intake
- feat(F159): CatAgent Native Provider kickoff docs + capability groundwork

## Community Issue Review

Reviewed all 22 open bugs plus the selected open feature issue directly touched by this release. 3 issues closed:

| Issue | Title | Verdict | Reason |
|-------|-------|---------|--------|
| **#421** | **fix(windows): `pnpm start` fails — bypasses cross-platform entry point** | **closed** | **`v0.7.0` includes the cross-platform `start-entry.mjs` routing fix from clowder-ai#422.** |
| **#440** | **Bug: [Windows] 发送消息后最新消息被输入框遮挡** | **closed** | **`v0.7.0` includes the chat bottom-anchor/layout hardening and regression coverage that keeps the latest message visible above the input bar.** |
| **#433** | **feat: user-visible system message when inline @mention is not routed** | **closed** | **`v0.7.0` ships the requested user-visible inline-mention routing hint instead of silently dropping the chain.** |
| #424 | Bug: 初始化治理无响应 | keep open | Governance init path; not addressed by this sync |
| #386 | Bug: user-level and project-level skill mounts can drift and conflict | keep open | `v0.7.0` improves skill-mount health detection, but does not yet enforce a single canonical mount layer |
| #431 | fix(connector): safeResolve path traversal guard fails on Windows | keep open | Open PR #432 not part of this release |
| #414 | Workspace panel empty on Windows: repoRoot path validation rejects Windows absolute paths | keep open | No repoRoot path validation fix in this sync |
| #449 | feat(F153): Phase B — OpenTelemetry end-to-end tracing | keep open | `v0.7.0` ships the baseline observability intake, not Phase B |
| #451 | docs(F159): Amend ADR-001 for opt-in native provider path | keep open | Open PR #452 not part of this release |

Other open bugs (#338, #310, #300, #289, #263, #260, #236, #234, #200, #181, #169, #137, #133, #131, #95, #94, #74, #63) reviewed — none addressed by `v0.7.0` content.

## Actions Taken

- Closed #421 with release reconciliation comment
- Closed #440 with release reconciliation comment
- Closed #433 with release reconciliation comment

## Release Provenance

- Sync PR: `clowder-ai#453`
- Sync merge commit: `ea19aa905323e49d1e19f70ce86aa1ea7da1f56b`
- Source snapshot tag: `clowder-v0.7.0-source`
- Source commit: `966d3cf7fb3bf77ec557ae32813f04100f102904`
- Sync tag: `sync/2026-04-12-073328`
- Release tag: `v0.7.0` → `ea19aa905323e49d1e19f70ce86aa1ea7da1f56b`
