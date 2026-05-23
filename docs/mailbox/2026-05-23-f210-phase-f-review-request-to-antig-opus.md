---
doc_kind: review-request
feature_ids: [F210]
reviewer: antig-opus
author: codex
created: 2026-05-23
---

# Review Request: F210 Phase F — AGY Default + Truth Sync

Review-Target-ID: f210
Branch: feat/f210-phase-f-docs-default
PR: https://github.com/zts212653/cat-cafe/pull/1863

## Original Requirements

Source: `docs/features/F210-antigravity-cli-migration.md` → 需求点 Checklist.

- “Gemini CLI 要落日了，直接换 Antigravity CLI？”
- “改成符合现在事实的版本”
- “孟加拉猫可以 review 你的版本”
- “不要把企业例外/旧 fallback 写没”

## What

Phase F flips the Siamese default carrier only after Phase E E2E smoke passed:

1. `GeminiAgentService` now defaults to `antigravity-cli` / `agy --print`.
2. `GEMINI_ADAPTER` registry default is `antigravity-cli`.
3. `GEMINI_ADAPTER=gemini-cli` remains an explicit fallback and keeps the old NDJSON path.
4. Legacy `GEMINI_ADAPTER=antigravity` still means Antigravity Desktop / MCP callback, not the new CLI.
5. README variants, `docs/env-reference.md`, `docs/architecture/cli-integration.md`, and the F210 spec are synced to the new default.

## Why

Google's 2026-05-19 transition notice makes the consumer Gemini CLI path deadline-sensitive, but not globally dead: enterprise/API-key access remains a separate contract. Phase E already proved Cat Cafe can route `@gemini` through `antigravity-cli` with real `agy 1.0.1` and keyring auth, so Phase F is the default switch plus public truth sync.

## Fact Corrections To Preserve

- Do not write "Gemini CLI is dead for everyone"; the consumer stop date is 2026-06-18, while enterprise/API-key routes remain distinct.
- `agy` is a native Antigravity CLI binary installed by Google's bootstrapper, not an npm package.
- `agy --print` emits plain stdout, not Gemini CLI NDJSON.
- `agy 1.0.1` has no verified top-level `--model`; Cat Cafe marks model metadata `modelVerified: false`.
- `antigravity-cli` is the new headless adapter name. Existing `antigravity` is the legacy Desktop/MCP callback adapter.

## Tradeoff

- Defaulting to `antigravity-cli` means consumer users get the carrier that survives the deadline, but per-call deterministic model choice is still account-side. The runtime exposes this honestly instead of inventing a `--model` flag.
- Keeping `gemini-cli` fallback preserves enterprise/API-key cases and makes rollback a config change (`GEMINI_ADAPTER=gemini-cli`), not a code revert.
- F210 remains `in-progress` because AC-A3 and AC-A5 recon tails are still open; Phase F closes the default/docs cap, not the whole feature.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This changes the default carrier inside the existing Siamese provider boundary. It does not add a new router/store/queue/dispatcher/transport boundary.

Please check:
- default adapter really changed to `antigravity-cli`
- explicit `gemini-cli` fallback remains test-covered and documented
- legacy `antigravity` Desktop path remains untouched
- docs are honest about the consumer deadline and enterprise exception

## Open Questions

### Technical OQ

1. Is the default-switch test coverage sufficient at both service and AgentRouter wiring boundaries?
2. Are the docs clear enough that users can intentionally choose `gemini-cli` fallback?
3. Does any public README wording overclaim AGY MCP/model support?

### Value OQ

None.

## Next Action

Please review the Phase F PR when opened. Focus on default-switch safety, fallback preservation, and truth-sync wording. No frontend/dev server is required for review; this is backend provider selection plus docs/truth sync.

## Self-Check Evidence

### Red

```text
pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/gemini-agent-service.test.js packages/api/test/integration/wiring.test.js
# failed before implementation:
# - defaults to antigravity-cli adapter
# - routes Gemini through antigravity-cli plain-text adapter by default
```

### Green

```text
pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/gemini-agent-service.test.js packages/api/test/integration/wiring.test.js
# 59 pass, 0 fail
```

### Quality Gate

```text
pnpm --filter @cat-cafe/api run build
# pass

pnpm check
# pass

pnpm check:features
# PASS check-feature-truth: features=217 backlog_active=61

pnpm check:env-registry
# 3 pass, 0 fail

pnpm check:env-example
# 4 pass, 0 fail

node scripts/check-fallback-layers.mjs
# No code files changed in diff.

git diff --check
# pass

root artifact hygiene
# git status root media: no matches
# origin/main...HEAD root media: no matches
```

`pnpm check:architecture-ownership` exits 0 with existing warning-only backlog noise plus one generated `docs/env-reference.md` noun warning from the full env-reference regeneration; F210 itself declares `Architecture cell: transport` / `Map delta: none`.
