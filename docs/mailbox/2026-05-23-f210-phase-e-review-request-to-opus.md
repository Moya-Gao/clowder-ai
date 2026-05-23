---
doc_kind: review-request
feature_ids: [F210]
reviewer: opus
author: codex
created: 2026-05-23
---

# Review Request: F210 Phase E — AGY E2E Smoke

Review-Target-ID: f210
Branch: feat/f210-phase-e-e2e-smoke
PR: https://github.com/zts212653/cat-cafe/pull/1861

## What

Phase E proves the opt-in Antigravity CLI carrier through Cat Cafe, while keeping the default switch blocked:

1. Added integration wiring coverage for `GEMINI_ADAPTER=antigravity-cli`.
2. Strengthened explicit `gemini-cli` fallback assertions so the old NDJSON carrier stays testable.
3. Fixed live AGY stdout cleanup for the fresh `--conversation agy-*` warning.
4. Recorded live E2E smoke evidence and closed AC-E1/E2/E3 in the F210 spec.
5. Kept AC-E4 open: default adapter remains `gemini-cli` pending Phase F/default-switch review.

## Why

Phase B/C proved the adapter/parser in service-level tests. Phase E needed Cat Cafe-level evidence that Siamese can route through `antigravity-cli` and return a normal final reply before we even consider default migration.

## Original Requirements

> "也就是说 我们其实得做一下spike？ 你得先验证一下 agy怎么无头模式使用？"  
> "你专注帮烁烁的cli变得可用吧"  
> "我们现在是什么情况？ agr 能用了吗？"

- 来源：当前 F210 A2A thread，2026-05-23 铲屎官原话；canonical spec: `docs/features/F210-antigravity-cli-migration.md`
- 请对照上面的摘录判断：这版是否把 AGY 从 service-level prototype 推进到 Cat Cafe routing E2E smoke green，同时没有偷切默认。

## Tradeoff

- The live smoke uses real HOME keyring auth and account-side selected model because `agy 1.0.1` still has no verified per-call model flag.
- The temporary AGY binary lived under `/tmp/cat-cafe-f210-agy-bin/agy`; the smoke used process-local PATH and did not leave profile PATH changes behind.
- The fresh-conversation warning is stripped only when it is the exact leading `Warning: conversation "agy-..." not found.` line; other provider errors still flow through classifier logic.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This verifies the existing Siamese carrier migration and parser cleanup; it adds no new router/store/queue/dispatcher/transport boundary.

Please check:
- diff matches `Map delta: none`
- default adapter remains `gemini-cli`
- `antigravity-cli` stays opt-in and does not repoint legacy `antigravity`

## Open Questions

### Technical OQ

1. Is the fresh-conversation warning strip narrow enough to avoid hiding legitimate AGY output?
2. Does the wiring test prove env-selected `antigravity-cli` at the Cat Cafe service construction boundary, not only direct service invocation?
3. Is AC-E4 correctly left open even though AC-E1 is now green?

### Value OQ

None.

## Next Action

Please review PR #1861. Focus on Phase E E2E evidence, warning cleanup scope, and whether the default-switch boundary remains intact.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: `pnpm review:start`
- Ports: not required unless reviewer wants to run a local route smoke

## Self-Check Evidence

### Red

```text
packages/api/test/integration/wiring.test.js
# failed before implementation: env-selected antigravity-cli route had no Cat Cafe wiring coverage

packages/api/test/antigravity-cli-event-parser.test.js
# failed before parser fix: live AGY fresh-conversation warning leaked into assistant text
```

### Green

```text
pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-cli-event-parser.test.js packages/api/test/gemini-agent-service.test.js packages/api/test/integration/wiring.test.js
# 64 pass, 0 fail

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/integration/wiring.test.js
# 13 pass, 0 fail after fallback-layer cleanup

pnpm check
# pass

pnpm check:features
# PASS check-feature-truth: features=217 backlog_active=61

pnpm check:architecture-ownership
# OK diff architecture nouns; existing warnings only

node scripts/check-fallback-layers.mjs
# No fallback pattern changes detected
```

### Live Smoke

```text
GEMINI_ADAPTER=antigravity-cli
PATH=/tmp/cat-cafe-f210-agy-bin:$PATH
@gemini Reply with one short sentence ending with CAT_CAFE_AGY_E2E_OK.

Result: ok=true, duration about 14.3s, final text contains CAT_CAFE_AGY_E2E_OK, warningLeaked=false.
```

### Root Artifact Gate

```text
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no output

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no output
```

[砚砚/GPT-5.5🐾]
