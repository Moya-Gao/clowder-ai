/**
 * GET /api/messages endpoint tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

describe('GET /api/messages', () => {
  let app;
  let messageStore;

  beforeEach(async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/InvocationRegistry.js'
    );
    const { messagesRoutes } = await import('../dist/routes/messages.js');

    messageStore = new MessageStore();
    app = Fastify();
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore,
      socketManager: { broadcastAgentMessage: () => {} },
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns empty array when no messages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/messages' });
    const body = JSON.parse(res.body);
    assert.deepEqual(body.messages, []);
    assert.equal(body.hasMore, false);
  });

  it('returns messages with correct format', async () => {
    messageStore.append({
      userId: 'default-user',
      catId: null,
      content: 'hello',
      mentions: ['opus'],
      timestamp: 1000,
    });
    messageStore.append({
      userId: 'default-user',
      catId: 'opus',
      content: 'hi there',
      mentions: [],
      timestamp: 2000,
    });

    const res = await app.inject({ method: 'GET', url: '/api/messages' });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 2);

    // User message
    assert.equal(body.messages[0].type, 'user');
    assert.equal(body.messages[0].catId, null);
    assert.equal(body.messages[0].content, 'hello');

    // Assistant message
    assert.equal(body.messages[1].type, 'assistant');
    assert.equal(body.messages[1].catId, 'opus');
    assert.equal(body.messages[1].content, 'hi there');
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      messageStore.append({
        userId: 'default-user',
        catId: null,
        content: `msg ${i}`,
        mentions: [],
        timestamp: 1000 + i,
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/messages?limit=3',
    });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 3);
    assert.equal(body.hasMore, true);
  });

  it('supports cursor pagination with before', async () => {
    for (let i = 0; i < 5; i++) {
      messageStore.append({
        userId: 'default-user',
        catId: null,
        content: `msg ${i}`,
        mentions: [],
        timestamp: 1000 + i * 100,
      });
    }

    // Get messages before timestamp 1300 (should get msg 0, 1, 2)
    const res = await app.inject({
      method: 'GET',
      url: '/api/messages?before=1300&limit=10',
    });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 3);
    assert.equal(body.messages[0].content, 'msg 0');
    assert.equal(body.messages[2].content, 'msg 2');
    assert.equal(body.hasMore, false);
  });

  it('pagination covers all messages without gaps (regression: slice direction)', async () => {
    // Insert 6 messages with distinct timestamps
    for (let i = 0; i < 6; i++) {
      messageStore.append({
        userId: 'default-user',
        catId: null,
        content: `msg ${i}`,
        mentions: [],
        timestamp: 1000 + i * 100,
      });
    }

    // Page 1: most recent 2
    const page1 = await app.inject({
      method: 'GET',
      url: '/api/messages?limit=2',
    });
    const body1 = JSON.parse(page1.body);
    assert.equal(body1.messages.length, 2);
    assert.equal(body1.hasMore, true);
    // Should be the 2 newest: msg 4 and msg 5
    assert.equal(body1.messages[0].content, 'msg 4');
    assert.equal(body1.messages[1].content, 'msg 5');

    // Page 2: before the oldest message of page 1
    const cursor = body1.messages[0].timestamp;
    const page2 = await app.inject({
      method: 'GET',
      url: `/api/messages?limit=2&before=${cursor}`,
    });
    const body2 = JSON.parse(page2.body);
    assert.equal(body2.messages.length, 2);
    assert.equal(body2.hasMore, true);
    assert.equal(body2.messages[0].content, 'msg 2');
    assert.equal(body2.messages[1].content, 'msg 3');

    // Page 3: before page 2's oldest
    const cursor2 = body2.messages[0].timestamp;
    const page3 = await app.inject({
      method: 'GET',
      url: `/api/messages?limit=2&before=${cursor2}`,
    });
    const body3 = JSON.parse(page3.body);
    assert.equal(body3.messages.length, 2);
    assert.equal(body3.hasMore, false);
    assert.equal(body3.messages[0].content, 'msg 0');
    assert.equal(body3.messages[1].content, 'msg 1');

    // Verify: union of all pages = all 6 messages, no gaps
    const allContents = [
      ...body3.messages,
      ...body2.messages,
      ...body1.messages,
    ].map((m) => m.content);
    assert.deepEqual(allContents, ['msg 0', 'msg 1', 'msg 2', 'msg 3', 'msg 4', 'msg 5']);
  });

  it('composite cursor handles same-timestamp messages without gaps', async () => {
    // All messages at the same timestamp (simulates burst writes)
    for (let i = 0; i < 4; i++) {
      messageStore.append({
        userId: 'default-user',
        catId: null,
        content: `burst ${i}`,
        mentions: [],
        timestamp: 5000, // all same timestamp
      });
    }

    // First page: most recent 2
    const page1 = await app.inject({
      method: 'GET',
      url: '/api/messages?limit=2',
    });
    const body1 = JSON.parse(page1.body);
    assert.equal(body1.messages.length, 2);
    assert.equal(body1.hasMore, true);

    // Composite cursor: "timestamp:id" of the oldest message on page 1
    const oldest = body1.messages[0];
    const cursor = `${oldest.timestamp}:${oldest.id}`;
    const page2 = await app.inject({
      method: 'GET',
      url: `/api/messages?limit=2&before=${encodeURIComponent(cursor)}`,
    });
    const body2 = JSON.parse(page2.body);
    assert.equal(body2.messages.length, 2);
    assert.equal(body2.hasMore, false);

    // Union should have all 4, no duplicates
    const allIds = [...body2.messages, ...body1.messages].map((m) => m.id);
    assert.equal(new Set(allIds).size, 4, 'All 4 messages should be unique across pages');
  });

  it('filters by userId', async () => {
    messageStore.append({
      userId: 'alice',
      catId: null,
      content: 'alice msg',
      mentions: [],
      timestamp: 1000,
    });
    messageStore.append({
      userId: 'bob',
      catId: null,
      content: 'bob msg',
      mentions: [],
      timestamp: 2000,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/messages?userId=alice',
    });
    const body = JSON.parse(res.body);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].content, 'alice msg');
  });
});

describe('POST /api/messages orphan rejection (#21)', () => {
  it('returns 400 when threadId does not exist', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/MessageStore.js');
    const { InvocationRegistry } = await import('../dist/domains/cats/services/InvocationRegistry.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/ThreadStore.js');
    const { messagesRoutes } = await import('../dist/routes/messages.js');

    const app = Fastify();
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore: new MessageStore(),
      socketManager: { broadcastAgentMessage: () => {}, broadcastToRoom: () => {} },
      threadStore: new ThreadStore(),
    });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      payload: {
        content: 'hello',
        userId: 'alice',
        threadId: 'nonexistent-thread',
      },
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'THREAD_NOT_FOUND');

    await app.close();
  });
});

describe('POST /api/messages delete-guard protection', () => {
  it('returns 409 and does not persist message when thread is being deleted', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/MessageStore.js');
    const { InvocationRegistry } = await import('../dist/domains/cats/services/InvocationRegistry.js');
    const { InvocationTracker } = await import('../dist/domains/cats/services/InvocationTracker.js');
    const { messagesRoutes } = await import('../dist/routes/messages.js');

    const threadId = 'thread-delete-guard';
    const tracker = new InvocationTracker();
    const guard = tracker.guardDelete(threadId);
    assert.ok(guard.acquired, 'test setup: delete guard should be acquired');

    const messageStore = new MessageStore();
    const threadStore = {
      async get(id) {
        if (id !== threadId) return null;
        return {
          id: threadId,
          projectPath: 'default',
          title: 'Guarded Thread',
          createdBy: 'alice',
          participants: [],
          lastActiveAt: Date.now(),
          createdAt: Date.now(),
        };
      },
      async updateTitle() {},
      async updateLastActive() {},
      async getParticipants() { return []; },
      async addParticipants() {},
    };

    const app = Fastify();
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore,
      socketManager: { broadcastAgentMessage: () => {}, broadcastToRoom: () => {} },
      threadStore,
      invocationTracker: tracker,
    });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      payload: {
        content: 'should be blocked',
        userId: 'alice',
        threadId,
      },
    });

    // Wait briefly to ensure background path would have had time to append.
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'THREAD_DELETING');
    assert.equal(messageStore.getByThread(threadId).length, 0);

    guard.release();
    await app.close();
  });
});
