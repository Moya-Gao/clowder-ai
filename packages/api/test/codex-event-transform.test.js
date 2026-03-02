/**
 * codex-event-transform pure function tests
 * F045: NDJSON 可观测性 — Codex parser 补全
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { transformCodexEvent } = await import(
  '../dist/domains/cats/services/agents/providers/codex-event-transform.js'
);

const CAT = 'codex';

// ── Existing behaviour (regression guard) ──

test('thread.started → session_init', () => {
  const msg = transformCodexEvent(
    { type: 'thread.started', thread_id: 'th-1' },
    CAT,
  );
  assert.equal(msg?.type, 'session_init');
  assert.equal(msg?.sessionId, 'th-1');
});

test('item.completed agent_message → text', () => {
  const msg = transformCodexEvent(
    { type: 'item.completed', item: { type: 'agent_message', text: 'Hello' } },
    CAT,
  );
  assert.equal(msg?.type, 'text');
  assert.equal(msg?.content, 'Hello');
});

test('item.started command_execution → tool_use', () => {
  const msg = transformCodexEvent(
    { type: 'item.started', item: { type: 'command_execution', command: 'ls -la' } },
    CAT,
  );
  assert.equal(msg?.type, 'tool_use');
  assert.equal(msg?.toolName, 'command_execution');
  assert.deepEqual(msg?.toolInput, { command: 'ls -la' });
});

test('item.completed command_execution → tool_result', () => {
  const msg = transformCodexEvent(
    {
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: 'ls',
        status: 'completed',
        exit_code: 0,
        aggregated_output: 'file.txt',
      },
    },
    CAT,
  );
  assert.equal(msg?.type, 'tool_result');
  assert.ok(msg?.content?.includes('file.txt'));
});

test('item.completed file_change → tool_use', () => {
  const msg = transformCodexEvent(
    {
      type: 'item.completed',
      item: { type: 'file_change', status: 'completed', changes: ['a', 'b'] },
    },
    CAT,
  );
  assert.equal(msg?.type, 'tool_use');
  assert.equal(msg?.toolName, 'file_change');
});

test('Reconnecting error → system_info', () => {
  const msg = transformCodexEvent(
    { type: 'error', message: 'Reconnecting... (attempt 1)' },
    CAT,
  );
  assert.equal(msg?.type, 'system_info');
  assert.ok(msg?.content?.startsWith('Reconnecting...'));
});

test('unknown event type → null', () => {
  assert.equal(transformCodexEvent({ type: 'turn.started' }, CAT), null);
});

// ── F045: todo_list → system_info(task_progress) ──

test('item.started todo_list → system_info(task_progress) with initial tasks', () => {
  const event = {
    type: 'item.started',
    item: {
      type: 'todo_list',
      todo_items: [
        { id: 't1', content: 'Read the file', status: 'in_progress' },
        { id: 't2', content: 'Write the test', status: 'pending' },
      ],
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'task_progress');
  assert.equal(payload.tasks.length, 2);
  assert.equal(payload.tasks[0].subject, 'Read the file');
  assert.equal(payload.tasks[0].status, 'in_progress');
});

test('item.started todo_list (new schema: items/text/completed) → system_info(task_progress)', () => {
  const event = {
    type: 'item.started',
    item: {
      type: 'todo_list',
      items: [
        { text: 'Todo 1: Verify todo workflow', completed: false },
        { text: 'Todo 2: Leave as pending sample', completed: true },
      ],
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'task_progress');
  assert.equal(payload.tasks.length, 2);
  assert.equal(payload.tasks[0].subject, 'Todo 1: Verify todo workflow');
  assert.equal(payload.tasks[0].status, 'pending');
  assert.equal(payload.tasks[1].subject, 'Todo 2: Leave as pending sample');
  assert.equal(payload.tasks[1].status, 'completed');
});

test('item.updated todo_list → system_info(task_progress) with updated tasks', () => {
  const event = {
    type: 'item.updated',
    item: {
      type: 'todo_list',
      todo_items: [
        { id: 't1', content: 'Read the file', status: 'completed' },
        { id: 't2', content: 'Write the test', status: 'in_progress' },
      ],
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'task_progress');
  assert.equal(payload.tasks[0].status, 'completed');
  assert.equal(payload.tasks[1].status, 'in_progress');
});

test('item.completed todo_list → system_info(task_progress) all done', () => {
  const event = {
    type: 'item.completed',
    item: {
      type: 'todo_list',
      todo_items: [
        { id: 't1', content: 'Read the file', status: 'completed' },
        { id: 't2', content: 'Write the test', status: 'completed' },
      ],
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.tasks.every(t => t.status === 'completed'), true);
});

test('todo_list with empty items → system_info with tasks:[] (clears UI)', () => {
  const event = {
    type: 'item.started',
    item: { type: 'todo_list', todo_items: [] },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.ok(msg !== null, 'empty todo_list should emit snapshot to clear UI');
  assert.equal(msg.type, 'system_info');
  const payload = JSON.parse(msg.content);
  assert.equal(payload.type, 'task_progress');
  assert.deepEqual(payload.tasks, []);
});

// ── F045: reasoning → system_info(thinking) ──

test('item.completed reasoning → system_info(thinking)', () => {
  const event = {
    type: 'item.completed',
    item: {
      type: 'reasoning',
      text: 'Let me think about this...\nThe user wants X.',
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'thinking');
  assert.equal(payload.text, 'Let me think about this...\nThe user wants X.');
});

test('reasoning with empty text → null', () => {
  const event = {
    type: 'item.completed',
    item: { type: 'reasoning', text: '' },
  };
  assert.equal(transformCodexEvent(event, CAT), null);
});

// ── F045: mcp_tool_call → tool_use/tool_result ──

test('item.started mcp_tool_call → tool_use', () => {
  const event = {
    type: 'item.started',
    item: {
      type: 'mcp_tool_call',
      server: 'cat-cafe',
      tool: 'post_message',
      arguments: { text: 'hello' },
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'tool_use');
  assert.equal(msg?.toolName, 'mcp:cat-cafe/post_message');
  assert.deepEqual(msg?.toolInput, { text: 'hello' });
});

test('item.completed mcp_tool_call → tool_result', () => {
  const event = {
    type: 'item.completed',
    item: {
      type: 'mcp_tool_call',
      server: 'cat-cafe',
      tool: 'post_message',
      status: 'completed',
      result: { content: [{ type: 'text', text: 'ok' }] },
    },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'tool_result');
  assert.ok(msg?.content?.includes('mcp:cat-cafe/post_message'));
});

// ── F045: web_search → system_info(web_search) ──

test('item.completed web_search → system_info(web_search)', () => {
  const event = {
    type: 'item.completed',
    item: { type: 'web_search', query: 'Node.js streams' },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'web_search');
  // query should NOT be stored (privacy)
  assert.equal(payload.query, undefined);
  assert.equal(payload.count, 1);
});

// ── F045: item-level error → system_info(warning) ──

test('item.completed error → system_info(warning)', () => {
  const event = {
    type: 'item.completed',
    item: { type: 'error', message: 'command output truncated' },
  };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'warning');
  assert.equal(payload.message, 'command output truncated');
});

// ── F045: top-level error (non-Reconnecting) → null ──
// Non-Reconnecting errors return null from the transform.
// CodexAgentService collects them via collectCodexStreamError() and surfaces
// them as diagnostics in the exit error (withRecentDiagnostics).

test('top-level error without Reconnecting → null (handled by service)', () => {
  const event = { type: 'error', message: 'Fatal: connection lost' };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg, null);
});
