/**
 * CLI Spawn Tests
 * 测试 CLI 子进程管理器
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

const { spawnCli } = await import('../dist/utils/cli-spawn.js');

/** Helper: collect all items from async iterable */
async function collect(iterable) {
  const items = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Create a mock child process for testing
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
      // Simulate real process: killing closes stdout and emits exit
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
  };
  return proc;
}

/** Create a mock SpawnFn that returns the given mock process */
function createMockSpawnFn(mockProcess) {
  return mock.fn(() => mockProcess);
}

test('spawnCli yields parsed JSON events from stdout', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: ['--json'] },
    { spawnFn }
  ));

  proc.stdout.write('{"type":"start","id":"123"}\n');
  proc.stdout.write('{"type":"message","text":"hello"}\n');
  proc.stdout.end();

  const results = await promise;

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], { type: 'start', id: '123' });
  assert.deepEqual(results[1], { type: 'message', text: 'hello' });

  // Verify spawn was called with correct args
  assert.equal(spawnFn.mock.callCount(), 1);
  assert.equal(spawnFn.mock.calls[0].arguments[0], 'test-cli');
  assert.deepEqual(spawnFn.mock.calls[0].arguments[1], ['--json']);
});

test('spawnCli does not yield stderr data', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  ));

  proc.stderr.write('DEBUG: some warning\n');
  proc.stdout.write('{"type":"ok"}\n');
  proc.stdout.end();

  const results = await promise;
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], { type: 'ok' });
});

test('spawnCli skips parse errors in stdout', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  // Suppress console.error for this test
  const originalError = console.error;
  console.error = mock.fn();

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  ));

  proc.stdout.write('{"valid":true}\n');
  proc.stdout.write('not-json-line\n');
  proc.stdout.write('{"also":"valid"}\n');
  proc.stdout.end();

  const results = await promise;

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], { valid: true });
  assert.deepEqual(results[1], { also: 'valid' });

  // Verify parse error was logged
  assert.ok(console.error.mock.callCount() > 0);

  console.error = originalError;
});

test('spawnCli kills process on timeout', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [], timeoutMs: 50 },
    { spawnFn }
  ));

  // Don't write anything to stdout - let it timeout
  // Wait for timeout to fire, then close stdout
  await new Promise((resolve) => setTimeout(resolve, 100));
  proc.stdout.end();

  await promise;

  // Verify kill was called
  assert.ok(proc.kill.mock.callCount() >= 1);
  assert.equal(proc.kill.mock.calls[0].arguments[0], 'SIGTERM');
});

test('spawnCli kills process on abort signal', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const controller = new AbortController();

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [], signal: controller.signal },
    { spawnFn }
  ));

  // Write one event then abort
  proc.stdout.write('{"type":"first"}\n');
  controller.abort();

  // Close stdout after abort
  await new Promise((resolve) => setTimeout(resolve, 50));
  proc.stdout.end();

  const results = await promise;

  // Should have the first event
  assert.ok(results.length >= 1);
  assert.deepEqual(results[0], { type: 'first' });

  // Verify kill was called
  assert.ok(proc.kill.mock.callCount() >= 1);
});

test('spawnCli cleans up on consumer break (early return)', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  // Write data before iterating so the loop has something to break on
  proc.stdout.write('{"type":"first"}\n');
  proc.stdout.write('{"type":"second"}\n');

  const results = [];
  for await (const event of spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  )) {
    results.push(event);
    if (results.length === 1) break; // Consumer stops early
  }

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], { type: 'first' });

  // Verify kill was called (cleanup via finally)
  assert.ok(proc.kill.mock.callCount() >= 1);
});

test('spawnCli passes cwd and env to spawn', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    {
      command: 'claude',
      args: ['-p', 'hello'],
      cwd: '/some/project',
      env: { CUSTOM_VAR: 'value' },
    },
    { spawnFn }
  ));

  proc.stdout.end();
  await promise;

  const spawnCall = spawnFn.mock.calls[0];
  assert.equal(spawnCall.arguments[0], 'claude');
  assert.deepEqual(spawnCall.arguments[1], ['-p', 'hello']);
  assert.equal(spawnCall.arguments[2].cwd, '/some/project');
  assert.equal(spawnCall.arguments[2].env.CUSTOM_VAR, 'value');
});

test('spawnCli handles already-aborted signal', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const controller = new AbortController();
  controller.abort(); // Already aborted

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [], signal: controller.signal },
    { spawnFn }
  ));

  proc.stdout.end();
  await promise;

  // Verify kill was called immediately
  assert.ok(proc.kill.mock.callCount() >= 1);
});

test('spawnCli handles empty stdout', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  ));

  proc.stdout.end();
  const results = await promise;

  assert.equal(results.length, 0);
});
