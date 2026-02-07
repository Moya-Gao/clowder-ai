/**
 * AgentRouter Tests
 * 测试 @ 提及路由功能
 *
 * Uses mock agent services for testability.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';


// Create mock dependencies for AgentRouter
function createMockRegistry() {
  let counter = 0;
  return {
    create: () => ({
      invocationId: `inv-${++counter}`,
      callbackToken: `tok-${counter}`,
    }),
    verify: () => null,
  };
}

function createMockMessageStore() {
  return {
    append: () => ({ id: 'msg-1', userId: '', catId: null, content: '', mentions: [], timestamp: 0 }),
    getRecent: () => [],
    getMentionsFor: () => [],
    getBefore: () => [],
    getByThread: () => [],
    getByThreadBefore: () => [],
  };
}

function createMockThreadStore(initialParticipants = {}, threadProjectPaths = {}) {
  const participants = { ...initialParticipants };
  return {
    create: (userId, title, projectPath) => ({ id: `thread_mock`, projectPath: projectPath ?? 'default', title: title ?? null, createdBy: userId, participants: [], lastActiveAt: Date.now(), createdAt: Date.now() }),
    get: (threadId) => ({ id: threadId, projectPath: threadProjectPaths[threadId] ?? 'default', title: null, createdBy: 'system', participants: participants[threadId] ?? [], lastActiveAt: Date.now(), createdAt: Date.now() }),
    list: () => [],
    listByProject: () => [],
    addParticipants: (threadId, catIds) => {
      if (!participants[threadId]) participants[threadId] = [];
      for (const catId of catIds) {
        if (!participants[threadId].includes(catId)) {
          participants[threadId].push(catId);
        }
      }
    },
    getParticipants: (threadId) => participants[threadId] ?? [],
    updateLastActive: () => {},
    delete: () => true,
    _participants: participants, // exposed for test assertions
  };
}

// Create mock agent services
function createMockAgentService(catId, responseText = 'Hello from mock') {
  const invoke = mock.fn(async function* (_prompt, options) {
    const sessionId = options?.sessionId ?? `${catId}-session-new`;
    yield {
      type: 'session_init',
      catId,
      sessionId,
      timestamp: Date.now(),
    };
    yield {
      type: 'text',
      catId,
      content: responseText,
      timestamp: Date.now(),
    };
    yield {
      type: 'done',
      catId,
      timestamp: Date.now(),
    };
  });

  return { invoke };
}

describe('AgentRouter', () => {
  test('routes to opus (default) when no @ mention is present', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus', 'Opus response');
    const mockCodexService = createMockAgentService('codex', 'Codex response');
    const mockGeminiService = createMockAgentService('gemini', 'Gemini response');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', 'Hello, how are you?')) {
      messages.push(msg);
    }

    // Should route to opus
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);

    // Should have session_init, text, and done from opus
    assert.ok(messages.length >= 3);
    assert.ok(messages.every((m) => m.catId === 'opus'));
  });

  test('routes to opus when @opus is mentioned', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@opus help me')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);
  });

  test('routes to opus when Chinese mention @布偶猫 is used', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@布偶猫 请帮我')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);
  });

  test('routes to codex when @codex is mentioned', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@codex review this')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 0);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);
    assert.ok(messages.every((m) => m.catId === 'codex'));
  });

  test('routes to codex when Chinese mention @缅因猫 is used', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@缅因猫 检查代码')) {
      messages.push(msg);
    }

    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    assert.ok(messages.every((m) => m.catId === 'codex'));
  });

  test('routes to gemini when @gemini is mentioned', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@gemini design this')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 0);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 1);
    assert.ok(messages.every((m) => m.catId === 'gemini'));
  });

  test('routes to gemini when Chinese mention @暹罗猫 is used', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@暹罗猫 设计表情')) {
      messages.push(msg);
    }

    assert.equal(mockGeminiService.invoke.mock.callCount(), 1);
    assert.ok(messages.every((m) => m.catId === 'gemini'));
  });

  test('executes multiple cats in order when multiple @ mentions are present (#execute)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus', 'Opus says');
    const mockCodexService = createMockAgentService('codex', 'Codex says');
    const mockGeminiService = createMockAgentService('gemini', 'Gemini says');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route(
      'user-1',
      '#execute @opus write code, then @codex review it'
    )) {
      messages.push(msg);
    }

    // Both should be called
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);

    // Messages should be in order: opus first, then codex
    const textMessages = messages.filter((m) => m.type === 'text');
    assert.equal(textMessages.length, 2);
    assert.equal(textMessages[0].catId, 'opus');
    assert.equal(textMessages[1].catId, 'codex');
  });

  test('multi-cat serial chain includes previous responses in prompt (#execute)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let codexReceivedPrompt = '';
    const mockClaudeService = createMockAgentService('opus', 'Opus response');
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexReceivedPrompt = prompt;
        yield { type: 'session_init', catId: 'codex', sessionId: 'codex-123', timestamp: Date.now() };
        yield { type: 'text', catId: 'codex', content: 'Codex reviewed', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route(
      'user-1',
      '#execute @opus write code, then @codex review it'
    )) {
      messages.push(msg);
    }

    // Codex should receive the original message plus opus's response
    assert.ok(
      codexReceivedPrompt.includes('Opus response'),
      'Codex prompt should include Opus response'
    );
  });

  test('stores and uses session IDs per user per cat', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let capturedOptions = null;
    const mockClaudeService = {
      invoke: mock.fn(async function* (_prompt, options) {
        capturedOptions = options;
        yield { type: 'session_init', catId: 'opus', sessionId: 'opus-session-1', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'Hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    // First call - no session yet
    for await (const _ of router.route('user-1', 'Hello')) {
      // consume messages
    }
    assert.equal(capturedOptions?.sessionId, undefined);

    // Second call - should use stored session
    for await (const _ of router.route('user-1', 'Hello again')) {
      // consume messages
    }
    assert.equal(capturedOptions?.sessionId, 'opus-session-1');
  });

  test('maintains separate sessions for different users', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const capturedSessions = [];
    const mockClaudeService = {
      invoke: mock.fn(async function* (_prompt, options) {
        capturedSessions.push(options?.sessionId);
        const sessionId = options?.sessionId ?? `opus-session-${capturedSessions.length}`;
        yield { type: 'session_init', catId: 'opus', sessionId, timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'Hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    // User 1 first call
    for await (const _ of router.route('user-1', 'Hello')) {}
    // User 2 first call
    for await (const _ of router.route('user-2', 'Hello')) {}
    // User 1 second call
    for await (const _ of router.route('user-1', 'Hello')) {}
    // User 2 second call
    for await (const _ of router.route('user-2', 'Hello')) {}

    // First calls for both users should have no session
    assert.equal(capturedSessions[0], undefined);
    assert.equal(capturedSessions[1], undefined);
    // Second calls should have their respective sessions
    assert.equal(capturedSessions[2], 'opus-session-1');
    assert.equal(capturedSessions[3], 'opus-session-2');
  });

  test('handles all English mention patterns correctly', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const testCases = [
      { mention: '@ragdoll', expectedCat: 'opus' },
      { mention: '@maine', expectedCat: 'codex' },
      { mention: '@siamese', expectedCat: 'gemini' },
    ];

    for (const { mention, expectedCat } of testCases) {
      const mockClaudeService = createMockAgentService('opus');
      const mockCodexService = createMockAgentService('codex');
      const mockGeminiService = createMockAgentService('gemini');

      const router = new AgentRouter({
        claudeService: mockClaudeService,
        codexService: mockCodexService,
        geminiService: mockGeminiService,
        registry: createMockRegistry(),
        messageStore: createMockMessageStore(),
      });

      for await (const _ of router.route('user-1', `${mention} do something`)) {
        // consume
      }

      const services = {
        opus: mockClaudeService,
        codex: mockCodexService,
        gemini: mockGeminiService,
      };

      assert.equal(
        services[expectedCat].invoke.mock.callCount(),
        1,
        `${mention} should route to ${expectedCat}`
      );
    }
  });

  test('handles all Chinese mention patterns correctly', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const testCases = [
      { mention: '@布偶', expectedCat: 'opus' },
      { mention: '@缅因', expectedCat: 'codex' },
      { mention: '@暹罗', expectedCat: 'gemini' },
    ];

    for (const { mention, expectedCat } of testCases) {
      const mockClaudeService = createMockAgentService('opus');
      const mockCodexService = createMockAgentService('codex');
      const mockGeminiService = createMockAgentService('gemini');

      const router = new AgentRouter({
        claudeService: mockClaudeService,
        codexService: mockCodexService,
        geminiService: mockGeminiService,
        registry: createMockRegistry(),
        messageStore: createMockMessageStore(),
      });

      for await (const _ of router.route('user-1', `${mention} 做某事`)) {
        // consume
      }

      const services = {
        opus: mockClaudeService,
        codex: mockCodexService,
        gemini: mockGeminiService,
      };

      assert.equal(
        services[expectedCat].invoke.mock.callCount(),
        1,
        `${mention} should route to ${expectedCat}`
      );
    }
  });

  test('invokes all three cats for triple mention (parallel, no order guarantee)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus', 'Opus');
    const mockCodexService = createMockAgentService('codex', 'Codex');
    const mockGeminiService = createMockAgentService('gemini', 'Gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route(
      'user-1',
      '@opus design, @codex review, @gemini visualize'
    )) {
      messages.push(msg);
    }

    // All three should be called
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 1);

    // All three texts present (parallel — order not guaranteed)
    const textMessages = messages.filter((m) => m.type === 'text');
    assert.equal(textMessages.length, 3);
    const catIds = textMessages.map((m) => m.catId).sort();
    assert.deepEqual(catIds, ['codex', 'gemini', 'opus']);
  });

  test('does not duplicate same cat when mentioned multiple times', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route(
      'user-1',
      '@opus do this, and @opus also do that'
    )) {
      messages.push(msg);
    }

    // Should only call once, not twice
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
  });

  test('case insensitive mention matching', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '@OPUS help me')) {
      // consume
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
  });

  test('continues chain when first cat throws an error', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    // Opus throws, Codex should still execute
    const mockClaudeService = {
      invoke: mock.fn(async function* () {
        throw new Error('Claude CLI crashed');
      }),
    };
    const mockCodexService = createMockAgentService('codex', 'Codex response');
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@opus write, @codex review')) {
      messages.push(msg);
    }

    // Opus error should be yielded
    const errors = messages.filter((m) => m.type === 'error');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].catId, 'opus');
    assert.ok(errors[0].error.includes('Claude CLI crashed'));

    // Codex should still have been called
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    const codexText = messages.filter((m) => m.type === 'text' && m.catId === 'codex');
    assert.equal(codexText.length, 1);

    // Both done messages should exist, only codex isFinal
    const dones = messages.filter((m) => m.type === 'done');
    assert.equal(dones.length, 2);
    const opusDone = dones.find((m) => m.catId === 'opus');
    const codexDone = dones.find((m) => m.catId === 'codex');
    assert.equal(opusDone?.isFinal, false);
    assert.equal(codexDone?.isFinal, true);
  });

  test('session store failure degrades gracefully without crashing route', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let capturedOptions = null;
    const mockClaudeService = {
      invoke: mock.fn(async function* (_prompt, options) {
        capturedOptions = options;
        yield { type: 'session_init', catId: 'opus', sessionId: 'new-sess', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: 'Hello', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    // SessionStore that throws on every operation (simulates Redis down)
    const brokenSessionStore = {
      getSessionId: mock.fn(async () => { throw new Error('Redis ETIMEDOUT'); }),
      setSessionId: mock.fn(async () => { throw new Error('Redis ETIMEDOUT'); }),
      deleteSession: mock.fn(async () => { throw new Error('Redis ETIMEDOUT'); }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      sessionStore: brokenSessionStore,
    });

    // Should NOT throw — should degrade to no-session
    const messages = [];
    for await (const msg of router.route('user-1', 'Hello')) {
      messages.push(msg);
    }

    // Service was called without session (degraded)
    assert.equal(capturedOptions?.sessionId, undefined);
    // Text message still came through
    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 1);
    assert.equal(texts[0].content, 'Hello');
  });

  // --- Participant tracking tests (Phase 3.2 Task 3) ---

  test('@ mentions update thread participants via threadStore', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const threadStore = createMockThreadStore();
    const router = new AgentRouter({
      claudeService: createMockAgentService('opus'),
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    for await (const _ of router.route('user-1', '@opus @codex help', 'thread_1')) {}

    // Participants should have been added
    assert.deepEqual(threadStore._participants['thread_1'], ['opus', 'codex']);
  });

  test('no @ mention routes to all thread participants', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    // Thread already has opus + codex as participants
    const threadStore = createMockThreadStore({ thread_1: ['opus', 'codex'] });
    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    const messages = [];
    // No @ mention — should route to existing participants
    for await (const msg of router.route('user-1', 'what do you think?', 'thread_1')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);
  });

  test('no @ mention + no participants defaults to opus', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    // Thread exists but has no participants
    const threadStore = createMockThreadStore({});
    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    for await (const _ of router.route('user-1', 'hello', 'thread_new')) {}

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 0);
  });

  test('@three cats then no-@ routes to all three', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    const threadStore = createMockThreadStore();
    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    // First: @ all three cats
    for await (const _ of router.route('user-1', '@opus @codex @gemini meeting', 'thread_x')) {}

    // Verify all three called
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 1);

    // Second: no @ — should still route to all three (participants remembered)
    for await (const _ of router.route('user-1', 'what about this?', 'thread_x')) {}

    assert.equal(mockClaudeService.invoke.mock.callCount(), 2);
    assert.equal(mockCodexService.invoke.mock.callCount(), 2);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 2);
  });

  test('route with explicit threadId passes it to messageStore.append', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const appendedMessages = [];
    const msgStore = {
      ...createMockMessageStore(),
      append: (msg) => { appendedMessages.push(msg); return { ...msg, id: 'msg-1' }; },
    };

    const router = new AgentRouter({
      claudeService: createMockAgentService('opus'),
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: msgStore,
    });

    for await (const _ of router.route('user-1', 'hi', 'my-thread')) {}

    // User message should have threadId
    assert.equal(appendedMessages[0].threadId, 'my-thread');
    // Cat response message should also have threadId
    if (appendedMessages.length > 1) {
      assert.equal(appendedMessages[1].threadId, 'my-thread');
    }
  });

  test('no threadStore degrades to default opus routing', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    // No threadStore — old behavior
    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', 'hello')) {}

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 0);
  });

  test('new @ mention adds to existing participants', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaudeService = createMockAgentService('opus');
    const mockCodexService = createMockAgentService('codex');
    const mockGeminiService = createMockAgentService('gemini');

    // Thread already has opus
    const threadStore = createMockThreadStore({ thread_y: ['opus'] });
    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    // @gemini — should add gemini to participants and route only to gemini
    for await (const _ of router.route('user-1', '@gemini design this', 'thread_y')) {}
    assert.equal(mockGeminiService.invoke.mock.callCount(), 1);
    assert.equal(mockClaudeService.invoke.mock.callCount(), 0); // not called — only @gemini

    // Now no @ — should route to opus + gemini (both participants)
    for await (const _ of router.route('user-1', 'looks good?', 'thread_y')) {}
    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockGeminiService.invoke.mock.callCount(), 2);
    assert.deepEqual(threadStore._participants['thread_y'], ['opus', 'gemini']);
  });

  test('error from first cat is not passed as context to second cat', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let codexReceivedPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* () {
        throw new Error('boom');
      }),
    };
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexReceivedPrompt = prompt;
        yield { type: 'session_init', catId: 'codex', sessionId: 'c-1', timestamp: Date.now() };
        yield { type: 'text', catId: 'codex', content: 'done', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };
    const mockGeminiService = createMockAgentService('gemini');

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: mockGeminiService,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '@opus then @codex')) {
      // consume
    }

    // Codex gets original message (with identity prefix) but no opus response since it crashed
    assert.ok(codexReceivedPrompt.includes('@opus then @codex'));
  });

  test('passes workingDirectory when thread has non-default projectPath', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let receivedOptions = null;
    const mockClaudeService = {
      invoke: mock.fn(async function* (_prompt, options) {
        receivedOptions = options;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };

    const threadStore = createMockThreadStore({}, {
      'thread-proj': '/Users/lysander/projects/cat-cafe',
    });

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    for await (const _ of router.route('user-1', '@opus hello', 'thread-proj')) {
      // consume
    }

    assert.ok(receivedOptions);
    assert.equal(receivedOptions.workingDirectory, '/Users/lysander/projects/cat-cafe');
  });

  test('does NOT pass workingDirectory when thread has default projectPath', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let receivedOptions = null;
    const mockClaudeService = {
      invoke: mock.fn(async function* (_prompt, options) {
        receivedOptions = options;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };

    const threadStore = createMockThreadStore({}, {
      'thread-default': 'default',
    });

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    for await (const _ of router.route('user-1', '@opus hello', 'thread-default')) {
      // consume
    }

    assert.ok(receivedOptions);
    assert.equal(receivedOptions.workingDirectory, undefined);
  });

  test('identity injection: opus prompt contains 布偶猫', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusReceivedPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusReceivedPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '@opus hello')) {
      // consume
    }

    assert.ok(opusReceivedPrompt.includes('布偶猫'), 'Opus prompt should contain 布偶猫');
    assert.ok(opusReceivedPrompt.includes('Anthropic'), 'Opus prompt should mention Anthropic');
    assert.ok(opusReceivedPrompt.includes('hello'), 'Opus prompt should contain original message');
  });

  test('identity injection: codex prompt in serial chain contains 缅因猫 (#execute)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let codexReceivedPrompt = '';
    const mockClaudeService = createMockAgentService('opus', 'opus says hi');
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexReceivedPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'codex says hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '#execute @opus @codex hello')) {
      // consume
    }

    assert.ok(codexReceivedPrompt.includes('缅因猫'), 'Codex prompt should contain 缅因猫');
    assert.ok(codexReceivedPrompt.includes('2/2'), 'Codex prompt should show chain position 2/2');
  });

  // --- Parallel routing tests ---

  test('parallel: 2 cats both invoked with mode=parallel (auto ideate)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusPrompt = '';
    let codexPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'Opus thinks', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'Codex thinks', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@opus @codex what do you think?')) {
      messages.push(msg);
    }

    assert.equal(mockClaudeService.invoke.mock.callCount(), 1);
    assert.equal(mockCodexService.invoke.mock.callCount(), 1);

    // Both prompts should contain parallel mode text, NOT chain position
    assert.ok(opusPrompt.includes('独立思考'), 'Opus should get parallel mode');
    assert.ok(codexPrompt.includes('独立思考'), 'Codex should get parallel mode');
    assert.ok(!opusPrompt.includes('被召唤'), 'Opus should NOT have serial chain text');
    assert.ok(!codexPrompt.includes('被召唤'), 'Codex should NOT have serial chain text');

    // Both texts should be present
    const textMsgs = messages.filter((m) => m.type === 'text');
    assert.equal(textMsgs.length, 2);
  });

  test('parallel: codex does NOT see opus response (independent thinking)', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let codexPrompt = '';
    const mockClaudeService = createMockAgentService('opus', 'Opus unique response');
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'Codex response', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '@opus @codex brainstorm this')) {
      // consume
    }

    assert.ok(!codexPrompt.includes('Opus unique response'),
      'Codex should NOT see opus response in parallel mode');
  });

  test('parallel: isFinal only on last done message', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: createMockAgentService('opus', 'a'),
      codexService: createMockAgentService('codex', 'b'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const doneMessages = [];
    for await (const msg of router.route('user-1', '@opus @codex parallel test')) {
      if (msg.type === 'done') doneMessages.push(msg);
    }

    assert.equal(doneMessages.length, 2, 'Should have 2 done messages');
    // Exactly one should have isFinal=true
    const finalCount = doneMessages.filter((m) => m.isFinal).length;
    assert.equal(finalCount, 1, 'Exactly one done should be isFinal');
    // The last done should be isFinal
    assert.ok(doneMessages[doneMessages.length - 1].isFinal, 'Last done should be isFinal');
  });

  test('parallel: #execute forces serial even with multiple cats', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let codexPrompt = '';
    const mockClaudeService = createMockAgentService('opus', 'Serial opus');
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'Serial codex', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    for await (const _ of router.route('user-1', '#execute @opus @codex do this')) {
      // consume
    }

    // Serial mode: codex should see opus's response
    assert.ok(codexPrompt.includes('Serial opus'),
      '#execute should force serial chain (codex sees opus response)');
    assert.ok(codexPrompt.includes('被召唤'),
      '#execute should use serial mode text');
  });

  test('parallel: all cat responses are stored in messageStore', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const appendedMessages = [];
    const store = {
      ...createMockMessageStore(),
      append: (msg) => { appendedMessages.push(msg); return { ...msg, id: 'msg-1' }; },
    };
    const router = new AgentRouter({
      claudeService: createMockAgentService('opus', 'Opus stored'),
      codexService: createMockAgentService('codex', 'Codex stored'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: store,
    });

    for await (const _ of router.route('user-1', '@opus @codex store test')) {
      // consume
    }

    // User message + 2 cat responses = 3 appends
    assert.equal(appendedMessages.length, 3);
    const appendedCatIds = appendedMessages.map((m) => m.catId).filter(Boolean);
    assert.ok(appendedCatIds.includes('opus'), 'Opus response should be stored');
    assert.ok(appendedCatIds.includes('codex'), 'Codex response should be stored');
  });

  test('parallel: 3 cats all invoked independently', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const mockClaude = createMockAgentService('opus', 'a');
    const mockCodex = createMockAgentService('codex', 'b');
    const mockGemini = createMockAgentService('gemini', 'c');

    const router = new AgentRouter({
      claudeService: mockClaude,
      codexService: mockCodex,
      geminiService: mockGemini,
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const messages = [];
    for await (const msg of router.route('user-1', '@opus @codex @gemini three way')) {
      messages.push(msg);
    }

    assert.equal(mockClaude.invoke.mock.callCount(), 1);
    assert.equal(mockCodex.invoke.mock.callCount(), 1);
    assert.equal(mockGemini.invoke.mock.callCount(), 1);

    const textMsgs = messages.filter((m) => m.type === 'text');
    assert.equal(textMsgs.length, 3);
    const dones = messages.filter((m) => m.type === 'done');
    assert.equal(dones.length, 3);
    assert.equal(dones.filter((m) => m.isFinal).length, 1);
  });

  // --- Context history injection tests (Phase 3.6) ---

  test('context history: single cat prompt includes thread history', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };

    const store = {
      ...createMockMessageStore(),
      getByThread: () => [
        { id: 'm1', threadId: 't1', userId: 'u1', catId: null, content: 'earlier question', mentions: [], timestamp: 1000 },
        { id: 'm2', threadId: 't1', userId: 'u1', catId: 'opus', content: 'earlier answer', mentions: [], timestamp: 2000 },
      ],
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: store,
    });

    for await (const _ of router.route('user-1', '@opus follow up')) {}

    assert.ok(opusPrompt.includes('对话历史'), 'Prompt should contain context history header');
    assert.ok(opusPrompt.includes('earlier question'), 'Prompt should contain user history');
    assert.ok(opusPrompt.includes('earlier answer'), 'Prompt should contain cat history');
  });

  test('context history: serial multi-cat — both cats receive history', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusPrompt = '';
    let codexPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'opus reply', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'codex reply', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const store = {
      ...createMockMessageStore(),
      getByThread: () => [
        { id: 'm1', threadId: 't1', userId: 'u1', catId: 'gemini', content: 'gemini said something', mentions: [], timestamp: 1000 },
      ],
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: store,
    });

    for await (const _ of router.route('user-1', '#execute @opus @codex review')) {}

    assert.ok(opusPrompt.includes('gemini said something'), 'Opus should see gemini history');
    assert.ok(codexPrompt.includes('gemini said something'), 'Codex should see gemini history');
  });

  test('context history: parallel multi-cat — both cats receive history', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusPrompt = '';
    let codexPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'a', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };
    const mockCodexService = {
      invoke: mock.fn(async function* (prompt) {
        codexPrompt = prompt;
        yield { type: 'text', catId: 'codex', content: 'b', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      }),
    };

    const store = {
      ...createMockMessageStore(),
      getByThread: () => [
        { id: 'm1', threadId: 't1', userId: 'u1', catId: null, content: 'user said hi', mentions: [], timestamp: 1000 },
      ],
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: mockCodexService,
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: store,
    });

    for await (const _ of router.route('user-1', '@opus @codex think about this')) {}

    assert.ok(opusPrompt.includes('user said hi'), 'Opus should see history in parallel mode');
    assert.ok(codexPrompt.includes('user said hi'), 'Codex should see history in parallel mode');
  });

  test('context history: empty history — no context header in prompt', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    let opusPrompt = '';
    const mockClaudeService = {
      invoke: mock.fn(async function* (prompt) {
        opusPrompt = prompt;
        yield { type: 'text', catId: 'opus', content: 'hi', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      }),
    };

    const router = new AgentRouter({
      claudeService: mockClaudeService,
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(), // getByThread returns []
    });

    for await (const _ of router.route('user-1', '@opus first message')) {}

    assert.ok(!opusPrompt.includes('对话历史'), 'Empty history should not add context header');
    assert.ok(opusPrompt.includes('first message'), 'Prompt should still have the message');
  });

  test('parallel: resolveTargetsAndIntent returns correct intent', async () => {
    const { AgentRouter } = await import(
      '../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: createMockAgentService('opus'),
      codexService: createMockAgentService('codex'),
      geminiService: createMockAgentService('gemini'),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
    });

    const result1 = await router.resolveTargetsAndIntent('@opus @codex think');
    assert.equal(result1.intent.intent, 'ideate', '2 cats should auto-ideate');
    assert.equal(result1.targetCats.length, 2);

    const result2 = await router.resolveTargetsAndIntent('#execute @opus @codex do');
    assert.equal(result2.intent.intent, 'execute', '#execute should force execute');

    const result3 = await router.resolveTargetsAndIntent('@opus solo');
    assert.equal(result3.intent.intent, 'execute', '1 cat should default to execute');
  });
});
