---
doc_kind: review-request
feature_ids: [F210]
reviewer: opus
author: codex
created: 2026-05-23
---

# Review Request: F210 Phase D — AGY Install / Packaging

Review-Target-ID: f210
Branch: feat/f210-phase-d-install-packaging
PR: https://github.com/zts212653/cat-cafe/pull/1858

## What

Phase D closes the AGY install/packaging layer:

1. Source installers now provision Antigravity CLI as native `agy` through Google's official bootstrapper, not `@google/gemini-cli`.
2. Windows command resolution now includes `%LOCALAPPDATA%\agy\bin\agy.exe`.
3. Desktop offline packages no longer pack the old Gemini CLI npm tarball as the AGY replacement; they ship `agy-install-instructions.txt`.
4. Windows desktop installer/config changed the optional component from Gemini CLI to Antigravity CLI.
5. F210 spec AC-D1/D2/D3 is checked with the Phase D source list and native-binary packaging policy.

## Why

Phase A verified that Antigravity CLI is a native `agy` binary installed by Google's bootstrapper. Phase D must make source installers and desktop packages match that contract before Phase E can run live E2E and before AC-E4 can consider a default adapter switch.

## Original Requirements

> "你专注帮烁烁的cli变得可用吧"  
> "要如何安装啊？ native binary 也能看吧？"  
> "agr 能用了吗？"

- 来源：当前 F210 A2A thread，2026-05-22/23 铲屎官原话；canonical spec: `docs/features/F210-antigravity-cli-migration.md`
- 请对照上面的摘录判断：这版是否把 AGY 从可手动 opt-in 的 adapter 推进到可安装/可打包/可进入 E2E 的状态。

## Tradeoff

- Offline packages intentionally do not vendor AGY until Google publishes a redistributable native binary contract.
- Online installers call the official bootstrapper instead of reusing the legacy Gemini CLI npm package.
- Existing Gemini auth helper logic remains untouched because it belongs to legacy `gemini-cli` provider auth, not AGY carrier provisioning.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This changes installer and packaging paths for the existing Siamese carrier migration. It adds no new router/store/queue/dispatcher/transport boundary.

Please check:
- diff matches `Map delta: none`
- no parallel Store / Queue / Router / Adapter / Dispatcher / Binding was introduced
- `antigravity-cli` remains opt-in; default adapter remains guarded by Phase E/AC-E4

## Open Questions

### Technical OQ

1. Is the offline packaging stance explicit enough: instructions instead of vendoring AGY until a native redistribution contract exists?
2. Are the Windows installer/resolver paths sufficient for `%LOCALAPPDATA%\agy\bin\agy.exe`?
3. Did this keep legacy Gemini auth support separate from AGY carrier provisioning?

### Value OQ

None.

## Next Action

Please review PR #1858. Focus on install-script correctness, Windows native path coverage, and whether desktop offline packaging is honest enough for Phase D.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: `pnpm review:start`
- Ports: not required for this install/packaging review unless reviewer wants an app smoke

## Self-Check Evidence

### Red

```text
node --test scripts/check-env-port-drift.test.mjs
# failed before implementation: source installer still expected Gemini npm CLI carrier semantics

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/build-script-cross-platform.test.js packages/api/test/windows-portable-redis-tools.test.js packages/api/test/cli-resolve.test.js
# failed before implementation: desktop packaging/Windows resolver did not encode AGY native install policy
```

### Green

```text
node --test scripts/check-env-port-drift.test.mjs
# 81 tests, 81 pass, 0 fail

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/build-script-cross-platform.test.js packages/api/test/windows-portable-redis-tools.test.js packages/api/test/windows-portable-redis-lifecycle.test.js packages/api/test/cli-resolve.test.js
# 57 tests pass, 3 skip, 0 fail

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/install-script-platform.test.js
# 25 tests, 25 pass, 0 fail

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --filter @cat-cafe/api test
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm test
# pass

pnpm check
# pass

pnpm lint
# pass; existing web hardcoded-color/react-hook warnings only

pnpm -r --if-present run build
# pass

pnpm check:features
# pass: features=217 backlog_active=61

pnpm check:architecture-ownership
# pass: OK diff architecture nouns; existing warnings only

git diff --check
# pass
```

### Root Artifact Gate

```text
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# no output
```

[砚砚/GPT-5.5🐾]
