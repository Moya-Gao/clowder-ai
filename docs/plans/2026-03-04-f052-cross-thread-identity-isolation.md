# F052: 跨线程身份隔离与消息溯源 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Cross-thread messages carry source metadata, A2A @mentions work across threads for same-name cats, and UX/context clearly marks cross-thread origin.

**Architecture:** Extend `StoredMessage.extra` with `crossPost` sub-field (backward-compatible). Make `parseA2AMentions` skip self-reference filter when sender is cross-thread. Add `← from thread:xxx` annotation in context assembly and "转发自" badge in frontend.

**Tech Stack:** TypeScript (Node.js API + React frontend), Redis (message store), Zustand (frontend state)

---

## Phase A: 消息溯源 + A2A 修复

### Task 1: Extend `StoredMessage.extra` type with `crossPost`

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts:44-45`
- Modify: `packages/api/src/domains/cats/services/stores/redis/redis-message-parsers.ts:42-69`
- Test: `packages/api/test/callback-routes.test.js` (existing, extend)

**Step 1: Write failing test — crossPost round-trips through MessageStore**

Add to `packages/api/test/callback-routes.test.js` (new describe block at end):

```javascript
describe('F052: cross-thread identity isolation', () => {
  test('cross-thread post stores extra.crossPost metadata', async () => {
    // Setup: create thread owned by testUserId
    const targetThreadId = 'thread-cross-target';
    await threadStore.create({
      id: targetThreadId,
      title: 'Target Thread',
      createdBy: testUserId,
    });

    // Register an invocation for a different source thread
    const sourceThreadId = 'thread-cross-source';
    const { invocationId, callbackToken } = registry.register({
      userId: testUserId,
      catId: 'codex',
      threadId: sourceThreadId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'Hello from source thread',
        threadId: targetThreadId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.threadId, targetThreadId);

    // Verify stored message has crossPost metadata
    const msgs = await messageStore.getByThread(targetThreadId, 10, testUserId);
    const crossMsg = msgs.find((m) => m.content === 'Hello from source thread');
    assert.ok(crossMsg, 'cross-thread message should be stored');
    assert.ok(crossMsg.extra?.crossPost, 'should have crossPost metadata');
    assert.strictEqual(crossMsg.extra.crossPost.sourceThreadId, sourceThreadId);
    assert.strictEqual(crossMsg.extra.crossPost.sourceInvocationId, invocationId);
  });

  test('same-thread post does NOT add crossPost metadata', async () => {
    const threadId = 'thread-same';
    await threadStore.create({
      id: threadId,
      title: 'Same Thread',
      createdBy: testUserId,
    });

    const { invocationId, callbackToken } = registry.register({
      userId: testUserId,
      catId: 'codex',
      threadId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/post-message',
      payload: {
        invocationId,
        callbackToken,
        content: 'Hello same thread',
        threadId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const msgs = await messageStore.getByThread(threadId, 10, testUserId);
    const msg = msgs.find((m) => m.content === 'Hello same thread');
    assert.ok(msg);
    assert.strictEqual(msg.extra?.crossPost, undefined, 'same-thread should NOT have crossPost');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/callback-routes.test.js --test-name-pattern="cross-thread post stores"
```

Expected: FAIL — `crossMsg.extra?.crossPost` is undefined

**Step 3: Extend StoredMessage type**

In `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts:44-45`, change:

```typescript
// Before
/** F22: Extensible extra data (rich blocks, stream metadata, future: reactions) */
extra?: { rich?: RichMessageExtra; stream?: { invocationId: string } };
```

To:

```typescript
/** F22+F52: Extensible extra data (rich blocks, stream metadata, cross-post origin) */
extra?: {
  rich?: RichMessageExtra;
  stream?: { invocationId: string };
  crossPost?: { sourceThreadId: string; sourceInvocationId?: string };
};
```

**Step 4: Update `safeParseExtra` in Redis parser**

In `packages/api/src/domains/cats/services/stores/redis/redis-message-parsers.ts`, update return type and add crossPost validation:

Change return type (line 44):

```typescript
): { rich?: RichMessageExtra; stream?: { invocationId: string }; crossPost?: { sourceThreadId: string; sourceInvocationId?: string } } | undefined {
```

Change result type (line 50):

```typescript
const result: { rich?: RichMessageExtra; stream?: { invocationId: string }; crossPost?: { sourceThreadId: string; sourceInvocationId?: string } } = {};
```

Add after the stream validation block (after line 63):

```typescript
// F52: Validate crossPost sub-field shape
if (parsed.crossPost && typeof parsed.crossPost === 'object' && typeof parsed.crossPost.sourceThreadId === 'string') {
  result.crossPost = {
    sourceThreadId: parsed.crossPost.sourceThreadId,
    ...(typeof parsed.crossPost.sourceInvocationId === 'string' ? { sourceInvocationId: parsed.crossPost.sourceInvocationId } : {}),
  };
  hasField = true;
}
```

**Step 5: Attach crossPost in callbacks.ts post-message handler**

In `packages/api/src/routes/callbacks.ts`, modify the message append call (lines 233-242).

The cross-thread detection is already there: `effectiveThreadId !== record.threadId` (when `threadId && threadId !== record.threadId` on line 180). Build the extra object accordingly:

Replace lines 233-242:

```typescript
// F52: Build extra with crossPost metadata for cross-thread messages
const isCrossThread = effectiveThreadId !== record.threadId;
const crossPostExtra = isCrossThread
  ? { crossPost: { sourceThreadId: record.threadId, sourceInvocationId: invocationId } }
  : {};
const richExtra = richBlocks.length > 0
  ? { rich: { v: 1 as const, blocks: richBlocks } }
  : {};
const extra = (Object.keys(crossPostExtra).length > 0 || Object.keys(richExtra).length > 0)
  ? { ...richExtra, ...crossPostExtra }
  : undefined;

// Store the message (scoped to the effective thread)
const storedMsg = await messageStore.append({
  userId: record.userId,
  catId: record.catId,
  content: storedContent,
  mentions,
  origin: 'callback',
  timestamp: Date.now(),
  threadId: effectiveThreadId,
  ...(extra ? { extra } : {}),
});
```

**Step 6: Run tests to verify they pass**

```bash
cd packages/api && node --test test/callback-routes.test.js --test-name-pattern="F052"
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/MessageStore.ts \
       packages/api/src/domains/cats/services/stores/redis/redis-message-parsers.ts \
       packages/api/src/routes/callbacks.ts \
       packages/api/test/callback-routes.test.js
git commit -m "feat(F052): add crossPost metadata to cross-thread messages (AC-A1)"
```

---

### Task 2: A2A cross-thread exemption — `parseA2AMentions` skip self-filter

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts:60-66,68-91`
- Modify: `packages/api/src/routes/callbacks.ts:228-229`
- Test: `packages/api/test/a2a-mentions.test.js` (existing, extend)
- Test: `packages/api/test/callback-a2a-postmsg.test.js` (existing, extend)

**Step 1: Write failing test — cross-thread @codex should not be filtered**

Add to `packages/api/test/a2a-mentions.test.js`:

```javascript
describe('F052: cross-thread self-reference exemption', () => {
  test('parseA2AMentions with no currentCatId does not filter self', () => {
    const result = parseA2AMentions(
      '@codex 请处理这个任务',
      undefined,  // no currentCatId → cross-thread mode
    );
    assert.ok(result.includes('codex'), 'should include codex when currentCatId is undefined');
  });

  test('parseA2AMentions with currentCatId still filters self', () => {
    const result = parseA2AMentions(
      '@codex 请处理这个任务',
      createCatId('codex'),
    );
    assert.ok(!result.includes('codex'), 'should NOT include codex when it is currentCatId');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/a2a-mentions.test.js --test-name-pattern="cross-thread self-reference"
```

Expected: FAIL — first test fails because `currentCatId` is required

**Step 3: Make `currentCatId` optional in parseA2AMentions**

In `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts`:

Change function signatures (lines 60-66):

```typescript
export function parseA2AMentions(
  text: string,
  currentCatId?: CatId,
  options: A2AMentionParseOptions = {},
): CatId[] {
  return analyzeA2AMentions(text, currentCatId, options).mentions;
}
```

Change analyzeA2AMentions signature (lines 68-72):

```typescript
export function analyzeA2AMentions(
  text: string,
  currentCatId?: CatId,
  options: A2AMentionParseOptions = {},
): A2AMentionAnalysis {
```

Change the self-filter in the entry loop (line 87):

```typescript
// Before
if (id === currentCatId) continue; // 4. Filter self

// After
if (currentCatId && id === currentCatId) continue; // 4. Filter self (skip when cross-thread)
```

**Step 4: Update callbacks.ts to skip self-filter for cross-thread posts**

In `packages/api/src/routes/callbacks.ts`, change lines 228-229:

```typescript
// Before
const senderCatId = createCatId(record.catId);
const targetCats = parseA2AMentions(storedContent, senderCatId, { mode: mentionActionabilityMode });

// After — F52: cross-thread posts skip self-reference filter so @codex can trigger target thread's codex
const senderCatId = createCatId(record.catId);
const isCrossThread = effectiveThreadId !== record.threadId;
const targetCats = parseA2AMentions(
  storedContent,
  isCrossThread ? undefined : senderCatId,
  { mode: mentionActionabilityMode },
);
```

Note: `isCrossThread` is already computed in Task 1. Move its computation before this line (before the parseA2AMentions call, around line 224). The variable should be computed right after the cross-thread threadId resolution block.

**Step 5: Run tests**

```bash
cd packages/api && node --test test/a2a-mentions.test.js --test-name-pattern="F052"
```

Expected: PASS

**Step 6: Write integration test for cross-thread A2A triggering**

Add to `packages/api/test/callback-a2a-postmsg.test.js`:

```javascript
test('F052: cross-thread @codex from codex triggers target thread codex A2A', async () => {
  // Source invocation is codex in thread-A
  const sourceThreadId = 'thread-a2a-source';
  const targetThreadId = 'thread-a2a-target';
  await threadStore.create({ id: targetThreadId, title: 'Target', createdBy: testUserId });

  const { invocationId, callbackToken } = registry.register({
    userId: testUserId,
    catId: 'codex',
    threadId: sourceThreadId,
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    payload: {
      invocationId,
      callbackToken,
      content: '@codex 请处理这个跨线程任务',
      threadId: targetThreadId,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  // Verify mentions include codex (cross-thread exemption)
  const msgs = await messageStore.getByThread(targetThreadId, 10, testUserId);
  const crossMsg = msgs.find((m) => m.content.includes('跨线程任务'));
  assert.ok(crossMsg);
  assert.ok(crossMsg.mentions.includes('codex'), 'cross-thread @codex should be in mentions');
});

test('F052: same-thread @codex from codex still filtered (self-reference)', async () => {
  const threadId = 'thread-self-ref';
  await threadStore.create({ id: threadId, title: 'Self Ref', createdBy: testUserId });

  const { invocationId, callbackToken } = registry.register({
    userId: testUserId,
    catId: 'codex',
    threadId,
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    payload: {
      invocationId,
      callbackToken,
      content: '@codex 请处理',
      threadId,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const msgs = await messageStore.getByThread(threadId, 10, testUserId);
  const msg = msgs.find((m) => m.content.includes('请处理'));
  assert.ok(msg);
  assert.ok(!msg.mentions.includes('codex'), 'same-thread @codex from codex should be filtered');
});
```

**Step 7: Run full test suite**

```bash
cd packages/api && node --test test/callback-a2a-postmsg.test.js
```

Expected: ALL PASS

**Step 8: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts \
       packages/api/src/routes/callbacks.ts \
       packages/api/test/a2a-mentions.test.js \
       packages/api/test/callback-a2a-postmsg.test.js
git commit -m "feat(F052): cross-thread A2A exemption for same-name cats (AC-A2, AC-A3)"
```

---

## Phase B: Context 标注 + UX 展示

### Task 3: Context annotation — `formatMessage` adds `← from thread:xxx`

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/ContextAssembler.ts:77-88`
- Test: `packages/api/test/context-assembler.test.js` (existing, extend)

**Step 1: Write failing test**

Add to `packages/api/test/context-assembler.test.js`:

```javascript
describe('F052: cross-thread source annotation', () => {
  test('formatMessage adds source annotation for cross-thread messages', () => {
    const msg = {
      id: 'test-id',
      threadId: 'target-thread',
      userId: 'user1',
      catId: createCatId('codex'),
      content: 'Hello from another thread',
      mentions: [],
      timestamp: Date.now(),
      origin: 'callback',
      extra: {
        crossPost: { sourceThreadId: 'source-thread-abc123' },
      },
    };
    const result = formatMessage(msg);
    assert.ok(result.includes('← from thread:source-t'), 'should contain source thread annotation');
  });

  test('formatMessage does NOT add annotation for local messages', () => {
    const msg = {
      id: 'test-id',
      threadId: 'local-thread',
      userId: 'user1',
      catId: createCatId('codex'),
      content: 'Hello local',
      mentions: [],
      timestamp: Date.now(),
      origin: 'callback',
    };
    const result = formatMessage(msg);
    assert.ok(!result.includes('← from thread:'), 'local message should NOT have annotation');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/context-assembler.test.js --test-name-pattern="F052"
```

Expected: FAIL

**Step 3: Modify formatMessage**

In `packages/api/src/domains/cats/services/context/ContextAssembler.ts:77-88`:

```typescript
export function formatMessage(
  msg: StoredMessage,
  options?: { truncate?: number },
): string {
  const time = formatTime(msg.timestamp);
  const sender = msg.source ? msg.source.label : getSenderName(msg.catId);
  // F52: Annotate cross-thread messages with source thread
  const crossPostTag = msg.extra?.crossPost?.sourceThreadId
    ? ` ← from thread:${msg.extra.crossPost.sourceThreadId.slice(0, 8)}`
    : '';
  let content = msg.content;
  if (options?.truncate && content.length > options.truncate) {
    content = truncateHeadTail(content, options.truncate);
  }
  return `[${time} ${sender}${crossPostTag}] ${content}`;
}
```

**Step 4: Run tests**

```bash
cd packages/api && node --test test/context-assembler.test.js
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/context/ContextAssembler.ts \
       packages/api/test/context-assembler.test.js
git commit -m "feat(F052): context annotation for cross-thread messages (AC-B1)"
```

---

### Task 4: Frontend — extend ChatMessage type + messages API + UX badge

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts:139`
- Modify: `packages/web/src/hooks/useChatHistory.ts:83,93`
- Modify: `packages/api/src/routes/messages.ts:711`
- Modify: `packages/web/src/components/ChatMessage.tsx:358-368`

**Step 1: Extend frontend ChatMessage type**

In `packages/web/src/stores/chat-types.ts:139`, change:

```typescript
// Before
/** F22: Rich blocks (card, diff, checklist, media gallery) */
extra?: { rich?: { v: 1; blocks: RichBlock[] } };

// After
/** F22+F52: Rich blocks + cross-thread origin */
extra?: {
  rich?: { v: 1; blocks: RichBlock[] };
  crossPost?: { sourceThreadId: string; sourceInvocationId?: string };
};
```

**Step 2: Update messages API to include crossPost in response**

In `packages/api/src/routes/messages.ts:711`, change:

```typescript
// Before
...(m.extra?.rich ? { extra: { rich: m.extra.rich } } : {}),

// After — F52: include crossPost metadata in API response
...(m.extra?.rich || m.extra?.crossPost ? {
  extra: {
    ...(m.extra.rich ? { rich: m.extra.rich } : {}),
    ...(m.extra.crossPost ? { crossPost: m.extra.crossPost } : {}),
  },
} : {}),
```

**Step 3: Update useChatHistory to map crossPost**

In `packages/web/src/hooks/useChatHistory.ts:83`, extend the type annotation for `extra`:

```typescript
// In the map function parameter type, change:
extra?: { rich?: { v: number; blocks: unknown[] } }
// To:
extra?: { rich?: { v: number; blocks: unknown[] }; crossPost?: { sourceThreadId: string; sourceInvocationId?: string } }
```

And at line 93, change:

```typescript
// Before
...(m.extra?.rich ? { extra: { rich: m.extra.rich } } : {}),

// After
...(m.extra?.rich || m.extra?.crossPost ? {
  extra: {
    ...(m.extra.rich ? { rich: m.extra.rich } : {}),
    ...(m.extra.crossPost ? { crossPost: m.extra.crossPost } : {}),
  },
} : {}),
```

**Step 4: Add cross-thread badge in ChatMessage.tsx**

In `packages/web/src/components/ChatMessage.tsx`, in the cat message header area (around line 359-368), add after the whisper badge:

```tsx
{message.extra?.crossPost && (
  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
    转发自 {message.extra.crossPost.sourceThreadId.slice(0, 8)}…
  </span>
)}
```

Insert this right after the existing whisper badge block (after line 368, before the TTS button).

**Step 5: Run type check + build**

```bash
pnpm lint && pnpm --filter @cat-cafe/web build
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/web/src/stores/chat-types.ts \
       packages/web/src/hooks/useChatHistory.ts \
       packages/web/src/components/ChatMessage.tsx \
       packages/api/src/routes/messages.ts
git commit -m "feat(F052): cross-thread UX badge + API mapping (AC-B2)"
```

---

### Task 5: Run full test suite + type check

**Step 1: Run all API tests**

```bash
cd packages/api && pnpm test
```

Expected: ALL PASS

**Step 2: Run type checks**

```bash
pnpm lint
```

Expected: PASS

**Step 3: Run biome checks**

```bash
pnpm check
```

Expected: PASS

**Step 4: Run frontend build**

```bash
pnpm --filter @cat-cafe/web build
```

Expected: PASS

---

## AC Verification Matrix

| AC | Task | Test | Verification |
|----|------|------|-------------|
| AC-A1: crossPost.sourceThreadId stored | Task 1 | callback-routes.test.js "cross-thread post stores" | `assert.strictEqual(msg.extra.crossPost.sourceThreadId, sourceThreadId)` |
| AC-A2: cross-thread @codex triggers A2A | Task 2 | callback-a2a-postmsg.test.js "cross-thread @codex" | `assert.ok(mentions.includes('codex'))` |
| AC-A3: same-thread @codex still blocked | Task 2 | callback-a2a-postmsg.test.js "same-thread @codex" + a2a-mentions.test.js | `assert.ok(!mentions.includes('codex'))` |
| AC-A4: maxDepth still effective | No change needed | Existing test coverage in route-strategies.test.js | `a2aCount < maxDepth` unchanged |
| AC-A5: no duplicate push | Deferred (see note) | — | Existing worklist dedup handles single-thread; cross-thread dedup is a future enhancement |
| AC-B1: context annotation | Task 3 | context-assembler.test.js "F052" | `assert.ok(result.includes('← from thread:'))` |
| AC-B2: frontend badge | Task 4 | Manual verification + type check | "转发自" badge renders when `extra.crossPost` present |

**Note on AC-A5:** The spec says "跨线程 push 通知不重复". The existing `WorklistRegistry.pushToWorklist` already deduplicates within a single thread's pending list. Full cross-thread dedup would require a global invocation tracker, which is out of scope for this PR. The current behavior is safe because `a2aCount < maxDepth` prevents runaway chains. Mark AC-A5 as "partially covered" in the PR description.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` | Add `crossPost` to `extra` type |
| `packages/api/src/domains/cats/services/stores/redis/redis-message-parsers.ts` | Parse `crossPost` from Redis |
| `packages/api/src/routes/callbacks.ts` | Attach crossPost on cross-thread + skip self-filter |
| `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts` | Make `currentCatId` optional |
| `packages/api/src/domains/cats/services/context/ContextAssembler.ts` | Add `← from thread:xxx` annotation |
| `packages/api/src/routes/messages.ts` | Include `crossPost` in API response |
| `packages/web/src/stores/chat-types.ts` | Add `crossPost` to frontend type |
| `packages/web/src/hooks/useChatHistory.ts` | Map `crossPost` from API |
| `packages/web/src/components/ChatMessage.tsx` | Render "转发自" badge |
| `packages/api/test/callback-routes.test.js` | New F052 test suite |
| `packages/api/test/a2a-mentions.test.js` | New F052 cross-thread tests |
| `packages/api/test/callback-a2a-postmsg.test.js` | New F052 integration tests |
| `packages/api/test/context-assembler.test.js` | New F052 context tests |
