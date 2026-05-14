---
feature_ids: [F199]
related_features: [F190, F136]
topics: [console, settings, push, vapid, github, secrets, proof]
doc_kind: proof
created: 2026-05-14
parent_feature: F199
---

# F199 D-4 + D-5 Push/GitHub Config Write Proof

## Scope

D-4 and D-5 restore the settings write surfaces for existing env-based Web Push and GitHub plugin configuration. This does not add a new push or GitHub config store.

| Requirement | Result |
|---|---|
| Port PushServiceConfig UI | `PushServiceConfig` added under the notify settings page |
| Port GithubConfigPanel UI | `GithubConfigPanel` added under the plugins settings page |
| Write existing runtime env vars | UI saves `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` through `/api/config/secrets` |
| Write existing GitHub env vars | UI saves `GITHUB_TOKEN`, `GITHUB_SETUP_NOISE_BOT_LOGINS`, and `GITHUB_MCP_PAT` through `/api/config/secrets` |
| Generate VAPID keypair | `POST /api/push/generate-vapid` returns one raw keypair to the owner UI |
| Preserve omitted secrets | Contact-only / token-only edits omit untouched secret fields so `.env` keeps existing private keys/tokens |
| Reject redacted placeholders | Backend rejects `••••••`; frontend also blocks submitting the placeholder |
| Owner-gate write surface | Generate and save flows fail closed when `DEFAULT_OWNER_USER_ID` is missing or mismatched |
| Keep audit metadata-only | VAPID save/generate audits contain target/keys/operator, not key values |
| Hot reload push service | VAPID env changes reinitialize the PushNotificationService without restarting the API |

## Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` triggered the F177 Phase D self-check after commit. Rationale:

| File | Why the fallback layers stay |
|---|---|
| `packages/api/src/index.ts` | VAPID is optional runtime env config; default subject and disabled-state reset are the coordinate system, not compensating for an error. |
| `packages/api/src/routes/push-route-helpers.ts` | Fallbacks were moved out of `push.ts` during file split and preserve existing delivery summary / endpoint formatting behavior. |
| `packages/api/src/routes/push.ts` | Live getter fallback keeps tests and older route registration usable while enabling F136 hot reload. |
| `packages/web/src/components/settings/PushServiceConfig.tsx` | UI must tolerate non-JSON errors, network failures, and partial status payloads while preserving the existing diagnostics panel. |
| `packages/web/src/components/settings/GithubConfigPanel.tsx` | UI must tolerate connector status fetch failures, non-JSON errors, and partial GitHub field payloads while preserving the service status list. |

Coordinate conclusion: this is a required optional-config / degraded-network boundary, not wrong-coordinate fallback accumulation. No additional abstraction would remove the layers without making env and UI error handling less explicit.

## Visual Evidence

Assets live under `assets/`.

| Surface | Evidence |
|---|---|
| Notification page VAPID panel | `assets/notify-vapid-panel.png` |
| One-click generate flow | `assets/generate-vapid-keys.png` |
| Saved VAPID config state | `assets/saved-vapid-config.png` |
| Contact-only edit preserving omitted secrets | `assets/contact-only-preserves-secret.png` |
| Owner fail-closed state | `assets/owner-fail-closed.png` |
| Plugins page GitHub card list | `assets/plugins-github-card-list.png` |
| GitHub token config panel | `assets/github-config-panel.png` |
| GitHub token edit flow | `assets/github-token-edit.png` |
| GitHub token saved state | `assets/github-token-saved.png` |
| GitHub owner fail-closed state | `assets/github-owner-fail-closed.png` |
| Capture metadata | `assets/capture-log.json` |
| GitHub capture metadata | `assets/github-capture-log.json` |

Proof was captured from:

```text
worktree: /Users/lysander/projects/relay-station/cat-cafe-f199-d4-push-service-config
notify url: http://localhost:5172/settings?s=notify
plugins url: http://localhost:5172/settings?s=plugins
api: http://localhost:3172
profile: opensource, WORKTREE_PORT_OFFSET=-70, storage=memory
owner: DEFAULT_OWNER_USER_ID=default-user
```

The VAPID proof used production `--prod-web` preview after a local Next watcher `EMFILE` condition. The GitHub proof used `NODE_ENV=development WATCHPACK_POLLING=true` to avoid that watcher failure; the same UI also passes production build.

## Security Proof

| Security boundary | Evidence |
|---|---|
| VAPID vars are explicit allowlist entries | API test writes only the 3 VAPID names through `/api/config/secrets` |
| GitHub vars are explicit allowlist entries | API test writes `GITHUB_TOKEN`, `GITHUB_SETUP_NOISE_BOT_LOGINS`, and `GITHUB_MCP_PAT` through `/api/config/secrets` |
| VAPID private key is preserved on partial edit | API and web tests assert contact-only save omits key fields and keeps the prior private key |
| GitHub secret fields are preserved on partial edit | Web test asserts token-only save omits untouched `GITHUB_MCP_PAT` |
| Redacted placeholder is not writable | API test rejects `VAPID_PRIVATE_KEY=••••••`; web code blocks the same value client-side |
| One-click key generation is owner-only | API tests cover no session, missing owner, and owner success |
| Audit is metadata-only | API tests scan audit JSON and assert VAPID/GitHub values are absent |
| VAPID changes do not restart connector gateway | Connector reload test asserts `VAPID_PUBLIC_KEY` does not trigger connector restart |
| Push status uses live config | Route test mutates live getters and confirms status/public-key endpoints reflect reloaded service |

Disclosure: `owner-fail-closed.png` and `github-owner-fail-closed.png` use Playwright-intercepted 403 responses for `/api/config/secrets` to prove UI rendering without restarting the proof server. The real fail-closed route behavior is covered by API tests.

## User Visibility Disclosure

| User-visible change | User impact | Status |
|---|---|---|
| Notify settings now include a VAPID config panel | Users can configure push without editing `.env` by hand | Shipped in branch |
| Generate button creates VAPID keys server-side | Users do not need openssl/manual web-push tooling | Shipped in branch |
| Plugins settings now include a GitHub config panel | Users can configure GitHub token/noise/MCP PAT without editing `.env` by hand | Shipped in branch |
| Save writes existing runtime env vars | Config remains compatible with current push service startup/env semantics | Shipped in branch |
| Partial edits preserve secrets | Users can update the subject email or GitHub token without clearing untouched private keys/tokens | Shipped in branch |
| Owner misconfiguration is explicit | Users see `DEFAULT_OWNER_USER_ID` guidance instead of a generic save error | Shipped in branch |
| Raw generated private key is transient | It appears only in the owner UI before save; after save, key inputs are cleared | Shipped in branch |

## Verification

Commands run from the D-4 worktree unless noted.

```text
pnpm --filter @cat-cafe/api run build
PASS

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/config-secrets.test.js packages/api/test/push-routes.test.js packages/api/test/connector-reload-subscriber.test.js packages/api/test/connector-secrets-allowlist.test.js packages/api/test/connector-status.test.js
PASS 67 focused API tests

pnpm --dir packages/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/settings/__tests__/PushServiceConfig.test.ts src/components/settings/__tests__/GithubConfigPanel.test.ts src/components/__tests__/push-settings-panel.test.ts src/components/__tests__/plugins-content-services.test.ts
PASS 17 focused web tests

pnpm check
PASS

node scripts/check-fallback-layers.mjs
PASS exit 0; F177 self-check triggered and documented above

pnpm --filter @cat-cafe/api test
PASS 10845 tests; 10842 pass, 3 skipped, 0 fail

pnpm --filter @cat-cafe/web test
PASS 407 Vitest files / 3064 Vitest tests; next-config node tests pass; no-hardcoded-colors pass

pnpm --filter @cat-cafe/web build
PASS

pnpm dev:direct -- --memory --prod-web
PASS; production preview used for visual proof
```

The first production build attempt caught a TypeScript narrowing issue in `PushServiceConfig`; the final proof was captured after fixing it.

The first full API test run caught the `CONNECTOR_SECRETS_ALLOWLIST` size sentinel still expecting 20 entries. D-4 + D-5 intentionally add 3 VAPID env vars and 3 GitHub env vars, so the test now asserts `26` total entries and separately verifies connector gateway reload keys remain connector-only at `20`.
