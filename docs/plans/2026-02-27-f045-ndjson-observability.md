# F045: NDJSON 可观测性 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rescue valuable CLI events from `return null` — Plan checklist for Codex, thinking fold for both cats, error subtype differentiation, and plan persistence across restarts.

**Architecture:** Pure function parser additions (no AgentMessageType changes). New events flow as `system_info` messages with typed JSON payloads. Frontend handles new subtypes in existing `useAgentMessages` hook. Plan persistence via backend snapshot in InvocationRecord.

**Tech Stack:** Node.js + TypeScript, node:test, React/Tailwind (frontend components)

**Priority:** Plan > Thinking > Error subtype > Other parser additions

**Worktree:** `/Users/lysander/projects/relay-station/cat-cafe-f045-ndjson-observability`
**Branch:** `feat/f045-ndjson-observability`
**Build:** `cd /Users/lysander/projects/relay-station/cat-cafe-f045-ndjson-observability && pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build`
**Test:** `cd /Users/lysander/projects/relay-station/cat-cafe-f045-ndjson-observability && pnpm --filter @cat-cafe/api test`

---

## Task 1: Codex `todo_list` → task_progress (Plan chain for Codex)

**Why first:** Plan is铲屎官's #1 priority. Codex cats (砚砚) currently have no plan visibility.

**Files:**
- Create: `packages/api/test/codex-event-transform.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts`

**Design Decision:** Codex `todo_list` events map to `system_info` messages with `task_progress` JSON payload (same format as Claude's TodoWrite detection in `invoke-single-cat.ts:489-500`). This reuses the existing frontend handler in `useAgentMessages.ts:388-397` with zero frontend changes.

**Step 1: Create codex-event-transform test file with todo_list fixtures**

Create `packages/api/test/codex-event-transform.test.js`:

```javascript
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

test('todo_list with empty items → null', () => {
  const event = {
    type: 'item.started',
    item: { type: 'todo_list', todo_items: [] },
  };
  assert.equal(transformCodexEvent(event, CAT), null);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f045-ndjson-observability
pnpm --filter @cat-cafe/api build && node --test packages/api/test/codex-event-transform.test.js
```

Expected: FAIL — todo_list tests return null

**Step 3: Implement todo_list handling in codex-event-transform.ts**

Add before the `if (e['type'] !== 'item.completed')` guard (line 68):

```typescript
// F045: todo_list → task_progress (reuses frontend F26 handler)
if (
  (e['type'] === 'item.started' || e['type'] === 'item.updated' || e['type'] === 'item.completed') &&
  (e['item'] as Record<string, unknown> | undefined)?.['type'] === 'todo_list'
) {
  const todoItem = e['item'] as Record<string, unknown>;
  const todoItems = Array.isArray(todoItem['todo_items']) ? todoItem['todo_items'] : [];
  if (todoItems.length === 0) return null;
  const tasks = (todoItems as Array<Record<string, unknown>>).map((t, i) => ({
    id: typeof t['id'] === 'string' ? t['id'] : `task-${i}`,
    subject: (typeof t['content'] === 'string' ? t['content'] : '').slice(0, 120),
    status: typeof t['status'] === 'string' ? t['status'] : 'pending',
  }));
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({ type: 'task_progress', catId, action: 'snapshot', tasks }),
    timestamp: Date.now(),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/codex-event-transform.test.js
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/api/test/codex-event-transform.test.js packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts
git commit -m "feat(F045): Codex todo_list → task_progress — 缅因猫计划可见 [宪宪/Opus-46🐾]

Why: Codex CLI 的 todo_list 事件现在变成 task_progress system_info,
     复用前端 F26 Plan Checklist 链路，砚砚终于有计划进度了"
```

---

## Task 2: Codex `reasoning` → thinking system_info

**Files:**
- Modify: `packages/api/test/codex-event-transform.test.js` (add tests)
- Modify: `packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts`

**Step 1: Add reasoning test fixtures**

Append to `codex-event-transform.test.js`:

```javascript
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
```

**Step 2: Run test — expect FAIL**

**Step 3: Add reasoning handling in codex-event-transform.ts**

In the `item.completed` section (after the file_change block, before `return null`):

```typescript
if (item?.['type'] === 'reasoning' && typeof item['text'] === 'string' && item['text'].length > 0) {
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({ type: 'thinking', catId, text: item['text'] }),
    timestamp: Date.now(),
  };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F045): Codex reasoning → thinking system_info [宪宪/Opus-46🐾]"
```

---

## Task 3: Codex `mcp_tool_call` / `web_search` / `item.error`

**Files:**
- Modify: `packages/api/test/codex-event-transform.test.js` (add tests)
- Modify: `packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts`

**Step 1: Add test fixtures for all three event types**

```javascript
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

// ── F045: top-level error (non-Reconnecting) → error ──

test('top-level error without Reconnecting → error message', () => {
  const event = { type: 'error', message: 'Fatal: connection lost' };
  const msg = transformCodexEvent(event, CAT);
  assert.equal(msg?.type, 'error');
  assert.equal(msg?.error, 'Fatal: connection lost');
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement all three**

In codex-event-transform.ts:

A) For `item.started` section, add `mcp_tool_call` handling alongside `command_execution`:

```typescript
if (item?.['type'] === 'mcp_tool_call') {
  const server = typeof item['server'] === 'string' ? item['server'] : 'unknown';
  const tool = typeof item['tool'] === 'string' ? item['tool'] : 'unknown';
  const args = (typeof item['arguments'] === 'object' && item['arguments'] !== null)
    ? item['arguments'] as Record<string, unknown>
    : {};
  return {
    type: 'tool_use',
    catId,
    toolName: `mcp:${server}/${tool}`,
    toolInput: args,
    timestamp: Date.now(),
  };
}
```

B) For `item.completed` section, add `mcp_tool_call`, `web_search`, and `error`:

```typescript
if (item?.['type'] === 'mcp_tool_call') {
  const server = typeof item['server'] === 'string' ? item['server'] : 'unknown';
  const tool = typeof item['tool'] === 'string' ? item['tool'] : 'unknown';
  const status = typeof item['status'] === 'string' ? item['status'] : 'completed';
  const result = item['result'] as Record<string, unknown> | undefined;
  const contentArr = Array.isArray(result?.['content']) ? result['content'] : [];
  const textParts = contentArr
    .filter((c: Record<string, unknown>) => c['type'] === 'text' && typeof c['text'] === 'string')
    .map((c: Record<string, unknown>) => c['text'] as string);
  return {
    type: 'tool_result',
    catId,
    content: `mcp:${server}/${tool} (${status})\n${textParts.join('\n')}`.trim(),
    timestamp: Date.now(),
  };
}

if (item?.['type'] === 'web_search') {
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({ type: 'web_search', catId, count: 1 }),
    timestamp: Date.now(),
  };
}

if (item?.['type'] === 'error' && typeof item['message'] === 'string') {
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({ type: 'warning', catId, message: item['message'] }),
    timestamp: Date.now(),
  };
}
```

C) For top-level `error` section, change the guard to also handle non-Reconnecting errors:

```typescript
if (e['type'] === 'error') {
  const message = e['message'];
  if (typeof message !== 'string') return null;
  const text = message.trim();
  if (text.startsWith('Reconnecting...')) {
    return { type: 'system_info', catId, content: text, timestamp: Date.now() };
  }
  return { type: 'error', catId, error: text, timestamp: Date.now() };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F045): Codex mcp_tool_call + web_search + item.error 解析 [宪宪/Opus-46🐾]"
```

---

## Task 4: Claude `thinking_delta` parsing

**Files:**
- Create: `packages/api/test/claude-ndjson-parser.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/claude-ndjson-parser.ts`

**Design:** Accumulate `thinking_delta` text in streamState. On `content_block_stop`, if accumulated thinking exists, emit `system_info` with `{ type: 'thinking', catId, text }`. This requires adding a `thinkingBuffer` to streamState.

**Step 1: Create test file with thinking fixtures**

```javascript
/**
 * claude-ndjson-parser pure function tests
 * F045: NDJSON 可观测性 — Claude parser 补全
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { transformClaudeEvent } = await import(
  '../dist/domains/cats/services/agents/providers/claude-ndjson-parser.js'
);

const CAT = 'opus';

function makeStreamState() {
  return {
    currentMessageId: undefined,
    partialTextMessageIds: new Set(),
    lastTurnInputTokens: undefined,
    thinkingBuffer: '',
  };
}

// ── Regression guards ──

test('system/init → session_init', () => {
  const msg = transformClaudeEvent(
    { type: 'system', subtype: 'init', session_id: 's-1' },
    CAT,
    makeStreamState(),
  );
  assert.equal(msg?.type, 'session_init');
  assert.equal(msg?.sessionId, 's-1');
});

test('stream_event text_delta → text', () => {
  const state = makeStreamState();
  state.currentMessageId = 'msg-1';
  const msg = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } },
    CAT,
    state,
  );
  assert.equal(msg?.type, 'text');
  assert.equal(msg?.content, 'Hi');
});

// ── F045: thinking_delta → accumulate → system_info(thinking) on block_stop ──

test('thinking_delta accumulates in buffer', () => {
  const state = makeStreamState();
  state.currentMessageId = 'msg-1';

  // First thinking delta
  const r1 = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'thinking' } } },
    CAT,
    state,
  );
  assert.equal(r1, null); // block_start is silent

  const r2 = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Let me ' } } },
    CAT,
    state,
  );
  assert.equal(r2, null); // accumulates, no output yet

  const r3 = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'think...' } } },
    CAT,
    state,
  );
  assert.equal(r3, null);

  // block_stop → flush thinking buffer
  const r4 = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_stop' } },
    CAT,
    state,
  );
  assert.equal(r4?.type, 'system_info');
  const payload = JSON.parse(r4?.content ?? '{}');
  assert.equal(payload.type, 'thinking');
  assert.equal(payload.text, 'Let me think...');

  // Buffer should be cleared
  assert.equal(state.thinkingBuffer, '');
});

test('content_block_stop without thinking buffer → null', () => {
  const state = makeStreamState();
  const r = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_stop' } },
    CAT,
    state,
  );
  assert.equal(r, null);
});

test('signature_delta is ignored', () => {
  const state = makeStreamState();
  const r = transformClaudeEvent(
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'signature_delta', signature: 'abc' } } },
    CAT,
    state,
  );
  assert.equal(r, null);
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement thinking_delta handling**

Add `thinkingBuffer` to streamState type and handle in the stream_event section:

```typescript
// In streamState type — add:
thinkingBuffer: string;

// In the stream_event handler, add cases:

if (s['type'] === 'content_block_start') {
  // Mark that we're in a thinking block (buffer starts fresh)
  const blockType = (s['content_block'] as Record<string, unknown> | undefined)?.['type'];
  if (blockType === 'thinking') {
    streamState.thinkingBuffer = '';
  }
  return null;
}

if (s['type'] === 'content_block_delta') {
  const delta = s['delta'];
  if (typeof delta !== 'object' || delta === null) return null;
  const d = delta as Record<string, unknown>;

  // thinking_delta → accumulate
  if (d['type'] === 'thinking_delta' && typeof d['thinking'] === 'string') {
    streamState.thinkingBuffer += d['thinking'];
    return null;
  }

  // signature_delta → ignore
  if (d['type'] === 'signature_delta') return null;

  // text_delta → existing behaviour (unchanged)
  if (d['type'] !== 'text_delta' || typeof d['text'] !== 'string' || d['text'].length === 0) {
    return null;
  }
  // ... existing text_delta code
}

if (s['type'] === 'content_block_stop') {
  // Flush thinking buffer if any
  if (streamState.thinkingBuffer.length > 0) {
    const text = streamState.thinkingBuffer;
    streamState.thinkingBuffer = '';
    return {
      type: 'system_info',
      catId,
      content: JSON.stringify({ type: 'thinking', catId, text }),
      timestamp: Date.now(),
    };
  }
  return null;
}
```

**Step 4: Run — expect PASS**

**Step 5: Update callers**

`ClaudeAgentService.ts` creates the streamState — add `thinkingBuffer: ''` to it.

**Step 6: Run full test suite to check regression**

```bash
pnpm --filter @cat-cafe/api test
```

**Step 7: Commit**

```bash
git commit -m "feat(F045): Claude thinking_delta → system_info(thinking) [宪宪/Opus-46🐾]"
```

---

## Task 5: Claude `result` error subtypes

**Files:**
- Modify: `packages/api/test/claude-ndjson-parser.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/claude-ndjson-parser.ts`

**Step 1: Add error subtype test fixtures**

```javascript
// ── F045: result error subtypes ──

test('result error_max_turns → error with subtype', () => {
  const state = makeStreamState();
  const msg = transformClaudeEvent(
    { type: 'result', subtype: 'error_max_turns', errors: ['Max turns reached'] },
    CAT,
    state,
  );
  assert.equal(msg?.type, 'error');
  assert.ok(msg?.error?.includes('Max turns reached'));
  const meta = JSON.parse(msg?.content ?? '{}');
  // Error subtype should be in metadata or content
});

test('result error_max_budget_usd → error with subtype in content', () => {
  const state = makeStreamState();
  const result = transformClaudeEvent(
    { type: 'result', subtype: 'error_max_budget_usd', errors: ['Budget exceeded'] },
    CAT,
    state,
  );
  assert.equal(result?.type, 'error');
});

test('result error_during_execution → error', () => {
  const state = makeStreamState();
  const result = transformClaudeEvent(
    { type: 'result', subtype: 'error_during_execution', errors: ['Something broke'] },
    CAT,
    state,
  );
  assert.equal(result?.type, 'error');
});
```

**Step 2: Run — verify current tests already pass (error is already emitted for non-success subtypes)**

The existing code already handles `subtype !== 'success'` as error. The improvement is to **include the subtype in the error message** so the frontend can differentiate.

**Step 3: Modify error handling to include subtype**

```typescript
if (e['type'] === 'result' && e['subtype'] !== 'success') {
  const subtype = typeof e['subtype'] === 'string' ? e['subtype'] : 'unknown';
  const rawErrors = Array.isArray(e['errors']) ? e['errors'] : [];
  const errors = rawErrors
    .filter((item): item is string => typeof item === 'string')
    .join('; ');
  return {
    type: 'error',
    catId,
    error: errors || 'Unknown error',
    // F045: Include error subtype as JSON in content for frontend differentiation
    content: JSON.stringify({ errorSubtype: subtype }),
    timestamp: Date.now(),
  };
}
```

**Step 4: Update tests to verify subtype is included**

**Step 5: Commit**

```bash
git commit -m "feat(F045): Claude result error subtypes — 错误归因可区分 [宪宪/Opus-46🐾]"
```

---

## Task 6: Claude `compact_boundary` + `rate_limit_event`

**Files:**
- Modify: `packages/api/test/claude-ndjson-parser.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/claude-ndjson-parser.ts`

**Step 1: Add test fixtures**

```javascript
// ── F045: system/compact_boundary → system_info ──

test('system compact_boundary → system_info', () => {
  const state = makeStreamState();
  const msg = transformClaudeEvent(
    { type: 'system', subtype: 'compact_boundary', pre_tokens: 45000 },
    CAT,
    state,
  );
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'compact_boundary');
  assert.equal(payload.preTokens, 45000);
});

// ── F045: rate_limit_event → system_info ──

test('rate_limit_event → system_info', () => {
  const state = makeStreamState();
  const msg = transformClaudeEvent(
    { type: 'rate_limit_event', utilization: 0.85, resets_at: '2026-02-27T18:00:00Z' },
    CAT,
    state,
  );
  assert.equal(msg?.type, 'system_info');
  const payload = JSON.parse(msg?.content ?? '{}');
  assert.equal(payload.type, 'rate_limit');
  assert.equal(payload.utilization, 0.85);
});
```

**Step 2-4: Implement and verify**

Add to the system handler:

```typescript
if (e['type'] === 'system' && e['subtype'] === 'compact_boundary') {
  const preTokens = typeof e['pre_tokens'] === 'number' ? e['pre_tokens'] : undefined;
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({ type: 'compact_boundary', catId, preTokens }),
    timestamp: Date.now(),
  };
}

if (e['type'] === 'rate_limit_event') {
  return {
    type: 'system_info',
    catId,
    content: JSON.stringify({
      type: 'rate_limit',
      catId,
      utilization: typeof e['utilization'] === 'number' ? e['utilization'] : undefined,
      resetsAt: typeof e['resets_at'] === 'string' ? e['resets_at'] : undefined,
    }),
    timestamp: Date.now(),
  };
}
```

**Step 5: Commit**

```bash
git commit -m "feat(F045): Claude compact_boundary + rate_limit_event 解析 [宪宪/Opus-46🐾]"
```

---

## Task 7: Frontend ThinkingBlock component

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (add thinking handler)
- Modify: `packages/web/src/stores/chat-types.ts` (add thinking state)
- Modify: `packages/web/src/components/RightStatusPanel.tsx` (add thinking indicator) OR
- Modify: `packages/web/src/components/MessageBubble.tsx` (inline thinking fold)

**Design:** Store accumulated thinking per-cat-invocation in `CatInvocationInfo.thinkingText`. Render as a foldable `<details>` block in the message area.

**Step 1: Add thinking state to chat-types.ts**

```typescript
// In CatInvocationInfo, add:
thinkingText?: string;
```

**Step 2: Add thinking handler in useAgentMessages.ts**

In the system_info JSON handler (around line 388):

```typescript
} else if (parsed?.type === 'thinking') {
  // F045: Accumulate thinking text for inline display
  const existing = getCatInvocation(parsed.catId ?? msg.catId)?.thinkingText ?? '';
  setCatInvocation(parsed.catId ?? msg.catId, {
    thinkingText: existing + (parsed.text ?? ''),
  });
  consumed = true;
}
```

**Step 3: Create ThinkingBlock in message rendering**

Find the component that renders individual messages and add a collapsible thinking section.
The exact file depends on the current component structure — look for `MessageBubble` or equivalent.

```tsx
{thinkingText && (
  <details className="mb-1 text-xs">
    <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
      ▶ 思考过程
    </summary>
    <pre className="mt-1 p-2 bg-gray-50 rounded text-[11px] text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
      {thinkingText}
    </pre>
  </details>
)}
```

**Step 4: Clear thinking on new invocation**

In useAgentMessages.ts, when a new invocation starts (session_init), reset thinkingText.

**Step 5: Commit**

```bash
git commit -m "feat(F045): ThinkingBlock 前端折叠组件 [宪宪/Opus-46🐾]"
```

---

## Task 8: Frontend ErrorBanner with subtype

**Files:**
- Modify: message rendering component (same as Task 7)

**Step 1: Parse error subtype from error message content**

When an `error` message has `content` with JSON containing `errorSubtype`, display a more specific error banner:

```typescript
const ERROR_LABELS: Record<string, string> = {
  error_max_turns: '超出 turn 限制',
  error_max_budget_usd: '预算用尽',
  error_during_execution: '运行时错误',
  error_max_structured_output_retries: '结构化输出重试耗尽',
};
```

**Step 2: Render specific error label**

```tsx
{errorSubtype && ERROR_LABELS[errorSubtype] && (
  <span className="text-xs text-red-400 ml-1">
    ({ERROR_LABELS[errorSubtype]})
  </span>
)}
```

**Step 3: Commit**

```bash
git commit -m "feat(F045): ErrorBanner 错误归因标签 [宪宪/Opus-46🐾]"
```

---

## Task 9: Plan persistence (survive restarts)

**Why:** 铲屎官痛点 — 重启后右侧看板清空。

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` (persist task_progress)
- Modify: `packages/api/src/routes/invocations.ts` or create new route
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (restore on mount)

**Design:** When task_progress is emitted, also write it to InvocationRecord (or a lightweight Redis key). On page load, frontend fetches active invocations' last task_progress and restores the right panel.

**Step 1: Backend — persist task_progress snapshot**

In `invoke-single-cat.ts`, when emitting task_progress system_info, also store it:

```typescript
// After pushing task_progress to outputs:
if (deps.invocationDeps?.invocationRegistry) {
  deps.invocationDeps.invocationRegistry.setTaskProgress(invocationId, progress.tasks);
}
```

**Step 2: Backend — expose task_progress in invocation GET**

Add `taskProgress` to the invocation record response so the frontend can restore it.

**Step 3: Frontend — restore on mount**

In the thread loading hook, after fetching active invocations, restore their taskProgress:

```typescript
// On thread change or page load:
const invocations = await fetch(`/api/invocations?threadId=${threadId}&status=running`);
for (const inv of invocations) {
  if (inv.taskProgress) {
    setCatInvocation(inv.catId, { taskProgress: { tasks: inv.taskProgress, lastUpdate: Date.now() } });
  }
}
```

**Step 4: Test manually — refresh during active invocation**

**Step 5: Commit**

```bash
git commit -m "feat(F045): Plan 持久化 — 重启后恢复进度 [宪宪/Opus-46🐾]"
```

---

## Task 10: Full regression test + build verification

**Step 1: Run full test suite**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f045-ndjson-observability
pnpm --filter @cat-cafe/api test
```

Expected: All existing tests pass, new tests pass

**Step 2: Run build**

```bash
pnpm build
```

Expected: No TypeScript errors

**Step 3: Run Biome check**

```bash
pnpm check
```

Expected: No linting errors

**Step 4: Final commit if needed**

**Step 5: Update F045 spec status**

```bash
# Update docs/features/F045-ndjson-observability.md status to in-progress
```

---

## Summary

| Task | What | Priority | Estimated Steps |
|------|------|----------|----------------|
| 1 | Codex `todo_list` → task_progress | P0 (Plan) | 5 |
| 2 | Codex `reasoning` → thinking | P1 (Thinking) | 5 |
| 3 | Codex `mcp_tool_call` / `web_search` / `item.error` | P2 | 5 |
| 4 | Claude `thinking_delta` | P1 (Thinking) | 7 |
| 5 | Claude `result` error subtypes | P1 (Error) | 5 |
| 6 | Claude `compact_boundary` / `rate_limit_event` | P2 | 5 |
| 7 | Frontend ThinkingBlock | P1 (Thinking) | 5 |
| 8 | Frontend ErrorBanner | P2 | 3 |
| 9 | Plan persistence | P0 (Plan) | 5 |
| 10 | Full regression + build | — | 5 |
