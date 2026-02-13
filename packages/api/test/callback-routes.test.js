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
  let hindsightClient;

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
    hindsightClient = {
      recall: async () => [],
      reflect: async () => '',
      retain: async () => undefined,
    };
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    const options = {
      registry,
      messageStore,
      socketManager,
      sharedBank: 'cat-cafe-shared',
    };
    if (hindsightClient !== undefined) {
      options.hindsightClient = hindsightClient;
    }
    await app.register(callbacksRoutes, options);
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

  test('POST post-message deduplicates by clientMessageId (at-least-once safe)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    const first = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'idempotent message',
        clientMessageId: 'msg-001',
      },
    });
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).status, 'ok');

    const second = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'idempotent message',
        clientMessageId: 'msg-001',
      },
    });
    assert.equal(second.statusCode, 200);
    assert.equal(JSON.parse(second.body).status, 'duplicate');

    // Only one persisted/broadcast message should exist.
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].content, 'idempotent message');
    assert.equal(socketManager.getMessages().length, 1);
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

  // ---- Hindsight memory loop callbacks ----

  test('GET search-evidence defaults to project:cat-cafe + origin:git tags', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const recallCalls = [];
    hindsightClient.recall = async (bankId, query, options) => {
      recallCalls.push({ bankId, query, options });
      return [];
    };

    await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=test`,
    });

    assert.equal(recallCalls.length, 1);
    assert.deepEqual(recallCalls[0].options.tags, ['project:cat-cafe', 'origin:git']);
    assert.equal(recallCalls[0].options.tagsMatch, 'all_strict');
  });

  test('GET search-evidence ensures project:cat-cafe when user provides custom tags', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const recallCalls = [];
    hindsightClient.recall = async (bankId, query, options) => {
      recallCalls.push({ bankId, query, options });
      return [];
    };

    await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=test&tags=kind:decision`,
    });

    assert.equal(recallCalls.length, 1);
    assert.ok(recallCalls[0].options.tags.includes('project:cat-cafe'), 'project:cat-cafe must always be present');
    assert.ok(recallCalls[0].options.tags.includes('kind:decision'));
  });

  test('GET search-evidence returns recall results for invocation thread', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const recallCalls = [];
    hindsightClient.recall = async (bankId, query, options) => {
      recallCalls.push({ bankId, query, options });
      return [
        {
          content: 'ADR-005 decided single shared bank',
          metadata: { anchor: 'docs/decisions/005-hindsight-integration-decisions.md#L46' },
          score: 0.92,
        },
      ];
    };

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=single%20bank&limit=1&budget=high&tags=project:cat-cafe,kind:decision`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(Array.isArray(body.results), true);
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].anchor, 'docs/decisions/005-hindsight-integration-decisions.md#L46');
    assert.equal(recallCalls.length, 1);
    assert.equal(recallCalls[0].bankId, 'cat-cafe-shared');
    assert.equal(recallCalls[0].query, 'single bank');
    assert.equal(recallCalls[0].options.limit, 1);
    assert.equal(recallCalls[0].options.budget, 'high');
    assert.deepEqual(recallCalls[0].options.tags, ['project:cat-cafe', 'kind:decision']);
  });

  test('GET search-evidence uses runtime-configured recall defaults when params omitted', async () => {
    const prevBudget = process.env['HINDSIGHT_RECALL_DEFAULT_BUDGET'];
    const prevTagsMatch = process.env['HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH'];
    const prevLimit = process.env['HINDSIGHT_RECALL_DEFAULT_LIMIT'];
    process.env['HINDSIGHT_RECALL_DEFAULT_BUDGET'] = 'low';
    process.env['HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH'] = 'any';
    process.env['HINDSIGHT_RECALL_DEFAULT_LIMIT'] = '9';

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const recallCalls = [];
    hindsightClient.recall = async (bankId, query, options) => {
      recallCalls.push({ bankId, query, options });
      return [];
    };

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    if (prevBudget === undefined) delete process.env['HINDSIGHT_RECALL_DEFAULT_BUDGET'];
    else process.env['HINDSIGHT_RECALL_DEFAULT_BUDGET'] = prevBudget;
    if (prevTagsMatch === undefined) delete process.env['HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH'];
    else process.env['HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH'] = prevTagsMatch;
    if (prevLimit === undefined) delete process.env['HINDSIGHT_RECALL_DEFAULT_LIMIT'];
    else process.env['HINDSIGHT_RECALL_DEFAULT_LIMIT'] = prevLimit;

    assert.equal(response.statusCode, 200);
    assert.equal(recallCalls.length, 1);
    assert.equal(recallCalls[0].options.budget, 'low');
    assert.equal(recallCalls[0].options.tagsMatch, 'any');
    assert.equal(recallCalls[0].options.limit, 9);
  });

  test('GET search-evidence degrades on CONNECTION_FAILED', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const { HindsightError } = await import(
      '../dist/domains/cats/services/HindsightClient.js'
    );
    hindsightClient.recall = async () => {
      throw new HindsightError('CONNECTION_FAILED', 'cannot connect');
    };

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, true);
    assert.deepEqual(body.results, []);
  });

  test('GET search-evidence degrades on 429 rate limit', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const { HindsightError } = await import(
      '../dist/domains/cats/services/HindsightClient.js'
    );
    hindsightClient.recall = async () => {
      throw new HindsightError('API_ERROR', 'rate limited', 429);
    };

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, true);
    assert.deepEqual(body.results, []);
  });

  test('GET search-evidence returns 501 when hindsight client not configured', async () => {
    hindsightClient = undefined;
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    assert.equal(response.statusCode, 501);
  });

  test('POST reflect returns 501 when hindsight client not configured', async () => {
    hindsightClient = undefined;
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/reflect',
      payload: {
        invocationId,
        callbackToken,
        query: 'any reflection prompt',
      },
    });

    assert.equal(response.statusCode, 501);
  });

  test('POST reflect returns reflection text', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const reflectCalls = [];
    hindsightClient.reflect = async (bankId, query) => {
      reflectCalls.push({ bankId, query });
      return 'Phase 5 focused on evidence-first governance.';
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/reflect',
      payload: {
        invocationId,
        callbackToken,
        query: 'What changed in phase 5?',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.reflection, 'Phase 5 focused on evidence-first governance.');
    assert.equal(reflectCalls.length, 1);
    assert.equal(reflectCalls[0].bankId, 'cat-cafe-shared');
    assert.equal(reflectCalls[0].query, 'What changed in phase 5?');
  });

  test('POST reflect returns 502 on non-degradable errors', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    hindsightClient.reflect = async () => {
      throw new Error('invalid reflection template');
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/reflect',
      payload: {
        invocationId,
        callbackToken,
        query: 'What changed in phase 5?',
      },
    });

    assert.equal(response.statusCode, 502);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, false);
  });

  test('POST retain-memory writes invocation-scoped memory item', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const retainCalls = [];
    hindsightClient.retain = async (bankId, items, options) => {
      retainCalls.push({ bankId, items, options });
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/retain-memory',
      payload: {
        invocationId,
        callbackToken,
        content: 'When storage is unavailable, fail-closed and surface explicit errors.',
        tags: ['kind:decision', 'source:codex'],
        metadata: {
          anchor: 'docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md#L1',
          confidence: 'high',
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
    assert.equal(retainCalls.length, 1);
    assert.equal(retainCalls[0].bankId, 'cat-cafe-shared');
    assert.equal(retainCalls[0].items.length, 1);
    assert.equal(retainCalls[0].items[0].content, 'When storage is unavailable, fail-closed and surface explicit errors.');
    assert.deepEqual(retainCalls[0].items[0].tags, ['project:cat-cafe', 'kind:decision', 'source:codex']);
    assert.equal(retainCalls[0].items[0].metadata.source, 'callback');
    assert.equal(retainCalls[0].items[0].metadata.catId, 'codex');
    assert.equal(retainCalls[0].items[0].metadata.invocationId, invocationId);
  });

  test('POST retain-memory returns 401 for invalid callback token', async () => {
    const app = await createApp();
    const { invocationId } = registry.create('user-1', 'codex');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/retain-memory',
      payload: {
        invocationId,
        callbackToken: 'invalid-token',
        content: 'memory',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('POST retain-memory without tags defaults to origin:callback, not origin:git (P1 regression)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const retainCalls = [];
    hindsightClient.retain = async (bankId, items) => {
      retainCalls.push({ bankId, items });
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/retain-memory',
      payload: {
        invocationId,
        callbackToken,
        content: 'A callback memory without explicit tags',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(retainCalls.length, 1);
    const tags = retainCalls[0].items[0].tags;
    assert.ok(tags.includes('project:cat-cafe'), 'must include project:cat-cafe');
    assert.ok(tags.includes('origin:callback'), 'must include origin:callback for callback memories');
    assert.ok(!tags.includes('origin:git'), 'must NOT include origin:git for callback memories');
  });

  test('POST retain-memory returns 501 when hindsight client not configured', async () => {
    hindsightClient = undefined;
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/retain-memory',
      payload: {
        invocationId,
        callbackToken,
        content: 'memory item',
      },
    });

    assert.equal(response.statusCode, 501);
  });
});
