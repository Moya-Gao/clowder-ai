---
feature_ids: [F190]
related_features: [F088, F132, F134, F136, F137, F191]
topics: [console-settings, im-connector, connector-secrets, design-gate, security]
doc_kind: design
status: implemented
created: 2026-05-13
owner: codex
---

# F190 Phase C: IM Connector Write Design Gate

## Context

F190 Phase C has already landed the read-only settings surfaces, MCP write-path hardening, Service Manifest read-only status, and refAudio upload. The remaining high-risk surface is IM connector write: Hub connector config can already write selected connector env keys through `/api/config/secrets`, and several guided connector routes can persist or clear credentials through `applyConnectorSecretUpdates`.

This slice is not a new connector runtime. It is a hardening pass over the existing write paths that configure IM connector credentials.

## Architecture Placement

Architecture cell: `transport`

Map delta: none

Why: IM connector runtime, message routing, adapter semantics, thread binding, outbound delivery, and provider-specific transport remain owned by F088/F124. F190 only owns the Console/Settings configuration surface and the safety gates around writing connector credentials from that surface.

## Current Write Surfaces

The current implementation has two write-path families:

1. Generic connector secret writes
   - `POST /api/config/secrets`
   - Used by `HubConnectorConfigTab` for platform fields.
   - Writes allowlisted env vars through `applyConnectorSecretUpdates`.
   - Emits config change events for hot reload.

2. Guided connector writes
   - `GET /api/connector/feishu/qrcode-status` persists `FEISHU_APP_ID` / `FEISHU_APP_SECRET` when QR binding confirms.
   - `POST /api/connector/feishu/disconnect` clears Feishu credentials.
   - `GET /api/connector/weixin/qrcode-status` persists `WEIXIN_BOT_TOKEN` when QR login confirms.
   - `POST /api/connector/weixin/disconnect` clears WeChat credentials.
   - `POST /api/connector/wecom-bot/validate` validates, persists, starts stream, and rolls back on start failure.
   - `POST /api/connector/wecom-bot/disconnect` stops and clears WeCom Bot credentials.

These guided routes are part of the same security boundary. Hardening only `/api/config/secrets` would leave credential-write bypasses.

## Scope Decision

This slice should harden existing IM connector config writes:

- Require real authenticated session identity for every connector credential write.
- Require explicit owner for every connector credential write.
- Reject redacted placeholder values.
- Preserve omitted secrets during partial edits.
- Keep explicit deletion semantics for `null`.
- Preserve the existing hot-reload path.
- Keep read responses redacted.
- Add audit entries with key names and redacted before/after metadata only.

This slice must not:

- Add new connector adapters.
- Change `ConnectorRouter`, `MessageEnvelope`, outbound hooks, or transport semantics.
- Add service lifecycle controls.
- Add new public webhook or OAuth callback handlers.
- Add user-editable provider endpoint URLs unless CVO explicitly chooses that scope.
- Store raw secrets in audit logs, thread messages, public sync payloads, or frontend state snapshots.

## Auth Boundary

Write routes must use a stricter gate than the current `resolveHeaderUserId` pattern.

Required behavior:

- Resolve identity from `request.sessionUserId`.
- Do not accept trusted Origin fallback.
- Do not accept `X-Cat-Cafe-User` as the sole write identity.
- If `DEFAULT_OWNER_USER_ID` is absent, fail closed with 403.
- If session user differs from `DEFAULT_OWNER_USER_ID`, fail with 403.

Read-only status routes can remain separately reviewed, but every route that calls `applyConnectorSecretUpdates` or mutates connector permissions must be treated as write-path unless explicitly exempted.

## Secret Boundary

Sensitive fields include:

- `TELEGRAM_BOT_TOKEN`
- `FEISHU_APP_SECRET`
- `FEISHU_VERIFICATION_TOKEN`
- `DINGTALK_APP_SECRET`
- `WEIXIN_BOT_TOKEN`
- `WECOM_BOT_SECRET`
- `WECOM_AGENT_SECRET`
- `WECOM_TOKEN`
- `WECOM_ENCODING_AES_KEY`
- `XIAOYI_SK`

Non-sensitive but connector-scoped fields stay allowlisted and still require owner when written through connector config APIs, because they can alter connector behavior:

- App IDs, bot IDs, agent IDs, connection mode, admin IDs, and provider selectors.

Required write behavior:

- Reject any submitted value containing `••••••`.
- Reject non-allowlist env names.
- Reject malformed provider-specific values already covered by existing validators, such as invalid Telegram tokens.
- Treat omitted fields as "no change".
- Treat `null` as explicit deletion.
- Do not echo raw values in responses or audit logs.

## URL Boundary

Current allowlist fields do not include user-editable outbound endpoint or callback URL values. For this slice, the recommended decision is:

- Do not introduce custom callback URL or provider endpoint writes.
- Treat callback URL configuration as provider-side setup instructions, not Cat Cafe user-config data.
- If future work adds user-editable URL fields, it must be a separate security review with SSRF tests.

If CVO decides to include URL writes in this slice, minimum validation must reject:

- Non-HTTP(S) schemes, including `file:` and `ftp:`.
- URL credentials (`user:pass@host`).
- `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`.
- Private and link-local ranges: `10/8`, `172.16/12`, `192.168/16`, `169.254/16`.
- Hostnames resolving to private or loopback addresses.

Provider endpoint allowlist is a CVO decision. Default recommendation: no custom endpoint writes in this slice.

## Hot-Reload Boundary

`applyConnectorSecretUpdates` already writes `.env`, updates `process.env`, emits `ConfigChangeEvent`, and the connector reload subscriber debounces restart.

Recommended behavior:

- Preserve this F136 hot-reload path for generic `/api/config/secrets` writes.
- Preserve WeCom Bot guided setup behavior: validate, persist, attempt start, rollback credentials if start fails.
- Do not add a new reconnect endpoint.
- Do not add service lifecycle controls.

Known consequence: generic secret writes request a connector gateway restart through the existing event bus; guided WeCom writes may also start/stop the live adapter because that was pre-existing F132/F137 behavior.

## Chain Integrity Checklist

Implementation review must trace these paths end to end:

Write chain:

1. Zod/request schema
2. Identity and owner gate
3. Allowlist and provider-specific validation
4. Redacted placeholder rejection
5. Secret update merge/delete semantics
6. `.env` / `process.env` writer
7. Config change event
8. Audit append
9. Hot-reload or guided adapter start/rollback

Read chain:

1. Env/config store
2. Connector status builder
3. Sensitive field redaction
4. API response mapper
5. `HubConnectorConfigTab` field hydration

Type layer:

- Shared types or route-local response types must include every field intentionally exposed to the client.
- Sensitive values must be typed as redacted display values, not raw secret strings.

Resource lifecycle:

- Any route that allocates a stream, socket, QR polling state, external validation request, or adapter handle must release or rollback on early return and error paths.

## Test Plan

API tests must cover:

- No session identity -> 401 or 403 before any secret write.
- Trusted header without real session -> rejected.
- `DEFAULT_OWNER_USER_ID` absent -> 403 for connector credential writes.
- Non-owner session -> 403.
- Owner session -> write succeeds.
- Redacted placeholder reject for a sensitive field and a non-sensitive connector-scoped field.
- Non-allowlist env name reject.
- Omitted secret preservation in partial edits.
- `null` explicit clear.
- Write -> read roundtrip returns redacted sensitive values, never raw secrets.
- Audit log records operator and key names but no raw values.
- Hot reload event still fires for changed connector keys and does not fire on no-op.
- Guided Feishu QR confirmed write obeys owner gate.
- Guided WeChat QR confirmed write obeys owner gate.
- Guided WeCom Bot validate obeys owner gate, rejects redacted placeholder, and still rolls back on start failure.
- Provider or connector not found -> 404 or 400 as appropriate.

Frontend tests must cover:

- `HubConnectorConfigTab` does not submit masked placeholder values.
- Saving one field does not submit untouched masked secret fields.
- API error for owner/auth gate is rendered clearly.
- Disconnect and guided setup panels preserve existing loading/error states.

## CVO Decision Points

2026-05-13 decision: these are technical implementation boundaries, not CVO product choices. Reviewer self-decided to follow the recommendations below after CVO clarified the desired outcome: finish the intake without widening scope or regressing existing chat/bubble behavior.

| # | Decision | Recommendation |
|---|----------|----------------|
| OQ-1 | Should this slice introduce user-editable callback URL / provider endpoint fields? | No. Keep URL writes out of this slice; document provider-side callback setup only. |
| OQ-2 | Should every connector credential write fail closed when `DEFAULT_OWNER_USER_ID` is absent? | Yes. Connector credentials are secret-equivalent and should match MCP env patch strictness. |
| OQ-3 | Should generic connector secret writes trigger hot reload? | Yes. Preserve the existing F136 `ConfigChangeEvent` + reload subscriber path. |
| OQ-4 | Should guided setup routes be included in the hardening scope? | Yes. They call `applyConnectorSecretUpdates` and are credential-write bypasses if excluded. |
| OQ-5 | Should read-only connector status switch to real session identity in the same slice? | Prefer yes if low-risk; otherwise keep it as a separate read-surface hardening follow-up. Raw secrets must remain redacted either way. |

## Proposed Slice Boundary

Minimum viable implementation:

1. Extract or duplicate minimal connector write guards:
   - real session identity
   - explicit owner fail-closed
   - redacted placeholder rejection
2. Harden `/api/config/secrets`.
3. Harden guided routes that call `applyConnectorSecretUpdates`.
4. Keep `CONNECTOR_SECRETS_ALLOWLIST` as the only writable env-var catalog.
5. Add focused API tests for every write family.
6. Add focused web tests for placeholder omission and error display.
7. Update F190 AC-C4 and Key Decisions after implementation.

Implemented branch: `feat/f190-im-connector-write`.

## Proof Gate

Before review:

- `pnpm --filter @cat-cafe/api build`
- Focused API connector secret tests
- Focused web connector config tests
- `pnpm check:features`
- `pnpm check:architecture-ownership`
- Red-zone grep for chat/bubble/read-model/service lifecycle/refAudio paths
- Root Artifact Guard
