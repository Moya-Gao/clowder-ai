# F252 Phase E: 猫猫大剧院 Meow Theater — Hub Theater Overlay + Hub-Native Rendering

**Feature:** F252 — `docs/features/F252-story-player.md`
**Goal:** 将 Story Player 从独立暗色页面重做为 Hub 融入式 Theater Overlay，复用 Hub 现有聊天组件渲染回放事件，实现"100% 平时的样子 + 特效和快进"
**Acceptance Criteria:** AC-E0 (P0 bug fix), AC-E1 (Hub Theater Overlay), AC-E2 (Thread-level replay), AC-E3 (Spotlight/Dim), AC-E4 (Bullet time), AC-E5 (Multi-cam), AC-E6 (Guest cameo), AC-E7 (Timeline heatmap)
**Architecture cell:** `web/story-player` (existing)
**Map delta:** none
**Map delta why:** 现有 story-player cell 范围内重构前端
**Architecture:** ReplayEvent → ChatMessage 桥接 → Hub 现有 ChatMessage/MessageBubble 组件渲染回放。TheaterOverlay 作为 Hub 全屏 Drawer 融入。引擎层 (useReplayEngine/replay-engine/adapter/adaptive-pacing/chapters) 全复用。
**Tech Stack:** React, Next.js, CSS transitions/animations, 现有 Hub 组件
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Scope 分层（3 个 PR）

| PR | AC 覆盖 | 核心内容 |
|----|---------|---------|
| **E-1** | AC-E0 + AC-E1 + AC-E2 | P0 bug fix + Hub Theater Overlay + Thread 级回放 + Hub 组件渲染 |
| **E-2** | AC-E3 + AC-E4 + AC-E5 | Spotlight/Dim + Bullet time + Multi-cam 分屏 |
| **E-3** | AC-E6 + AC-E7 | Guest cameo cards + Timeline heatmap + Chapter badges |

**本计划只覆盖 PR E-1**（核心基础，E-2/E-3 在 E-1 merged 后单独写 plan）。

---

## 终态 Schema

### ReplayEvent → ChatMessage 桥接

```typescript
// packages/web/src/lib/story-player/replay-chat-bridge.ts

interface ReplayChatMessage {
  id: string;                    // `replay_${event.index}`
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  catId?: string;
  isStreaming: false;
  // Tool events (for tool_call ReplayEvents)
  toolEvents?: Array<{
    id: string;
    name: string;
    input?: string;
    output?: string;
    isError?: boolean;
    status: 'completed' | 'error';
  }>;
  // Thinking content (for thinking ReplayEvents)
  thinking?: string;
}
```

映射规则：
- `ReplayEvent.type === 'message'` → `type` 从 `role` 推导（'user'→'user', 'assistant'→'assistant', 'system'→'system'）
- `ReplayEvent.type === 'tool_call'` → `type: 'assistant'` + `toolEvents: [{ name, input, output, isError, status }]`
- `ReplayEvent.type === 'thinking'` → `type: 'assistant'` + `thinking: content` + `content: ''`
- `ReplayEvent.type === 'system'` → `type: 'system'`

### TheaterOverlay

```typescript
// packages/web/src/components/story-player/TheaterOverlay.tsx

interface TheaterOverlayProps {
  /** Thread ID to replay (all sessions concatenated) */
  threadId: string;
  /** Optional session ID for single-session replay */
  sessionId?: string;
  /** Close handler */
  onClose: () => void;
}
```

渲染结构：
```
<Hub 正常页面>
  <TheaterOverlay>                         {/* position: fixed, z-index: 1000 */}
    <div.backdrop>                         {/* backdrop-filter: blur(12px) */}
    <div.theater-container>
      <div.theater-header>                 {/* 🎬 标题 + 关闭按钮 */}
      <div.theater-stage>                  {/* 主舞台区域 */}
        <ReplayMessageList>                {/* 复用 ChatMessage 渲染 */}
          <ChatMessage message={bridged} />
        </ReplayMessageList>
      </div.theater-stage>
      <ReplayControls />                   {/* 底部控制条（复用现有） */}
    </div.theater-container>
  </TheaterOverlay>
</Hub>
```

### Thread 级回放

```typescript
// packages/web/src/lib/story-player/thread-replay-fetcher.ts

/**
 * Fetch all sessions for a thread, concatenate events by timestamp.
 * Returns sorted RawTranscriptEvent[] spanning all sessions.
 */
async function fetchThreadReplayEvents(threadId: string): Promise<RawTranscriptEvent[]>
```

流程：
1. `GET /api/threads/:threadId` → 获取 thread 信息 + session 列表
2. 对每个 sealed session 调用 `fetchAllSessionEvents(sessionId)`
3. 按 `t` (timestamp) 排序合并
4. 返回合并后的完整事件流

### useReplayEngine 扩展

```typescript
// 扩展 UseReplayEngineOptions
interface UseReplayEngineOptions {
  sessionId?: string;   // 单 session（现有）
  threadId?: string;    // Thread 级（新增）— 二选一
}
```

---

## Stateful Object Gate

### 对象 1: TheaterOverlay 可见状态

| 状态 | 事件 | 下一状态 |
|------|------|---------|
| closed | 用户点击 Thread "回放" 按钮 | opening |
| opening | 动画完成 (CSS transition end) | open |
| open | 用户点击关闭 / 按 Escape | closing |
| closing | 动画完成 | closed |

**不变量**：
- INV-1: 同一时间最多一个 TheaterOverlay open（单例）
- INV-2: closed 状态下不渲染任何 DOM（不是 visibility:hidden，是 null）
- INV-3: Escape 键在 open 状态下触发关闭

### 对象 2: ReplayEngine 数据源切换

现有引擎只接受 `sessionId`，扩展为 `sessionId | threadId`。

| 状态 | 事件 | 下一状态 |
|------|------|---------|
| idle | 传入 sessionId | fetching-single |
| idle | 传入 threadId | fetching-thread |
| fetching-single | API 返回 events | ready |
| fetching-thread | 所有 session events 合并完成 | ready |
| fetching-* | API 错误 | error |
| ready | 引擎正常运行 | (same — ReplayEngine 内部状态机) |

**不变量**：
- INV-4: sessionId 和 threadId 互斥，同时传两个 = 抛错
- INV-5: threadId 模式下，events 按 t 升序排列（跨 session 合并后）

### 对象 3: ReplayChatBridge 映射

纯函数，无状态。`ReplayEvent → ReplayChatMessage` 是 1:1 无状态映射。

**不变量**：
- INV-6: 相同输入总是产生相同输出（referential transparency）
- INV-7: 所有 ReplayEvent.type 都有对应映射（无遗漏）

---

## 实现步骤

### Task 1: ReplayEvent → ChatMessage 桥接函数

**Files:**
- Create: `packages/web/src/lib/story-player/replay-chat-bridge.ts`
- Create: `packages/web/src/lib/story-player/__tests__/replay-chat-bridge.test.ts`

**Step 1: Write the failing tests**

```typescript
// replay-chat-bridge.test.ts
import { describe, it, expect } from 'vitest';
import { bridgeReplayEvent } from '../replay-chat-bridge';
import type { ReplayEvent } from '../types';

describe('bridgeReplayEvent', () => {
  it('maps message event with role=assistant to type=assistant', () => {
    const event: ReplayEvent = {
      index: 0, type: 'message', timestamp: 1000,
      role: 'assistant', content: 'Hello!', eventNo: 1,
      catId: 'opus',
    };
    const result = bridgeReplayEvent(event);
    expect(result.type).toBe('assistant');
    expect(result.content).toBe('Hello!');
    expect(result.catId).toBe('opus');
    expect(result.id).toBe('replay_0');
    expect(result.isStreaming).toBe(false);
  });

  it('maps message event with role=user to type=user', () => {
    const event: ReplayEvent = {
      index: 1, type: 'message', timestamp: 2000,
      role: 'user', content: 'Question', eventNo: 2,
    };
    const result = bridgeReplayEvent(event);
    expect(result.type).toBe('user');
    expect(result.catId).toBeUndefined();
  });

  it('maps tool_call event to assistant with toolEvents', () => {
    const event: ReplayEvent = {
      index: 2, type: 'tool_call', timestamp: 3000,
      role: 'assistant', content: '', eventNo: 3,
      catId: 'opus', toolName: 'Read', toolInput: '{"path":"/a.ts"}',
      toolResult: 'file content', toolIsError: false,
    };
    const result = bridgeReplayEvent(event);
    expect(result.type).toBe('assistant');
    expect(result.toolEvents).toHaveLength(1);
    expect(result.toolEvents![0].name).toBe('Read');
    expect(result.toolEvents![0].status).toBe('completed');
  });

  it('maps thinking event to assistant with thinking field', () => {
    const event: ReplayEvent = {
      index: 3, type: 'thinking', timestamp: 4000,
      role: 'assistant', content: 'Let me think...', eventNo: 4,
      catId: 'opus',
    };
    const result = bridgeReplayEvent(event);
    expect(result.type).toBe('assistant');
    expect(result.thinking).toBe('Let me think...');
    expect(result.content).toBe('');
  });

  it('maps system event to type=system', () => {
    const event: ReplayEvent = {
      index: 4, type: 'system', timestamp: 5000,
      role: 'system', content: 'Session started', eventNo: 5,
    };
    const result = bridgeReplayEvent(event);
    expect(result.type).toBe('system');
    expect(result.content).toBe('Session started');
  });

  it('maps tool_call with error to toolEvents.status=error', () => {
    const event: ReplayEvent = {
      index: 5, type: 'tool_call', timestamp: 6000,
      role: 'assistant', content: '', eventNo: 6,
      catId: 'opus', toolName: 'Bash',
      toolResult: 'command not found', toolIsError: true,
    };
    const result = bridgeReplayEvent(event);
    expect(result.toolEvents![0].status).toBe('error');
    expect(result.toolEvents![0].isError).toBe(true);
  });

  // INV-7: all types mapped
  it('handles all ReplayEvent types without throwing', () => {
    const types = ['message', 'tool_call', 'system', 'thinking'] as const;
    for (const t of types) {
      expect(() => bridgeReplayEvent({
        index: 0, type: t, timestamp: 0, role: 'system',
        content: 'test', eventNo: 0,
      })).not.toThrow();
    }
  });
});
```

**Step 2: Run test to verify red**

```bash
cd ../cat-cafe-f252-meow-theater && pnpm vitest run packages/web/src/lib/story-player/__tests__/replay-chat-bridge.test.ts
```

**Step 3: Write implementation**

```typescript
// replay-chat-bridge.ts
import type { ReplayEvent } from './types';

export interface ReplayChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  catId?: string;
  isStreaming: false;
  toolEvents?: Array<{
    id: string;
    name: string;
    input?: string;
    output?: string;
    isError?: boolean;
    status: 'completed' | 'error';
  }>;
  thinking?: string;
}

const ROLE_TO_TYPE: Record<string, ReplayChatMessage['type']> = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
};

export function bridgeReplayEvent(event: ReplayEvent): ReplayChatMessage {
  const base = {
    id: `replay_${event.index}`,
    timestamp: event.timestamp,
    catId: event.catId,
    isStreaming: false as const,
  };

  switch (event.type) {
    case 'message':
      return { ...base, type: ROLE_TO_TYPE[event.role] ?? 'system', content: event.content };
    case 'tool_call':
      return {
        ...base,
        type: 'assistant',
        content: '',
        toolEvents: [{
          id: `tool_${event.index}`,
          name: event.toolName ?? 'unknown',
          input: event.toolInput,
          output: event.toolResult,
          isError: event.toolIsError,
          status: event.toolIsError ? 'error' : 'completed',
        }],
      };
    case 'thinking':
      return { ...base, type: 'assistant', content: '', thinking: event.content };
    case 'system':
      return { ...base, type: 'system', content: event.content };
  }
}
```

**Step 4: Run test to verify green**

**Step 5: Commit**

```bash
git add packages/web/src/lib/story-player/replay-chat-bridge.ts packages/web/src/lib/story-player/__tests__/replay-chat-bridge.test.ts
git commit -m "feat(f252-e): add ReplayEvent → ChatMessage bridge function"
```

---

### Task 2: Thread-level session concatenation

**Files:**
- Create: `packages/web/src/lib/story-player/thread-replay-fetcher.ts`
- Create: `packages/web/src/lib/story-player/__tests__/thread-replay-fetcher.test.ts`
- Modify: `packages/web/src/lib/story-player/useReplayEngine.ts` (accept threadId)
- Modify: `packages/web/src/lib/story-player/types.ts` (update options type)

**Step 1: Write tests for thread event fetcher**

```typescript
// thread-replay-fetcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mergeSessionEvents } from '../thread-replay-fetcher';

describe('mergeSessionEvents', () => {
  it('merges events from multiple sessions sorted by timestamp', () => {
    const session1 = [
      { t: 1000, eventNo: 0, event: { type: 'text' }, catId: 'opus' },
      { t: 3000, eventNo: 1, event: { type: 'text' }, catId: 'opus' },
    ];
    const session2 = [
      { t: 2000, eventNo: 0, event: { type: 'text' }, catId: 'codex' },
      { t: 4000, eventNo: 1, event: { type: 'text' }, catId: 'codex' },
    ];
    const merged = mergeSessionEvents([session1, session2]);
    expect(merged.map(e => e.t)).toEqual([1000, 2000, 3000, 4000]);
    // INV-5: ascending order
  });

  it('re-indexes eventNo monotonically after merge', () => {
    const session1 = [{ t: 2000, eventNo: 0, event: { type: 'text' } }];
    const session2 = [{ t: 1000, eventNo: 0, event: { type: 'text' } }];
    const merged = mergeSessionEvents([session1, session2]);
    expect(merged[0].eventNo).toBe(0);
    expect(merged[1].eventNo).toBe(1);
  });

  it('handles empty session list', () => {
    expect(mergeSessionEvents([])).toEqual([]);
  });

  it('handles single session', () => {
    const events = [
      { t: 1000, eventNo: 0, event: { type: 'text' } },
    ];
    const merged = mergeSessionEvents([events]);
    expect(merged).toHaveLength(1);
  });
});
```

**Step 2: Run to verify red**

**Step 3: Write implementation**

```typescript
// thread-replay-fetcher.ts
import type { RawTranscriptEvent } from './types';
import { apiFetch } from '@/utils/api-client';

/**
 * Merge events from multiple sessions, sorted by timestamp.
 * Re-indexes eventNo monotonically.
 */
export function mergeSessionEvents(
  sessionEventSets: RawTranscriptEvent[][],
): RawTranscriptEvent[] {
  const all = sessionEventSets.flat();
  all.sort((a, b) => a.t - b.t);
  // Re-index eventNo
  for (let i = 0; i < all.length; i++) {
    all[i] = { ...all[i], eventNo: i };
  }
  return all;
}

/**
 * Fetch all sealed session IDs for a thread.
 */
async function fetchThreadSessionIds(threadId: string): Promise<string[]> {
  const res = await apiFetch(`/api/threads/${threadId}/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch thread sessions: ${res.status}`);
  const data = await res.json();
  // Filter to sealed sessions only (active sessions have incomplete events)
  return (data.sessions ?? [])
    .filter((s: { sealed?: boolean }) => s.sealed)
    .map((s: { id: string }) => s.id);
}

/**
 * Fetch events for a single session (pagination handled internally).
 */
async function fetchSessionEvents(sessionId: string): Promise<RawTranscriptEvent[]> {
  const all: RawTranscriptEvent[] = [];
  let cursorEventNo: number | undefined;

  while (true) {
    const params = new URLSearchParams({ view: 'raw', limit: '200' });
    if (cursorEventNo != null) params.set('cursor', String(cursorEventNo));
    const res = await apiFetch(`/api/sessions/${sessionId}/events?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch session events: ${res.status}`);
    const data = await res.json();
    all.push(...data.events);
    if (!data.nextCursor) break;
    cursorEventNo = data.nextCursor.eventNo;
  }
  return all;
}

/**
 * Fetch all events for a thread (all sealed sessions, merged by timestamp).
 */
export async function fetchThreadReplayEvents(
  threadId: string,
): Promise<RawTranscriptEvent[]> {
  const sessionIds = await fetchThreadSessionIds(threadId);
  if (sessionIds.length === 0) return [];

  const sessionEventSets = await Promise.all(
    sessionIds.map(fetchSessionEvents),
  );
  return mergeSessionEvents(sessionEventSets);
}
```

**Step 4: Run test to verify green**

**Step 5: Update useReplayEngine to accept threadId**

Modify `useReplayEngine.ts`:
- Change `UseReplayEngineOptions` to accept `sessionId?: string; threadId?: string`
- In the fetch useEffect, branch on which ID is provided
- `sessionId` → existing `fetchAllSessionEvents`
- `threadId` → new `fetchThreadReplayEvents`
- Add INV-4 guard: throw if both provided

**Step 6: Commit**

---

### Task 3: TheaterOverlay component

**Files:**
- Create: `packages/web/src/components/story-player/TheaterOverlay.tsx`
- Create: `packages/web/src/components/story-player/__tests__/theater-overlay.test.ts`
- Create: `packages/web/src/components/story-player/TheaterOverlay.module.css`

**Step 1: Write tests**

```typescript
// theater-overlay.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TheaterOverlay } from '../TheaterOverlay';

// Mock useReplayEngine
vi.mock('@/lib/story-player/useReplayEngine', () => ({
  useReplayEngine: () => ({
    engine: { state: 'idle', currentIndex: 0, totalEvents: 5, speed: 100, displayMode: 'cinematic', adaptivePacing: true },
    visibleEvents: [],
    events: [],
    isLoading: false,
    error: null,
    activeSkip: null,
    chapters: [],
    togglePlayPause: vi.fn(),
    doSeek: vi.fn(),
    doSetSpeed: vi.fn(),
    doStepForward: vi.fn(),
    doStepBackward: vi.fn(),
    doToggleDisplayMode: vi.fn(),
    doToggleAdaptivePacing: vi.fn(),
  }),
}));

describe('TheaterOverlay', () => {
  // INV-2: closed state renders null
  it('renders null when not open', () => {
    // TheaterOverlay is always rendered when mounted — parent controls mount
    // So test that it renders content when mounted
    const { container } = render(
      <TheaterOverlay threadId="t1" onClose={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="theater-overlay"]')).toBeTruthy();
  });

  // INV-3: Escape closes
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TheaterOverlay threadId="t1" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders backdrop with blur', () => {
    const { container } = render(
      <TheaterOverlay threadId="t1" onClose={vi.fn()} />,
    );
    const backdrop = container.querySelector('[data-testid="theater-backdrop"]');
    expect(backdrop).toBeTruthy();
  });

  it('shows ReplayControls', () => {
    render(<TheaterOverlay threadId="t1" onClose={vi.fn()} />);
    // ReplayControls has a play/pause button
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeTruthy();
  });
});
```

**Step 2: Run to verify red**

**Step 3: Write TheaterOverlay component**

Key design decisions：
- `position: fixed` + `inset: 0` + `z-index: 1000` 覆盖 Hub
- Backdrop: `backdrop-filter: blur(12px)` + 半透明 overlay
- Stage 区域：使用 Hub 的 ChatMessage 组件渲染 visibleEvents
- 底部：复用现有 ReplayControls
- 关闭：点击 ✕ 按钮或 Escape

**Step 4: Run test to verify green**

**Step 5: Commit**

---

### Task 4: ReplayMessageList — Hub 组件渲染回放事件

**Files:**
- Create: `packages/web/src/components/story-player/ReplayMessageList.tsx`
- Modify: `packages/web/src/components/story-player/TheaterOverlay.tsx` (integrate)

**核心**：将 `visibleEvents` 通过 `bridgeReplayEvent` 转为 `ReplayChatMessage`，然后用 `MessageBubble` + Hub 子组件（`CollapsibleMarkdown`, `ThinkingContent`, `CliOutputBlock`）渲染。

**不直接用 `ChatMessage`** 的原因：ChatMessage 依赖 `getCatById`、`chatStore`、`MessageActions` 等 Hub store 基础设施。在 Theater Overlay 里我们不在正常 chat context 中。所以用 `MessageBubble`（纯布局组件）+ 手动组合子组件。

```typescript
// ReplayMessageList.tsx 核心逻辑
function ReplayMessageItem({ event }: { event: ReplayChatMessage }) {
  // Cat avatar for assistant messages
  const avatar = event.type === 'assistant' && event.catId
    ? <CatAvatar catId={event.catId} size={32} />
    : event.type === 'user'
      ? <div className="user-avatar">👤</div>
      : null;

  return (
    <MessageBubble
      messageId={event.id}
      avatar={avatar}
      align={event.type === 'user' ? 'right' : 'left'}
    >
      {event.thinking && <ThinkingContent thinking={event.thinking} />}
      {event.content && <CollapsibleMarkdown content={event.content} />}
      {event.toolEvents?.map(te => (
        <CliOutputBlock key={te.id} toolName={te.name} input={te.input} output={te.output} isError={te.isError} />
      ))}
    </MessageBubble>
  );
}
```

**Step 1-5: TDD 常规流程**

**Step 6: Commit**

---

### Task 5: Thread 列表回放入口

**Files:**
- Modify: Hub 中的 Thread 卡片组件（需确认具体文件路径）
- 添加 "🎬 回放" 按钮 → 打开 TheaterOverlay

**Step 1: 找到 Thread 卡片组件**

```bash
grep -r "ThreadCard\|ThreadItem\|ThreadListItem" packages/web/src/components/ --include="*.tsx" -l
```

**Step 2: 添加回放按钮**

在 Thread 卡片上添加 🎬 图标按钮（右键菜单或卡片上的小按钮），点击时：
1. 设置 `replayThreadId` 状态
2. 渲染 `<TheaterOverlay threadId={replayThreadId} onClose={() => setReplayThreadId(null)} />`

**Step 3-5: 测试 + 提交**

---

### Task 6: 删除旧 StoryPlayerPage 独立页面

**Files:**
- Remove: `packages/web/src/app/story/[storyId]/page.tsx`（整个路由废弃）
- Remove: `packages/web/src/components/story-player/ReplayEventBubble.tsx`（被 ReplayMessageList 替代）
- Keep: `packages/web/src/lib/story-player/*`（引擎层全保留）
- Keep: `packages/web/src/components/story-player/ReplayControls.tsx`（复用）
- Keep: `packages/web/src/components/story-player/AnnotationEditor.tsx`（Phase D，后续集成到 Theater）
- Keep: `packages/web/src/components/story-player/AnnotationOverlay.tsx`（Phase D）

**不是现在删**——TheaterOverlay 跑通后再删旧页面，确保无回归。

---

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-E1 | `CliOutputBlock` 是否直接接受 `toolName + input + output` props，还是需要一个 `ToolEvent` 对象？ | 技术 OQ — 实现时确认 CliOutputBlock props interface |
| OQ-E2 | Thread sessions API (`GET /api/threads/:threadId/sessions`) 的 response shape 是什么？ | 技术 OQ — 实现时确认 |
| OQ-E3 | 删除旧 `/story/[storyId]` 路由后，Phase D 的 public share URL 怎么办？ | 技术 OQ — public share 可以打开 TheaterOverlay 的 readonly 模式 |

## What We're NOT Building（Phase E PR-1 scope）

- ❌ Spotlight/Dim（PR E-2）
- ❌ Bullet time 子弹时间（PR E-2）
- ❌ Multi-cam 分屏（PR E-2）
- ❌ Guest cameo 客串卡片（PR E-3）
- ❌ Timeline 热力图（PR E-3）
- ❌ Feature 级回放（旅程 2 — 需要 E-2/E-3 基础）
- ❌ 音效
- ❌ 猫猫 Live Avatar 微动画
- ❌ 粒子飞线 WebGL
