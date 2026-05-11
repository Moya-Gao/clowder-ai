import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateF167Snapshot } from '../../dist/infrastructure/harness-eval/f167-eval.js';

const emptyInput = {
  traces: { spans: [], count: 0 },
  metrics: {},
  metricsHistory: { snapshots: [], count: 0 },
  traceStats: {
    spanCount: 0,
    maxSpans: 10000,
    maxAgeMs: 86400000,
    oldestStoredAt: null,
    newestStoredAt: null,
  },
};

describe('F167 Runtime Eval Snapshot', () => {
  it('produces snapshot with 4 components', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    assert.equal(snapshot.featureId, 'F167');
    assert.equal(snapshot.components.length, 4);
    const ids = snapshot.components.map((c) => c.componentId).sort();
    assert.deepEqual(ids, ['C1', 'C2', 'L1', 'route-serial']);
  });

  it('includes metadata fields', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    assert.equal(snapshot.dataSource, 'F153 /api/telemetry/*');
    assert.equal(snapshot.generatedBy, 'F192 Phase C eval');
    assert.ok(snapshot.generatedAt);
    assert.ok(snapshot.window);
    assert.equal(typeof snapshot.window.durationHours, 'number');
  });

  it('marks telemetry gaps for L1 (no counter)', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    const l1 = snapshot.components.find((c) => c.componentId === 'L1');
    assert.ok(l1.telemetryGaps.length > 0);
    assert.ok(l1.telemetryGaps.some((g) => g.reason === 'no_counter'));
    assert.equal(l1.confidence, 'no-data');
  });

  it('marks C1 gap for zombie/cancel counter', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    const c1 = snapshot.components.find((c) => c.componentId === 'C1');
    assert.ok(c1.telemetryGaps.some((g) => g.reason === 'no_counter' && g.metric.includes('zombie')));
  });

  it('marks C2 hint counter as mixed', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    const c2 = snapshot.components.find((c) => c.componentId === 'C2');
    assert.ok(c2.telemetryGaps.some((g) => g.metric.includes('hint_emitted')));
  });

  it('extracts route-serial counters from bare metrics keys', () => {
    const snapshot = generateF167Snapshot({
      ...emptyInput,
      metrics: {
        cat_cafe_a2a_inline_action_checked: 100,
        cat_cafe_a2a_inline_action_detected: 5,
        cat_cafe_a2a_inline_action_shadow_miss: 2,
        cat_cafe_a2a_line_start_detected: 80,
      },
      traceStats: {
        spanCount: 100,
        maxSpans: 10000,
        maxAgeMs: 86400000,
        oldestStoredAt: Date.now() - 3600000,
        newestStoredAt: Date.now(),
      },
    });
    const rs = snapshot.components.find((c) => c.componentId === 'route-serial');
    assert.equal(rs.activationCounts['inline_action.checked'], 100);
    assert.equal(rs.activationCounts['line_start.detected'], 80);
    assert.equal(rs.frictionCounts['inline_action.shadow_miss'], 2);
    assert.notEqual(rs.confidence, 'no-data');
  });

  it('extracts route-serial counters from Prometheus _total + labeled keys', () => {
    const snapshot = generateF167Snapshot({
      ...emptyInput,
      metrics: {
        'cat_cafe_a2a_inline_action_checked_total{agent_id="codex",otel_scope_name="cat-cafe-api",otel_scope_version="0.1.0"}': 8,
        'cat_cafe_a2a_inline_action_checked_total{agent_id="opus",otel_scope_name="cat-cafe-api",otel_scope_version="0.1.0"}': 7,
        'cat_cafe_a2a_inline_action_checked_total{agent_id="opus-47",otel_scope_name="cat-cafe-api",otel_scope_version="0.1.0"}': 4,
        'cat_cafe_a2a_line_start_detected_total{agent_id="codex",otel_scope_name="cat-cafe-api",otel_scope_version="0.1.0"}': 3,
        'cat_cafe_a2a_line_start_detected_total{agent_id="opus-47",otel_scope_name="cat-cafe-api",otel_scope_version="0.1.0"}': 2,
      },
      traceStats: {
        spanCount: 100,
        maxSpans: 10000,
        maxAgeMs: 86400000,
        oldestStoredAt: Date.now() - 3600000,
        newestStoredAt: Date.now(),
      },
    });
    const rs = snapshot.components.find((c) => c.componentId === 'route-serial');
    assert.equal(rs.activationCounts['inline_action.checked'], 19);
    assert.equal(rs.activationCounts['line_start.detected'], 5);
    assert.notEqual(rs.confidence, 'no-data');
  });

  it('counts hold_ball from trace events', () => {
    const now = Date.now();
    const holdBallSpan = {
      traceId: 'abc',
      spanId: '123',
      name: 'cat_cafe.invocation',
      startTimeMs: now - 1000,
      endTimeMs: now,
      durationMs: 1000,
      status: { code: 0 },
      attributes: {},
      events: [{ name: 'tool_use', timeMs: now - 500, attributes: { 'tool.name': 'cat_cafe_hold_ball' } }],
    };
    const snapshot = generateF167Snapshot({
      traces: { spans: [holdBallSpan], count: 1 },
      metrics: {},
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: {
        spanCount: 1,
        maxSpans: 10000,
        maxAgeMs: 86400000,
        oldestStoredAt: now,
        newestStoredAt: now,
      },
    });
    const c1 = snapshot.components.find((c) => c.componentId === 'C1');
    assert.equal(c1.activationCounts['hold_ball_calls'], 1);
  });

  it('counts multiple hold_ball events across spans', () => {
    const now = Date.now();
    const makeSpan = (id, toolName) => ({
      traceId: 'abc',
      spanId: id,
      name: 'cat_cafe.invocation',
      startTimeMs: now - 1000,
      endTimeMs: now,
      durationMs: 1000,
      status: { code: 0 },
      attributes: {},
      events: [{ name: 'tool_use', timeMs: now - 500, attributes: { 'tool.name': toolName } }],
    });
    const snapshot = generateF167Snapshot({
      traces: {
        spans: [
          makeSpan('s1', 'cat_cafe_hold_ball'),
          makeSpan('s2', 'cat_cafe_hold_ball'),
          makeSpan('s3', 'cat_cafe_post_message'),
        ],
        count: 3,
      },
      metrics: {},
      metricsHistory: { snapshots: [], count: 0 },
      traceStats: {
        spanCount: 3,
        maxSpans: 10000,
        maxAgeMs: 86400000,
        oldestStoredAt: now,
        newestStoredAt: now,
      },
    });
    const c1 = snapshot.components.find((c) => c.componentId === 'C1');
    assert.equal(c1.activationCounts['hold_ball_calls'], 2);
  });

  it('overall confidence reflects worst component', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    assert.equal(snapshot.overallConfidence, 'no-data');
  });

  it('includes summary string', () => {
    const snapshot = generateF167Snapshot(emptyInput);
    assert.equal(typeof snapshot.summary, 'string');
    assert.ok(snapshot.summary.length > 0);
  });
});
