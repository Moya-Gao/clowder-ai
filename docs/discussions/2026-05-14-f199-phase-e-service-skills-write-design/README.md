---
feature_ids: [F199]
related_features: [F190, F146, F193, F088, F124]
topics: [console, settings, parity-audit, service-lifecycle, skills-write, design-gate, reopened]
doc_kind: design
created: 2026-05-14
---

# F199 Phase E Design — Service Lifecycle + Skills Write Parity

## Trigger

F199 D-1..D-5 closed the first settings parity pass, but CVO challenged the final boundary:

> "难道不是f199的下一个phase啊！？"
>
> "哈哈哈你的工作啊！f190！！！干活啦"

Decision correction: `InstallPreviewModal` and Skills write actions are still F190/F199 parity gaps. The earlier "different security boundary" argument was correct as a slice-design warning, but wrong as an ownership decision. These surfaces stay in F199 as Phase E.

## Source Truth

### Open-source surface

| Surface | Source path | Behavior |
|---|---|---|
| Service lifecycle modal | `../clowder-ai/packages/web/src/components/settings/InstallPreviewModal.tsx` | Shows install prerequisites, model choices, estimated time, and confirms install |
| Service lifecycle card actions | `../clowder-ai/packages/web/src/components/settings/ServiceStatusPanel.tsx` | Calls `/api/services/:id/toggle`, `start`, `stop`, `install`, `uninstall`, `logs`, `health` |
| Service lifecycle backend | `../clowder-ai/packages/api/src/routes/services.ts` + `domains/services/*` | Maintains service config, script logs, process checks, and spawn-based lifecycle routes |
| Skills write surface | `../clowder-ai/packages/web/src/components/settings/SkillsContent.tsx` + `useCapabilityState('skill')` | Source-style settings card write controls for skills |

### Home state

| Surface | Home path | Current state |
|---|---|---|
| Service settings UI | `packages/web/src/components/settings/ServiceStatusPanel.tsx` | Read-only status cards; no install/start/stop/uninstall modal |
| Service backend | `packages/api/src/routes/services.ts` + `domains/services/service-manifest.ts` | Read-only `/api/services`, `/endpoints`, `/:id/health`; no scripts, logs, config, lifecycle routes |
| Service scripts | `scripts/services/*` | Absent locally |
| Settings Skills UI | `packages/web/src/components/settings/SkillsContent.tsx` | Read-mostly list/filter/preview/mount summary |
| Legacy Hub Skills UI | `packages/web/src/components/HubSkillsTab.tsx` | Has `sync` and `resolve-conflict` actions against existing API |
| Skills backend | `packages/api/src/routes/skills.ts` | `GET /api/skills`, `POST /api/skills/sync`, `POST /api/skills/resolve-conflict`; identity-gated but not explicit-owner fail-closed |

## Design Judgement

### What Changes

Phase E adds the two parity gaps CVO called out:

1. **E-1 Service lifecycle parity** — source-style install preview and lifecycle controls, but only after home has a hardened lifecycle backend.
2. **E-2 Skills write parity** — settings-page sync / conflict resolution / managed uninstall or disable, but only after write routes get the same owner-gated discipline used by D-3a/D-4.

### What Does Not Change

- ThreadSidebar integration stays out: home chat layout behavior is equivalent to open-source AppShell opt-out and touching it crosses F183/F184/F194 red-zone.
- Token drift stays out: `--cafe-accent-hover` is brand/visual alignment, not missing capability.
- F088/F124 transport runtime remains out: Phase E may change service config/control surfaces, not connector delivery or message routing ownership.

Architecture cell: action-plane
Map delta: update required if E-1 adds a persistent service lifecycle owner/config cell; otherwise none.
Why: E-1 introduces process lifecycle writes, which are stronger than the current read-only service manifest.

## Threat Model

### E-1 Service Lifecycle

Service lifecycle is process control. The dangerous part is not the modal; it is backend routes that spawn scripts and stop processes.

Required guardrails:

- **Identity**: session-only user id, no trusted-header write fallback.
- **Owner**: `DEFAULT_OWNER_USER_ID` must be explicitly configured; mismatch or missing owner returns 403.
- **Allowlist**: service ids must resolve from the known service registry only.
- **Per-service mutex**: install/uninstall/start/stop/toggle operations must serialize per service id; concurrent lifecycle writes return `409 Conflict` instead of spawning overlapping scripts.
- **Script path confinement**: any script path must resolve under repo-owned `scripts/services/`; no arbitrary paths from request body or environment.
- **Model validation**: selected model must match the existing bounded `org/model-name` style pattern and length.
- **Process stop safety**: port/PID stop must verify candidate process command line belongs to the service manifest before signalling. Use strict script basename/path matching only; no broad prefix fallback such as `mlx`.
- **Timeout cap**: install/uninstall scripts need a server-side timeout cap; timeout should terminate the child, return an explicit timeout response, and include only bounded tail logs.
- **Port hygiene**: before starting or auto-starting a service, detect a busy port and refuse with a clear error unless the PID strictly belongs to the same service.
- **Logs**: tail/output must be bounded; API responses must not return unbounded install logs.
- **Audit**: metadata-only records: actor, service id, action, selected-model presence/name if non-secret, result; never raw env or command-line values beyond known script id.
- **Runtime isolation**: no Redis 6399 side effects; no autostart behavior until explicitly designed.
- **Worktree disclosure**: visual proof / User Visibility Disclosure must state that Settings controls the current process tree; running `cat-cafe` and `cat-cafe-runtime` simultaneously can create port conflicts, and Phase E must fail closed rather than killing another tree.

### E-2 Skills Write

Skills write actions mutate symlinks under project provider skill dirs and may delete user/project conflict paths.

Required guardrails:

- **Identity + owner**: same explicit-owner fail-closed rule as other write surfaces.
- **Project path**: continue using `validateProjectPath`; invalid or outside roots stays 400.
- **Skill name**: keep strict `validateSkillName`; no path separators or dots.
- **Managed-skill destructive guard**: uninstall/disable may only remove managed symlinks or managed state entries; never delete arbitrary user-owned directories.
- **Conflict choice**: keep explicit `official` / `mine`; UI must show which side wins.
- **Audit**: metadata-only records: actor, skill name, project path class, action, choice, result; no file content.
- **User visibility**: show staleness/conflict state and per-action failure reason in Settings, not only toast.

## Slice Plan

| Slice | Scope | Exit criteria |
|---|---|---|
| E-0 | This design gate + spec reopen | Cross-cat reviewer agrees on boundaries |
| E-1a | Service lifecycle backend hardening + tests | Owner fail-closed, service allowlist, per-service mutex, strict process matching, script confinement, timeout cap, port-busy refusal, bounded logs, audit metadata-only |
| E-1b | `InstallPreviewModal` + service lifecycle controls | Visual proof: prerequisites/model selection, install/start/stop/uninstall, error/fail-closed states |
| E-2a | Skills write backend hardening + tests | Existing sync/resolve routes owner-gated; destructive managed-only route added only if needed |
| E-2b | Settings Skills write UI parity | Visual proof: sync, conflict resolve, managed uninstall/disable, error/fail-closed states |
| E-close | Full F199 close gate rerun | settings diff, User Visibility Disclosure, red-zone grep, transport boundary, independent guardian disclosed as non-author/non-reviewer |

Implementation rule: E-1a before E-1b, E-2a before E-2b. Backend P0s must be closed before exposing buttons.

## Acceptance Draft

- AC-E1: Phase E design reviewed before code implementation.
- AC-E2: Service lifecycle routes reject missing owner, non-owner, unknown service id, invalid model id, escaped script paths, concurrent lifecycle operations, and unsafe busy-port starts.
- AC-E3: Service lifecycle audit and logs are metadata/bounded; no raw command or unbounded output in audit; install/uninstall has a timeout cap.
- AC-E4: Settings service UI ports `InstallPreviewModal` and lifecycle controls only on hardened backend.
- AC-E5: Skills sync / conflict resolve / managed removal are explicit-owner gated and path/name validated.
- AC-E6: Settings Skills UI ports write actions with clear failure states and preserves read/list/preview behavior.
- AC-E7: Final F199 close gate reruns source side-by-side, User Visibility Disclosure, red-zone and transport-boundary checks, then independent vision guardian. The close report must disclose guardian handle and confirm guardian is not Phase E author and not Phase E reviewer; cross-family preferred.

## Review Disposition

Opus-47 reviewed this design in `REVIEW-opus47.md` and approved the direction with required sharpenings:

| Item | Disposition |
|---|---|
| P0: per-service install/uninstall mutex | Promoted to E-1a required guardrail and AC-E2 |
| P0: explicit non-author/non-reviewer guardian | Promoted to E-close exit criteria and AC-E7 |
| P1: strict `isServiceProcess` matching | Promoted to E-1a process stop safety guardrail |
| P1: install/uninstall timeout cap | Promoted to E-1a timeout guardrail and AC-E3 |
| P1: worktree/port hygiene disclosure | Promoted to E-1a port hygiene and worktree disclosure guardrails |

## Review Ask

Review E-1/E-2 boundaries before implementation. The key question is not "should this be F199" anymore; CVO answered yes. The review question is whether the hardened split is enough to make service lifecycle and Skills write safe to port without touching protected chat/transport runtime surfaces.
