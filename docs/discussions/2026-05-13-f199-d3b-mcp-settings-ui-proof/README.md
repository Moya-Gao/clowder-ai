---
feature_ids: [F199]
related_features: [F190, F146, F193]
topics: [console, settings, mcp, capability, parity, proof]
doc_kind: proof
created: 2026-05-14
parent_feature: F199
---

# F199 D-3b MCP Settings UI Parity Proof

## Scope

D-3b restores the MCP settings surface on top of the D-3a hardened backend. This proof covers the frontend parity slice only.

| Requirement | Result |
|---|---|
| Port `capability-settings-ui.tsx` controls | `ProjectSelector`, per-cat toggles, and source-style toggle primitives added |
| Port restricted `useCapabilityState` | MCP-only hook added; no Skills write actions are exposed |
| Port `McpConfigModal.tsx` and form helpers | Managed read-only modal, external edit modal, and add-preview flow added |
| Replace `McpManageContent` wrapper | `/settings?s=mcp` now uses the source-style MCP settings UI, not `HubCapabilityTab` |
| Do not port `InstallPreviewModal` | Not imported or rendered; service lifecycle install remains outside F199 |
| Handle D-3a fail-closed writes | Owner-gate 403 is rendered as explicit `DEFAULT_OWNER_USER_ID` guidance |
| Preserve redacted secrets | `••••••` env/header values are omitted from edit payloads instead of being written back |

## Visual Evidence

Assets live under `assets/`.

| Surface | Evidence |
|---|---|
| MCP card list | `assets/mcp-card-list.png` |
| Managed MCP read-only modal | `assets/managed-readonly-modal.png` |
| External MCP edit modal | `assets/external-edit-modal.png` |
| Add MCP preview flow | `assets/add-preview-flow.png` |
| Owner fail-closed state | `assets/owner-fail-closed.png` |
| Mobile card list | `assets/mobile-mcp-card-list.png` |
| Interaction recording | `assets/mcp-settings-flow.webm` |
| Capture metadata | `assets/capture-log.json` |

Production proof was captured from:

```text
worktree: /Users/lysander/projects/relay-station/cat-cafe-f199-d3b-mcp-settings-ui
url: http://localhost:5132/settings?s=mcp
api: http://localhost:3132
profile: opensource, WORKTREE_PORT_OFFSET=-30
```

The dev server path hit a Next dev CSS loader/EMFILE parse failure while production build passed. For this proof, I used a production `start:direct` preview so the screenshots match the build artifact that users get.

## Security Proof

| Security boundary | Evidence |
|---|---|
| Board payload is sanitized | API test asserts `/api/capabilities` does not include raw env/header secrets and does include redacted values plus `envKeys` |
| Edit modal preserves omitted secrets | Web test asserts external edit payload omits unchanged `••••••` env/header values |
| Owner gate failure is visible | Web test and `owner-fail-closed.png` show `DEFAULT_OWNER_USER_ID` guidance |
| Soft delete remains home behavior | Web test asserts external MCP delete does not append `hard=true` |

Disclosure: local production preview had `DEFAULT_OWNER_USER_ID=default-user`, so the fail-closed screenshot uses a Playwright-intercepted 403 response with CORS headers to prove UI rendering. Real route fail-closed behavior is covered by D-3a API tests and the D-3b web error-state test.

## User Visibility Disclosure

| User-visible change | User impact | Status |
|---|---|---|
| `/settings?s=mcp` now shows source-style MCP cards | Users can scan MCP server state without entering the old capability hub | Shipped in branch |
| Managed MCP modal is read-only | Users can inspect resolver-backed MCP metadata and tool list without accidental writes | Shipped in branch |
| External MCP modal is editable | Users can update command/env/header configuration through the hardened D-3a route | Shipped in branch |
| New MCP flow requires preview before install | Users see affected CLI config before install; install remains owner-gated | Shipped in branch |
| Owner misconfiguration is explicit | Users see `DEFAULT_OWNER_USER_ID` guidance instead of a generic failure | Shipped in branch |
| Mobile settings shell no longer squeezes content into vertical text | Narrow screens show settings nav above content instead of collapsing cards into unreadable columns | Shipped in branch |
| Skills writes remain absent | D-2 SkillsContent read-mostly promise is preserved | Explicitly out of scope |
| Service lifecycle install modal remains absent | `InstallPreviewModal` is still reclassified outside F199 | Explicitly out of scope |

## Verification

Commands run from the D-3b worktree unless noted.

```text
node packages/web/scripts/run-with-node-env-test.mjs pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/mcp-manage-content.test.ts
PASS 6/6

pnpm --filter @cat-cafe/web test
PASS 405 files, 3055 tests

pnpm --filter @cat-cafe/web build
PASS

pnpm --filter @cat-cafe/api build
PASS

(cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/capabilities-route.test.js test/config/capabilities/capabilities-mcp-write-route.test.js)
PASS 48 tests
```

Final gate commands after this proof document was added:

```text
pnpm check
PASS (feature index regenerated after F199 proof link update)

git diff --check
PASS

node scripts/check-hotfix-pattern.mjs
PASS (no hotfix pattern)

node scripts/check-fallback-layers.mjs
PASS (no added fallback-layer threshold)

pnpm check:architecture-ownership
PASS exit 0; existing repository warnings only, no diff architecture noun mismatch

git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
PASS (no root media/design artifacts)

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
PASS (no committed root media/design artifacts)
```

## Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` exits 0 but triggers the F177 Phase D self-check because this slice adds a new modal, hook, and form helpers with optional MCP data. This is not patching a wrong coordinate system:

1. The coordinate system is "MCP settings form state over sanitized capability board data". Optionality is intrinsic: managed MCP entries are read-only, external entries may have `env`/`headers`/`url`, add flow has no preview until requested, and D-3a responses may be 403.
2. The main coordinate transform was already applied: `McpConfigModal.tsx` was split into logic + sections + panels so empty-state/default handling is local to the UI element that owns it. The largest new modal file is now 293 lines; no new file exceeds the 350-line hard limit.
3. The remaining fallbacks are display defaults (`—`, `无`), controlled-input defaults, and fail-closed error parsing. Removing them would either make controlled inputs uncontrolled, hide required empty states, or replace actionable D-3a errors with generic network failures.
