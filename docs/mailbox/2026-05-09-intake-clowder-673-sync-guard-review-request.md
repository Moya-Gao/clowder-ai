---
type: review-request
date: 2026-05-09
author: codex
reviewer: opus
pr: https://github.com/zts212653/cat-cafe/pull/1609
source_pr: https://github.com/zts212653/clowder-ai/pull/673
review_target_id: intake-673-sync-guard
---

# Review Request: clowder-ai#673 intake + sync guard hardening

Review-Target-ID: intake-673-sync-guard
Branch: fix/intake-673-sync-guard
PR: https://github.com/zts212653/cat-cafe/pull/1609

## Original Requirement

铲屎官原话：`那我们合入之后把他intake回来 然后检查一下 sync-to-opensource.sh 怎么优化？`

Context: clowder-ai#649 had fixed Windows Redis RESP probing, but a full sync from cat-cafe overwrote part of that fix. clowder-ai#673 restores the missing `$Args` -> `$CommandArgs` fix; cat-cafe must absorb it before the next outbound sync.

## What Changed

- Absorbed clowder-ai#673 into `scripts/install-windows-helpers.ps1`.
- Strengthened `packages/api/test/windows-portable-redis-url.test.js` so `$Args` cannot regress.
- Added `sync-to-opensource.sh` pre-sync guard for `absorbed` ledger entries missing `intake_intent_issue` + `review_proof` when their touched files still differ from source.
- Added static coverage in `scripts/check-env-port-drift.test.mjs`.
- Included two mechanical baseline fixes required by local gates:
  - refreshed `docs/features/index.json`
  - Biome-formatted `packages/api/test/codex-agent-service.test.js`

## Architecture Ownership

Architecture cell: opensource ops / outbound sync guard
Map delta: none
Why: this tightens an existing sync preflight boundary; it does not introduce a new service, queue, router, adapter, or ownership cell.

## Review Focus

1. Confirm the Windows fix exactly preserves clowder-ai#673 intent: no `Format-RedisRespCommand -Args` remains in the RESP path.
2. Confirm the new sync guard catches the #649 failure class without blocking completed/default-lane absorbed records that have intent issue + review proof.
3. Confirm `--force-overwrite` behavior remains explicit and noisy.
4. Confirm the two mechanical baseline fixes are acceptable in this PR.

## Evidence

- `bash scripts/intake-from-opensource.sh --pr 673 --mode=plan` -> 1 safe file + 1 manual-port file
- `bash scripts/intake-from-opensource.sh --validate-inbound` -> pass
- `pnpm --dir packages/api exec node --test test/windows-portable-redis-url.test.js` -> 21/21 pass
- `node --test scripts/check-env-port-drift.test.mjs` -> 74/74 pass
- `bash -n scripts/sync-to-opensource.sh scripts/intake-from-opensource.sh` -> pass
- `git diff --check` -> pass
- `pnpm lint` -> pass, existing hardcoded-color warnings only
- `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build` -> pass
- `pnpm check` -> passed through Biome, feature truth, skills manifest, env registry/example gates; interrupted at existing `check:start-profile-isolation` hang after more than 2 minutes with no output

## After Review

If approved, run:

```bash
bash scripts/intake-from-opensource.sh --record --pr 673 --decision absorbed --intent-issue 1608 --absorb-pr 1609 --review-proof <review-url>
```

Then commit/push the ledger update and run `--verify-merge-ready --absorb-pr 1609` before merge.
