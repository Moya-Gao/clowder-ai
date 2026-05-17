---
feature_ids: [F201]
related_features: [F061, F178, F183, F194]
topics: [antigravity, reliability, liveness, durable-supervisor, auto-resume, heartbeat]
doc_kind: plan
created: 2026-05-17
---

# F201 Phase F Long-Task Liveness & Durable Supervisor — Implementation Plan

**Feature:** F201 — `docs/features/F201-antigravity-reliability-contract.md`
**Goal:** 让孟加拉猫长任务不再因为 60s idle / stream 断裂直接 terminal；最差留下可续跑断点，安全场景自动续跑，不安全场景清楚交给人确认。
**Acceptance Criteria:** F201 AC-G1~G8，且 AC-F5 阻止 F201 close 早于 AC-G 全绿。
**Architecture cell:** `transport` + `bubble-pipeline`
**Map delta:** none。
**Map delta why:** Phase F 加固 Antigravity provider 内部的 liveness / recovery / supervisor，不新增并行 transport；用户可见恢复继续复用 F183 rich block bubble pipeline。
**Architecture:** Antigravity stream 降级为观察通道；任务生命线由 Redis durable supervisor + Phase B side-effect journal + deterministic probes + Phase C resume context 持有。
**Tech Stack:** TypeScript API provider layer、Redis、JSONL audit、Node test runner、Antigravity LS/RPC、F183 rich block。
**前端验证:** Yes。AC-G6/G8 的 continue-safely/recovery card 必须在 alpha 里由铲屎官或愿景守护实际点验。

## Entry Constraints

Phase F 先修直接病灶，再做自动续跑体验。不得因为跨 invocation 能力还没完全成熟而延后 AC-G1/G2。

Hard constraints from 47 architecture review:

1. **Single side-effect truth source.** Phase B `AntigravitySideEffectJournal` 是 side-effect status 的唯一真相源。supervisor 可以持久化 journal summary snapshot 和 recovery strategy，但不能重新分类 side effect，也不能维护第二套 journal。
2. **Tier classification fail-closed.** 自动 resume 的 tier 判定只读 journal summary + deterministic probe 结果。无法分类、证据不足、probe 不稳定时默认最高风险/人工确认，绝不向 Tier 1/2 自动续跑 fall-through。
3. **F178 dependency ordering.** MVP 不硬等 F178 Phase D。Phase F 第一刀交付 invocation 内 supervisor + same-process/new-cascade resume + 持久断点；跨 invocation 自动写回/续跑 behind feature flag，等 F178 Phase D agent-key inventory/audit/key orphan guard 完成后再打开。
4. **Heartbeat requires evidence.** 不默认注入 fake planner step。先做真实 Antigravity spike；若上游不接受安全 keepalive，则降级为 trajectory re-pull + supervisor liveness probes。

## Data Model

Add an Antigravity-only supervisor record. Redis key is scoped by original invocation and cascade so it can survive stream death without becoming a global task system:

```ts
type AntigravitySupervisorStatus =
  | 'running'
  | 'probing'
  | 'resumable'
  | 'auto_resuming'
  | 'done'
  | 'failed';

interface AntigravityLivenessEvidence {
  kind:
    | 'trajectory_progress'
    | 'step_mutation'
    | 'pending_tool'
    | 'pending_approval'
    | 'native_executor_active'
    | 'rpc_reconnected';
  observedAt: number;
  summary: string;
}

interface AntigravitySupervisorRecord {
  schemaVersion: 1;
  originalInvocationId: string;
  threadId: string;
  catId: string;
  cascadeId: string;
  status: AntigravitySupervisorStatus;
  lastObservedStepCount: number;
  lastDeliveredStepIndex: number;
  lastTrajectoryAt?: number;
  lastLivenessEvidence?: AntigravityLivenessEvidence;
  journalSummarySnapshot: AntigravitySideEffectJournalSummary;
  receiptState: 'clean' | 'native_success_trajectory_error' | 'unknown';
  recoveryStrategy: 'wait' | 'probe' | 'manual_card' | 'auto_resume' | 'stop';
  resumeAttemptCount: number;
  createdAt: number;
  updatedAt: number;
}
```

Storage boundaries:

- Redis TTL = 0. This is user-visible recoverability state, so it is persistent by default.
- JSONL audit remains append-only black box evidence.
- F194 receives only summary projection: `status`, `lastLivenessEvidence`, `recoveryStrategy`, and `updatedAt`.
- Side-effect fields are derived from `AntigravitySideEffectJournal.summary()` only.

## Task 1: Supervisor Store

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts`
- Test: `packages/api/test/antigravity-supervisor-store.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Work**

1. Implement `upsert(record)`, `get(originalInvocationId, cascadeId)`, `appendAudit(event)`, and `projectToInvocationLiveness(record)`.
2. Persist Redis records with no TTL and key prefix `antigravity:supervisor:v1:`.
3. Store `journalSummarySnapshot` only from `AntigravitySideEffectJournal.summary()`.
4. Keep a memory implementation for unit tests; Redis wiring can follow existing store patterns.

**Tests**

- TTL is not set.
- Journal summary is copied from Phase B journal and is not reclassified.
- JSONL audit redacts sensitive targets consistently with existing journal audit.
- F194 projection excludes provider-specific side-effect details.

## Task 2: Liveness Evidence + `stallProbed` Root Cause

**Files**

- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Test: `packages/api/test/antigravity-waiting-approval.test.js`
- Test: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- Test: `packages/api/test/antigravity-agent-service-diagnostics.test.js`

**Work**

1. Replace single boolean `stallProbed` with bounded probe state:

   ```ts
   interface StallProbeBudget {
     attempts: number;
     maxAttempts: number;
     nextProbeAfterMs: number;
     lastProbeAt?: number;
   }
   ```

2. On every idle stall, collect liveness evidence before consuming probe budget.
3. If evidence says "slow but alive", update supervisor and keep waiting without consuming a probe.
4. If no evidence exists, consume bounded probe budget with backoff and call the existing approval/probe path.
5. If budget is exhausted, route through recovery policy and supervisor card, not an unstructured terminal throw.

**Tests**

- Red/green: two consecutive 60s idle windows with `native_executor_active` evidence do not terminal.
- Red/green: approval stall still uses existing `resolveOutstandingSteps` path.
- Red/green: no liveness evidence + exhausted probe budget surfaces a structured resumable failure.
- Regression: `deliveryAdvanced` still resets probe state.

## Task 3: Receipt Conflict Split

**Files**

- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-recovery-policy.ts`
- Test: `packages/api/test/antigravity-stream-error-telemetry.test.js`
- Test: `packages/api/test/antigravity-recovery-policy.test.js`

**Work**

Detect the observed field failure: native executor returns success, then trajectory marks the cascade as `ERROR` / `STOP_REASON_CLIENT_STREAM_ERROR`. Classify that as `receipt_conflict`, not as a plain failed command.

Decision rules:

- no side effect observed -> normal transient retry path can run;
- confirmed side effect -> continuation prompt / resume context;
- unknown side effect -> deterministic probe first;
- receipt conflict -> mark record + surface resumable card unless tier classifier proves auto resume safe.

**Tests**

- Native success + trajectory error creates supervisor `receiptState='native_success_trajectory_error'`.
- Recovery card includes completed/pending split.
- No blind retry occurs after confirmed side effect.

## Task 4: Resume Tier Classifier

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-resume-tier.ts`
- Test: `packages/api/test/antigravity-resume-tier.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-resume-context.ts`

**Work**

Implement deterministic classification:

```ts
type AntigravityResumeTier =
  | 'tier1_auto_readonly'
  | 'tier2_auto_probe_owned'
  | 'tier3_manual_shared_or_external'
  | 'tier4_manual_irreversible';
```

Inputs:

- `AntigravitySideEffectJournalSummary` from Phase B journal;
- deterministic probe results such as `git worktree list`, branch existence, sentinel file existence, owned sandbox path checks;
- hard refusal policy for root delete / Redis 6399 / force push / release / credential mutation.

Rules:

- Tier 1: read-only, build, test, lint, diagnostics.
- Tier 2: owned sandbox, sentinel, generated temp worktree/branch, actions with idempotency key and reliable probe.
- Tier 3: shared state docs, existing business files, GitHub writes, cross-thread messages.
- Tier 4: force push, merge PR, close issue/PR, release publish, Redis 6399, credential/permission mutation, uncontrolled delete.
- Unknown = Tier 4/manual until proven otherwise.

**Tests**

- Unknown operation fails closed to manual.
- Tier 2 requires both owned target and successful probe.
- `rm`/root delete/Redis 6399 never auto resumes.
- Classifier never mutates journal summary.

## Task 5: Same-Process / New-Cascade Auto Resume

**Files**

- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-recovery-policy.ts`
- Test: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- Test: `packages/api/test/antigravity-resume-context.test.js`

**Work**

1. If recovery policy returns auto-resumable tier and attempt cap is not reached, create a fresh cascade inside the same API invocation.
2. Inject Phase C `resumeContext` with completed/pending split and explicit instruction not to repeat completed side effects.
3. Increment `resumeAttemptCount`; cap defaults to 1 per original invocation for MVP.
4. If cap is reached, surface recovery card with diagnostic ID.

**Tests**

- Safe Tier 1 read-only stream interruption auto resumes once.
- Safe Tier 2 owned worktree action auto resumes after probe proves state.
- Tier 3/Tier 4 never auto resume.
- Attempt cap prevents loops.

## Task 6: Cross-Invocation Continuation Boundary

**Files**

- Modify: `packages/api/src/domains/cats/services/agents/agent-key/antigravity-agent-key-sidecar.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Test: `packages/api/test/antigravity-agent-key-sidecar.test.js`

**Work**

MVP behavior:

- The supervisor record persists enough state for a future invocation to continue safely.
- The automatic out-of-invocation writeback path stays disabled unless `ANTIGRAVITY_CROSS_INVOCATION_RESUME=true`.
- If F178 Phase D is not complete at implementation time, close report must list it as an external dependency; Phase F can still pass AC-G1/G2/G4/G5/G6 for invocation-local recovery.

Post-F178 behavior:

- Use F178 agent-key writeback only after inventory/audit/key orphan guard is available.
- Emit a structured audit event that links `originalInvocationId` -> `resumeInvocationId`.

## Task 7: Heartbeat Spike

**Files**

- Create: `scripts/antigravity-heartbeat-spike.mjs`
- Test: `scripts/antigravity-heartbeat-spike.test.mjs`
- Modify: `scripts/antigravity-availability-smoke.mjs`

**Work**

1. Build an opt-in spike that runs only with `RUN_ANTIGRAVITY_HEARTBEAT_SPIKE=true`.
2. Try the smallest non-mutating keepalive accepted by Antigravity LS/RPC.
3. Record whether upstream accepts the signal without polluting trajectory or model prompt.
4. If rejected, do not ship fake planner injection; use trajectory re-pull + supervisor liveness.

**Tests**

- Script refuses to run without explicit env.
- Dry-run mode emits planned RPC without touching Antigravity.
- Smoke report records `heartbeatMode='rpc_keepalive' | 'trajectory_repull'`.

## Task 8: Alpha Long-Task Acceptance

**Files**

- Modify: `scripts/antigravity-availability-smoke.mjs`
- Modify: `scripts/antigravity-availability-smoke.test.mjs`
- Modify: `docs/features/F201-antigravity-reliability-contract.md` after merge gate only.

**Work**

Add an explicit long-task smoke scenario:

- owned temp worktree/sentinel only;
- command writes progress every 30s and has pid/log/exit probes;
- forced stream interruption fixture in unit/integration tests;
- real alpha run with `@antig-opus` after merge.

**Acceptance**

- If the task finishes, report includes completed effects and no recovery card.
- If the stream breaks, report includes supervisor record, completed/pending split, diagnostic ID, and continue-safely action.
- It is unacceptable for final user-visible state to be only `STOP_REASON_CLIENT_STREAM_ERROR`.

## Verification Commands

Focused plan gate:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  packages/api/test/antigravity-waiting-approval.test.js \
  packages/api/test/antigravity-agent-service-fatal-errors.test.js \
  packages/api/test/antigravity-recovery-policy.test.js \
  packages/api/test/antigravity-resume-context.test.js \
  packages/api/test/antigravity-side-effect-journal.test.js
node --test scripts/antigravity-availability-smoke.test.mjs
```

Merge gate:

```bash
pnpm gate
RUN_ANTIGRAVITY_SMOKE=true pnpm antigravity:smoke -- --readonly
pnpm alpha:start
```

Alpha validation is manual/interactive and must be recorded in F201 before close.

## Rollback

- Runtime code rollback: `git revert <phase-f-merge-sha>`.
- Supervisor Redis records are additive and scoped under `antigravity:supervisor:v1:`; rollback may leave diagnostic records, which is acceptable because TTL=0 user recoverability state must not be silently deleted.
- If heartbeat spike causes upstream instability, disable heartbeat mode and keep trajectory re-pull liveness.
- If auto resume misclassifies a tier, disable `ANTIGRAVITY_AUTO_RESUME` and keep manual recovery card path while preserving supervisor diagnostics.

## Review Checklist

- AC-G4 explicitly derives side-effect status from Phase B journal.
- AC-G6 unknown tier fails closed.
- AC-G1 root cause has a red/green regression test.
- F178 dependency is not hidden.
- Heartbeat has a real spike result before any keepalive injection ships.
- No new UI message tree; recovery UI stays in F183 rich block pipeline.
