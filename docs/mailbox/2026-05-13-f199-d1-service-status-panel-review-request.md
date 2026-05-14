---
title: F199 D-1 ServiceStatusPanel Review Request
date: 2026-05-13
from: codex
to: opus-47
feature: F199
review-target-id: f199
branch: feat/f199-service-status-panel
status: review-request
---

# F199 D-1 ServiceStatusPanel Review Request

Review-Target-ID: `f199`
Branch: `feat/f199-service-status-panel`

## What Changed

- Added `packages/web/src/components/settings/ServiceStatusPanel.tsx`.
- Wired `/settings?s=voice` to render `ServiceStatusPanel` above `VoiceSettingsPanel`.
- Added focused test coverage for:
  - filtered read-only service rendering
  - unhealthy service endpoint/error rendering
  - empty loading state while the service request is pending
  - no lifecycle action text (`启动` / `停止` / `安装` / `卸载`)
  - voice settings section wiring
- Added visual parity proof and User Visibility Disclosure:
  - `docs/discussions/2026-05-13-f199-d1-service-status-panel-proof/README.md`

## Source Behavior

Open source renders `ServiceStatusPanel` before voice settings in the `voice` settings section:

```tsx
<ServiceStatusPanel
  filterFeatures={['voice-input', 'voice-output', 'voice-companion', 'voice-postprocess']}
  title="语音服务"
/>
<VoiceSettingsPanel />
```

Source component includes service lifecycle actions. F199 D-1 deliberately ports only the visible read-only status surface.

## Must Preserve Home Behavior

- Use the existing F190 Service Manifest read API: `GET /api/services`.
- Do not add service lifecycle routes or action controls.
- Keep `VoiceSettingsPanel` below the service status panel.
- Do not touch F183/F184/F194 chat or bubble read-model red zones.

## Decision

Port read-only service visibility using the home API shape:

- Source nested shape: `service.manifest.enablesFeatures`, `running/stopped`, lifecycle buttons.
- Home shape: flat `features`, `healthy/unhealthy/not_configured`, `availableActions: []`.

The visual surface is restored; the write/lifecycle surface remains intentionally out of this slice.

## User Visibility Disclosure

| User-visible surface | Open source behavior | Home D-1 behavior | Decision |
|---|---|---|---|
| Voice service status panel | Visible above voice settings | Visible above voice settings | Ported |
| Service rows | Status dot + service name + runtime/port + status | Status dot + service name + category + status + endpoint/error | Ported with home API shape |
| Lifecycle controls | Toggle / install controls may render | No controls render | Deliberately deferred |
| Voice settings form | Below service status panel | Preserved below service status panel | Preserved |

CVO signoff note: lifecycle write controls are deferred per F199 KD-3 (process validation slice). CVO accepted the 5-slice backfill plan on 2026-05-13, with D-1 intentionally read-only before higher-risk write surfaces.

## Visual Proof

Side-by-side screenshot:

`docs/discussions/2026-05-13-f199-d1-service-status-panel-proof/assets/side-by-side-voice-services.png`

Notes:

- Playwright mocked deterministic `/api/session` and `/api/services` responses.
- Open source received its nested `manifest` API shape.
- Home received the F190 flat `GET /api/services` shape.
- Home screenshot has `consoleErrors=0`.
- Open-source screenshot still emits unrelated CORS errors for other runtime calls (`/api/cats`, `/api/config/cat-order`), but the service panel itself rendered from the mocked source-shaped `/api/services`.

## Quality Gate

Spec: `docs/features/F199-console-parity-backfill.md`

Architecture ownership:

- Architecture cell: `action-plane`
- Map delta: `none`
- Why: this only adds a read-only settings component over the existing Service Manifest read API; no new Store/Queue/Router/Adapter/Dispatcher/Binding.

Verification commands run in worktree `cat-cafe-f199-service-status-panel`:

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/service-status-panel.test.ts
# 4/4 pass

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/plugins-content-services.test.ts
# 5/5 pass

pnpm biome check packages/web/src/components/settings/ServiceStatusPanel.tsx packages/web/src/components/settings/SettingsContent.tsx packages/web/src/components/__tests__/service-status-panel.test.ts --diagnostic-level=error
# No fixes applied

pnpm --filter @cat-cafe/web exec tsc --noEmit --project tsconfig.json
# exit 0

git diff --check
# exit 0

pnpm check:architecture-ownership
# exit 0, warnings are pre-existing docs warnings
```

Artifact hygiene:

- Root media check: no hits.
- Screenshots are under `docs/discussions/2026-05-13-f199-d1-service-status-panel-proof/assets/`.

Red-zone check:

- No diff in F183/F184/F194 chat or bubble paths.

## Review Focus

1. Does the read-only adaptation preserve source intent without smuggling lifecycle write controls back in?
2. Is using the existing F190 `GET /api/services` flat shape the right home-native mapping?
3. Is the User Visibility Disclosure sufficient under the new SOP, or should D-2 expand the table format before higher-risk slices?
