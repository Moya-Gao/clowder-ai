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

  it('buildMcpCallbackInstructions recommends unique handles in multi-variant scenarios', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/agents/invocation/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
    });

    assert.ok(instructions.includes('唯一句柄'), 'should warn about duplicate-name ambiguity');
    assert.ok(instructions.includes('@gpt52'), 'should provide a disambiguated mention example');
  });
});
