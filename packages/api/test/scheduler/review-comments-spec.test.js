import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('ReviewCommentsTaskSpec', () => {
  it('has correct id and profile', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    assert.equal(spec.id, 'review-comments');
    assert.equal(spec.profile, 'poller');
    assert.equal(spec.trigger.ms, 60_000);
  });

  it('gate returns run:false when no tracked PRs', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('gate returns run:true with workItems for PRs with new comments', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const mockPrs = [
      { repoFullName: 'a/b', prNumber: 1, threadId: 't1', catId: 'c1', userId: 'u1' },
      { repoFullName: 'c/d', prNumber: 2, threadId: 't2', catId: 'c2', userId: 'u2' },
    ];
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      fetchComments: async (repo, pr) => {
        if (repo === 'a/b') return [{ id: 101, body: 'fix this', createdAt: '2026-03-25T00:00:00Z' }];
        return [];
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    // First call: all comments are "new" (no cursor yet)
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 1);
    assert.equal(result.workItems[0].subjectKey, 'pr-a/b#1');
    assert.deepEqual(result.workItems[0].signal.newComments.length, 1);
  });

  it('cursor advances only after commitCursor — gate alone does not advance', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const mockPrs = [{ repoFullName: 'a/b', prNumber: 1, threadId: 't1', catId: 'c1', userId: 'u1' }];
    const comments = [{ id: 101, body: 'fix this', createdAt: '2026-03-25T00:00:00Z' }];
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      fetchComments: async () => comments,
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });

    // First call: comment 101 is new
    const r1 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(r1.run, true);
    // Cursor NOT advanced yet — gate returns items but doesn't commit

    // Without calling commitCursor, second gate should still see comment 101 as new
    const r2 = await spec.admission.gate({ taskId: spec.id, lastRunAt: Date.now(), tickCount: 2 });
    assert.equal(r2.run, true, 'cursor should not have advanced without commitCursor');

    // Now commit cursor for the first batch (simulating successful execute)
    const signal = r1.workItems[0].signal;
    signal.commitCursor();

    // Third call: cursor committed, comment 101 should be filtered
    const r3 = await spec.admission.gate({ taskId: spec.id, lastRunAt: Date.now(), tickCount: 3 });
    assert.equal(r3.run, false, 'after commitCursor, old comments should be filtered');
  });

  it('execute delivers connector message with comment preview', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const delivered = [];
    const entry = { repoFullName: 'a/b', prNumber: 42, threadId: 't1', catId: 'opus', userId: 'u1' };
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => [entry] },
      fetchComments: async () => [
        { id: 101, body: 'Please fix the timeout handling', createdAt: '2026-03-25T00:00:00Z' },
        { id: 102, body: 'Also check the edge case', createdAt: '2026-03-25T00:01:00Z' },
      ],
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
    assert.ok(delivered[0].content.includes('2 new comment(s)'));
    assert.ok(delivered[0].content.includes('timeout handling'));
    assert.equal(delivered[0].threadId, 't1');
  });

  it('cursor NOT advanced when deliverMessage throws', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const entry = { repoFullName: 'a/b', prNumber: 42, threadId: 't1', catId: 'opus', userId: 'u1' };
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => [entry] },
      fetchComments: async () => [{ id: 101, body: 'fix this', createdAt: '2026-03-25T00:00:00Z' }],
      deliverMessage: async () => {
        throw new Error('delivery failed');
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const r1 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(r1.run, true);
    // Execute should throw — cursor should NOT advance
    await assert.rejects(() =>
      spec.run.execute(r1.workItems[0].signal, r1.workItems[0].subjectKey, { assignedCatId: null }),
    );
    // Gate again — comment should still be visible (cursor not advanced)
    const r2 = await spec.admission.gate({ taskId: spec.id, lastRunAt: Date.now(), tickCount: 2 });
    assert.equal(r2.run, true, 'cursor should not advance on delivery failure');
  });

  it('gate skips PRs where fetchComments throws (fail-open)', async () => {
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');
    const mockPrs = [
      { repoFullName: 'a/b', prNumber: 1, threadId: 't1', catId: 'c1', userId: 'u1' },
      { repoFullName: 'c/d', prNumber: 2, threadId: 't2', catId: 'c2', userId: 'u2' },
    ];
    const spec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      fetchComments: async (repo) => {
        if (repo === 'a/b') throw new Error('gh timeout');
        return [{ id: 201, body: 'looks good', createdAt: '2026-03-25T00:00:00Z' }];
      },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 1);
    assert.equal(result.workItems[0].subjectKey, 'pr-c/d#2');
  });
});
