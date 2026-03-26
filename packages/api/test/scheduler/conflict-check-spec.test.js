import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('ConflictCheckTaskSpec', () => {
  it('has correct id and profile', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      checkMergeable: async () => 'MERGEABLE',
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    assert.equal(spec.id, 'conflict-check');
    assert.equal(spec.profile, 'poller');
    assert.equal(spec.trigger.ms, 5 * 60 * 1000);
  });

  it('gate returns run:false when no tracked PRs', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      checkMergeable: async () => 'MERGEABLE',
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('gate returns run:true with workItems for conflicting PRs only', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const mockPrs = [
      { repoFullName: 'a/b', prNumber: 1, ciTrackingEnabled: true, threadId: 't1', catId: 'c1', userId: 'u1' },
      { repoFullName: 'c/d', prNumber: 2, ciTrackingEnabled: true, threadId: 't2', catId: 'c2', userId: 'u2' },
      { repoFullName: 'e/f', prNumber: 3, ciTrackingEnabled: true, threadId: 't3', catId: 'c3', userId: 'u3' },
    ];
    const mergeStates = { 'a/b#1': 'CONFLICTING', 'c/d#2': 'MERGEABLE', 'e/f#3': 'CONFLICTING' };
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      checkMergeable: async (repo, pr) => mergeStates[`${repo}#${pr}`] ?? 'UNKNOWN',
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 2);
    assert.equal(result.workItems[0].subjectKey, 'pr-a/b#1');
    assert.equal(result.workItems[1].subjectKey, 'pr-e/f#3');
  });

  it('gate returns run:false when all PRs are mergeable', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const mockPrs = [
      { repoFullName: 'a/b', prNumber: 1, ciTrackingEnabled: true, threadId: 't1', catId: 'c1', userId: 'u1' },
    ];
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      checkMergeable: async () => 'MERGEABLE',
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('execute delivers connector message for conflicting PR', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const delivered = [];
    const entry = { repoFullName: 'a/b', prNumber: 42, threadId: 't1', catId: 'opus', userId: 'u1' };
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => [entry] },
      checkMergeable: async () => 'CONFLICTING',
      deliverMessage: async (input) => {
        delivered.push(input);
        return { messageId: 'msg-1', content: input.content };
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    await spec.run.execute(result.workItems[0].signal, result.workItems[0].subjectKey, { assignedCatId: null });
    assert.equal(delivered.length, 1);
    assert.ok(delivered[0].content.includes('merge conflict'));
    assert.equal(delivered[0].threadId, 't1');
    assert.equal(delivered[0].catId, 'opus');
  });

  it('execute uses actor-resolved catId when provided', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const delivered = [];
    const entry = { repoFullName: 'a/b', prNumber: 42, threadId: 't1', catId: 'opus', userId: 'u1' };
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => [entry] },
      checkMergeable: async () => 'CONFLICTING',
      deliverMessage: async (input) => {
        delivered.push(input);
        return { messageId: 'msg-1', content: input.content };
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    await spec.run.execute(result.workItems[0].signal, result.workItems[0].subjectKey, { assignedCatId: 'codex' });
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].catId, 'codex', 'should use actor-resolved catId over entry.catId');
  });

  it('gate skips PRs where checkMergeable throws (fail-open)', async () => {
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const mockPrs = [
      { repoFullName: 'a/b', prNumber: 1, ciTrackingEnabled: true, threadId: 't1', catId: 'c1', userId: 'u1' },
      { repoFullName: 'c/d', prNumber: 2, ciTrackingEnabled: true, threadId: 't2', catId: 'c2', userId: 'u2' },
    ];
    let callCount = 0;
    const spec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      checkMergeable: async (repo, pr) => {
        callCount++;
        if (repo === 'a/b') throw new Error('gh timeout');
        return 'CONFLICTING';
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(callCount, 2);
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 1);
    assert.equal(result.workItems[0].subjectKey, 'pr-c/d#2');
  });
});
