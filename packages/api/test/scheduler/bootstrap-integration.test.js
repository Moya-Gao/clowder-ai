import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';

describe('TaskRunnerV2 bootstrap integration', () => {
  let db;

  beforeEach(async () => {
    db = new Database(':memory:');
    const { applyMigrations } = await import('../../dist/domains/memory/schema.js');
    applyMigrations(db);
  });

  it('registers all four TaskSpecs and lists them', async () => {
    const { TaskRunnerV2 } = await import('../../dist/infrastructure/scheduler/TaskRunnerV2.js');
    const { RunLedger } = await import('../../dist/infrastructure/scheduler/RunLedger.js');
    const { createSummaryCompactionTaskSpec } = await import('../../dist/domains/memory/SummaryCompactionTaskSpec.js');
    const { createCiCdCheckTaskSpec } = await import('../../dist/infrastructure/email/CiCdCheckTaskSpec.js');
    const { createConflictCheckTaskSpec } = await import('../../dist/infrastructure/email/ConflictCheckTaskSpec.js');
    const { createReviewCommentsTaskSpec } = await import('../../dist/infrastructure/email/ReviewCommentsTaskSpec.js');

    const ledger = new RunLedger(db);
    const runner = new TaskRunnerV2({
      logger: { info: () => {}, error: () => {} },
      ledger,
    });

    // Minimal deps for each spec
    const summarySpec = createSummaryCompactionTaskSpec({
      db,
      enabled: () => true,
      getThreadLastActivity: async () => null,
      getMessagesAfterWatermark: async () => [],
      generateAbstractive: async () => null,
      logger: { info: () => {}, error: () => {} },
    });

    const cicdSpec = createCiCdCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      cicdRouter: { route: async () => ({ kind: 'noop' }) },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });

    const conflictSpec = createConflictCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      checkMergeable: async () => 'MERGEABLE',
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });

    const reviewSpec = createReviewCommentsTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      fetchComments: async () => [],
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });

    runner.register(summarySpec);
    runner.register(cicdSpec);
    runner.register(conflictSpec);
    runner.register(reviewSpec);

    const ids = runner.getRegisteredTasks();
    assert.deepEqual(ids.sort(), ['cicd-check', 'conflict-check', 'review-comments', 'summary-compact']);
  });

  it('rejects duplicate task id', async () => {
    const { TaskRunnerV2 } = await import('../../dist/infrastructure/scheduler/TaskRunnerV2.js');
    const { RunLedger } = await import('../../dist/infrastructure/scheduler/RunLedger.js');
    const { createCiCdCheckTaskSpec } = await import('../../dist/infrastructure/email/CiCdCheckTaskSpec.js');

    const ledger = new RunLedger(db);
    const runner = new TaskRunnerV2({
      logger: { info: () => {}, error: () => {} },
      ledger,
    });

    const spec = createCiCdCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      cicdRouter: { route: async () => ({ kind: 'noop' }) },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });

    runner.register(spec);
    assert.throws(() => runner.register(spec), /duplicate task id/);
  });
});
