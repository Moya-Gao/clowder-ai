/**
 * Community event ingest integration tests (F168 Phase A — Tasks 6+7)
 *
 * Tests:
 * Task 6 — webhook handler produces community event + projection when eventLog is injected
 * Task 7 — /dispatch handler produces case.triaged event when eventLog is injected
 *
 * These tests use in-memory stubs for the event log and projector
 * (the Redis-backed equivalents are tested in separate Redis tests).
 * The key assertion is "existing behavior unchanged + event side-effect fires".
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { before, describe, it } from 'node:test';

// ---------------------------------------------------------------------------
// Minimal in-memory stubs
// ---------------------------------------------------------------------------

function makeInMemoryEventLog() {
  const events = [];
  return {
    events,
    append: async (event) => {
      events.push(event);
      return { appended: true, sequence: events.length - 1 };
    },
    read: async (subjectKey) => events.filter((e) => e.subjectKey === subjectKey),
    listSubjects: async () => [...new Set(events.map((e) => e.subjectKey))],
  };
}

function makeInMemoryProjector() {
  const applied = [];
  return {
    applied,
    apply: async (event) => {
      applied.push(event);
    },
    rebuild: async () => {},
    rebuildAll: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Helpers — webhook
// ---------------------------------------------------------------------------

function signBody(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function makeWebhookPayload(eventType, action, repoFullName = 'owner/repo', number = 42) {
  const issueOrPr = {
    number,
    title: 'Test',
    html_url: 'https://...',
    author_association: 'CONTRIBUTOR',
    user: { login: 'octocat' },
  };
  return {
    action,
    repository: { full_name: repoFullName },
    sender: { id: 1, login: 'octocat' },
    [eventType === 'pull_request' ? 'pull_request' : 'issue']: issueOrPr,
  };
}

async function buildWebhookHandler(extraDeps = {}) {
  const mod = await import('../dist/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.js');
  const { GitHubRepoWebhookHandler } = mod;

  let deliveryCounter = 0;
  const fakeDedup = {
    claim: async () => true,
    confirm: async () => {},
    rollback: async () => {},
  };

  const handler = new GitHubRepoWebhookHandler(
    {
      webhookSecret: 'test-secret',
      repoAllowlist: ['owner/repo'],
      defaultUserId: 'user-1',
      inboxCatId: 'codex',
    },
    {
      dedup: fakeDedup,
      bindingStore: {
        getByExternal: async () => null,
        bind: async (_connectorId, _extId, threadId) => ({ threadId }),
      },
      threadStore: { create: async () => ({ id: 'thread-inbox' }) },
      deliverFn: async () => ({ messageId: `msg-${++deliveryCounter}` }),
      invokeTrigger: { trigger: () => {} },
      ...extraDeps,
    },
  );
  return handler;
}

// ---------------------------------------------------------------------------
// Task 6: Webhook handler emits community event
// ---------------------------------------------------------------------------

describe('Task 6 — webhook emits community event', () => {
  it('issues.opened webhook appends issue.opened event to eventLog', async () => {
    const eventLog = makeInMemoryEventLog();
    const projector = makeInMemoryProjector();
    const handler = await buildWebhookHandler({ eventLog, projector });

    const bodyObj = makeWebhookPayload('issues', 'opened');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': 'delivery-1',
      'x-hub-signature-256': signBody('test-secret', rawBody),
      'content-type': 'application/json',
    };

    const result = await handler.handleWebhook(bodyObj, headers, rawBody);
    assert.strictEqual(result.kind, 'processed', 'original notification path must still work');

    assert.strictEqual(eventLog.events.length, 1, 'one event should be appended');
    const ev = eventLog.events[0];
    assert.strictEqual(ev.kind, 'issue.opened');
    assert.strictEqual(ev.sourceEventId, 'delivery-1');
    assert.ok(ev.subjectKey.includes('owner/repo'));
    assert.ok(ev.subjectKey.includes('#42'));

    assert.strictEqual(projector.applied.length, 1, 'projector should be called');
  });

  it('pull_request.opened webhook appends pr.opened event', async () => {
    const eventLog = makeInMemoryEventLog();
    const projector = makeInMemoryProjector();
    const handler = await buildWebhookHandler({ eventLog, projector });

    const bodyObj = makeWebhookPayload('pull_request', 'opened');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-pr-1',
      'x-hub-signature-256': signBody('test-secret', rawBody),
    };

    await handler.handleWebhook(bodyObj, headers, rawBody);

    assert.strictEqual(eventLog.events.length, 1);
    assert.strictEqual(eventLog.events[0].kind, 'pr.opened');
  });

  it('webhook without eventLog injected still processes normally (backward compat)', async () => {
    const handler = await buildWebhookHandler(); // no eventLog
    const bodyObj = makeWebhookPayload('issues', 'opened');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': 'delivery-compat',
      'x-hub-signature-256': signBody('test-secret', rawBody),
    };
    const result = await handler.handleWebhook(bodyObj, headers, rawBody);
    assert.strictEqual(result.kind, 'processed');
  });

  it('issues.closed webhook appends issue.closed event to eventLog', async () => {
    const eventLog = makeInMemoryEventLog();
    const projector = makeInMemoryProjector();
    const handler = await buildWebhookHandler({ eventLog, projector });

    const bodyObj = makeWebhookPayload('issues', 'closed');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': 'delivery-closed-1',
      'x-hub-signature-256': signBody('test-secret', rawBody),
      'content-type': 'application/json',
    };

    const result = await handler.handleWebhook(bodyObj, headers, rawBody);
    assert.strictEqual(result.kind, 'processed', 'issues.closed must be processed (not skipped)');

    assert.strictEqual(eventLog.events.length, 1, 'one event should be appended');
    const ev = eventLog.events[0];
    assert.strictEqual(ev.kind, 'issue.closed', 'event kind must be issue.closed');
    assert.strictEqual(ev.sourceEventId, 'delivery-closed-1');
    assert.ok(ev.subjectKey.includes('owner/repo#42'));
  });

  it('issues.reopened webhook appends issue.reopened event to eventLog', async () => {
    const eventLog = makeInMemoryEventLog();
    const projector = makeInMemoryProjector();
    const handler = await buildWebhookHandler({ eventLog, projector });

    const bodyObj = makeWebhookPayload('issues', 'reopened');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': 'delivery-reopen-1',
      'x-hub-signature-256': signBody('test-secret', rawBody),
      'content-type': 'application/json',
    };

    const result = await handler.handleWebhook(bodyObj, headers, rawBody);
    assert.strictEqual(result.kind, 'processed', 'issues.reopened must be processed (not skipped)');

    assert.strictEqual(eventLog.events.length, 1, 'one event should be appended');
    const ev = eventLog.events[0];
    assert.strictEqual(ev.kind, 'issue.reopened', 'event kind must be issue.reopened');
    assert.strictEqual(ev.sourceEventId, 'delivery-reopen-1');
    assert.ok(ev.subjectKey.includes('owner/repo#42'));
  });

  it('eventLog append failure does not block webhook notification', async () => {
    const brokenEventLog = {
      append: async () => {
        throw new Error('Redis down');
      },
      read: async () => [],
      listSubjects: async () => [],
    };
    const handler = await buildWebhookHandler({ eventLog: brokenEventLog });

    const bodyObj = makeWebhookPayload('issues', 'opened');
    const rawBody = Buffer.from(JSON.stringify(bodyObj));
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': 'delivery-fail',
      'x-hub-signature-256': signBody('test-secret', rawBody),
    };

    // Must NOT throw — best-effort
    const result = await handler.handleWebhook(bodyObj, headers, rawBody);
    assert.strictEqual(result.kind, 'processed');
  });
});

// ---------------------------------------------------------------------------
// Task 7: dispatch handler emits case.triaged event
// ---------------------------------------------------------------------------

describe('Task 7 — dispatch handler emits case.triaged event', () => {
  let buildApp;

  before(async () => {
    const appMod = await import('../dist/routes/community-issues.js');
    const fastifyMod = await import('fastify');
    buildApp = (extraOpts = {}) => {
      const fastify = fastifyMod.default({ logger: false });
      fastify.register(appMod.communityIssueRoutes, {
        communityIssueStore: makeFakeIssueStore(),
        taskStore: { create: async () => ({ id: 'task-1' }), get: async () => null, listByThread: async () => [] },
        socketManager: { emit: () => {} },
        ...extraOpts,
      });
      return fastify;
    };
  });

  function makeFakeIssueStore() {
    const issues = new Map();
    issues.set('issue-1', {
      id: 'issue-1',
      repo: 'owner/repo',
      issueNumber: 42,
      issueType: 'bug',
      title: 'Test',
      state: 'unreplied',
      replyState: 'unreplied',
      assignedThreadId: null,
      assignedCatId: null,
      linkedPrNumbers: [],
      directionCard: null,
      ownerDecision: null,
      relatedFeature: null,
      guardianAssignment: null,
      lastActivity: { at: 1000, event: 'created' },
      createdAt: 1000,
      updatedAt: 1000,
    });
    return {
      get: async (id) => issues.get(id) ?? null,
      create: async (input) => ({ id: 'new-id', ...input }),
      update: async (id, patch) => {
        const existing = issues.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        issues.set(id, updated);
        return updated;
      },
      listAll: async () => [...issues.values()],
      listByRepo: async (repo) => [...issues.values()].filter((i) => i.repo === repo),
      getByRepoAndNumber: async (repo, n) =>
        [...issues.values()].find((i) => i.repo === repo && i.issueNumber === n) ?? null,
      delete: async (id) => {
        issues.delete(id);
      },
    };
  }

  it('dispatch emits case.triaged event when eventLog injected', async () => {
    const eventLog = makeInMemoryEventLog();
    const projector = makeInMemoryProjector();
    const app = buildApp({ eventLog, projector });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issues/issue-1/dispatch',
      body: JSON.stringify({ threadId: 'thread-new' }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(res.statusCode, 200, 'dispatch should succeed');

    // Community event emitted
    assert.ok(eventLog.events.length >= 1, 'at least one event should be in log');
    const triageEv = eventLog.events.find((e) => e.kind === 'case.triaged');
    assert.ok(triageEv, 'case.triaged event must be emitted');
    assert.ok(triageEv.subjectKey.includes('owner/repo#42'));

    await app.close();
  });

  it('dispatch without eventLog still works (backward compat)', async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issues/issue-1/dispatch',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    assert.strictEqual(res.statusCode, 200);
    await app.close();
  });
});
