# Review Request: F199 D-4 + D-5 Push/GitHub Config Write

Review-Target-ID: f199
Branch: feat/f199-d4-push-service-config

## What

Ports the notification and GitHub plugin settings write surfaces back into Console:

- Adds `PushServiceConfig` to the existing notify settings panel.
- Adds `GithubConfigPanel` to the existing plugins settings panel.
- Saves the existing env-based Web Push keys through `/api/config/secrets`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Saves the existing GitHub plugin env keys through `/api/config/secrets`: `GITHUB_TOKEN`, `GITHUB_SETUP_NOISE_BOT_LOGINS`, `GITHUB_MCP_PAT`.
- Adds owner-gated `POST /api/push/generate-vapid` for one-click VAPID keypair generation.
- Preserves omitted VAPID/GitHub secrets on partial edits and rejects the `••••••` placeholder on both client and backend paths.
- Hot-reloads `PushNotificationService` when VAPID env values change, without restarting the connector gateway.
- Adds visual proof and User Visibility Disclosure under `docs/discussions/2026-05-14-f199-d4-push-service-config-proof/`.

## Why

F199 D-4 is the direct fix for the notify settings page being a diagnostics-only matrix. D-5 restores the GitHub plugin token write panel. Both systems already use env vars; this combined PR gives users UI write paths instead of hand-editing `.env`.

## Original Requirements（必填）

> "图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？"
> "走 Phase D 用 -> 完整 backfill 7 个组件"
> D-4: "VAPID 公私钥写入面板 + 一键生成 + contact email"
> D-5: "GitHub token 写入面板"
> D-4 是 CVO 截图里指出的"通知页变成诊断矩阵"的直接修复
> CVO 2026-05-14: "不允许把别人做的东西丢了" + confirmed D-4/D-5 single PR

- 来源：`docs/features/F199-console-parity-backfill.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官指出的 notify/plugins settings parity gap**

## Tradeoff

- The persisted source of truth remains `.env`; this does not introduce a new push config store.
- Raw generated VAPID private key is returned to the owner UI once before save. After save, status/edit flows do not echo it back.
- Existing browser push subscriptions can become invalid if users regenerate VAPID keys. This matches Web Push semantics and is acceptable because regeneration is an explicit owner action.
- VAPID and GitHub values are added to the config secrets allowlist, but connector gateway reload keys stay connector-only so push/GitHub config edits do not restart IM connectors.

## Architecture Ownership（必填）

Architecture cell: action-plane
Map delta: none
Why: This extends existing Console settings write surfaces and reuses the existing `/api/config/secrets` env-write path plus existing push/GitHub env consumers; it does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, or config owner.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- `subscriptionStore` in `packages/api/src/index.ts` / `IPushSubscriptionStore` in `push.ts` 是既有 push route 依赖注入，不是新增并行 Store
- VAPID env writes do not accidentally restart connector gateway

## Open Questions

### 技术 OQ（给 reviewer）

- `POST /api/push/generate-vapid` 的 owner-gate 是否足够严格：session-only identity，no trusted header fallback，`DEFAULT_OWNER_USER_ID` missing 403。
- Raw generated private key one-time response 是否是合理边界，且 audit / status / save response 不泄露 key value。
- `/api/config/secrets` 对 VAPID/GitHub 的 allowlist + redacted placeholder rejection + omitted secret preservation 是否完整。
- `configurePushServiceFromEnv` hot reload 是否安全：VAPID configured 时重建 push service，missing keys 时 reset；connector reload subscriber 不监听 VAPID。
- UI 对 owner fail-closed、placeholder omit-preserve、contact-only/token-only edit 的处理是否足够清楚。

### 价值 OQ（给 CVO，如有）

无。D-4/D-5 combined scope 来自 CVO 2026-05-14 决策：不砍 D-5，合并 PR，保留现有 env-based 配置体系。

## Next Action

请 Opus 4.7 review D-4 + D-5。重点看 VAPID/GitHub secret-write 边界、hot reload 边界、proof matrix，以及 allowlist 扩展是否保持 connector reload 隔离。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f199/opus-47`
- Start Command: `pnpm review:start`（或在本 branch 运行 focused tests + production preview proof）
- Proof Ports: `home web=5172`, `api=3172`（worktree `dev:direct -- --memory --prod-web` production preview，已停止）

## 自检证据

### Spec 合规

| Check | Status | Evidence |
|---|---|---|
| F199 D-4 scope | ✅ | notify settings now includes VAPID write panel + one-click generate + contact email |
| F199 D-5 scope | ✅ | plugins settings now includes GitHub token/noise/MCP PAT write panel |
| Existing env model preserved | ✅ | save flow writes `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` via `/api/config/secrets` |
| GitHub env model preserved | ✅ | save flow writes `GITHUB_TOKEN` / `GITHUB_SETUP_NOISE_BOT_LOGINS` / `GITHUB_MCP_PAT` via `/api/config/secrets` |
| Owner fail-closed | ✅ | API tests cover no-session, missing owner, header-only rejection, owner success |
| Secret preservation | ✅ | contact-only/token-only edits omit untouched VAPID/GitHub secret fields |
| Redacted placeholder rejection | ✅ | API rejects `VAPID_PRIVATE_KEY=••••••`; UI blocks placeholder submit |
| Audit metadata-only | ✅ | config save and generate audit tests assert raw VAPID/GitHub values are absent |
| Hot reload | ✅ | VAPID env change reinitializes push service; VAPID key does not trigger connector gateway restart |
| Visual proof matrix | ✅ | VAPID screenshots + GitHub screenshots + capture logs in proof assets |
| File size guard | ✅ | `push.ts` 345 lines; `PushServiceConfig.tsx` 221 lines; `GithubConfigPanel.tsx` under 200 lines |
| Fallback self-check | ✅ | Triggered by optional env/live getter/UI network tolerance; documented in proof README |
| Architecture ownership | ✅ | `check:architecture-ownership` exits 0; warning-only existing docs plus noted push dependency-injection noun |
| Root artifact guard | ✅ | root media/design artifact checks returned no output |

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# exit 0

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/config-secrets.test.js packages/api/test/push-routes.test.js packages/api/test/connector-reload-subscriber.test.js packages/api/test/connector-secrets-allowlist.test.js packages/api/test/connector-status.test.js
# 67 focused API tests pass

pnpm --dir packages/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/settings/__tests__/PushServiceConfig.test.ts src/components/settings/__tests__/GithubConfigPanel.test.ts src/components/__tests__/push-settings-panel.test.ts src/components/__tests__/plugins-content-services.test.ts
# 17 focused web tests pass

pnpm --filter @cat-cafe/api test
# tests 10845; pass 10842; fail 0; skipped 3

pnpm --filter @cat-cafe/web test
# Vitest: 407 files passed; 3064 tests passed; next-config node tests passed; no-hardcoded-colors passed

pnpm --filter @cat-cafe/web build
# exit 0

pnpm check
# exit 0

git diff --check
# exit 0

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# exit 0; F177 self-check triggered and documented in D-4 proof README

pnpm check:architecture-ownership
# exit 0; warning-only, see Architecture Ownership section
```

### 相关文档

- Feature: `docs/features/F199-console-parity-backfill.md`
- D-4/D-5 proof: `docs/discussions/2026-05-14-f199-d4-push-service-config-proof/README.md`
- D-3a proof: `docs/discussions/2026-05-13-f199-d3a-capability-write-hardening-proof/README.md`
- D-3b proof: `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/README.md`
