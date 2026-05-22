---
feature_ids: [F192]
topics: [harness-eval, eval-hub, e-pilot, a2a]
doc_kind: plan
created: 2026-05-21
---

# F192 Phase E-pilot — Eval A2A Control Loop Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** 用 `eval:a2a` 跑通 Harness Eval Control Plane 的最小闭环：registry → eval cat invocation → verdict handoff → feature owner response → re-eval closure，同时清理旧 `harness-fit-digest` 双触发风险。
**Acceptance Criteria:** AC-E1~E8（E-pilot only）
**Architecture cell:** observability / harness-eval
**Map delta:** update required
**Map delta why:** Phase E 将 F192 从单域 runtime eval pipeline 扩成 cross-domain control plane；E-pilot 先在现有 F192 boundary 内落 registry/contract，ownership map update 放本 Phase 收尾。
**Architecture:** Docs-backed domain registry is the source of configured eval domains for E-pilot; generated JSON/YAML artifacts are derived evidence. API/runtime code validates domain registry, Verdict Handoff Packet schema, eval-cat invocation packet, legacy scheduled-task migration plan, and re-eval closure state. No Eval Hub UI in E-pilot.
**Tech Stack:** TypeScript, Zod, node:test, YAML/JSON docs artifacts, existing scheduler store/routes, existing F167 runtime eval pipeline.
**前端验证:** No

---

## Finish Line

E-pilot is done when `eval:a2a` has one validated domain registry entry, one validated Verdict Handoff Packet generated from real F167/A2A eval data, one invocation packet suitable for a scheduled task to wake the eval cat into the domain thread, one legacy cleanup dry-run proving `harness-fit-digest` will not double-trigger, and one re-eval closure record showing either resolved or pending-with-next-check.

## Not Building

- Eval Hub UI, charts, or navigation.
- `eval:memory` adapter, F188/F200 migration, or community domain support.
- A generic external checker marketplace.
- Replacing F153 telemetry or F192 Phase C/D eval snapshot generation.

## Terminal Schemas

### EvalDomainRegistryEntry

```ts
interface EvalDomainRegistryEntry {
  domainId: 'eval:a2a';
  displayName: string;
  systemThreadId: string;
  evalCat: { catId: string; handle: string; model: string };
  frequency: 'daily';
  sourceAdapter: 'f167-runtime-eval';
  legacyScheduledTaskIds: string[];
  handoffTargetResolver: {
    featureId: 'F167' | 'F192';
    ownerCatId: string;
    threadLookup: 'feature-thread';
  };
  sla: { acknowledgeHours: number; reevalWithinHours: number };
}
```

### VerdictHandoffPacket

```ts
interface VerdictHandoffPacket {
  id: string;
  domainId: 'eval:a2a';
  createdAt: string;
  phenomenon: string;
  harnessUnderEval: { featureId: string; componentId: string; name: string };
  evidencePacket: {
    snapshotRefs: string[];
    attributionRefs: string[];
    metricRefs: string[];
    sampleTraceRefs: string[];
  };
  dailyTrend: {
    window: string;
    current: Record<string, number>;
    baseline: Record<string, number>;
    threshold: Record<string, number>;
    direction: 'improved' | 'regressed' | 'flat' | 'unknown';
  };
  rootCauseHypothesis: { summary: string; confidence: 'low' | 'medium' | 'high'; alternatives: string[] };
  verdict: 'delete_sunset' | 'build' | 'fix' | 'keep_observe';
  ownerAsk: { targetFeatureId: string; targetOwnerCatId: string; requestedAction: string };
  acceptanceReevalPlan: { nextEvalAt: string; closureCondition: string };
  counterarguments: string[];
}
```

### ReevalClosureRecord

```ts
interface ReevalClosureRecord {
  handoffId: string;
  status: 'open' | 'acknowledged' | 'acted' | 'resolved_by_reeval' | 'accepted_suppressed';
  ownerResponseRef?: string;
  reevalRef?: string;
  closureEvidence?: string;
}
```

---

## Task 1: AC-E2 — Eval Domain Registry v0

**Files:**
- Create: `docs/harness-feedback/eval-domains/eval-a2a.yaml`
- Create: `packages/api/src/infrastructure/harness-eval/eval-domain-registry.ts`
- Test: `packages/api/test/harness-eval/eval-domain-registry.test.js`

**Step 1: Write failing registry tests**

Tests:
- validates the `eval:a2a` fixture entry.
- rejects missing `systemThreadId`, empty `legacyScheduledTaskIds`, and non-positive SLA values.
- rejects unknown domain ids in E-pilot.

Run:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-domain-registry.test.js
```

Expected: FAIL because `eval-domain-registry.ts` does not exist.

**Step 2: Implement registry loader and schema**

Use Zod or local typed validators matching existing API style. Keep E-pilot narrow: only `eval:a2a` is allowed.

**Step 3: Add docs-backed registry fixture**

Create `docs/harness-feedback/eval-domains/eval-a2a.yaml` with:
- domain id and display name.
- `systemThreadId` placeholder resolved by configured domain thread.
- `evalCat` as the designated eval cat.
- `sourceAdapter: f167-runtime-eval`.
- `legacyScheduledTaskIds: [harness-fit-digest]`.

**Step 4: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-domain-registry.test.js
git commit -m "feat(F192): AC-E2 eval domain registry v0 [砚砚/GPT-5.5🐾]"
```

---

## Task 2: AC-E3 — Verdict Handoff Packet Contract

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/verdict-handoff.ts`
- Test: `packages/api/test/harness-eval/verdict-handoff.test.js`
- Create fixture: `docs/harness-feedback/verdicts/fixtures/eval-a2a-verdict.valid.json`

**Step 1: Write failing schema tests**

Tests:
- accepts a complete packet with all nine required contract sections.
- rejects missing `counterarguments`.
- rejects missing `acceptanceReevalPlan`.
- rejects `delete_sunset` packet without a CVO-acceptance gate marker.
- rejects cross-thread handoff serialization when any required field is missing.

Expected: FAIL because schema does not exist.

**Step 2: Implement packet schema + serializer**

Export:

```ts
parseVerdictHandoffPacket(input)
assertCanCrossThreadHandoff(packet)
```

`delete_sunset` must require `ownerAsk.requestedAction` or `acceptanceReevalPlan.closureCondition` to explicitly mention CVO accept.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/verdict-handoff.test.js
git commit -m "feat(F192): AC-E3 verdict handoff packet contract [砚砚/GPT-5.5🐾]"
```

---

## Task 3: AC-E5 — Eval Cat Invocation Primitive

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts`
- Test: `packages/api/test/harness-eval/eval-cat-invocation.test.js`

**Step 1: Write failing invocation tests**

Tests:
- builds an invocation packet with domain thread id, eval cat identity, trend refs, last verdict refs, and explicit day-over-day instruction.
- refuses to build invocation without domain thread id.
- includes legacy cleanup status so eval cat knows whether old `harness-fit-digest` still exists.

Expected: FAIL because invocation builder does not exist.

**Step 2: Implement invocation packet builder**

Output is a structured payload for scheduled task execution, not a direct message send:

```ts
buildEvalCatInvocation({ domain, trendRefs, verdictRefs, legacyCleanup })
```

The task execution layer can later post this packet into the domain thread. E-pilot only needs a valid, testable packet.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-cat-invocation.test.js
git commit -m "feat(F192): AC-E5 eval cat invocation packet [砚砚/GPT-5.5🐾]"
```

---

## Task 4: AC-E6 — Legacy Scheduled-Task Cleanup Dry Run

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/legacy-task-cleanup.ts`
- Test: `packages/api/test/harness-eval/legacy-task-cleanup.test.js`
- Create report: `docs/harness-feedback/migrations/2026-05-21-eval-a2a-legacy-task-dry-run.md`

**Step 1: Write failing cleanup tests**

Tests:
- identifies `harness-fit-digest` as a legacy task for `eval:a2a`.
- returns `wouldRedirect` or `wouldDisable` action without mutating store in dry-run mode.
- marks migration unsafe if both legacy task and new eval runtime would fire at the same frequency without redirect.
- produces a rollback record.

Expected: FAIL because cleanup helper does not exist.

**Step 2: Implement inventory/dry-run logic**

Keep implementation side-effect free for E-pilot unless a later review explicitly approves apply mode.

**Step 3: Generate dry-run report**

Report must include:
- found task ids.
- intended action.
- rollback path.
- no-double-trigger proof.

**Step 4: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/legacy-task-cleanup.test.js
git commit -m "feat(F192): AC-E6 a2a legacy task cleanup dry-run [砚砚/GPT-5.5🐾]"
```

---

## Task 5: AC-E7 — Re-eval Closure Loop

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/reeval-closure.ts`
- Test: `packages/api/test/harness-eval/reeval-closure.test.js`

**Step 1: Write failing closure tests**

Tests:
- owner response alone moves `open → acknowledged` or `acted`, not `resolved`.
- subsequent eval evidence can move `acted → resolved_by_reeval`.
- CVO accept/suppress can close high-impact delete/sunset verdict.
- stale verdict escalates when SLA elapsed without owner response.

Expected: FAIL because closure helper does not exist.

**Step 2: Implement state transition helper**

Export:

```ts
transitionReevalClosure(record, event, domain)
```

Keep transitions pure and deterministic.

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/reeval-closure.test.js
git commit -m "feat(F192): AC-E7 re-eval closure state machine [砚砚/GPT-5.5🐾]"
```

---

## Task 6: AC-E8 — E-pilot Dogfood Verdict

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/eval-a2a-adapter.ts`
- Test: `packages/api/test/harness-eval/eval-a2a-adapter.test.js`
- Create report: `docs/harness-feedback/verdicts/2026-05-21-eval-a2a-pilot-verdict.md`

**Step 1: Write failing adapter tests**

Tests:
- converts an F167 runtime eval snapshot + attribution finding into a complete Verdict Handoff Packet.
- maps clear friction regression to `fix`.
- maps stable low-action finding to `keep_observe`.
- refuses to emit packet when evidence refs are empty.

Expected: FAIL because adapter does not exist.

**Step 2: Implement adapter**

Consume existing F192 Phase C/D outputs:
- `generateF167Snapshot` from `f167-eval.ts`.
- attribution records from `attribution.ts`.

Do not duplicate F153 telemetry logic.

**Step 3: Generate dogfood verdict**

Run the adapter on current available A2A data or fixture-backed recent snapshot. Produce a report with:
- packet id.
- evidence refs.
- owner ask.
- response/closure status: resolved if re-eval evidence exists; otherwise pending with next eval time.

**Step 4: Verify and commit**

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-a2a-adapter.test.js
git commit -m "feat(F192): AC-E8 eval-a2a dogfood verdict [砚砚/GPT-5.5🐾]"
```

---

## Task 7: AC-E1 Closeout + Ownership Map Delta

**Files:**
- Modify: `docs/features/F192-socio-technical-harness-eval.md`
- Modify: `docs/architecture/ownership/README.md` if needed after implementation confirms map wording
- Modify: `docs/discussions/2026-05-21-f192-phase-e-eval-hub-kickoff/README.md`

**Step 1: Update AC checklist**

Mark AC-E2~E8 complete only after tests and dogfood report exist.

**Step 2: Record ownership map delta**

If no new cell is needed, add a short note that F192 owns `observability / harness-eval` control-plane contracts over existing F153 telemetry and scheduler primitives.

**Step 3: Verify and commit**

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
git commit -m "docs(F192): close Phase E-pilot ACs [砚砚/GPT-5.5🐾]"
```

---

## Verification Plan

Targeted:

```bash
pnpm --filter @cat-cafe/api build
node --test \
  packages/api/test/harness-eval/eval-domain-registry.test.js \
  packages/api/test/harness-eval/verdict-handoff.test.js \
  packages/api/test/harness-eval/eval-cat-invocation.test.js \
  packages/api/test/harness-eval/legacy-task-cleanup.test.js \
  packages/api/test/harness-eval/reeval-closure.test.js \
  packages/api/test/harness-eval/eval-a2a-adapter.test.js
```

Full gate before review:

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

## Reviewer Focus

- Does Verdict Handoff Packet enforcement actually prevent vague "你去看看" messages?
- Does the invocation packet solve "which thread / which cat / what longitudinal context" without hardcoding current thread text as SOT?
- Does legacy cleanup prove no duplicate `harness-fit-digest` trigger before any redirect/disable?
- Does E-pilot avoid prematurely building Eval Hub UI?
