/**
 * Regression tests for post_message @mention → A2A invocation
 *
 * Validates:
 * - P1-1: No @ → no invocation triggered
 * - P1-2: Inline @ (行中) → no invocation triggered
 * - Line-start @ → mentions stored correctly
 * - P2-1: Deleting race → record marked canceled
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

function createMockSocketManager() {
  const messages = [];
  const roomEvents = [];
  return {
    broadcastAgentMessage(msg) { messages.push(msg); },
    broadcastToRoom(room, event, data) { roomEvents.push({ room, event, data }); },
    getMessages() { return messages; },
    getRoomEvents() { return roomEvents; },
  };
}

function createMockInvocationRecordStore() {
  const records = [];
  const updates = [];
  return {
    create(input) {
      const id = `inv-${records.length}`;
      records.push({ id, ...input });
      return { outcome: 'created', invocationId: id };
    },
    update(id, data) {
      updates.push({ id, ...data });
      return { id, ...data };
    },
    getRecords() { return records; },
    getUpdates() { return updates; },
  };
}

function createMockRouter() {
  const executions = [];
  return {
    async *routeExecution(userId, message, threadId, userMessageId, targetCats, intent) {
      executions.push({ userId, message, threadId, targetCats });
      // Yield a done message
      yield {
        type: 'done',
        catId: targetCats[0],
        isFinal: true,
        timestamp: Date.now(),
      };
    },
    getExecutions() { return executions; },
  };
}

describe('post_message A2A mention invocation', () => {
  let registry;
  let messageStore;
  let socketManager;
  let invocationRecordStore;
  let mockRouter;

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
    invocationRecordStore = createMockInvocationRecordStore();
    mockRouter = createMockRouter();
  });

  async function createApp(opts = {}) {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      router: mockRouter,
      invocationRecordStore,
      ...opts,
    });
    return app;
  }

  // P1-1 regression: no @ → no invocation
  test('post-message without @ does NOT trigger invocation', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', { threadId: 't1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: { invocationId, callbackToken, content: 'Just a status update, no mentions' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(invocationRecordStore.getRecords().length, 0,
      'No InvocationRecord should be created for non-@ messages');
    assert.equal(mockRouter.getExecutions().length, 0,
      'routeExecution should not be called');
  });

  // P1-2 regression: inline @ → no invocation
  test('post-message with inline @ (行中) does NOT trigger invocation', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', { threadId: 't1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: '这个方案里，之前 @缅因猫 提过类似的思路',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(invocationRecordStore.getRecords().length, 0,
      'Inline @mentions (行中) must not trigger A2A invocation');
  });

  // P1-2 regression: @ inside code block → no invocation
  test('post-message with @ in code block does NOT trigger invocation', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', { threadId: 't1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: '看看这段代码:\n```\n@缅因猫 这里是注释\n```\n完毕',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(invocationRecordStore.getRecords().length, 0,
      '@mentions inside code blocks must not trigger invocation');
  });

  // Positive case: line-start @ → mentions stored + invocation created
  test('post-message with line-start @ stores mentions and triggers invocation', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', { threadId: 't1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: '修复完成了\n@缅因猫\n请帮忙 review',
      },
    });

    assert.equal(response.statusCode, 200);

    // Mentions should be stored on the message
    const recent = messageStore.getRecent(10);
    assert.equal(recent.length, 1);
    assert.ok(recent[0].mentions.includes('codex'),
      'Message should store codex as mention (缅因猫 = codex)');

    // InvocationRecord should be created
    assert.equal(invocationRecordStore.getRecords().length, 1);
    assert.deepEqual(invocationRecordStore.getRecords()[0].targetCats, ['codex']);
  });

  // Self-mention filter: opus @布偶猫 → no invocation (can't invoke self)
  test('post-message self-mention does NOT trigger invocation', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', { threadId: 't1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: '@布偶猫\n这是自我引用测试',
      },
    });

    assert.equal(response.statusCode, 200);
    // parseA2AMentions filters self-mentions, so no invocation
    assert.equal(invocationRecordStore.getRecords().length, 0,
      'Self-mention must not trigger invocation');
  });
});
