/**
 * F045: GET /api/threads/:threadId/task-progress route tests
 * P0/P1 review fix: auth + ownership check
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

const { setTaskProgress, clearTaskProgress } = await import(
  '../dist/domains/cats/services/agents/invocation/TaskProgressCache.js'
);

describe('GET /api/threads/:threadId/task-progress', () => {
  let app;
  let threadStore;
  let threadId;

  beforeEach(async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/stores/ports/ThreadStore.js'
    );
    const { threadsRoutes } = await import('../dist/routes/threads.js');

    threadStore = new ThreadStore();
    app = Fastify();
    await app.register(threadsRoutes, { threadStore });
    await app.ready();

    // Create a thread owned by alice (ID is auto-generated)
    const thread = threadStore.create('alice', 'Test Thread');
    threadId = thread.id;

    // Populate task progress cache
    setTaskProgress(threadId, 'opus', [
      { id: 't1', subject: 'Do thing', status: 'in_progress' },
    ]);
  });

  afterEach(async () => {
    clearTaskProgress(threadId, 'opus');
    if (app) await app.close();
  });

  it('returns 401 when no identity header provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${threadId}/task-progress`,
    });
    assert.equal(res.statusCode, 401);
  });

  it('returns 404 when thread does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/threads/nonexistent/task-progress',
      headers: { 'x-cat-cafe-user': 'alice' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('returns 403 when user is not thread owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${threadId}/task-progress`,
      headers: { 'x-cat-cafe-user': 'eve' },
    });
    assert.equal(res.statusCode, 403);
  });

  it('returns task progress for thread owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${threadId}/task-progress`,
      headers: { 'x-cat-cafe-user': 'alice' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.threadId, threadId);
    assert.ok(body.taskProgress.opus);
    assert.equal(body.taskProgress.opus.tasks[0].subject, 'Do thing');
  });

  it('returns empty taskProgress when no cache hit', async () => {
    clearTaskProgress(threadId, 'opus');
    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${threadId}/task-progress`,
      headers: { 'x-cat-cafe-user': 'alice' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.taskProgress, {});
  });

  it('allows system-owned threads for any authenticated user', async () => {
    const sysThread = threadStore.create('system', 'Default');
    setTaskProgress(sysThread.id, 'codex', [
      { id: 's1', subject: 'System task', status: 'pending' },
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${sysThread.id}/task-progress`,
      headers: { 'x-cat-cafe-user': 'anyone' },
    });
    assert.equal(res.statusCode, 200);
    clearTaskProgress(sysThread.id, 'codex');
  });
});
