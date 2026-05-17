---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, supervisor-store, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase F Task 1 — Supervisor Store

Review-Target-ID: f201-phase-f
Branch: feat/f201-phase-f-supervisor-store
Commit: b17ce060c

## What

Implements the Phase F supervisor persistence foundation.

- Adds `AntigravitySupervisorStore.ts` with typed supervisor records, liveness evidence, receipt state, and recovery strategy.
- Adds in-memory and Redis-backed stores.
- Uses persistent Redis keys under `antigravity:supervisor:v1:` with no `EXPIRE`.
- Adds JSONL audit append with target redaction.
- Adds F194-style liveness projection that omits provider-specific side-effect details.
- Adds tests for snapshot copying, Redis TTL=0 behavior, audit redaction, and projection shape.

## Why

F201 Phase F needs a durable place to remember Antigravity long-task progress after stream interruption. Task 1 is the store layer only: it does not auto-resume yet and does not classify side-effect risk yet.

## Original Requirements

> 第一件：孟加拉猫任务跑到一半时，进度要记在哪里？
> 这个可以但是记录在哪里比较合适呢？
> 如果你有 1 他知道自己跑哪里，这个还害怕吗？

- 来源：`docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- 请对照判断：本切片是否只建立 supervisor 进度真相源，不把 Phase B side-effect journal 复制成第二套账本。

## Tradeoff

- This is intentionally a store/projection slice. `AntigravityAgentService` wiring is left for Task 2b so AC-G1 and store infrastructure stay independently reviewable.
- The supervisor keeps `journalSummarySnapshot`, but side-effect truth remains `AntigravitySideEffectJournal.summary()`. The store copies that snapshot; it does not reclassify effects.
- Redis persistence uses a simple string value per `(originalInvocationId, cascadeId)` key. That is enough for Task 1 and avoids introducing a new global task system.
- Audit redaction is defensive: it redacts `target` fields even if a future audit event accidentally carries raw sensitive paths.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This adds an Antigravity-provider-internal persistence helper scoped to the existing provider transport/recovery path. It does not create a new global queue/store truth source, does not modify F194 canonical liveness ownership, and does not touch F178 sidecar.

Reviewer checks:

- Does the new `Store` stay provider-internal, or does it need an ownership map update?
- Is `journalSummarySnapshot` clearly derived from Phase B journal only?
- Does projection exclude `journalSummarySnapshot`, `receiptState`, and `cascadeId` so F194 does not inherit provider-specific side-effect detail?
- Does Redis persistence avoid TTL/expire completely?

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the `(originalInvocationId, cascadeId)` Redis key sufficient for Task 1, or should we include `threadId` in the key despite it being in the record body?
2. Is the projection shape narrow enough for F194, or should it be renamed before Task 2b wiring to avoid implying canonical liveness ownership?
3. Is generic audit `target` redaction sufficient here, or should Task 3 introduce a stricter audit event schema?

### 价值 OQ（给 CVO）

无。本切片按已批准 Phase F plan 落地。

## Next Action

请 46 + 47 双 review，重点看：

- P1-① 单一 side-effect 真相源是否守住。
- TTL=0 是否明确，Redis store 是否没有任何 expire。
- F194 projection 是否足够窄。
- 是否确实没有碰 F178 sidecar。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201-phase-f/{reviewer-handle}`
- Start command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本轮是 API/provider unit review，无前端 runtime 必需）

## 自检证据

### Spec 合规

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- Covered task: Phase F Task 1.
- Architecture ownership: `transport`, `Map delta: none`.
- Root artifact hygiene: clean.

### Red Test

Before implementation, `antigravity-supervisor-store.test.js` failed with:

```text
ERR_MODULE_NOT_FOUND: Cannot find module .../AntigravitySupervisorStore.js
```

### Green Tests

```bash
pnpm --dir packages/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-side-effect-journal.test.js packages/api/test/antigravity-supervisor-store.test.js
```

Result: 11 passed, 0 failed.

```bash
pnpm biome check packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts packages/api/test/antigravity-supervisor-store.test.js
pnpm --dir packages/api run lint
git diff --check
pnpm check:architecture-ownership
```

Result: biome/build/lint/diff-check passed. Architecture ownership exited 0 with existing warning-only repo warnings.

## 相关文件

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts`
- `packages/api/test/antigravity-supervisor-store.test.js`
- `docs/features/F201-antigravity-reliability-contract.md`
- `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`

[砚砚/GPT-55🐾]
