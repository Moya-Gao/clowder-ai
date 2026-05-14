---
title: F199 D-3a Capability Write Hardening Proof
feature: F199
slice: D-3a
date: 2026-05-13
owner: "@codex"
reviewer: "@opus-47"
doc_kind: proof
topics: [console, capability-write, audit-redaction, owner-gate]
---

# F199 D-3a Capability Write Hardening Proof

## Scope

D-3a is backend hardening only. It does not claim MCP settings visual parity; D-3b will own the UI parity work after this secure backend lands.

Covered write routes:

- `PATCH /api/capabilities`
- `POST /api/capabilities/mcp/preview`
- `POST /api/capabilities/mcp/install`
- `DELETE /api/capabilities/mcp/:id`
- `PATCH /api/capabilities/mcp/:id/env`

Read routes stay read-only:

- `GET /api/capabilities`
- `GET /api/capabilities/audit`

## Security Boundary

| Boundary | D-3a result |
|---|---|
| Identity | Capability write routes require real `request.sessionUserId`; `X-Cat-Cafe-User` alone is rejected |
| Owner | Capability writes fail closed when `DEFAULT_OWNER_USER_ID` is missing |
| Non-owner | Session user different from `DEFAULT_OWNER_USER_ID` gets 403 |
| MCP preview | Treated as write-equivalent because it accepts secret-like payload |
| Redacted placeholder | Existing `••••••` write rejection preserved |
| Omitted secrets | External MCP update preserves omitted env/header secrets in config |
| Audit | `before` / `after` shape preserved, but `mcpServer.env` and `mcpServer.headers` values are redacted before JSONL append and readback |
| API response | Write responses redact `mcpServer.env` and `mcpServer.headers` values |
| F193 | Heal-before-write remains in install/delete/env/toggle paths |

## User Visibility Disclosure

| User-visible surface | D-3a result |
|---|---|
| MCP settings UI layout | No visual change in D-3a |
| MCP preview/install/delete/toggle/env writes | Owner-only and fail-closed when owner is not configured |
| Error state without owner config | API returns 403 with `DEFAULT_OWNER_USER_ID` guidance; D-3b should render this clearly |
| Audit log display | Existing before/after entries remain visible, but env/header values show redacted marker |
| Secret persistence | Raw env/header values remain stored in `capabilities.json` for runtime use |
| Service lifecycle install modal | Still not in F199; reclassified out as service lifecycle write |
| Skills toggle/uninstall | Still not wired in D-3; D-2 remains read-mostly |

## Verification

Focused commands run before review:

```bash
pnpm --filter @cat-cafe/api build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/config/capabilities/capabilities-mcp-write-route.test.js test/capabilities-route.test.js
```

Focused test result:

- `packages/api/test/config/capabilities/capabilities-mcp-write-route.test.js`: 13/13 pass
- `packages/api/test/capabilities-route.test.js`: route and capability tests pass in package cwd

Additional gate evidence is recorded in the review request / quality-gate report.
