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
  };
}

// Create mock agent services
function createMockAgentService(catId, responseText = 'Hello from mock') {
  const invoke = mock.fn(async function* (prompt, options) {
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
      content: `${responseText}: ${prompt}`,
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

  test('executes multiple cats in order when multiple @ mentions are present', async () => {
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
      '@opus write code, then @codex review it'
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

  test('multi-cat chain includes previous responses in prompt', async () => {
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
      '@opus write code, then @codex review it'
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

  test('executes three cats in order for triple mention', async () => {
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

    // Check order of text messages
    const textMessages = messages.filter((m) => m.type === 'text');
    assert.equal(textMessages.length, 3);
    assert.equal(textMessages[0].catId, 'opus');
    assert.equal(textMessages[1].catId, 'codex');
    assert.equal(textMessages[2].catId, 'gemini');
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

    // Codex gets original message only (no opus response since it crashed)
    assert.equal(codexReceivedPrompt, '@opus then @codex');
  });
});
