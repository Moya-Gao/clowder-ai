/**
 * F192 Phase D — YAML formatter test (local R1 P1-2 fix lock).
 *
 * The on-disk attribution YAML (written by `scripts/run-f167-eval.mjs`) is what
 * the NEXT eval cycle reads. If the formatter drops `evidence.sample` or
 * `sampleCoverage`, in-memory AttributionRecord has samples but artifact does
 * not — verdict can't close.
 *
 * Locks:
 *   - per-fire-sample evidence rows serialize all sub-fields (trace_id, span_id,
 *     *_hash, agent_id, trigger, fired_at)
 *   - sample_coverage block emitted on sampled metrics, omitted on non-sampled
 *   - artifact privacy invariant: no raw IDs (test fixture uses 'raw-' prefix
 *     for would-be-leakage; 'hash-' for HMAC'd safe-to-emit)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAttributionYaml } from './format-eval-yaml.mjs';

const dummyFingerprint = (f) => `${f.frictionSignal.type}::${f.attribution.evidence[0]?.anchor ?? 'none'}`;

test('formatAttributionYaml: emits per-fire-sample sub-fields including all *_hash + spanId/traceId raw', () => {
  const report = {
    featureId: 'F167',
    evalSnapshotId: 'eval-F167-2026-06-08',
    generatedAt: '2026-06-08T00:00:00.000Z',
    findings: [
      {
        id: 'AR-2026-06-08-001',
        relatedFeature: 'F167',
        frictionSignal: { type: 'c2.verdict_without_pass_count', severity: 'medium', confidence: 0.7, detectedAt: '2026-06-08T00:00:00.000Z' },
        attribution: {
          primaryLayer: 'harness_misfit',
          pipelineOrHuman: 'pipeline',
          evidence: [
            { type: 'counter', anchor: 'C2/c2.verdict_without_pass_count', excerpt: 'baseline=17, ratio=17.6%' },
            {
              type: 'per-fire-sample',
              anchor: 'C2/c2.verdict_without_pass_count/span-abc',
              excerpt: 'firedAt=2026-06-08T01:00:00.000Z trigger=reject',
              sample: {
                traceId: 'trace-raw-keepable',
                spanId: 'span-abc',
                messageIdHash: 'hash-msg-redacted',
                invocationIdHash: 'hash-inv-redacted',
                threadIdHash: 'hash-thread-redacted',
                agentId: 'codex',
                threadSystemKind: 'product',
                trigger: 'reject',
                firedAt: '2026-06-08T01:00:00.000Z',
              },
            },
          ],
        },
        sampleCoverage: { sampleCount: 1, metricCount: 3, complete: false },
        proposedAction: [{ action: 'harness-tune', target: 'C2/c2.verdict_without_pass_count', rationale: 'ratio exceeds threshold' }],
        status: 'open',
      },
    ],
  };
  const yaml = formatAttributionYaml(report, '2026-06-08', dummyFingerprint);

  // Per-fire-sample sub-fields all serialized
  assert.ok(yaml.includes('sample:'), 'sample block emitted');
  assert.ok(yaml.includes('trace_id: "trace-raw-keepable"'), 'traceId is raw OTel locator (Class D)');
  assert.ok(yaml.includes('span_id: "span-abc"'), 'spanId is raw OTel locator');
  assert.ok(yaml.includes('message_id_hash: "hash-msg-redacted"'), 'messageIdHash serialized');
  assert.ok(yaml.includes('invocation_id_hash: "hash-inv-redacted"'), 'invocationIdHash serialized');
  assert.ok(yaml.includes('thread_id_hash: "hash-thread-redacted"'), 'threadIdHash serialized');
  assert.ok(yaml.includes('agent_id: "codex"'), 'agentId passthrough');
  assert.ok(yaml.includes('thread_system_kind: "product"'), 'threadSystemKind passthrough');
  assert.ok(yaml.includes('trigger: "reject"'), 'trigger bucket');
  assert.ok(yaml.includes('fired_at: "2026-06-08T01:00:00.000Z"'), 'firedAt ISO');

  // sample_coverage block
  assert.ok(yaml.includes('sample_coverage:'), 'sample_coverage block emitted');
  assert.ok(yaml.includes('sample_count: 1'));
  assert.ok(yaml.includes('metric_count: 3'));
  assert.ok(yaml.includes('complete: false'));
});

test('formatAttributionYaml: artifact privacy invariant — no raw IDs leak (only hashes + OTel locators)', () => {
  const report = {
    featureId: 'F167',
    evalSnapshotId: 'eval-F167-2026-06-08',
    generatedAt: '2026-06-08T00:00:00.000Z',
    findings: [
      {
        id: 'AR-2026-06-08-001',
        relatedFeature: 'F167',
        frictionSignal: { type: 'c2.verdict_without_pass_count', severity: 'medium', confidence: 0.7, detectedAt: '2026-06-08T00:00:00.000Z' },
        attribution: {
          primaryLayer: 'harness_misfit',
          pipelineOrHuman: 'pipeline',
          evidence: [
            { type: 'counter', anchor: 'C2/c2.verdict_without_pass_count', excerpt: 'baseline=17' },
            {
              type: 'per-fire-sample',
              anchor: 'C2/c2.verdict_without_pass_count/span-xyz',
              excerpt: 'firedAt=2026-06-08T01:00:00.000Z',
              sample: {
                traceId: 'trace-1',
                spanId: 'span-xyz',
                messageIdHash: 'hash-msg',
                invocationIdHash: 'hash-inv',
                threadIdHash: 'hash-thread',
                agentId: 'codex',
                threadSystemKind: 'product',
                trigger: 'reject',
                firedAt: '2026-06-08T01:00:00.000Z',
              },
            },
          ],
        },
        sampleCoverage: { sampleCount: 1, metricCount: 1, complete: true },
        proposedAction: [{ action: 'harness-tune', target: 'C2/c2.verdict_without_pass_count', rationale: 'ratio exceeds threshold' }],
        status: 'open',
      },
    ],
  };
  const yaml = formatAttributionYaml(report, '2026-06-08', dummyFingerprint);

  // Convention: if a stray raw id (e.g. 'msg_abc123' style) ever leaked into evidence,
  // it would land in the YAML. Test fixture uses only hash-prefixed values, so the
  // YAML must NOT contain anything starting 'raw-' or 'msg_' or 'inv_' patterns.
  assert.ok(!/\braw-/.test(yaml), 'no "raw-" prefix anywhere in YAML');
  assert.ok(!/\bmsg_[a-f0-9]{8,}\b/i.test(yaml), 'no raw message-id-shaped tokens');
  assert.ok(!/\binv_[a-f0-9]{8,}\b/i.test(yaml), 'no raw invocation-id-shaped tokens');
  // Positive: the safe hash values ARE present
  assert.ok(yaml.includes('hash-msg'));
  assert.ok(yaml.includes('hash-inv'));
  assert.ok(yaml.includes('hash-thread'));
});

test('formatAttributionYaml: sample_coverage absent on findings without coverage (e.g. observability gaps)', () => {
  const report = {
    featureId: 'F167',
    evalSnapshotId: 'eval-F167-2026-06-08',
    generatedAt: '2026-06-08T00:00:00.000Z',
    findings: [
      {
        id: 'AR-2026-06-08-002',
        relatedFeature: 'F167',
        frictionSignal: { type: 'observability-gap', severity: 'medium', confidence: 0.9, detectedAt: '2026-06-08T00:00:00.000Z' },
        attribution: {
          primaryLayer: 'tool_gap',
          pipelineOrHuman: 'pipeline',
          evidence: [{ type: 'telemetry-gap', anchor: 'L1/streak_warn_count', excerpt: 'no_counter' }],
        },
        // No sampleCoverage — not a sampled metric
        proposedAction: [{ action: 'add-counter', target: 'L1/streak_warn_count', rationale: 'add counter' }],
        status: 'open',
      },
    ],
  };
  const yaml = formatAttributionYaml(report, '2026-06-08', dummyFingerprint);
  assert.ok(!yaml.includes('sample_coverage:'), 'no sample_coverage block on non-sampled findings');
  assert.ok(!yaml.includes('sample:'), 'no sample block on non-sampled findings');
});
