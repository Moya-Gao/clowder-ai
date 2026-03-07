# F063 Gap 3: Runtime/Audit Explorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Replace the "在 VSCode 中打开" audit link in RightStatusPanel with an inline audit event viewer + session transcript browser, so 铲屎官 never needs to leave Hub to read audit logs or session events.

**Architecture:** Add a new `AuditExplorerPanel` component that renders inside RightStatusPanel (replacing the current 3-line audit section). It has 3 tabs: Audit Events (thread-level 7-day log), Session Events (paginated transcript viewer per session), and Session Search (full-text across transcripts/digests). All API endpoints already exist — this is pure frontend work + tests.

**Tech Stack:** React 18 + Tailwind CSS + existing `apiFetch()` utility. No new API endpoints needed.

**Not building:** Log file raw download, event export to CSV, cross-thread audit comparison, real-time streaming (poll on manual refresh).

---

## Terminal Schema

```typescript
// Tab modes for AuditExplorerPanel
type AuditTab = 'events' | 'session' | 'search';

// AuditExplorerPanel props — injected into RightStatusPanel
interface AuditExplorerPanelProps {
  threadId: string;
  sessions: SessionSummary[]; // reuse from SessionChainPanel
}

// Session event viewer state
interface SessionViewerState {
  sessionId: string;
  view: 'raw' | 'chat' | 'handoff';
  events: TranscriptEvent[] | ChatMessage[] | HandoffSummary[];
  cursor: number | null;
  total: number;
  loading: boolean;
}
```

---

## Task 1: AuditEventsTab component

Renders thread-level audit events from `GET /api/audit/thread/:threadId`.
Replaces the current "在 VSCode 中打开" link.

**Files:**
- Create: `packages/web/src/components/audit/AuditEventsTab.tsx`
- Test: `packages/web/test/audit-events-tab.test.tsx`

**Step 1: Write failing test**

Test that AuditEventsTab renders event list from API response.
Mock `apiFetch` → return 3 sample events → assert event type + timestamp rendered.

**Step 2: Run test, verify FAIL**

Run: `cd packages/web && pnpm test -- --grep "AuditEventsTab"`
Expected: FAIL (component doesn't exist)

**Step 3: Implement AuditEventsTab**

```
AuditEventsTab({ threadId })
├── useEffect: fetch /api/audit/thread/{threadId}
├── Loading spinner (reuse pattern from SessionChainPanel)
├── Event list (scrollable, max-h-64)
│   └── Each event row:
│       ├── Type badge (colored by event.type)
│       ├── Timestamp (timeAgo format)
│       ├── Data summary (JSON.stringify truncated to 120 chars)
│       └── Expand/collapse for full data (JSON formatted)
├── Empty state: "最近 7 天无审计事件"
└── Error state: inline error message
```

**Step 4: Run test, verify PASS**

**Step 5: Commit**

```bash
git add packages/web/src/components/audit/AuditEventsTab.tsx packages/web/test/audit-events-tab.test.tsx
git commit -m "feat(F063): AuditEventsTab — thread audit event viewer"
```

---

## Task 2: SessionEventsViewer component

Paginated session transcript viewer with 3 view modes (raw/chat/handoff).
Triggered by clicking a session in SessionChainPanel.

**Files:**
- Create: `packages/web/src/components/audit/SessionEventsViewer.tsx`
- Test: `packages/web/test/session-events-viewer.test.tsx`

**Step 1: Write failing test**

Test 3 scenarios:
1. view=chat renders messages with role badges
2. view=handoff renders invocation summaries with tool/error counts
3. Pagination: "下一页" button fetches with nextCursor

**Step 2: Run test, verify FAIL**

**Step 3: Implement SessionEventsViewer**

```
SessionEventsViewer({ sessionId, onClose })
├── Header: "Session #N Events" + close button + view mode toggle (chat/handoff/raw)
├── useEffect: fetch /api/sessions/{sessionId}/events?view={mode}&cursor={c}&limit=30
├── Content area (scrollable):
│   ├── view=chat: message bubbles (role color-coded, timestamp)
│   ├── view=handoff: invocation cards (id, duration, tools, errors, key messages)
│   └── view=raw: monospace JSON event list (type + timestamp + collapsible data)
├── Pagination bar: "← 上一页 | 第 N 页 | 下一页 →"
├── Footer: "{total} 条事件"
└── Loading/error/empty states
```

**Step 4: Run test, verify PASS**

**Step 5: Commit**

```bash
git add packages/web/src/components/audit/SessionEventsViewer.tsx packages/web/test/session-events-viewer.test.tsx
git commit -m "feat(F063): SessionEventsViewer — paginated transcript browser"
```

---

## Task 3: SessionSearchTab component

Full-text search across session transcripts and digests.

**Files:**
- Create: `packages/web/src/components/audit/SessionSearchTab.tsx`
- Test: `packages/web/test/session-search-tab.test.tsx`

**Step 1: Write failing test**

Test: type query → submit → results rendered with session ID + snippet + highlight.

**Step 2: Run test, verify FAIL**

**Step 3: Implement SessionSearchTab**

```
SessionSearchTab({ threadId })
├── Search form: input + scope dropdown (both/digests/transcripts) + submit button
├── useCallback: fetch /api/threads/{threadId}/sessions/search?q={query}&scope={scope}
├── Results list:
│   └── Each hit:
│       ├── Session ID badge (clickable → opens SessionEventsViewer)
│       ├── Cat ID color dot
│       ├── Content snippet with query highlighted (bold)
│       └── Context preview (truncated)
├── Empty state: "无匹配结果"
└── Loading/error states
```

**Step 4: Run test, verify PASS**

**Step 5: Commit**

```bash
git add packages/web/src/components/audit/SessionSearchTab.tsx packages/web/test/session-search-tab.test.tsx
git commit -m "feat(F063): SessionSearchTab — full-text session search"
```

---

## Task 4: AuditExplorerPanel — compose tabs + integrate into RightStatusPanel

Wire the 3 components into a tabbed panel. Replace the old audit section in RightStatusPanel.

**Files:**
- Create: `packages/web/src/components/audit/AuditExplorerPanel.tsx`
- Create: `packages/web/src/components/audit/index.ts` (barrel export)
- Modify: `packages/web/src/components/RightStatusPanel.tsx` (~line 384-398)
- Test: `packages/web/test/audit-explorer-panel.test.tsx`

**Step 1: Write failing test**

Test: AuditExplorerPanel renders 3 tabs, clicking each tab shows corresponding content.
Test: SessionChainPanel sealed session click opens SessionEventsViewer.

**Step 2: Run test, verify FAIL**

**Step 3: Implement AuditExplorerPanel**

```
AuditExplorerPanel({ threadId, sessions })
├── Tab bar: [审计事件] [Session 浏览] [搜索] — same pattern as WorkspacePanel tabs
├── Tab content:
│   ├── 'events': <AuditEventsTab threadId={threadId} />
│   ├── 'session': session picker dropdown + <SessionEventsViewer sessionId={selected} />
│   └── 'search': <SessionSearchTab threadId={threadId} />
└── Collapsed by default (expand arrow like historyOpen pattern)
```

**Step 4: Replace old audit section in RightStatusPanel**

Remove lines 384-398 (the old "在 VSCode 中打开" section).
Insert `<AuditExplorerPanel threadId={threadId} sessions={sessions} />`.

Pass sessions from SessionChainPanel via shared state or prop drilling.

**Step 5: Run test, verify PASS**

**Step 6: Run full web test suite**

Run: `cd packages/web && pnpm test`
Expected: all pass

**Step 7: Commit**

```bash
git add packages/web/src/components/audit/ packages/web/src/components/RightStatusPanel.tsx packages/web/test/audit-explorer-panel.test.tsx
git commit -m "feat(F063): AuditExplorerPanel — replace VSCode link with inline audit browser"
```

---

## Task 5: SessionChainPanel integration — click sealed session → viewer

Add click handler to sealed session rows in SessionChainPanel to open SessionEventsViewer.

**Files:**
- Modify: `packages/web/src/components/SessionChainPanel.tsx`
- Modify: `packages/web/src/components/audit/AuditExplorerPanel.tsx` (receive selected session callback)
- Test: `packages/web/test/session-chain-audit-link.test.tsx`

**Step 1: Write failing test**

Test: clicking sealed session row calls onViewSession(sessionId).

**Step 2: Run test, verify FAIL**

**Step 3: Add click handler to sealed session rows**

Add `onViewSession?: (sessionId: string) => void` prop to SessionChainPanel.
On sealed session row click → call `onViewSession(session.id)`.
In RightStatusPanel, wire callback to switch AuditExplorerPanel to session tab + set selected session.

**Step 4: Run test, verify PASS**

**Step 5: Commit**

```bash
git add packages/web/src/components/SessionChainPanel.tsx packages/web/src/components/audit/AuditExplorerPanel.tsx packages/web/test/session-chain-audit-link.test.tsx
git commit -m "feat(F063): sealed session click → inline event viewer"
```

---

## Task 6: Visual polish + build check

**Step 1: Run web build**

```bash
cd packages/web && pnpm build
```

Expected: clean build, no TypeScript errors.

**Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all pass.

**Step 3: Run lint/format**

```bash
pnpm check
pnpm lint
```

**Step 4: Commit any fixes**

---

## Task 7: Update F063 spec — close documentation

**Files:**
- Modify: `docs/features/F063-hub-workspace-explorer.md`
- Modify: `docs/BACKLOG.md`

**Step 1:** Update AC-5 from `[ ]` to `[x]`
**Step 2:** Mark P3-7 and P3-8 as **done** in Gap 3 section
**Step 3:** Update R1-R15 checklist (勾选已完成的)
**Step 4:** Update spec status header to "Done"
**Step 5:** Commit

```bash
git commit -m "docs(F063): mark AC-5 done, close Gap 3, update checklist"
```

---

## Execution Summary

| Task | What | New files | Modify files |
|------|------|-----------|--------------|
| 1 | AuditEventsTab | 2 | 0 |
| 2 | SessionEventsViewer | 2 | 0 |
| 3 | SessionSearchTab | 2 | 0 |
| 4 | AuditExplorerPanel + integrate | 3 | 1 (RightStatusPanel) |
| 5 | SessionChain click-to-view | 1 | 2 (SessionChainPanel, AuditExplorerPanel) |
| 6 | Polish + build | 0 | maybe |
| 7 | Spec close | 0 | 2 (F063 spec, BACKLOG) |

**Total: ~10 new files, ~5 modified files, 0 new API endpoints.**
