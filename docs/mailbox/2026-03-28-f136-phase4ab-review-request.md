---
doc_kind: review-request
feature_ids: [F136]
created: 2026-03-28
---

# Review Request: F136 Phase 4a+4b — Single Source of Truth for Provider Config

## What

New unified account config layer replacing dual provider-profiles.json + cat-config sources:

- `AccountConfig` + `CredentialEntry` types in `@cat-cafe/shared`
- `credentials.ts` — global keychain at `~/.cat-cafe/credentials.json` (HC-1: object structure, 0o600 perms)
- `catalog-accounts.ts` — CRUD for `accounts` section in `cat-catalog.json` (HC-2: single runtime write source)
- `migrate-provider-profiles.ts` — one-time migration from old `provider-profiles.json` (HC-3: no delete)
- `account-conflict-guard.ts` — cross-project conflict detection (HC-5: startup + write-path, baseUrl normalize)
- `account-resolver.ts` — unified resolution: accounts + credentials first, legacy fallback
- `provider-profiles.ts` — rewired `resolveRuntimeProviderProfile*` to try new path first
- `LlmAIProvider.ts` — reads credentials instead of raw `process.env.*_API_KEY`
- `routes/provider-profiles.ts` — dual-write to new storage on POST/PATCH/DELETE

## Why

F136 core vision: eliminate the dual source of truth between `provider-profiles.json` and `cat-config`. After this change, `cat-catalog.json` accounts section is the single source of truth for provider metadata, `credentials.json` is the pure keychain, and the old provider-profiles path is a legacy fallback only.

HC-5 constraint: 4a + 4b must land in the same PR to avoid half-migrated dual-track state.

## Original Requirements

> "你们怎么特么讨论讨论着把最初愿景直接忘记了？我们的最终状态是允许两个真相源头吗？"
> "任意一个api 支持 anthropic 我都能给 claude code 用, 任意支持 codex openai 的 api 都能给 codex 用"
> "cat-config.yaml 不在 git 只有 example 在 git"
> "env 里现在有让人配置 apikey 也很奇葩 看的不知道到底哪里配置"

- 来源：铲屎官 2026-03-28 session (F136 Phase 4 decision convergence)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 4b keeps dual-write (old provider-profiles + new accounts) rather than cutting over completely. This allows rollback safety — Phase 4d will remove the old infrastructure after one version window.
- Hub UI deprecation hints deferred — API response format unchanged, so no frontend breakage.

## Open Questions

1. HC-5 conflict guard scans `known-project-roots.json` synchronously at startup and write-path. For repos with many known roots, this could add latency. Acceptable?
2. Migration marker is at global level (`~/.cat-cafe/accounts-migration-done.json`). Should it be per-project?
3. `LlmAIProvider` now reads `readCredential('claude')` / `readCredential('codex')` with hardcoded account refs. Should these be dynamic from the cat's accountRef?

## Next Action

Review for P1/P2 issues. Focus on:
- HC-1~5 compliance
- Migration safety (no data loss path)
- Resolution chain correctness (new resolver + legacy fallback)

## Review Metadata

Review-Target-ID: f136-phase4
Branch: feat/f136-phase4-single-source-of-truth

## Self-check Evidence

### Spec Compliance
Plan: `docs/plans/2026-03-28-f136-phase-4abcd-single-source-of-truth.md`
All 4a + 4b ACs verified against plan. See quality-gate report in session.

### Test Results
```
pnpm gate → GATE PASSED (SHA ac02303a)
  build: all packages exit 0
  tests: 77/77 pass (40 new + 37 existing)
  lint: 0 errors
  check: 0 errors (biome)
```

New test files (40 tests total):
- `test/credentials-store.test.js` — 11 tests
- `test/catalog-accounts.test.js` — 7 tests
- `test/account-conflict-guard.test.js` — 8 tests
- `test/migrate-provider-profiles.test.js` — 6 tests
- `test/account-resolver.test.js` — 8 tests

### Related Documents
- Plan: `docs/plans/2026-03-28-f136-phase-4abcd-single-source-of-truth.md`
- Spec: `docs/features/F136-unified-config-hot-reload.md`
- HC-1~5: codex + gpt52 review in session
