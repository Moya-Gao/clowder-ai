/**
 * Callback Routes Tests
 * 测试 MCP 回传工具的 HTTP 端点
 *
 * Uses lightweight Fastify injection (no real HTTP server).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// Mock SocketManager
function createMockSocketManager() {
  const messages = [];
  return {
    broadcastAgentMessage(msg) {
      messages.push(msg);
    },
    getMessages() {
      return messages;
    },
  };
}

describe('Callback Routes', () => {
  let registry;
  let messageStore;
  let socketManager;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/InvocationRegistry.js'
    );
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    registry = new InvocationRegistry();
    messageStore = new MessageStore();
    socketManager = createMockSocketManager();
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    await app.register(callbacksRoutes, { registry, messageStore, socketManager });
    return app;
  }

  // ---- POST /api/callbacks/post-message ----

  test('POST post-message succeeds with valid credentials', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'Hello from cat!',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');

    // Should broadcast via Socket.io
    const broadcasted = socketManager.getMessages();
    assert.equal(broadcasted.length, 1);
    assert.equal(broadcasted[0].catId, 'opus');
    assert.equal(broadcasted[0].content, 'Hello from cat!');

    // Should store in MessageStore
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].content, 'Hello from cat!');
  });

  test('POST post-message returns 401 for invalid token', async () => {
    const app = await createApp();
    const { invocationId } = registry.create('user-1', 'opus');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken: 'wrong-token',
        content: 'Hello',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('POST post-message returns 401 for expired token', async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/InvocationRegistry.js'
    );

    // Use very short TTL
    registry = new InvocationRegistry({ ttlMs: 1 });
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'Hello',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('POST post-message returns 400 for invalid body', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: { content: '' },
    });

    assert.equal(response.statusCode, 400);
  });

  // ---- GET /api/callbacks/pending-mentions ----

  test('GET pending-mentions returns mentions for the cat', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    // Add some messages with mentions
    messageStore.append({
      userId: 'user-1',
      catId: null,
      content: '@opus help me',
      mentions: ['opus'],
      timestamp: Date.now(),
    });
    messageStore.append({
      userId: 'user-1',
      catId: null,
      content: '@codex review',
      mentions: ['codex'],
      timestamp: Date.now(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/pending-mentions?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.mentions.length, 1);
    assert.equal(body.mentions[0].message, '@opus help me');
  });

  test('GET pending-mentions returns empty array when no mentions', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/pending-mentions?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.mentions.length, 0);
  });

  // ---- GET /api/callbacks/thread-context ----

  test('GET thread-context returns recent messages', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    messageStore.append({
      userId: 'user-1',
      catId: null,
      content: 'Message 1',
      mentions: [],
      timestamp: 1,
    });
    messageStore.append({
      userId: 'user-1',
      catId: 'opus',
      content: 'Reply 1',
      mentions: [],
      timestamp: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[0].content, 'Message 1');
    assert.equal(body.messages[1].content, 'Reply 1');
  });

  test('GET thread-context respects limit parameter', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    for (let i = 0; i < 10; i++) {
      messageStore.append({
        userId: 'user-1',
        catId: null,
        content: `Message ${i}`,
        mentions: [],
        timestamp: i,
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&limit=3`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 3);
  });

  // ---- Cross-user isolation (P1 regression) ----

  test('GET thread-context only returns messages from the same user', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    // user-1's message
    messageStore.append({
      userId: 'user-1', catId: null, content: 'User 1 msg', mentions: [], timestamp: 1,
    });
    // user-2's message (should NOT be visible to user-1's invocation)
    messageStore.append({
      userId: 'user-2', catId: null, content: 'User 2 msg', mentions: [], timestamp: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].content, 'User 1 msg');
  });

  test('GET pending-mentions only returns mentions from the same user', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    // user-1 mentions opus
    messageStore.append({
      userId: 'user-1', catId: null, content: '@opus from user-1', mentions: ['opus'], timestamp: 1,
    });
    // user-2 also mentions opus (should NOT be visible)
    messageStore.append({
      userId: 'user-2', catId: null, content: '@opus from user-2', mentions: ['opus'], timestamp: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/pending-mentions?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.mentions.length, 1);
    assert.equal(body.mentions[0].message, '@opus from user-1');
  });

  test('GET pending-mentions returns 400 without credentials', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/callbacks/pending-mentions',
    });

    assert.equal(response.statusCode, 400);
  });
});
