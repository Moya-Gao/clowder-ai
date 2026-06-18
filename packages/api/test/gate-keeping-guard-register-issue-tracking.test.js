/**
 * F167 gate-keeping thread guard — register-issue-tracking endpoint (symmetric to PR).
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';

describe('F167 gate-keeping guard: POST /api/callbacks/register-issue-tracking', () => {
  let registry;
  let messageStore;
  let socketManager;
  let evidenceStore;
  let reflectionService;
  let markerQueue;
  let threadStore;
  let taskStore;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const { TaskStore } = await import('../dist/domains/cats/services/stores/ports/TaskStore.js');

    registry = new InvocationRegistry();
    messageStore = new MessageStore();
    threadStore = new ThreadStore();
    taskStore = new TaskStore();
    socketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom() {},
      getMessages() {
        return [];
      },
    };
    evidenceStore = {
      search: async () => [],
      health: async () => true,
      initialize: async () => {},
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
    };
    reflectionService = { reflect: async () => '' };
    markerQueue = {
      submit: async (marker) => ({ id: 'mk-1', createdAt: new Date().toISOString(), ...marker }),
      list: async () => [],
      transition: async () => {},
    };
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      threadStore,
      evidenceStore,
      reflectionService,
      markerQueue,
      taskStore,
      fetchIssueCommentCursor: async () => 0,
    });
    return app;
  }

  test('INV-G4: non-gate-keeping thread → 200', async () => {
    const app = await createApp();
    const thread = await threadStore.create('user-1', 'normal-thread');
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/register-issue-tracking',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { repoFullName: 'owner/repo', issueNumber: 100 },
    });

    assert.equal(response.statusCode, 200, 'normal thread issue tracking must succeed');
  });

  test('INV-G2: gate-keeping thread + no override → 400', async () => {
    const app = await createApp();
    const thread = await threadStore.create('user-1', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/register-issue-tracking',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { repoFullName: 'owner/repo', issueNumber: 200 },
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(body.tool, 'register_issue_tracking');

    const stored = taskStore.getBySubject('issue:owner/repo#200');
    assert.equal(stored, null, 'task must NOT be created when guard blocks');
  });

  test("INV-G3': override claim ignored, guard still hard-blocks (R1 review fix)", async () => {
    const app = await createApp();
    const thread = await threadStore.create('user-1', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/register-issue-tracking',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        repoFullName: 'owner/repo',
        issueNumber: 300,
        override: 'i-am-the-downstream-owner',
      },
    });

    assert.equal(response.statusCode, 400, 'override claim must NOT escape');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.match(body.remediation, /没有 override 通道/);
  });
});
