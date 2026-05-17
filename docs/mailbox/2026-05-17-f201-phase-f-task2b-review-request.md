---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, supervisor-wiring, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase F Task 2b — Supervisor Wiring

Review-Target-ID: f201-phase-f
Branch: feat/f201-supervisor-wiring

## What

Wires the Phase F supervisor store into `AntigravityAgentService`.

- Adds an injectable `supervisorStore` option.
- Persists `running/wait` records when Antigravity trajectory proves a stall is slow-but-alive.
- Persists `resumable/manual_card` records before surfacing recovery cards for post-side-effect interruption.
- Wires API runtime to `RedisAntigravitySupervisorStore` when Redis is available.
- Keeps local/default service instances on in-memory store plus JSONL audit.

## Why

Task 1 created the store, but the service still did not write durable progress. This slice makes the first two Phase F supervisor states real: "still alive, keep waiting" and "side effect happened, stop with resumable context".

## Reviewer Focus

1. **Single side-effect truth source**: supervisor records must use `sideEffectJournal.summary()` snapshots only. No side-effect reclassification in supervisor wiring.
2. **Liveness semantics**: trajectory progress must write evidence and continue polling without consuming stall probe budget.
3. **Recovery semantics**: post-side-effect `stream_error` must leave `status=resumable`, `recoveryStrategy=manual_card`, and a copied journal summary.
4. **Runtime wiring**: Redis store injection in `index.ts` should stay provider-internal and use the Task 1 TTL=0 store.
5. **F178 boundary**: no `antigravity-agent-key-sidecar.ts` changes.

## Tradeoff

- This does not implement receipt-conflict classification or auto-resume tiers. Those stay in Task 3/4/5.
- Supervisor write failures are logged and do not break the live invocation path. The supervisor is a recovery safety net, not the source of immediate response delivery.
- Final successful invocations mark the supervisor `done`; terminal recovery paths keep the earlier `resumable` record instead of overwriting it with `done`.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this is Antigravity-provider-internal wiring into the existing provider service and Redis-backed store. F194 receives only the narrow projection from Task 1; the service does not expose provider-specific side-effect details outside the Antigravity provider boundary.

## Self-Check Evidence

### Red Tests

Added two failing tests first:

- trajectory-progress stall should persist supervisor liveness evidence.
- post-side-effect stream interruption should persist a resumable supervisor record.

Initial red result: both failed because `supervisorStore.get(...)` returned `null`.

### Green Tests

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 --test-name-pattern 'F201 Phase F Task 2b' packages/api/test/antigravity-agent-service-fatal-errors.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-agent-service-fatal-errors.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/antigravity-supervisor-store.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/antigravity-side-effect-journal.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-waiting-approval.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-agent-service-executors.test.js
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-agent-service.test.js
```

Results:

- Task 2b focused tests: 2 passed.
- Full fatal-errors file: 50 passed.
- Supervisor store: 6 passed.
- Side-effect journal: 7 passed.
- Waiting approval: 17 passed.
- Native executors: 5 passed.
- Base service: 14 passed.

### Static Checks

```bash
pnpm exec biome check --diagnostic-level=error packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts packages/api/src/index.ts packages/api/test/antigravity-agent-service-fatal-errors.test.js
git diff --check
node scripts/check-hotfix-pattern.mjs
pnpm check:architecture-ownership
git rev-list --left-right --count origin/main...HEAD
```

Results:

- Biome error-level check passed.
- Diff whitespace check passed.
- Hotfix pattern: false.
- Architecture ownership exited 0 with existing warning-only repo warnings.
- Base-lag check before final commit: `0 0`.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts`
- `packages/api/src/index.ts`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- `docs/features/F201-antigravity-reliability-contract.md`

[砚砚/GPT-55🐾]
