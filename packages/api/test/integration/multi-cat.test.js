/**
 * Multi-Cat Integration Tests
 * 测试真实 SDK 调用的集成测试
 *
 * IMPORTANT: 这些测试需要真实的 API keys，默认跳过
 * 运行方式:
 *   RUN_INTEGRATION_TESTS=true ANTHROPIC_API_KEY=xxx OPENAI_API_KEY=xxx GOOGLE_API_KEY=xxx node --test test/integration/multi-cat.test.js
 *
 * 环境变量:
 *   - RUN_INTEGRATION_TESTS: 设置为 "true" 才会运行测试
 *   - ANTHROPIC_API_KEY: Claude API key
 *   - OPENAI_API_KEY: Codex/OpenAI API key
 *   - GOOGLE_API_KEY: Gemini API key
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Check if integration tests should run
const shouldRunIntegrationTests =
  process.env['RUN_INTEGRATION_TESTS'] === 'true';

// Check for required API keys
const hasAnthropicKey = !!process.env['ANTHROPIC_API_KEY'];
const hasOpenAIKey = !!process.env['OPENAI_API_KEY'];
const hasGoogleKey = !!process.env['GOOGLE_API_KEY'];

// Helper to conditionally skip tests
const itOrSkip = shouldRunIntegrationTests ? test : test.skip;

// Log status at startup
if (!shouldRunIntegrationTests) {
  console.log(
    '\n[multi-cat.test.js] Skipping integration tests (RUN_INTEGRATION_TESTS not set)\n'
  );
}

describe('Multi-Cat Integration Tests', { skip: !shouldRunIntegrationTests }, () => {
  /**
   * Test: Default routing to Claude (opus)
   * 无提及时默认路由到布偶猫
   */
  itOrSkip('routes to Claude (opus) when no @ mention is present', { skip: !hasAnthropicKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    const messages = [];
    for await (const msg of router.route('test-user-1', 'Say "hello" in exactly one word')) {
      messages.push(msg);
    }

    // Verify we got messages from opus
    assert.ok(messages.length > 0, 'Should receive at least one message');
    assert.ok(
      messages.some((m) => m.catId === 'opus'),
      'Messages should be from opus'
    );
    assert.ok(
      messages.some((m) => m.type === 'text'),
      'Should have text response'
    );
    assert.ok(
      messages.some((m) => m.type === 'done'),
      'Should have done message'
    );

    // Verify session was created
    const sessionInit = messages.find((m) => m.type === 'session_init');
    assert.ok(sessionInit, 'Should have session_init message');
    assert.ok(sessionInit.sessionId, 'Should have session ID');
  });

  /**
   * Test: Routing to Codex via @缅因猫
   * @缅因 路由到缅因猫 (Codex)
   */
  itOrSkip('routes to Codex when @缅因 is mentioned', { skip: !hasOpenAIKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    const messages = [];
    for await (const msg of router.route('test-user-2', '@缅因 说 "你好"')) {
      messages.push(msg);
    }

    // Verify we got messages from codex
    assert.ok(messages.length > 0, 'Should receive at least one message');
    assert.ok(
      messages.some((m) => m.catId === 'codex'),
      'Messages should be from codex'
    );
    assert.ok(
      messages.some((m) => m.type === 'text'),
      'Should have text response'
    );
  });

  /**
   * Test: Routing to Gemini via @暹罗猫
   * @暹罗 路由到暹罗猫 (Gemini)
   */
  itOrSkip('routes to Gemini when @暹罗 is mentioned', { skip: !hasGoogleKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    const messages = [];
    for await (const msg of router.route('test-user-3', '@暹罗 说 "你好"')) {
      messages.push(msg);
    }

    // Verify we got messages from gemini
    assert.ok(messages.length > 0, 'Should receive at least one message');
    assert.ok(
      messages.some((m) => m.catId === 'gemini'),
      'Messages should be from gemini'
    );
    assert.ok(
      messages.some((m) => m.type === 'text'),
      'Should have text response'
    );
  });

  /**
   * Test: Multi-cat serial invocation
   * 多猫串行调用 - @opus 和 @codex 按顺序执行
   */
  itOrSkip('executes multiple cats in order for multi-mention', { skip: !hasAnthropicKey || !hasOpenAIKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    const messages = [];
    for await (const msg of router.route(
      'test-user-4',
      '@opus say "hello", then @codex say "world"'
    )) {
      messages.push(msg);
    }

    // Verify we got messages from both cats
    const opusMessages = messages.filter((m) => m.catId === 'opus');
    const codexMessages = messages.filter((m) => m.catId === 'codex');

    assert.ok(opusMessages.length > 0, 'Should have opus messages');
    assert.ok(codexMessages.length > 0, 'Should have codex messages');

    // Verify opus text comes before codex text
    const opusTextIndex = messages.findIndex(
      (m) => m.catId === 'opus' && m.type === 'text'
    );
    const codexTextIndex = messages.findIndex(
      (m) => m.catId === 'codex' && m.type === 'text'
    );

    assert.ok(opusTextIndex >= 0, 'Should have opus text');
    assert.ok(codexTextIndex >= 0, 'Should have codex text');
    assert.ok(
      opusTextIndex < codexTextIndex,
      'Opus text should come before codex text'
    );
  });

  /**
   * Test: Three-cat serial invocation
   * 三猫串行调用
   */
  itOrSkip('executes all three cats in order', { skip: !hasAnthropicKey || !hasOpenAIKey || !hasGoogleKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    const messages = [];
    for await (const msg of router.route(
      'test-user-5',
      '@布偶 say "one", @缅因 say "two", @暹罗 say "three"'
    )) {
      messages.push(msg);
    }

    // Verify we got text from all three cats
    const textMessages = messages.filter((m) => m.type === 'text');
    const catIds = [...new Set(textMessages.map((m) => m.catId))];

    assert.ok(catIds.includes('opus'), 'Should have opus text');
    assert.ok(catIds.includes('codex'), 'Should have codex text');
    assert.ok(catIds.includes('gemini'), 'Should have gemini text');

    // Verify order: opus -> codex -> gemini
    const opusTextIndex = textMessages.findIndex((m) => m.catId === 'opus');
    const codexTextIndex = textMessages.findIndex((m) => m.catId === 'codex');
    const geminiTextIndex = textMessages.findIndex((m) => m.catId === 'gemini');

    assert.ok(
      opusTextIndex < codexTextIndex,
      'Opus should come before codex'
    );
    assert.ok(
      codexTextIndex < geminiTextIndex,
      'Codex should come before gemini'
    );
  });

  /**
   * Test: Session persistence
   * 验证 session 在多次调用间保持
   */
  itOrSkip('maintains session across multiple calls', { skip: !hasAnthropicKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );
    const { AgentRouter } = await import(
      '../../dist/domains/cats/services/AgentRouter.js'
    );

    const router = new AgentRouter({
      claudeService: new ClaudeAgentService(),
      codexService: new CodexAgentService(),
      geminiService: new GeminiAgentService(),
    });

    // First call - should create session
    const messages1 = [];
    for await (const msg of router.route('test-user-6', 'Remember the word "banana"')) {
      messages1.push(msg);
    }

    const sessionInit1 = messages1.find((m) => m.type === 'session_init');
    assert.ok(sessionInit1, 'First call should have session_init');
    const firstSessionId = sessionInit1.sessionId;
    assert.ok(firstSessionId, 'First call should create session ID');

    // Second call - should reuse session
    const messages2 = [];
    for await (const msg of router.route('test-user-6', 'What word did I ask you to remember?')) {
      messages2.push(msg);
    }

    const sessionInit2 = messages2.find((m) => m.type === 'session_init');
    assert.ok(sessionInit2, 'Second call should have session_init');

    // The session ID should be the same (session was resumed)
    assert.equal(
      sessionInit2.sessionId,
      firstSessionId,
      'Second call should reuse the same session ID'
    );
  });
});

describe('Individual Service Integration Tests', { skip: !shouldRunIntegrationTests }, () => {
  /**
   * Test: ClaudeAgentService direct invocation
   */
  itOrSkip('ClaudeAgentService responds to prompt', { skip: !hasAnthropicKey }, async () => {
    const { ClaudeAgentService } = await import(
      '../../dist/domains/cats/services/ClaudeAgentService.js'
    );

    const service = new ClaudeAgentService();
    const messages = [];

    for await (const msg of service.invoke('Say "test" in one word')) {
      messages.push(msg);
    }

    assert.ok(messages.length > 0, 'Should receive messages');
    assert.ok(
      messages.some((m) => m.type === 'session_init'),
      'Should have session_init'
    );
    assert.ok(
      messages.some((m) => m.type === 'text'),
      'Should have text response'
    );
    assert.ok(
      messages.some((m) => m.type === 'done'),
      'Should have done message'
    );
  });

  /**
   * Test: CodexAgentService direct invocation
   */
  itOrSkip('CodexAgentService responds to prompt', { skip: !hasOpenAIKey }, async () => {
    const { CodexAgentService } = await import(
      '../../dist/domains/cats/services/CodexAgentService.js'
    );

    const service = new CodexAgentService();
    const messages = [];

    for await (const msg of service.invoke('Say "test" in one word')) {
      messages.push(msg);
    }

    assert.ok(messages.length > 0, 'Should receive messages');
    // Codex may or may not emit session_init depending on SDK version
    assert.ok(
      messages.some((m) => m.type === 'text' || m.type === 'done' || m.type === 'error'),
      'Should have some response'
    );
  });

  /**
   * Test: GeminiAgentService direct invocation
   */
  itOrSkip('GeminiAgentService responds to prompt', { skip: !hasGoogleKey }, async () => {
    const { GeminiAgentService } = await import(
      '../../dist/domains/cats/services/GeminiAgentService.js'
    );

    const service = new GeminiAgentService();
    const messages = [];

    for await (const msg of service.invoke('Say "test" in one word')) {
      messages.push(msg);
    }

    assert.ok(messages.length > 0, 'Should receive messages');
    assert.ok(
      messages.some((m) => m.type === 'session_init'),
      'Should have session_init'
    );
    assert.ok(
      messages.some((m) => m.type === 'text'),
      'Should have text response'
    );
    assert.ok(
      messages.some((m) => m.type === 'done'),
      'Should have done message'
    );
  });
});
