---
feature_ids: []
topics: [review-request, connector, alpha, dev-isolation]
doc_kind: mailbox
created: 2026-06-11
---

# Review Request: Connector Gateway Alpha/Dev Isolation

Review-Target-ID: connector-gateway-alpha-isolation
Branch: fix/connector-gateway-alpha-isolation
Commit: see branch HEAD

## Original Requirements

Source: current A2A handoff from Landy, 2026-06-10 22:14 America/Los_Angeles.

> 启动 alpha 或者任何 dev 版本的时候也会把 IM 都连接上；runtime 收到是想要的，但是 alpha 环境也都收到了，太恐怖了。

## What Changed

- Added `CONNECTOR_GATEWAY_AUTOSTART`: default behavior is production-only; `NODE_ENV=production` keeps runtime IM autostart enabled, while alpha/dev/test scrub preconfigured IM connector credentials before gateway startup.
- Applied the policy on initial connector gateway startup and hot reload.
- Exported `CONNECTOR_GATEWAY_AUTOSTART=0` from `alpha-worktree.sh` as defense in depth.
- Documented the env var in `.env.example`, `env-registry`, and regenerated `docs/env-reference.md`.
- Stopped the currently running alpha process group after verification; runtime 3001/3002 and Redis 6399/6398 remained running.

## Architecture Ownership

Architecture cell: connector gateway startup / runtime environment isolation.
Map delta: none.
Why: this is a startup policy guard on existing connector gateway boundaries, not a new Store/Queue/Router/Adapter/Dispatcher/Binding.

## Self-Check Evidence

- RED:
  - `bash scripts/alpha-worktree.test.sh` failed before implementation: missing `export CONNECTOR_GATEWAY_AUTOSTART=0`.
  - `connector-gateway-bootstrap.test.js` failed before implementation: missing `applyConnectorGatewayAutostartPolicy` export.
- GREEN:
  - `env -u NODE_ENV pnpm --filter @cat-cafe/api run build` passed.
  - `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/connector-gateway-bootstrap.test.js` passed: 19/19.
  - `bash scripts/alpha-worktree.test.sh` passed.
  - `node --test scripts/check-env-example.test.mjs scripts/check-env-registry.test.mjs` passed: 7/7.
  - `bash -n scripts/alpha-worktree.sh` passed.
  - `git diff --check` passed.
  - `env -u NODE_ENV pnpm lint` passed with existing web warnings only.
  - `env -u NODE_ENV pnpm -r --if-present run build` passed with existing web warnings only.

## Known Gate Caveat

`pnpm check` is blocked by unrelated pre-existing Biome formatting issues under `docs/videos/cucu-pr-flow/...`; none are in this diff.

## Review Focus

1. Is production-only default the correct boundary for runtime vs alpha/dev?
2. Does scrubbing config before `startConnectorGateway` cover both initial startup and hot reload without breaking explicit dev integration tests via `CONNECTOR_GATEWAY_AUTOSTART=1`?
3. Is preserving QR-only gateway behavior in dev the right compromise for connector UI surfaces?
