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
