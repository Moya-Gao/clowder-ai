/**
 * CodexAgentService Tests (CLI mode)
 * 测试缅因猫 CLI 子进程调用
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

const { CodexAgentService } = await import(
  '../dist/domains/cats/services/CodexAgentService.js'
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
 * Create a mock child process for testing.
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

/** Create a mock SpawnFn */
function createMockSpawnFn(proc) {
  return mock.fn(() => proc);
}

/** Write NDJSON events to mock process stdout, then end with exit 0 */
function emitCodexEvents(proc, events) {
  for (const event of events) {
    proc.stdout.write(JSON.stringify(event) + '\n');
  }
  proc.stdout.end();
  proc._emitter.emit('exit', 0, null);
}

// --- Test cases ---

test('yields session_init, text, and done on basic success', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('Hello'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-abc' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Hello from Codex!' },
    },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20 } },
  ]);

  const msgs = await promise;

  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].type, 'session_init');
  assert.equal(msgs[0].sessionId, 'thread-abc');
  assert.equal(msgs[0].catId, 'codex');
  assert.equal(msgs[1].type, 'text');
  assert.equal(msgs[1].content, 'Hello from Codex!');
  assert.equal(msgs[2].type, 'done');
});

test('uses exec resume when sessionId is provided', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(
    service.invoke('Continue', { sessionId: 'existing-thread-456' })
  );
  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'existing-thread-456' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Resumed' },
    },
  ]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  assert.equal(args[0], 'exec');
  assert.equal(args[1], 'resume');
  assert.equal(args[2], 'existing-thread-456');
  assert.equal(args[3], 'Continue');
  // resume 子命令不接受 --sandbox（sandbox 在创建时已锁定）
  assert.ok(!args.includes('--sandbox'), 'resume args must not include --sandbox');
  assert.ok(args.includes('--json'), 'resume args must include --json');
  assert.ok(args.includes('--full-auto'), 'resume args must include --full-auto');
});

test('does not include resume when no sessionId', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('hello'));
  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 't1' },
  ]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  assert.equal(args[0], 'exec');
  assert.equal(args[1], '--json');
  assert.ok(!args.includes('resume'));
});

test('handles multiple agent_message items', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('Multi'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-multi' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'First message' },
    },
    {
      type: 'item.completed',
      item: { id: 'msg-2', type: 'agent_message', text: 'Second message' },
    },
  ]);

  const msgs = await promise;
  const textMsgs = msgs.filter((m) => m.type === 'text');
  assert.equal(textMsgs.length, 2);
  assert.equal(textMsgs[0].content, 'First message');
  assert.equal(textMsgs[1].content, 'Second message');
});

test('ignores command_execution and file_change items', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('With tools'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-tools' },
    {
      type: 'item.completed',
      item: { id: 'cmd-1', type: 'command_execution', command: 'ls', aggregated_output: '', status: 'completed' },
    },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Response' },
    },
    {
      type: 'item.completed',
      item: { id: 'file-1', type: 'file_change', changes: [], status: 'completed' },
    },
  ]);

  const msgs = await promise;
  const textMsgs = msgs.filter((m) => m.type === 'text');
  assert.equal(textMsgs.length, 1);
  assert.equal(textMsgs[0].content, 'Response');
});

test('yields error on CLI non-zero exit', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('crash'));

  proc.stderr.write('Error: authentication failed\n');
  proc.stdout.end();
  proc._emitter.emit('exit', 1, null);

  const msgs = await promise;
  const errMsg = msgs.find((m) => m.type === 'error');
  assert.ok(errMsg);
  // Error message is sanitized — contains exit code but not raw stderr
  assert.ok(errMsg.error.includes('code: 1'));
  // Raw stderr should NOT be exposed to users
  assert.ok(!errMsg.error.includes('authentication failed'), 'stderr should be sanitized');
});

test('yields error on spawn ENOENT', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('hi'));

  process.nextTick(() => {
    const err = new Error('spawn codex ENOENT');
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

test('passes cwd from workingDirectory option', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(
    service.invoke('hi', { workingDirectory: '/my/project' })
  );
  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 't1' },
  ]);
  await promise;

  const spawnOpts = spawnFn.mock.calls[0].arguments[2];
  assert.equal(spawnOpts.cwd, '/my/project');
});

test('all messages have catId codex', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('check'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-catid' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Test' },
    },
  ]);

  const msgs = await promise;
  for (const msg of msgs) {
    assert.equal(msg.catId, 'codex', `expected catId codex for ${msg.type} message`);
  }
});

test('ignores turn.started and turn.completed control events', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('test'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-ctrl' },
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'msg-1', type: 'agent_message' } },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'Hello' },
    },
    { type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 10 } },
    { type: 'unknown_event', data: 'something' },
  ]);

  const msgs = await promise;
  // Only session_init, text, done — all control/unknown events skipped
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].type, 'session_init');
  assert.equal(msgs[1].type, 'text');
  assert.equal(msgs[1].content, 'Hello');
  assert.equal(msgs[2].type, 'done');
});
