/**
 * MCP Callback Tools Tests
 * 测试 MCP 回传工具的 HTTP 调用逻辑
 *
 * Uses globalThis.fetch mocking since tools use fetch() internally.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('MCP Callback Tools', () => {
  let originalEnv;
  let originalFetch;
  let outboxDir;

  beforeEach(() => {
    // Save and set env vars
    originalEnv = { ...process.env };
    process.env['CAT_CAFE_API_URL'] = 'http://127.0.0.1:3002';
    process.env['CAT_CAFE_INVOCATION_ID'] = 'test-invocation';
    process.env['CAT_CAFE_CALLBACK_TOKEN'] = 'test-token';
    process.env['CAT_CAFE_CALLBACK_RETRY_DELAYS_MS'] = '0,0,0';
    outboxDir = join(tmpdir(), `cat-cafe-mcp-outbox-test-${Date.now()}-${Math.random()}`);
    mkdirSync(outboxDir, { recursive: true });
    process.env['CAT_CAFE_CALLBACK_OUTBOX_DIR'] = outboxDir;

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

    // Clean outbox test dir
    if (outboxDir && existsSync(outboxDir)) {
      rmSync(outboxDir, { recursive: true, force: true });
    }
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

  test('retries transient post failure and keeps same clientMessageId', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    let attempts = 0;
    const observedIds = [];
    globalThis.fetch = async (_url, options) => {
      attempts += 1;
      const body = JSON.parse(options.body);
      observedIds.push(body.clientMessageId);

      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service unavailable',
        };
      }
      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      };
    };

    const result = await handlePostMessage({ content: 'retry me' });

    assert.equal(result.isError, undefined);
    assert.equal(attempts, 2);
    assert.ok(observedIds[0], 'clientMessageId should be present');
    assert.equal(observedIds[0], observedIds[1], 'same id must be reused across retries');
  });

  test('queues post-message to local outbox when transient failures exhaust retries', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    });

    const result = await handlePostMessage({
      content: 'offline message',
      clientMessageId: 'offline-001',
    });

    assert.equal(result.isError, undefined);
    assert.ok(result.content[0].text.includes('queued_for_retry'));

    const files = readdirSync(outboxDir);
    assert.equal(files.length, 1, 'outbox should contain one queued payload');
    const persisted = JSON.parse(readFileSync(join(outboxDir, files[0]), 'utf8'));
    assert.equal(persisted.path, '/api/callbacks/post-message');
    assert.equal(persisted.body.content, 'offline message');
    assert.equal(persisted.body.clientMessageId, 'offline-001');
  });

  test('flushes queued outbox payload before posting new message after recovery', async () => {
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    // Step 1: enqueue by forcing transient failures.
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    });
    await handlePostMessage({
      content: 'queued-first',
      clientMessageId: 'queued-001',
    });
    assert.equal(readdirSync(outboxDir).length, 1, 'precondition: one queued payload exists');

    // Step 2: recover network and verify replay + current post both sent.
    const observedContents = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      observedContents.push(body.content);
      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      };
    };

    const result = await handlePostMessage({
      content: 'current-message',
      clientMessageId: 'current-001',
    });

    assert.equal(result.isError, undefined);
    assert.ok(observedContents.includes('queued-first'));
    assert.ok(observedContents.includes('current-message'));
    assert.equal(readdirSync(outboxDir).length, 0, 'outbox should be drained after successful replay');
  });

  test('flushes at most configured outbox batch size per post', async () => {
    process.env['CAT_CAFE_CALLBACK_OUTBOX_MAX_FLUSH_BATCH'] = '2';
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    const seed = (queuedAt, id, content) => {
      const payload = {
        id,
        queuedAt,
        apiUrl: 'http://127.0.0.1:3002',
        path: '/api/callbacks/post-message',
        body: {
          invocationId: 'test-invocation',
          callbackToken: 'test-token',
          content,
          clientMessageId: id,
        },
        attempts: 0,
        lastError: 'seeded',
      };
      writeFileSync(join(outboxDir, `${queuedAt}-${id}.json`), JSON.stringify(payload), 'utf8');
    };

    seed(1, 'queued-1', 'queued-1');
    seed(2, 'queued-2', 'queued-2');
    seed(3, 'queued-3', 'queued-3');

    const posted = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      posted.push(body.content);
      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      };
    };

    const result = await handlePostMessage({
      content: 'current-message',
      clientMessageId: 'current-001',
    });

    assert.equal(result.isError, undefined);
    assert.ok(posted.includes('queued-1'));
    assert.ok(posted.includes('queued-2'));
    assert.ok(!posted.includes('queued-3'), 'third entry should wait for next flush batch');
    assert.ok(posted.includes('current-message'));
    assert.equal(readdirSync(outboxDir).length, 1, 'one queued entry should remain after bounded flush');
  });

  test('drops retryable outbox entry when attempts reached max threshold', async () => {
    process.env['CAT_CAFE_CALLBACK_OUTBOX_MAX_ATTEMPTS'] = '2';
    const { handlePostMessage } = await import(
      '../dist/tools/callback-tools.js'
    );

    const stale = {
      id: 'stale-001',
      queuedAt: 1,
      apiUrl: 'http://127.0.0.1:3002',
      path: '/api/callbacks/post-message',
      body: {
        invocationId: 'test-invocation',
        callbackToken: 'test-token',
        content: 'stale-message',
        clientMessageId: 'stale-001',
      },
      attempts: 2,
      lastError: 'still failing',
    };
    writeFileSync(join(outboxDir, `${stale.queuedAt}-${stale.id}.json`), JSON.stringify(stale), 'utf8');

    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.content === 'stale-message') {
        return {
          ok: false,
          status: 503,
          text: async () => 'still unavailable',
        };
      }
      return {
        ok: true,
        json: async () => ({ status: 'ok' }),
      };
    };

    const result = await handlePostMessage({
      content: 'current-message',
      clientMessageId: 'current-002',
    });

    assert.equal(result.isError, undefined);
    assert.equal(readdirSync(outboxDir).length, 0, 'stale entry should be dropped after max attempts');
  });
});
