---
feature_ids: []
debt_ids: []
topics: [web, ux]
doc_kind: plan
created: 2026-03-01
---

# Thinking Default Collapse + Scroll-to-Bottom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Thinking blocks collapsed by default globally (with a global toggle), while keeping “心里话模式(调试/游戏)” as a thread-level setting; add a one-click “scroll to bottom” button when the user is not at the latest message.

**Architecture:** Decouple UI expansion state from `Thread.thinkingMode`. Introduce a global UI preference stored in localStorage and wired into `ChatMessage` → `ThinkingContent` default expansion. Add a lightweight scroll-position detector in `ChatContainer` to show a floating “↓ 到最新” control using existing refs from `useChatHistory`.

**Tech Stack:** Next.js (client components), Zustand store, Vitest + jsdom, Tailwind.

---

### Task 1: Make Thinking default collapse global (decouple from thread thinkingMode)

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts`
- Modify: `packages/web/src/components/ChatMessage.tsx`
- Modify: `packages/web/src/components/ChatContainer.tsx`
- Modify: `packages/web/src/components/RightStatusPanel.tsx`
- Test: `packages/web/src/components/__tests__/thinking-content-mode.test.ts`
- Test: `packages/web/src/components/__tests__/thinking-mode-toggle.test.ts`

**Step 1: Write failing tests (new behavior)**
- Update tests to assert:
  - Default is collapsed when global pref is unset.
  - Toggling global pref expands/collapses already-rendered blocks.
  - `thinkingMode` (thread-level) no longer affects collapsed/expanded default.

**Step 2: Run tests to verify RED**
Run: `pnpm --filter @cat-cafe/web test packages/web/src/components/__tests__/thinking-content-mode.test.ts`
Expected: FAIL (old behavior still ties expansion to `thinkingMode`).

**Step 3: Implement minimal production code**
- Add a global UI pref in `chatStore`:
  - `uiThinkingExpandedByDefault: boolean` (default `false`)
  - `setUiThinkingExpandedByDefault(next: boolean)` persists to localStorage
- In `ChatMessage`, use `uiThinkingExpandedByDefault` to set `ThinkingContent`’s `defaultExpanded`.
- Remove `thinkingMode` wiring for expansion (keep thread `thinkingMode` for semantics + existing toggle).

**Step 4: Run tests to verify GREEN**
Run: `pnpm --filter @cat-cafe/web test packages/web/src/components/__tests__/thinking-content-mode.test.ts`
Expected: PASS.

**Step 5: Commit**
Run:
`git add -A && git commit -m "fix(web): decouple thinking collapse from thread mode [砚砚/Codex🐾]" -m "Why: thinkingMode is cross-cat visibility; collapse/expand should be global UI preference."`

---

### Task 2: Add “scroll to bottom” one-click button

**Files:**
- Modify: `packages/web/src/components/ChatContainer.tsx`
- (Optional) Create: `packages/web/src/components/ScrollToBottomButton.tsx`
- Test: `packages/web/src/components/__tests__/scroll-to-bottom-button.test.tsx`

**Step 1: Write failing test**
- Render a minimal scroll container + button component and assert:
  - Button hidden when at bottom.
  - Button shows when scrolled up.
  - Clicking button scrolls to bottom.

**Step 2: Run test to verify RED**
Run: `pnpm --filter @cat-cafe/web test packages/web/src/components/__tests__/scroll-to-bottom-button.test.tsx`
Expected: FAIL (component not implemented).

**Step 3: Implement minimal production code**
- Compute “at bottom” with a small threshold (e.g. 120px).
- Show a floating button near bottom-right when not at bottom.
- On click, `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.

**Step 4: Run test to verify GREEN**
Run: `pnpm --filter @cat-cafe/web test packages/web/src/components/__tests__/scroll-to-bottom-button.test.tsx`
Expected: PASS.

**Step 5: Commit**
Run:
`git add -A && git commit -m "feat(web): add scroll-to-bottom button [砚砚/Codex🐾]" -m "Why: reduce fatigue when switching threads or reading history."`

---

### Final verification

Run:
- `pnpm --filter @cat-cafe/web test`
- `pnpm --filter @cat-cafe/web typecheck` (if present)
