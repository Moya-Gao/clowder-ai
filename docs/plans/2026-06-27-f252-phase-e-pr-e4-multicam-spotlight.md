# F252 Phase E PR E-4: Multi-Cam Stage + Spotlight/Dim

**Feature:** F252 — `docs/features/F252-story-player.md`
**Goal:** Feature-level theater replay with dynamic multi-thread layout and spotlight/dim visual effects
**Acceptance Criteria:**
- AC-E5: Multi-cam split screen — 1 Thread center, 2 Thread 50/50, 3+ Thread main+sidebar
- AC-E3: Spotlight + Dim — active Thread spotlight with glow, inactive blur/dim
**Architecture cell:** hub-story-player
**Map delta:** none
**Map delta why:** MultiCamStage is a layout within the existing story-player cell
**Architecture:** Single unified timeline engine replays all threads' events together; visible events partitioned by threadId drive per-panel rendering and active thread detection. Layout responds to active thread count. CSS-only spotlight/dim effects.
**Tech Stack:** React, CSS variables, existing replay engine, existing thread-replay-fetcher
**Front-end verification:** Yes — reviewer must use browser to verify layout transitions and spotlight/dim effects

---

## Finish Line

**B definition:** User clicks "Play Feature" on BirdseyeView → FeatureTheater opens inside TheaterOverlay. Multiple thread panels arranged dynamically (1→center, 2→side-by-side, 3+→main+sidebar). Active thread has spotlight glow. Inactive threads have backdrop-blur dim. Layout transitions smoothly as different threads become active during playback.

**What we're NOT building:**
- No per-thread independent replay engines (single unified engine)
- No WebGL particle effects / sound (MVP uses CSS)
- No guest cameo cards (AC-E6 → PR E-5)
- No lazy per-thread event loading (all threads fetched upfront; optimization deferred)

## Terminal Schema

```typescript
// --- Logic layer ---

/** Merged event with source threadId preserved */
interface FeatureReplayEvent extends ReplayEvent {
  /** Original threadId this event belongs to */
  sourceThreadId: string;
}

/** Active thread detection output */
interface ActiveThreadState {
  /** Thread IDs with events near the current playback position */
  activeThreadIds: string[];
  /** Thread whose event is currently playing (spotlight) */
  spotlightThreadId: string | null;
  /** Layout mode derived from active count */
  layout: 'single' | 'dual' | 'multi';
}

// --- Component layer ---

interface MultiCamStageProps {
  /** Panels to render, ordered by priority */
  panels: ThreadPanelConfig[];
  /** Currently active layout mode */
  layout: 'single' | 'dual' | 'multi';
}

interface ThreadPanelConfig {
  threadId: string;
  threadName: string;
  participants: string[];
  /** Visual state */
  mode: 'spotlight' | 'active' | 'dim';
  /** Messages visible in this panel (filtered from unified timeline) */
  messages: ReplayChatMessage[];
}
```

## Tasks

### Task 1: Feature replay event merger (logic layer)

**Files:**
- Create: `packages/web/src/lib/story-player/feature-replay-merger.ts`
- Test: `packages/web/src/lib/story-player/__tests__/feature-replay-merger.test.ts`

**Step 1: Write failing tests**

```typescript
// feature-replay-merger.test.ts
import { describe, it, expect } from 'vitest';
import { mergeFeatureEvents } from '../feature-replay-merger';
import type { RawTranscriptEvent } from '../types';

function makeRaw(threadId: string, t: number, eventNo: number): RawTranscriptEvent {
  return { v: 1, t, threadId, catId: 'opus', sessionId: 's1', cliSessionId: 'cs1', eventNo, event: { type: 'text', text: `msg-${threadId}-${eventNo}` } };
}

describe('mergeFeatureEvents', () => {
  it('merges events from multiple threads sorted by timestamp', () => {
    const threadEvents = new Map([
      ['t1', [makeRaw('t1', 1000, 0), makeRaw('t1', 3000, 1)]],
      ['t2', [makeRaw('t2', 2000, 0), makeRaw('t2', 4000, 1)]],
    ]);
    const merged = mergeFeatureEvents(threadEvents);
    expect(merged.map(e => e.threadId)).toEqual(['t1', 't2', 't1', 't2']);
    expect(merged.map(e => e.eventNo)).toEqual([0, 1, 2, 3]);  // re-indexed
  });

  it('preserves original threadId on each event', () => {
    const threadEvents = new Map([
      ['t1', [makeRaw('t1', 1000, 0)]],
      ['t2', [makeRaw('t2', 2000, 0)]],
    ]);
    const merged = mergeFeatureEvents(threadEvents);
    expect(merged[0].threadId).toBe('t1');
    expect(merged[1].threadId).toBe('t2');
  });

  it('handles empty thread map', () => {
    expect(mergeFeatureEvents(new Map())).toEqual([]);
  });

  it('handles single thread', () => {
    const threadEvents = new Map([
      ['t1', [makeRaw('t1', 1000, 0), makeRaw('t1', 2000, 1)]],
    ]);
    const merged = mergeFeatureEvents(threadEvents);
    expect(merged).toHaveLength(2);
    expect(merged[0].threadId).toBe('t1');
  });

  it('stable sort preserves intra-thread order for same-timestamp events', () => {
    const threadEvents = new Map([
      ['t1', [makeRaw('t1', 1000, 0), makeRaw('t1', 1000, 1)]],
      ['t2', [makeRaw('t2', 1000, 0)]],
    ]);
    const merged = mergeFeatureEvents(threadEvents);
    expect(merged).toHaveLength(3);
    // All at t=1000 — stable sort preserves insertion order
    expect(merged.every(e => e.t === 1000)).toBe(true);
  });
});
```

**Step 2: Run tests, confirm RED**

```bash
cd /path/to/worktree/packages/web && env -u NODE_ENV pnpm vitest run src/lib/story-player/__tests__/feature-replay-merger.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement merger**

```typescript
// feature-replay-merger.ts
import type { RawTranscriptEvent } from './types';

/**
 * Merge events from multiple threads into a single time-sorted stream.
 * Each event retains its original threadId for per-panel partitioning.
 * Re-indexes eventNo monotonically after merge.
 */
export function mergeFeatureEvents(threadEventMap: Map<string, RawTranscriptEvent[]>): RawTranscriptEvent[] {
  const all: RawTranscriptEvent[] = [];
  for (const events of threadEventMap.values()) {
    all.push(...events);
  }
  // Stable sort by timestamp
  all.sort((a, b) => a.t - b.t);
  // Re-index
  for (let i = 0; i < all.length; i++) {
    all[i] = { ...all[i], eventNo: i };
  }
  return all;
}
```

**Step 4: Run tests, confirm GREEN**

**Step 5: Commit** `feat(f252): add feature-replay-merger for multi-thread timeline`

---

### Task 2: Active thread tracker (logic layer)

**Files:**
- Create: `packages/web/src/lib/story-player/active-thread-tracker.ts`
- Test: `packages/web/src/lib/story-player/__tests__/active-thread-tracker.test.ts`

**Step 1: Write failing tests**

```typescript
// active-thread-tracker.test.ts
import { describe, it, expect } from 'vitest';
import { detectActiveThreads, type ActiveThreadState } from '../active-thread-tracker';
import type { ReplayEvent } from '../types';

function makeEvent(index: number, threadId: string, timestamp: number): ReplayEvent & { sourceThreadId: string } {
  return {
    index, type: 'message', timestamp, role: 'assistant',
    content: 'test', eventNo: index, sourceThreadId: threadId,
  };
}

describe('detectActiveThreads', () => {
  const events = [
    makeEvent(0, 't1', 1000),
    makeEvent(1, 't1', 2000),
    makeEvent(2, 't2', 3000),  // t2 becomes active
    makeEvent(3, 't1', 4000),  // t1 still active
    makeEvent(4, 't2', 5000),
    makeEvent(5, 't3', 6000),  // t3 joins
    makeEvent(6, 't1', 7000),
  ];

  it('spotlight is the current event thread', () => {
    const result = detectActiveThreads(events, 2, 2000);
    expect(result.spotlightThreadId).toBe('t2');
  });

  it('active threads include those with events within window', () => {
    // At index 3 (t1, ts=4000), window=2000 → events at ts >= 2000
    // t1 has events at 2000, 4000; t2 has event at 3000 → both active
    const result = detectActiveThreads(events, 3, 2000);
    expect(result.activeThreadIds).toContain('t1');
    expect(result.activeThreadIds).toContain('t2');
    expect(result.activeThreadIds).not.toContain('t3');
  });

  it('returns single layout for one active thread', () => {
    const result = detectActiveThreads(events, 0, 500);
    expect(result.layout).toBe('single');
  });

  it('returns dual layout for two active threads', () => {
    const result = detectActiveThreads(events, 3, 2000);
    expect(result.layout).toBe('dual');
  });

  it('returns multi layout for three+ active threads', () => {
    const result = detectActiveThreads(events, 6, 5000);
    expect(result.layout).toBe('multi');
  });

  it('handles empty events', () => {
    const result = detectActiveThreads([], 0, 2000);
    expect(result.activeThreadIds).toEqual([]);
    expect(result.spotlightThreadId).toBeNull();
    expect(result.layout).toBe('single');
  });

  it('handles out-of-bounds index', () => {
    const result = detectActiveThreads(events, 999, 2000);
    expect(result.spotlightThreadId).toBeNull();
  });

  it('spotlight thread is always first in activeThreadIds', () => {
    const result = detectActiveThreads(events, 2, 2000);
    expect(result.activeThreadIds[0]).toBe(result.spotlightThreadId);
  });
});
```

**Step 2: Run tests, confirm RED**

**Step 3: Implement tracker**

```typescript
// active-thread-tracker.ts
import type { ReplayEvent } from './types';

export interface ActiveThreadState {
  activeThreadIds: string[];
  spotlightThreadId: string | null;
  layout: 'single' | 'dual' | 'multi';
}

interface FeatureReplayEvent extends ReplayEvent {
  sourceThreadId: string;
}

/**
 * Detect which threads are active at a given playback position.
 *
 * Active = has events within `windowMs` before the current event's timestamp.
 * Spotlight = the thread of the event at `currentIndex`.
 *
 * @param events - Merged feature events with sourceThreadId
 * @param currentIndex - Current playback position
 * @param windowMs - Time window to consider threads "active" (default 30s)
 */
export function detectActiveThreads(
  events: readonly (ReplayEvent & { sourceThreadId?: string })[],
  currentIndex: number,
  windowMs = 30_000,
): ActiveThreadState {
  if (events.length === 0 || currentIndex < 0 || currentIndex >= events.length) {
    return { activeThreadIds: [], spotlightThreadId: null, layout: 'single' };
  }

  const current = events[currentIndex] as FeatureReplayEvent;
  const spotlightThreadId = current.sourceThreadId ?? null;
  const cutoff = current.timestamp - windowMs;

  // Collect unique threads with events in the window [cutoff, current.timestamp]
  const activeSet = new Set<string>();
  // Scan backward from currentIndex (events are time-sorted)
  for (let i = currentIndex; i >= 0; i--) {
    const ev = events[i] as FeatureReplayEvent;
    if (ev.timestamp < cutoff) break;
    if (ev.sourceThreadId) activeSet.add(ev.sourceThreadId);
  }

  // Ensure spotlight is in active set and first
  if (spotlightThreadId) activeSet.add(spotlightThreadId);
  const activeThreadIds = spotlightThreadId
    ? [spotlightThreadId, ...[...activeSet].filter(id => id !== spotlightThreadId)]
    : [...activeSet];

  const count = activeThreadIds.length;
  const layout = count <= 1 ? 'single' : count === 2 ? 'dual' : 'multi';

  return { activeThreadIds, spotlightThreadId, layout };
}
```

**Step 4: Run tests, confirm GREEN**

**Step 5: Commit** `feat(f252): add active-thread-tracker for multi-cam layout decisions`

---

### Task 3: MultiCamStage layout component

**Files:**
- Create: `packages/web/src/components/story-player/MultiCamStage.tsx`
- Test: `packages/web/src/components/story-player/__tests__/MultiCamStage.test.tsx`

**Step 1: Write failing tests**

```typescript
// MultiCamStage.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MultiCamStage, type ThreadPanelConfig } from '../MultiCamStage';

function makePanel(threadId: string, mode: 'spotlight' | 'active' | 'dim'): ThreadPanelConfig {
  return { threadId, threadName: `Thread ${threadId}`, participants: ['opus'], mode, messages: [] };
}

describe('MultiCamStage', () => {
  it('renders single panel centered', () => {
    const { container } = render(
      <MultiCamStage panels={[makePanel('t1', 'spotlight')]} layout="single" />
    );
    const stage = container.querySelector('[data-testid="multicam-stage"]');
    expect(stage).not.toBeNull();
    const panels = container.querySelectorAll('[data-testid^="thread-panel-"]');
    expect(panels).toHaveLength(1);
  });

  it('renders dual panels side by side', () => {
    const { container } = render(
      <MultiCamStage
        panels={[makePanel('t1', 'spotlight'), makePanel('t2', 'active')]}
        layout="dual"
      />
    );
    const panels = container.querySelectorAll('[data-testid^="thread-panel-"]');
    expect(panels).toHaveLength(2);
  });

  it('renders multi layout with main + sidebar', () => {
    const { container } = render(
      <MultiCamStage
        panels={[makePanel('t1', 'spotlight'), makePanel('t2', 'active'), makePanel('t3', 'dim')]}
        layout="multi"
      />
    );
    const main = container.querySelector('[data-testid="multicam-main"]');
    const sidebar = container.querySelector('[data-testid="multicam-sidebar"]');
    expect(main).not.toBeNull();
    expect(sidebar).not.toBeNull();
  });

  it('applies spotlight class to spotlight panel', () => {
    const { container } = render(
      <MultiCamStage panels={[makePanel('t1', 'spotlight'), makePanel('t2', 'dim')]} layout="dual" />
    );
    const spotlightPanel = container.querySelector('[data-testid="thread-panel-t1"]');
    expect(spotlightPanel?.getAttribute('data-panel-mode')).toBe('spotlight');
  });

  it('applies dim class to dim panel', () => {
    const { container } = render(
      <MultiCamStage panels={[makePanel('t1', 'spotlight'), makePanel('t2', 'dim')]} layout="dual" />
    );
    const dimPanel = container.querySelector('[data-testid="thread-panel-t2"]');
    expect(dimPanel?.getAttribute('data-panel-mode')).toBe('dim');
  });
});
```

**Step 2: Run tests, confirm RED**

**Step 3: Implement MultiCamStage**

Layout rules:
- `single`: `flex-1` center panel, max-width 900px
- `dual`: `grid grid-cols-2 gap-3`, equal columns
- `multi`: `grid` with main area (2 panels) + sidebar column (thumbnail panels stacked)

Visual effects per panel mode:
- `spotlight`: `box-shadow: 0 0 20px rgba(168,85,247,0.25), 0 0 40px rgba(168,85,247,0.1)` + `border: 1.5px solid rgba(168,85,247,0.5)` + `transition: all 300ms ease`
- `active`: normal border, no glow
- `dim`: `backdrop-filter: blur(4px)` + `opacity: 0.55` + `filter: brightness(0.7)` + `pointer-events: none` on message area

Each panel renders: thread header (name + participants) + message list (ReplayMessageList reuse).

**Step 4: Run tests, confirm GREEN**

**Step 5: Commit** `feat(f252): add MultiCamStage layout component with spotlight/dim`

---

### Task 4: ThreadPanel component (per-thread panel within MultiCamStage)

**Files:**
- Create: `packages/web/src/components/story-player/ThreadPanel.tsx`
- Test: `packages/web/src/components/story-player/__tests__/ThreadPanel.test.tsx`

**Step 1: Write failing tests**

Test: renders thread name, participants, message list. Verifies spotlight glow styles, dim blur styles.

**Step 2: Run tests, confirm RED**

**Step 3: Implement ThreadPanel**

ThreadPanel wraps:
- Header: thread name + participant cat badges
- Body: ReplayMessageList (existing) with the panel's filtered messages
- Uses CSS variable tokens (F190 visual contract): `var(--console-font-compact)`, `var(--console-text-primary)`

**Step 4: Run tests, confirm GREEN**

**Step 5: Commit** `feat(f252): add ThreadPanel for per-thread rendering in multi-cam`

---

### Task 5: useFeatureReplay hook (feature-level replay orchestrator)

**Files:**
- Create: `packages/web/src/lib/story-player/useFeatureReplay.ts`

**Step 1: Implement hook**

```typescript
// useFeatureReplay.ts
// Orchestrates feature-level replay:
// 1. Fetch FeatureStoryRenderingDTO → get thread list
// 2. Fetch events for all threads (parallel fetchThreadReplayEvents)
// 3. Merge into unified timeline (mergeFeatureEvents)
// 4. Adapt + annotate + compress (existing pipeline)
// 5. Create single replay engine
// 6. On each tick: detectActiveThreads + partition visible events by threadId
// 7. Return: activeThreadState + per-thread messages + engine controls

export function useFeatureReplay({ featId }: { featId: string }): UseFeatureReplayResult {
  // Phase 1: Fetch rendering DTO for thread list + metadata
  // Phase 2: Fetch events for all threads
  // Phase 3: Merge + adapt + create engine (reuse existing pipeline)
  // Phase 4: On render: partition visibleEvents by sourceThreadId
  // Phase 5: detectActiveThreads for layout decisions
}
```

Key design: extends existing `useReplayEngine` pattern but with multi-thread data source. Engine is single instance — no per-thread engines. `sourceThreadId` is preserved on each adapted event via an extension to the adapter.

**Step 2: Verify manually — feature theater loads and plays (browser test in review)**

**Step 3: Commit** `feat(f252): add useFeatureReplay hook for multi-thread orchestration`

---

### Task 6: FeatureTheaterContent orchestrator component

**Files:**
- Create: `packages/web/src/components/story-player/FeatureTheaterContent.tsx`

**Step 1: Implement**

```typescript
// FeatureTheaterContent.tsx
// Wires useFeatureReplay → MultiCamStage + ReplayControls
// - Loading state: spinner with "Loading N threads..."
// - Error state: error message
// - Ready state: MultiCamStage with ThreadPanels + ReplayControls bar

export function FeatureTheaterContent({ featId }: { featId: string }) {
  const { threadPanels, engine, chapters, densityBuckets, isLoading, error, ...controls } =
    useFeatureReplay({ featId });
  
  // ... loading/error states ...
  
  return (
    <div className="flex flex-col h-full">
      <MultiCamStage panels={threadPanels} layout={threadPanels.layout}>
        {/* Panels rendered by MultiCamStage internally */}
      </MultiCamStage>
      <div className="border-t ...">
        <ReplayControls engine={engine} ... />
      </div>
    </div>
  );
}
```

**Step 2: Commit** `feat(f252): add FeatureTheaterContent orchestrator`

---

### Task 7: Integration — BirdseyeView play button + TheaterOverlay mode

**Files:**
- Modify: `packages/web/src/components/story-player/BirdseyeView.tsx` — add "▶ Play Feature" button
- Modify: `packages/web/src/components/story-player/FeatureStoryView.tsx` — wire play → TheaterOverlay
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` — support feature replay mode

**Step 1: Add play button to BirdseyeView header**

```tsx
// BirdseyeView.tsx header bar — add:
<button onClick={onPlayFeature} className="...">▶ Play Feature</button>
```

**Step 2: Wire FeatureStoryView to open TheaterOverlay with FeatureTheaterContent**

```tsx
// FeatureStoryView.tsx
const [showTheater, setShowTheater] = useState(false);

return (
  <>
    <BirdseyeView data={data} onPlayFeature={() => setShowTheater(true)} />
    {showTheater && (
      <TheaterOverlay open onClose={() => setShowTheater(false)} title={data.title}>
        <FeatureTheaterContent featId={featId} />
      </TheaterOverlay>
    )}
  </>
);
```

**Step 3: Run full test suite, confirm no regressions**

```bash
cd packages/web && env -u NODE_ENV pnpm vitest run src/components/story-player src/lib/story-player
```

**Step 4: Commit** `feat(f252): wire feature theater — BirdseyeView play button + TheaterOverlay`

---

### Task 8: Adapter extension — preserve sourceThreadId through pipeline

**Files:**
- Modify: `packages/web/src/lib/story-player/adapter.ts` — pass through threadId as sourceThreadId
- Modify: `packages/web/src/lib/story-player/types.ts` — add `sourceThreadId?` to ReplayEvent
- Test: existing adapter tests still pass + new test for threadId preservation

**Step 1: Add `sourceThreadId?: string` to ReplayEvent type**

**Step 2: In adapter, carry `raw.threadId` → `adapted.sourceThreadId`**

**Step 3: Run existing adapter tests, confirm GREEN**

**Step 4: Add one test to adapter-pairing or adapter test for threadId preservation**

**Step 5: Commit** `feat(f252): preserve sourceThreadId through adapter pipeline`

> **Note**: This task should be done early (before Task 5) since useFeatureReplay depends on sourceThreadId being available on adapted events. Listed here for logical grouping but implement before Task 5.

---

## Implementation Order

Dependency chain:
1. Task 8 (adapter sourceThreadId) — needed by everything else
2. Task 1 (merger) — needed by useFeatureReplay
3. Task 2 (tracker) — needed by useFeatureReplay
4. Task 3 (MultiCamStage) + Task 4 (ThreadPanel) — parallel, needed by FeatureTheaterContent
5. Task 5 (useFeatureReplay) — depends on 1, 2, 8
6. Task 6 (FeatureTheaterContent) — depends on 3, 4, 5
7. Task 7 (Integration) — depends on 6

Practical order: 8 → 1 → 2 → 3 → 4 → 5 → 6 → 7

## Open Questions

| # | Question | Category | Resolution |
|---|----------|----------|------------|
| OQ-1 | Window size for active thread detection — 30s feels right for demo-scale features but may need tuning for real-world features with multi-hour timelines | Technical | Start with 30s, expose as config if needed during review |
| OQ-2 | Should dim panels show abbreviated messages or just thread header + status? | Technical | Start with messages (ReplayMessageList reuse) — dim effect already reduces readability. Reviewer feedback will tell if it's too noisy |
