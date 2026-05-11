# F192 Phase D — Eval Infrastructure Completion Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** Phase C 骨架跑通后，补全 instrumentation gap → 完善基础设施 → 扩展到更多工具 → 自动化 digest 循环
**Acceptance Criteria:** AC-D0~D9（10 条，见 spec）
**Architecture cell:** none (cross-cutting eval tool)
**Map delta:** none
**Map delta why:** eval pipeline 是 enrichment 工具，不引入新 ownership cell
**Architecture:** AC-D0 在 F167 组件实现处加 OTel counter → F153 自动暴露 → Phase C eval pipeline 消费。D2 snapshot store 是定时 CLI 脚本。D1/D4/D5 是结构化文档。D3 是回归测试。D9 扩展 attribution.ts。
**Tech Stack:** Node.js OTel SDK, node:test, YAML output
**前端验证:** No

---

## Scope & PR Strategy

10 ACs, 1 PR（铲屎官偏好少 PR）。依赖链：

```
D0 (counters) ──┬── D1 (registry, doc)
                ├── D2 (snapshot store) ── D6 (monthly task) ── D7 (first digest) ── D8 (conclusions)
                ├── D3 (verification)
                ├── D9 (action-rate)
                └── D4 (self-eval contract, doc)
D5 (tool eval contracts, doc) — independent
```

## Not Building

- 跨猫 403 resolution（spec OQ-4 defer）
- 通用 eval framework（F167-specific）
- Eval dashboard/UI（CLI + YAML）

---

## Task 1: AC-D0 — Instrumentation Gap Closure

Phase C surfaced 6 add-counter findings。在 F167 组件实现处加 OTel counter，更新 f167-eval.ts 消费。

**Files:**
- Modify: `packages/api/src/infrastructure/telemetry/instruments.ts` — add 6 counters
- Modify: `packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts` — increment L1 counters
- Modify: `packages/api/src/routes/callback-hold-ball-routes.ts` — increment C1 zombie counter
- Modify: `packages/api/src/routes/hold-ball-cancel.ts` — increment C1 cancel counter
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` — increment C2 counters, split hint counter
- Modify: `packages/api/src/infrastructure/harness-eval/f167-eval.ts` — update PROM_TO_SHORT + consumption
- Test: `packages/api/test/harness-eval/f167-eval.test.js` — new counter tests

### Step 1.1: Register 6 new OTel counters in instruments.ts

Add to instruments.ts:

```typescript
// F167 L1 (WorklistRegistry streak)
cat_cafe.a2a.l1.streak_warn_count       // L1 ping-pong 警告次数
cat_cafe.a2a.l1.streak_break_count      // L1 乒乓熔断次数

// F167 C1 (hold_ball)
cat_cafe.a2a.c1.zombie_hold_count       // 持球后无后续动作
cat_cafe.a2a.c1.hold_cancel_count       // 用户消息取消持球

// F167 C2 (exit-check)
cat_cafe.a2a.c2.verdict_hint_emitted    // verdict-no-pass hint（从混合 hint_emitted 拆出）
cat_cafe.a2a.c2.void_hold_hint_emitted  // void-hold hint（从混合 hint_emitted 拆出）
cat_cafe.a2a.c2.verdict_without_pass_count  // 直接计数强制放行触发
```

### Step 1.2: Increment L1 counters in WorklistRegistry.ts

In `updateStreakOnPush()` (~line 143):
- When `warnPingPong` flag set → increment `l1.streak_warn_count`
- When `blockPingPong` flag set → increment `l1.streak_break_count`

### Step 1.3: Increment C1 counters

In `callback-hold-ball-routes.ts`:
- When hold registered but previous hold exists for same (thread, cat) → increment `c1.zombie_hold_count`

In `hold-ball-cancel.ts`:
- When `cancelPendingHoldsForThread()` actually cancels → increment `c1.hold_cancel_count`

### Step 1.4: Split C2 hint counter + add verdict_without_pass

In `route-serial.ts`:
- Replace `inlineActionHintEmitted.add(1)` in verdict-no-pass path → `c2.verdict_hint_emitted.add(1)` + `c2.verdict_without_pass_count.add(1)`
- Replace `inlineActionHintEmitted.add(1)` in void-hold path → `c2.void_hold_hint_emitted.add(1)`
- Keep original `inlineActionHintEmitted` for routing hints (backwards compat)

### Step 1.5: Update f167-eval.ts PROM_TO_SHORT + consumption

Add new mappings:

```typescript
cat_cafe_a2a_l1_streak_warn_count: 'l1.streak_warn_count',
cat_cafe_a2a_l1_streak_break_count: 'l1.streak_break_count',
cat_cafe_a2a_c1_zombie_hold_count: 'c1.zombie_hold_count',
cat_cafe_a2a_c1_hold_cancel_count: 'c1.hold_cancel_count',
cat_cafe_a2a_c2_verdict_hint_emitted: 'c2.verdict_hint_emitted',
cat_cafe_a2a_c2_void_hold_hint_emitted: 'c2.void_hold_hint_emitted',
cat_cafe_a2a_c2_verdict_without_pass_count: 'c2.verdict_without_pass_count',
```

Update component extraction:
- L1: populate `activationCounts` from `l1.*` counters, update confidence logic
- C1: populate from `c1.*` counters + existing `hold_ball_calls` from traces
- C2: populate from `c2.*` counters, update confidence logic

### Step 1.6: Write tests for new counter consumption

In `f167-eval.test.js`:

```javascript
it('extracts L1 streak counters', () => {
  const snapshot = generateF167Snapshot({
    ...emptyInput,
    metrics: {
      cat_cafe_a2a_l1_streak_warn_count: 5,
      cat_cafe_a2a_l1_streak_break_count: 1,
    },
    traceStats: { spanCount: 10, maxSpans: 10000, maxAgeMs: 86400000,
      oldestStoredAt: Date.now() - 3600000, newestStoredAt: Date.now() },
  });
  const l1 = snapshot.components.find(c => c.componentId === 'L1');
  assert.equal(l1.activationCounts['l1.streak_warn_count'], 5);
  assert.equal(l1.activationCounts['l1.streak_break_count'], 1);
  assert.notEqual(l1.confidence, 'no-data');
});
```

Similar tests for C1 and C2 counters.

### Step 1.7: Run tests, verify, commit

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/harness-eval/*.test.js
# Expected: all pass including new counter tests
git commit -m "feat(F192): AC-D0 instrumentation gap closure — 6 new F167 counters [宪宪/Opus-46🐾]"
```

---

## Task 2: AC-D1 — Harness Component Registry

Structured doc: F167 每个 harness 组件拆出 hard/soft/eval 三栏。

**Files:**
- Create: `docs/harness-feedback/registry/F167-component-registry.yaml`

Format:

```yaml
featureId: F167
components:
  - id: L1
    name: WorklistRegistry Ping-Pong Breaker
    hard:
      file: packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts
      mechanism: streak counter + warn/block thresholds
    soft:
      skills: [shared-rules §ball-passing]
      prompts: [WorklistRegistry ping-pong warning message]
    eval:
      counters: [l1.streak_warn_count, l1.streak_break_count]
      confidence: medium (after D0)
      gaps: []
  # ... C1, C2, route-serial
```

### Step 2.1: Write registry YAML

### Step 2.2: Commit

```bash
git commit -m "docs(F192): AC-D1 F167 component registry [宪宪/Opus-46🐾]"
```

---

## Task 3: AC-D3 — End-to-End Verification

Recall gate: Phase B fixture friction signals must be detected by Phase C pipeline.
Precision gate: normal traces must not produce false positives.

**Files:**
- Create: `packages/api/test/harness-eval/e2e-verification.test.js`

### Step 3.1: Write recall gate test

```javascript
it('detects Phase B fixture: ball-drop pattern', () => {
  // Simulate: high shadow_miss ratio (known friction from Phase B trace fixture)
  const report = generateAttributionReport({
    featureId: 'F167',
    snapshot: { components: [makeComponent({
      activationCounts: { 'inline_action.checked': 50 },
      frictionCounts: { 'inline_action.shadow_miss': 10 },
    })] },
  });
  assert.ok(report.findings.length >= 1);
  assert.equal(report.findings[0].attribution.primaryLayer, 'harness_misfit');
});
```

### Step 3.2: Write precision gate test

```javascript
it('no false positive on normal trace (all counters healthy)', () => {
  const report = generateAttributionReport({
    featureId: 'F167',
    snapshot: { components: [makeComponent({
      activationCounts: { 'inline_action.checked': 100, 'inline_action.detected': 95 },
      frictionCounts: { 'inline_action.shadow_miss': 1 },
    })] },
  });
  assert.equal(report.findings.length, 0);
});
```

### Step 3.3: Run tests, commit

```bash
git commit -m "feat(F192): AC-D3 end-to-end verification gates [宪宪/Opus-46🐾]"
```

---

## Task 4: AC-D9 — Attribution Action-Rate

Track findings → acted-on ratio as pipeline health metric.

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/attribution.ts` — add action-rate calculation
- Test: `packages/api/test/harness-eval/attribution.test.js`

### Step 4.1: Add action-rate to AttributionReport

```typescript
interface AttributionReport {
  // ... existing fields
  actionRate?: {
    total: number;
    actedOn: number;
    rate: number;
    sunsetCandidate: boolean; // true if < 50% for 3+ months
  };
}
```

### Step 4.2: Implement action-rate calculation

Compare current findings against previous attribution YAML (if exists) — count findings whose status changed from 'open' to 'resolved'.

### Step 4.3: Write test, commit

```bash
git commit -m "feat(F192): AC-D9 attribution action-rate meta-loop [宪宪/Opus-46🐾]"
```

---

## Task 5: AC-D2 + D6 — Snapshot Store + Monthly Digest Task

**Files:**
- Modify: `scripts/run-f167-eval.mjs` — add `--store` mode for daily snapshot
- Create: `docs/harness-feedback/snapshots/` (daily output directory)

### Step 5.1: Add --store flag to runner

When `--store` is set, write snapshot to `docs/harness-feedback/snapshots/YYYY-MM-DD-F167-eval.yaml` with dedup.

### Step 5.2: Register daily scheduled task (AC-D2)

Use `cat_cafe_register_scheduled_task` with daily cron.

### Step 5.3: Register monthly digest task (AC-D6)

Use `cat_cafe_register_scheduled_task` with monthly cron — aggregates daily snapshots.

### Step 5.4: Commit

```bash
git commit -m "feat(F192): AC-D2/D6 snapshot store + digest tasks [宪宪/Opus-46🐾]"
```

---

## Task 6: AC-D4 + D5 — Self-Eval + Tool Eval Contracts (docs)

**Files:**
- Create: `docs/harness-feedback/tool-evals/f192-eval-pipeline-contract.md` (AC-D4)
- Create: `docs/harness-feedback/tool-evals/search-evidence-eval-contract.md` (AC-D5)
- Create: `docs/harness-feedback/tool-evals/post-message-eval-contract.md`
- Create: `docs/harness-feedback/tool-evals/hold-ball-eval-contract.md`
- Create: `docs/harness-feedback/tool-evals/browser-tools-eval-contract.md`
- Create: `docs/harness-feedback/tool-evals/rich-block-eval-contract.md`

Each uses the v1 eval contract template: Primary Users / Activation Signal / Friction Metric / Regression Fixture / Sunset Signal.

### Step 6.1: Write contracts, commit

```bash
git commit -m "docs(F192): AC-D4/D5 self-eval + top-5 tool eval contracts [宪宪/Opus-46🐾]"
```

---

## Task 7: AC-D7 + D8 — First Digest + Conclusions

### Step 7.1: Run first digest (AC-D7)

Execute eval runner with live data, produce first micro fit digest.

### Step 7.2: Write conclusions into spec (AC-D8)

Update F192 spec with digest conclusions: upgrade / streamline / sunset recommendations for Phase A~C mechanisms.

### Step 7.3: Commit

```bash
git commit -m "docs(F192): AC-D7/D8 first digest + conclusions [宪宪/Opus-46🐾]"
```

---

## Task 8: Live eval run + update attribution output

Re-run live eval with new counters (if runtime is available), update YAML outputs.

```bash
node scripts/run-f167-eval.mjs --base-url http://localhost:3001 --cookie "..." --store
git commit -m "docs(F192): live eval with D0 instrumentation [宪宪/Opus-46🐾]"
```

---

## Open Questions

### 技术 OQ

1. **C2 hint counter split backwards compatibility**: 旧的 `inlineActionHintEmitted` counter 是否保留？保留 = 向后兼容但 counter 重复计数，移除 = Phase C eval 需要更新 PROM_TO_SHORT。**决定**：保留原 counter 用于 routing hints，新 counter 用于 C2 hints，f167-eval 同时消费两类。
2. **Zombie hold 检测逻辑**: `callback-hold-ball-routes.ts` 里的 single-slot 替换（新 hold 替换旧 hold）算 zombie 吗？**决定**：是——被替换的 hold 未完成 nextStep，符合 zombie 定义。
3. **Snapshot store 存储格式**: YAML 文件 vs SQLite。**决定**：YAML（可被 search_evidence 索引，spec OQ-5 仍 defer），Phase E 如需要再迁移。

### 价值 OQ

无——10 条 AC 均已铲屎官+47 愿景守护确认。
