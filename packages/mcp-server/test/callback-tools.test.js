/**
 * MCP Callback Tools Tests
 * 测试 MCP 回传工具的 HTTP 调用逻辑
 *
 * Uses globalThis.fetch mocking since tools use fetch() internally.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('MCP Callback Tools', () => {
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    // Save and set env vars
    originalEnv = { ...process.env };
    process.env['CAT_CAFE_API_URL'] = 'http://127.0.0.1:3002';
    process.env['CAT_CAFE_INVOCATION_ID'] = 'test-invocation';
    process.env['CAT_CAFE_CALLBACK_TOKEN'] = 'test-token';

    // Save original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);

    // Restore fetch
    globalThis.fetch = originalFetch;
  });

  test('handlePostMessage calls API with correct body', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    let capturedUrl, capturedOptions;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      };
    };

    const result = await handlePostMessage({ content: 'Hello from cat!' });

    assert.equal(result.isError, undefined);
    assert.ok(capturedUrl.includes('/api/callbacks/post-message'));
    const body = JSON.parse(capturedOptions.body);
    assert.equal(body.content, 'Hello from cat!');
    assert.equal(body.invocationId, 'test-invocation');
    assert.equal(body.callbackToken, 'test-token');
  });

  test('handlePostMessage returns error when env vars missing', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    delete process.env['CAT_CAFE_API_URL'];
    delete process.env['CAT_CAFE_INVOCATION_ID'];
    delete process.env['CAT_CAFE_CALLBACK_TOKEN'];

    const result = await handlePostMessage({ content: 'Hello' });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('not configured'));
  });

  test('handleGetPendingMentions calls API with auth in query', async () => {
    const { handleGetPendingMentions } = await import(
      '../dist/tools/callback-tools.js'
    );

    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ mentions: [] }),
      };
    };

    const result = await handleGetPendingMentions({});

    assert.equal(result.isError, undefined);
    assert.ok(capturedUrl.includes('/api/callbacks/pending-mentions'));
    assert.ok(capturedUrl.includes('invocationId=test-invocation'));
    assert.ok(capturedUrl.includes('callbackToken=test-token'));
  });

  test('handleGetThreadContext calls API with limit', async () => {
    const { handleGetThreadContext } = await import(
      '../dist/tools/callback-tools.js'
    );

    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ messages: [] }),
      };
    };

    const result = await handleGetThreadContext({ limit: 10 });

    assert.equal(result.isError, undefined);
    assert.ok(capturedUrl.includes('/api/callbacks/thread-context'));
    assert.ok(capturedUrl.includes('limit=10'));
  });

  test('handleGetThreadContext works without limit', async () => {
    const { handleGetThreadContext } = await import(
      '../dist/tools/callback-tools.js'
    );

    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ messages: [] }),
      };
    };

    const result = await handleGetThreadContext({});

    assert.equal(result.isError, undefined);
    assert.ok(!capturedUrl.includes('limit='));
  });

  test('handles API error response', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Invalid credentials',
    });

    const result = await handlePostMessage({ content: 'Hello' });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('401'));
  });
});
