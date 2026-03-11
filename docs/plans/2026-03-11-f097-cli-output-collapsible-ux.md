# F097: CLI Output Collapsible UX — Phase A Implementation Plan

**Feature:** F097 — `docs/features/F097-cli-output-collapsible-ux.md`
**Goal:** 将 ToolEventsPanel + stream content 合并为统一的 CLI Output Block，折叠式交互，面向终态 CliEvent[] 接口
**Acceptance Criteria:** AC-A1 ~ AC-A10（逐条见 feat doc）
**Architecture:** 新建 `CliOutputBlock.tsx`，定义 `CliEvent` 类型 + `toCliEvents()` 适配器，ChatMessage 替换现有 ToolEventsPanel + stream ThinkingContent 为 CliOutputBlock
**Tech Stack:** React 18, Tailwind CSS, Vitest, Zustand (chatStore)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Finish Line

**B definition:** 猫消息气泡中，tool events + CLI stdout 合并为一个深色 terminal 风格的 `CLI 输出` 折叠块，正文在上、CLI 块在下、Thinking 独立。接口为 `CliEvent[]`，Phase B 换数据源时组件零改动。

**NOT building:** Phase B（callback+stream 合并、后端 cliEvents[]、动画 transition）、story-export/archive 改名、A2A 视觉重构。

## Terminal Schema

```typescript
// chat-types.ts — 新增
type CliEventKind = 'tool_use' | 'tool_result' | 'text' | 'error';
type CliStatus = 'streaming' | 'done' | 'failed' | 'interrupted';

interface CliEvent {
  id: string;
  kind: CliEventKind;
  timestamp: number;
  label?: string;
  detail?: string;
  content?: string;
}

// CliOutputBlock props
interface CliOutputBlockProps {
  events: CliEvent[];
  status: CliStatus;
  thinkingMode?: 'debug' | 'play';
  defaultExpanded?: boolean;
}
```

## Tasks

### Task 1: CliEvent type + toCliEvents adapter

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts` (append types)
- Create: `packages/web/src/components/cli-output/toCliEvents.ts`
- Test: `packages/web/src/components/__tests__/to-cli-events.test.ts`

**Step 1: Write the failing test**

```typescript
// to-cli-events.test.ts
import { describe, expect, it } from 'vitest';
import { toCliEvents } from '../cli-output/toCliEvents';
import type { ToolEvent } from '@/stores/chatStore';

describe('toCliEvents', () => {
  it('converts toolEvents to CliEvent[]', () => {
    const tools: ToolEvent[] = [
      { id: 't1', type: 'tool_use', label: 'Read index.ts', timestamp: 1000 },
      { id: 't2', type: 'tool_result', label: 'Read index.ts', detail: 'ok', timestamp: 1001 },
    ];
    const result = toCliEvents(tools, undefined);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 't1', kind: 'tool_use', label: 'Read index.ts' });
    expect(result[1]).toMatchObject({ id: 't2', kind: 'tool_result', detail: 'ok' });
  });

  it('appends stream content as text event', () => {
    const tools: ToolEvent[] = [
      { id: 't1', type: 'tool_use', label: 'Bash pnpm test', timestamp: 1000 },
    ];
    const result = toCliEvents(tools, 'All tests passed.');
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ kind: 'text', content: 'All tests passed.' });
  });

  it('returns empty array when no tools and no content', () => {
    expect(toCliEvents([], undefined)).toEqual([]);
    expect(toCliEvents(undefined, undefined)).toEqual([]);
  });

  it('returns text-only event when no tools but has content', () => {
    const result = toCliEvents([], 'stdout only');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'text', content: 'stdout only' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/to-cli-events.test.ts`
Expected: FAIL — module not found

**Step 3: Add CliEvent types to chat-types.ts**

Append to `packages/web/src/stores/chat-types.ts`:
```typescript
/** F097: CLI Output unified event stream */
export type CliEventKind = 'tool_use' | 'tool_result' | 'text' | 'error';
export type CliStatus = 'streaming' | 'done' | 'failed' | 'interrupted';

export interface CliEvent {
  id: string;
  kind: CliEventKind;
  timestamp: number;
  label?: string;
  detail?: string;
  content?: string;
}
```

**Step 4: Write toCliEvents adapter**

```typescript
// cli-output/toCliEvents.ts
import type { CliEvent, ToolEvent } from '@/stores/chat-types';

export function toCliEvents(
  toolEvents: ToolEvent[] | undefined,
  streamContent: string | undefined,
): CliEvent[] {
  const events: CliEvent[] = [];

  if (toolEvents) {
    for (const te of toolEvents) {
      events.push({
        id: te.id,
        kind: te.type,
        timestamp: te.timestamp,
        label: te.label,
        detail: te.detail,
      });
    }
  }

  if (streamContent?.trim()) {
    events.push({
      id: 'stdout-text',
      kind: 'text',
      timestamp: events.length > 0 ? events[events.length - 1].timestamp + 1 : Date.now(),
      content: streamContent,
    });
  }

  return events;
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/to-cli-events.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/web/src/stores/chat-types.ts packages/web/src/components/cli-output/toCliEvents.ts packages/web/src/components/__tests__/to-cli-events.test.ts
git commit -m "feat(F097): add CliEvent type + toCliEvents adapter"
```

---

### Task 2: CliOutputBlock component — collapsed/expanded rendering

**Files:**
- Create: `packages/web/src/components/cli-output/CliOutputBlock.tsx`
- Test: `packages/web/src/components/__tests__/cli-output-block.test.ts`

**Step 1: Write the failing test**

```typescript
// cli-output-block.test.ts
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// Stub MarkdownContent
vi.mock('../MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) =>
    React.createElement('div', { 'data-testid': 'md' }, content),
}));

const { CliOutputBlock } = await import('../cli-output/CliOutputBlock');

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as any).React = React;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  delete (globalThis as any).React;
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const doneEvents = [
  { id: 't1', kind: 'tool_use' as const, timestamp: 1000, label: 'Read index.ts' },
  { id: 't2', kind: 'tool_result' as const, timestamp: 1001, label: 'Read index.ts', detail: '200 lines' },
  { id: 't3', kind: 'text' as const, timestamp: 1002, content: 'Looks good.' },
];

describe('CliOutputBlock', () => {
  it('renders summary line with tool count when collapsed', () => {
    act(() => {
      root.render(React.createElement(CliOutputBlock, {
        events: doneEvents,
        status: 'done',
      }));
    });
    expect(container.textContent).toContain('CLI 输出');
    expect(container.textContent).toContain('已完成');
    expect(container.textContent).toContain('1 tools');
  });

  it('expands on click to show tool rows + stdout', () => {
    act(() => {
      root.render(React.createElement(CliOutputBlock, {
        events: doneEvents,
        status: 'done',
        defaultExpanded: true,
      }));
    });
    expect(container.textContent).toContain('Read index.ts');
    expect(container.textContent).toContain('Looks good.');
  });

  it('shows streaming status and is expanded by default', () => {
    act(() => {
      root.render(React.createElement(CliOutputBlock, {
        events: [{ id: 't1', kind: 'tool_use' as const, timestamp: 1000, label: 'Bash pnpm test' }],
        status: 'streaming',
      }));
    });
    // streaming → always expanded, summary says 进行中
    expect(container.textContent).toContain('进行中');
    expect(container.textContent).toContain('Bash pnpm test');
  });

  it('shows visibility chip when thinkingMode=debug', () => {
    act(() => {
      root.render(React.createElement(CliOutputBlock, {
        events: doneEvents,
        status: 'done',
        thinkingMode: 'debug',
      }));
    });
    expect(container.textContent).toContain('共享给其他猫');
  });

  it('shows private label when thinkingMode=play', () => {
    act(() => {
      root.render(React.createElement(CliOutputBlock, {
        events: doneEvents,
        status: 'done',
        thinkingMode: 'play',
      }));
    });
    expect(container.textContent).toContain('不共享');
  });

  it('returns null when no events', () => {
    act(() => {
      root.render(React.createElement('div', { id: 'wrapper' },
        React.createElement(CliOutputBlock, { events: [], status: 'done' })
      ));
    });
    expect(container.querySelector('#wrapper')?.children.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/cli-output-block.test.ts`
Expected: FAIL — module not found

**Step 3: Implement CliOutputBlock**

Create `packages/web/src/components/cli-output/CliOutputBlock.tsx` (~130 lines):
- Summary line: status text + tool count/line count + duration + visibility chip
- Dark terminal substrate (`bg-gray-850` / `bg-[#1a1b26]` + `text-gray-100`)
- Tool rows with Lucide-style SVG inline (wrench for tool_use, check for tool_result)
- Chevron SVG for collapse/expand
- Paw SVG for shared visibility chip (reuse existing PawIcon)
- stdout section with monospace text
- `userInteracted` ref to prevent auto-collapse after manual interaction
- Streaming → force expanded
- Export mode → force expanded

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/cli-output-block.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/cli-output/CliOutputBlock.tsx packages/web/src/components/__tests__/cli-output-block.test.ts
git commit -m "feat(F097): add CliOutputBlock component with terminal substrate"
```

---

### Task 3: Wire CliOutputBlock into ChatMessage

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx`

**Step 1: Write the failing test**

```typescript
// cli-output-integration.test.ts
// Tests that ChatMessage renders CliOutputBlock instead of ToolEventsPanel + 💭心里话
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useChatStore } from '@/stores/chatStore';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useTts', () => ({
  useTts: () => ({ state: 'idle', synthesize: vi.fn(), activeMessageId: null }),
}));
vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => ({ cats: [], isLoading: false, getCatById: () => undefined, getCatsByBreed: () => new Map() }),
}));

const { ChatMessage } = await import('../ChatMessage');

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as any).React = React;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => { delete (globalThis as any).React; delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useChatStore.getState().setUiThinkingExpandedByDefault(false);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const getCatById = () => undefined;

describe('ChatMessage CLI Output integration', () => {
  it('renders "CLI 输出" instead of "💭 心里话" for stream messages', () => {
    const msg = {
      id: 'msg-1', type: 'assistant' as const, catId: 'opus',
      content: 'stream stdout', origin: 'stream' as const,
      toolEvents: [{ id: 't1', type: 'tool_use' as const, label: 'Read foo.ts', timestamp: 1000 }],
      timestamp: Date.now(), isStreaming: false,
    };
    act(() => { root.render(React.createElement(ChatMessage, { message: msg, getCatById })); });
    expect(container.textContent).toContain('CLI 输出');
    expect(container.textContent).not.toContain('💭 心里话');
  });

  it('keeps 🧠 Thinking independent from CLI block', () => {
    const msg = {
      id: 'msg-2', type: 'assistant' as const, catId: 'opus',
      content: 'final answer', thinking: 'reasoning here',
      origin: 'stream' as const,
      toolEvents: [{ id: 't1', type: 'tool_use' as const, label: 'Edit bar.ts', timestamp: 1000 }],
      timestamp: Date.now(), isStreaming: false,
    };
    act(() => { root.render(React.createElement(ChatMessage, { message: msg, getCatById })); });
    // Thinking label should exist independently
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent?.includes('Thinking'))).toBe(true);
    // CLI block should also exist
    expect(container.textContent).toContain('CLI 输出');
  });

  it('shows content text ABOVE CLI block (conclusion first)', () => {
    const msg = {
      id: 'msg-3', type: 'assistant' as const, catId: 'opus',
      content: 'Here is the answer', origin: 'callback' as const,
      toolEvents: [{ id: 't1', type: 'tool_use' as const, label: 'Read x.ts', timestamp: 1000 }],
      timestamp: Date.now(), isStreaming: false,
    };
    act(() => { root.render(React.createElement(ChatMessage, { message: msg, getCatById })); });
    const text = container.textContent || '';
    const answerIdx = text.indexOf('Here is the answer');
    const cliIdx = text.indexOf('CLI 输出');
    // Content should appear before CLI block
    expect(answerIdx).toBeLessThan(cliIdx);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/cli-output-integration.test.ts`
Expected: FAIL — still renders 💭 心里话

**Step 3: Modify ChatMessage.tsx**

Key changes:
1. Import `CliOutputBlock` and `toCliEvents`
2. Compute `cliEvents` from `message.toolEvents` + stream content
3. Get `thinkingMode` from store: `useChatStore(s => s.threads.find(t => t.id === s.currentThreadId)?.thinkingMode)`
4. Compute `cliStatus` from `message.isStreaming`
5. Replace the render block:
   - **Before**: `{hasToolEvents && renderToolEvents(...)}` then thinking then stream-content-as-ThinkingContent
   - **After**: content/blocks first (callback origin or non-stream), then `<CliOutputBlock>`, then `<ThinkingContent>` for `🧠 Thinking` only
6. Remove `renderToolEvents`, `ToolEventsPanel`, `CollapsedToolView`, `ExpandedToolView` (dead code)
7. For stream-origin messages: content goes INTO CliOutputBlock as text events, not shown as standalone ThinkingContent

**Step 4: Run tests**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/cli-output-integration.test.ts`
Expected: PASS

**Step 5: Run existing ChatMessage tests to catch regressions**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/chat-message-*.test.ts src/components/__tests__/thinking-content-mode.test.ts`
Expected: Some tests may need updates (e.g., thinking-content-mode checks for `💭 心里话`)

**Step 6: Update broken tests**

- `thinking-content-mode.test.ts`: Update to check for `CLI 输出` instead of `💭 心里话`
- Any test asserting `ToolEventsPanel` mock: update to not mock removed component

**Step 7: Commit**

```bash
git add packages/web/src/components/ChatMessage.tsx packages/web/src/components/__tests__/cli-output-integration.test.ts packages/web/src/components/__tests__/thinking-content-mode.test.ts
git commit -m "feat(F097): wire CliOutputBlock into ChatMessage — content-first layout"
```

---

### Task 4: Remove dead code + cleanup

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx` (remove ToolEventsPanel, CollapsedToolView, ExpandedToolView, renderToolEvents if not already removed in Task 3)

**Step 1: Verify no other imports of removed functions**

Run: `grep -r 'ToolEventsPanel\|CollapsedToolView\|ExpandedToolView' packages/web/src/ --include='*.ts' --include='*.tsx'`
Expected: Only test mocks (update those too)

**Step 2: Remove dead code and update mocks**

Remove any `vi.mock('../ToolEventsPanel')` from tests that reference it.

**Step 3: Run full test suite**

Run: `cd packages/web && pnpm vitest run`
Expected: All pass

**Step 4: Run biome + type check**

Run: `pnpm check && pnpm lint`
Expected: Clean

**Step 5: Commit**

```bash
git add -u
git commit -m "refactor(F097): remove dead ToolEventsPanel + CollapsedToolView code"
```

---

### Task 5: Export mode + auto-collapse behavior

**Files:**
- Modify: `packages/web/src/components/cli-output/CliOutputBlock.tsx`
- Test: `packages/web/src/components/__tests__/cli-output-block.test.ts` (add cases)

**Step 1: Write failing tests for export mode and auto-collapse**

Add to existing test file:
```typescript
it('export mode: all blocks expanded', () => {
  // Mock window.location.search = '?export=true'
  Object.defineProperty(window, 'location', {
    value: { search: '?export=true' }, writable: true,
  });
  act(() => {
    root.render(React.createElement(CliOutputBlock, {
      events: doneEvents, status: 'done',
    }));
  });
  // Should show expanded content
  expect(container.textContent).toContain('Read index.ts');
  expect(container.textContent).toContain('Looks good.');
  // Restore
  Object.defineProperty(window, 'location', {
    value: { search: '' }, writable: true,
  });
});
```

**Step 2: Implement if not already covered in Task 2**

- `?export=true` → force expanded
- `userInteracted` ref → once user clicks, immune to auto-collapse
- `catcafe:chat-layout-changed` event dispatch on expand/collapse

**Step 3: Run tests**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/cli-output-block.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add -u
git commit -m "feat(F097): export mode + auto-collapse with userInteracted guard"
```

---

### Task 6: Final validation

**Step 1: Full test suite**

Run: `cd packages/web && pnpm vitest run`

**Step 2: Biome + TypeScript**

Run: `pnpm check && pnpm lint`

**Step 3: Directory size check**

Run: `pnpm check:dir-size`

**Step 4: Visual sanity check**

Manual: open dev server, verify:
- Stream message → CLI block auto-expanded, tool rows visible
- Message done → CLI block auto-collapsed, summary line shows "CLI 输出 · 已完成 · N tools"
- Click expand → dark terminal substrate, tool rows + stdout
- 🧠 Thinking → independent collapsible, not inside CLI block
- Export mode (`?export=true`) → all expanded

**Step 5: Commit any remaining fixes**

---

## AC Coverage Matrix

| AC | Task |
|----|------|
| AC-A1 (rename 心里话→CLI输出) | Task 3 |
| AC-A2 (tool events in CliOutputBlock) | Task 2, 3 |
| AC-A3 (Thinking independent) | Task 3 |
| AC-A4 (summary line with status) | Task 2 |
| AC-A5 (visibility chip from thinkingMode) | Task 2, 3 |
| AC-A6 (auto-collapse logic) | Task 5 |
| AC-A7 (export mode + userInteracted) | Task 5 |
| AC-A8 (dark terminal substrate) | Task 2 |
| AC-A9 (scope: runtime chat only) | All (no changes to story-export) |
| AC-A10 (CliEvent[] interface, Phase B zero-change) | Task 1 |
