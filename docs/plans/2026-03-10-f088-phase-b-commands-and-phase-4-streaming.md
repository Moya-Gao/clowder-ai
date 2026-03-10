# F088 Phase B (Command Layer) + Phase 4 (Streaming) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Let Feishu/Telegram users manage threads via `/new /threads /use /where` commands, see thread badges + deep links in replies, and get real-time streaming output (edit-in-place) instead of waiting for final-only replies.

**Architecture:** Two independent feature tracks sharing the same worktree. Phase B adds a `ConnectorCommandLayer` (platform-agnostic command parser) that intercepts `/` commands in `ConnectorRouter` before routing to agent. Phase 4 adds `IStreamableOutboundAdapter` with placeholder→edit pattern, rate-limited streaming chunks from `ConnectorInvokeTrigger`. Both tracks extend the existing public-layer architecture (no adapter-specific business logic).

**Tech Stack:** TypeScript, ioredis (Redis Sets for user binding index), grammy (Telegram `editMessageText`), @larksuiteoapi/node-sdk (Feishu `im.message.patch`), node:test for TDD.

**NOT building:** `/link` (Phase C), multi-user principal link (Phase C), auto-topic-split, group chat, OAuth.

---

## Terminal Schema

### Phase B — Command Layer

```typescript
// ConnectorCommandLayer — platform-agnostic command parser
interface CommandResult {
  readonly kind: 'new' | 'threads' | 'use' | 'where' | 'not-command';
  readonly response?: string;           // Text to send back to user (for command responses)
  readonly newActiveThreadId?: string;   // If command changed the active thread
}

interface ConnectorCommandLayerDeps {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly threadStore: {
    create(userId: string, title?: string): { id: string } | Promise<{ id: string }>;
    get(id: string): Promise<{ id: string; title?: string; createdAt: number } | null>;
  };
  readonly frontendBaseUrl: string;
}

// Extended binding store — adds user-scoped queries
interface IConnectorThreadBindingStore {
  // ... existing methods ...
  listByUser(connectorId: string, userId: string, limit?: number):
    ConnectorThreadBinding[] | Promise<ConnectorThreadBinding[]>;
}
```

### Phase 4 — Streaming Outbound

```typescript
// Extended adapter interface for edit-in-place streaming
interface IStreamableOutboundAdapter extends IOutboundAdapter {
  sendPlaceholder(externalChatId: string, text: string): Promise<string>;  // Returns platformMessageId
  editMessage(externalChatId: string, platformMessageId: string, text: string): Promise<void>;
}

// Streaming session state (per invocation, per binding)
interface StreamingSession {
  readonly connectorId: string;
  readonly externalChatId: string;
  platformMessageId: string | null;     // Set after placeholder sent
  lastUpdateAt: number;
  lastContentLength: number;
}

// Rate limit constants
const STREAM_UPDATE_INTERVAL_MS = 2000;
const STREAM_UPDATE_MIN_DELTA_CHARS = 200;
```

---

## Phase B Tasks

### Task 1: ConnectorCommandLayer — Parser + `/where`

The simplest command first. Parser extracts command from message text, `/where` returns current binding info.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Test: `packages/api/test/connector-command-layer.test.js`

**Step 1: Write failing test**

```javascript
// connector-command-layer.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('ConnectorCommandLayer', () => {
  let ConnectorCommandLayer;

  before(async () => {
    const mod = await import('../dist/infrastructure/connectors/ConnectorCommandLayer.js');
    ConnectorCommandLayer = mod.ConnectorCommandLayer;
  });

  it('parse returns not-command for regular messages', async () => {
    const layer = new ConnectorCommandLayer({ bindingStore: stubStore(), threadStore: stubThreadStore(), frontendBaseUrl: 'https://cafe.example.com' });
    const result = await layer.handle('feishu', 'chat1', 'user1', 'hello world');
    assert.equal(result.kind, 'not-command');
  });

  it('/where returns current thread info', async () => {
    const store = stubStore({ threadId: 'thread-abc', connectorId: 'feishu', externalChatId: 'chat1', userId: 'user1', createdAt: Date.now() });
    const threadStore = stubThreadStore({ id: 'thread-abc', title: '飞书测试' });
    const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore, frontendBaseUrl: 'https://cafe.example.com' });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response.includes('thread-abc'));
    assert.ok(result.response.includes('飞书测试'));
    assert.ok(result.response.includes('cafe.example.com'));
  });

  it('/where with no binding returns helpful message', async () => {
    const layer = new ConnectorCommandLayer({ bindingStore: stubStore(), threadStore: stubThreadStore(), frontendBaseUrl: 'https://cafe.example.com' });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response.includes('没有'));
  });
});
```

**Step 2: Run test, confirm RED** (`node --test test/connector-command-layer.test.js`)

**Step 3: Implement `ConnectorCommandLayer`**

```typescript
// ConnectorCommandLayer.ts
export class ConnectorCommandLayer {
  constructor(private readonly deps: ConnectorCommandLayerDeps) {}

  async handle(connectorId: string, externalChatId: string, userId: string, text: string): Promise<CommandResult> {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return { kind: 'not-command' };

    const [cmd, ...args] = trimmed.split(/\s+/);
    switch (cmd) {
      case '/where': return this.handleWhere(connectorId, externalChatId);
      case '/new': return this.handleNew(connectorId, externalChatId, userId, args.join(' '));
      case '/threads': return this.handleThreads(connectorId, userId);
      case '/use': return this.handleUse(connectorId, externalChatId, userId, args[0]);
      default: return { kind: 'not-command' }; // Unknown /command → treat as normal text
    }
  }

  private async handleWhere(connectorId: string, externalChatId: string): Promise<CommandResult> {
    const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
    if (!binding) {
      return { kind: 'where', response: '📍 当前没有绑定的 thread。发送任意消息会自动创建新 thread，或用 /new 手动创建。' };
    }
    const thread = await this.deps.threadStore.get(binding.threadId);
    const title = thread?.title ?? '(无标题)';
    const shortId = binding.threadId.slice(0, 8);
    const deepLink = `${this.deps.frontendBaseUrl}/threads/${binding.threadId}`;
    return { kind: 'where', response: `📍 当前 thread: ${title}\nID: ${shortId}\n🔗 ${deepLink}` };
  }
  // ... handleNew, handleThreads, handleUse in subsequent tasks
}
```

**Step 4: Run test, confirm GREEN**

**Step 5: Commit** `feat(F088): ConnectorCommandLayer — parser + /where command`

---

### Task 2: `/new` command — create thread + switch binding

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Test: `packages/api/test/connector-command-layer.test.js`

**Step 1: Add failing tests**

```javascript
it('/new creates a new thread and returns confirmation', async () => {
  const store = memoryStore();
  const threadStore = stubThreadStore();
  const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore, frontendBaseUrl: 'https://cafe.example.com' });
  // First, create an existing binding
  await store.bind('feishu', 'chat1', 'old-thread', 'user1');
  const result = await layer.handle('feishu', 'chat1', 'user1', '/new 新话题');
  assert.equal(result.kind, 'new');
  assert.ok(result.newActiveThreadId);
  assert.notEqual(result.newActiveThreadId, 'old-thread');
  assert.ok(result.response.includes('新话题'));
});

it('/new without title still creates thread', async () => {
  const store = memoryStore();
  const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore: stubThreadStore(), frontendBaseUrl: 'https://cafe.example.com' });
  const result = await layer.handle('feishu', 'chat1', 'user1', '/new');
  assert.equal(result.kind, 'new');
  assert.ok(result.newActiveThreadId);
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement `handleNew`**

```typescript
private async handleNew(connectorId: string, externalChatId: string, userId: string, title?: string): Promise<CommandResult> {
  const thread = await this.deps.threadStore.create(userId, title || undefined);
  await this.deps.bindingStore.bind(connectorId, externalChatId, thread.id, userId);
  const shortId = thread.id.slice(0, 8);
  const deepLink = `${this.deps.frontendBaseUrl}/threads/${thread.id}`;
  const titleDisplay = title ? ` "${title}"` : '';
  return {
    kind: 'new',
    newActiveThreadId: thread.id,
    response: `✨ 新 thread${titleDisplay} 已创建\nID: ${shortId}\n🔗 ${deepLink}\n\n现在的消息会发到这个 thread。`,
  };
}
```

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): /new command — create thread + switch binding`

---

### Task 3: `listByUser` — extend binding store interface + Redis impl

Phase B needs to list all bindings for a user (for `/threads`). This requires a new index.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts` (interface + memory impl)
- Modify: `packages/api/src/infrastructure/connectors/RedisConnectorThreadBindingStore.ts`
- Modify: `packages/api/src/infrastructure/connectors/connector-binding-keys.ts` (new key pattern)
- Test: `packages/api/test/redis-connector-binding-store.test.js` (add listByUser tests)

**Step 1: Add failing tests**

```javascript
it('listByUser returns all bindings for a user', async () => {
  await store.bind('feishu', 'chat1', 'thread-1', 'user-1');
  await store.bind('feishu', 'chat2', 'thread-2', 'user-1');
  await store.bind('telegram', 'tg1', 'thread-3', 'user-2'); // Different user
  const results = await store.listByUser('feishu', 'user-1');
  assert.equal(results.length, 2);
});

it('listByUser respects limit', async () => {
  await store.bind('feishu', 'chat1', 'thread-1', 'user-1');
  await store.bind('feishu', 'chat2', 'thread-2', 'user-1');
  await store.bind('feishu', 'chat3', 'thread-3', 'user-1');
  const results = await store.listByUser('feishu', 'user-1', 2);
  assert.equal(results.length, 2);
});

it('listByUser returns empty for unknown user', async () => {
  const results = await store.listByUser('feishu', 'unknown');
  assert.deepEqual(results, []);
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement**

Add to interface:
```typescript
listByUser(connectorId: string, userId: string, limit?: number):
  ConnectorThreadBinding[] | Promise<ConnectorThreadBinding[]>;
```

Add new key pattern:
```typescript
// connector-binding-keys.ts
byUser: (connectorId: string, userId: string) => `connector-binding-user:${connectorId}:${userId}`,
```

Redis impl: maintain a Sorted Set `connector-binding-user:{connectorId}:{userId}` with score = `createdAt`, member = unprefixed hash key. Update Lua `BIND_LUA` to `ZADD` the user index. `listByUser` does `ZREVRANGE` + hydrate pipeline.

Memory impl: filter `this.bindings.values()` by `connectorId` and `userId`.

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): listByUser — user-scoped binding index for /threads`

---

### Task 4: `/threads` and `/use` commands

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Test: `packages/api/test/connector-command-layer.test.js`

**Step 1: Add failing tests**

```javascript
it('/threads lists recent threads with titles', async () => {
  const store = memoryStore();
  await store.bind('feishu', 'chat1', 'thread-aaa', 'user1');
  await store.bind('feishu', 'chat2', 'thread-bbb', 'user1');
  const threadStore = stubThreadStore([
    { id: 'thread-aaa', title: '飞书Bug' },
    { id: 'thread-bbb', title: '新功能讨论' },
  ]);
  const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore, frontendBaseUrl: 'https://cafe.example.com' });
  const result = await layer.handle('feishu', 'chat1', 'user1', '/threads');
  assert.equal(result.kind, 'threads');
  assert.ok(result.response.includes('飞书Bug'));
  assert.ok(result.response.includes('新功能讨论'));
});

it('/use switches to an existing thread', async () => {
  const store = memoryStore();
  await store.bind('feishu', 'chat1', 'thread-old', 'user1');
  await store.bind('feishu', 'chat2', 'thread-target', 'user1');
  const threadStore = stubThreadStore([{ id: 'thread-target', title: '目标Thread' }]);
  const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore, frontendBaseUrl: 'https://cafe.example.com' });
  const result = await layer.handle('feishu', 'chat1', 'user1', '/use thread-ta');
  assert.equal(result.kind, 'use');
  assert.equal(result.newActiveThreadId, 'thread-target');
  assert.ok(result.response.includes('目标Thread'));
});

it('/use with no match returns error', async () => {
  const store = memoryStore();
  const layer = new ConnectorCommandLayer({ bindingStore: store, threadStore: stubThreadStore(), frontendBaseUrl: 'https://cafe.example.com' });
  const result = await layer.handle('feishu', 'chat1', 'user1', '/use nonexistent');
  assert.equal(result.kind, 'use');
  assert.ok(result.response.includes('找不到'));
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement**

```typescript
private async handleThreads(connectorId: string, userId: string): Promise<CommandResult> {
  const bindings = await this.deps.bindingStore.listByUser(connectorId, userId, 10);
  if (bindings.length === 0) {
    return { kind: 'threads', response: '📋 还没有 thread。发送消息或用 /new 创建一个吧！' };
  }
  const lines = await Promise.all(bindings.map(async (b, i) => {
    const thread = await this.deps.threadStore.get(b.threadId);
    const title = thread?.title ?? '(无标题)';
    const shortId = b.threadId.slice(0, 8);
    return `${i + 1}. ${title} [${shortId}]`;
  }));
  return { kind: 'threads', response: `📋 最近的 threads:\n\n${lines.join('\n')}\n\n用 /use <ID前缀> 切换` };
}

private async handleUse(connectorId: string, externalChatId: string, userId: string, idPrefix?: string): Promise<CommandResult> {
  if (!idPrefix) {
    return { kind: 'use', response: '❌ 请指定 thread ID 前缀，例如: /use abc123' };
  }
  const bindings = await this.deps.bindingStore.listByUser(connectorId, userId);
  const match = bindings.find(b => b.threadId.startsWith(idPrefix));
  if (!match) {
    return { kind: 'use', response: `❌ 找不到以 "${idPrefix}" 开头的 thread。用 /threads 查看可用列表。` };
  }
  await this.deps.bindingStore.bind(connectorId, externalChatId, match.threadId, userId);
  const thread = await this.deps.threadStore.get(match.threadId);
  const title = thread?.title ?? '(无标题)';
  const deepLink = `${this.deps.frontendBaseUrl}/threads/${match.threadId}`;
  return {
    kind: 'use',
    newActiveThreadId: match.threadId,
    response: `🔄 已切换到: ${title}\nID: ${match.threadId.slice(0, 8)}\n🔗 ${deepLink}`,
  };
}
```

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): /threads + /use commands`

---

### Task 5: ConnectorRouter integration — command interception

Wire `ConnectorCommandLayer` into `ConnectorRouter.route()`. Messages starting with `/` go to command layer first; if it's a real command, send the response back and skip agent invocation.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts` (wire deps)
- Test: `packages/api/test/connector-router.test.js` (add command routing tests)

**Step 1: Add failing tests**

```javascript
it('routes /where command without triggering invocation', async () => {
  // Setup with commandLayer enabled
  const invoked = [];
  const sent = [];
  const router = createRouterWithCommands({ invokeTrigger: { trigger: (...a) => invoked.push(a) } });
  const result = await router.route('feishu', 'chat1', '/where', 'msg-1');
  assert.equal(result.kind, 'command');
  assert.equal(invoked.length, 0); // No cat invocation
});

it('routes normal messages through agent as before', async () => {
  const invoked = [];
  const router = createRouterWithCommands({ invokeTrigger: { trigger: (...a) => invoked.push(a) } });
  const result = await router.route('feishu', 'chat1', 'hello', 'msg-2');
  assert.equal(result.kind, 'processed');
  assert.equal(invoked.length, 1);
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement** — Add `commandLayer` to `ConnectorRouterOptions`. In `route()`, before agent path, check `commandLayer.handle()`. If `kind !== 'not-command'`, send response via adapter and return early with `{ kind: 'command' }`.

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): ConnectorRouter command interception`

---

### Task 6: Deep link in threadMetaLookup

Currently `threadMeta.deepLinkUrl` is always undefined. Wire it using `resolveFrontendBaseUrl()`.

**Files:**
- Modify: `packages/api/src/index.ts` (threadMetaLookup closure, ~line 697)
- Modify: `packages/api/src/config/frontend-origin.ts` (import)
- Test: verify via existing `connector-gateway-bootstrap.test.js` or manual

**Step 1: Modify threadMetaLookup**

```typescript
// In index.ts, the threadMetaLookup closure:
const frontendBaseUrl = resolveFrontendBaseUrl(process.env);

threadMetaLookup: async (threadId) => {
  const thread = await threadStore.get(threadId);
  if (!thread) return undefined;
  return {
    threadShortId: threadId.slice(0, 15),
    threadTitle: thread.title ?? undefined,
    deepLinkUrl: `${frontendBaseUrl}/threads/${threadId}`,
  };
},
```

**Step 2: Build and verify** existing tests still pass. The MessageEnvelope footer already renders deep link when `deepLinkUrl` is provided (ConnectorMessageFormatter handles it).

**Step 3: Commit** `feat(F088): wire deepLinkUrl in threadMetaLookup`

---

## Phase 4 Tasks

### Task 7: IStreamableOutboundAdapter interface + FeishuAdapter

Add `sendPlaceholder()` and `editMessage()` to adapters. Start with Feishu using `im.message.patch`.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts` (add interface)
- Modify: `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts`
- Test: `packages/api/test/feishu-adapter.test.js` (or inline in existing)

**Step 1: Add failing test**

```javascript
it('sendPlaceholder creates a message and returns messageId', async () => {
  const feishu = createFeishuAdapterWithMock();
  const msgId = await feishu.sendPlaceholder('chat1', '🤔 思考中...');
  assert.ok(typeof msgId === 'string');
  assert.ok(msgId.length > 0);
});

it('editMessage updates an existing message', async () => {
  const feishu = createFeishuAdapterWithMock();
  const msgId = await feishu.sendPlaceholder('chat1', '🤔 思考中...');
  await feishu.editMessage('chat1', msgId, '更新后的内容');
  // Verify mock received patch call
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement**

```typescript
// FeishuAdapter
async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
  const resp = await this.client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: externalChatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
  });
  return resp.data?.message_id ?? '';
}

async editMessage(_externalChatId: string, platformMessageId: string, text: string): Promise<void> {
  await this.client.im.message.patch({
    path: { message_id: platformMessageId },
    data: { content: JSON.stringify({ text }) },
  });
}
```

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): FeishuAdapter sendPlaceholder + editMessage`

---

### Task 8: TelegramAdapter — sendPlaceholder + editMessage

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts`
- Test: `packages/api/test/telegram-adapter.test.js`

**Step 1: Add failing test**

```javascript
it('sendPlaceholder sends message and returns stringified messageId', async () => {
  const tg = createTelegramAdapterWithMock();
  const msgId = await tg.sendPlaceholder('12345', '🤔 思考中...');
  assert.ok(msgId); // Telegram returns numeric message_id as string
});

it('editMessage calls editMessageText', async () => {
  const tg = createTelegramAdapterWithMock();
  const msgId = await tg.sendPlaceholder('12345', '🤔 思考中...');
  await tg.editMessage('12345', msgId, '更新后的内容');
  // Verify mock
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement**

```typescript
// TelegramAdapter
async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
  const msg = await this.bot.api.sendMessage(Number(externalChatId), text);
  return String(msg.message_id);
}

async editMessage(externalChatId: string, platformMessageId: string, text: string): Promise<void> {
  const truncated = text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) + '…' : text;
  await this.bot.api.editMessageText(Number(externalChatId), Number(platformMessageId), truncated);
}
```

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): TelegramAdapter sendPlaceholder + editMessage`

---

### Task 9: StreamingOutboundHook — rate-limited chunk delivery

The core Phase 4 logic: manage streaming sessions, send placeholder on first chunk, rate-limited edits during streaming, final edit when done.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/StreamingOutboundHook.ts`
- Test: `packages/api/test/streaming-outbound-hook.test.js`

**Step 1: Add failing tests**

```javascript
it('onStreamStart sends placeholder to all bound adapters', async () => {
  const hook = createStreamingHook();
  await hook.onStreamStart('thread-1', 'opus');
  assert.equal(mockAdapter.sendPlaceholderCalls.length, 1);
});

it('onStreamChunk rate-limits edits (no edit within interval)', async () => {
  const hook = createStreamingHook();
  await hook.onStreamStart('thread-1', 'opus');
  await hook.onStreamChunk('thread-1', 'Hello');
  await hook.onStreamChunk('thread-1', 'Hello world'); // Too soon
  assert.equal(mockAdapter.editMessageCalls.length, 0); // Under threshold
});

it('onStreamChunk edits after interval + delta threshold', async () => {
  const hook = createStreamingHook({ updateIntervalMs: 0, minDeltaChars: 0 });
  await hook.onStreamStart('thread-1', 'opus');
  await hook.onStreamChunk('thread-1', 'Hello world this is a long enough update');
  assert.equal(mockAdapter.editMessageCalls.length, 1);
});

it('onStreamEnd sends final edit with full content', async () => {
  const hook = createStreamingHook();
  await hook.onStreamStart('thread-1', 'opus');
  await hook.onStreamEnd('thread-1', 'Final complete response');
  assert.equal(mockAdapter.editMessageCalls.length, 1);
  assert.ok(mockAdapter.editMessageCalls[0].text.includes('Final complete response'));
});

it('onStreamEnd cleans up session', async () => {
  const hook = createStreamingHook();
  await hook.onStreamStart('thread-1', 'opus');
  await hook.onStreamEnd('thread-1', 'Done');
  // Second onStreamEnd should be no-op
  await hook.onStreamEnd('thread-1', 'Done again');
  assert.equal(mockAdapter.editMessageCalls.length, 1);
});
```

**Step 2: Run, confirm RED**

**Step 3: Implement `StreamingOutboundHook`**

```typescript
export class StreamingOutboundHook {
  private sessions = new Map<string, StreamingSession[]>();

  constructor(private readonly opts: {
    bindingStore: IConnectorThreadBindingStore;
    adapters: Map<string, IStreamableOutboundAdapter>;
    log: FastifyBaseLogger;
    updateIntervalMs?: number;
    minDeltaChars?: number;
  }) {}

  async onStreamStart(threadId: string, catId?: CatId): Promise<void> {
    const bindings = await this.opts.bindingStore.getByThread(threadId);
    const sessions: StreamingSession[] = [];
    for (const binding of bindings) {
      const adapter = this.opts.adapters.get(binding.connectorId);
      if (!adapter?.sendPlaceholder) continue;
      try {
        const catEntry = catId ? catRegistry.tryGet(catId) : undefined;
        const prefix = catEntry ? `[${catEntry.config.displayName}🐱] ` : '';
        const msgId = await adapter.sendPlaceholder(binding.externalChatId, `${prefix}🤔 思考中...`);
        sessions.push({ connectorId: binding.connectorId, externalChatId: binding.externalChatId, platformMessageId: msgId, lastUpdateAt: Date.now(), lastContentLength: 0 });
      } catch (err) {
        this.opts.log.warn({ err, connectorId: binding.connectorId }, '[StreamingOutbound] sendPlaceholder failed');
      }
    }
    if (sessions.length > 0) this.sessions.set(threadId, sessions);
  }

  async onStreamChunk(threadId: string, accumulatedText: string): Promise<void> {
    const sessions = this.sessions.get(threadId);
    if (!sessions) return;
    const now = Date.now();
    const intervalMs = this.opts.updateIntervalMs ?? STREAM_UPDATE_INTERVAL_MS;
    const minDelta = this.opts.minDeltaChars ?? STREAM_UPDATE_MIN_DELTA_CHARS;

    for (const session of sessions) {
      const elapsed = now - session.lastUpdateAt;
      const delta = accumulatedText.length - session.lastContentLength;
      if (elapsed < intervalMs || delta < minDelta) continue;

      const adapter = this.opts.adapters.get(session.connectorId);
      if (!adapter?.editMessage || !session.platformMessageId) continue;
      try {
        await adapter.editMessage(session.externalChatId, session.platformMessageId, accumulatedText + ' ▌');
        session.lastUpdateAt = now;
        session.lastContentLength = accumulatedText.length;
      } catch (err) {
        this.opts.log.warn({ err }, '[StreamingOutbound] editMessage failed');
      }
    }
  }

  async onStreamEnd(threadId: string, finalText: string): Promise<void> {
    const sessions = this.sessions.get(threadId);
    if (!sessions) return;
    this.sessions.delete(threadId);

    for (const session of sessions) {
      const adapter = this.opts.adapters.get(session.connectorId);
      if (!adapter?.editMessage || !session.platformMessageId) continue;
      try {
        await adapter.editMessage(session.externalChatId, session.platformMessageId, finalText);
      } catch (err) {
        this.opts.log.warn({ err }, '[StreamingOutbound] final editMessage failed');
      }
    }
  }
}
```

**Step 4: Run, confirm GREEN**

**Step 5: Commit** `feat(F088): StreamingOutboundHook — rate-limited edit-in-place streaming`

---

### Task 10: Wire streaming into ConnectorInvokeTrigger

Integrate `StreamingOutboundHook` into the invocation flow: `onStreamStart` before execution, `onStreamChunk` on each text msg, `onStreamEnd` after completion (replaces the separate `deliver()` call for streaming path).

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts`
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts` (wire StreamingOutboundHook)
- Modify: `packages/api/src/index.ts` (pass streamingHook to gateway deps)

**Step 1: In ConnectorInvokeTrigger.executeInBackground()**

Before the `for await` loop (line ~286):
```typescript
// Send streaming placeholder if streaming hook available
if (this.opts.streamingOutboundHook) {
  await this.opts.streamingOutboundHook.onStreamStart(threadId, catId);
}
```

Inside the `for await` loop, after accumulating text (line ~302):
```typescript
if (msg.type === 'text' && this.opts.streamingOutboundHook) {
  const accumulated = collectedTextParts.join('');
  await this.opts.streamingOutboundHook.onStreamChunk(threadId, accumulated);
}
```

After the loop completes, before the existing `deliver()` call:
```typescript
if (this.opts.streamingOutboundHook) {
  const finalText = collectedTextParts.join('');
  await this.opts.streamingOutboundHook.onStreamEnd(threadId, catDisplayPrefix + finalText);
  // Skip deliver() for streaming path — onStreamEnd already sent the final content
} else {
  // Existing deliver() path for non-streaming adapters
  this.opts.outboundHook?.deliver(threadId, finalText, catId, richBlocks, threadMeta);
}
```

**Step 2: Build and test** — existing tests should still pass (streamingOutboundHook is optional).

**Step 3: Wire in bootstrap** — create `StreamingOutboundHook` with same `bindingStore` and adapters that support `sendPlaceholder`.

**Step 4: Commit** `feat(F088): wire StreamingOutboundHook into invocation flow`

---

### Task 11: Integration test + cleanup

Full round-trip test: `/new` → send message → receive streaming placeholder → edits → final reply with thread badge + deep link.

**Files:**
- Test: `packages/api/test/connector-streaming-e2e.test.js`
- Modify: `docs/features/F088-multi-platform-chat-gateway.md` (mark ACs)

**Step 1: Write integration test** (mock adapters, real ConnectorRouter + CommandLayer + StreamingOutboundHook)

**Step 2: Run full test suite** `pnpm --filter @cat-cafe/api test`

**Step 3: Update feature doc** — mark AC-B1 through AC-B8 and AC-15 through AC-18

**Step 4: Commit** `feat(F088): Phase B + Phase 4 integration tests + docs`

---

## Dependency Graph

```
Task 1 (CommandLayer + /where)
  ↓
Task 2 (/new)
  ↓
Task 3 (listByUser store extension) ← independent of Tasks 1-2, but needed before Task 4
  ↓
Task 4 (/threads + /use)
  ↓
Task 5 (ConnectorRouter integration)
  ↓
Task 6 (Deep link wiring) ← can parallel with Tasks 3-5

Task 7 (Feishu streaming adapter) ← independent of Phase B
  ↓
Task 8 (Telegram streaming adapter) ← can parallel with Task 7
  ↓
Task 9 (StreamingOutboundHook)
  ↓
Task 10 (Wire into invocation flow)
  ↓
Task 11 (Integration test)
```

**Parallelizable tracks:**
- Phase B (Tasks 1-6) and Phase 4 adapter work (Tasks 7-8) are independent
- Task 6 (deep link) can run in parallel with Tasks 3-5
