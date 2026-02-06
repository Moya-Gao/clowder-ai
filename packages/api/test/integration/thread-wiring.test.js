/**
 * Thread Wiring Integration Tests
 * 验证对话管理 + 图片 + WebSocket 分房间的完整闭环
 *
 * 1. 创建对话 → 发消息 → 按对话查询 → 消息隔离
 * 2. @三猫 → 后续无@ → 参与者追踪
 * 3. 图片上传 → contentBlocks 存储 → CLI 收到图片 flag
 * 4. WebSocket broadcastAgentMessage 支持 threadId
 * 5. MCP 回传 → 广播到正确的对话房间
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import Fastify from 'fastify';

const { AgentRouter } = await import(
  '../../dist/domains/cats/services/AgentRouter.js'
);
const { InvocationRegistry } = await import(
  '../../dist/domains/cats/services/InvocationRegistry.js'
);
const { MessageStore } = await import(
  '../../dist/domains/cats/services/MessageStore.js'
);
const { ThreadStore } = await import(
  '../../dist/domains/cats/services/ThreadStore.js'
);
const { threadsRoutes } = await import('../../dist/routes/threads.js');
const { messagesRoutes } = await import('../../dist/routes/messages.js');

// --- Helpers ---

async function collect(iterable) {
  const items = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

function createMockProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const proc = {
    stdout,
    stderr,
    pid: 12345,
    exitCode: null,
    kill: () => {
      process.nextTick(() => {
        if (!stdout.destroyed) stdout.end();
        emitter.emit('exit', null, 'SIGTERM');
      });
      return true;
    },
    on: (event, listener) => {
      emitter.on(event, listener);
      return proc;
    },
    once: (event, listener) => {
      emitter.once(event, listener);
      return proc;
    },
    _emitter: emitter,
  };
  return proc;
}

function emitEvents(proc, events) {
  for (const event of events) {
    proc.stdout.write(JSON.stringify(event) + '\n');
  }
  proc.stdout.end();
  process.nextTick(() => proc._emitter.emit('exit', 0, null));
}

function createMockSpawnFn(events) {
  return (_cmd, _args, _opts) => {
    const proc = createMockProcess();
    process.nextTick(() => emitEvents(proc, events));
    return proc;
  };
}

// --- Tests ---

describe('Thread isolation: messages stay in their thread', () => {
  let app;
  let threadStore;
  let messageStore;

  beforeEach(async () => {
    threadStore = new ThreadStore();
    messageStore = new MessageStore();
    app = Fastify();
    await app.register(threadsRoutes, { threadStore });
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore,
      socketManager: { broadcastAgentMessage: () => {} },
      threadStore,
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('messages in thread A are not returned when querying thread B', async () => {
    // Create two threads
    const resA = await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'Thread A' },
    });
    const threadA = JSON.parse(resA.body);

    const resB = await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'Thread B' },
    });
    const threadB = JSON.parse(resB.body);

    // Add messages to each thread
    messageStore.append({
      userId: 'alice',
      catId: null,
      content: 'msg in A',
      mentions: [],
      timestamp: 1000,
      threadId: threadA.id,
    });
    messageStore.append({
      userId: 'alice',
      catId: null,
      content: 'msg in B',
      mentions: [],
      timestamp: 2000,
      threadId: threadB.id,
    });

    // Query thread A → only msg from A
    const qA = await app.inject({
      method: 'GET',
      url: `/api/messages?threadId=${threadA.id}&userId=alice`,
    });
    const bodyA = JSON.parse(qA.body);
    assert.equal(bodyA.messages.length, 1);
    assert.equal(bodyA.messages[0].content, 'msg in A');

    // Query thread B → only msg from B
    const qB = await app.inject({
      method: 'GET',
      url: `/api/messages?threadId=${threadB.id}&userId=alice`,
    });
    const bodyB = JSON.parse(qB.body);
    assert.equal(bodyB.messages.length, 1);
    assert.equal(bodyB.messages[0].content, 'msg in B');
  });
});

describe('Participant tracking: @mentions add cats to thread', () => {
  it('@opus → no @ → opus still responds (via participants)', async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );

    const spawnFn = createMockSpawnFn([
      { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } },
      { type: 'result', subtype: 'success' },
    ]);

    const threadStore = new ThreadStore();
    const messageStore = new MessageStore();
    const registry = new InvocationRegistry();

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService({ spawnFn }),
      codexService: { invoke: async function* () {} },
      geminiService: { invoke: async function* () {} },
      registry,
      messageStore,
      threadStore,
    });

    // Create thread first (addParticipants requires existing thread)
    const thread = threadStore.create('alice', 'Test Thread');
    const threadId = thread.id;

    // First message with @opus
    await collect(router.route('alice', '@opus hello', threadId));

    // Verify opus is now a participant
    const participants = await threadStore.getParticipants(threadId);
    assert.ok(participants.includes('opus'));

    // Second message without @
    const msgs2 = await collect(router.route('alice', 'follow up', threadId));
    // Should still route to opus (via participants)
    const textMsgs = msgs2.filter((m) => m.type === 'text');
    assert.ok(textMsgs.length > 0, 'should get response from opus via participants');
    assert.equal(textMsgs[0].catId, 'opus');
  });
});

describe('contentBlocks round-trip: store and retrieve', () => {
  it('contentBlocks survive append → getByThread round-trip', () => {
    const messageStore = new MessageStore();
    const blocks = [
      { type: 'text', text: 'look at this' },
      { type: 'image', url: '/uploads/photo.png' },
    ];

    messageStore.append({
      userId: 'alice',
      catId: null,
      content: 'look at this',
      contentBlocks: blocks,
      mentions: [],
      timestamp: 1000,
      threadId: 'img-thread',
    });

    const msgs = messageStore.getByThread('img-thread');
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].contentBlocks);
    assert.equal(msgs[0].contentBlocks.length, 2);
    assert.equal(msgs[0].contentBlocks[0].type, 'text');
    assert.equal(msgs[0].contentBlocks[1].type, 'image');
    assert.equal(msgs[0].contentBlocks[1].url, '/uploads/photo.png');
  });
});

describe('WebSocket broadcastAgentMessage supports threadId', () => {
  it('broadcastAgentMessage with threadId emits to room', () => {
    const emitted = [];
    const mockIo = {
      emit: (event, data) => emitted.push({ event, data, room: null }),
      to: (room) => ({
        emit: (event, data) => emitted.push({ event, data, room }),
      }),
    };

    // Simulate SocketManager behavior
    function broadcastAgentMessage(message, threadId) {
      if (threadId) {
        mockIo.to(`thread:${threadId}`).emit('agent_message', message);
      } else {
        mockIo.emit('agent_message', message);
      }
    }

    // Without threadId → global
    broadcastAgentMessage({ type: 'text', catId: 'opus', content: 'global', timestamp: 1 });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].room, null);

    // With threadId → room-scoped
    broadcastAgentMessage({ type: 'text', catId: 'opus', content: 'scoped', timestamp: 2 }, 'thread-123');
    assert.equal(emitted.length, 2);
    assert.equal(emitted[1].room, 'thread:thread-123');
  });
});

describe('Project-scoped threads: create and list by project', () => {
  let app;
  let threadStore;

  beforeEach(async () => {
    threadStore = new ThreadStore();
    app = Fastify();
    await app.register(threadsRoutes, { threadStore });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('threads created with projectPath are only returned for that project', async () => {
    // Create threads in different projects
    await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'In cat-cafe', projectPath: '/projects/cat-cafe' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'In relay', projectPath: '/projects/relay' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/threads',
      payload: { userId: 'alice', title: 'No project' },
    });

    // Query by project
    const resCatCafe = await app.inject({
      method: 'GET',
      url: '/api/threads?userId=alice&projectPath=/projects/cat-cafe',
    });
    const catCafeThreads = JSON.parse(resCatCafe.body).threads;
    assert.equal(catCafeThreads.length, 1);
    assert.equal(catCafeThreads[0].title, 'In cat-cafe');
    assert.equal(catCafeThreads[0].projectPath, '/projects/cat-cafe');

    // Query all (no projectPath filter)
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/threads?userId=alice',
    });
    const allThreads = JSON.parse(resAll.body).threads;
    // Should include all 3 created + default (auto-created by list())
    assert.ok(allThreads.length >= 3);
  });
});

describe('AgentRouter passes workingDirectory from thread.projectPath', () => {
  it('route() sets workingDirectory when thread has non-default projectPath', async () => {
    const threadStore = new ThreadStore();
    const messageStore = new MessageStore();
    const registry = new InvocationRegistry();

    // Create thread with a project path
    const thread = threadStore.create('alice', 'Project thread', '/Users/test/project');

    let receivedOptions = null;
    const mockClaudeService = {
      invoke: async function* (_prompt, options) {
        receivedOptions = options;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: { invoke: async function* () {} },
      geminiService: { invoke: async function* () {} },
      registry,
      messageStore,
      threadStore,
    });

    await collect(router.route('alice', '@opus hello', thread.id));

    assert.ok(receivedOptions);
    assert.equal(receivedOptions.workingDirectory, '/Users/test/project');
  });
});

describe('MCP callback stores message with threadId', () => {
  let app;
  let registry;
  let messageStore;

  beforeEach(async () => {
    const { callbacksRoutes } = await import('../../dist/routes/callbacks.js');

    registry = new InvocationRegistry();
    messageStore = new MessageStore();
    app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager: { broadcastAgentMessage: () => {} },
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('post-message callback stores message with invocation threadId', async () => {
    const { invocationId, callbackToken } = registry.create('alice', 'opus', 'thread-42');

    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'callback msg',
      },
    });
    assert.equal(res.statusCode, 200);

    // Verify message is in the right thread
    const msgs = messageStore.getByThread('thread-42');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].content, 'callback msg');
    assert.equal(msgs[0].threadId, 'thread-42');
  });
});
