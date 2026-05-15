---
capsule_id: "F199-2026-05-15"
context: "F190 Phase D+E settings parity backfill (final)"
feature_ids: [F199, F190]
doc_kind: capsule
created: 2026-05-14
updated: 2026-05-15
---

## What Worked

- Splitting D-3 into backend hardening and MCP UI parity prevented a real unsafe rollout path: the audit/raw-secret and owner-gate gaps were fixed before exposing the richer UI.
- Per-slice User Visibility Disclosure forced each technical boundary into user-visible language, which made `InstallPreviewModal` and Skills write actions explicit instead of silently missing.
- Combining D-4 and D-5 into one PR preserved quality while reducing duplicate merge-gate overhead because both surfaces reused the same secret-write hardening pattern.
- Cloud review caught real P1/P2 issues in PR #1668: live push service `null` preservation, VAPID subject validation, config reachability under service-load failure, and loopback restriction for VAPID generation.
- Phase E: CVO-directed "opus codes, codex reviews" was significantly faster than the previous codex-codes-then-cloud-review loop. Two PRs (#1673 backend, #1677 UI) merged in one session.
- Phase E: `resolveSessionUserId` (session-only auth) for skills write routes was the right boundary — cleaner than importing cross-module helpers and matches the pattern in services-lifecycle-helpers.ts.
- Phase E: Managed-skill destructive guard (fail-closed on missing `skills-state.json`) prevents uninstalling user-owned skills that Cat Cafe doesn't manage.
- Phase E: Adding `install` to unhealthy service actions (alongside start/uninstall) solves fresh-machine UX where `defaultEndpoint` exists but service isn't installed.

## What Failed

- F199 was created as a new feature anchor without explicit CVO signoff. CVO later chose to keep F199, but the anchor decision itself should not have been inferred from a design memo.
- F190 close originally treated red-zone zero-touch and AC completion as enough. It missed functional parity: users still saw settings surfaces that were read-only or absent.
- The D-2 proof kept a stale phrase saying external skill uninstall would be a later F199 slice. Close gate caught and corrected it to the final boundary: outside F199.
- Phase E: `pnpm gate` build step fails due to pre-existing TS7016 errors (missing `@types/` for `better-sqlite3`, `web-push`, `ws`, `http-proxy`, `nodemailer`). These exist on main and don't block dist emission, but gate script doesn't distinguish exit code 2 from real failures.

## Trigger Missed

- Feature-anchor changes need explicit CVO wording before docs are written, especially when a "Phase D" can naturally mean "inside the parent feature".
- Inbound parity work must run component-list diff and User Visibility Disclosure before close, not only after CVO pushback.
- Reviewer tracing for write paths must include audit/log exits; the D-3a P0 came from following the route chain beyond the obvious write helpers.
- Phase E: The TS7016 gate failure should be tracked as a separate issue — it affects all PRs, not just F199.

## Doc Links

- `docs/features/F199-console-parity-backfill.md`
- `docs/discussions/2026-05-13-f190-phase-d-parity-audit/README.md`
- `docs/discussions/2026-05-14-f199-close-gate/README.md`
- `docs/discussions/2026-05-14-f199-close-gate/close-gate-report.md`
- `docs/discussions/2026-05-14-f199-phase-e-service-skills-write-design/README.md`
- `docs/reflections/2026-05-13-f190-console-settings-intake-capsule.md`

## Rule Update Target

- Already covered by the F190/F199 process updates: `feat-lifecycle` Step 0.3.5 User Visibility Disclosure and `shared-rules.md` rule 7 requiring inbound intake visual/functional parity checks.
- No new rule patch required from this capsule; enforce the existing feature-anchor signoff lesson on the next feature split/reopen decision.
