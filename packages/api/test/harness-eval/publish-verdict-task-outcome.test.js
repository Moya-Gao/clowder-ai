import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { EventMemoryStore } from '../../dist/domains/memory/EventMemoryStore.js';
import { handlePublishVerdict } from '../../dist/infrastructure/harness-eval/publish-verdict/publish-verdict.js';
import { createTaskOutcomeGeneratorAdapter } from '../../dist/infrastructure/harness-eval/publish-verdict/task-outcome-generator-adapter.js';
import { TaskOutcomeEpisodeStore } from '../../dist/infrastructure/harness-eval/task-outcome/task-outcome-store.js';

const root = mkdtempSync(join(tmpdir(), 'publish-verdict-taskoutcome-'));
const harnessFeedbackRoot = join(root, 'docs/harness-feedback');
let baseMs = Date.now();

function seedRegistryAndDirs() {
  const domainsDir = join(harnessFeedbackRoot, 'eval-domains');
  mkdirSync(domainsDir, { recursive: true });
  writeFileSync(
    join(domainsDir, 'eval-task-outcome.yaml'),
    `domainId: eval:task-outcome
displayName: Task Outcome Eval
systemThreadId: thread_eval_task_outcome
evalCat:
  catId: opus-47
  handle: "@opus-47"
  model: claude-opus-4-7
frequency: daily
sourceAdapter: task-outcome-eval
threadPolicy:
  role: working-home
  stateSot: registry
  allowedContent: [longitudinal-analysis, verdict-discussion, handoff-drafts]
legacyScheduledTaskIds: []
handoffTargetResolver:
  featureId: F192
  ownerCatId: opus
  threadLookup: feature-thread
sla:
  acknowledgeHours: 48
  reevalWithinHours: 168
`,
  );
  mkdirSync(join(harnessFeedbackRoot, 'verdicts'), { recursive: true });
  mkdirSync(join(harnessFeedbackRoot, 'bundles'), { recursive: true });
}

async function seedWindow(taskOutcomeDbPath = join(root, 'task-outcome-episodes.sqlite')) {
  baseMs = Date.now();
  const store = new TaskOutcomeEpisodeStore(taskOutcomeDbPath);
  const ep = store.createEpisode({
    trigger: 'cat_initiated',
    threadId: 'thread-task',
    participants: ['gpt52'],
  });
  store.appendSignal(ep.episodeId, {
    category: 'a2',
    record: {
      type: 'proposal_reject',
      proposalId: 'prop-1',
      proposalType: 'thread',
      catId: 'gpt52',
      threadId: 'thread-task',
      timestamp: new Date(baseMs + 1_000).toISOString(),
    },
  });
  store.updateTerminalState(ep.episodeId, 'completed');

  const eventStore = new EventMemoryStore(join(root, 'event-memory.sqlite'));
  await eventStore.initialize();
  eventStore.markEvent(
    {
      type: 'magic_word',
      trigger: 'human_brake',
      cat: 'gpt52',
      threadId: 'thread-task',
      messageId: 'msg-1',
      timestamp: baseMs + 2_000,
      summary: '用户拉闸',
      cognitiveTransition: 'user_brake',
      relatedHarness: ['F227'],
      confidence: 'high',
    },
    'landy',
  );
  return { baseMs };
}

function buildPacket(overrides = {}) {
  return {
    id: 'vhp-task-outcome-e2e-test',
    domainId: 'eval:task-outcome',
    createdAt: '2026-06-09T03:30:00.000Z',
    phenomenon: 'task outcome e2e test',
    harnessUnderEval: { featureId: 'F192', componentId: 'Phase-G-v0', name: 'task-outcome eval pipeline' },
    evidencePacket: {
      snapshotRefs: ['placeholder:overridden'],
      attributionRefs: ['placeholder:overridden'],
      metricRefs: ['metric:task_outcome.episodes_total'],
      sampleTraceRefs: ['thread:thread-task'],
    },
    dailyTrend: { window: '24h', current: { a: 1 }, baseline: { a: 1 }, threshold: { a: 5 }, direction: 'flat' },
    rootCauseHypothesis: { summary: 'task outcome', confidence: 'medium', alternatives: ['alt'] },
    verdict: 'keep_observe',
    ownerAsk: { targetFeatureId: 'F192', targetOwnerCatId: 'opus', requestedAction: 'observe' },
    acceptanceReevalPlan: { nextEvalAt: '2026-06-10T03:00:00.000Z', closureCondition: 'stable' },
    counterarguments: ['none'],
    ...overrides,
  };
}

before(async () => {
  seedRegistryAndDirs();
  await seedWindow();
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('handlePublishVerdict end-to-end with task-outcome generator', () => {
  it('happy path: handler dispatches to task-outcome adapter and returns repo-relative verdict paths', async () => {
    const generator = createTaskOutcomeGeneratorAdapter();
    const mockGitPublisher = {
      async publishOnIsolatedWorktree(opts) {
        const iso = join(root, '..', 'task-outcome-e2e-iso');
        mkdirSync(join(iso, 'docs', 'harness-feedback', 'eval-domains'), { recursive: true });
        writeFileSync(
          join(iso, 'docs', 'harness-feedback', 'eval-domains', 'eval-task-outcome.yaml'),
          readFileSync(join(harnessFeedbackRoot, 'eval-domains', 'eval-task-outcome.yaml'), 'utf8'),
        );
        await opts.stage(iso);
        rmSync(iso, { recursive: true, force: true });
        return { commitSha: 'task-sha-1234', prUrl: 'https://github.com/zts212653/cat-cafe/pull/9001' };
      },
    };

    const result = await handlePublishVerdict(
      { harnessFeedbackRoot: harnessFeedbackRoot, gitPublisher: mockGitPublisher, generator },
      {
        packet: buildPacket(),
        domain: 'eval:task-outcome',
        catId: 'opus-47',
        ownerUserId: 'landy',
        sourceRefs: {
          kind: 'task-outcome-snapshot',
          windowStartMs: baseMs - 60_000,
          windowEndMs: baseMs + 60_000,
        },
      },
    );

    assert.ok(!('error' in result), `expected success, got: ${JSON.stringify(result)}`);
    assert.equal(result.commitSha, 'task-sha-1234');
    assert.equal(result.prUrl, 'https://github.com/zts212653/cat-cafe/pull/9001');
    assert.equal(result.verdictPath, 'docs/harness-feedback/verdicts/vhp-task-outcome-e2e-test.md');
    assert.equal(result.bundleDir, 'docs/harness-feedback/bundles/vhp-task-outcome-e2e-test');
  });

  it('uses runtime-configured taskOutcomeDbPath when sourceRefs omit databasePath', async () => {
    const customTaskOutcomeDbPath = join(tmpdir(), `publish-verdict-taskoutcome-custom-${Date.now()}.sqlite`);
    await seedWindow(customTaskOutcomeDbPath);
    const generator = createTaskOutcomeGeneratorAdapter();
    const mockGitPublisher = {
      async publishOnIsolatedWorktree(opts) {
        const iso = join(root, '..', 'task-outcome-configured-db-iso');
        mkdirSync(join(iso, 'docs', 'harness-feedback', 'eval-domains'), { recursive: true });
        writeFileSync(
          join(iso, 'docs', 'harness-feedback', 'eval-domains', 'eval-task-outcome.yaml'),
          readFileSync(join(harnessFeedbackRoot, 'eval-domains', 'eval-task-outcome.yaml'), 'utf8'),
        );
        await opts.stage(iso);
        rmSync(iso, { recursive: true, force: true });
        return { commitSha: 'task-sha-5678', prUrl: 'https://github.com/zts212653/cat-cafe/pull/9002' };
      },
    };

    const result = await handlePublishVerdict(
      {
        harnessFeedbackRoot: harnessFeedbackRoot,
        gitPublisher: mockGitPublisher,
        generator,
        taskOutcomeDbPath: customTaskOutcomeDbPath,
      },
      {
        packet: buildPacket({ id: 'vhp-task-outcome-e2e-configured-db' }),
        domain: 'eval:task-outcome',
        catId: 'opus-47',
        ownerUserId: 'landy',
        sourceRefs: {
          kind: 'task-outcome-snapshot',
          windowStartMs: baseMs - 60_000,
          windowEndMs: baseMs + 60_000,
        },
      },
    );

    assert.ok(!('error' in result), `expected success, got: ${JSON.stringify(result)}`);
    assert.equal(result.commitSha, 'task-sha-5678');
  });
});
