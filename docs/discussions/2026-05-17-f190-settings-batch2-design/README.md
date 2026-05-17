---
title: F190 Settings A/B Convergence Batch 2 Design
created: 2026-05-17
feature: F190
related_features: [F199, F041, F146, F193, F088, F124]
source_audit: ../../audits/2026-05-17-f190-settings-parity-audit.md
previous_memo: ../2026-05-17-f190-settings-a-b-convergence/README.md
participants: [codex-gpt-5.5, opus-46]
doc_kind: design
---

# F190 Settings A/B Convergence Batch 2 Design

## Context

Batch 1 closed the contained settings parity slices: A-3, A-1, B-5, and B-2.
The remaining items all cross a truth-model or transaction boundary:

- **A-2 Skills dual model**: home has registry governance; source has
  capability controls.
- **B-1/B-3 Services + Plugins**: home has a flat service-truth API; source has
  manifest lifecycle UI.
- **B-4 IM save model**: home and source intentionally differ on transaction
  timing.

This memo is the implementation contract for batch 2. It refines the earlier
A/B convergence memo after checking current `main` and current `clowder-ai`
source.

## Verdict

1. **A-2 should be one composed Settings Skills surface.** Use `/api/skills`
   for home governance facts and `/api/capabilities` for enablement controls.
   Do not replace one model with the other.
2. **B-1/B-3 should share a typed service adapter.** Home `/api/services`
   remains backend truth. Source-style lifecycle UI can appear only after the
   adapter maps home fields explicitly.
3. **B-4 is resolved as a decision, not a code slice.** Keep immediate-save for
   permission changes. Keep explicit submit for secrets/credential batches.

Opus-47 is not required before implementation. Escalate to Opus-47 only if the
implementation discovers a shared backend abstraction between capability writes
and service lifecycle writes, or if CVO changes B-4 from "keep immediate-save"
to "unify transactions".

## Evidence Snapshot

| Area | Home truth | Source truth | Consequence |
|---|---|---|---|
| Skills list | `packages/web/src/components/settings/SkillsContent.tsx` fetches `/api/skills` and renders mount count, staleness, conflicts, MCP deps, preview. | `../clowder-ai/packages/web/src/components/settings/SkillsContent.tsx` uses `useCapabilityState('skill')` with project selector, global/per-cat toggles, external disable. | Compose rows from both APIs. |
| Skill writes | `PATCH /api/capabilities` already supports `capabilityType: 'skill'`, owner fail-closed, session identity, `validateProjectPath`, and audit. | Source calls the same patch shape, plus `DELETE /api/capabilities/skill/:id`. | Toggle can ship; destructive skill disable cannot ship until home adds and tests that route. |
| Services | `GET /api/services` returns flat `ServiceState`: `healthy/unhealthy/not_configured`, endpoint, features, `availableActions`. Lifecycle routes, logs, toggle, owner guard, locks, audit exist. | Source expects `{ manifest, status, installed, enabled }` and polls logs. | Add adapter/DTO, not whole-file port. |
| Service config | Home has `setServiceConfig()` and `/api/services/:id/toggle`, but `enabled` is not currently exposed by `GET /api/services`. | Source renders toggle from `s.enabled`. | If UI needs toggle state, extend DTO first. |
| Plugins | Home keeps GitHub `GithubConfigPanel` plus live service diagnostics. | Source keeps a platform catalog shell and derives service plugin status from service manifests. | Preserve GitHub config and live diagnostics; use catalog shell only as presentation. |
| IM permissions | Home `HubPermissionsTab` writes each permission change immediately to `/api/connector/permissions/:id`. | Source stages permissions in a child ref and sends credentials + permissions through `/api/connector/:id/config`. | Do not merge these transaction models in batch 2. |
| IM secrets | Home `/api/config/secrets` has session owner gate, allowlist, redacted-placeholder rejection, loopback guard, and audit. | Source unified route handles both secrets and permissions. | Keep secret batch submit separate from permission immediate-save. |

## A-2 Skills Dual Model

### Design

Create a composed Settings Skills view model:

```ts
interface SettingsSkillItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  triggers: string[];
  governance: {
    mounts: Record<'claude' | 'codex' | 'gemini' | 'kimi', boolean>;
    mountedCount: number;
    requiresMcp: Array<{ id: string; status: 'ready' | 'missing' | 'unresolved' }>;
    hasConflict: boolean;
    isStaleNew: boolean;
    isStaleRemoved: boolean;
  };
  controls: {
    source: 'cat-cafe' | 'external';
    enabled: boolean;
    cats: Record<string, boolean>;
    canToggle: boolean;
    canDisableExternal: false;
  };
}
```

Composition source:

1. Fetch `/api/skills` for governance facts.
2. Fetch `/api/capabilities?projectPath=...` for `type === 'skill'` controls.
3. Join by skill id/name. The `/api/skills` row stays canonical for home-managed
   skill identity; capability-only external skills may appear as external rows
   only if they have a valid `CapabilityBoardItem`.

UI structure:

- Top: `ProjectSelector` from `capability-settings-ui.tsx`.
- Health strip: home staleness, registration consistency, conflict count, and
  sync action.
- Filters/search: keep current category/search behavior.
- Row:
  - left: skill name, category, trigger/description, preview action;
  - middle: mount count badge and MCP dependency badges;
  - right: global toggle and per-cat toggle expander.
- Conflict banner remains above the list.
- `SkillPreviewModal` remains the preview owner.

### Writes Allowed In Batch 2

Allowed:

- `/api/skills/sync`.
- `/api/skills/resolve-conflict`.
- `PATCH /api/capabilities` with `capabilityType: 'skill'` for global/per-cat
  enablement, because home already has owner fail-closed, session identity,
  project path validation, and audit on this route.

Not allowed:

- `DELETE /api/capabilities/skill/:id`.
- "Uninstall Skill" or destructive disable UI.
- Any direct filesystem delete from Settings.

If external skill removal is still desired after this batch, add it as a
backend-first mini-slice with explicit managed/external guard, strict skill-name
validation, project path validation, owner fail-closed, and metadata-only audit.

### Tests Required

- `SkillsContent` fetches both `/api/skills` and `/api/capabilities`.
- Project switch refetches both sources and keeps the selected project in toggle
  payloads.
- Existing staleness/sync/conflict tests remain green.
- Global skill toggle posts `capabilityType: 'skill'`, `scope: 'global'`.
- Per-cat skill toggle posts `capabilityType: 'skill'`, `scope: 'cat'`,
  `catId`.
- Destructive external disable is not rendered on home.
- Governance-only skill rows still render if no matching capability item exists.

## B-1/B-3 Services + Plugins Adapter

### Design

Introduce a shared UI adapter, preferably near the settings service surface:

```ts
type ServiceUiStatus =
  | 'running'
  | 'stopped'
  | 'not_configured'
  | 'error'
  | 'installing'
  | 'starting';

interface ServiceUiState {
  id: string;
  name: string;
  description: string;
  category: 'voice' | 'memory' | 'audio';
  endpoint: string | null;
  features: string[];
  status: ServiceUiStatus;
  statusLabel: string;
  installedKnown: boolean;
  running: boolean;
  enabled?: boolean;
  availableActions: Array<'install' | 'start' | 'stop' | 'uninstall'>;
  prerequisites?: ServicePrerequisites;
  error?: string | null;
}
```

Mapping rules:

| Home field | UI adapter |
|---|---|
| `status: healthy` | `status: running`, `running: true`, `installedKnown: true` |
| `status: unhealthy`, `configured: true` | `status: error`, `running: false`, `installedKnown: true` |
| `status: not_configured` | `status: not_configured`, `installedKnown: false`, `running: false` |
| `availableActions` | Only render buttons listed by backend. Do not infer lifecycle affordances in UI. |
| `endpoint` | Display masked endpoint from backend only. |
| `features` | Feed Plugins service-derived rows. |
| `enabled` | Optional. Do not render source-style toggle until `GET /api/services` exposes it. |

Backend truth remains home `/api/services`. The adapter may be client-side for
the first PR, but if both Service and Plugins need the same normalized shape, a
small shared function should be tested directly.

`installedKnown` is presentation metadata only. Home does not currently have a
separate package-install truth field, so lifecycle buttons must be driven by
`availableActions`, not by `installedKnown`.

### B-1 Service UI

Implement source-style affordances only through the adapter:

- Keep `ServiceStatusPanel` as the main system/voice/memory service surface.
- Keep install preview when action is `install` and prerequisites have models.
- Use `/api/services/:id/logs` only while a long-running action is active.
- Show lifecycle buttons only when `availableActions` contains the action.
- Do not render a persistent enable/disable toggle until `GET /api/services`
  exposes `enabled` from service config.

DTO extension allowed:

- Add `enabled?: boolean` and `selectedModel?: string` to `ServiceState` only if
  backed by `getServiceConfig(id)`.
- Do not let `enabled` replace health. A disabled-but-running or enabled-but-down
  service still needs health diagnostics.

### B-3 Plugins UI

Plugins should be a product catalog shell backed by real status:

- Keep the GitHub platform plugin and `GithubConfigPanel`.
- Keep service-backed rows derived from `/api/services`, not a static-only
  catalog.
- Service plugin rows should show the same status label produced by the adapter.
- Service plugin rows may deep-link to the System/Services section or expand a
  compact diagnostics view; they should not own lifecycle writes independently.

Do not replace live `/api/services` diagnostics with a purely static
`PLUGIN_CATALOG`.

### Tests Required

- Adapter maps `healthy`, `unhealthy`, and `not_configured` correctly.
- Buttons are gated by `availableActions`, not by guessed status.
- `enabled` toggle is absent until DTO exposes `enabled`.
- Long-running action starts/stops log polling and bounds displayed progress.
- Plugins keeps GitHub config reachable when `/api/services` fails.
- Service-backed plugin rows derive status from adapter output.
- Existing `ServiceStatusPanel` and `PluginsContent` tests remain green.

## B-4 IM Save Model

### Decision

Keep the current split:

- Permissions: **immediate save** through `/api/connector/permissions/:id`.
- Credentials/secrets: **explicit submit** through `/api/config/secrets` and
  existing guided connector routes.

### Why

- Permissions are low-secret operational settings. Immediate save gives direct
  feedback and avoids losing local edits when the panel collapses.
- Credentials carry redaction, allowlist, loopback, owner, and hot-reload
  semantics. They need explicit submit and focused error reporting.
- A single submit path would mix credential failure and permission failure into
  one transaction without a rollback contract.
- Home's secret route is currently stricter than the source unified route:
  session owner gate, redacted-placeholder rejection, allowlist validation,
  loopback guard, and audit are already in place.

### Allowed Batch 2 Work

- Visual consistency only: tokens, card shell, action placement, copy.
- Tests may clarify that permission toggles write immediately.

Not allowed:

- No `/api/connector/:id/config` unified route in batch 2.
- No staged permissions refactor.
- No credential + permission transaction without a new feature/design gate.

## Implementation Sequence

| PR | Scope | Owner | Review focus |
|---|---|---|---|
| Batch 2.1 | A-2 Skills composed view + capability skill toggles, no destructive disable | Opus | Join correctness, owner-gated write payloads, no loss of registry governance |
| Batch 2.2 | B-1/B-3 service adapter + Service/Plugins UI convergence | Opus | Adapter truthfulness, lifecycle button gating, GitHub config preserved |
| Batch 2.3 | B-4 visual-only IM consistency if needed | Opus | Immediate-save preserved, secrets submit preserved |

Batch 2.1 and Batch 2.2 can be separate PRs. Do not combine A-2 and B-1/B-3
unless the implementation stays small enough for focused review.

## Cross-Slice Guards

- No whole-file overwrite from `clowder-ai`.
- No chat rendering, thread state, read state, or connector runtime changes.
- Backend truth wins over source UI shape.
- New write controls require route-level proof before UI exposure.
- For each PR, include focused tests plus the existing affected settings tests.
- Commit messages and PR body must say "composed/adapter" rather than "copied".

## Convergence Check

1. 否决理由 -> ADR? 没有。这里是 F190 follow-up 的 implementation design，不新增 ADR 级架构决定。
2. 踩坑教训 -> lessons-learned? 没有。本 memo 固化的是当前代码契约，不是新事故教训。
3. 操作规则 -> 指引文件? 没有。沿用 F190 manual-port、write-surface hardening、红区保护规则。
