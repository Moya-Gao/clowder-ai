/**
 * GeminiAgentService Tests (CLI dual adapter mode)
 * 测试暹罗猫 CLI 子进程调用 (gemini-cli + antigravity-desktop)
 */

import { test, mock, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

const { GeminiAgentService } = await import(
  '../dist/domains/cats/services/GeminiAgentService.js'
);

/** Helper: collect all items from async iterable */
async function collect(iterable) {
  const items = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Create a mock child process for testing spawnCli path.
 */
function createMockProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const proc = {
    stdout,
    stderr,
    pid: 12345,
    exitCode: null,
    kill: mock.fn(() => {
      process.nextTick(() => {
        if (!stdout.destroyed) stdout.end();
        emitter.emit('exit', null, 'SIGTERM');
      });
      return true;
    }),
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

/** Create a mock SpawnFn for gemini-cli adapter */
function createMockSpawnFn(proc) {
  return mock.fn(() => proc);
}

/** Write NDJSON events to mock process stdout, then end with exit 0 */
function emitGeminiEvents(proc, events) {
  for (const event of events) {
    proc.stdout.write(JSON.stringify(event) + '\n');
  }
  proc.stdout.end();
  proc._emitter.emit('exit', 0, null);
}

// ===== gemini-cli adapter tests =====

describe('GeminiAgentService (gemini-cli adapter)', () => {
  test('yields session_init, text, and done on basic success', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('Hello'));

    emitGeminiEvents(proc, [
      { type: 'init', session_id: 'sess-abc', model: 'gemini-3-pro' },
      { type: 'message', role: 'user', content: 'Hello' },
      { type: 'message', role: 'assistant', content: 'Hello from Gemini!', delta: true },
      { type: 'result', status: 'success', stats: { total_tokens: 100 } },
    ]);

    const msgs = await promise;

    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].type, 'session_init');
    assert.equal(msgs[0].sessionId, 'sess-abc');
    assert.equal(msgs[0].catId, 'gemini');
    assert.equal(msgs[1].type, 'text');
    assert.equal(msgs[1].content, 'Hello from Gemini!');
    assert.equal(msgs[2].type, 'done');
  });

  test('passes correct CLI args', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('test prompt'));
    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
    ]);
    await promise;

    const args = spawnFn.mock.calls[0].arguments[1];
    assert.equal(args[0], '-p');
    assert.equal(args[1], 'test prompt');
    assert.ok(args.includes('-o'));
    assert.ok(args.includes('stream-json'));
    assert.ok(args.includes('-y'));
  });

  test('passes callbackEnv as env', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-123',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-456',
    };

    const promise = collect(
      service.invoke('test', { callbackEnv })
    );
    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
    ]);
    await promise;

    const spawnOpts = spawnFn.mock.calls[0].arguments[2];
    assert.equal(spawnOpts.env.CAT_CAFE_INVOCATION_ID, 'inv-123');
    assert.equal(spawnOpts.env.CAT_CAFE_CALLBACK_TOKEN, 'tok-456');
  });

  test('maps tool_use events', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('read a file'));

    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
      { type: 'message', role: 'user', content: 'read a file' },
      { type: 'tool_use', tool_name: 'read_file', tool_id: 'r1', parameters: { path: '/tmp/test' } },
      { type: 'tool_result', tool_id: 'r1', status: 'success', output: 'content' },
      { type: 'message', role: 'assistant', content: 'Done', delta: true },
      { type: 'result', status: 'success', stats: {} },
    ]);

    const msgs = await promise;
    const toolMsg = msgs.find((m) => m.type === 'tool_use');
    assert.ok(toolMsg);
    assert.equal(toolMsg.toolName, 'read_file');
    assert.deepEqual(toolMsg.toolInput, { path: '/tmp/test' });

    // tool_result should be skipped
    const toolResults = msgs.filter((m) => m.toolName === undefined && m.type === 'tool_use');
    assert.equal(toolResults.length, 0);
  });

  test('yields error on CLI non-zero exit', async () => {
    const proc = createMockProcess();
    proc.kill = mock.fn(() => true);
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('crash'));

    proc.stderr.write('Error: authentication failed\n');
    proc.stdout.end();
    proc._emitter.emit('exit', 1, null);

    const msgs = await promise;
    const errMsg = msgs.find((m) => m.type === 'error');
    assert.ok(errMsg);
    assert.ok(errMsg.error.includes('1'));
    assert.ok(errMsg.error.includes('authentication failed'));
  });

  test('yields error on spawn ENOENT', async () => {
    const proc = createMockProcess();
    proc.kill = mock.fn(() => true);
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('hi'));

    process.nextTick(() => {
      const err = new Error('spawn gemini ENOENT');
      err.code = 'ENOENT';
      proc._emitter.emit('error', err);
      proc.stdout.end();
      proc._emitter.emit('exit', null, null);
    });

    const msgs = await promise;
    const errMsg = msgs.find((m) => m.type === 'error');
    assert.ok(errMsg);
    assert.ok(errMsg.error.includes('ENOENT'));
  });

  test('skips user echo and result/success events', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('test'));

    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
      { type: 'message', role: 'user', content: 'test' },
      { type: 'message', role: 'assistant', content: 'Response', delta: true },
      { type: 'result', status: 'success', stats: { total_tokens: 50 } },
      { type: 'unknown_event', data: 'something' },
    ]);

    const msgs = await promise;
    // Only session_init, text, done — everything else skipped
    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].type, 'session_init');
    assert.equal(msgs[1].type, 'text');
    assert.equal(msgs[1].content, 'Response');
    assert.equal(msgs[2].type, 'done');
  });

  test('all messages have catId gemini', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('check'));

    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's-catid', model: 'auto' },
      { type: 'message', role: 'assistant', content: 'Test', delta: true },
    ]);

    const msgs = await promise;
    for (const msg of msgs) {
      assert.equal(msg.catId, 'gemini', `expected catId gemini for ${msg.type} message`);
    }
  });

  test('maps result with non-success status to error', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new GeminiAgentService({ spawnFn, adapter: 'gemini-cli' });

    const promise = collect(service.invoke('fail'));

    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
      { type: 'result', status: 'error', error: 'Model overloaded' },
    ]);

    const msgs = await promise;
    const errMsg = msgs.find((m) => m.type === 'error');
    assert.ok(errMsg);
    assert.equal(errMsg.error, 'Model overloaded');
  });
});

// ===== antigravity adapter tests =====

describe('GeminiAgentService (antigravity adapter)', () => {
  test('yields session_init, notification text, and done', async () => {
    const antigravitySpawnFn = mock.fn(() => ({
      on: mock.fn(),
      unref: mock.fn(),
      pid: 99999,
    }));

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-1',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-1',
    };

    const msgs = await collect(service.invoke('Design a logo', { callbackEnv }));

    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].type, 'session_init');
    assert.ok(msgs[0].sessionId.startsWith('antigravity-'));
    assert.equal(msgs[1].type, 'text');
    assert.ok(msgs[1].content.includes('Antigravity'));
    assert.equal(msgs[2].type, 'done');
  });

  test('spawns antigravity with correct args and env', async () => {
    const antigravitySpawnFn = mock.fn(() => ({
      on: mock.fn(),
      unref: mock.fn(),
      pid: 99999,
    }));

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-2',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-2',
    };

    await collect(service.invoke('Design a logo', { callbackEnv }));

    assert.equal(antigravitySpawnFn.mock.callCount(), 1);
    const call = antigravitySpawnFn.mock.calls[0];
    assert.equal(call.arguments[0], 'antigravity');
    assert.deepEqual(call.arguments[1], ['chat', '--mode', 'agent', 'Design a logo']);

    const spawnOpts = call.arguments[2];
    assert.equal(spawnOpts.detached, true);
    assert.equal(spawnOpts.stdio, 'ignore');
    assert.equal(spawnOpts.env.CAT_CAFE_INVOCATION_ID, 'inv-2');
    assert.equal(spawnOpts.env.CAT_CAFE_CALLBACK_TOKEN, 'tok-2');
  });

  test('errors when callbackEnv is missing', async () => {
    const antigravitySpawnFn = mock.fn();

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const msgs = await collect(service.invoke('test'));

    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'error');
    assert.ok(msgs[0].error.includes('callbackEnv'));
    // Should not have spawned anything
    assert.equal(antigravitySpawnFn.mock.callCount(), 0);
  });

  test('handles async spawn error without crashing', async () => {
    let errorHandler;
    const antigravitySpawnFn = mock.fn(() => ({
      on: mock.fn((event, handler) => {
        if (event === 'error') errorHandler = handler;
      }),
      unref: mock.fn(),
      pid: 99999,
    }));

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-async',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-async',
    };

    const msgs = await collect(service.invoke('test', { callbackEnv }));

    // Generator has already finished with session_init + text + done
    assert.equal(msgs.length, 3);
    assert.equal(msgs[2].type, 'done');

    // Simulate async ENOENT — should NOT throw/crash
    assert.ok(errorHandler, 'error handler should be registered on child');
    assert.doesNotThrow(() => {
      errorHandler(new Error('spawn antigravity ENOENT'));
    });
  });

  test('handles synchronous spawn failure gracefully', async () => {
    const antigravitySpawnFn = mock.fn(() => {
      throw new Error('spawn antigravity ENOENT');
    });

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-3',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-3',
    };

    const msgs = await collect(service.invoke('test', { callbackEnv }));

    // Should have session_init then error (no text or done after error)
    assert.equal(msgs[0].type, 'session_init');
    const errMsg = msgs.find((m) => m.type === 'error');
    assert.ok(errMsg);
    assert.ok(errMsg.error.includes('ENOENT'));
  });

  test('all messages have catId gemini', async () => {
    const antigravitySpawnFn = mock.fn(() => ({
      on: mock.fn(),
      unref: mock.fn(),
      pid: 99999,
    }));

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-4',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-4',
    };

    const msgs = await collect(service.invoke('test', { callbackEnv }));

    for (const msg of msgs) {
      assert.equal(msg.catId, 'gemini', `expected catId gemini for ${msg.type} message`);
    }
  });
});

// ===== facade / adapter selection tests =====

describe('GeminiAgentService (adapter selection)', () => {
  test('defaults to gemini-cli adapter', async () => {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    // No adapter option → should default to gemini-cli
    const service = new GeminiAgentService({ spawnFn });

    const promise = collect(service.invoke('test'));
    emitGeminiEvents(proc, [
      { type: 'init', session_id: 's1', model: 'auto' },
    ]);
    await promise;

    // Verify gemini CLI was spawned (not antigravity)
    assert.equal(spawnFn.mock.callCount(), 1);
    assert.equal(spawnFn.mock.calls[0].arguments[0], 'gemini');
  });

  test('selects antigravity via constructor option', async () => {
    const antigravitySpawnFn = mock.fn(() => ({
      on: mock.fn(),
      unref: mock.fn(),
      pid: 99999,
    }));

    const service = new GeminiAgentService({
      adapter: 'antigravity',
      antigravitySpawnFn,
    });

    const callbackEnv = {
      CAT_CAFE_API_URL: 'http://localhost:3002',
      CAT_CAFE_INVOCATION_ID: 'inv-5',
      CAT_CAFE_CALLBACK_TOKEN: 'tok-5',
    };

    await collect(service.invoke('test', { callbackEnv }));

    assert.equal(antigravitySpawnFn.mock.callCount(), 1);
    assert.equal(antigravitySpawnFn.mock.calls[0].arguments[0], 'antigravity');
  });
});
