# F252 Phase E PR E-2: Bullet Time + Event Density Heatmap + Session Page Sunset

**Feature:** F252 — `docs/features/F252-story-player.md`
**Goal:** Enhance single-thread replay with smooth bullet time deceleration, event density heatmap on progress bar, and sunset the old standalone session replay page
**Acceptance Criteria:** AC-E4 (partial: speed curve, no arc animation), AC-E7 (partial: density heatmap, no F233 milestones), AC-E1 (completion: session page sunset)
**Architecture cell:** `web/story-player` (existing)
**Map delta:** none
**Map delta why:** All changes within existing story-player module
**Architecture:** Pure frontend — engine state machine enhancement (bullet time), new extracted component (EventDensityBar), page route modification (sunset). No backend changes.
**Tech Stack:** React, CSS, existing replay engine
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Scope Split Deviation

Original E-1 plan said:
- E-2: AC-E3 + AC-E4 + AC-E5 (Spotlight + Bullet time + Multi-cam)
- E-3: AC-E6 + AC-E7 (Guest cameo + Timeline heatmap)

Revised based on dependency analysis:
- **E-2 (this PR):** AC-E4 partial + AC-E7 partial + AC-E1 completion — self-contained single-thread enhancements
- **E-3 (next PR):** AC-E3 + AC-E5 + AC-E6 + AC-E4 arc animation — multi-thread expansion (needs new layout system)

**Why:** AC-E3 (Spotlight/Dim) and AC-E5 (Multi-cam) require fundamentally multi-thread layout — can't Spotlight/Dim without multiple threads on screen. AC-E6 (Guest Cameo) needs cross-thread awareness. These three form a cohesive multi-thread PR. Separating the doable single-thread enhancements (speed curve, heatmap, sunset) into E-2 delivers value sooner.

---

## What We're NOT Building

- Multi-thread layout (PR E-3)
- CSS arc animation for causal particle beam (PR E-3, needs multi-cam target)
- F233 milestone badges on timeline (PR E-3, needs feature-level replay context)
- Spotlight/Dim effects (PR E-3, needs multi-thread on screen)

---

## Terminal Schema

### Bullet Time State (engine enhancement)

```typescript
// Added to ReplayEngineState (types.ts)

interface BulletTimeState {
  /** Index of the pass-ball event that triggered bullet time */
  triggerIndex: number;
  /** Accumulated real-world ms since bullet time started */
  progressMs: number;
}

// ReplayEngineState gains:
bulletTime: BulletTimeState | null;
```

### Bullet Time Easing (new pure function)

```typescript
// packages/web/src/lib/story-player/bullet-time.ts

/** Total bullet time duration in real-world ms */
export const BULLET_TIME_TOTAL_MS = 2000;

/** Phase durations */
export const DECEL_MS = 400;    // ramp down
export const HOLD_MS = 1000;    // hold at slow speed
export const ACCEL_MS = 600;    // ramp back up

/** Minimum speed factor at hold phase (e.g., 0.01 = 1% of base speed) */
export const MIN_SPEED_FACTOR = 0.01;

/**
 * Compute bullet time speed factor for a given progress.
 * Returns a multiplier [MIN_SPEED_FACTOR, 1.0]:
 * - Phase 1 (0..DECEL_MS): ease-out from 1.0 → MIN_SPEED_FACTOR
 * - Phase 2 (DECEL_MS..DECEL_MS+HOLD_MS): hold at MIN_SPEED_FACTOR
 * - Phase 3 (DECEL_MS+HOLD_MS..TOTAL): ease-in from MIN_SPEED_FACTOR → 1.0
 */
export function bulletTimeSpeedFactor(progressMs: number): number;
```

### Event Density (new pure function)

```typescript
// packages/web/src/lib/story-player/event-density.ts

export interface DensityBucket {
  /** Normalized density [0, 1] relative to max bucket */
  density: number;
}

/**
 * Compute event density across N buckets spanning the event timeline.
 * Each bucket represents an equal slice of the total duration.
 * Density is normalized to [0, 1] relative to the densest bucket.
 */
export function computeEventDensity(
  events: Array<{ timestamp: number }>,
  bucketCount: number
): DensityBucket[];
```

### EventDensityBar (new extracted component)

```typescript
// packages/web/src/components/story-player/EventDensityBar.tsx

interface EventDensityBarProps {
  /** Density buckets from computeEventDensity */
  buckets: DensityBucket[];
  /** Current progress percentage [0, 100] */
  progress: number;
}

/**
 * Semi-transparent vertical bar visualization behind the progress track.
 * Each bucket renders as a bar whose height reflects event density.
 * Bars behind the playhead are accent-colored; ahead are muted.
 */
export function EventDensityBar({ buckets, progress }: EventDensityBarProps): ReactElement;
```

---

## Stateful Object Gate

### Object: BulletTimeState

**Lifecycle owner:** replay-engine.ts tick() function

**State × Event Transition Table:**

| Current State | Event | Next State | Side Effect |
|---|---|---|---|
| `bulletTime = null` | tick() hits event where `isPassBall && adaptivePacing` | `{ triggerIndex: idx, progressMs: 0 }` | Speed factor drops |
| `{ progressMs < TOTAL }` | tick(deltaMs) | `{ progressMs: prev + deltaMs }` | Speed factor from easing curve |
| `{ progressMs >= TOTAL }` | tick(deltaMs) | `null` | Speed factor returns to 1.0 |
| `{ triggerIndex: N }` | seek(target) where `target !== N` | `null` | Exits bullet time on seek |
| `any` | pause() | preserved | Bullet time freezes |
| `any` | play() from paused | preserved | Bullet time resumes |
| `{ triggerIndex: N }` | tick() hits ANOTHER isPassBall at M≠N | `{ triggerIndex: M, progressMs: 0 }` | Restart bullet time for new pass-ball |

**旁路禁止：** No external API can set bulletTime directly — only tick(), seek(), and the explicit transition functions.

**Invariants:**
- INV-1: `bulletTime.progressMs >= 0` always
- INV-2: `bulletTime.triggerIndex` references a valid event index with `isPassBall === true`
- INV-3: `bulletTimeSpeedFactor(x)` returns `[MIN_SPEED_FACTOR, 1.0]` for all `x >= 0`
- INV-4: Bullet time has no effect when `adaptivePacing === false`
- INV-5: `bulletTime = null` when engine state is `'idle'` or `'ended'`

**对抗场景 (each = one test):**
1. Pass-ball at last event → bullet time starts but engine ends before hold phase completes → `bulletTime` cleared on end
2. Two consecutive pass-ball events → second resets bullet time (doesn't stack)
3. Seek during bullet time → exits bullet time immediately
4. Toggle adaptivePacing OFF during bullet time → speed factor ignored (returns 1.0)
5. Pause during bullet time hold phase → resume continues from same progressMs

---

## Tasks

### Task 1: Bullet Time Easing Function (pure logic)

**Files:**
- Create: `packages/web/src/lib/story-player/bullet-time.ts`
- Test: `packages/web/src/lib/story-player/__tests__/bullet-time.test.ts`

**Step 1: Write failing tests**

```typescript
// bullet-time.test.ts
import { bulletTimeSpeedFactor, BULLET_TIME_TOTAL_MS, DECEL_MS, HOLD_MS, MIN_SPEED_FACTOR } from '../bullet-time';

describe('bulletTimeSpeedFactor', () => {
  it('returns 1.0 at progressMs=0 (start of deceleration)', () => {
    expect(bulletTimeSpeedFactor(0)).toBeCloseTo(1.0);
  });

  it('returns MIN_SPEED_FACTOR at end of deceleration phase', () => {
    expect(bulletTimeSpeedFactor(DECEL_MS)).toBeCloseTo(MIN_SPEED_FACTOR, 1);
  });

  it('holds at MIN_SPEED_FACTOR during hold phase', () => {
    expect(bulletTimeSpeedFactor(DECEL_MS + HOLD_MS / 2)).toBeCloseTo(MIN_SPEED_FACTOR, 1);
  });

  it('returns 1.0 at end of total duration', () => {
    expect(bulletTimeSpeedFactor(BULLET_TIME_TOTAL_MS)).toBeCloseTo(1.0);
  });

  it('returns 1.0 for values beyond total (overshoot)', () => {
    expect(bulletTimeSpeedFactor(BULLET_TIME_TOTAL_MS + 500)).toBeCloseTo(1.0);
  });

  // INV-3: always in [MIN_SPEED_FACTOR, 1.0]
  it('never returns below MIN_SPEED_FACTOR (boundary sweep)', () => {
    for (let ms = 0; ms <= BULLET_TIME_TOTAL_MS + 100; ms += 10) {
      const f = bulletTimeSpeedFactor(ms);
      expect(f).toBeGreaterThanOrEqual(MIN_SPEED_FACTOR);
      expect(f).toBeLessThanOrEqual(1.0);
    }
  });

  // INV-3: negative input
  it('returns 1.0 for negative progressMs', () => {
    expect(bulletTimeSpeedFactor(-100)).toBe(1.0);
  });
});
```

**Step 2: Run tests — verify RED**

Run: `cd ../cat-cafe-f252-e2 && pnpm vitest run packages/web/src/lib/story-player/__tests__/bullet-time.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement bullet-time.ts**

```typescript
// bullet-time.ts — pure easing function, no side effects

export const DECEL_MS = 400;
export const HOLD_MS = 1000;
export const ACCEL_MS = 600;
export const BULLET_TIME_TOTAL_MS = DECEL_MS + HOLD_MS + ACCEL_MS;
export const MIN_SPEED_FACTOR = 0.01;

/**
 * Compute bullet time speed factor.
 * Uses cosine easing for smooth transitions.
 */
export function bulletTimeSpeedFactor(progressMs: number): number {
  if (progressMs <= 0) return 1.0;
  if (progressMs >= BULLET_TIME_TOTAL_MS) return 1.0;

  const range = 1.0 - MIN_SPEED_FACTOR;

  // Phase 1: Decelerate (ease-out)
  if (progressMs <= DECEL_MS) {
    const t = progressMs / DECEL_MS; // 0→1
    // Cosine ease-out: starts fast, slows down
    return MIN_SPEED_FACTOR + range * (1 - t);
    // Linear for simplicity — cosine: MIN + range * ((1 + Math.cos(Math.PI * t)) / 2)
  }

  // Phase 2: Hold
  if (progressMs <= DECEL_MS + HOLD_MS) {
    return MIN_SPEED_FACTOR;
  }

  // Phase 3: Accelerate (ease-in)
  const accelProgress = progressMs - DECEL_MS - HOLD_MS;
  const t = accelProgress / ACCEL_MS; // 0→1
  return MIN_SPEED_FACTOR + range * t;
}
```

**Step 4: Run tests — verify GREEN**

Run: `pnpm vitest run packages/web/src/lib/story-player/__tests__/bullet-time.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/lib/story-player/bullet-time.ts packages/web/src/lib/story-player/__tests__/bullet-time.test.ts
git commit -m "feat(f252): add bullet time easing function (AC-E4 partial)"
```

---

### Task 2: Engine Bullet Time Integration

**Files:**
- Modify: `packages/web/src/lib/story-player/types.ts` (add BulletTimeState)
- Modify: `packages/web/src/lib/story-player/replay-engine.ts` (tick/seek/play/createReplayEngine)
- Test: `packages/web/src/lib/story-player/__tests__/bullet-time-engine.test.ts`

**Step 1: Write failing tests**

```typescript
// bullet-time-engine.test.ts
describe('replay engine — bullet time integration', () => {
  // INV-5: idle/ended → no bullet time
  it('createReplayEngine starts with bulletTime=null', () => { ... });
  
  // Transition: tick hits pass-ball → enters bullet time
  it('enters bullet time when tick advances to a pass-ball event', () => { ... });
  
  // INV-4: no effect when adaptive off
  it('does not enter bullet time when adaptivePacing=false', () => { ... });
  
  // Transition: seek during bullet time → exits
  it('exits bullet time on seek to different index', () => { ... });
  
  // Transition: progressMs >= TOTAL → exits
  it('exits bullet time after total duration elapses', () => { ... });
  
  // 对抗1: pass-ball at last event → engine ends
  it('clears bullet time when engine reaches ended state', () => { ... });
  
  // 对抗2: consecutive pass-ball → restart
  it('restarts bullet time on second consecutive pass-ball', () => { ... });
  
  // 对抗5: pause during bullet time → preserves
  it('preserves bullet time state across pause/play', () => { ... });
  
  // Speed verification: bullet time reduces effective speed
  it('advances fewer events during bullet time than normal tick', () => { ... });
});
```

**Step 2: Run — verify RED**

**Step 3: Implement**

Add `bulletTime: BulletTimeState | null` to `ReplayEngineState` in types.ts.
Modify `createReplayEngine()`, `tick()`, `seek()`, `play()` in replay-engine.ts.

Key change in `tick()`: Replace the step-function `PASS_BALL_SLOWDOWN_FACTOR` with bullet time easing:

```typescript
// In tick():
// OLD: const isSlowZone = state.adaptivePacing && currentEvent?.isPassBall;
//      const effectiveSpeed = isSlowZone ? Math.max(1, speed / PASS_BALL_SLOWDOWN_FACTOR) : speed;
// NEW:
let bulletTimeNext = state.bulletTime;
if (state.adaptivePacing && currentEvent?.isPassBall && (!bulletTimeNext || bulletTimeNext.triggerIndex !== state.currentIndex)) {
  bulletTimeNext = { triggerIndex: state.currentIndex, progressMs: 0 };
}
let speedFactor = 1.0;
if (bulletTimeNext && state.adaptivePacing) {
  bulletTimeNext = { ...bulletTimeNext, progressMs: bulletTimeNext.progressMs + deltaMs };
  speedFactor = bulletTimeSpeedFactor(bulletTimeNext.progressMs);
  if (bulletTimeNext.progressMs >= BULLET_TIME_TOTAL_MS) bulletTimeNext = null;
}
const effectiveSpeed = state.speed === 'max' ? 'max' : state.speed * speedFactor;
```

**Step 4: Run — verify GREEN + run full story-player suite**

Run: `pnpm vitest run packages/web/src/lib/story-player/`
Expected: All existing + new tests pass

**Step 5: Commit**

```bash
git commit -m "feat(f252): integrate bullet time easing into replay engine (AC-E4)"
```

---

### Task 3: Event Density Computation (pure logic)

**Files:**
- Create: `packages/web/src/lib/story-player/event-density.ts`
- Test: `packages/web/src/lib/story-player/__tests__/event-density.test.ts`

**Step 1: Write failing tests**

```typescript
describe('computeEventDensity', () => {
  it('returns empty array for 0 events', () => {
    expect(computeEventDensity([], 10)).toEqual([]);
  });

  it('returns single bucket with density 1.0 for 1 event', () => {
    const result = computeEventDensity([{ timestamp: 1000 }], 1);
    expect(result).toEqual([{ density: 1.0 }]);
  });

  it('distributes events into correct buckets', () => {
    // 10 events at t=0,1,2,...,9 → 5 buckets → 2 events each → all density 1.0
    const events = Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 1000 }));
    const result = computeEventDensity(events, 5);
    expect(result).toHaveLength(5);
    expect(result.every(b => b.density === 1.0)).toBe(true);
  });

  it('normalizes density relative to densest bucket', () => {
    // Cluster: 8 events in first half, 2 in second half → 2 buckets
    const events = [
      ...Array.from({ length: 8 }, (_, i) => ({ timestamp: i * 100 })),
      ...Array.from({ length: 2 }, (_, i) => ({ timestamp: 5000 + i * 100 })),
    ];
    const result = computeEventDensity(events, 2);
    expect(result[0].density).toBe(1.0);        // densest
    expect(result[1].density).toBeCloseTo(0.25); // 2/8
  });

  it('handles all events at same timestamp', () => {
    const events = Array.from({ length: 5 }, () => ({ timestamp: 1000 }));
    const result = computeEventDensity(events, 3);
    // All in first bucket
    expect(result[0].density).toBe(1.0);
    expect(result[1].density).toBe(0);
    expect(result[2].density).toBe(0);
  });
});
```

**Step 2: Run — verify RED**

**Step 3: Implement event-density.ts**

**Step 4: Run — verify GREEN**

**Step 5: Commit**

---

### Task 4: EventDensityBar Component (visual)

**Files:**
- Create: `packages/web/src/components/story-player/EventDensityBar.tsx`
- Test: integration test via ReplayControls

**Step 1: Write the component**

Pure visual component — renders density buckets as semi-transparent vertical bars.
Each bar's height = `bucket.density * 100%`.
Bars before the playhead use accent color; bars after use muted color.

Keep under 60 lines (small extracted component).

**Step 2: Verify no TS errors from LSP**

**Step 3: Commit**

---

### Task 5: Wire EventDensityBar into ReplayControls

**Files:**
- Modify: `packages/web/src/components/story-player/ReplayControls.tsx`
- Modify: `packages/web/src/lib/story-player/useThreadReplay.ts` (expose density)
- Modify: `packages/web/src/components/story-player/TheaterReplayContent.tsx` (pass density)

**Key constraint:** ReplayControls is at 338 lines. Adding density bar import + prop threading stays within limit because EventDensityBar is extracted. Net change to ReplayControls: ~10 lines (import + render `<EventDensityBar>` inside progress bar div).

**Step 1: Add `density` to ReplayControls props + render EventDensityBar**

```typescript
// ReplayControls — add to props:
density?: DensityBucket[];

// Inside the progress bar div (before Track):
{density && density.length > 0 && <EventDensityBar buckets={density} progress={progress} />}
```

**Step 2: Compute density in useThreadReplay**

```typescript
// useThreadReplay.ts — add:
const density = useMemo(
  () => computeEventDensity(engine._events ?? [], 80),
  [engine]  // recompute when events change
);
```

Actually — `engine._events` is internal. Better: compute density from visibleEvents' source events. Add a `totalEvents` array exposure from useReplayEngine, or compute from `engine.totalEvents` + timestamps.

Alternative: Pass the events array from useReplayEngine as `allEvents` for density computation. This avoids exposing engine internals.

**Step 3: Pass through TheaterReplayContent**

**Step 4: Run pnpm check — verify no type errors**

**Step 5: Commit**

---

### Task 6: Session Page Sunset (AC-E1 completion)

**Files:**
- Modify: `packages/web/src/app/story/[storyId]/page.tsx`

**Change:** Replace `SessionReplayView` component with a deprecation notice that directs users to the Hub Theater overlay.

```typescript
function SessionReplayView({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--console-shell-bg,#111)]">
      <div className="text-center max-w-md px-6">
        <h2 className="text-lg font-medium text-[var(--console-text-primary,#fff)] mb-3">
          🎬 Story Player has moved!
        </h2>
        <p className="text-sm text-[var(--console-text-secondary,#aaa)] mb-4">
          Session replay is now available as <strong>回放剧场 (Meow Theater)</strong> — 
          right-click any thread in the Hub sidebar to open it.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-[var(--color-accent,#6366f1)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          Go to Hub
        </a>
      </div>
    </div>
  );
}
```

Keep `feat:` route unchanged (FeatureStoryView still valid for Phase C birdseye).

Remove unused imports (useReplayEngine, ReplayEventBubble, ReplayControls, annotations state etc.) from session path — significant cleanup.

**Step 1: Modify page.tsx — replace SessionReplayView**
**Step 2: Verify feat: route still works (FeatureStoryView renders)**
**Step 3: Run pnpm check — verify no dead import errors**
**Step 4: Commit**

---

### Task 7: Full Test Suite + Quality Gate

**Step 1: Run full story-player tests**
Run: `pnpm vitest run packages/web/src/lib/story-player/`
Expected: All pass (existing 171 + new bullet-time + density tests)

**Step 2: Run pnpm check**
Run: `pnpm check`
Expected: Clean

**Step 3: Run pnpm gate (if on latest main rebase)**

**Step 4: Final commit if any cleanup needed**

---

## Test Matrix (maps to Stateful Object Gate invariants)

| Test | Invariant | File |
|------|-----------|------|
| bulletTimeSpeedFactor boundary sweep | INV-3 | bullet-time.test.ts |
| bulletTimeSpeedFactor negative input | INV-3 | bullet-time.test.ts |
| createReplayEngine → bulletTime=null | INV-5 | bullet-time-engine.test.ts |
| tick → enters bullet time on pass-ball | Transition | bullet-time-engine.test.ts |
| tick → no bullet time when adaptive=false | INV-4 | bullet-time-engine.test.ts |
| seek → exits bullet time | Transition | bullet-time-engine.test.ts |
| tick → exits bullet time after total ms | Transition | bullet-time-engine.test.ts |
| pass-ball at last event → ended clears BT | 对抗1 | bullet-time-engine.test.ts |
| consecutive pass-ball → restart | 对抗2 | bullet-time-engine.test.ts |
| pause/play → preserves BT | 对抗5 | bullet-time-engine.test.ts |
| density empty events | — | event-density.test.ts |
| density uniform distribution | — | event-density.test.ts |
| density normalization | — | event-density.test.ts |
| density same-timestamp cluster | — | event-density.test.ts |

## Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Should EventDensityBar use canvas for smoother rendering, or CSS divs are sufficient? | **Decision: CSS divs** — 80 buckets × 1 div each is lightweight. Canvas adds complexity without benefit at this scale. |
| OQ-2 | How to expose event timestamps from useReplayEngine without leaking internal _events? | **Decision: add `allTimestamps: number[]` to engine return** — computed once via useMemo, lightweight array of timestamps only |
