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
  assert.equal(args.at(-1), 'Continue');
  // resume 子命令不接受 --sandbox（sandbox 在创建时已锁定）
  assert.ok(!args.includes('--sandbox'), 'resume args must not include --sandbox');
  assert.ok(args.includes('--json'), 'resume args must include --json');
  assert.ok(args.includes('--config'), 'resume args must include approval policy override');
  assert.ok(args.includes('approval_policy=\"on-request\"'), 'default approval policy should be on-request');
  assert.ok(!args.includes('approval_policy=\\\"on-request\\\"'), 'argv should not contain literal backslash escapes');
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
  assert.ok(args.includes('--sandbox'), 'fresh exec should include sandbox mode');
  assert.ok(args.includes('danger-full-access'), 'default sandbox should allow git writes');
  assert.ok(args.includes('approval_policy=\"on-request\"'), 'fresh exec should set default approval policy');
  assert.ok(!args.includes('approval_policy=\\\"on-request\\\"'), 'argv should not contain literal backslash escapes');
});

test('uses env-configured sandbox and approval policy for fresh exec', async () => {
  const oldSandbox = process.env.CAT_CODEX_SANDBOX_MODE;
  const oldApproval = process.env.CAT_CODEX_APPROVAL_POLICY;
  process.env.CAT_CODEX_SANDBOX_MODE = 'read-only';
  process.env.CAT_CODEX_APPROVAL_POLICY = 'never';

  try {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new CodexAgentService({ spawnFn });

    const promise = collect(service.invoke('configurable'));
    emitCodexEvents(proc, [
      { type: 'thread.started', thread_id: 'thread-config' },
    ]);
    await promise;

    const args = spawnFn.mock.calls[0].arguments[1];
    assert.ok(args.includes('--sandbox'), 'sandbox flag should be present');
    assert.ok(args.includes('read-only'), 'sandbox should follow CAT_CODEX_SANDBOX_MODE');
    assert.ok(args.includes('--config'), 'approval policy should be set by config override');
    assert.ok(args.includes('approval_policy=\"never\"'), 'approval policy should follow env');
  } finally {
    if (oldSandbox === undefined) {
      delete process.env.CAT_CODEX_SANDBOX_MODE;
    } else {
      process.env.CAT_CODEX_SANDBOX_MODE = oldSandbox;
    }
    if (oldApproval === undefined) {
      delete process.env.CAT_CODEX_APPROVAL_POLICY;
    } else {
      process.env.CAT_CODEX_APPROVAL_POLICY = oldApproval;
    }
  }
});

test('falls back to defaults for invalid sandbox/approval env values', async () => {
  const oldSandbox = process.env.CAT_CODEX_SANDBOX_MODE;
  const oldApproval = process.env.CAT_CODEX_APPROVAL_POLICY;
  process.env.CAT_CODEX_SANDBOX_MODE = 'not-a-mode';
  process.env.CAT_CODEX_APPROVAL_POLICY = 'not-a-policy';

  try {
    const proc = createMockProcess();
    const spawnFn = createMockSpawnFn(proc);
    const service = new CodexAgentService({ spawnFn });

    const promise = collect(service.invoke('fallback'));
    emitCodexEvents(proc, [{ type: 'thread.started', thread_id: 'thread-fallback' }]);
    await promise;

    const args = spawnFn.mock.calls[0].arguments[1];
    assert.ok(args.includes('danger-full-access'), 'invalid sandbox should fallback to default');
    assert.ok(args.includes('approval_policy=\"on-request\"'), 'invalid policy should fallback to default');
  } finally {
    if (oldSandbox === undefined) {
      delete process.env.CAT_CODEX_SANDBOX_MODE;
    } else {
      process.env.CAT_CODEX_SANDBOX_MODE = oldSandbox;
    }
    if (oldApproval === undefined) {
      delete process.env.CAT_CODEX_APPROVAL_POLICY;
    } else {
      process.env.CAT_CODEX_APPROVAL_POLICY = oldApproval;
    }
  }
});

test('new session includes --add-dir .git for git write access', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('hello'));
  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 't1' },
  ]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  const addDirIdx = args.indexOf('--add-dir');
  assert.ok(addDirIdx >= 0, 'new session args must include --add-dir');
  assert.equal(args[addDirIdx + 1], '.git', '--add-dir must be followed by .git');
  assert.ok(args.includes('--sandbox'), 'new session must still include --sandbox');
});

test('resume session does NOT include --add-dir (sandbox locked at creation)', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(
    service.invoke('Continue', { sessionId: 'old-session-123' })
  );
  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'old-session-123' },
  ]);
  await promise;

  const args = spawnFn.mock.calls[0].arguments[1];
  assert.ok(!args.includes('--add-dir'), 'resume args must not include --add-dir');
  assert.ok(!args.includes('--sandbox'), 'resume args must not include --sandbox');
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

test('maps command_execution and file_change items into tool events', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('With tools'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-tools' },
    {
      type: 'item.started',
      item: { id: 'cmd-1', type: 'command_execution', command: 'ls', status: 'in_progress' },
    },
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
  const toolUseMsgs = msgs.filter((m) => m.type === 'tool_use');
  const toolResultMsgs = msgs.filter((m) => m.type === 'tool_result');

  assert.equal(textMsgs.length, 1);
  assert.equal(textMsgs[0].content, 'Response');
  assert.equal(toolUseMsgs.length, 2);
  assert.equal(toolResultMsgs.length, 1);
  assert.equal(toolUseMsgs[0].toolName, 'command_execution');
  assert.equal(toolUseMsgs[1].toolName, 'file_change');
  assert.match(toolResultMsgs[0].content, /command: ls/);
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

test('includes reconnect diagnostics in CLI exit error when available', async () => {
  const proc = createMockProcess();
  proc.kill = mock.fn(() => true);
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('reconnect failure'));

  proc.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: 'thread-reconnect' }) + '\n');
  proc.stdout.write(JSON.stringify({
    type: 'error',
    message: 'Reconnecting... 1/5 (stream disconnected before completion)',
  }) + '\n');
  proc.stdout.write(JSON.stringify({
    type: 'error',
    message: 'Reconnecting... 2/5 (stream disconnected before completion)',
  }) + '\n');
  proc.stdout.write(JSON.stringify({
    type: 'error',
    message: 'stream disconnected before completion',
  }) + '\n');
  proc.stdout.end();
  proc._emitter.emit('exit', 1, null);

  const msgs = await promise;
  const sysInfos = msgs.filter((m) => m.type === 'system_info');
  assert.equal(sysInfos.length, 2, 'should stream reconnect status to UI in real time');
  assert.ok(sysInfos[0].content.includes('Reconnecting... 1/5'));
  assert.ok(sysInfos[1].content.includes('Reconnecting... 2/5'));

  const errMsg = msgs.find((m) => m.type === 'error');
  assert.ok(errMsg);
  assert.ok(errMsg.error.includes('code: 1'));
  assert.ok(
    errMsg.error.includes('Reconnecting... 1/5'),
    'error should include reconnect diagnostics'
  );
  assert.ok(
    errMsg.error.includes('Reconnecting... 2/5'),
    'error should include multiple reconnect attempts'
  );
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

test('oauth mode (default) does not forward OPENAI_API_KEY to codex child env', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const originalApiKey = process.env['OPENAI_API_KEY'];
  const originalAuthMode = process.env['CODEX_AUTH_MODE'];
  try {
    process.env['OPENAI_API_KEY'] = 'sk-test-forwarded-key';
    delete process.env['CODEX_AUTH_MODE']; // default = oauth

    const promise = collect(service.invoke('oauth test'));
    emitCodexEvents(proc, [{ type: 'thread.started', thread_id: 'oauth-thread' }]);
    await promise;

    const spawnOpts = spawnFn.mock.calls[0].arguments[2];
    assert.equal(spawnOpts.env.OPENAI_API_KEY, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(spawnOpts.env, 'OPENAI_API_KEY'), false);
  } finally {
    if (originalApiKey === undefined) delete process.env['OPENAI_API_KEY'];
    else process.env['OPENAI_API_KEY'] = originalApiKey;
    if (originalAuthMode === undefined) delete process.env['CODEX_AUTH_MODE'];
    else process.env['CODEX_AUTH_MODE'] = originalAuthMode;
  }
});

test('api_key mode keeps OPENAI_API_KEY for codex child env', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const originalApiKey = process.env['OPENAI_API_KEY'];
  const originalAuthMode = process.env['CODEX_AUTH_MODE'];
  try {
    process.env['OPENAI_API_KEY'] = 'sk-test-api-mode';
    process.env['CODEX_AUTH_MODE'] = 'api_key';

    const promise = collect(service.invoke('api-key test'));
    emitCodexEvents(proc, [{ type: 'thread.started', thread_id: 'api-key-thread' }]);
    await promise;

    const spawnOpts = spawnFn.mock.calls[0].arguments[2];
    assert.equal(spawnOpts.env.OPENAI_API_KEY, 'sk-test-api-mode');
  } finally {
    if (originalApiKey === undefined) delete process.env['OPENAI_API_KEY'];
    else process.env['OPENAI_API_KEY'] = originalApiKey;
    if (originalAuthMode === undefined) delete process.env['CODEX_AUTH_MODE'];
    else process.env['CODEX_AUTH_MODE'] = originalAuthMode;
  }
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

test('maps command execution lifecycle into tool_use and tool_result', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const service = new CodexAgentService({ spawnFn });

  const promise = collect(service.invoke('run tool'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-tool-lifecycle' },
    {
      type: 'item.started',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        status: 'in_progress',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        aggregated_output: '/Users/lysander/projects/relay-station/cat-cafe\n',
        exit_code: 0,
        status: 'completed',
      },
    },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'done' },
    },
  ]);

  const msgs = await promise;
  const toolUse = msgs.find((m) => m.type === 'tool_use');
  const toolResult = msgs.find((m) => m.type === 'tool_result');

  assert.ok(toolUse, 'should emit tool_use for command_execution start');
  assert.equal(toolUse.toolName, 'command_execution');
  assert.equal(toolUse.toolInput.command, '/bin/zsh -lc pwd');

  assert.ok(toolResult, 'should emit tool_result for command_execution completion');
  assert.match(toolResult.content, /\/Users\/lysander\/projects\/relay-station\/cat-cafe/);
  assert.match(toolResult.content, /exit_code:\s*0/);
});

test('writes CLI tool lifecycle audit events when auditContext is provided', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const auditLog = { append: mock.fn(async () => ({ id: 'evt-1' })) };
  const rawArchive = { append: mock.fn(async () => {}) };
  const service = new CodexAgentService({ spawnFn, auditLog, rawArchive });

  const promise = collect(service.invoke('run tool', {
    auditContext: {
      invocationId: 'inv-1',
      threadId: 'thread-1',
      userId: 'user-1',
      catId: 'codex',
    },
  }));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-1' },
    {
      type: 'item.started',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        status: 'in_progress',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        aggregated_output: '/tmp\n',
        exit_code: 0,
        status: 'completed',
      },
    },
  ]);

  await promise;

  assert.equal(auditLog.append.mock.callCount(), 2);
  const started = auditLog.append.mock.calls[0].arguments[0];
  const completed = auditLog.append.mock.calls[1].arguments[0];

  assert.equal(started.type, 'cli_tool_started');
  assert.equal(started.threadId, 'thread-1');
  assert.equal(started.data.invocationId, 'inv-1');
  assert.equal(started.data.command, '/bin/zsh -lc pwd');

  assert.equal(completed.type, 'cli_tool_completed');
  assert.equal(completed.threadId, 'thread-1');
  assert.equal(completed.data.status, 'completed');
  assert.equal(completed.data.exitCode, 0);
});

test('archives raw stream events when auditContext is provided', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const auditLog = { append: mock.fn(async () => ({ id: 'evt-1' })) };
  const rawArchive = { append: mock.fn(async () => {}) };
  const service = new CodexAgentService({ spawnFn, auditLog, rawArchive });

  const promise = collect(service.invoke('raw trace', {
    auditContext: {
      invocationId: 'inv-raw-1',
      threadId: 'thread-raw-1',
      userId: 'user-1',
      catId: 'codex',
    },
  }));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-raw-1' },
    {
      type: 'item.completed',
      item: { id: 'msg-1', type: 'agent_message', text: 'hello' },
    },
  ]);

  await promise;

  assert.equal(rawArchive.append.mock.callCount(), 2);
  assert.equal(rawArchive.append.mock.calls[0].arguments[0], 'inv-raw-1');
  assert.equal(rawArchive.append.mock.calls[1].arguments[0], 'inv-raw-1');
});

test('does not write lifecycle audit or raw archive when auditContext is absent', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const auditLog = { append: mock.fn(async () => ({ id: 'evt-1' })) };
  const rawArchive = { append: mock.fn(async () => {}) };
  const service = new CodexAgentService({ spawnFn, auditLog, rawArchive });

  const promise = collect(service.invoke('no audit context'));

  emitCodexEvents(proc, [
    { type: 'thread.started', thread_id: 'thread-no-audit' },
    {
      type: 'item.started',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        status: 'in_progress',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc pwd',
        aggregated_output: '/tmp\n',
        exit_code: 0,
        status: 'completed',
      },
    },
  ]);

  await promise;

  assert.equal(auditLog.append.mock.callCount(), 0);
  assert.equal(rawArchive.append.mock.callCount(), 0);
});

test('redacts nested callback tokens before archiving raw events', async () => {
  const proc = createMockProcess();
  const spawnFn = createMockSpawnFn(proc);
  const auditLog = { append: mock.fn(async () => ({ id: 'evt-1' })) };
  const rawArchive = { append: mock.fn(async () => {}) };
  const service = new CodexAgentService({ spawnFn, auditLog, rawArchive });

  const promise = collect(service.invoke('deep redact', {
    auditContext: {
      invocationId: 'inv-redact-1',
      threadId: 'thread-redact-1',
      userId: 'user-1',
      catId: 'codex',
    },
  }));

  emitCodexEvents(proc, [
    {
      type: 'item.completed',
      callbackToken: 'root-secret',
      item: {
        id: 'msg-1',
        type: 'agent_message',
        text: 'hello',
        callbackEnv: {
          CAT_CAFE_CALLBACK_TOKEN: 'nested-secret',
        },
        nested: {
          callbackToken: 'deep-secret',
        },
      },
    },
  ]);

  await promise;

  assert.equal(rawArchive.append.mock.callCount(), 1);
  const archived = rawArchive.append.mock.calls[0].arguments[1];
  assert.equal(archived.callbackToken, '[redacted]');
  assert.equal(archived.item.callbackEnv.CAT_CAFE_CALLBACK_TOKEN, '[redacted]');
  assert.equal(archived.item.nested.callbackToken, '[redacted]');
});
