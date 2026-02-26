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
  let freshnessProvider;
  let reimportTriggerProvider;
  let threadStore;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { MessageStore } = await import(
      '../dist/domains/cats/services/stores/ports/MessageStore.js'
    );
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/stores/ports/ThreadStore.js'
    );

    registry = new InvocationRegistry();
    messageStore = new MessageStore();
    threadStore = new ThreadStore();
    socketManager = createMockSocketManager();
    hindsightClient = {
      recall: async () => [],
      reflect: async () => '',
      retain: async () => undefined,
    };
    freshnessProvider = undefined;
    reimportTriggerProvider = undefined;
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    const options = {
      registry,
      messageStore,
      socketManager,
      threadStore,
      sharedBank: 'cat-cafe-shared',
    };
    if (hindsightClient !== undefined) {
      options.hindsightClient = hindsightClient;
    }
    if (freshnessProvider) {
      options.freshnessProvider = freshnessProvider;
    }
    if (reimportTriggerProvider) {
      options.reimportTriggerProvider = reimportTriggerProvider;
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
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
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

  test('GET thread-context includes contentBlocks (image attachments)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    messageStore.append({
      userId: 'user-1',
      catId: null,
      content: 'Check this screenshot',
      contentBlocks: [
        { type: 'text', text: 'Check this screenshot' },
        { type: 'image', url: '/uploads/1234567890-abc.png' },
      ],
      mentions: [],
      timestamp: 1,
    });
    messageStore.append({
      userId: 'user-1',
      catId: 'opus',
      content: 'I see the image',
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
    // Message with image should include contentBlocks
    assert.ok(body.messages[0].contentBlocks, 'contentBlocks should be present');
    assert.equal(body.messages[0].contentBlocks.length, 2);
    assert.equal(body.messages[0].contentBlocks[1].type, 'image');
    assert.equal(body.messages[0].contentBlocks[1].url, '/uploads/1234567890-abc.png');
    // Message without contentBlocks should not have the field
    assert.equal(body.messages[1].contentBlocks, undefined);
  });

  // ---- F-Swarm-6: Cross-thread context read ----

  test('GET thread-context with threadId reads a different thread', async () => {
    const app = await createApp();
    // Invocation scoped to thread-A
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-A');

    // Messages in thread-A (own thread)
    messageStore.append({
      userId: 'user-1', catId: null, content: 'thread-A msg',
      mentions: [], timestamp: 1, threadId: 'thread-A',
    });
    // Messages in thread-B (cross-thread target)
    messageStore.append({
      userId: 'user-1', catId: null, content: 'thread-B msg 1',
      mentions: [], timestamp: 2, threadId: 'thread-B',
    });
    messageStore.append({
      userId: 'user-1', catId: 'codex', content: 'thread-B msg 2',
      mentions: [], timestamp: 3, threadId: 'thread-B',
    });

    // Query thread-B from an invocation in thread-A
    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&threadId=thread-B`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[0].content, 'thread-B msg 1');
    assert.equal(body.messages[1].content, 'thread-B msg 2');
  });

  test('GET thread-context without threadId reads own thread (default)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-A');

    messageStore.append({
      userId: 'user-1', catId: null, content: 'thread-A msg',
      mentions: [], timestamp: 1, threadId: 'thread-A',
    });
    messageStore.append({
      userId: 'user-1', catId: null, content: 'thread-B msg',
      mentions: [], timestamp: 2, threadId: 'thread-B',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].content, 'thread-A msg');
  });

  test('GET thread-context cross-thread respects limit', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-A');

    // 5 messages in thread-B
    for (let i = 0; i < 5; i++) {
      messageStore.append({
        userId: 'user-1', catId: null, content: `thread-B msg ${i}`,
        mentions: [], timestamp: i + 1, threadId: 'thread-B',
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&threadId=thread-B&limit=2`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 2);
    // Should return the 2 most recent
    assert.equal(body.messages[0].content, 'thread-B msg 3');
    assert.equal(body.messages[1].content, 'thread-B msg 4');
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

  test('GET pending-mentions only returns mentions from the same thread (#75)', async () => {
    const app = await createApp();
    // Create invocation scoped to thread-A
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-A');

    // @opus in thread-A (should be visible)
    messageStore.append({
      userId: 'user-1', catId: null, content: '@opus in thread-A',
      mentions: ['opus'], timestamp: 1, threadId: 'thread-A',
    });
    // @opus in thread-B (should NOT be visible — cross-thread leak)
    messageStore.append({
      userId: 'user-1', catId: null, content: '@opus in thread-B',
      mentions: ['opus'], timestamp: 2, threadId: 'thread-B',
    });
    // @opus in thread-A again
    messageStore.append({
      userId: 'user-1', catId: null, content: '@opus in thread-A again',
      mentions: ['opus'], timestamp: 3, threadId: 'thread-A',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/pending-mentions?invocationId=${invocationId}&callbackToken=${callbackToken}`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.mentions.length, 2);
    assert.equal(body.mentions[0].message, '@opus in thread-A');
    assert.equal(body.mentions[1].message, '@opus in thread-A again');
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
    assert.deepEqual(recallCalls[0].options.types, ['world', 'experience']);
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
      '../dist/domains/cats/services/orchestration/HindsightClient.js'
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

  test('GET search-evidence returns disabled degradation when HINDSIGHT_ENABLED=false', async () => {
    const previous = process.env['HINDSIGHT_ENABLED'];
    process.env['HINDSIGHT_ENABLED'] = 'false';

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    let recallCalls = 0;
    hindsightClient.recall = async () => {
      recallCalls += 1;
      return [{ content: 'unexpected recall' }];
    };

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    if (previous === undefined) delete process.env['HINDSIGHT_ENABLED'];
    else process.env['HINDSIGHT_ENABLED'] = previous;

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, true);
    assert.equal(body.degradeReason, 'hindsight_disabled');
    assert.deepEqual(body.results, []);
    assert.equal(recallCalls, 0);
  });

  test('GET search-evidence degrades on 429 rate limit', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    const { HindsightError } = await import(
      '../dist/domains/cats/services/orchestration/HindsightClient.js'
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

  test('GET search-evidence fail-closes on stale freshness before recall', async () => {
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    let recallCalls = 0;
    hindsightClient.recall = async () => {
      recallCalls += 1;
      return [{ content: 'stale recall', metadata: { anchor: 'docs/decisions/005-hindsight-integration-decisions.md' }, score: 0.99 }];
    };
    freshnessProvider = async () => ({
      status: 'stale',
      checkedAt: '2026-02-14T12:34:56.000Z',
      headCommit: 'head1234',
      watermarkCommit: 'old9999',
      reason: 'commit_mismatch',
    });
    reimportTriggerProvider = async () => ({
      status: 'triggered',
      reason: 'stale_detected',
    });

    const staleApp = await createApp();
    const response = await staleApp.inject({
      method: 'GET',
      url: `/api/callbacks/search-evidence?invocationId=${invocationId}&callbackToken=${callbackToken}&q=bank-policy`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, true);
    assert.equal(body.degradeReason, 'freshness_stale_fail_closed');
    assert.equal(body.freshness?.status, 'stale');
    assert.equal(body.reimportTrigger?.status, 'triggered');
    assert.deepEqual(body.results, []);
    assert.equal(recallCalls, 0);
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

  test('POST reflect returns disabled degradation when HINDSIGHT_ENABLED=false', async () => {
    const previous = process.env['HINDSIGHT_ENABLED'];
    process.env['HINDSIGHT_ENABLED'] = 'false';

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    let reflectCalls = 0;
    hindsightClient.reflect = async () => {
      reflectCalls += 1;
      return 'unexpected reflection';
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

    if (previous === undefined) delete process.env['HINDSIGHT_ENABLED'];
    else process.env['HINDSIGHT_ENABLED'] = previous;

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.degraded, true);
    assert.equal(body.degradeReason, 'hindsight_disabled');
    assert.equal(body.reflection, '');
    assert.equal(reflectCalls, 0);
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

  test('POST retain-memory skips write when HINDSIGHT_ENABLED=false', async () => {
    const previous = process.env['HINDSIGHT_ENABLED'];
    process.env['HINDSIGHT_ENABLED'] = 'false';

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'codex');
    let retainCalls = 0;
    hindsightClient.retain = async () => {
      retainCalls += 1;
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/retain-memory',
      payload: {
        invocationId,
        callbackToken,
        content: 'memory item',
      },
    });

    if (previous === undefined) delete process.env['HINDSIGHT_ENABLED'];
    else process.env['HINDSIGHT_ENABLED'] = previous;

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'skipped');
    assert.equal(body.degradeReason, 'hindsight_disabled');
    assert.equal(retainCalls, 0);
  });

  // --- Stale callback freshness guard (cloud Codex P1 + 缅因猫 R3) ---

  test('POST post-message returns stale_ignored for superseded invocation', async () => {
    const app = await createApp();

    // Old invocation for opus on thread-1
    const old = registry.create('user-1', 'opus', 'thread-1');
    // New invocation supersedes — same thread+cat
    registry.create('user-1', 'opus', 'thread-1');

    // Old invocation's callback should be rejected (stale)
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId: old.invocationId,
        callbackToken: old.callbackToken,
        content: 'Stale message from old invocation',
      },
    });

    assert.equal(response.statusCode, 200, 'should return 200 (not 401) to avoid retry storms');
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'stale_ignored');

    // Message should NOT be stored
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 0, 'stale callback should not store a message');
  });

  test('POST post-message allows latest invocation after stale is rejected', async () => {
    const app = await createApp();

    // Old invocation
    registry.create('user-1', 'opus', 'thread-1');
    // New invocation supersedes
    const latest = registry.create('user-1', 'opus', 'thread-1');

    // Latest invocation's callback should succeed
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId: latest.invocationId,
        callbackToken: latest.callbackToken,
        content: 'Fresh message from latest invocation',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');

    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].content, 'Fresh message from latest invocation');
  });

  // ---- #83: Rich block extraction in post-message ----

  test('POST post-message extracts cc_rich blocks and stores them in extra.rich', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-rb');

    const richPayload = JSON.stringify({
      v: 1,
      blocks: [
        { id: 'card-1', kind: 'card', v: 1, title: 'Test Card', tone: 'info' },
      ],
    });
    const content = `Here is a card:\n\`\`\`cc_rich\n${richPayload}\n\`\`\`\nDone!`;

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: { invocationId, callbackToken, content },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).status, 'ok');

    // Stored message should have clean text (cc_rich stripped) + rich blocks
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].content, 'Here is a card:\n\nDone!');
    assert.ok(recent[0].extra?.rich, 'extra.rich should be present');
    assert.equal(recent[0].extra.rich.v, 1);
    assert.equal(recent[0].extra.rich.blocks.length, 1);
    assert.equal(recent[0].extra.rich.blocks[0].kind, 'card');
    assert.equal(recent[0].extra.rich.blocks[0].title, 'Test Card');
  });

  test('POST post-message broadcasts rich_block SSE events for extracted blocks', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-rb2');

    const richPayload = JSON.stringify({
      v: 1,
      blocks: [
        { id: 'diff-1', kind: 'diff', v: 1, filePath: 'src/foo.ts', diff: '- old\n+ new' },
      ],
    });
    const content = `Check this:\n\`\`\`cc_rich\n${richPayload}\n\`\`\``;

    await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: { invocationId, callbackToken, content },
    });

    // Should have 2 broadcasts: 1 text + 1 rich_block system_info
    const msgs = socketManager.getMessages();
    const textMsg = msgs.find((m) => m.type === 'text');
    assert.ok(textMsg, 'text broadcast should exist');
    assert.equal(textMsg.content, 'Check this:');
    // P2: text broadcast must include messageId for rich_block correlation
    assert.ok(textMsg.messageId, 'text broadcast should include messageId');
    assert.equal(typeof textMsg.messageId, 'string');

    const richMsg = msgs.find((m) => m.type === 'system_info');
    assert.ok(richMsg, 'rich_block system_info broadcast should exist');
    const parsed = JSON.parse(richMsg.content);
    assert.equal(parsed.type, 'rich_block');
    assert.equal(parsed.block.kind, 'diff');
    assert.equal(parsed.block.filePath, 'src/foo.ts');
    // P2 cloud-review: rich_block SSE events must include messageId for frontend correlation
    assert.ok(parsed.messageId, 'rich_block event should include messageId');
    assert.equal(typeof parsed.messageId, 'string');
  });

  test('POST post-message without cc_rich blocks stores content as-is (no extra.rich)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-rb3');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: { invocationId, callbackToken, content: 'Plain message, no blocks' },
    });

    assert.equal(response.statusCode, 200);
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].content, 'Plain message, no blocks');
    assert.equal(recent[0].extra, undefined);
  });

  // ---- #85 T7: Route A create-rich-block normalizes type→kind ----

  test('POST create-rich-block normalizes type→kind and auto-fills v:1', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-norm');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-rich-block',
      payload: {
        invocationId,
        callbackToken,
        // Intentionally uses "type" instead of "kind", missing v
        block: { id: 'b1', type: 'card', title: 'Normalized', bodyMarkdown: '**bold**' },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');

    // Verify the broadcast block was normalized
    const msgs = socketManager.getMessages();
    assert.equal(msgs.length, 1);
    const parsed = JSON.parse(msgs[0].content);
    assert.equal(parsed.block.kind, 'card');
    assert.equal(parsed.block.type, undefined);
  });

  // ---- Play mode pagination backfill (砚砚 R5 regression) ----

  test('GET thread-context play mode returns full limit even when stream messages dominate', async () => {
    // Regression (砚砚 R5+R6): play mode filters other cats' origin:'stream'.
    // Real failure timing: visible messages are OLDER, hidden stream is NEWER.
    // Pagination must wade through all hidden stream to reach visible messages.
    const thread = threadStore.create('user-1', 'Play backfill test');
    const actualThreadId = thread.id;
    threadStore.updateThinkingMode(actualThreadId, 'play');

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', actualThreadId);

    // 10 visible messages first (OLDER timestamps: 1000-1018)
    for (let i = 0; i < 5; i++) {
      messageStore.append({
        userId: 'user-1',
        catId: null,
        content: `user msg ${i}`,
        mentions: [],
        timestamp: 1000 + i * 2,
        threadId: actualThreadId,
      });
      messageStore.append({
        userId: 'user-1',
        catId: 'codex',
        content: `codex callback ${i}`,
        mentions: [],
        origin: 'callback',
        timestamp: 1001 + i * 2,
        threadId: actualThreadId,
      });
    }

    // 500 hidden stream messages from codex (NEWER timestamps: 2000-2499)
    // These bury the visible messages — pagination must go through all 500.
    for (let i = 0; i < 500; i++) {
      messageStore.append({
        userId: 'user-1',
        catId: 'codex',
        content: `codex stream ${i}`,
        mentions: [],
        origin: 'stream',
        timestamp: 2000 + i,
        threadId: actualThreadId,
      });
    }

    // Request limit=10 — all 10 visible messages are buried under 500 hidden
    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&limit=10`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messages.length, 10, 'play mode must return full requestedLimit visible messages');

    // All returned messages should be visible (no codex stream)
    for (const msg of body.messages) {
      assert.ok(
        !msg.content.startsWith('codex stream'),
        `should not contain codex stream messages, got: ${msg.content}`
      );
    }

    // Verify ordering: oldest visible first
    assert.equal(body.messages[0].content, 'user msg 0');
    assert.equal(body.messages[9].content, 'codex callback 4');
  });

  // ---- Legacy thread backward compatibility (cloud P1 regression) ----

  test('GET thread-context play mode shows legacy untagged cat messages', async () => {
    // Regression: origin field was added later. Legacy threads have no origin
    // on cat messages. Play mode must NOT hide these — they are historical
    // callback speech, not stream thinking.
    const thread = threadStore.create('user-1', 'Legacy compat test');
    const tid = thread.id;
    threadStore.updateThinkingMode(tid, 'play');

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', tid);

    // 3 legacy messages from codex (no origin — pre-feature data)
    for (let i = 0; i < 3; i++) {
      messageStore.append({
        userId: 'user-1',
        catId: 'codex',
        content: `legacy codex msg ${i}`,
        mentions: [],
        timestamp: 1000 + i,
        threadId: tid,
      });
    }
    // 2 user messages
    for (let i = 0; i < 2; i++) {
      messageStore.append({
        userId: 'user-1',
        catId: null,
        content: `user msg ${i}`,
        mentions: [],
        timestamp: 2000 + i,
        threadId: tid,
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&limit=10`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    // All 5 messages should be visible (3 legacy codex + 2 user)
    assert.equal(body.messages.length, 5, 'legacy untagged cat messages must be visible in play mode');
    assert.equal(body.messages[0].content, 'legacy codex msg 0');
    assert.equal(body.messages[4].content, 'user msg 1');
  });

  test('GET thread-context play mode hides tagged stream but shows legacy in same thread', async () => {
    // Mixed thread: some legacy untagged + some new tagged stream.
    // Legacy visible, tagged stream hidden.
    const thread = threadStore.create('user-1', 'Mixed legacy test');
    const tid = thread.id;
    threadStore.updateThinkingMode(tid, 'play');

    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', tid);

    // 2 legacy untagged from codex (visible)
    messageStore.append({
      userId: 'user-1', catId: 'codex', content: 'legacy reply',
      mentions: [], timestamp: 1000, threadId: tid,
    });
    messageStore.append({
      userId: 'user-1', catId: 'codex', content: 'legacy reply 2',
      mentions: [], timestamp: 1001, threadId: tid,
    });
    // 1 tagged stream from codex (hidden)
    messageStore.append({
      userId: 'user-1', catId: 'codex', content: 'thinking output',
      mentions: [], origin: 'stream', timestamp: 2000, threadId: tid,
    });
    // 1 tagged callback from codex (visible)
    messageStore.append({
      userId: 'user-1', catId: 'codex', content: 'callback speech',
      mentions: [], origin: 'callback', timestamp: 3000, threadId: tid,
    });
    // 1 user message (visible)
    messageStore.append({
      userId: 'user-1', catId: null, content: 'user question',
      mentions: [], timestamp: 4000, threadId: tid,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/callbacks/thread-context?invocationId=${invocationId}&callbackToken=${callbackToken}&limit=10`,
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    // 4 visible: 2 legacy + 1 callback + 1 user. Stream hidden.
    assert.equal(body.messages.length, 4, 'tagged stream hidden, legacy + callback + user visible');
    const contents = body.messages.map(m => m.content);
    assert.ok(!contents.includes('thinking output'), 'stream must be hidden');
    assert.ok(contents.includes('legacy reply'), 'legacy must be visible');
    assert.ok(contents.includes('callback speech'), 'callback must be visible');
  });
});
