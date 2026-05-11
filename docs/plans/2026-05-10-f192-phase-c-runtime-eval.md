# F192 Phase C: Runtime Harness Eval — Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** 从 F153 消费运行时 telemetry，对 F167 A2A harness 跑一次真实的端到端 eval（观测→归因→行动）
**Acceptance Criteria:**
- AC-C1: F153 Telemetry Adapter（消费四个公开 API + adapter contract test）
- AC-C2: F167 Runtime Eval Snapshot（真实数据驱动 + telemetry gap 标注）
- AC-C3: Attribution Finding（至少一个归因→抽象→解决循环）
- AC-C4: Phase B Reclassification（已在 spec 更新 `59866af8b` 完成）
**Architecture cell:** none (cross-cutting eval tool, not a new architecture component)
**Map delta:** none
**Map delta why:** eval pipeline 是 enrichment 工具，不引入新的 ownership cell
**Architecture:** F192 adapter 消费 F153 四个公开 HTTP API（`/traces`, `/traces/stats`, `/metrics`, `/metrics/history`），聚合成 per-component eval snapshot，对 friction signal 做 7-class attribution。输出为 YAML + markdown 文档到 `docs/harness-feedback/`。
**Tech Stack:** TypeScript, node:test, fetch API, YAML output
**前端验证:** No

---

## Finish Line

**B definition:** F167 A2A harness 的四个组件各有一份 telemetry 驱动的 health snapshot（含 gap 标注），至少一个 attribution finding 基于真实 telemetry 产出。

**What we're NOT building:**
- Daily scheduled task（Phase D）
- Monthly digest（Phase D）
- Self-eval contract（Phase D）
- Component Registry（Phase D）
- Recall/precision gate（Phase D）
- General-purpose eval pipeline（不通用化，只做 F167）
- Hub 前端 UI

## Terminal Schema

```typescript
// F192 adapter types — NOT importing F153 internal types
interface EvalTraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;           // e.g. 'cat_cafe.invocation', 'cat_cafe.route'
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  status: { code: number; message?: string };
  attributes: Record<string, unknown>;
  events: ReadonlyArray<{ name: string; timeMs: number; attributes?: Record<string, unknown> }>;
}

interface EvalTracesResponse {
  spans: EvalTraceSpan[];
  count: number;
}

interface EvalMetricsSnapshot {
  timestamp: number;
  metrics: Record<string, number>;
}

interface EvalMetricsHistoryResponse {
  snapshots: EvalMetricsSnapshot[];
  count: number;
}

interface EvalTraceStoreStats {
  spanCount: number;
  maxSpans: number;
  maxAgeMs: number;
  oldestStoredAt: number | null;
  newestStoredAt: number | null;
}

// Eval output types
interface ComponentHealth {
  componentId: string;    // 'L1' | 'C1' | 'C2' | 'route-serial'
  componentName: string;
  activationCounts: Record<string, number | null>;
  frictionCounts: Record<string, number | null>;
  falsePositiveCandidates: string[];
  bypassCandidates: string[];
  confidence: 'high' | 'medium' | 'low' | 'no-data';
  telemetryGaps: TelemetryGap[];
}

interface TelemetryGap {
  metric: string;
  reason: 'no_counter' | 'span_not_persisted' | 'tool_use_not_queryable' |
          'cross_cat_403' | 'trace_context_incomplete' | 'ttl_expired';
  impact: string;
}

interface RuntimeEvalSnapshot {
  featureId: string;      // 'F167'
  window: { startMs: number; endMs: number; durationHours: number };
  dataSource: string;     // 'F153 /api/telemetry/*'
  generatedAt: string;    // ISO 8601
  generatedBy: string;    // 'F192 Phase C eval'
  traceStoreStats: EvalTraceStoreStats;
  components: ComponentHealth[];
  overallConfidence: 'high' | 'medium' | 'low' | 'no-data';
  summary: string;
}

interface AttributionRecord {
  id: string;             // 'AR-YYYY-MM-DD-NNN'
  relatedFeature: string;
  frictionSignal: {
    type: string;         // e.g. 'void-pass', 'zombie-hold', 'ping-pong'
    severity: 'low' | 'medium' | 'high';
    confidence: number;   // 0.0..1.0
    detectedAt: string;
  };
  attribution: {
    primaryLayer: string; // 7-class matrix value
    pipelineOrHuman: 'pipeline' | 'human-required';
    evidence: Array<{ type: string; anchor: string; excerpt: string }>;
  };
  proposedAction: Array<{
    action: string;       // e.g. 'lesson-candidate', 'tool-fix'
    target: string;
    rationale: string;
  }>;
  status: 'open';
}

interface AttributionReport {
  featureId: string;
  evalSnapshotId: string;
  generatedAt: string;
  findings: AttributionRecord[];
  noFindingRecord?: {
    reason: string;
    evidence: string;
  };
}
```

## Telemetry Availability per Component

| Component | Counter | Trace Events | Gap |
|-----------|---------|-------------|-----|
| L1 WorklistRegistry | **NONE** | No OTel instrumentation | streak warn/block events not observable |
| C1 hold_ball | **NONE** | `tool_use` span events (zero-duration markers) | must count from trace events; no zombie/cancel counter |
| C2 exit-check | `inline_action.hint_emitted` (mixed) | — | hint counter mixes routing + verdict hints |
| route-serial | 8+1 counters ✓ | — | Best coverage: checked/detected/shadow_miss/feedback_written/hint_emitted/routed_set_skip/line_start.detected |

---

## Task 1: Adapter Types + Parser (AC-C1)

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/telemetry-adapter.ts`

**Step 1: Write the adapter types and parser functions**

Define F192's own types (mirror F153 API response shapes without importing them) and parser functions that validate response structure.

```typescript
// telemetry-adapter.ts
export interface EvalTraceSpan { /* as above */ }
export interface EvalTracesResponse { spans: EvalTraceSpan[]; count: number; }
export interface EvalMetricsSnapshot { timestamp: number; metrics: Record<string, number>; }
export interface EvalMetricsHistoryResponse { snapshots: EvalMetricsSnapshot[]; count: number; }
export interface EvalTraceStoreStats { /* as above */ }

export interface TelemetryAdapterConfig {
  baseUrl: string;    // e.g. 'http://localhost:3102'
  cookie: string;     // session cookie for auth
}

export function parseTracesResponse(json: unknown): EvalTracesResponse { /* validate + parse */ }
export function parseMetricsHistoryResponse(json: unknown): EvalMetricsHistoryResponse { /* validate + parse */ }
export function parseTraceStoreStats(json: unknown): EvalTraceStoreStats { /* validate + parse */ }

export async function fetchTraces(config: TelemetryAdapterConfig, filter?: { catId?: string }): Promise<EvalTracesResponse> { /* fetch + parse */ }
export async function fetchTracesStats(config: TelemetryAdapterConfig): Promise<EvalTraceStoreStats> { /* fetch + parse */ }
export async function fetchMetrics(config: TelemetryAdapterConfig): Promise<Record<string, number>> { /* fetch + parse prometheus text */ }
export async function fetchMetricsHistory(config: TelemetryAdapterConfig, since?: number): Promise<EvalMetricsHistoryResponse> { /* fetch + parse */ }
```

**Step 2: Commit**

```bash
git add packages/api/src/infrastructure/harness-eval/telemetry-adapter.ts
git commit -m "feat(F192): add telemetry adapter types + parser for eval pipeline [宪宪/Opus-46🐾]"
```

---

## Task 2: Adapter Contract Test (AC-C1)

**Files:**
- Create: `packages/api/test/harness-eval/telemetry-adapter-contract.test.js`
- Create: `packages/api/test/harness-eval/fixtures/traces-response.json`
- Create: `packages/api/test/harness-eval/fixtures/metrics-history-response.json`
- Create: `packages/api/test/harness-eval/fixtures/traces-stats-response.json`

**Step 1: Capture fixture data from live F153 API**

Run the dev server, call each endpoint, save responses as JSON fixtures. This is a manual step — output serves as the contract baseline.

```bash
# With dev server running on localhost:3102:
curl -b "$SESSION_COOKIE" http://localhost:3102/api/telemetry/traces?limit=10 | jq . > packages/api/test/harness-eval/fixtures/traces-response.json
curl -b "$SESSION_COOKIE" http://localhost:3102/api/telemetry/traces/stats | jq . > packages/api/test/harness-eval/fixtures/traces-stats-response.json
curl -b "$SESSION_COOKIE" http://localhost:3102/api/telemetry/metrics/history?limit=5 | jq . > packages/api/test/harness-eval/fixtures/metrics-history-response.json
```

If the dev server isn't running or has no data, create synthetic fixtures that match the documented F153 response shapes.

**Step 2: Write the contract test**

```javascript
// telemetry-adapter-contract.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTracesResponse, parseMetricsHistoryResponse, parseTraceStoreStats } from
  '../../src/infrastructure/harness-eval/telemetry-adapter.js';

// Load fixture data — the contract baseline
import tracesFixture from './fixtures/traces-response.json' with { type: 'json' };
import metricsHistoryFixture from './fixtures/metrics-history-response.json' with { type: 'json' };
import statsFixture from './fixtures/traces-stats-response.json' with { type: 'json' };

describe('F192 Telemetry Adapter Contract', () => {
  it('parses /traces response without throwing', () => {
    const result = parseTracesResponse(tracesFixture);
    assert.ok(Array.isArray(result.spans));
    assert.equal(typeof result.count, 'number');
    if (result.spans.length > 0) {
      const span = result.spans[0];
      assert.ok(span.traceId); assert.ok(span.spanId); assert.ok(span.name);
      assert.equal(typeof span.startTimeMs, 'number');
      assert.equal(typeof span.durationMs, 'number');
    }
  });

  it('parses /metrics/history response without throwing', () => {
    const result = parseMetricsHistoryResponse(metricsHistoryFixture);
    assert.ok(Array.isArray(result.snapshots));
    assert.equal(typeof result.count, 'number');
    if (result.snapshots.length > 0) {
      assert.equal(typeof result.snapshots[0].timestamp, 'number');
      assert.equal(typeof result.snapshots[0].metrics, 'object');
    }
  });

  it('parses /traces/stats response without throwing', () => {
    const result = parseTraceStoreStats(statsFixture);
    assert.equal(typeof result.spanCount, 'number');
    assert.equal(typeof result.maxSpans, 'number');
    assert.equal(typeof result.maxAgeMs, 'number');
  });

  it('rejects malformed response with clear error', () => {
    assert.throws(() => parseTracesResponse({ wrong: 'shape' }),
      /expected.*spans/i);
  });
});
```

**Step 3: Run test to verify Red (parsers not yet implemented)**

Run: `node --test packages/api/test/harness-eval/telemetry-adapter-contract.test.js`
Expected: FAIL — parsers don't exist yet or throw on fixture data

**Step 4: Implement parsers to make tests pass**

Run: `node --test packages/api/test/harness-eval/telemetry-adapter-contract.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/test/harness-eval/ packages/api/src/infrastructure/harness-eval/
git commit -m "test(F192): adapter contract test — F153 response shape boundary [宪宪/Opus-46🐾]"
```

---

## Task 3: Eval Snapshot Aggregation (AC-C2)

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/f167-eval.ts`
- Create: `packages/api/test/harness-eval/f167-eval.test.js`

**Step 1: Write the failing test**

```javascript
// f167-eval.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateF167Snapshot } from
  '../../src/infrastructure/harness-eval/f167-eval.js';

describe('F167 Runtime Eval Snapshot', () => {
  it('produces snapshot with 4 components', () => {
    const snapshot = generateF167Snapshot({
      traces: { spans: [], count: 0 },
      metrics: {},
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: { spanCount: 0, maxSpans: 10000, maxAgeMs: 86400000, oldestStoredAt: null, newestStoredAt: null },
    });
    assert.equal(snapshot.featureId, 'F167');
    assert.equal(snapshot.components.length, 4);
    const ids = snapshot.components.map(c => c.componentId).sort();
    assert.deepEqual(ids, ['C1', 'C2', 'L1', 'route-serial']);
  });

  it('marks telemetry gaps for L1 (no counter)', () => {
    const snapshot = generateF167Snapshot({
      traces: { spans: [], count: 0 },
      metrics: {},
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: { spanCount: 0, maxSpans: 10000, maxAgeMs: 86400000, oldestStoredAt: null, newestStoredAt: null },
    });
    const l1 = snapshot.components.find(c => c.componentId === 'L1');
    assert.ok(l1.telemetryGaps.length > 0);
    assert.ok(l1.telemetryGaps.some(g => g.reason === 'no_counter'));
    assert.equal(l1.confidence, 'no-data');
  });

  it('extracts route-serial counters from metrics', () => {
    const snapshot = generateF167Snapshot({
      traces: { spans: [], count: 0 },
      metrics: {
        'cat_cafe_a2a_inline_action_checked': 100,
        'cat_cafe_a2a_inline_action_detected': 5,
        'cat_cafe_a2a_inline_action_shadow_miss': 2,
        'cat_cafe_a2a_inline_action_hint_emitted': 3,
        'cat_cafe_a2a_inline_action_routed_set_skip': 1,
        'cat_cafe_a2a_line_start_detected': 80,
      },
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: { spanCount: 100, maxSpans: 10000, maxAgeMs: 86400000, oldestStoredAt: Date.now() - 3600000, newestStoredAt: Date.now() },
    });
    const rs = snapshot.components.find(c => c.componentId === 'route-serial');
    assert.equal(rs.activationCounts['inline_action.checked'], 100);
    assert.equal(rs.frictionCounts['inline_action.shadow_miss'], 2);
    assert.equal(rs.confidence, 'medium');  // has data but limited window
  });

  it('counts hold_ball from trace events', () => {
    const holdBallSpan = {
      traceId: 'abc', spanId: '123', name: 'cat_cafe.invocation',
      startTimeMs: Date.now() - 1000, endTimeMs: Date.now(), durationMs: 1000,
      status: { code: 0 }, attributes: {},
      events: [{ name: 'tool_use', timeMs: Date.now() - 500, attributes: { 'tool.name': 'cat_cafe_hold_ball' } }],
    };
    const snapshot = generateF167Snapshot({
      traces: { spans: [holdBallSpan], count: 1 },
      metrics: {},
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: { spanCount: 1, maxSpans: 10000, maxAgeMs: 86400000, oldestStoredAt: Date.now(), newestStoredAt: Date.now() },
    });
    const c1 = snapshot.components.find(c => c.componentId === 'C1');
    assert.equal(c1.activationCounts['hold_ball_calls'], 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/harness-eval/f167-eval.test.js`
Expected: FAIL — `generateF167Snapshot` not found

**Step 3: Implement `generateF167Snapshot`**

The function:
1. Extracts route-serial counters from `metrics` (key prefix `cat_cafe_a2a_`)
2. Counts hold_ball calls from trace event names (`tool.name === 'cat_cafe_hold_ball'`)
3. Marks telemetry gaps for L1 (no counter) and C2 (hint counter mixed)
4. Computes per-component confidence based on data availability
5. Returns `RuntimeEvalSnapshot`

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/harness-eval/f167-eval.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/harness-eval/f167-eval.ts packages/api/test/harness-eval/f167-eval.test.js
git commit -m "feat(F192): F167 eval snapshot aggregation with telemetry gap marking [宪宪/Opus-46🐾]"
```

---

## Task 4: Attribution Logic (AC-C3)

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/attribution.ts`
- Create: `packages/api/test/harness-eval/attribution.test.js`

**Step 1: Write the failing test**

```javascript
// attribution.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateAttributionReport } from
  '../../src/infrastructure/harness-eval/attribution.js';

describe('F192 Attribution', () => {
  it('produces no-finding record when no friction signals', () => {
    const report = generateAttributionReport({
      featureId: 'F167',
      snapshot: {
        components: [
          { componentId: 'route-serial', frictionCounts: {}, telemetryGaps: [], confidence: 'medium',
            activationCounts: { 'inline_action.checked': 100 }, falsePositiveCandidates: [], bypassCandidates: [] },
        ],
      },
    });
    assert.equal(report.findings.length, 0);
    assert.ok(report.noFindingRecord);
    assert.ok(report.noFindingRecord.evidence.length > 0);
  });

  it('detects friction signal from shadow_miss ratio', () => {
    const report = generateAttributionReport({
      featureId: 'F167',
      snapshot: {
        components: [{
          componentId: 'route-serial',
          activationCounts: { 'inline_action.checked': 100, 'inline_action.detected': 5 },
          frictionCounts: { 'inline_action.shadow_miss': 15 },
          telemetryGaps: [], confidence: 'medium',
          falsePositiveCandidates: [], bypassCandidates: [],
        }],
      },
    });
    assert.ok(report.findings.length >= 1);
    const finding = report.findings[0];
    assert.ok(finding.attribution.primaryLayer);
    assert.ok(finding.proposedAction.length > 0);
  });

  it('produces human-required attribution for vision/taste gaps from telemetry gaps', () => {
    const report = generateAttributionReport({
      featureId: 'F167',
      snapshot: {
        components: [{
          componentId: 'L1',
          activationCounts: {},
          frictionCounts: {},
          telemetryGaps: [{ metric: 'streak_warn_count', reason: 'no_counter', impact: 'cannot measure L1 activation' }],
          confidence: 'no-data',
          falsePositiveCandidates: [], bypassCandidates: [],
        }],
      },
    });
    // Telemetry gap itself is a finding (harness not observable)
    assert.ok(report.findings.length >= 1);
    const gapFinding = report.findings.find(f => f.frictionSignal.type === 'observability-gap');
    assert.ok(gapFinding);
    assert.equal(gapFinding.attribution.primaryLayer, 'tool_gap');
  });

  it('includes 7-class attribution matrix values only', () => {
    const validClasses = [
      'vision_gap', 'translation_gap', 'harness_misfit', 'tool_gap',
      'execution_gap', 'environment_drift', 'taste_gap',
    ];
    const report = generateAttributionReport({
      featureId: 'F167',
      snapshot: {
        components: [{
          componentId: 'route-serial',
          activationCounts: { 'inline_action.checked': 50 },
          frictionCounts: { 'inline_action.shadow_miss': 20 },
          telemetryGaps: [], confidence: 'medium',
          falsePositiveCandidates: [], bypassCandidates: [],
        }],
      },
    });
    for (const finding of report.findings) {
      assert.ok(validClasses.includes(finding.attribution.primaryLayer),
        `invalid attribution class: ${finding.attribution.primaryLayer}`);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/harness-eval/attribution.test.js`
Expected: FAIL

**Step 3: Implement `generateAttributionReport`**

The function:
1. Scans each component's friction counts for anomalies (e.g., shadow_miss/checked > threshold)
2. Scans telemetry gaps — "not observable" is itself a friction signal (type: 'observability-gap', attribution: 'tool_gap')
3. For each detected friction signal, applies 7-class attribution matrix
4. If no friction signals found, outputs a `noFindingRecord` with evidence (what was checked, what data was available)
5. Returns `AttributionReport`

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/harness-eval/attribution.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/harness-eval/attribution.ts packages/api/test/harness-eval/attribution.test.js
git commit -m "feat(F192): attribution logic with 7-class matrix + observability gap detection [宪宪/Opus-46🐾]"
```

---

## Task 5: Eval Runner Script (AC-C2 + AC-C3)

**Files:**
- Create: `scripts/run-f167-eval.mjs`

**Step 1: Write the runner script**

```javascript
// scripts/run-f167-eval.mjs
// Usage: node scripts/run-f167-eval.mjs --base-url http://localhost:3102 --cookie "session=..."
// Output: docs/harness-feedback/snapshots/YYYY-MM-DD-F167-eval.md
//         docs/harness-feedback/attributions/YYYY-MM-DD-F167-attribution.md

import { fetchTraces, fetchTracesStats, fetchMetrics, fetchMetricsHistory } from
  '../packages/api/src/infrastructure/harness-eval/telemetry-adapter.js';
import { generateF167Snapshot } from
  '../packages/api/src/infrastructure/harness-eval/f167-eval.js';
import { generateAttributionReport } from
  '../packages/api/src/infrastructure/harness-eval/attribution.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

// 1. Parse CLI args
// 2. Call F153 APIs via adapter
// 3. Generate snapshot
// 4. Generate attribution report
// 5. Write output to docs/harness-feedback/
```

The script:
1. Parses `--base-url` and `--cookie` from CLI args (or reads from `EVAL_BASE_URL` / `EVAL_SESSION_COOKIE` env vars)
2. Calls all four F153 endpoints via the adapter
3. Passes data through `generateF167Snapshot()`
4. Passes snapshot through `generateAttributionReport()`
5. Formats snapshot as YAML-in-markdown with frontmatter (`doc_kind: harness-feedback`, `feedback_type: eval-snapshot`)
6. Formats attribution as YAML-in-markdown with frontmatter (`doc_kind: harness-feedback`, `feedback_type: attribution`)
7. Writes to `docs/harness-feedback/snapshots/` and `docs/harness-feedback/attributions/`

**Step 2: Run against dev server**

```bash
# Start dev server in worktree
pnpm dev:direct &

# Wait for server, then run eval
node scripts/run-f167-eval.mjs --base-url http://localhost:3102 --cookie "$SESSION_COOKIE"
```

**Step 3: Commit script**

```bash
git add scripts/run-f167-eval.mjs
git commit -m "feat(F192): eval runner script — F153 API → snapshot → attribution [宪宪/Opus-46🐾]"
```

---

## Task 6: Live Eval Run + Output Documents (AC-C2 + AC-C3)

**Step 1: Run the eval against the live dev server**

Execute the runner script with a valid session. Inspect the output.

**Step 2: Review output quality**

- Does the snapshot have all 4 components?
- Are telemetry gaps marked correctly?
- Does the attribution report have findings or a valid no-finding record?
- Is the YAML well-formed?

**Step 3: Commit output documents**

```bash
git add docs/harness-feedback/snapshots/ docs/harness-feedback/attributions/
git commit -m "docs(F192): F167 runtime eval snapshot + attribution report — Phase C [宪宪/Opus-46🐾]"
```

---

## Task 7: AC-C4 Verification

AC-C4 (Phase B Reclassification) was completed in spec update `59866af8b`:
- Phase B renamed to "Eval Contract & Evidence Artifact Pilot"
- Table showing Phase B products' reclassified roles added to spec
- KD-5 documents the pivot decision

**No additional implementation needed.** Verify the spec text is accurate after implementation.

---

## Open Questions

| # | 类型 | 问题 | 处置 |
|---|------|------|------|
| OQ-1 | 技术 | F153 telemetry endpoints 的 session auth — eval 脚本如何获取有效 cookie？ | 手动从浏览器获取 dev session cookie，传给脚本。Phase D 可加 service token |
| OQ-2 | 技术 | Prometheus 计数器键名格式：OTel instrument 用 `.` 分隔（`cat_cafe.a2a.inline_action.checked`）但 Prometheus 输出可能转为 `_`。需要在 Task 2 fixture 验证实际键名 | 实现时查 `/api/telemetry/metrics` 实际输出确认 |
| OQ-3 | 技术 | TraceSpanDTO 的 `events` 里 tool_use 的属性键名（`tool.name` vs `toolName`）— 需要从 fixture 验证 | Task 2 fixture 捕获时确认 |

## Commit Plan

| # | Message | AC |
|---|---------|-----|
| 1 | `feat(F192): add telemetry adapter types + parser for eval pipeline` | AC-C1 |
| 2 | `test(F192): adapter contract test — F153 response shape boundary` | AC-C1 |
| 3 | `feat(F192): F167 eval snapshot aggregation with telemetry gap marking` | AC-C2 |
| 4 | `feat(F192): attribution logic with 7-class matrix + observability gap detection` | AC-C3 |
| 5 | `feat(F192): eval runner script — F153 API → snapshot → attribution` | AC-C2 + AC-C3 |
| 6 | `docs(F192): F167 runtime eval snapshot + attribution report — Phase C` | AC-C2 + AC-C3 |
