---
feature_ids: [F210]
review_target_id: f210
branch: feat/f210-agy-profile-smoke
created: 2026-05-31
---

# Review Request: F210 AGY Profile E2E Smoke Runner

Review-Target-ID: f210
Branch: feat/f210-agy-profile-smoke
HEAD: 02aa2cb02

## What

Adds a repeatable AC-G2 smoke runner:

- `packages/api/src/scripts/f210-agy-profile-smoke.ts`
- root script `pnpm f210:agy-profile-smoke`
- unit coverage for target matrix, marker/model verification, auth-required redaction, and pnpm `--` passthrough
- F210 docs note + asset doc explaining the onboarding boundary

The runner uses the production `GeminiAgentService` + `agyProfile` path for:

- `Claude Opus 4.6 (Thinking)`
- `Gemini 3.1 Pro (High)`
- `Gemini 3.5 Flash (High)`

## Why

AC-G2 needs live proof that independently onboarded AGY profiles can run without sticky-state bleed. PR #2004 built the sandbox/preflight layer and PR #2007 closed selector recon; this slice makes the remaining live proof repeatable without pretending AC-G2 is complete.

## Original Requirements

> 那我们规划一下？ 看看哪些现在agy局限下可以做的？
> 那你把这些记录到f210的md里面？ 然后请你找 opus 帮你拆任务让46帮你拆pr

- 来源：本 thread，2026-05-31 14:14 / 14:20 UTC；F210 scope in `docs/features/F210-antigravity-cli-migration.md`
- 请对照：当前 AGY 限制下先做可验证 smoke runner，不关闭 AC-G2，不暴露 user-facing cats。

## Tradeoff

I did not run `--run-live` in this PR. That would block on per-profile OAuth/onboarding and is the external condition AC-G2 is explicitly waiting for. The runner defaults to dry-run and requires `--run-live` to invoke AGY.

## Architecture Ownership

Architecture cell: transport
Map delta: none
Why: adds a scripted smoke harness over the existing `GeminiAgentService`/AGY profile path; no new runtime store, queue, adapter, dispatcher, or binding.

Please check:

- diff matches `Map delta: none`
- no parallel AGY adapter or fake model setter was introduced
- user-facing AC-G2 remains open until live onboarded profiles pass

## Open Questions

### Technical OQ

- Is the smoke summary strict enough: marker text + `modelVerified: true` + exact observed AGY log label?
- Is using `INIT_CWD` to preserve root invocation directory acceptable with the env-registry allowlist?
- Does the review agree that `--run-live` should remain explicit because it triggers AGY/OAuth state?

### Value OQ

无。

## Next Action

Please review `02aa2cb02`. If approved, I will run merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: `pnpm review:start` if you want an isolated sandbox; no dev server is required for this script/docs review.
- Ports: N/A; do not use 3001/3002 for this review.

## 自检证据

### Spec 合规

- AC-G2 remains `[ ]`.
- Runner target matrix covers Opus 4.6 Thinking / Gemini 3.1 Pro High / Gemini 3.5 Flash High.
- F210 doc states live onboarding is still external and AC-G2 needs a passing `--run-live` report before exposure.
- Dogfood: `pnpm f210:agy-profile-smoke -- --home-root=/tmp/f210-agy-test` returned `ok: true`, `stage: dry_run`, with all three target labels and markers.
- Architecture ownership: `pnpm check:architecture-ownership` exit 0; warning-only existing repo warnings, `OK diff architecture nouns`.
- Hotfix pattern: `hotfix=false`.
- Fallback layers: +1 net in the new script after refactor; no threshold trigger.

### 测试结果

```bash
pnpm --dir packages/api build && \
  CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/f210-agy-profile-smoke.test.js
# pass: 5, fail: 0

pnpm f210:agy-profile-smoke -- --home-root=/tmp/f210-agy-test
# ok: true, stage: dry_run

pnpm check
# All 20 checks passed

REDIS_URL=redis://localhost:6398 pnpm audit:feature-docs
# docs=226 green=208 yellow=15 red=3; generated F094 audit side effects restored

git diff --check
# pass
```

### 相关文档

- Feature: `docs/features/F210-antigravity-cli-migration.md`
- New asset: `docs/features/assets/F210/phase-g-agy-profile-e2e-smoke-runner-2026-05-31.md`
- Prior runtime slice: PR #2004
- Prior selector recon: PR #2007
