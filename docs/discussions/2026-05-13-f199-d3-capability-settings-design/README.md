---
title: "F199 D-3 Capability Settings Design"
date: 2026-05-13
feature: F199
status: draft
owner: "@codex"
reviewer: "@opus-47"
---

# F199 D-3 Capability Settings Design

## Context

F199 D-1 and D-2 restored read-mostly settings parity for service status and skills. D-3 was originally scoped as the "capability trio":

- `capability-settings-ui.tsx`
- `useCapabilityState.ts`
- `InstallPreviewModal.tsx`

The source survey found that this grouping needs correction before implementation. Two of the three are capability settings primitives, but `InstallPreviewModal.tsx` belongs to service lifecycle install flow, not capability settings. D-3 also crosses from read-mostly UI into existing capability write APIs, so it needs a write-boundary design before code.

## Source Survey

### Component Diff After D-2

After D-2, the remaining source `settings/` component gaps are:

| File | Source role | F199 handling |
|---|---|---|
| `capability-settings-ui.tsx` | Shared capability controls: project selector, toggle switch, per-cat toggles | D-3 |
| `useCapabilityState.ts` | Capability fetch + toggle/delete handlers for MCP and Skills | D-3, but restricted |
| `InstallPreviewModal.tsx` | Service install lifecycle modal for `ServiceStatusPanel` | Reclassify out of D-3 |
| `PushServiceConfig.tsx` | Push VAPID secret write UI | D-4 |
| `GithubConfigPanel.tsx` | GitHub token write UI | D-5 |

Additional source dependencies not counted in the original `settings/` diff:

| File | Source role | D-3 impact |
|---|---|---|
| `McpConfigModal.tsx` | MCP add/edit/read-only detail modal | Needed for MCP settings parity |
| `mcp-form-helpers.tsx` | Form helpers used by `McpConfigModal` | Needed if `McpConfigModal` is ported |

### Current Home State

`McpManageContent` currently wraps `HubCapabilityTab` with `onlyType="mcp"`. That path already has:

- `GET /api/capabilities?probe=true`
- `PATCH /api/capabilities` for global/per-cat toggles
- `DELETE /api/capabilities/mcp/:id`
- `McpInstallForm` using `POST /api/capabilities/mcp/preview` and `/install`
- `CapabilityAuditLog`

So D-3 is not introducing an entirely new write surface. It is making an existing write surface safer and closer to the source UI.

## Boundary Findings

### 1. `InstallPreviewModal` Is Misclassified

The source `InstallPreviewModal.tsx` takes `serviceName`, `prerequisites`, `onConfirm`, and install model options. It is called from the source `ServiceStatusPanel`, not from capability settings.

D-1 deliberately restored `ServiceStatusPanel` as read-only and did not port lifecycle install/start/stop controls. Therefore D-3 should not port `InstallPreviewModal`.

Recommended spec correction:

- Remove `InstallPreviewModal` from D-3.
- Track it as service lifecycle write UI, outside the current F199 D-3 capability slice.
- If lifecycle controls are ever reintroduced, they need their own auth/design gate.

### 2. `useCapabilityState` Mixes Read and Write

Source `useCapabilityState` includes:

- read: capability list, project selector, skill health
- write: global/per-cat toggles
- write: external MCP hard delete
- write: external skill uninstall

D-2 intentionally kept `SkillsContent` read-mostly and deferred skill lifecycle writes. Blindly porting this hook into both MCP and Skills would undo that boundary.

Recommended scope:

- Use D-3 only for MCP settings parity.
- Keep D-2 `SkillsContent` read-mostly.
- Do not wire skill uninstall or skill toggle actions into D-2.

### 3. Existing API Write Hardening Is Inconsistent

Current capability write routes have different auth/security levels:

| Route | Current gate | Issue |
|---|---|---|
| `PATCH /api/capabilities` | `resolveUserId` | accepts trusted header/fallback; no owner gate |
| `POST /api/capabilities/mcp/preview` | no auth | accepts secret-like body and returns preview entry |
| `POST /api/capabilities/mcp/install` | `resolveUserId` + owner-if-configured | not fail-closed when owner missing |
| `DELETE /api/capabilities/mcp/:id` | `resolveUserId` + owner-if-configured | not fail-closed when owner missing |
| `PATCH /api/capabilities/mcp/:id/env` | `resolveUserId` + explicit owner | owner fail-closed, but identity still accepts fallback |
| `GET /api/capabilities/audit` | `resolveUserId` | read-only; lower risk |

F190 Phase C patterns for write surfaces used stricter defaults:

- session identity only, no trusted header fallback
- owner fail-closed for secret/write routes
- redacted placeholder rejection
- omitted secret preservation
- audit without raw secret leakage

D-3 should align capability writes with those patterns before expanding the UI.

### 4. Capability Audit Can Store Raw Secret Values

`appendAuditEntry` currently serializes `before` and `after` full `CapabilityEntry` objects. MCP entries may include `mcpServer.env` and `mcpServer.headers`.

That means install/update/delete/env patch audit records can include raw secrets. This predates D-3, but D-3 should not expand the write UI without fixing it.

Recommended approach:

- Keep the `before` / `after` shape for F146 audit semantics.
- Sanitize capability entries before audit append.
- Preserve non-sensitive metadata and env/header key names.
- Replace sensitive values with a stable redacted marker.
- Add tests that audit JSONL does not contain raw secret strings.

## Proposed Split

### D-3a: Capability Write Hardening

Backend-first slice. No visual parity claim yet.

Scope:

- Add or consolidate shared capability write guards.
- Use session-only identity for capability write routes.
- Make owner gate fail-closed for capability writes when `DEFAULT_OWNER_USER_ID` is missing.
- Apply to:
  - `PATCH /api/capabilities`
  - `POST /api/capabilities/mcp/preview`
  - `POST /api/capabilities/mcp/install`
  - `DELETE /api/capabilities/mcp/:id`
  - `PATCH /api/capabilities/mcp/:id/env`
- Keep `GET /api/capabilities` and `GET /api/capabilities/audit` as read routes.
- Sanitize audit `before` / `after` for MCP secret-bearing entries.
- Preserve F193 heal-before-write behavior.

Tests:

- Trusted header without real session rejected for every write route.
- Missing `DEFAULT_OWNER_USER_ID` rejected for every write route.
- Non-owner rejected.
- Owner happy path still works for toggle/install/delete/env patch.
- Redacted placeholders still rejected.
- Omitted env/headers still preserve existing secrets.
- Audit log never contains raw env/header values.
- Existing F146/F193 write behavior remains green.

### D-3b: MCP Settings UI Parity

Frontend parity slice after D-3a.

Scope:

- Port `capability-settings-ui.tsx` UI primitives.
- Port a restricted `useCapabilityState` for MCP settings only.
- Port `McpConfigModal.tsx` and `mcp-form-helpers.tsx` if needed for parity.
- Replace `McpManageContent` wrapper with source-style MCP settings UI.
- Keep `HubCapabilityTab` untouched unless a small shared extraction is needed.
- Do not wire source `SkillsContent` write actions into D-2.
- Do not port `InstallPreviewModal`.

Visual proof:

- Source vs home `/settings?s=mcp`.
- MCP card list.
- Managed MCP read-only modal.
- External MCP edit modal.
- Add MCP flow through preview/install UI.
- Error/fail-closed state when owner is not configured.

User Visibility Disclosure:

| User-visible surface | D-3b result |
|---|---|
| MCP settings card list | Ported with source parity, adjusted to home data shape |
| Project selector | Ported |
| Managed MCP detail | Read-only modal |
| External MCP add/edit/delete | Ported, owner-only and fail-closed |
| Per-cat/global MCP toggles | Ported, owner-only and fail-closed |
| Skill toggles/uninstall from source `SkillsContent` | Still deferred; D-2 remains read-mostly |
| Service lifecycle install modal | Not D-3; service lifecycle write remains deferred |

## Recommended Decisions

| ID | Decision | Recommendation |
|---|---|---|
| OQ-D3-1 | Is D-3 one slice or split? | Split into D-3a API hardening and D-3b UI parity |
| OQ-D3-2 | Should capability toggles be owner-gated? | Yes. They write capabilities and regenerate CLI config |
| OQ-D3-3 | Should MCP preview require owner? | Yes. Preview accepts secret-like payload and returns generated entries |
| OQ-D3-4 | Audit format | Keep before/after but sanitize secret values |
| OQ-D3-5 | `InstallPreviewModal` scope | Reclassify out of D-3; do not port in capability slice |
| OQ-D3-6 | Skill write actions | Do not wire in D-3; keep D-2 read-mostly |

## Implementation Order

1. D-3a: API hardening + audit sanitization.
2. D-3b: MCP settings UI parity.
3. Post-merge F199 spec sync:
   - AC-D3 split into D-3a/D-3b completion notes.
   - Correct `InstallPreviewModal` classification.
   - Record any deliberate defer with user-visible disclosure.

## Review Ask

Please review the split and boundary corrections before implementation:

- Is `InstallPreviewModal` reclassification correct?
- Should `POST /api/capabilities/mcp/preview` be owner-gated, or should it become a redacted read-only preview?
- Is sanitized before/after audit enough, or should capability writes switch to metadata-only audit?
- Does keeping Skills write actions out of D-3 preserve the D-2 read-mostly promise?
