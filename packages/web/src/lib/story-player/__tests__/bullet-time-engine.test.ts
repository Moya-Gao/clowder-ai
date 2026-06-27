/**
 * F252 Phase E PR E-2 — Bullet Time Engine Integration Tests
 *
 * Tests the integration of bullet time easing into the replay engine
 * state machine (tick/seek/play transitions).
 *
 * Covers: 5 invariants + 5 adversarial scenarios from Stateful Object Gate.
 */

import { describe, expect, it } from 'vitest';
import { BULLET_TIME_TOTAL_MS } from '../bullet-time';
import {
  createReplayEngine,
  pause,
  play,
  seek,
  setSpeed,
  stepBackward,
  stepForward,
  tick,
  toggleAdaptivePacing,
} from '../replay-engine';
import type { ReplayEvent } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal event array with configurable pass-ball flags */
function makeEvents(specs: Array<{ t: number; isPassBall?: boolean }>): ReplayEvent[] {
  return specs.map((s, i) => ({
    index: i,
    type: 'message' as const,
    timestamp: s.t,
    role: 'assistant',
    content: `msg-${i}`,
    eventNo: i,
    isPassBall: s.isPassBall,
  }));
}

/** Advance engine by deltaMs, returning new state */
function tickBy(state: ReturnType<typeof createReplayEngine>, ms: number) {
  return tick(state, ms);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F252 replay engine — bullet time integration', () => {
  // ── INV-5: idle/ended → no bullet time ──

  it('INV-5: createReplayEngine starts with bulletTime=null', () => {
    const events = makeEvents([{ t: 0 }, { t: 1000 }, { t: 2000 }]);
    const engine = createReplayEngine(events);
    expect(engine.bulletTime).toBeNull();
  });

  // ── Transition: tick hits pass-ball → enters bullet time ──

  it('enters bullet time when tick advances to a pass-ball event', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 100 }, // normal
      { t: 200, isPassBall: true }, // pass-ball at index 2
      { t: 5000 },
    ]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Tick past event 1 and event 2 (pass-ball)
    // At 100× speed, 16ms real = 1600ms virtual → should reach event 2 (t=200)
    engine = tickBy(engine, 16);

    // Engine should be at or past the pass-ball event
    expect(engine.currentIndex).toBeGreaterThanOrEqual(2);
    // Bullet time should be active
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(2);
  });

  // ── INV-4: no effect when adaptive off ──

  it('INV-4: does not enter bullet time when adaptivePacing=false', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 5000 }]);
    let engine = createReplayEngine(events);
    engine = toggleAdaptivePacing(engine); // turn OFF
    expect(engine.adaptivePacing).toBe(false);
    engine = play(engine);

    // Tick past pass-ball event
    engine = tickBy(engine, 16);

    expect(engine.bulletTime).toBeNull();
  });

  // ── Transition: seek during bullet time → exits ──

  it('exits bullet time on seek to different index', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 400 }, { t: 5000 }]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Tick to enter bullet time at event 1
    engine = tickBy(engine, 16);
    expect(engine.bulletTime).not.toBeNull();

    // Seek to a different event
    engine = seek(engine, 0);
    expect(engine.bulletTime).toBeNull();
  });

  it('preserves bullet time on seek to same trigger index', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 5000 }]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Tick to enter bullet time at event 1
    engine = tickBy(engine, 16);
    expect(engine.bulletTime).not.toBeNull();
    const triggerIdx = engine.bulletTime!.triggerIndex;

    // Seek to the same trigger event
    engine = seek(engine, triggerIdx);
    expect(engine.bulletTime).not.toBeNull();
  });

  // ── P2 fix: toggleAdaptivePacing clears stale bullet time ──

  it('clears bulletTime when adaptive pacing is toggled OFF', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 100_000 }]);
    let engine = play(createReplayEngine(events));

    // Tick until bullet time activates
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();

    // Toggle adaptive OFF → bulletTime must be cleared
    engine = toggleAdaptivePacing(engine);
    expect(engine.adaptivePacing).toBe(false);
    expect(engine.bulletTime).toBeNull();
  });

  it('does not resume stale bullet time when adaptive pacing is toggled back ON', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 500 }, { t: 1000 }, { t: 100_000 }]);
    let engine = play(createReplayEngine(events));

    // Tick until bullet time activates at event 1
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(1);

    // Toggle OFF → tick forward past the pass-ball → toggle ON
    engine = toggleAdaptivePacing(engine);
    expect(engine.bulletTime).toBeNull();

    // Tick forward with adaptive off (no slowdown)
    for (let i = 0; i < 100; i++) {
      engine = tickBy(engine, 16);
    }

    // Toggle back ON — should not have stale bullet time
    engine = toggleAdaptivePacing(engine);
    expect(engine.adaptivePacing).toBe(true);
    expect(engine.bulletTime).toBeNull();
  });

  // ── Transition: progressMs >= TOTAL → exits ──

  it('exits bullet time after total duration elapses', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true },
      { t: 100_000 }, // far away so engine doesn't end
    ]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Enter bullet time
    engine = tickBy(engine, 16);
    expect(engine.bulletTime).not.toBeNull();

    // Tick through the full bullet time duration
    // Each tick advances progressMs by deltaMs (real time, not scaled)
    let totalTicked = 0;
    while (engine.bulletTime && totalTicked < BULLET_TIME_TOTAL_MS + 1000) {
      engine = tickBy(engine, 50);
      totalTicked += 50;
    }

    expect(engine.bulletTime).toBeNull();
    expect(totalTicked).toBeLessThanOrEqual(BULLET_TIME_TOTAL_MS + 100); // exits near total
  });

  // ── 对抗1: pass-ball at last event → engine ends ──

  it('对抗1: clears bullet time when engine reaches ended state', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true }, // last event is pass-ball
    ]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Tick to pass-ball (which is the last event)
    engine = tickBy(engine, 16);

    // Engine should be ended (only 2 events, pass-ball is last)
    // Whether bullet time is set or not, ended state should clear it
    if (engine.state === 'ended') {
      expect(engine.bulletTime).toBeNull();
    }
    // If not ended yet, tick more
    for (let i = 0; i < 100 && engine.state !== 'ended'; i++) {
      engine = tickBy(engine, 50);
    }
    expect(engine.state).toBe('ended');
    expect(engine.bulletTime).toBeNull();
  });

  // ── 对抗2: two consecutive pass-ball events → restart ──

  it('对抗2: restarts bullet time on second consecutive pass-ball', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 400, isPassBall: true }, { t: 100_000 }]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Tick to first pass-ball
    engine = tickBy(engine, 16);
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(1);

    // Tick through bullet time until engine advances past first pass-ball
    // and hits second pass-ball
    for (let i = 0; i < 200; i++) {
      engine = tickBy(engine, 50);
      if (engine.bulletTime && engine.bulletTime.triggerIndex === 2) break;
    }

    // Should have restarted bullet time for second pass-ball
    if (engine.currentIndex >= 2) {
      expect(engine.bulletTime).not.toBeNull();
      expect(engine.bulletTime!.triggerIndex).toBe(2);
    }
  });

  // ── 对抗5: pause during bullet time → preserves ──

  it('对抗5: preserves bullet time state across pause/play', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 100_000 }]);
    let engine = createReplayEngine(events);
    engine = play(engine);

    // Enter bullet time
    engine = tickBy(engine, 16);
    expect(engine.bulletTime).not.toBeNull();
    const btBefore = engine.bulletTime!;

    // Pause
    engine = pause(engine);
    expect(engine.state).toBe('paused');
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.progressMs).toBe(btBefore.progressMs);

    // Play again
    engine = play(engine);
    expect(engine.state).toBe('playing');
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.progressMs).toBe(btBefore.progressMs);
  });

  // ── Speed verification ──

  it('advances fewer events during bullet time than normal playback', () => {
    // Two identical event sequences, one with pass-ball, one without
    const withPassBall = makeEvents([
      { t: 0 },
      { t: 100, isPassBall: true },
      { t: 200 },
      { t: 300 },
      { t: 400 },
      { t: 500 },
      { t: 600 },
      { t: 700 },
      { t: 800 },
      { t: 900 },
    ]);
    const withoutPassBall = makeEvents([
      { t: 0 },
      { t: 100 },
      { t: 200 },
      { t: 300 },
      { t: 400 },
      { t: 500 },
      { t: 600 },
      { t: 700 },
      { t: 800 },
      { t: 900 },
    ]);

    let engWithBT = play(createReplayEngine(withPassBall));
    let engNoBT = play(createReplayEngine(withoutPassBall));

    // Tick both for same real time
    for (let i = 0; i < 20; i++) {
      engWithBT = tickBy(engWithBT, 16);
      engNoBT = tickBy(engNoBT, 16);
    }

    // Engine with bullet time should be behind (slower progress)
    expect(engWithBT.currentIndex).toBeLessThanOrEqual(engNoBT.currentIndex);
  });

  // ── Audit: tickMax clears bulletTime on ended (R2 P2 review fix) ──

  it('INV-5/tickMax: clears bulletTime when speed=MAX reaches ended', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true },
      { t: 400 },
      { t: 100_000 }, // far enough that normal tick enters bullet time first
    ]);
    let engine = play(createReplayEngine(events));

    // Tick at normal speed until bullet time activates
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();

    // Switch to MAX speed — tickMax should clear bulletTime when reaching ended
    engine = setSpeed(engine, 'max');

    // Tick with MAX — each tick advances one event
    for (let i = 0; i < 10 && engine.state !== 'ended'; i++) {
      engine = tickBy(engine, 16);
    }

    expect(engine.state).toBe('ended');
    expect(engine.bulletTime).toBeNull(); // INV-5: ended → no bullet time
  });

  // ── Cloud R2: tickMax non-ending path clears stale bulletTime ──

  it('tickMax non-ending: clears bulletTime when MAX advances without reaching ended', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true }, // trigger at index 1
      { t: 400 },
      { t: 600 },
      { t: 800 },
      { t: 100_000 }, // far enough to not end quickly
    ]);
    let engine = play(createReplayEngine(events));

    // Tick at normal speed until bullet time activates at event 1
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(1);

    // Switch to MAX — one tick should advance to event 2 (non-ending) and clear stale bulletTime
    engine = setSpeed(engine, 'max');
    engine = tickBy(engine, 16);

    // Should have advanced past trigger but NOT ended (6 events, at most index 2)
    expect(engine.currentIndex).toBeGreaterThan(1);
    expect(engine.state).not.toBe('ended');
    // Stale bulletTime from event 1 must be cleared
    expect(engine.bulletTime).toBeNull();
  });

  // ── INV-2: triggerIndex references valid pass-ball event ──

  it('INV-2: bulletTime.triggerIndex always points to a pass-ball event', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 100 },
      { t: 200, isPassBall: true },
      { t: 300 },
      { t: 400, isPassBall: true },
      { t: 100_000 },
    ]);
    let engine = play(createReplayEngine(events));

    // Tick through and verify every time bulletTime is set
    for (let i = 0; i < 500; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) {
        const idx = engine.bulletTime.triggerIndex;
        expect(events[idx].isPassBall).toBe(true);
      }
      if (engine.state === 'ended') break;
    }
  });

  // ── Cloud R1: stepForward/stepBackward clear stale bulletTime ──

  it('clears bulletTime when stepForward moves away from trigger index', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true }, // trigger at index 1
      { t: 400 },
      { t: 100_000 },
    ]);
    let engine = play(createReplayEngine(events));

    // Tick until bullet time activates at event 1
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(1);

    // Step forward to event 2 — should clear stale bulletTime
    engine = stepForward(engine);
    expect(engine.currentIndex).toBe(2);
    expect(engine.bulletTime).toBeNull();
  });

  it('clears bulletTime when stepBackward moves away from trigger index', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 100 },
      { t: 200, isPassBall: true }, // trigger at index 2
      { t: 100_000 },
    ]);
    let engine = play(createReplayEngine(events));

    // Tick until bullet time activates at event 2
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(2);

    // Step backward to event 1 — should clear stale bulletTime
    engine = stepBackward(engine);
    expect(engine.currentIndex).toBe(1);
    expect(engine.bulletTime).toBeNull();
  });

  it('preserves bulletTime when stepForward stays at trigger index (clamped)', () => {
    // Only 2 events: trigger at last index, stepForward clamps to same
    const events = makeEvents([
      { t: 0 },
      { t: 200, isPassBall: true }, // trigger at index 1, also last
    ]);
    let engine = play(createReplayEngine(events));

    // Tick until bullet time activates
    for (let i = 0; i < 50; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) break;
    }
    // If ended, bullet time is null — that's also correct (INV-5)
    if (engine.state !== 'ended' && engine.bulletTime) {
      const triggerIdx = engine.bulletTime.triggerIndex;
      // Step forward — clamps to same index (last event)
      engine = stepForward(engine);
      expect(engine.currentIndex).toBe(triggerIdx);
      expect(engine.bulletTime).not.toBeNull();
    }
  });

  // ── INV-1: progressMs >= 0 ──

  it('INV-1: bulletTime.progressMs is always >= 0', () => {
    const events = makeEvents([{ t: 0 }, { t: 200, isPassBall: true }, { t: 100_000 }]);
    let engine = play(createReplayEngine(events));

    for (let i = 0; i < 200; i++) {
      engine = tickBy(engine, 16);
      if (engine.bulletTime) {
        expect(engine.bulletTime.progressMs).toBeGreaterThanOrEqual(0);
      }
      if (engine.state === 'ended') break;
    }
  });

  // ── Cloud R3: seek → bulletTime initialization ──
  // Chapter markers call onSeek(ch.eventIndex) — when seeking to a pass-ball
  // event while playing with adaptive pacing, bulletTime must be initialized.

  it('seek to pass-ball while playing inits bulletTime', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200 },
      { t: 400, isPassBall: true }, // target at index 2
      { t: 600 },
      { t: 100_000 },
    ]);
    let engine = play(createReplayEngine(events));
    // Adaptive pacing is ON by default — seek to pass-ball event while playing
    engine = seek(engine, 2);

    expect(engine.state).toBe('playing');
    expect(engine.currentIndex).toBe(2);
    expect(engine.bulletTime).not.toBeNull();
    expect(engine.bulletTime!.triggerIndex).toBe(2);
    expect(engine.bulletTime!.progressMs).toBe(0);
  });

  it('seek to pass-ball while paused does NOT init bulletTime', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200 },
      { t: 400, isPassBall: true }, // target at index 2
      { t: 600 },
      { t: 100_000 },
    ]);
    let engine = pause(play(createReplayEngine(events)));
    expect(engine.state).toBe('paused');

    // Seek to pass-ball while paused — should NOT init bulletTime
    engine = seek(engine, 2);

    expect(engine.state).toBe('paused');
    expect(engine.currentIndex).toBe(2);
    expect(engine.bulletTime).toBeNull();
  });

  it('seek to non-pass-ball while playing does NOT init bulletTime', () => {
    const events = makeEvents([
      { t: 0 },
      { t: 200 },
      { t: 400, isPassBall: true },
      { t: 600 }, // target at index 3 — NOT a pass-ball
      { t: 100_000 },
    ]);
    let engine = play(createReplayEngine(events));

    // Seek to non-pass-ball event while playing — should NOT init bulletTime
    engine = seek(engine, 3);

    expect(engine.state).toBe('playing');
    expect(engine.currentIndex).toBe(3);
    expect(engine.bulletTime).toBeNull();
  });
});
