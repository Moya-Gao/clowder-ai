---
feature_ids: [F148]
doc_kind: plan
created: 2026-04-02
---

# F148 Phase E: Context Briefing Surface — Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** 让 Landy 在 @ 完猫后的那几秒，立即看见系统给这只猫喂了什么、略过了什么；同时不把这张卡再反向污染猫的上下文。
**Acceptance Criteria:**
- AC-E1: smart window 触发时系统自动插入 context briefing 到 thread（猫无感知）
- AC-E2: briefing 不进入后续 assembleIncrementalContext 投喂（non-routing 硬约束）
- AC-E3: 折叠态一行显示核心指标（看到/省略/锚点/记忆/证据数量）
- AC-E4: 展开态显示 participants、time range、anchor 文本、threadMemory 摘要
**Architecture:** `assembleSmartWindowContext` 返回 `CoverageMap` → route-serial/parallel 检测到 smart window → 自动 append 一条 `origin: 'briefing'` 系统消息到 thread（携带 rich block）→ `assembleIncrementalContext` 过滤掉 `origin: 'briefing'` 消息 → 前端渲染为可折叠卡片
**Tech Stack:** TypeScript, node:test, existing rich block infra
**前端验证:** Yes — 需要前端渲染 context-briefing rich block

---

## Terminal Schema

```typescript
// IncrementalContextResult 新增字段
interface IncrementalContextResult {
  // ...existing...
  /** Phase E: coverage map for briefing surface (only present when smart window triggered) */
  coverageMap?: CoverageMap;
}

// StoredMessage.origin 新增值
origin?: 'stream' | 'callback' | 'briefing';

// Rich block payload
interface ContextBriefingBlock {
  type: 'context-briefing';
  coverageMap: CoverageMap;  // Phase D 已有
  threadMemorySummary?: string;
  anchorSummaries?: string[];
}
```

## What We're NOT Building

- Workspace tab / 全局视图（P2, future）
- retrievalHints 填充逻辑（砚砚 pushback 已接受，Phase D 不做）
- 前端可折叠交互组件的完整设计（最小版用现有 rich block card 渲染）

---

### Task 1: Return CoverageMap from assembleIncrementalContext

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` (IncrementalContextResult + assembleSmartWindowContext return)

**What:** Add `coverageMap?: CoverageMap` to `IncrementalContextResult`, populate it when smart window triggers.

**Test:** Unit test — when smart window triggers, `inc.coverageMap` is a valid CoverageMap object; when warm path, `inc.coverageMap` is undefined.

---

### Task 2: Filter `origin: 'briefing'` from assembleIncrementalContext (AC-E2)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (origin type)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` (filter logic at line ~326)

**What:** Extend `origin` type to include `'briefing'`; add filter `if (m.origin === 'briefing') return false` in the `relevant` filter.

**Test:** Unit test — a message with `origin: 'briefing'` is excluded from `assembleIncrementalContext` output even though it's in the thread.

---

### Task 3: Auto-insert briefing message in route-serial / route-parallel (AC-E1)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (~line 287)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (~line 228)

**What:** After `assembleIncrementalContext` returns, if `inc.coverageMap` exists:
1. Build briefing content (compact one-line summary)
2. Append to messageStore with `origin: 'briefing'`, `catId: null`, `userId: 'system'`
3. Attach `extra.rich` with `context-briefing` block payload
4. Yield as `system_info` for immediate frontend display

**Test:** Integration test — trigger smart window, verify a `'briefing'` origin message appears in thread with correct rich block.

---

### Task 4: Format briefing content (AC-E3 + AC-E4)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/format-briefing.ts`
- Test: `packages/api/test/f148-context-briefing.test.js`

**What:** Pure function `formatContextBriefing(coverageMap, threadMemorySummary?, anchorSummaries?)`:
- Returns `{ summary: string, richBlock: ContextBriefingBlock }`
- `summary`: one-line `看到 8 条 · 省略 22 条 · 锚点 3 条 · 记忆 5 sessions · 证据 2 条`
- `richBlock`: structured data for frontend expand view

**Test:** Unit tests for various combinations (with/without threadMemory, with/without anchors, zero omitted).

---

### Task 5: Frontend rendering of context-briefing rich block

**Files:**
- Modify: `packages/web/src/components/chat/` (rich block renderer)

**What:** Render `context-briefing` rich block as a collapsible card:
- Collapsed: one-line summary with subtle system styling
- Expanded: participants, time range, anchor texts, threadMemory summary

**Test:** Visual verification via browser (Playwright/Chrome).
