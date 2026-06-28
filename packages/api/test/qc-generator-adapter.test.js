/**
 * F253 Phase C — AC-C3: QC generator adapter tests.
 *
 * Validates that the QC metrics provider returns the right shape
 * and the generator adapter follows the VerdictGenerator contract.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('QcMetricsProvider', () => {
  test('snapshot has all 4 metric fields', async () => {
    const { resolveQcMetrics } = await import('../dist/infrastructure/harness-eval/qc-metrics-provider.js');
    const snapshot = resolveQcMetrics({
      kind: 'qc-metrics-rollup',
      windowStartMs: Date.now() - 7 * 24 * 3600 * 1000,
      windowEndMs: Date.now(),
    });
    assert.ok(typeof snapshot.findingYield === 'number', 'findingYield');
    assert.ok(typeof snapshot.falsePositiveRate === 'number', 'falsePositiveRate');
    assert.ok(typeof snapshot.reviewerDelta === 'number', 'reviewerDelta');
    assert.ok(typeof snapshot.postMergeBugRate === 'number', 'postMergeBugRate');
    assert.ok(typeof snapshot.prCount === 'number', 'prCount');
    assert.ok(typeof snapshot.windowDays === 'number', 'windowDays');
  });

  test('windowDays reflects selector range', async () => {
    const { resolveQcMetrics } = await import('../dist/infrastructure/harness-eval/qc-metrics-provider.js');
    const now = Date.now();
    const snapshot = resolveQcMetrics({
      kind: 'qc-metrics-rollup',
      windowStartMs: now - 14 * 24 * 3600 * 1000,
      windowEndMs: now,
    });
    // ~14 days (allow rounding)
    assert.ok(snapshot.windowDays >= 13 && snapshot.windowDays <= 15, `windowDays=${snapshot.windowDays}`);
  });
});

describe('createQcGeneratorAdapter', () => {
  test('rejects wrong sourceRefs kind', async () => {
    const { createQcGeneratorAdapter } = await import(
      '../dist/infrastructure/harness-eval/publish-verdict/qc-generator-adapter.js'
    );
    const adapter = createQcGeneratorAdapter();
    const fakePacket = { id: 'test', domainId: 'eval:qc' };
    const wrongRefs = { kind: 'a2a-snapshot-attribution' };
    const fakeDeps = { harnessFeedbackRoot: '/tmp', liveHarnessFeedbackRoot: '/tmp' };

    await assert.rejects(
      () => adapter(fakePacket, wrongRefs, fakeDeps),
      (err) => err.message.includes('qc_adapter_wrong_kind'),
    );
  });

  test('rejects invalid window (end before start)', async () => {
    const { createQcGeneratorAdapter } = await import(
      '../dist/infrastructure/harness-eval/publish-verdict/qc-generator-adapter.js'
    );
    const adapter = createQcGeneratorAdapter();
    const fakePacket = { id: 'test', domainId: 'eval:qc' };
    const badRefs = {
      kind: 'qc-metrics-rollup',
      windowStartMs: Date.now(),
      windowEndMs: Date.now() - 1000,
    };
    const fakeDeps = { harnessFeedbackRoot: '/tmp', liveHarnessFeedbackRoot: '/tmp' };

    await assert.rejects(
      () => adapter(fakePacket, badRefs, fakeDeps),
      (err) => err.message.includes('invalid_window'),
    );
  });
});
