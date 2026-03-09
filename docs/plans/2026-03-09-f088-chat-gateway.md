# F088 Multi-Platform Chat Gateway — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Enable bidirectional DM chat between Cat Café cats and users on Feishu (飞书) and Telegram.

**Architecture:** Extend existing Connector framework (ConnectorSource → StoredMessage → ConnectorInvokeTrigger) with: (1) a generic outbound delivery hook in ConnectorInvokeTrigger that fires after agent execution completes, (2) a ConnectorThreadBinding store mapping external conversation IDs to Cat Café thread IDs, (3) platform-specific adapters for Feishu and Telegram that handle inbound webhooks and outbound replies.

**Tech Stack:** Node.js (node:test), Fastify, `@larksuiteoapi/node-sdk` (Feishu), `grammy` (Telegram), Redis (6398 dev)

**Worktree:** `/Users/lysander/projects/relay-station/cat-cafe-f088-chat-gateway` (branch: `feat/f088-chat-gateway`)

**Finish Line:** User sends DM on Feishu or Telegram → Cat Café receives → agent replies → reply appears in original DM. Final-only outbound (not streaming). Idempotent inbound.

**What We're NOT Building:** Group chat, multi-user auth, OAuth, streaming outbound, message edit/delete sync, attachments, config UI, Slack/Discord adapters.

---

## Terminal Schema (Final-Form Types)

These types define the end state. All tasks build toward these — no throwaway scaffolding.

```typescript
// ── packages/shared/src/types/connector.ts (extend existing) ──

// New: Thread binding between external platforms and Cat Café
export interface ConnectorThreadBinding {
  readonly connectorId: string;      // 'feishu' | 'telegram'
  readonly externalChatId: string;   // Platform-specific conversation ID
  readonly threadId: string;         // Cat Café thread ID
  readonly userId: string;           // Owner
  readonly createdAt: number;
}

// New: Outbound delivery target (passed to adapter after agent completes)
export interface OutboundDeliveryTarget {
  readonly connectorId: string;
  readonly externalChatId: string;
  readonly metadata?: Record<string, unknown>;  // Platform-specific (e.g. Telegram chat_id)
}

// Extend ConnectorDefinition registry with 'feishu' and 'telegram'
```

```typescript
// ── packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts ──

export interface IConnectorThreadBindingStore {
  bind(connectorId: string, externalChatId: string, threadId: string, userId: string): ConnectorThreadBinding;
  getByExternal(connectorId: string, externalChatId: string): ConnectorThreadBinding | null;
  getByThread(threadId: string): ConnectorThreadBinding[];
  remove(connectorId: string, externalChatId: string): boolean;
}
```

```typescript
// ── packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts ──

export interface IOutboundAdapter {
  readonly connectorId: string;
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface OutboundDeliveryHookOptions {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly adapters: Map<string, IOutboundAdapter>;
  readonly log: FastifyBaseLogger;
}
```

```typescript
// ── packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts ──

export class FeishuAdapter implements IOutboundAdapter {
  readonly connectorId = 'feishu';
  constructor(appId: string, appSecret: string);
  sendReply(externalChatId: string, content: string): Promise<void>;
  verifyWebhook(body: unknown, headers: Record<string, string>): boolean;
  parseMessage(body: unknown): { chatId: string; text: string; messageId: string; senderId: string } | null;
}
```

```typescript
// ── packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts ──

export class TelegramAdapter implements IOutboundAdapter {
  readonly connectorId = 'telegram';
  constructor(botToken: string);
  sendReply(externalChatId: string, content: string): Promise<void>;
  startPolling(handler: (msg: TelegramInboundMessage) => Promise<void>): void;
  stopPolling(): void;
}
```

---

## Task 1: ConnectorThreadBinding Store (Foundation)

**Files:**
- Create: `packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts`
- Test: `packages/api/test/connector-thread-binding-store.test.js`
- Modify: `packages/shared/src/types/connector.ts` (add ConnectorThreadBinding type)

### Step 1: Add ConnectorThreadBinding type to shared

```typescript
// Add to packages/shared/src/types/connector.ts after ConnectorDefinition

export interface ConnectorThreadBinding {
  readonly connectorId: string;
  readonly externalChatId: string;
  readonly threadId: string;
  readonly userId: string;
  readonly createdAt: number;
}
```

### Step 2: Write failing test for MemoryConnectorThreadBindingStore

```javascript
// packages/api/test/connector-thread-binding-store.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';

describe('MemoryConnectorThreadBindingStore', () => {
  let store;
  beforeEach(() => { store = new MemoryConnectorThreadBindingStore(); });

  it('bind() creates and returns a binding', () => {
    const b = store.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    assert.equal(b.connectorId, 'feishu');
    assert.equal(b.externalChatId, 'chat-123');
    assert.equal(b.threadId, 'thread-abc');
    assert.equal(b.userId, 'user-1');
    assert.ok(b.createdAt > 0);
  });

  it('getByExternal() returns bound thread', () => {
    store.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    const b = store.getByExternal('feishu', 'chat-123');
    assert.equal(b?.threadId, 'thread-abc');
  });

  it('getByExternal() returns null for unknown', () => {
    assert.equal(store.getByExternal('feishu', 'nope'), null);
  });

  it('getByThread() returns all bindings for a thread', () => {
    store.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    store.bind('telegram', 'chat-2', 'thread-abc', 'user-1');
    const bindings = store.getByThread('thread-abc');
    assert.equal(bindings.length, 2);
  });

  it('bind() overwrites existing binding for same connector+externalChatId', () => {
    store.bind('feishu', 'chat-123', 'thread-old', 'user-1');
    store.bind('feishu', 'chat-123', 'thread-new', 'user-1');
    assert.equal(store.getByExternal('feishu', 'chat-123')?.threadId, 'thread-new');
  });

  it('remove() deletes a binding', () => {
    store.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    assert.equal(store.remove('feishu', 'chat-123'), true);
    assert.equal(store.getByExternal('feishu', 'chat-123'), null);
  });

  it('remove() returns false for unknown', () => {
    assert.equal(store.remove('feishu', 'nope'), false);
  });
});
```

Run: `cd packages/api && node --test test/connector-thread-binding-store.test.js`
Expected: FAIL (module not found)

### Step 3: Implement MemoryConnectorThreadBindingStore

```typescript
// packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts
import type { ConnectorThreadBinding } from '@cat-cafe/shared';

export interface IConnectorThreadBindingStore {
  bind(connectorId: string, externalChatId: string, threadId: string, userId: string): ConnectorThreadBinding;
  getByExternal(connectorId: string, externalChatId: string): ConnectorThreadBinding | null;
  getByThread(threadId: string): ConnectorThreadBinding[];
  remove(connectorId: string, externalChatId: string): boolean;
}

export class MemoryConnectorThreadBindingStore implements IConnectorThreadBindingStore {
  private readonly bindings = new Map<string, ConnectorThreadBinding>();

  private key(connectorId: string, externalChatId: string): string {
    return `${connectorId}:${externalChatId}`;
  }

  bind(connectorId: string, externalChatId: string, threadId: string, userId: string): ConnectorThreadBinding {
    const binding: ConnectorThreadBinding = {
      connectorId, externalChatId, threadId, userId, createdAt: Date.now(),
    };
    this.bindings.set(this.key(connectorId, externalChatId), binding);
    return binding;
  }

  getByExternal(connectorId: string, externalChatId: string): ConnectorThreadBinding | null {
    return this.bindings.get(this.key(connectorId, externalChatId)) ?? null;
  }

  getByThread(threadId: string): ConnectorThreadBinding[] {
    return [...this.bindings.values()].filter(b => b.threadId === threadId);
  }

  remove(connectorId: string, externalChatId: string): boolean {
    return this.bindings.delete(this.key(connectorId, externalChatId));
  }
}
```

Run: `cd packages/api && node --test test/connector-thread-binding-store.test.js`
Expected: PASS (7 tests)

### Step 4: Commit

```bash
git add packages/shared/src/types/connector.ts packages/api/src/infrastructure/connectors/ packages/api/test/connector-thread-binding-store.test.js
pnpm --filter @cat-cafe/shared build
git commit -m "feat(F088): add ConnectorThreadBindingStore with tests"
```

---

## Task 2: Outbound Delivery Hook

**Files:**
- Create: `packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts`
- Test: `packages/api/test/outbound-delivery-hook.test.js`
- Modify: `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts` (wire hook after execution)

### Step 1: Write failing test for OutboundDeliveryHook

```javascript
// packages/api/test/outbound-delivery-hook.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OutboundDeliveryHook } from '../dist/infrastructure/connectors/OutboundDeliveryHook.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';

function noopLog() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => noopLog() };
}

function mockAdapter(connectorId) {
  const sent = [];
  return {
    sent,
    adapter: {
      connectorId,
      async sendReply(externalChatId, content, metadata) {
        sent.push({ externalChatId, content, metadata });
      },
    },
  };
}

describe('OutboundDeliveryHook', () => {
  let bindingStore, feishuMock, hook;

  beforeEach(() => {
    bindingStore = new MemoryConnectorThreadBindingStore();
    feishuMock = mockAdapter('feishu');
    const adapters = new Map([['feishu', feishuMock.adapter]]);
    hook = new OutboundDeliveryHook({ bindingStore, adapters, log: noopLog() });
  });

  it('delivers reply to bound external chat', async () => {
    bindingStore.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello from cat!');
    assert.equal(feishuMock.sent.length, 1);
    assert.equal(feishuMock.sent[0].externalChatId, 'chat-123');
    assert.equal(feishuMock.sent[0].content, 'Hello from cat!');
  });

  it('skips delivery when no binding exists', async () => {
    await hook.deliver('thread-no-binding', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });

  it('delivers to multiple bindings for same thread', async () => {
    const telegramMock = mockAdapter('telegram');
    const adapters = new Map([['feishu', feishuMock.adapter], ['telegram', telegramMock.adapter]]);
    hook = new OutboundDeliveryHook({ bindingStore, adapters, log: noopLog() });

    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    bindingStore.bind('telegram', 'chat-2', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!');

    assert.equal(feishuMock.sent.length, 1);
    assert.equal(telegramMock.sent.length, 1);
  });

  it('does not throw when adapter.sendReply fails', async () => {
    const failAdapter = {
      connectorId: 'feishu',
      async sendReply() { throw new Error('network error'); },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', failAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    // Should not throw — fire-and-forget with error logging
    await hook.deliver('thread-abc', 'Hello');
  });

  it('skips binding when adapter not registered', async () => {
    bindingStore.bind('discord', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });
});
```

Run: `cd packages/api && node --test test/outbound-delivery-hook.test.js`
Expected: FAIL

### Step 2: Implement OutboundDeliveryHook

```typescript
// packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
import type { FastifyBaseLogger } from 'fastify';
import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';

export interface IOutboundAdapter {
  readonly connectorId: string;
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface OutboundDeliveryHookOptions {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly adapters: Map<string, IOutboundAdapter>;
  readonly log: FastifyBaseLogger;
}

export class OutboundDeliveryHook {
  constructor(private readonly opts: OutboundDeliveryHookOptions) {}

  async deliver(threadId: string, content: string): Promise<void> {
    const bindings = this.opts.bindingStore.getByThread(threadId);
    if (bindings.length === 0) return;

    await Promise.allSettled(
      bindings.map(async (binding) => {
        const adapter = this.opts.adapters.get(binding.connectorId);
        if (!adapter) {
          this.opts.log.warn({ connectorId: binding.connectorId }, 'No adapter registered for connector');
          return;
        }
        try {
          await adapter.sendReply(binding.externalChatId, content, undefined);
        } catch (err) {
          this.opts.log.error({ err, connectorId: binding.connectorId, externalChatId: binding.externalChatId },
            'Outbound delivery failed');
        }
      }),
    );
  }
}
```

Run: `cd packages/api && node --test test/outbound-delivery-hook.test.js`
Expected: PASS (5 tests)

### Step 3: Wire hook into ConnectorInvokeTrigger

In `ConnectorInvokeTrigger.ts`, the outbound hook fires after the `for await` loop completes and before status update. The hook is optional — if no `outboundHook` is provided, behavior is unchanged.

Modify `ConnectorInvokeTriggerOptions` to accept optional `outboundHook: OutboundDeliveryHook`.

In `executeInBackground()`, after the `for await` loop (after all messages yielded), collect final text content and call `outboundHook.deliver(threadId, finalContent)`.

**Key insertion point:** After the `for await (const msg of router.routeExecution(...))` loop completes, before `finalStatus` is determined, accumulate text messages and deliver.

### Step 4: Write test for ConnectorInvokeTrigger with outbound hook

Add test in existing `connector-invoke-trigger.test.js`:

```javascript
describe('outbound delivery hook', () => {
  it('calls outboundHook.deliver after successful execution', async () => {
    const delivered = [];
    const outboundHook = {
      async deliver(threadId, content) { delivered.push({ threadId, content }); },
    };
    const trigger = createTrigger({ outboundHook });
    trigger.trigger('thread-1', 'opus', 'user-1', 'Hello', 'msg-1');
    await waitForTrigger();
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].threadId, 'thread-1');
  });

  it('does not call outboundHook when execution fails', async () => {
    routerMock = mockRouter({ throwError: new Error('boom') });
    const delivered = [];
    const outboundHook = { async deliver(t, c) { delivered.push({ t, c }); } };
    const trigger = createTrigger({ router: routerMock.router, outboundHook });
    trigger.trigger('thread-1', 'opus', 'user-1', 'Hello', 'msg-1');
    await waitForTrigger();
    assert.equal(delivered.length, 0);
  });
});
```

### Step 5: Commit

```bash
git add packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts \
  packages/api/test/outbound-delivery-hook.test.js \
  packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts \
  packages/api/test/connector-invoke-trigger.test.js
git commit -m "feat(F088): add OutboundDeliveryHook + wire into ConnectorInvokeTrigger"
```

---

## Task 3: Connector Webhook Receiver Route

**Files:**
- Create: `packages/api/src/routes/connector-webhooks.ts`
- Test: `packages/api/test/connector-webhook-route.test.js`
- Create: `packages/api/src/infrastructure/connectors/InboundMessageDedup.ts`
- Test: `packages/api/test/inbound-message-dedup.test.js`

### Step 1: Write failing test for InboundMessageDedup

```javascript
// packages/api/test/inbound-message-dedup.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InboundMessageDedup } from '../dist/infrastructure/connectors/InboundMessageDedup.js';

describe('InboundMessageDedup', () => {
  let dedup;
  beforeEach(() => { dedup = new InboundMessageDedup(); });

  it('first message is not duplicate', () => {
    assert.equal(dedup.isDuplicate('feishu', 'msg-001'), false);
  });

  it('same message ID is duplicate', () => {
    dedup.isDuplicate('feishu', 'msg-001');
    assert.equal(dedup.isDuplicate('feishu', 'msg-001'), true);
  });

  it('different connector same msgId is not duplicate', () => {
    dedup.isDuplicate('feishu', 'msg-001');
    assert.equal(dedup.isDuplicate('telegram', 'msg-001'), false);
  });
});
```

### Step 2: Implement InboundMessageDedup

```typescript
// packages/api/src/infrastructure/connectors/InboundMessageDedup.ts
export class InboundMessageDedup {
  private readonly seen = new Set<string>();

  isDuplicate(connectorId: string, messageId: string): boolean {
    const key = `${connectorId}:${messageId}`;
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    return false;
  }
}
```

### Step 3: Write failing test for webhook route

```javascript
// packages/api/test/connector-webhook-route.test.js
import './helpers/setup-cat-registry.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { connectorWebhookRoutes } from '../dist/routes/connector-webhooks.js';

// Minimal mocks (same pattern as pr-tracking-route.test.js)
// ...

describe('POST /api/connectors/:connectorId/webhook', () => {
  it('returns 200 for valid feishu verification challenge', async () => {
    // Feishu sends a verification challenge on setup
    const { app } = buildApp();
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/feishu/webhook',
      payload: { type: 'url_verification', challenge: 'test-challenge' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.challenge, 'test-challenge');
    await app.close();
  });

  it('returns 404 for unknown connector', async () => {
    const { app } = buildApp();
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/unknown/webhook',
      payload: {},
    });
    assert.equal(res.statusCode, 404);
    await app.close();
  });

  it('returns 200 and processes feishu message', async () => {
    // ...full feishu event callback body
  });
});
```

### Step 4: Implement connector-webhooks route

Route receives platform webhooks, delegates to registered adapters, posts connector message, triggers agent.

### Step 5: Commit

```bash
git commit -m "feat(F088): add webhook receiver route + inbound dedup"
```

---

## Task 4: Register Feishu + Telegram Connector Definitions

**Files:**
- Modify: `packages/shared/src/types/connector.ts` (add to registry)

### Step 1: Add feishu and telegram to CONNECTOR_DEFINITIONS

```typescript
{ id: 'feishu', displayName: '飞书', icon: '🔵', color: { primary: '#3370FF', secondary: '#E8F0FE' }, description: '飞书机器人' },
{ id: 'telegram', displayName: 'Telegram', icon: '✈️', color: { primary: '#0088CC', secondary: '#E3F2FD' }, description: 'Telegram Bot' },
```

### Step 2: Rebuild shared + commit

```bash
pnpm --filter @cat-cafe/shared build
git commit -m "feat(F088): register feishu + telegram connector definitions"
```

---

## Task 5: Telegram Adapter

**Files:**
- Create: `packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts`
- Test: `packages/api/test/telegram-adapter.test.js`

### Step 1: Write failing tests

Test parseMessage(), sendReply() (with mocked HTTP), and polling lifecycle.

### Step 2: Implement TelegramAdapter

Uses `grammy` Bot API. Long polling for inbound (no public webhook needed). `bot.api.sendMessage()` for outbound.

### Step 3: Commit

```bash
git commit -m "feat(F088): add TelegramAdapter (grammy) with tests"
```

---

## Task 6: Feishu Adapter

**Files:**
- Create: `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts`
- Test: `packages/api/test/feishu-adapter.test.js`

### Step 1: Write failing tests

Test verifyWebhook() (signature check), parseMessage(), sendReply() (with mocked SDK).

### Step 2: Implement FeishuAdapter

Uses `@larksuiteoapi/node-sdk`. Webhook receiver for inbound. `client.im.message.create()` for outbound.

### Step 3: Commit

```bash
git commit -m "feat(F088): add FeishuAdapter (@larksuiteoapi/node-sdk) with tests"
```

---

## Task 7: Connector Router (Inbound Message → Thread → Trigger)

**Files:**
- Create: `packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
- Test: `packages/api/test/connector-router.test.js`

### Step 1: Write failing tests

Follows ReviewRouter pattern — 2-layer routing:
1. ConnectorThreadBindingStore lookup (existing binding → reuse thread)
2. Auto-create new thread + binding (first message from this external chat)

Test message posting with ConnectorSource, test auto-trigger via ConnectorInvokeTrigger.

### Step 2: Implement ConnectorRouter

```typescript
export class ConnectorRouter {
  async route(connectorId: string, externalChatId: string, text: string, externalMessageId: string): Promise<RouteResult> {
    // 1. Dedup check
    if (this.dedup.isDuplicate(connectorId, externalMessageId)) return { kind: 'skipped', reason: 'duplicate' };

    // 2. Lookup or create binding
    let binding = this.bindingStore.getByExternal(connectorId, externalChatId);
    if (!binding) {
      const thread = await this.threadStore.create(this.defaultUserId, `${connectorId} DM`);
      binding = this.bindingStore.bind(connectorId, externalChatId, thread.id, this.defaultUserId);
    }

    // 3. Post connector message
    const stored = await this.messageStore.append({
      userId: this.defaultUserId,
      catId: null,
      content: text,
      source: { connector: connectorId, label: def.displayName, icon: def.icon },
      mentions: this.defaultCats,
      timestamp: Date.now(),
    });

    // 4. Broadcast + trigger
    this.socketManager?.broadcastToRoom(...);
    this.invokeTrigger?.trigger(binding.threadId, defaultCat, ...);

    return { kind: 'routed', threadId: binding.threadId, messageId: stored.id };
  }
}
```

### Step 3: Commit

```bash
git commit -m "feat(F088): add ConnectorRouter with thread binding + auto-trigger"
```

---

## Task 8: Bootstrap & Wiring

**Files:**
- Create: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- Modify: `packages/api/src/app.ts` or equivalent server entry (register webhook routes + start adapters)

### Step 1: Write bootstrap function

```typescript
export async function startConnectorGateway(opts: {
  feishuAppId?: string;
  feishuAppSecret?: string;
  telegramBotToken?: string;
  // ...shared deps
}): Promise<{ stop: () => void }> {
  const bindingStore = new MemoryConnectorThreadBindingStore();
  const adapters = new Map<string, IOutboundAdapter>();
  const dedup = new InboundMessageDedup();

  if (opts.telegramBotToken) {
    const telegram = new TelegramAdapter(opts.telegramBotToken);
    adapters.set('telegram', telegram);
    telegram.startPolling(async (msg) => {
      await connectorRouter.route('telegram', String(msg.chatId), msg.text, String(msg.messageId));
    });
  }

  if (opts.feishuAppId && opts.feishuAppSecret) {
    adapters.set('feishu', new FeishuAdapter(opts.feishuAppId, opts.feishuAppSecret));
    // Feishu uses webhook route — no polling needed
  }

  const outboundHook = new OutboundDeliveryHook({ bindingStore, adapters, log });
  // Wire outboundHook into ConnectorInvokeTrigger

  return { stop: () => { /* cleanup */ } };
}
```

### Step 2: Register webhook route in app

### Step 3: Integration test

### Step 4: Commit

```bash
git commit -m "feat(F088): add connector gateway bootstrap + server wiring"
```

---

## Task 9: End-to-End Smoke Test

**Files:**
- Create: `packages/api/test/f088-gateway-integration.test.js`

### Step 1: Write integration test

Test full flow with mocked platform SDKs:
1. Simulate Telegram message → connector router → agent mock → outbound delivery → verify sendReply called
2. Simulate Feishu webhook → connector router → agent mock → outbound delivery → verify sendReply called
3. Verify idempotency: same messageId → no duplicate invoke
4. Verify thread reuse: second message from same chat → same thread

### Step 2: Commit

```bash
git commit -m "test(F088): add E2E integration smoke test"
```

---

## Task 10: Documentation & Cleanup

**Files:**
- Update: `docs/features/F088-multi-platform-chat-gateway.md` (mark ACs)
- Create: `docs/decisions/ADR-xxx-connector-gateway.md` (if needed)
- Update: `.env.example` (add FEISHU_APP_ID, FEISHU_APP_SECRET, TELEGRAM_BOT_TOKEN)

### Step 1: Update .env.example

### Step 2: Update F088 spec with completed ACs

### Step 3: Final commit

```bash
git commit -m "docs(F088): update spec + env example for connector gateway"
```

---

## Execution Order & Dependencies

```
Task 1 (ThreadBinding store) ─────────────┐
Task 2 (Outbound hook) ───────────────────├── Task 7 (Router) ── Task 8 (Bootstrap) ── Task 9 (E2E)
Task 3 (Webhook route + dedup) ───────────┤
Task 4 (Registry definitions) ────────────┘
Task 5 (Telegram adapter) ─── parallel ───┤
Task 6 (Feishu adapter) ───── parallel ───┘
```

**Critical path:** Tasks 1→2→7→8→9 (serial, ~4-5 days)
**Parallel work:** Tasks 3,4,5,6 can run alongside Tasks 1-2
**Total with parallelism:** ~7-9 days (matches spec estimate)
