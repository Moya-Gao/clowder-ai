# Notice Layer Validation Implementation Plan

**Feature:** #505 — inline notice / system notification layer validation
**Goal:** Unify thread-visible recoverable notices so inline routing hints and restart notices render as in-thread notice bars instead of generic connector bubbles or global toasts.
**Acceptance Criteria:**
- Inline mention routing hint appears in-thread, not as a ConnectorBubble, and not as a global toast.
- Restart interruption notice appears in-thread using the same notice substrate.
- Existing scheduler toast behavior remains toast-only where explicitly marked as toast metadata.
- Existing true connector events (GitHub/Feishu/vote/multi-mention) continue to render via ConnectorBubble.
- Design truth sources are refreshed to document the notice taxonomy and thread-vs-toast distinction.
**Architecture:** Keep persisted thread notices on the existing `source`/`connector_message` path for history/socket compatibility, but add a dedicated frontend notice rendering path for a small allowlist of notice-like connector sources. Normalize affected backend emitters to mark those notices explicitly and test both live socket and history hydration behavior.
**Tech Stack:** Next.js, React, Tailwind, Node test suites (Vitest + node:test), existing message store/socket protocol.
**前端验证:** Yes — thread timeline rendering and non-toast behavior must be exercised.

---

### Task 1: Pin the notice contract

**Files:**
- Modify: `docs/design-system.md`
- Modify: `docs/features/F098-callback-message-ux.md`
- Modify: `docs/features/F048-restart-recovery.md`
- Test: n/a

**Step 1: Write the contract delta**

Define the final taxonomy:
- thread-visible recoverable/system notices = in-thread notice bar
- explicit scheduler lifecycle toast = toast only
- external integrations = ConnectorBubble

**Step 2: Record explicit non-goals**

State that this change does not alter:
- A2A routing semantics
- scheduler hiddenTrigger behavior
- existing GitHub/Feishu/vote connector presentation

**Step 3: Verify docs point to the same split**

Check that design-system and feature docs no longer conflict on:
- in-thread notice vs toast
- notice vs connector bubble

### Task 2: Write failing frontend tests for notice rendering

**Files:**
- Create: `packages/web/src/components/__tests__/chat-message-notice-rendering.test.tsx`
- Modify: `packages/web/src/components/ConnectorBubble.tsx` (if needed by test harness)
- Modify: `packages/web/src/components/ChatMessage.tsx`

**Step 1: Write failing tests**

Cover:
- `inline-mention-hint` renders as notice bar, not connector bubble
- `startup-reconciler` renders as notice bar, not connector bubble
- `vote-result` still renders as connector bubble
- scheduler toast metadata does not create an in-thread notice by itself

**Step 2: Run the focused test file**

Run the new web test file and confirm it fails for the expected reason.

### Task 3: Implement frontend notice rendering path

**Files:**
- Create: `packages/web/src/components/SystemNoticeBar.tsx`
- Modify: `packages/web/src/components/ChatMessage.tsx`
- Modify: `packages/web/src/stores/chat-types.ts` (only if extra/source typing needs notice metadata)

**Step 1: Add minimal notice component**

Implement a lightweight in-thread notice bar:
- centered / text-first
- no conversational avatar
- supports icon + label + content
- lighter than ConnectorBubble

**Step 2: Route notice-like connector sources to the new component**

Keep `type='connector'` for storage compatibility, but intercept known notice connectors before `ConnectorBubble`.

**Step 3: Re-run focused frontend tests**

Confirm the new rendering path turns the RED tests GREEN.

### Task 4: Write failing backend tests for notice metadata and affected emitters

**Files:**
- Modify: `packages/api/test/startup-reconciler.test.js`
- Modify: `packages/api/test/a2a-mentions.test.js` or relevant route-serial test file
- Modify: `packages/api/src/domains/cats/services/agents/invocation/StartupReconciler.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`

**Step 1: Write failing tests**

Cover:
- startup reconciler notice is emitted with explicit notice metadata
- inline routing hint is emitted with explicit notice metadata
- both remain persisted through the existing `source` path

**Step 2: Run focused API tests**

Confirm failures are due to missing notice metadata / shape.

### Task 5: Implement backend normalization

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/StartupReconciler.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Modify: `packages/api/src/routes/messages.ts` (only if serialization of source.meta requires extension)

**Step 1: Add explicit notice metadata to affected sources**

Use a stable marker under `source.meta` so frontend/history/socket can recognize in-thread notices.

**Step 2: Keep current socket/history behavior intact**

Do not introduce a new persisted message type. Preserve connector transport compatibility.

**Step 3: Re-run focused API tests**

Turn the failing tests GREEN.

### Task 6: Regression and verification

**Files:**
- Test only

**Step 1: Run focused frontend and API suites**

Expected:
- new notice rendering tests pass
- startup reconciler / route-serial tests pass

**Step 2: Run adjacent regression tests**

Include:
- connector bubble theme tests
- scheduler hiddenTrigger / queue visibility tests if touched

**Step 3: Manual verification checklist**

Validate:
- inline routing hint is in-thread and not toast
- restart notice is in-thread and not connector card
- scheduler lifecycle toast still uses toast path
- GitHub/Feishu/vote connector messages stay unchanged

### Task 7: Prepare review handoff

**Files:**
- Possibly modify: review notes / issue comment if implementation clarifies the contract

**Step 1: Summarize behavior changes**

List:
- what changed visually
- what stayed connector-based
- what stayed toast-only

**Step 2: Attach verification evidence**

Include exact test commands and results for `@opus` review.
