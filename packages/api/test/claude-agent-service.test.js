/**
 * ClaudeAgentService Tests (CLI mode)
 * 测试布偶猫 CLI 子进程调用
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';

const { ClaudeAgentService } = await import(
  '../dist/domains/cats/services/ClaudeAgentService.js'
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
function emitClaudeEvents(proc, events) {
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
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('Hello'));

  emitClaudeEvents(proc, [
    { type: 'system', subtype: 'init', session_id: 'sess-abc' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi!' }] } },
    { type: 'result', subtype: 'success', session_id: 'sess-abc' },
  ]);

  const msgs = await promise;

  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].type, 'session_init');
  assert.equal(msgs[0].sessionId, 'sess-abc');
  assert.equal(msgs[1].type, 'text');
  assert.equal(msgs[1].content, 'Hi!');
  assert.equal(msgs[2].type, 'done');
});

test('handles tool_use content blocks', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('read file'));

  emitClaudeEvents(proc, [
    { type: 'system', subtype: 'init', session_id: 's1' },
    {
      type: 'assistant',
      message: {
        content: [{
          type: 'tool_use',
          name: 'Read',
          input: { file_path: '/foo.ts' },
        }],
      },
    },
    { type: 'result', subtype: 'success' },
  ]);

  const msgs = await promise;

  const toolMsg = msgs.find((m) => m.type === 'tool_use');
  assert.ok(toolMsg);
  assert.equal(toolMsg.toolName, 'Read');
  assert.deepEqual(toolMsg.toolInput, { file_path: '/foo.ts' });
});

test('handles mixed text and tool_use in single assistant message', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('do stuff'));

  emitClaudeEvents(proc, [
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me read that.' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' } },
          { type: 'text', text: 'Done reading.' },
        ],
      },
    },
    { type: 'result', subtype: 'success' },
  ]);

  const msgs = await promise;
  // 3 content messages + 1 done
  const contentMsgs = msgs.filter((m) => m.type !== 'done');
  assert.equal(contentMsgs.length, 3);
  assert.equal(contentMsgs[0].type, 'text');
  assert.equal(contentMsgs[0].content, 'Let me read that.');
  assert.equal(contentMsgs[1].type, 'tool_use');
  assert.equal(contentMsgs[1].toolName, 'Read');
  assert.equal(contentMsgs[2].type, 'text');
  assert.equal(contentMsgs[2].content, 'Done reading.');
});

test('passes --resume flag when sessionId is provided', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('continue', { sessionId: 'resume-123' }));
  emitClaudeEvents(proc, [{ type: 'result', subtype: 'success' }]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  assert.ok(args.includes('--resume'));
  assert.ok(args.includes('resume-123'));
});

test('does not include --resume when no sessionId', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('hello'));
  emitClaudeEvents(proc, [{ type: 'result', subtype: 'success' }]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  assert.ok(!args.includes('--resume'));
});

test('passes cwd from workingDirectory option', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(
    service.invoke('hi', { workingDirectory: '/my/project' })
  );
  emitClaudeEvents(proc, [{ type: 'result', subtype: 'success' }]);
  await promise;

  const spawnOpts = spawnFn.mock.calls[0].arguments[2];
  assert.equal(spawnOpts.cwd, '/my/project');
});

test('yields error on result/error event', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('bad'));

  emitClaudeEvents(proc, [
    { type: 'result', subtype: 'error', errors: ['rate limited', 'try again'] },
  ]);

  const msgs = await promise;
  const errMsg = msgs.find((m) => m.type === 'error');
  assert.ok(errMsg);
  assert.equal(errMsg.error, 'rate limited; try again');
});

test('yields error on CLI non-zero exit', async () => {
  const proc = createMockProcess();
  // Override kill to not auto-exit (we control exit manually)
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

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

test('does not duplicate error when result/error is followed by non-zero exit', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('bad'));

  proc.stdout.write(
    `${JSON.stringify({
      type: 'result',
      subtype: 'error_during_execution',
      errors: ['rate limited'],
    })}\n`
  );
  proc.stderr.write('rate limited\n');
  proc.stdout.end();
  proc._emitter.emit('exit', 1, null);

  const msgs = await promise;
  const errors = msgs.filter((m) => m.type === 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].error, 'rate limited');
});

test('includes exit signal in CLI error message when no exit code', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('crash'));

  proc.stderr.write('killed by supervisor\n');
  proc.stdout.end();
  proc._emitter.emit('exit', null, 'SIGKILL');

  const msgs = await promise;
  const errMsg = msgs.find((m) => m.type === 'error');
  assert.ok(errMsg);
  assert.ok(errMsg.error.includes('signal SIGKILL'));
  assert.ok(errMsg.error.includes('killed by supervisor'));
});

test('yields error on spawn ENOENT', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('hi'));

  process.nextTick(() => {
    const err = new Error('spawn claude ENOENT');
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

test('ignores system/hook and unknown event types', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('test'));

  emitClaudeEvents(proc, [
    { type: 'system', subtype: 'hook', hookId: 'h1' },
    { type: 'system', subtype: 'init', session_id: 'sid' },
    { type: 'unknown_type', data: 'something' },
    { type: 'result', subtype: 'success' },
  ]);

  const msgs = await promise;
  // Only session_init + done (hook and unknown skipped)
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].type, 'session_init');
  assert.equal(msgs[1].type, 'done');
});

test('all messages have catId opus', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new ClaudeAgentService({ spawnFn });

  const promise = collect(service.invoke('check'));

  emitClaudeEvents(proc, [
    { type: 'system', subtype: 'init', session_id: 's1' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } },
    { type: 'result', subtype: 'success' },
  ]);

  const msgs = await promise;
  for (const msg of msgs) {
    assert.equal(msg.catId, 'opus', `expected catId opus, got ${msg.catId}`);
  }
});

test('passes correct model flag (default and custom)', async () => {
  // Default model
  const proc1 = createMockProcess();
  const spawnFn1 = createMockSpawnFn(proc1);
  const service1 = new ClaudeAgentService({ spawnFn: spawnFn1 });

  const p1 = collect(service1.invoke('hi'));
  emitClaudeEvents(proc1, [{ type: 'result', subtype: 'success' }]);
  await p1;

  const args1 = spawnFn1.mock.calls[0].arguments[1];
  const modelIdx1 = args1.indexOf('--model');
  assert.ok(modelIdx1 >= 0);
  // Default should follow cat-config.json (Phase 4.0 config system)
  assert.equal(args1[modelIdx1 + 1], 'claude-opus-4-6');

  // Custom model
  const proc2 = createMockProcess();
  const spawnFn2 = createMockSpawnFn(proc2);
  const service2 = new ClaudeAgentService({ spawnFn: spawnFn2, model: 'haiku' });

  const p2 = collect(service2.invoke('hi'));
  emitClaudeEvents(proc2, [{ type: 'result', subtype: 'success' }]);
  await p2;

  const args2 = spawnFn2.mock.calls[0].arguments[1];
  const modelIdx2 = args2.indexOf('--model');
  assert.equal(args2[modelIdx2 + 1], 'haiku');
});
