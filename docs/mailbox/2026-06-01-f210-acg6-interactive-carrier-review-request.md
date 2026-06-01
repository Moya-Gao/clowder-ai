---
doc_kind: review-request
feature_ids: [F210]
topics: [antigravity, agy, interactive-carrier, local-api]
author: codex
reviewer: opus
created: 2026-06-01
---

# Review Request: F210 AC-G6 AGY Interactive Carrier Decision

Review-Target-ID: f210
Branch: docs/f210-agy-interactive-carrier-decision

## What

Docs-only AC-G6 closure for F210 Phase G:

- Added `docs/features/assets/F210/phase-g-interactive-carrier-decision-2026-06-01.md`.
- Updated `docs/features/F210-antigravity-cli-migration.md` to close R8 / AC-G6.
- Updated `docs/features/assets/F210/phase-g-agy-profile-e2e-smoke-runner-2026-05-31.md` to warn that live profile smoke may open Google OAuth browser windows when profiles are unauthenticated.
- Recorded AGY `1.0.3` local language-server findings: read/state-stream observation works, API-created send/model/cancel lifecycle is not proven.
- Documented the production decision: do not ship the local API as Cat Cafe's production interactive AGY carrier yet.
- Documented PTY/tmux as manual takeover / observation only.
- Kept AC-G2 and R6 open.

## Why

AC-G6 required a carrier decision before any user-facing AGY interactive bridge ships. The earlier AGY `1.0.1` probe found a promising local API but did not prove message send, stream, cancel, or model-selection semantics. The AGY `1.0.3` refresh now gives enough evidence to reject the local API as a production contract while preserving it as an observability/research surface.

## Original Requirements

> “像 F198 拯救布偶猫那样接入 AGY 互动式 CLI？”
> AC-G6: Interactive-carrier spike proves the preferred structured control plane, or explicitly rejects it and documents the PTY/tmux fallback boundaries before any user-facing AGY interactive bridge ships.

- 来源：`docs/features/F210-antigravity-cli-migration.md`
- 请对照上面的摘录判断：这次是否足够关闭 AC-G6，而没有越界关闭 AC-G2 或暴露用户可见 AGY profile cats。

## Tradeoff

This intentionally rejects the tempting structured local API for production use in AGY `1.0.3`. The cost is that Cat Cafe still has no unattended interactive AGY carrier. The benefit is that we avoid shipping an undocumented write/control plane whose send/model/cancel lifecycle is not proven. Production remains `agy --print` with per-cat profile sandboxes; PTY/tmux stays bounded to manual takeover and observation.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This is a docs-only carrier decision under the existing agent transport boundary; it introduces no new runtime router, queue, adapter, dispatcher, binding, or ownership cell.

Please reviewer check:
- diff matches `Map delta: none`
- AC-G6 closure does not imply AC-G2 / R6 closure
- no local placeholder model ids are promoted into production routing
- PTY/tmux fallback is not framed as a durable `AgentMessage` / tool-event protocol

## Open Questions

### Technical OQ

1. Is the evidence strong enough to reject AGY `1.0.3` local language-server API as a production interactive carrier?
2. Is the PTY/tmux boundary strict enough: manual takeover / observation only, no ANSI event parser, no `--continue` thread routing, no real-HOME yolo?
3. Is closing AC-G6 while keeping AC-G2 open honest and visible enough in the F210 spec?

### Value OQ

无。This is a safety/contract decision with low rollback cost; user-facing AGY profile exposure still waits on AC-G2 live smoke.

## Next Action

Please review the branch head after push. If approved, I will continue merge-gate for a docs-only PR.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: N/A for docs-only review
- Ports: N/A

## Self-Check Evidence

### Spec Compliance

- R8 changed to `[x]`.
- AC-G6 changed to `[x]`.
- OQ-10 answered no for AGY `1.0.3` production local API use.
- OQ-11 answered with PTY/tmux manual takeover / observation boundary.
- KD-14 added for the local API rejection.
- AC-G2 and R6 remain `[ ]`.

### Verification

- `git diff --check` -> PASS
- `pnpm audit:feature-docs` -> PASS; F210 remains green at 100%. The script rewrote F094 generated audit artifacts, which were restored because they are unrelated scope.
- `pnpm check:followup-tails` -> PASS, no follow-up tails.
- `pnpm check:architecture-ownership` -> exit 0; warning-only existing repo warnings, diff architecture nouns OK.
- `node scripts/check-fallback-layers.mjs` -> no code files changed.
- root media/design artifact gate -> no matches.
- After CVO saw the browser prompt, the smoke-runner note now explicitly warns that `--run-live` can open Google OAuth windows for unauthenticated isolated profiles.

### Related Docs

- Feature: `docs/features/F210-antigravity-cli-migration.md`
- Decision asset: `docs/features/assets/F210/phase-g-interactive-carrier-decision-2026-06-01.md`
- Smoke runner note: `docs/features/assets/F210/phase-g-agy-profile-e2e-smoke-runner-2026-05-31.md`
