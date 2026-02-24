/**
 * McpPromptInjector Tests
 * 验证 MCP HTTP callback 注入逻辑
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('McpPromptInjector', () => {
  it('needsMcpInjection returns false when mcpSupport is true', async () => {
    const { needsMcpInjection } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    assert.equal(needsMcpInjection(true), false);
  });

  it('needsMcpInjection returns true when mcpSupport is false', async () => {
    const { needsMcpInjection } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    assert.equal(needsMcpInjection(false), true);
  });

  it('buildMcpCallbackInstructions uses correct hyphenated endpoints', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
    });

    // Must use hyphenated endpoints matching callbacks.ts routes
    assert.ok(instructions.includes('/api/callbacks/post-message'), 'should use post-message (hyphen)');
    assert.ok(instructions.includes('/api/callbacks/thread-context'), 'should use thread-context (hyphen)');
    assert.ok(instructions.includes('/api/callbacks/pending-mentions'), 'should use pending-mentions (hyphen)');
    assert.ok(instructions.includes('/api/callbacks/update-task'), 'should use update-task (hyphen)');

    // Must NOT contain underscore versions
    assert.ok(!instructions.includes('post_message'), 'should NOT use post_message (underscore)');
    assert.ok(!instructions.includes('get_thread_context'), 'should NOT use get_thread_context');
    assert.ok(!instructions.includes('get_pending_mentions'), 'should NOT use get_pending_mentions');
  });

  it('buildMcpCallbackInstructions references env var credentials', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
    });

    // Must reference env vars for auth (set by invokeSingleCat at spawn)
    assert.ok(instructions.includes('$CAT_CAFE_INVOCATION_ID'), 'should reference INVOCATION_ID env var');
    assert.ok(instructions.includes('$CAT_CAFE_CALLBACK_TOKEN'), 'should reference CALLBACK_TOKEN env var');

    // POST bodies must include invocationId + callbackToken fields (escaped in template literal)
    assert.ok(instructions.includes('invocationId'), 'POST body should include invocationId field');
    assert.ok(instructions.includes('callbackToken'), 'POST body should include callbackToken field');

    // GET requests must include auth in query params
    assert.ok(instructions.includes('invocationId=$CAT_CAFE_INVOCATION_ID'), 'GET should have invocationId in query');
    assert.ok(instructions.includes('callbackToken=$CAT_CAFE_CALLBACK_TOKEN'), 'GET should have callbackToken in query');
  });

  it('buildMcpCallbackInstructions includes correct apiUrl', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://localhost:9999',
    });

    assert.ok(instructions.includes('http://localhost:9999'), 'should include custom apiUrl');
  });

  it('buildMcpCallbackInstructions avoids hard-coding a specific cat handle in examples', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
      exampleHandle: '@codex',
    });

    assert.ok(instructions.includes('唯一句柄'), 'should warn about duplicate-name ambiguity');
    assert.ok(instructions.includes('同族多分身时'), 'should teach same-breed multi-variant rule');
    assert.ok(!instructions.includes('@catId'), 'should not use non-routable literal @catId example');
    assert.ok(instructions.includes('@codex'), 'should provide a routable handle example');
    assert.ok(!instructions.includes('@gpt52'), 'should not hard-code gpt52');
  });

  it('buildMcpCallbackInstructions uses teammate handle (not self) in @mention examples', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
      currentCatId: 'opus',
      teammates: ['codex'],
    });

    assert.ok(instructions.includes('@codex'), 'should use teammate handle as example');
    assert.ok(!instructions.includes('@opus 请帮我 review'), 'should avoid self-mention example');
  });

  // --- F-BLOAT: Short-form tests ---

  it('buildMcpCallbackInstructionsShort is significantly shorter than full form', async () => {
    const { buildMcpCallbackInstructions, buildMcpCallbackInstructionsShort } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const opts = { apiUrl: 'http://127.0.0.1:3002' };
    const full = buildMcpCallbackInstructions(opts);
    const short = buildMcpCallbackInstructionsShort(opts);

    assert.ok(short.length < full.length * 0.4, `Short (${short.length}) should be <40% of full (${full.length})`);
  });

  it('buildMcpCallbackInstructionsShort contains @teammate rules and credential reference', async () => {
    const { buildMcpCallbackInstructionsShort } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const short = buildMcpCallbackInstructionsShort({
      apiUrl: 'http://127.0.0.1:3002',
      currentCatId: 'opus',
      teammates: ['codex'],
    });

    assert.ok(short.includes('@队友'), 'should include @teammate section');
    assert.ok(short.includes('$CAT_CAFE_INVOCATION_ID'), 'should reference credential env var');
    assert.ok(short.includes('/api/callbacks/instructions'), 'should reference full API docs endpoint');
  });

  it('buildMcpCallbackInstructionsShort does NOT contain curl examples', async () => {
    const { buildMcpCallbackInstructionsShort } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const short = buildMcpCallbackInstructionsShort({ apiUrl: 'http://127.0.0.1:3002' });

    assert.ok(!short.includes('curl -sS'), 'short form should not contain curl examples');
    assert.ok(!short.includes('```bash'), 'short form should not contain bash code blocks');
  });

  it('buildMcpCallbackInstructions references rich-block-rules endpoint (progressive disclosure)', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const full = buildMcpCallbackInstructions({ apiUrl: 'http://127.0.0.1:3002' });

    assert.ok(full.includes('/api/callbacks/rich-block-rules'), 'full form should reference rich-block-rules endpoint');
    // Should NOT contain the full rich block rules inline anymore
    assert.ok(!full.includes('何时使用（默认触发）'), 'should not inline full rich block rules');
  });
});
