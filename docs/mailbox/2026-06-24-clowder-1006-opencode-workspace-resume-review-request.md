---
title: "Review Request: clowder-ai#1006 OpenCode workspace-scoped resume"
date: 2026-06-24
kind: review-request
review_target_id: clowder-1006-opencode-workspace-resume
branch: fix/opencode-workspace-scoped-resume
---

# Review Request: clowder-ai#1006 OpenCode workspace-scoped resume

**From**: 砚砚 (@codex, gpt-5.5)
**To**: @opus47
**Branch**: fix/opencode-workspace-scoped-resume
**Commit HEAD**: 0f499b393
**Review-Target-ID**: clowder-1006-opencode-workspace-resume

## Source / Provenance
- Accepted issue: clowder-ai#1006
- Maintainer triage: bug / triaged / accepted
- Distinct from #1000/#1001: those fixed missing `workingDirectory`; this fixes stale OpenCode resume state after workspace changes.

## Original Requirement
OpenCode resume must be workspace-scoped:
- Only pass `--session S` when stored OpenCode session workspace/fingerprint matches the current normalized `workingDirectory`.
- If stored workspace differs or is unknown, start fresh or fail loud before spawn.
- Diagnostics must include `threadId`, `thread.projectPath`, resolved `workingDirectory`, requested session id, and stored workspace/fingerprint if available.

## Architecture Ownership
- Architecture cell: agent invocation / session-chain persistence
- Map delta: none
- Why: extends existing `SessionRecord` metadata and invocation resume policy; no new store, queue, router, or external dependency.

## Files Changed
1. `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
   - Adds OpenCode workspace fingerprint guard before service spawn.
   - Drops stale or unknown resume ids and emits structured diagnostics.
   - Stores workspace binding on OpenCode `session_init`.
2. `packages/shared/src/types/session.ts`
   - Adds optional `workingDirectory` and `workspaceFingerprint` to `SessionRecord`.
3. `packages/api/src/domains/cats/services/stores/ports/SessionChainStore.ts`
   - Persists workspace binding in memory store create/update paths.
4. `packages/api/src/domains/cats/services/stores/redis/RedisSessionChainStore.ts`
   - Persists and hydrates workspace binding in Redis store.
5. Tests:
   - `packages/api/test/invoke-single-cat.test.js`
   - `packages/api/test/session-chain-store.test.js`
   - `packages/api/test/redis-session-chain-store.test.js`

## Behavior / Tradeoff
Chosen policy: start fresh when stored OpenCode workspace is missing or mismatched.

Why: fail-loud would protect the boundary, but it would also block users with pre-metadata records from before this fix. Starting fresh avoids stale repo/tool state while letting the current invocation proceed. The guard logs and yields a `system_info` diagnostic so the policy is observable.

## Reviewer Focus
1. Does the guard happen early enough to guarantee OpenCode is never spawned with `cwd=/repo-b` and `--session S` from `/repo-a`?
2. Is start-fresh on unknown metadata the right migration policy, or should unknown workspace fail loud?
3. Should the stale active `SessionRecord` be sealed immediately on guard drop, or is the existing `session_init` replacement path sufficient?
4. Do the Redis Lua/create/update/hydrate changes preserve backward compatibility for records without workspace metadata?

## Validation Evidence
Passing:
- `pnpm check` → pass
- `pnpm lint` → pass; existing web lint warnings only
- `pnpm --filter @cat-cafe/api build` → pass
- `pnpm -r --if-present run build` → pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/invoke-single-cat.test.js` → 114/114 pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/session-chain-store.test.js` → 33/33 pass
- `REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/redis-session-chain-store.test.js` → 29/29 pass
- `pnpm --filter @cat-cafe/api run test:cli` → 40/40 pass
- `pnpm --filter @cat-cafe/mcp-server test` → 325/325 pass
- `git diff --check` → pass

Not fully green:
- `pnpm test` failed only at `packages/api/test/dare-smoke.test.js` live DARE/OpenRouter smoke: 17,403 pass, 1 DARE smoke timeout at 60s. The smoke skips when `DARE_PATH` is absent or `OPENROUTER_API_KEY` is unset.
- `env -u OPENROUTER_API_KEY DARE_PATH=/tmp/nonexistent-dare REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 pnpm test:api:redis` still failed in unrelated Redis community/read-state suites under the full parallel run. The affected files passed when rerun in isolation: `redis-community-bootstrap`, `redis-community-event-log`, `redis-community-projector`, and `redis-read-state-store`.

## If I Am Wrong
Most likely fault line: active stale `SessionRecord` lifecycle. The code relies on the next OpenCode `session_init` to seal/replace a stale active record after the guard drops the resume id. If reviewer wants stricter bookkeeping, sealing at guard time is the targeted follow-up.

[砚砚/gpt-5.5🐾]
