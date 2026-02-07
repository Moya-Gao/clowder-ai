/**
 * McpPromptInjector Tests
 * 验证 MCP HTTP callback 注入逻辑
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('McpPromptInjector', () => {
  it('needsMcpInjection returns false for opus (native MCP)', async () => {
    const { needsMcpInjection } = await import(
      '../dist/domains/cats/services/McpPromptInjector.js'
    );
    assert.equal(needsMcpInjection('opus'), false);
  });

  it('needsMcpInjection returns true for codex', async () => {
    const { needsMcpInjection } = await import(
      '../dist/domains/cats/services/McpPromptInjector.js'
    );
    assert.equal(needsMcpInjection('codex'), true);
  });

  it('needsMcpInjection returns true for gemini', async () => {
    const { needsMcpInjection } = await import(
      '../dist/domains/cats/services/McpPromptInjector.js'
    );
    assert.equal(needsMcpInjection('gemini'), true);
  });

  it('buildMcpCallbackInstructions includes correct URLs and parameters', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://127.0.0.1:3002',
      threadId: 'thread-42',
      catId: 'codex',
      invocationId: 'inv-123',
    });

    // Should contain all three callback endpoints
    assert.ok(instructions.includes('/api/callbacks/post_message'));
    assert.ok(instructions.includes('/api/callbacks/get_thread_context'));
    assert.ok(instructions.includes('/api/callbacks/get_pending_mentions'));

    // Should contain correct apiUrl
    assert.ok(instructions.includes('http://127.0.0.1:3002'));

    // Should contain threadId and catId
    assert.ok(instructions.includes('thread-42'));
    assert.ok(instructions.includes('codex'));

    // Should contain invocationId header
    assert.ok(instructions.includes('inv-123'));
    assert.ok(instructions.includes('X-Invocation-Id'));
  });

  it('buildMcpCallbackInstructions works without invocationId', async () => {
    const { buildMcpCallbackInstructions } = await import(
      '../dist/domains/cats/services/McpPromptInjector.js'
    );
    const instructions = buildMcpCallbackInstructions({
      apiUrl: 'http://localhost:3002',
      threadId: 'thread-1',
      catId: 'gemini',
    });

    // Should still contain the three endpoints
    assert.ok(instructions.includes('/api/callbacks/post_message'));
    assert.ok(instructions.includes('/api/callbacks/get_thread_context'));
    assert.ok(instructions.includes('/api/callbacks/get_pending_mentions'));

    // Should contain catId
    assert.ok(instructions.includes('gemini'));
  });
});
