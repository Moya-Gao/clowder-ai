import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ConnectorRouter } from '../dist/infrastructure/connectors/ConnectorRouter.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';
import { InboundMessageDedup } from '../dist/infrastructure/connectors/InboundMessageDedup.js';

function noopLog() {
  const noop = () => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => noopLog(),
  };
}

function mockMessageStore() {
  const messages = [];
  return {
    messages,
    async append(input) {
      const msg = { id: `msg-${messages.length + 1}`, ...input };
      messages.push(msg);
      return msg;
    },
  };
}

function mockThreadStore() {
  let counter = 0;
  const threads = new Map();
  return {
    threads,
    create(userId, title) {
      counter++;
      const thread = {
        id: `thread-${counter}`,
        createdBy: userId,
        title,
        participants: [],
        lastActiveAt: Date.now(),
        createdAt: Date.now(),
        projectPath: 'default',
      };
      threads.set(thread.id, thread);
      return thread;
    },
  };
}

function mockTrigger() {
  const calls = [];
  return {
    calls,
    trigger(threadId, catId, userId, message, messageId, policy) {
      calls.push({ threadId, catId, userId, message, messageId, policy });
    },
  };
}

function mockSocketManager() {
  const broadcasts = [];
  return {
    broadcasts,
    broadcastToRoom(room, event, data) {
      broadcasts.push({ room, event, data });
    },
  };
}

describe('ConnectorRouter', () => {
  let bindingStore;
  let dedup;
  let messageStore;
  let threadStore;
  let trigger;
  let socketManager;
  let router;

  beforeEach(() => {
    bindingStore = new MemoryConnectorThreadBindingStore();
    dedup = new InboundMessageDedup();
    messageStore = mockMessageStore();
    threadStore = mockThreadStore();
    trigger = mockTrigger();
    socketManager = mockSocketManager();

    router = new ConnectorRouter({
      bindingStore,
      dedup,
      messageStore,
      threadStore,
      invokeTrigger: trigger,
      socketManager,
      defaultUserId: 'owner-1',
      defaultCatId: 'opus',
      log: noopLog(),
    });
  });

  it('routes new message and creates thread + binding', async () => {
    const result = await router.route('feishu', 'chat-123', 'Hello cat!', 'msg-001');
    assert.equal(result.kind, 'routed');
    assert.ok(result.threadId);
    assert.ok(result.messageId);

    // Binding should exist
    const binding = bindingStore.getByExternal('feishu', 'chat-123');
    assert.ok(binding);
    assert.equal(binding.threadId, result.threadId);
  });

  it('reuses existing thread for same external chat', async () => {
    const r1 = await router.route('feishu', 'chat-123', 'msg 1', 'ext-1');
    const r2 = await router.route('feishu', 'chat-123', 'msg 2', 'ext-2');
    assert.equal(r1.threadId, r2.threadId);
  });

  it('posts message to message store with ConnectorSource', async () => {
    await router.route('feishu', 'chat-123', 'Hello', 'ext-1');
    assert.equal(messageStore.messages.length, 1);
    assert.equal(messageStore.messages[0].source.connector, 'feishu');
    assert.equal(messageStore.messages[0].source.label, '飞书');
  });

  it('triggers cat invocation', async () => {
    await router.route('feishu', 'chat-123', 'Hello', 'ext-1');
    assert.equal(trigger.calls.length, 1);
    assert.equal(trigger.calls[0].catId, 'opus');
    assert.ok(trigger.calls[0].threadId);
  });

  it('skips duplicate messages', async () => {
    const r1 = await router.route('feishu', 'chat-123', 'Hello', 'ext-1');
    const r2 = await router.route('feishu', 'chat-123', 'Hello', 'ext-1');
    assert.equal(r1.kind, 'routed');
    assert.equal(r2.kind, 'skipped');
    assert.equal(messageStore.messages.length, 1);
  });

  it('broadcasts connector message to websocket', async () => {
    await router.route('feishu', 'chat-123', 'Hello', 'ext-1');
    assert.ok(socketManager.broadcasts.length > 0);
    assert.equal(socketManager.broadcasts[0].event, 'connector_message');
  });

  describe('command interception', () => {
    let commandRouter;
    let adapterSendCalls;
    let cmdTrigger;

    function mockCommandLayer(responses) {
      return {
        async handle(_connectorId, _externalChatId, _userId, text) {
          const trimmed = text.trim();
          const cmd = trimmed.split(/\s+/)[0].toLowerCase();
          return responses[cmd] ?? { kind: 'not-command' };
        },
      };
    }

    function mockAdapter() {
      adapterSendCalls = [];
      return {
        async sendReply(externalChatId, content) {
          adapterSendCalls.push({ externalChatId, content });
        },
      };
    }

    beforeEach(() => {
      cmdTrigger = mockTrigger();
      const adaptersMap = new Map();
      adaptersMap.set('feishu', mockAdapter());

      commandRouter = new ConnectorRouter({
        bindingStore,
        dedup,
        messageStore,
        threadStore,
        invokeTrigger: cmdTrigger,
        socketManager,
        defaultUserId: 'owner-1',
        defaultCatId: 'opus',
        log: noopLog(),
        commandLayer: mockCommandLayer({
          '/where': { kind: 'where', response: 'You are here' },
          '/new': { kind: 'new', response: 'Thread created', newActiveThreadId: 'thread-99' },
        }),
        adapters: adaptersMap,
      });
    });

    it('routes /where command without triggering invocation', async () => {
      const result = await commandRouter.route('feishu', 'chat-123', '/where', 'ext-cmd-1');
      assert.equal(result.kind, 'command');
      // Adapter should have received the response
      assert.equal(adapterSendCalls.length, 1);
      assert.equal(adapterSendCalls[0].externalChatId, 'chat-123');
      assert.equal(adapterSendCalls[0].content, 'You are here');
      // invokeTrigger should NOT have been called
      assert.equal(cmdTrigger.calls.length, 0);
      // Message should NOT be stored
      assert.equal(messageStore.messages.length, 0);
    });

    it('routes unknown /command as normal message', async () => {
      const result = await commandRouter.route('feishu', 'chat-123', '/unknown foo', 'ext-cmd-2');
      assert.equal(result.kind, 'routed');
      // invokeTrigger should have been called (normal routing)
      assert.equal(cmdTrigger.calls.length, 1);
      // No command response sent
      assert.equal(adapterSendCalls.length, 0);
    });

    it('handles /new command and sends response', async () => {
      const result = await commandRouter.route('feishu', 'chat-123', '/new My Topic', 'ext-cmd-3');
      assert.equal(result.kind, 'command');
      assert.equal(adapterSendCalls.length, 1);
      assert.ok(adapterSendCalls[0].content.includes('Thread created'));
      assert.equal(cmdTrigger.calls.length, 0);
    });

    it('still dedup-checks before command handling', async () => {
      await commandRouter.route('feishu', 'chat-123', '/where', 'ext-dup');
      const r2 = await commandRouter.route('feishu', 'chat-123', '/where', 'ext-dup');
      assert.equal(r2.kind, 'skipped');
      assert.equal(r2.reason, 'duplicate');
    });
  });
});
