---
doc_kind: review-request
feature_ids: [F136]
created: 2026-03-28
author: opus
reviewer: codex
---

# Review Request: F136 Phase 4c+4d — AccountBindingSubscriber + delete legacy provider-profiles

Review-Target-ID: f136-phase-4cd
Branch: feat/f136-phase-4cd

## What

Phase 4c: New `AccountBindingSubscriber` watches `ConfigChangeEvent(source:'accounts')` and rebinds affected cats via the new accounts system.

Phase 4d: Delete 4 legacy provider-profiles files (-1727 LOC) and migrate all consumers:
- **Deleted**: `provider-profiles.ts`, `provider-profiles.types.ts`, `provider-profiles-root.ts`, `provider-binding-compat.ts`
- **New**: `account-resolver.ts` consolidates all resolution (sync), `account-binding-subscriber.ts` handles hot-reload
- **Migrated**: `invoke-single-cat.ts`, `cats.ts` route, `provider-profiles.ts` route, all test imports

Net: -2172 LOC across 26 files.

## Why

F136 goal: single source of truth for provider config. Phase 4a+4b established the new `cat-catalog.json` accounts + `credentials.json` stores. Phase 4c+4d removes the old store so there's no dual-path ambiguity.

## Original Requirements

> "你们怎么特么讨论讨论着把最初愿景直接忘记了？我们的最终状态是允许两个真相源头吗？"
> "任意一个 api 支持 anthropic 我都能给 claude code 用，任意支持 openai 的 api 都能给 codex 用"
> "cat-config.yaml 不在 git 只有 example 在 git"

- 来源：`docs/features/F136-unified-config-hot-reload.md` (lines 19-34)
- **请对照上面的摘录判断：Phase 4d 删除旧 provider-profiles 后是否只剩一个真相源？**

## Tradeoff

- `builtinAccountIdForClient` returns legacy IDs (`claude`/`codex`/`gemini`) instead of `builtin_*` — preserves backward compat with existing catalogs and seed data; `BUILTIN_ACCOUNT_MAP` in account-resolver.ts maps both conventions
- `resolveRuntimeAccount` in invoke-single-cat.ts adds `await Promise.resolve()` yield to preserve event loop ordering for preflight warning delivery (async→sync migration side effect)

## Open Questions

1. **Migration completeness**: `readBootstrapBindingsLegacy` still reads from legacy `provider-profiles.json` for bootstrap binding detection. This is intentional (needed until all users have migrated). Is the fallback logic sound?
2. **Test helper bootstrapping**: `create-test-account.js` now calls `bootstrapCatCatalog` dynamically. Is the try-catch for invalid templates (`{}`) too permissive?

## Next Action

Please review code quality, security (credential handling), and spec compliance. Focus on `account-resolver.ts` (core resolution logic) and `invoke-single-cat.ts` (async→sync migration).

## 自检证据

### Spec 合规

- HC-4 exit conditions:
  - `grep -r 'process.env.*API_KEY'` in business code: only env-fallback in account-resolver.ts (new canonical location) + server bootstrap in index.ts
  - Legacy provider-profiles files: 4 deleted, 0 remaining imports
  - Full test suite: 6465/6465 pass (was 6459 failures during migration, all fixed)
  - `pnpm gate`: PASSED (SHA e29cb149)

### 测试结果

```
pnpm --filter @cat-cafe/api test    # 6465 passed, 0 failed
pnpm gate                           # GATE PASSED (SHA e29cb149)
```

### 相关文档

- Plan: `docs/plans/2026-03-28-f136-phase-4abcd-single-source-of-truth.md`
- Feature: F136 / `docs/features/F136-unified-config-hot-reload.md`
- Phase 4a+4b PR: #818 (merged)
