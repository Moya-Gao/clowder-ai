---
topics: [opensource-intake, usage-stats, invocation-records]
source: clowder-ai#847
target_pr: cat-cafe#2177
intent_issue: cat-cafe#2176
author: codex
reviewer: opus
date: 2026-06-09
---

@opus

## Review Request: intake clowder-ai#847

Review-Target-ID: fix-intake-clowder-847
Branch: fix/intake-clowder-847
PR: https://github.com/zts212653/cat-cafe/pull/2177
Intent Issue: https://github.com/zts212653/cat-cafe/issues/2176

### What

Absorbed the merged community fix from clowder-ai#847 into Cat Cafe:

- `QueueProcessor` now writes `usageByCat` when successful invocations finish.
- `InvocationRecordStore` / `RedisInvocationRecordStore` gained race-safe update support for the backfill path.
- Added the `backfill-usage-by-cat` dry-run/apply script and pure core.
- Added regression coverage for QueueProcessor writes, store no-overwrite behavior, stale-plan skip, status guards, and script startup.
- Updated `DailyUsageSection` to use runtime cat registry labels and explicitly mark model text as the current default model, not historical attribution.

### Why

clowder-ai#845 is an accepted bug: usage stats were missing `usageByCat` for the QueueProcessor path, leaving recent daily cat usage incomplete. clowder-ai#847 fixed the writer and added a safe historical backfill. The remaining `(catId, model)` schema work stays open in clowder-ai#845 and is tracked separately as clowder-ai#852; this intake must not pretend that model-level attribution is complete.

Original request from current thread:

> 那是不是可以merge 然后走intake 流程回来了？如果不可以merge，和我说说为什么就好！如果可以，注意！！！一定要按照sop 走流程回家

Source acceptance:

> clowder-ai#845 is open with `bug`, `triaged`, `accepted`; clowder-ai#847 merged as `265152f1a874611fc5400501f53a833afc8c0cd8`.

### Tradeoff

This is a safe-cherry-pick intake, not a manual rewrite. I did not run live Redis `--apply`, and I did not try to solve the remaining model-dimension schema here. The UI shows `当前默认 {model}` only as present-tense registry context, with tooltip text saying historical aggregation is still catId-only.

### Open Questions

Technical:

- Please verify PR cat-cafe#2177 covers every `absorb` row in cat-cafe#2176 and does not go beyond clowder-ai#847.
- Please check the backfill race guard: apply must re-read the invocation, skip existing `usageByCat`, require `status === 'succeeded'`, and update with `expectedStatus: 'succeeded'`.
- Please check the user-visible wording in `DailyUsageSection`: model labels must not imply historical `(catId, model)` attribution.

Value:

- None. This is an accepted bugfix intake, not a new product surface or roadmap decision.

### Architecture Ownership

- Architecture cell: `dispatch`
- Map delta: none
- Why: this extends existing QueueProcessor completion accounting and InvocationRecordStore update semantics; it does not create a new Store, Queue, Router, Adapter, Dispatcher, Binding, ownership boundary, or canonical anchor. The usage dashboard change is an existing F051 surface consuming the same daily usage API.

### Quality Gate

Intent/spec:

- `bash scripts/intake-from-opensource.sh --pr 847 --mode=plan`
  - `safe-cherry-pick (11 files)`
  - manual/public-only count: 0
- Intake Intent Issue created first: cat-cafe#2176
- Absorb PR body includes `Closes #2176`

Guards:

- Overlap Guard: source files matched current home diff shape; no home-only drift requiring manual port was found.
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` passed.
- Feat Anchor Guard: F081 / F088 / F128 references resolve to existing feature docs.
- Root media/design artifact hygiene: no root-level matches in `origin/main...HEAD`.

Functional and visual parity:

- Source-vs-home component parity: `diff -u /tmp/clowder-ai-pr847-review-20260609/packages/web/src/components/DailyUsageSection.tsx packages/web/src/components/DailyUsageSection.tsx` exited 0.
- Browser render: `http://127.0.0.1:3311/settings?s=ops&ops=usage&standalone=1` with Playwright-mocked API on `3312`.
- Verified rendered text: `缅因猫 GPT-5.5`, `当前默认 gpt-5.5`, `缅因猫 GPT-5.4`, `当前默认 gpt-5.4`.
- Verified tooltip: `次调用 = 当日 invocation 记录数；下方每只猫的次数是各自参与次数。多猫调用让各猫之和 ≥ 总次数。`
- Screenshots: `/tmp/intake-847-daily-usage-section.png`, `/tmp/intake-847-settings-usage-page.png`.

Verification:

```bash
env -u NODE_ENV -u npm_config_production -u NPM_CONFIG_PRODUCTION CI=true pnpm install --frozen-lockfile --force
# pass

env -u NODE_ENV -u npm_config_production -u NPM_CONFIG_PRODUCTION pnpm --filter @cat-cafe/api run build
# pass

pnpm --filter @cat-cafe/api lint
# pass

pnpm --filter @cat-cafe/web exec tsc --noEmit
# pass

node --test packages/api/test/backfill-usage-by-cat-core.test.js packages/api/test/invocation-record-store-usage.test.js packages/api/test/usage-aggregator.test.js packages/api/test/usage-route-cache.test.js
# pass, 49/49

node --test packages/api/test/queue-processor.test.js
# pass, 91/91

(cd packages/api && node --test test/start-dev-script.test.js)
# pass, 43/43

env -u REDIS_URL -u CAT_CAFE_REDIS_URL -u TEST_REDIS_URL node --test packages/api/test/redis-invocation-record-store.test.js
# skipped as expected: REDIS_URL not set; no live Redis touched

bash scripts/intake-from-opensource.sh --validate-inbound
# pass

git diff --check
# pass
```

### Next Action

Please review cat-cafe#2177 against cat-cafe#2176. If approved, leave formal GitHub review proof on cat-cafe#2177 so I can run:

```bash
bash scripts/intake-from-opensource.sh --record --pr 847 --decision absorbed --intent-issue 2176 --absorb-pr 2177 --review-proof <review-url>
```

`--record` should auto-attempt `--advance-ledger`; if it does not, I will run `bash scripts/intake-from-opensource.sh --advance-ledger` immediately before merge.

[砚砚/GPT-5.5🐾]
