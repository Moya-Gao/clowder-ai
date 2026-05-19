---
feature_ids: [F190, F199, F206]
related_features: [F056]
topics: [console, settings, community, parity-audit, design-assets, service-lifecycle]
doc_kind: audit
created: 2026-05-19
source_pr: clowder-ai#645
---

# PR #645 Console Prototype Parity Audit

## Scope

This audit preserves the original design intent from clowder-ai#645 and separates it from runtime implementation decisions.

Decision boundary:

- Do not restore clowder-ai#645 as a whole PR.
- Restore design assets and source-intent evidence.
- Backfill only verifiable, user-visible functionality after a parity matrix identifies the gap.
- Keep current home invariants: F183/F184/F194 chat red-zone, owner-gated writes, hardened service lifecycle, and sync allowlist boundaries.

## Source Facts

| Item | Finding |
|---|---|
| PR | clowder-ai#645, `feat(F179): Console Architecture Restructure - all phases` |
| State | closed, unmerged |
| Head | `a384b50c9d200b7b27d6a3a90860ce3816d48fe3` |
| File count | 523 files |
| Pencil assets | One large `.pen`: `docs/design/f190-console-layout.pen` |
| Source-intent docs | `docs/design/console-design-system.md`, `docs/features/F179-console-architecture-restructure.md`, `docs/features/F186-service-manifest.md`, `docs/architecture/service-manifest-sop.md` |

## Restored Assets

Public design assets restored to their design location:

| Restored path | Source path in #645 | Purpose |
|---|---|---|
| `docs/design/console-design-system.md` | `docs/design/console-design-system.md` | Console visual grammar: Inset Paper model, no-border layering, spacing/radius/token rules |
| `docs/design/f190-console-layout.pen` | `docs/design/f190-console-layout.pen` | Pencil source for Activity Rail / Console / Settings layout |

Source-intent docs archived as evidence, not canonical feature specs, to avoid reintroducing obsolete `F179` / `F186` anchors as current truth sources:

| Evidence path | Source path in #645 |
|---|---|
| `docs/evidence/pr645-console-prototype/original-F179-console-architecture-restructure.md` | `docs/features/F179-console-architecture-restructure.md` |
| `docs/evidence/pr645-console-prototype/original-F186-service-manifest.md` | `docs/features/F186-service-manifest.md` |
| `docs/evidence/pr645-console-prototype/original-service-manifest-sop.md` | `docs/architecture/service-manifest-sop.md` |

## Parity Matrix

| #645 source intent | Current state | Verdict | Next action |
|---|---|---|---|
| Activity Bar as stable L1 rail | Implemented in current AppShell / ActivityBar; tooltip support already exists | Done / evolved | No action |
| Settings full-page route with left nav | Implemented and later converged through F206 primitives | Done / evolved | No action |
| Settings visual grammar: no-border layering, Inset Paper, radius/spacing rules | Partially encoded in F206 primitives, but original design system doc was missing | Asset gap | Restored design doc; future UI review should cite it |
| Pencil design source | Missing from cat-cafe and public sync | Asset gap | Restored `.pen` under `docs/design/` |
| Settings section coverage | 12 Settings pages migrated/converged in F206 | Done / evolved | No action |
| Signals compact list styling | Restored in F206 Phase C with status/note/study-count preservation | Done / evolved | No action |
| Mission Hub duplicated entry removal | Done in F206 Phase C; Mission Hub visual parity checked separately | Done / evolved | No action |
| Account page storage path and redundant breadcrumb/header cleanup | Done in F206 Phase B | Done / evolved | No action |
| Pending Changes Banner for restart-required settings | Current Settings env page shows restart-required count and per-field labels, but does not yet provide a full "view changes / restart service" workflow | Partial | Treat as follow-up candidate; verify user value before building restart controls |
| Cross-section Settings search | Current Settings nav/search exists, but #645 described global cross-section config search | Partial / likely gap | Add to follow-up matrix if community issue calls it out |
| IM connector config cards + connection state | Current settings have connector configuration and hardening; exact #645 visual/functional parity needs targeted screenshot diff | Needs verification | Audit before any code change |
| MCP install/manage dependency integration | Current MCP writes are hardened; source-style dependency/service install affordances may not be fully equivalent | Needs verification | Audit before any code change |
| Service Manifest read status | Implemented in F190/F199 lineage | Done / evolved | No action |
| Service lifecycle install/start/stop/uninstall UI | UI/backend exist after F199 Phase E, but script truth-source is inconsistent: manifests point to `scripts/services/*`; cat-cafe source does not contain that directory; clowder-ai preserves it as target-owned | Blocking audit gap | Decide whether `scripts/services/` becomes source-owned, or rewrite manifests to existing root scripts |
| Service autostart | #645 had `service-autostart.ts`; current source has lifecycle routes but no direct equivalent file. Need verify if startup behavior was intentionally dropped or reimplemented | Needs verification | Audit before restoring |
| Service Manifest SOP | Original SOP was missing from current docs; archived as source evidence | Asset gap | Convert into current architecture guide only after script truth-source decision |
| Chat rendering / bubble behavior changes | Deliberately excluded by F190 red-zone guard | Do not restore | No action unless a separate F183/F184/F194 owner approves |
| Whole PR #645 diff | Mixed settings, services, chat-adjacent changes, docs, feature numbering, and scripts | Reject whole restore | Only per-row backfill |

## Blocking Finding: Service Script Truth Source

Current cat-cafe source has service lifecycle manifests that point to `scripts/services/*.sh`, and lifecycle routes return `script not found` when those paths do not exist. The directory is absent from cat-cafe source, but present in the public clowder-ai checkout because `sync-manifest.yaml` marks `scripts/services/` as target-owned.

This creates a truth-source split:

- cat-cafe source cannot fully prove service lifecycle behavior from its own files.
- clowder-ai public repo can retain scripts that cat-cafe no longer owns.
- Future sync can preserve the scripts, but cannot validate them as home source-owned implementation.

Resolution options:

1. Make `scripts/services/` source-owned in cat-cafe and export it normally.
2. Rewrite `SERVICE_MANIFESTS` to point to existing root-level scripts and remove target-owned dependency.
3. Deliberately degrade lifecycle actions that lack source-owned scripts, with a user-visible disclosure.

Option 1 is the most direct parity restoration if the scripts are still acceptable after security review.

## Recommended Follow-up Order

1. Design asset recovery: done in this audit commit.
2. Service script truth-source decision: required before claiming full Service lifecycle parity.
3. Targeted visual/functional audit for IM, MCP, and Settings global search only if the incoming community issue names them as missing.
4. Convert the archived #645 Service Manifest SOP into a current architecture guide after the service script truth-source is settled.
