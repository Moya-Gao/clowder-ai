/**
 * F252 Phase B — Engine Integration with Adaptive Pacing (AC-B1)
 *
 * Tests for pass-ball slowdown during tick + adaptive pacing toggle.
 * The replay engine's tick() should reduce effective speed at pass-ball events
 * when adaptive pacing is enabled.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIP_DISPLAY_MS } from '../adaptive-pacing';
import {
  createReplayEngine,
  PASS_BALL_SLOWDOWN_FACTOR,
  play,
  seek,
  setSpeed,
  tick,
  toggleAdaptivePacing,
} from '../replay-engine';
import type { ReplayEvent } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ReplayEvent> & { timestamp: number }): ReplayEvent {
  return {
    index: 0,
    type: 'message',
    role: 'assistant',
    content: '',
    eventNo: 0,
    ...overrides,
  };
}

/**
 * Create events for engine tests with explicit pass-ball annotation.
 * Events are evenly spaced at 10s intervals.
 */
function makeEngineEvents(count: number, passBallIndices: number[] = []): ReplayEvent[] {
  const passBallSet = new Set(passBallIndices);
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      index: i,
      timestamp: i * 10_000, // 10s apart
      eventNo: i,
      isPassBall: passBallSet.has(i) || undefined,
    }),
  );
}

// ==========================================================================
// § 1  Engine creation with adaptive pacing
// ==========================================================================

describe('F252 engine — adaptive pacing mode', () => {
  it('creates engine with adaptivePacing enabled by default', () => {
    const events = makeEngineEvents(5);
    const engine = createReplayEngine(events);
    expect(engine.adaptivePacing).toBe(true);
  });

  it('toggleAdaptivePacing switches mode', () => {
    const events = makeEngineEvents(5);
    const engine = createReplayEngine(events);
    expect(engine.adaptivePacing).toBe(true);

    const toggled = toggleAdaptivePacing(engine);
    expect(toggled.adaptivePacing).toBe(false);

    const toggledBack = toggleAdaptivePacing(toggled);
    expect(toggledBack.adaptivePacing).toBe(true);
  });

  it('PASS_BALL_SLOWDOWN_FACTOR is exported and > 1', () => {
    expect(PASS_BALL_SLOWDOWN_FACTOR).toBeGreaterThan(1);
  });
});

// ==========================================================================
// § 2  Pass-ball slowdown during tick
// ==========================================================================

describe('F252 engine — pass-ball slowdown in tick', () => {
  it('advances slower at pass-ball events when adaptive pacing is on', () => {
    // Events: 0s, 10s, 20s. Event[1] is pass-ball.
    // At 100x speed, 100ms real delta = 10_000ms playback delta (normal)
    // At pass-ball with factor 5: effective speed = 20x, so delta = 2_000ms
    const events = makeEngineEvents(3, [1]);
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    // Tick 1: start at event 0, advance 100ms real time
    // Normal: elapsed += 100 * 100 = 10_000 → reaches event 1 at t=10_000
    const after1 = tick(engine, 100);
    expect(after1.currentIndex).toBe(1); // reached pass-ball event

    // Tick 2: now at event 1 (pass-ball), adaptive on → slowdown
    // With factor 5: effective speed = 20, delta = 100ms * 20 = 2_000ms
    // Event 2 is at t=20_000, elapsed was 10_000, now 10_000 + 2_000 = 12_000 < 20_000
    const after2 = tick(after1, 100);
    expect(after2.currentIndex).toBe(1); // still at event 1 (hasn't reached event 2)
    // Verify elapsed advanced by effective delta, not full delta
    expect(after2.elapsedMs).toBe(after1.elapsedMs + 100 * (100 / PASS_BALL_SLOWDOWN_FACTOR));
  });

  it('does NOT slow down when adaptive pacing is off', () => {
    const events = makeEngineEvents(3, [1]);
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);
    engine = toggleAdaptivePacing(engine); // turn off adaptive

    // Tick to reach event 1
    const after1 = tick(engine, 100);
    expect(after1.currentIndex).toBe(1);

    // Tick again — no slowdown, full speed
    const after2 = tick(after1, 100);
    // elapsed = 10_000 + 100*100 = 20_000 → reaches event 2 at t=20_000
    expect(after2.currentIndex).toBe(2);
  });

  it('does NOT slow down at non-pass-ball events', () => {
    const events = makeEngineEvents(3); // no pass-ball events
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    const after1 = tick(engine, 100);
    expect(after1.currentIndex).toBe(1);

    // Full speed at event 1 (not pass-ball)
    const after2 = tick(after1, 100);
    expect(after2.currentIndex).toBe(2);
  });

  it('clamps effective speed to minimum 1x at pass-ball events', () => {
    // At 1x speed with factor 5: effective = max(1, 1/5) = 1
    const events = makeEngineEvents(3, [1]);
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 1);

    // Tick past event 0 to reach event 1
    // At 1x: 100ms real = 100ms playback. Need 10_000ms to reach event 1.
    let state = engine;
    for (let i = 0; i < 100; i++) state = tick(state, 100); // 10s real time
    expect(state.currentIndex).toBe(1);

    // Now at pass-ball event. Effective speed = max(1, 1/5) = 1 (not 0.2)
    const before = state.elapsedMs;
    const after = tick(state, 100);
    expect(after.elapsedMs).toBe(before + 100 * 1); // speed stays at 1, not 0.2
  });

  it('stops at pass-ball marker instead of skipping past it at high speed', () => {
    // Events: 0ms, 1000ms (pass-ball), 1100ms — densely spaced after compression
    // At 100x speed, 16ms tick → 1600ms advance → would skip past both events
    const events = [
      makeEvent({ index: 0, timestamp: 0, eventNo: 0 }),
      makeEvent({ index: 1, timestamp: 1000, eventNo: 1, isPassBall: true }),
      makeEvent({ index: 2, timestamp: 1100, eventNo: 2 }),
    ];
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    // Single tick of 16ms at 100x = 1600ms → would normally reach event[2] at t=1100
    // But should STOP at event[1] (pass-ball marker) so slowdown can fire
    const after = tick(engine, 16);
    expect(after.currentIndex).toBe(1); // stopped at pass-ball, not jumped to 2
  });

  it('stops at idle-gap marker instead of skipping past it at high speed', () => {
    // After adaptive compression, idle gap becomes 500ms (DEFAULT_SKIP_DISPLAY_MS)
    // Events: 0ms, 500ms (idle marker), 600ms
    const events = [
      makeEvent({ index: 0, timestamp: 0, eventNo: 0 }),
      makeEvent({ index: 1, timestamp: 500, eventNo: 1, idleSkipMs: 600_000 }),
      makeEvent({ index: 2, timestamp: 600, eventNo: 2 }),
    ];
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    // 16ms tick at 100x = 1600ms → would reach event[2]. But should stop at idle marker
    const after = tick(engine, 16);
    expect(after.currentIndex).toBe(1); // stopped at idle marker for banner display
  });

  it('does NOT stop at markers when adaptive pacing is OFF', () => {
    const events = [
      makeEvent({ index: 0, timestamp: 0, eventNo: 0 }),
      makeEvent({ index: 1, timestamp: 1000, eventNo: 1, isPassBall: true }),
      makeEvent({ index: 2, timestamp: 1100, eventNo: 2 }),
    ];
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);
    engine = toggleAdaptivePacing(engine); // OFF

    // With adaptive OFF, no marker stopping — normal advancement
    const after = tick(engine, 16);
    expect(after.currentIndex).toBe(2); // jumps past both
  });

  it('does NOT apply slowdown in MAX mode', () => {
    // MAX mode should be unaffected by pass-ball — it always advances one event per tick
    const events = makeEngineEvents(5, [1, 2, 3]);
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 'max');

    // Each tick should advance exactly one event regardless of pass-ball
    const after1 = tick(engine, 16);
    expect(after1.currentIndex).toBe(1); // pass-ball event, but MAX → advance

    const after2 = tick(after1, 16);
    expect(after2.currentIndex).toBe(2); // pass-ball event, but MAX → advance

    const after3 = tick(after2, 16);
    expect(after3.currentIndex).toBe(3); // pass-ball event, but MAX → advance
  });
});

// ==========================================================================
// § 3  Existing tests still pass (no regression)
// ==========================================================================

describe('F252 engine — adaptive pacing does not break existing behavior', () => {
  it('creates engine with correct initial state including adaptivePacing', () => {
    const events = makeEngineEvents(5);
    const engine = createReplayEngine(events);

    expect(engine.state).toBe('idle');
    expect(engine.speed).toBe(100);
    expect(engine.currentIndex).toBe(0);
    expect(engine.totalEvents).toBe(5);
    expect(engine.displayMode).toBe('cinematic');
    expect(engine.adaptivePacing).toBe(true);
  });

  it('tick works normally without pass-ball events when adaptive is on', () => {
    const events = makeEngineEvents(3);
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    // Normal advancement: 100ms * 100x = 10_000ms → event 1
    const after = tick(engine, 100);
    expect(after.currentIndex).toBe(1);
    expect(after.elapsedMs).toBe(10_000);
  });
});

// ==========================================================================
// § 4  Idle gap dynamic handling (P1-1 fix)
// ==========================================================================

describe('F252 engine — idle gap dynamic handling', () => {
  it('totalDurationMs uses effective duration when adaptive is ON', () => {
    const events = [
      makeEvent({ timestamp: 0 }),
      makeEvent({ timestamp: 30_000 }),
      makeEvent({ timestamp: 630_001, idleSkipMs: 600_001 }),
    ];
    const engine = createReplayEngine(events);
    // adaptive ON: effective = 30000 + DEFAULT_SKIP_DISPLAY_MS
    expect(engine.totalDurationMs).toBe(30_000 + DEFAULT_SKIP_DISPLAY_MS);
  });

  it('toggleAdaptivePacing recomputes totalDurationMs to raw when OFF', () => {
    const events = [makeEvent({ timestamp: 0 }), makeEvent({ timestamp: 630_001, idleSkipMs: 630_001 })];
    let engine = createReplayEngine(events);
    expect(engine.totalDurationMs).toBe(DEFAULT_SKIP_DISPLAY_MS);

    engine = toggleAdaptivePacing(engine);
    expect(engine.totalDurationMs).toBe(630_001);
  });

  it('when adaptive ON, tick warps past idle gaps using display beat', () => {
    const events = [makeEvent({ timestamp: 0 }), makeEvent({ timestamp: 600_001, idleSkipMs: 600_001 })];
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);

    // Effective gap = 500ms. At 100x, 10ms wall = 1000ms effective > 500ms → advance
    engine = tick(engine, 10);
    expect(engine.currentIndex).toBe(1);
  });

  it('when adaptive OFF, tick traverses idle gaps at full duration', () => {
    const events = [makeEvent({ timestamp: 0 }), makeEvent({ timestamp: 600_001, idleSkipMs: 600_001 })];
    let engine = createReplayEngine(events);
    engine = play(engine);
    engine = setSpeed(engine, 100);
    engine = toggleAdaptivePacing(engine); // OFF

    // Raw gap = 600001ms. At 100x, 10ms wall = 1000ms. Not enough.
    engine = tick(engine, 10);
    expect(engine.currentIndex).toBe(0);
  });

  it('seek computes elapsedMs using effective offset when adaptive ON', () => {
    const events = [
      makeEvent({ timestamp: 0 }),
      makeEvent({ timestamp: 30_000 }),
      makeEvent({ timestamp: 630_000, idleSkipMs: 600_000 }),
    ];
    let engine = createReplayEngine(events);
    engine = seek(engine, 2);

    // Effective offset at index 2: 30000 + 500 = 30500
    expect(engine.elapsedMs).toBe(30_000 + DEFAULT_SKIP_DISPLAY_MS);
  });

  it('toggle preserves position while changing elapsed/total', () => {
    const events = [
      makeEvent({ timestamp: 0 }),
      makeEvent({ timestamp: 30_000 }),
      makeEvent({ timestamp: 630_000, idleSkipMs: 600_000 }),
      makeEvent({ timestamp: 660_000 }),
    ];
    let engine = createReplayEngine(events);
    engine = seek(engine, 1); // move to event 1

    engine = toggleAdaptivePacing(engine); // OFF
    expect(engine.currentIndex).toBe(1);
    expect(engine.elapsedMs).toBe(30_000); // raw offset at index 1
    expect(engine.totalDurationMs).toBe(660_000); // raw total
  });
});
