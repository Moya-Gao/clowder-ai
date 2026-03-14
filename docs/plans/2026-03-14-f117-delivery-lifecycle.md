# F117: Message Delivery Lifecycle — Implementation Plan

**Feature:** F117 — `docs/features/F117-message-delivery-lifecycle.md`
**Goal:** Undelivered user messages must not appear in timeline, history API, or prompt context.
**Acceptance Criteria:**
- AC-A1: Message 模型支持 `deliveryStatus` 字段，老数据兼容
- AC-A2: enqueue 持久化 message 时 `deliveryStatus='queued'`
- AC-A3: History API 默认排除 `queued` 和 `canceled` 消息
- AC-A4: ContextAssembler 只组装 `delivered` 消息（含无 deliveryStatus 的历史兼容）
- AC-A5: dequeue 执行时 message 标为 `delivered` + 扩展 `messages_delivered` 事件
- AC-A6: withdraw 将 message 标 `canceled` + 发 `message_deleted`
- AC-A7: clear 队列批量标 `canceled` + 发批量 `message_deleted`
- AC-A8: 回归测试——queue send → cancel → history API 不返回、ContextAssembler 不组装
- AC-A9: queue send 带 @mention → delivered 前 pending-mentions 不返回；delivered 后才出现
- AC-B1: queue send 不做乐观插入到主聊天流
- AC-B2: `messages_delivered` 事件触发 user bubble 插入主时间线
- AC-B3: `message_deleted` 事件触发 store 移除
- AC-B4: F5 刷新后 queued/canceled 消息不出现在聊天流
- AC-B5: QueuePanel 功能不受影响
- AC-B6: queue send 多行消息不出现 optimistic bubble；delivered 后只出现一次
**Architecture:** Add `deliveryStatus` field to StoredMessage. Filter at 3 read surfaces (history/context/mentions). Extend existing `markDelivered()` to also set status. Withdraw/clear marks messages canceled.
**Tech Stack:** TypeScript, node:test, vitest
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Existing Infrastructure (Don't Rebuild)

Already in place:
- `StoredMessage.deliveredAt?: number` — timestamp set at dequeue (F098-D)
- `messageStore.markDelivered(id, timestamp)` — sets deliveredAt (line 486)
- `QueueProcessor.executeEntry()` — calls markDelivered + emits `messages_delivered` (lines 315-334)
- Frontend `useSocket.ts` — handles `messages_delivered` (line 406) and `message_deleted` (line 344)
- `useChatStore.markMessagesDelivered()` — store method exists

## Terminal Schema

```typescript
// StoredMessage (add to existing interface)
deliveryStatus?: 'queued' | 'delivered' | 'canceled';
// undefined = legacy message, treated as 'delivered'
```

Filter predicate (reuse everywhere):
```typescript
function isDelivered(msg: StoredMessage): boolean {
  return !msg.deliveryStatus || msg.deliveryStatus === 'delivered';
}
```

---

## Phase A: Backend — deliveryStatus 真相源

### Task 1: Add deliveryStatus to StoredMessage + isDelivered helper (AC-A1)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts:69` (add field after deliveredAt)
- Create: `packages/api/test/delivery-status.test.js` (new test file)

**Step 1: Write failing test** — message with no deliveryStatus is treated as delivered

```javascript
// test: isDelivered returns true for legacy messages (no deliveryStatus)
// test: isDelivered returns true for deliveryStatus='delivered'
// test: isDelivered returns false for deliveryStatus='queued'
// test: isDelivered returns false for deliveryStatus='canceled'
```

**Step 2: Run test → FAIL** (isDelivered not defined)

**Step 3: Add `deliveryStatus` field to StoredMessage interface + implement `isDelivered()`**

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): add deliveryStatus field + isDelivered helper`

---

### Task 2: Enqueue writes deliveryStatus='queued' (AC-A2)

**Files:**
- Modify: `packages/api/src/routes/messages.ts:250-262` (set deliveryStatus on append)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — POST /api/messages with deliveryMode=queue → stored message has deliveryStatus='queued'

**Step 2: Run test → FAIL**

**Step 3: In messages.ts enqueue path, add `deliveryStatus: 'queued'` to messageStore.append() call**

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): enqueue sets deliveryStatus='queued'`

---

### Task 3: History API filters by deliveryStatus (AC-A3)

**Files:**
- Modify: `packages/api/src/routes/messages.ts:700-755` (filter results)
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (getByThread filter)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — GET /api/messages returns only delivered + legacy messages, not queued/canceled

**Step 2: Run test → FAIL**

**Step 3: Add filter in history API response mapping (line ~719) using `isDelivered()`**
- Option A: Filter in MessageStore.getByThread() query
- Option B: Filter in route handler after fetch (simpler, no store API change)
- Choose B: post-fetch filter with `messages.filter(isDelivered)` — smaller blast radius

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): history API excludes queued/canceled messages`

---

### Task 4: ContextAssembler filters by deliveryStatus (AC-A4)

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/ContextAssembler.ts:113` (filter before formatting)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — assembleContext with mix of delivered/queued/canceled messages → only delivered appear in output

**Step 2: Run test → FAIL**

**Step 3: Add `messages.filter(isDelivered)` before the slice/format loop**

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): ContextAssembler excludes undelivered messages`

---

### Task 5: Dequeue sets deliveryStatus='delivered' + extends event payload (AC-A5)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts:315-334`
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts:486-491` (markDelivered also sets deliveryStatus)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — after markDelivered(), message has deliveryStatus='delivered'

**Step 2: Run test → FAIL**

**Step 3: In markDelivered(), also set `deliveryStatus: 'delivered'`**
- In QueueProcessor, extend `messages_delivered` event payload: add `messages` array with `{ id, content, catId, timestamp }` so frontend can render the user bubble

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): markDelivered sets deliveryStatus + extends event payload`

---

### Task 6: Withdraw marks message canceled + emits message_deleted (AC-A6)

**Files:**
- Modify: `packages/api/src/routes/queue.ts:99-128` (withdraw endpoint)
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (add markCanceled method)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — DELETE /api/threads/:id/queue/:entryId → message.deliveryStatus='canceled' + message_deleted emitted

**Step 2: Run test → FAIL**

**Step 3:**
- Add `markCanceled(id)` to MessageStore (sets `deliveryStatus: 'canceled'`)
- In queue.ts withdraw handler: after removing queue entry, call `markCanceled()` for entry.messageId + entry.mergedMessageIds
- Emit `message_deleted` for each canceled message

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): withdraw marks message canceled + emits message_deleted`

---

### Task 7: Clear queue marks all messages canceled (AC-A7)

**Files:**
- Modify: `packages/api/src/routes/queue.ts:249-263` (clear endpoint)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — DELETE /api/threads/:id/queue (clear all) → all queue entry messages marked canceled + message_deleted emitted

**Step 2: Run test → FAIL**

**Step 3: In clear handler, before clearing: collect all entries' messageIds, then after clear call markCanceled() for each + emit message_deleted batch

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): clear queue marks all messages canceled`

---

### Task 8: Pending-mentions filters by deliveryStatus (AC-A9)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (getMentionsFor / getRecentMentionsFor filter)
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write failing test** — queued message with @mention → getMentionsFor does not return it; after markDelivered → it appears

**Step 2: Run test → FAIL**

**Step 3: Add `isDelivered()` filter in getMentionsFor() and getRecentMentionsFor()

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): pending-mentions excludes undelivered messages`

---

### Task 9: Integration regression test (AC-A8)

**Files:**
- Test: `packages/api/test/delivery-status.test.js` (extend)

**Step 1: Write integration test** — full flow: queue send → message has deliveryStatus='queued' → cancel → message has deliveryStatus='canceled' → history API doesn't return it → ContextAssembler doesn't include it → mentions don't include it

**Step 2: Run test → PASS** (should pass since all prior tasks are done)

**Step 3: Commit** `test(F117): add delivery lifecycle integration regression test`

---

## Phase B: Frontend — 适配

### Task 10: Queue send skips optimistic insert (AC-B1, AC-B6)

**Files:**
- Modify: `packages/web/src/hooks/useSendMessage.ts:95-100` (conditional on queue mode)
- Test: `packages/web/src/hooks/__tests__/useSendMessage.test.ts` (if exists, extend; else create)

**Step 1: Write failing test** — when deliveryMode='queue', addMessage is NOT called

**Step 2: Run test → FAIL**

**Step 3: Wrap lines 95-100 in `if (!isQueueSend) { ... }` — only do optimistic insert for non-queue sends

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): skip optimistic insert for queue sends`

---

### Task 11: messages_delivered event inserts user bubble (AC-B2)

**Files:**
- Modify: `packages/web/src/hooks/useSocket.ts:406-408` (extend handler)
- Modify: Zustand store (useChatStore) to support inserting a full message from delivery event
- Test: `packages/web/src/hooks/__tests__/useSocket.test.ts` or similar

**Step 1: Write failing test** — on 'messages_delivered' event with message payload → message appears in store

**Step 2: Run test → FAIL**

**Step 3:**
- In useSocket.ts `messages_delivered` handler: if event payload includes `messages` array, call `addMessage()` for each
- Existing `markMessagesDelivered()` still runs for backward compat

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F117): messages_delivered event inserts user bubble into timeline`

---

### Task 12: message_deleted removes from store (AC-B3)

**Files:**
- Verify: `packages/web/src/hooks/useSocket.ts:344-346` (existing handler)
- Test: verify existing handler covers this case

**Step 1: Verify** existing `message_deleted` handler already removes message from store. If yes → AC-B3 is already covered, just add a test. If no → implement.

**Step 2: Commit** `test(F117): verify message_deleted removes message from store`

---

### Task 13: QueuePanel unaffected (AC-B5) + F5 hydration (AC-B4)

**Files:**
- Test: manual + automated verification

**Step 1: Write test** — QueuePanel still shows queued entries via queue_updated events (existing behavior, no code change needed)

**Step 2: Write test** — After F5 reload, history API returns only delivered messages → no queued/canceled bubbles in chat

**Step 3: Commit** `test(F117): verify QueuePanel + F5 hydration behavior`

---

## Commit Order Summary

| # | Commit | AC |
|---|--------|----|
| 1 | `feat(F117): add deliveryStatus field + isDelivered helper` | A1 |
| 2 | `feat(F117): enqueue sets deliveryStatus='queued'` | A2 |
| 3 | `feat(F117): history API excludes queued/canceled messages` | A3 |
| 4 | `feat(F117): ContextAssembler excludes undelivered messages` | A4 |
| 5 | `feat(F117): markDelivered sets deliveryStatus + extends event payload` | A5 |
| 6 | `feat(F117): withdraw marks message canceled + emits message_deleted` | A6 |
| 7 | `feat(F117): clear queue marks all messages canceled` | A7 |
| 8 | `feat(F117): pending-mentions excludes undelivered messages` | A9 |
| 9 | `test(F117): delivery lifecycle integration regression test` | A8 |
| 10 | `feat(F117): skip optimistic insert for queue sends` | B1, B6 |
| 11 | `feat(F117): messages_delivered inserts user bubble into timeline` | B2 |
| 12 | `test(F117): verify message_deleted removes from store` | B3 |
| 13 | `test(F117): verify QueuePanel + F5 hydration behavior` | B4, B5 |
