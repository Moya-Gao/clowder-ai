---
feature_ids: [F252]
phase: E
doc_kind: plan
created: 2026-06-27
---

# F252 Phase E PR E-3: Test File Split + Milestone Badge UI

**Feature:** F252 — `docs/features/F252-story-player.md`
**Goal:** Split oversized test file (opus-47 P2: 552 > 350 limit) + upgrade chapter markers to golden milestone badges with hover tooltips (AC-E7 remaining for single-thread)
**Acceptance Criteria:** opus-47 P2 (test hygiene), AC-E7 remaining (milestone badges)
**Architecture cell:** `web/story-player` (existing)
**Map delta:** none
**Map delta why:** Pure test reorganization + visual enhancement within existing cell
**Architecture:** Test split is zero-behavior-change file reorganization. Milestone badges upgrade existing chapter marker rendering in ReplayControls.tsx with differentiated styling and a hover tooltip popover.
**Tech Stack:** Vitest (test split), React/CSS (badges)
**Front-end verification:** Yes — reviewer must visually verify badge styling and tooltips

---

## Stateful Object Gate

**NOT triggered.** This PR introduces zero stateful objects with lifecycles:
- Task 1 (test split): Pure file reorganization, zero behavior change
- Task 2 (milestone badges): Pure CSS/component visual enhancement on existing `Chapter[]` data. No new stores, no lifecycle, no state transitions.

---

## Scope boundaries

**Building:**
- Split `bullet-time-engine.test.ts` (552 lines) → 3 files, each < 200 lines
- Upgrade chapter marker visuals → golden badge styling, differentiated by kind
- Add hover tooltip popover on chapter markers (label + relative time)

**NOT building:**
- Multi-cam split screen (AC-E5 — separate PR E-4)
- Spotlight/Dim (AC-E3 — needs multi-cam, PR E-4)
- CSS arc animations (AC-E4 remaining — needs multi-cam, PR E-4)
- Guest cameo cards (AC-E6 — needs multi-cam, PR E-4)
- F233 projection milestone badges (Feature-level context, Phase C territory)

---

## Terminal schema

### Chapter milestone badge styling (enhancement to existing `ReplayControls.tsx`)

```typescript
// No new types — uses existing Chapter from chapters.ts

// Visual mapping (CSS only):
// pass_ball → golden badge, glow effect, 🏐 icon
// invocation → indigo badge, 🔄 icon
// post_idle → gray badge, ⏩ icon
// session_start/end → no badge (filtered out, unchanged)

// Hover tooltip (new element):
// Positioned above badge, shows: icon + label + "at X:XX"
// Appears on hover, disappears on leave
// Pure CSS/React state, no external state
```

---

## Task 1: Split bullet-time-engine.test.ts

Zero behavior change. Pure file reorganization.

**Files:**
- Delete: `packages/web/src/lib/story-player/__tests__/bullet-time-engine.test.ts` (552 lines)
- Create: `packages/web/src/lib/story-player/__tests__/bullet-time-trigger.test.ts` (~190 lines)
- Create: `packages/web/src/lib/story-player/__tests__/bullet-time-lifecycle.test.ts` (~200 lines)
- Create: `packages/web/src/lib/story-player/__tests__/bullet-time-seek.test.ts` (~190 lines)

### File split plan:

**bullet-time-trigger.test.ts** — Entry conditions and invariants:
- Shared helpers (`makeEvents`, `tickBy`) — duplicated in each file
- INV-5: createReplayEngine starts with bulletTime=null
- Enters bullet time on tick to pass-ball
- INV-4: no bullet time when adaptivePacing=false
- Toggle adaptive clears bulletTime
- Toggle adaptive doesn't resume stale bulletTime
- INV-2: triggerIndex always points to pass-ball event
- INV-1: progressMs >= 0
- Speed verification: fewer events during bullet time

**bullet-time-lifecycle.test.ts** — Duration, exit, end-state, MAX speed:
- Shared helpers duplicated
- Exits bullet time after total duration elapses
- 对抗1: clears bullet time when engine reaches ended
- 对抗2: restarts bullet time on consecutive pass-balls
- 对抗5: preserves bullet time across pause/play
- INV-5/tickMax: clears bulletTime when MAX reaches ended
- tickMax non-ending: clears stale bulletTime

**bullet-time-seek.test.ts** — Seek and step interactions:
- Shared helpers duplicated
- Exits bullet time on seek to different index
- Preserves bullet time on seek to same trigger
- stepForward clears stale bulletTime
- stepBackward clears stale bulletTime
- stepForward preserves when clamped
- Seek to pass-ball while playing inits bulletTime (R3)
- Seek to pass-ball while paused does NOT init (R3)
- Seek to non-pass-ball while playing does NOT init (R3)

### Steps:

**Step 1: Create bullet-time-trigger.test.ts**

Extract tests: INV-5 initial, enter on tick, INV-4 adaptive off, toggle clears, toggle no resume, INV-2 valid index, INV-1 progressMs, speed verification.

**Step 2: Create bullet-time-lifecycle.test.ts**

Extract tests: duration exit, 对抗1 ended, 对抗2 consecutive, 对抗5 pause/play, MAX ended, MAX non-ending.

**Step 3: Create bullet-time-seek.test.ts**

Extract tests: seek exit, seek preserve, stepForward clear, stepBackward clear, stepForward clamp, 3× R3 seek init.

**Step 4: Delete original bullet-time-engine.test.ts**

**Step 5: Run tests**

```bash
cd ../cat-cafe-f252-e3 && pnpm test -- --filter story-player
```

Expected: All 22 tests pass (same count, just split across 3 files).

**Step 6: Commit**

```bash
git add packages/web/src/lib/story-player/__tests__/bullet-time-*.test.ts
git commit -m "refactor(f252): split bullet-time-engine.test.ts into 3 files (opus-47 P2)

552 lines exceeded 350-line limit. Split by concern:
- trigger: entry conditions + invariants (8 tests)
- lifecycle: duration/exit/MAX speed (6 tests)
- seek: seek/step interactions (8 tests)

Zero behavior change — same 22 tests, same coverage.

[宪宪/Opus-4.6🐾]"
```

---

## Task 2: Milestone badge UI + hover tooltips

Upgrade existing chapter markers from plain rectangles to styled golden badges with hover tooltips.

**Files:**
- Modify: `packages/web/src/components/story-player/ReplayControls.tsx:182-222`
- Create: `packages/web/src/components/story-player/ChapterBadge.tsx` (~80 lines)
- Test: `packages/web/src/components/story-player/__tests__/ChapterBadge.test.tsx` (~90 lines)

### Step 1: Write failing test for ChapterBadge

```typescript
// packages/web/src/components/story-player/__tests__/ChapterBadge.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChapterBadge } from '../ChapterBadge';

describe('ChapterBadge', () => {
  const baseProps = {
    kind: 'pass_ball' as const,
    label: '→ @codex',
    icon: '🏐',
    position: 50, // percentage
    isPast: true,
    relativeTime: '2:30',
    onClick: vi.fn(),
  };

  it('renders badge at correct position', () => {
    render(<ChapterBadge {...baseProps} />);
    const badge = screen.getByRole('button', { name: /→ @codex/ });
    expect(badge).toBeDefined();
  });

  it('shows tooltip on hover', async () => {
    render(<ChapterBadge {...baseProps} />);
    const badge = screen.getByRole('button', { name: /→ @codex/ });
    await userEvent.hover(badge);
    expect(screen.getByText('→ @codex')).toBeDefined();
    expect(screen.getByText('at 2:30')).toBeDefined();
  });

  it('calls onClick when clicked', async () => {
    render(<ChapterBadge {...baseProps} />);
    const badge = screen.getByRole('button', { name: /→ @codex/ });
    await userEvent.click(badge);
    expect(baseProps.onClick).toHaveBeenCalledOnce();
  });

  it('applies golden styling for pass_ball kind', () => {
    const { container } = render(<ChapterBadge {...baseProps} />);
    const badge = container.querySelector('[data-chapter-kind="pass_ball"]');
    expect(badge).toBeDefined();
  });

  it('applies indigo styling for invocation kind', () => {
    const { container } = render(<ChapterBadge {...baseProps} kind="invocation" icon="🔄" />);
    const badge = container.querySelector('[data-chapter-kind="invocation"]');
    expect(badge).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ../cat-cafe-f252-e3 && pnpm vitest run packages/web/src/components/story-player/__tests__/ChapterBadge.test.tsx
```
Expected: FAIL — ChapterBadge module not found

**Step 3: Implement ChapterBadge component**

```tsx
// packages/web/src/components/story-player/ChapterBadge.tsx
'use client';

import type { ChapterKind } from '@/lib/story-player/chapters';
import { useState } from 'react';

interface ChapterBadgeProps {
  kind: ChapterKind;
  label: string;
  icon: string;
  /** Position on progress bar (0-100 %) */
  position: number;
  /** Whether this badge is before/at current playback position */
  isPast: boolean;
  /** Formatted relative time string (e.g. "2:30") */
  relativeTime: string;
  onClick: () => void;
}

const KIND_COLORS: Record<ChapterKind, { bg: string; glow: string }> = {
  pass_ball: { bg: '#d4a017', glow: 'rgba(212, 160, 23, 0.5)' },
  invocation: { bg: '#6366f1', glow: 'rgba(99, 102, 241, 0.3)' },
  post_idle: { bg: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)' },
  session_start: { bg: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  session_end: { bg: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
};

export function ChapterBadge({
  kind, label, icon, position, isPast, relativeTime, onClick,
}: ChapterBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const colors = KIND_COLORS[kind];

  return (
    <button
      type="button"
      data-chapter-kind={kind}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: `${position}%`,
        top: '-5px',
        width: '10px',
        height: '16px',
        transform: 'translateX(-50%)',
        background: isPast ? colors.bg : `${colors.bg}88`,
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        zIndex: 3,
        boxShadow: isPast ? `0 0 6px ${colors.glow}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        fontSize: '8px',
        transition: 'box-shadow 0.2s ease, transform 0.15s ease',
        ...(hovered ? { transform: 'translateX(-50%) scale(1.3)', boxShadow: `0 0 10px ${colors.glow}` } : {}),
      }}
    >
      <span style={{ pointerEvents: 'none', lineHeight: 1 }}>{icon}</span>

      {/* Hover tooltip */}
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '4px 8px',
            background: 'rgba(0, 0, 0, 0.9)',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            color: '#e0e0e0',
            fontFamily: 'var(--font-mono, monospace)',
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            border: `1px solid ${colors.bg}44`,
          }}
        >
          <span>{label}</span>
          <span style={{ opacity: 0.7, fontSize: '10px' }}>at {relativeTime}</span>
        </div>
      )}
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd ../cat-cafe-f252-e3 && pnpm vitest run packages/web/src/components/story-player/__tests__/ChapterBadge.test.tsx
```
Expected: PASS (5 tests)

**Step 5: Wire ChapterBadge into ReplayControls**

Replace the inline chapter marker rendering (lines 182-222 in `ReplayControls.tsx`) with `ChapterBadge` component.

Replace:
```tsx
{chapters
  .filter((ch) => ch.kind !== 'session_start' && ch.kind !== 'session_end')
  .map((ch) => {
    const pct = engine.totalEvents > 1 ? (ch.eventIndex / (engine.totalEvents - 1)) * 100 : 0;
    return (
      <button type="button" key={...} title={...} onClick={...} style={{...}}>
        <span style={{ pointerEvents: 'none' }}>{chapterIcon(ch.kind)}</span>
      </button>
    );
  })}
```

With:
```tsx
{chapters
  .filter((ch) => ch.kind !== 'session_start' && ch.kind !== 'session_end')
  .map((ch) => {
    const pct = engine.totalEvents > 1 ? (ch.eventIndex / (engine.totalEvents - 1)) * 100 : 0;
    return (
      <ChapterBadge
        key={`ch-${ch.eventIndex}`}
        kind={ch.kind}
        label={`${chapterIcon(ch.kind)} ${ch.label}`}
        icon={chapterIcon(ch.kind)}
        position={pct}
        isPast={ch.eventIndex <= engine.currentIndex}
        relativeTime={formatDuration(
          engine.totalDurationMs > 0 && engine.totalEvents > 1
            ? (ch.eventIndex / (engine.totalEvents - 1)) * engine.totalDurationMs
            : 0
        )}
        onClick={() => onSeek(ch.eventIndex)}
      />
    );
  })}
```

**Step 6: Run full test suite**

```bash
cd ../cat-cafe-f252-e3 && pnpm test
```
Expected: All tests pass (existing + 5 new ChapterBadge tests)

**Step 7: Commit**

```bash
git add packages/web/src/components/story-player/ChapterBadge.tsx \
       packages/web/src/components/story-player/__tests__/ChapterBadge.test.tsx \
       packages/web/src/components/story-player/ReplayControls.tsx
git commit -m "feat(f252): milestone badge UI with hover tooltips (AC-E7)

Chapter markers upgraded from plain rectangles to styled badges:
- pass_ball → golden with glow (most narrative impact)
- invocation → indigo
- post_idle → gray
Hover shows label + relative timestamp in tooltip popover.

[宪宪/Opus-4.6🐾]"
```

---

## Open Questions

None. Both tasks are self-contained with no value-level ambiguity.
