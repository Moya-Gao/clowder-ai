/**
 * CLI Spawn Tests
 * 测试 CLI 子进程管理器
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

const { spawnCli, isCliError, KILL_GRACE_MS } = await import('../dist/utils/cli-spawn.js');

/** Helper: collect all items from async iterable */
async function collect(iterable) {
  const items = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Create a mock child process for testing.
 * @param {{ exitOnKill?: boolean, exitCode?: number }} opts
 *   exitOnKill: if true (default), killing closes stdout and emits exit.
 *   exitCode: the code to emit on exit (default null for signal kills).
 */
function createMockProcess(opts = {}) {
  const { exitOnKill = true, exitCode = null } = opts;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const proc = {
    stdout,
    stderr,
    pid: 12345,
    exitCode: null,
    kill: mock.fn((signal) => {
      if (exitOnKill) {
        process.nextTick(() => {
          if (!stdout.destroyed) stdout.end();
          emitter.emit('exit', exitCode, signal || 'SIGTERM');
        });
      }
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
    // Expose emitter for manual event emission in tests
    _emitter: emitter,
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
  // Emit clean exit
  proc._emitter.emit('exit', 0, null);

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
  proc._emitter.emit('exit', 0, null);

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
  proc._emitter.emit('exit', 0, null);

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
  proc._emitter.emit('exit', 0, null);
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
  proc._emitter.emit('exit', 0, null);
  const results = await promise;

  assert.equal(results.length, 0);
});

// === New tests for 缅因猫 review findings ===

test('spawnCli yields __cliError on non-zero exit code with stderr', async () => {
  const proc = createMockProcess({ exitOnKill: false });
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  ));

  proc.stdout.write('{"type":"partial"}\n');
  proc.stderr.write('Error: something went wrong\n');
  proc.stdout.end();
  // Emit non-zero exit
  proc._emitter.emit('exit', 1, null);

  const results = await promise;

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], { type: 'partial' });

  // Second result should be the CLI error
  assert.equal(isCliError(results[1]), true);
  assert.equal(results[1].exitCode, 1);
  assert.equal(results[1].command, 'test-cli');
  assert.ok(results[1].stderr.includes('something went wrong'));
});

test('spawnCli yields __cliError when killed by external signal', async () => {
  const proc = createMockProcess({ exitOnKill: false });
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [] },
    { spawnFn }
  ));

  proc.stderr.write('Killed by OOM\n');
  proc.stdout.end();
  // External signal kill: exitCode=null, signal=SIGKILL
  proc._emitter.emit('exit', null, 'SIGKILL');

  const results = await promise;

  assert.equal(results.length, 1);
  assert.equal(isCliError(results[0]), true);
  assert.equal(results[0].exitCode, null);
  assert.equal(results[0].signal, 'SIGKILL');
  assert.equal(results[0].command, 'test-cli');
  assert.ok(results[0].stderr.includes('Killed by OOM'));
});

test('spawnCli does NOT yield __cliError when WE killed the process', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'test-cli', args: [], timeoutMs: 50 },
    { spawnFn }
  ));

  // Let timeout fire and kill the process
  await new Promise((resolve) => setTimeout(resolve, 100));
  proc.stdout.end();

  const results = await promise;

  // Should NOT contain a __cliError (we killed it, exit code is expected)
  const hasCliError = results.some((r) => isCliError(r));
  assert.equal(hasCliError, false);
});

test('isCliError type guard works correctly', () => {
  assert.equal(isCliError({ __cliError: true, exitCode: 1, stderr: 'err', command: 'x' }), true);
  assert.equal(isCliError({ __cliError: false }), false);
  assert.equal(isCliError({ type: 'message' }), false);
  assert.equal(isCliError(null), false);
  assert.equal(isCliError('string'), false);
});

test('spawnCli escalates SIGTERM to SIGKILL after grace period', async () => {
  // Create a stubborn process that does NOT exit on SIGTERM
  const proc = createMockProcess({ exitOnKill: false });
  const spawnFn = createMockSpawnFn(proc);

  const promise = collect(spawnCli(
    { command: 'stubborn-cli', args: [], timeoutMs: 50 },
    { spawnFn }
  ));

  // Wait for timeout to fire SIGTERM
  await new Promise((resolve) => setTimeout(resolve, 100));

  // First kill should be SIGTERM
  assert.ok(proc.kill.mock.callCount() >= 1);
  assert.equal(proc.kill.mock.calls[0].arguments[0], 'SIGTERM');

  // Wait for KILL_GRACE_MS to elapse for escalation
  await new Promise((resolve) => setTimeout(resolve, KILL_GRACE_MS + 100));

  // Should have escalated to SIGKILL
  const killCalls = proc.kill.mock.calls;
  const signals = killCalls.map((c) => c.arguments[0]);
  assert.ok(signals.includes('SIGKILL'), `Expected SIGKILL in signals: ${signals}`);

  // Now actually exit the process so the generator resolves
  proc.stdout.end();
  proc._emitter.emit('exit', null, 'SIGKILL');

  await promise;
});

test('spawnCli handles spawn error (e.g. command not found)', async () => {
  const proc = createMockProcess({ exitOnKill: false });
  const spawnFn = createMockSpawnFn(proc);

  const gen = spawnCli(
    { command: 'nonexistent-command', args: [] },
    { spawnFn }
  );

  // Emit error before any stdout data
  process.nextTick(() => {
    const err = new Error('spawn nonexistent-command ENOENT');
    err.code = 'ENOENT';
    proc._emitter.emit('error', err);
    proc.stdout.end();
    proc._emitter.emit('exit', null, null);
  });

  await assert.rejects(
    async () => { for await (const _ of gen) { /* consume */ } },
    (err) => {
      assert.ok(err.message.includes('ENOENT'));
      return true;
    }
  );
});
