// @ts-check
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const noopLog = { info: () => {}, error: () => {}, warn: () => {} };

function stubRouter(kind = 'notified') {
  const calls = [];
  return {
    router: {
      async route(signal, tracking) {
        calls.push({ signal, tracking });
        if (kind === 'notified') {
          return {
            kind: 'notified',
            threadId: tracking.threadId,
            catId: tracking.catId,
            messageId: 'msg-1',
            content: 'feedback msg',
          };
        }
        return { kind: 'skipped', reason: 'stub skip' };
      },
    },
    calls,
  };
}

const mockEntry = {
  repoFullName: 'owner/repo',
  prNumber: 42,
  catId: 'opus',
  threadId: 'th-1',
  userId: 'u-1',
  registeredAt: 1000,
};

describe('ReviewFeedbackTaskSpec', () => {
  it('has correct id and profile (KD-11)', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });
    assert.equal(spec.id, 'review-feedback');
    assert.equal(spec.profile, 'poller');
  });

  it('gate returns run:false when no tracked PRs', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('gate returns workItems for PRs with new comments', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [mockEntry] },
      fetchComments: async () => [
        { id: 1, author: 'alice', body: 'hi', createdAt: '2026-01-01', commentType: 'conversation' },
      ],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 1);
    assert.equal(result.workItems[0].signal.newComments.length, 1);
  });

  it('gate returns workItems for PRs with new review decisions', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [mockEntry] },
      fetchComments: async () => [],
      fetchReviews: async () => [{ id: 1, author: 'alice', state: 'APPROVED', body: '', submittedAt: '2026-01-01' }],
      reviewFeedbackRouter: router,
      log: noopLog,
    });
    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems[0].signal.newDecisions.length, 1);
  });

  it('cursor dedup: same comment ID not included twice (AC-A8)', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [mockEntry] },
      fetchComments: async () => [
        { id: 1, author: 'alice', body: 'hi', createdAt: '2026-01-01', commentType: 'conversation' },
      ],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });

    // First gate: has new comment
    const r1 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(r1.run, true);
    // Simulate execute → commitCursor
    r1.workItems[0].signal.commitCursor();

    // Second gate: same comment, should be filtered out
    const r2 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 2 });
    assert.equal(r2.run, false);
  });

  it('cursor only advances in execute, not gate (KD-10 / LL-039)', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [mockEntry] },
      fetchComments: async () => [
        { id: 1, author: 'alice', body: 'hi', createdAt: '2026-01-01', commentType: 'conversation' },
      ],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });

    // Gate runs but we DON'T call commitCursor (simulating execute failure)
    const r1 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(r1.run, true);
    // Don't commit cursor

    // Next gate should still see the same comment
    const r2 = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 2 });
    assert.equal(r2.run, true);
    assert.equal(r2.workItems[0].signal.newComments.length, 1);
  });

  it('execute delegates to router and triggers (AC-A5)', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router, calls } = stubRouter();
    const triggerCalls = [];
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      invokeTrigger: {
        trigger(...args) {
          triggerCalls.push(args);
        },
      },
      log: noopLog,
    });

    let cursorCommitted = false;
    const signal = {
      entry: mockEntry,
      newComments: [{ id: 1, author: 'alice', body: 'hi', createdAt: '2026-01-01', commentType: 'conversation' }],
      newDecisions: [],
      commitCursor: () => {
        cursorCommitted = true;
      },
    };
    await spec.run.execute(signal, 'pr-owner/repo#42');

    assert.equal(calls.length, 1);
    assert.equal(cursorCommitted, true);
    assert.equal(triggerCalls.length, 1);
    assert.equal(triggerCalls[0][6].priority, 'normal');
  });

  it('execute uses urgent priority for CHANGES_REQUESTED', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter();
    const triggerCalls = [];
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      invokeTrigger: {
        trigger(...args) {
          triggerCalls.push(args);
        },
      },
      log: noopLog,
    });

    const signal = {
      entry: mockEntry,
      newComments: [],
      newDecisions: [{ id: 1, author: 'bob', state: 'CHANGES_REQUESTED', body: 'fix it', submittedAt: '2026-01-01' }],
      commitCursor: () => {},
    };
    await spec.run.execute(signal, 'pr-owner/repo#42');

    assert.equal(triggerCalls[0][6].priority, 'urgent');
  });

  it('execute does not commit cursor when router skips', async () => {
    const { createReviewFeedbackTaskSpec } = await import('../../dist/infrastructure/email/ReviewFeedbackTaskSpec.js');
    const { router } = stubRouter('skipped');
    const spec = createReviewFeedbackTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      fetchReviews: async () => [],
      reviewFeedbackRouter: router,
      log: noopLog,
    });

    let cursorCommitted = false;
    const signal = {
      entry: mockEntry,
      newComments: [],
      newDecisions: [],
      commitCursor: () => {
        cursorCommitted = true;
      },
    };
    await spec.run.execute(signal, 'pr-owner/repo#42');

    assert.equal(cursorCommitted, false, 'cursor should not advance when delivery skipped');
  });
});
