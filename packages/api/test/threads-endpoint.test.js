/**
 * Thread API endpoint tests
 * POST /api/threads, GET /api/threads, GET /api/threads/:id,
 * PATCH /api/threads/:id, DELETE /api/threads/:id
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

describe('Thread API', () => {
  let app;
  let threadStore;

  beforeEach(async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );
    const { threadsRoutes } = await import('../dist/routes/threads.js');

    threadStore = new ThreadStore();
    app = Fastify();
    await app.register(threadsRoutes, { threadStore });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('POST /api/threads creates a thread', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'My Chat' },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.id);
    assert.equal(body.title, 'My Chat');
    assert.equal(body.createdBy, 'alice');
    assert.deepEqual(body.participants, []);
  });

  it('POST /api/threads returns 400 for missing userId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { title: 'No User' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('GET /api/threads lists user threads', async () => {
    threadStore.create('alice', 'Thread A');
    threadStore.create('alice', 'Thread B');
    threadStore.create('bob', 'Thread C');

    const res = await app.inject({
      method: 'GET',
      url: '/api/threads?userId=alice',
    });
    const body = JSON.parse(res.body);
    // alice has 2 custom + default thread
    const titles = body.threads.map((t) => t.title);
    assert.ok(titles.includes('Thread A'));
    assert.ok(titles.includes('Thread B'));
    assert.ok(!titles.includes('Thread C'));
  });

  it('GET /api/threads/:id returns thread details', async () => {
    const thread = threadStore.create('alice', 'Details Test');

    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${thread.id}`,
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.id, thread.id);
    assert.equal(body.title, 'Details Test');
  });

  it('GET /api/threads/:id returns 404 for nonexistent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/threads/nonexistent-id',
    });
    assert.equal(res.statusCode, 404);
  });

  it('PATCH /api/threads/:id updates title', async () => {
    const thread = threadStore.create('alice', 'Old Title');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/threads/${thread.id}`,
      payload: { title: 'New Title' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.title, 'New Title');
  });

  it('PATCH /api/threads/:id returns 404 for nonexistent', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/threads/nonexistent-id',
      payload: { title: 'New Title' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('DELETE /api/threads/:id removes thread', async () => {
    const thread = threadStore.create('alice', 'To Delete');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/threads/${thread.id}`,
    });
    assert.equal(res.statusCode, 204);

    // Verify deleted
    const check = threadStore.get(thread.id);
    assert.equal(check, null);
  });

  it('DELETE /api/threads/:id cannot delete default thread', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/threads/default',
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('GET /api/messages with threadId', () => {
  let app;
  let messageStore;

  beforeEach(async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/InvocationRegistry.js'
    );
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );
    const { messagesRoutes } = await import('../dist/routes/messages.js');

    messageStore = new MessageStore();
    app = Fastify();
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore,
      socketManager: { broadcastAgentMessage: () => {} },
      threadStore: new ThreadStore(),
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns only messages for the specified thread', async () => {
    messageStore.append({
      userId: 'default-user',
      catId: null,
      content: 'thread-a msg',
      mentions: [],
      timestamp: 1000,
      threadId: 'thread-a',
    });
    messageStore.append({
      userId: 'default-user',
      catId: null,
      content: 'thread-b msg',
      mentions: [],
      timestamp: 2000,
      threadId: 'thread-b',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/messages?threadId=thread-a',
    });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].content, 'thread-a msg');
  });

  it('thread-scoped pagination with before cursor', async () => {
    for (let i = 0; i < 5; i++) {
      messageStore.append({
        userId: 'default-user',
        catId: null,
        content: `t-msg ${i}`,
        mentions: [],
        timestamp: 1000 + i * 100,
        threadId: 'paginated-thread',
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/messages?threadId=paginated-thread&before=1300&limit=10',
    });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 3);
    assert.equal(body.messages[0].content, 't-msg 0');
    assert.equal(body.messages[2].content, 't-msg 2');
  });
});
