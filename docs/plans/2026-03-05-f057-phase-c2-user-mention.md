# F057 Phase C2: 猫 @ 铲屎官 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Cats can @铲屎官 in their messages, and the frontend highlights threads with unread user-mentions.

**Architecture:** Add `@user`/`@铲屎官` detection to the backend post-message flow. Carry `mentionsUser: true` flag through WS broadcast. Frontend tracks `hasUserMention` per thread and renders an enhanced unread badge (🐾 paw) on the ThreadItem.

**Tech Stack:** Fastify (API callbacks), Zustand (chatStore), React (ThreadItem/ThreadCatStatus)

**Not building:** Full notification system (push/email/sound). This is visual-only: badge in sidebar.

---

## Terminal Schema

```typescript
// StoredMessage — add one field
mentionsUser?: boolean;  // true when message contains @user/@铲屎官

// WS broadcast payload — add one field
mentionsUser?: boolean;

// ThreadState — add one field
hasUserMention: boolean;  // true when thread has unread @user mention
```

---

### Task 1: Backend — detect @user/@铲屎官 in cat messages

**Files:**
- Create: `packages/api/test/user-mention-detection.test.js`
- Modify: `packages/api/src/routes/callbacks.ts:224-228`

**Step 1: Write the failing test**

```javascript
// packages/api/test/user-mention-detection.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We'll test the exported helper directly
import { detectUserMention } from '../src/routes/callbacks.js';

describe('detectUserMention', () => {
  it('detects @铲屎官 at line start', () => {
    assert.equal(detectUserMention('请看这个\n@铲屎官\n帮忙确认'), true);
  });

  it('detects @user at line start', () => {
    assert.equal(detectUserMention('@user 请帮忙看看'), true);
  });

  it('ignores @铲屎官 in middle of line', () => {
    assert.equal(detectUserMention('告诉@铲屎官这件事'), false);
  });

  it('ignores @user inside code block', () => {
    assert.equal(detectUserMention('```\n@user\n```'), false);
  });

  it('returns false for no mention', () => {
    assert.equal(detectUserMention('普通消息没有 mention'), false);
  });

  it('handles leading whitespace before @user', () => {
    assert.equal(detectUserMention('  @铲屎官 看看'), true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/user-mention-detection.test.js`
Expected: FAIL — `detectUserMention` not exported.

**Step 3: Implement `detectUserMention` in callbacks.ts**

Add at `packages/api/src/routes/callbacks.ts` (near the top, after imports):

```typescript
/**
 * F057-C2: Detect @user/@铲屎官 mention at line start (same rule as cat mentions).
 * Strips fenced code blocks first. Case-insensitive.
 */
const USER_MENTION_PATTERNS = ['@user', '@铲屎官'];

export function detectUserMention(text: string): boolean {
  const stripped = text.replace(/```[\s\S]*?```/g, '');
  const lines = stripped.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trimStart().toLowerCase();
    for (const pattern of USER_MENTION_PATTERNS) {
      if (trimmed.startsWith(pattern)) return true;
    }
  }
  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/user-mention-detection.test.js`
Expected: PASS (6/6)

**Step 5: Commit**

```
test+feat(F057): add @user/@铲屎官 detection helper [布偶猫/宪宪]
```

---

### Task 2: Backend — wire detection into post-message + WS broadcast

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts:240-260` (post-message handler)
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts:50` (StoredMessage type)
- Test: add integration case to `packages/api/test/callback-routes.test.js`

**Step 1: Add `mentionsUser` to StoredMessage**

In `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts`, add after `whisperTo`:

```typescript
/** F057-C2: Whether this message mentions the user (@user / @铲屎官) */
mentionsUser?: boolean;
```

**Step 2: Wire into post-message handler**

In `packages/api/src/routes/callbacks.ts`, after `const mentions: CatId[] = [...targetCats];` (line ~228), add:

```typescript
const mentionsUser = detectUserMention(storedContent);
```

Then in the `messageStore.append` call (~line 240), add:

```typescript
...(mentionsUser ? { mentionsUser } : {}),
```

And in the `socketManager.broadcastAgentMessage` call (~line 251), add:

```typescript
...(mentionsUser ? { mentionsUser } : {}),
```

**Step 3: Write integration test**

Add to `packages/api/test/callback-routes.test.js` (find the post-message describe block):

```javascript
it('detects @铲屎官 mention and includes mentionsUser in broadcast', async () => {
  // Post a message containing @铲屎官
  const res = await postMessage({
    content: '完成了！\n@铲屎官\n请检查',
  });
  assert.equal(res.statusCode, 200);
  // Verify broadcast included mentionsUser
  const lastBroadcast = socketManager.lastBroadcast;
  assert.equal(lastBroadcast?.mentionsUser, true);
});
```

Note: Adapt to the existing test pattern in `callback-routes.test.js` — use the existing mock setup and helper functions.

**Step 4: Run tests**

Run: `cd packages/api && node --test test/callback-routes.test.js`
Expected: All pass including new test.

**Step 5: Commit**

```
feat(F057): wire @user detection into post-message + WS broadcast [布偶猫/宪宪]
```

---

### Task 3: Frontend — track `hasUserMention` in ThreadState + chatStore

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts:295-340` (ThreadState + DEFAULT)
- Modify: `packages/web/src/stores/chatStore.ts:580-595` (background message handler)
- Test: `packages/web/src/stores/__tests__/chatStore-multithread.test.ts` (add case)

**Step 1: Add `hasUserMention` to ThreadState**

In `packages/web/src/stores/chat-types.ts`:

```typescript
// After unreadCount: number; (line 308)
/** F057-C2: Thread has an unread @user mention from a cat */
hasUserMention: boolean;
```

In DEFAULT_THREAD_STATE:

```typescript
// After unreadCount: 0,
hasUserMention: false,
```

**Step 2: Update chatStore background message handler**

In `packages/web/src/stores/chatStore.ts`, in the `addMessageToThread` handler for background threads (~line 584-594), update:

```typescript
[threadId]: {
  ...existing,
  messages: [...existing.messages, msg],
  unreadCount: existing.unreadCount + 1,
  ...(msg.mentionsUser ? { hasUserMention: true } : {}),
  lastActivity: Date.now(),
},
```

Also need to handle the ChatMessage type to include `mentionsUser`. Check where ChatMessage is defined:

In `packages/web/src/stores/chat-types.ts`, find `ChatMessage` interface and add:

```typescript
mentionsUser?: boolean;
```

**Step 3: Clear `hasUserMention` when clearing unread**

In chatStore's `clearUnread` action (~line 775-784):

```typescript
[threadId]: { ...ts, unreadCount: 0, hasUserMention: false },
```

**Step 4: Write test**

Add to `packages/web/src/stores/__tests__/chatStore-multithread.test.ts`:

```typescript
it('sets hasUserMention when background message has mentionsUser', () => {
  const store = useChatStore.getState();
  store.addMessageToThread('other-thread', {
    id: 'msg-user-mention',
    type: 'assistant',
    catId: 'opus',
    content: '@铲屎官 请看',
    mentionsUser: true,
    timestamp: Date.now(),
  });
  const ts = useChatStore.getState().threadStates['other-thread'];
  expect(ts?.hasUserMention).toBe(true);
});

it('clears hasUserMention on clearUnread', () => {
  const store = useChatStore.getState();
  store.clearUnread('other-thread');
  const ts = useChatStore.getState().threadStates['other-thread'];
  expect(ts?.hasUserMention).toBe(false);
});
```

**Step 5: Run tests**

Run: `pnpm --filter @cat-cafe/web test -- --testPathPattern chatStore-multithread`
Expected: All pass.

**Step 6: Commit**

```
feat(F057): track hasUserMention in ThreadState + clearUnread [布偶猫/宪宪]
```

---

### Task 4: Frontend — parse `mentionsUser` from WS event

**Files:**
- Modify: `packages/web/src/hooks/useSocket-background-system-info.ts` or the main WS message handler that creates ChatMessage objects from socket events

Find where WS `text` events create ChatMessage objects for background threads. The `mentionsUser` field from the broadcast needs to be forwarded into the ChatMessage.

**Step 1: Find the WS → ChatMessage mapping**

Search for where `addMessageToThread` is called with WS data. It's likely in `useAgentMessages.ts` or the socket event handler.

**Step 2: Add `mentionsUser` forwarding**

Where the ChatMessage is constructed from the WS event payload, add:

```typescript
...(data.mentionsUser ? { mentionsUser: true } : {}),
```

**Step 3: Test**

Covered by Task 3's test + existing WS integration tests. Run:

Run: `pnpm --filter @cat-cafe/web test`
Expected: All pass.

**Step 4: Commit**

```
feat(F057): forward mentionsUser from WS event to ChatMessage [布偶猫/宪宪]
```

---

### Task 5: Frontend — render enhanced badge for @user mentions

**Files:**
- Modify: `packages/web/src/components/ThreadCatStatus.tsx`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadItem.tsx:247-249`
- Test: `packages/web/src/components/__tests__/ThreadCatStatus.test.ts`

**Step 1: Write failing test**

Add to `packages/web/src/components/__tests__/ThreadCatStatus.test.ts`:

```typescript
it('shows paw badge when hasUserMention is true', () => {
  render(<ThreadCatStatus threadState={{ ...DEFAULT_THREAD_STATE, unreadCount: 1 }} unreadCount={1} hasUserMention={true} />);
  expect(screen.getByTitle('猫猫 @ 了你')).toBeInTheDocument();
});
```

**Step 2: Update ThreadCatStatus component**

In `packages/web/src/components/ThreadCatStatus.tsx`, add `hasUserMention` prop:

```typescript
export function ThreadCatStatus({ threadState, unreadCount, hasUserMention }: {
  threadState: ThreadState;
  unreadCount: number;
  hasUserMention?: boolean;
}) {
```

Add before the unreadCount badge:

```tsx
{hasUserMention && (
  <span className="text-[11px]" title="猫猫 @ 了你">🐾</span>
)}
```

And change the unread badge color when hasUserMention:

```tsx
{unreadCount > 0 && (
  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-bold leading-none ${
    hasUserMention ? 'bg-red-500' : 'bg-amber-500'
  }`}>
    {unreadCount > 99 ? '99+' : unreadCount}
  </span>
)}
```

**Step 3: Pass `hasUserMention` from ThreadItem**

In `packages/web/src/components/ThreadSidebar/ThreadItem.tsx`, at the ThreadCatStatus usage (~line 248):

```tsx
{threadState && (
  <ThreadCatStatus
    threadState={threadState}
    unreadCount={threadState.unreadCount}
    hasUserMention={threadState.hasUserMention}
  />
)}
```

**Step 4: Run tests**

Run: `pnpm --filter @cat-cafe/web test`
Expected: All pass.

**Step 5: Commit**

```
feat(F057): enhanced badge (🐾 + red) for @user mentions in sidebar [布偶猫/宪宪]
```

---

### Task 6: Frontend — highlight @铲屎官 in message content

**Files:**
- Modify: `packages/web/src/lib/mention-highlight.ts`
- Test: existing mention highlight tests

**Step 1: Add @user/@铲屎官 to mention regex**

In `packages/web/src/lib/mention-highlight.ts`, add user mention patterns alongside cat mentions.

In `buildMentionRe`, after building cat aliases, append `'user', '铲屎官'` to the alias list. Map them to a special `_user` id.

In `buildMentionColor`, add `_user` → a distinctive color (e.g. `#E91E63` pink).

**Step 2: Test**

Run: `pnpm --filter @cat-cafe/web test -- --testPathPattern mention`
Expected: All pass (check if existing tests need updating).

**Step 3: Commit**

```
feat(F057): highlight @铲屎官/@user in message content [布偶猫/宪宪]
```

---

### Task 7: Update spec + build check

**Files:**
- Modify: `docs/features/F057-thread-discoverability.md` — check AC-C2
- Run: `pnpm check && pnpm lint && pnpm --filter @cat-cafe/web test && pnpm --filter @cat-cafe/api test`

**Step 1: Mark AC-C2 complete in spec**

```markdown
- [x] AC-C2: 猫猫能 @ 铲屎官，铲屎官在 thread 列表看到未读高亮
```

**Step 2: Full build + test**

Run:
```bash
pnpm check && pnpm lint
pnpm --filter @cat-cafe/api test
pnpm --filter @cat-cafe/web test
```

Expected: All green.

**Step 3: Commit**

```
docs(F057): mark AC-C2 complete [布偶猫/宪宪]
```
