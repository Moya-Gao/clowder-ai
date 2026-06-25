/**
 * F252 Story Player — Replay Engine
 *
 * Pure, immutable state machine for replay control.
 * No timers, no RAF — timing is driven externally (by useReplayEngine hook).
 * Every function takes current state and returns next state.
 *
 * State machine: idle → playing ⇄ paused → ended → (play resets to beginning)
 */

import type { ReplayEngineState, ReplayEvent, SpeedMultiplier } from './types';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createReplayEngine(events: ReplayEvent[]): ReplayEngineState {
  const first = events[0];
  const last = events[events.length - 1];
  const totalDurationMs = first && last ? last.timestamp - first.timestamp : 0;

  return {
    state: 'idle',
    speed: 100,
    currentIndex: 0,
    totalEvents: events.length,
    elapsedMs: 0,
    totalDurationMs,
    displayMode: 'cinematic',
    // Internal: store events reference for tick calculations
    _events: events,
  } as ReplayEngineState & { _events: ReplayEvent[] };
}

// Internal accessor for events attached to state
function getEvents(state: ReplayEngineState): ReplayEvent[] {
  return (state as ReplayEngineState & { _events: ReplayEvent[] })._events;
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export function play(state: ReplayEngineState): ReplayEngineState {
  // From ended → reset to beginning
  if (state.state === 'ended') {
    return { ...state, state: 'playing', currentIndex: 0, elapsedMs: 0 };
  }
  return { ...state, state: 'playing' };
}

export function pause(state: ReplayEngineState): ReplayEngineState {
  if (state.state !== 'playing') return state;
  return { ...state, state: 'paused' };
}

// ---------------------------------------------------------------------------
// Speed control
// ---------------------------------------------------------------------------

export function setSpeed(state: ReplayEngineState, speed: SpeedMultiplier): ReplayEngineState {
  return { ...state, speed };
}

// ---------------------------------------------------------------------------
// Display mode
// ---------------------------------------------------------------------------

export function setDisplayMode(state: ReplayEngineState, mode: 'cinematic' | 'faithful'): ReplayEngineState {
  return { ...state, displayMode: mode };
}

// ---------------------------------------------------------------------------
// Tick (time advancement) — called by external timer (RAF / setInterval)
// ---------------------------------------------------------------------------

/** MAX speed: advance exactly one event per tick (instant forwarding, shows each event briefly). */
function tickMax(state: ReplayEngineState, events: ReplayEvent[]): ReplayEngineState {
  const nextIndex = state.currentIndex + 1;
  const baseTimestamp = events[0]?.timestamp ?? 0;
  if (nextIndex >= events.length - 1) {
    const lastOffset = (events[events.length - 1]?.timestamp ?? 0) - baseTimestamp;
    return { ...state, currentIndex: events.length - 1, elapsedMs: lastOffset, state: 'ended' };
  }
  const nextTimestamp = events[nextIndex]?.timestamp ?? 0;
  return { ...state, currentIndex: nextIndex, elapsedMs: nextTimestamp - baseTimestamp };
}

/**
 * Advance the engine by `deltaMs` of real-world time.
 * Calculates how many events should be visible at the current speed.
 */
export function tick(state: ReplayEngineState, deltaMs: number): ReplayEngineState {
  if (state.state !== 'playing') return state;

  const events = getEvents(state);
  if (events.length === 0) return { ...state, state: 'ended' };

  if (state.speed === 'max') return tickMax(state, events);

  // elapsedMs is always in "original timeline" space (ms offset from first event).
  // Real wall-clock delta is scaled by speed to advance the original-time playhead.
  const newElapsed = state.elapsedMs + deltaMs * state.speed;

  const baseTimestamp = events[0]?.timestamp ?? 0;

  // Find the last event whose offset from base is <= newElapsed (already in original time)
  let newIndex = state.currentIndex;
  for (let i = state.currentIndex + 1; i < events.length; i++) {
    const offset = (events[i]?.timestamp ?? 0) - baseTimestamp;
    if (offset <= newElapsed) {
      newIndex = i;
    } else {
      break;
    }
  }

  // Check if we've passed the last event
  const lastOffset = (events[events.length - 1]?.timestamp ?? 0) - baseTimestamp;
  if (newElapsed >= lastOffset) {
    return {
      ...state,
      currentIndex: events.length - 1,
      elapsedMs: lastOffset, // clamp to total duration — don't overshoot
      state: 'ended',
    };
  }

  return {
    ...state,
    currentIndex: newIndex,
    elapsedMs: newElapsed,
  };
}

// ---------------------------------------------------------------------------
// Seek
// ---------------------------------------------------------------------------

export function seek(state: ReplayEngineState, targetIndex: number): ReplayEngineState {
  const events = getEvents(state);
  if (events.length === 0) return state;

  // Clamp to valid range
  const clamped = Math.max(0, Math.min(targetIndex, events.length - 1));

  // Calculate elapsed original time for the target position
  const baseTimestamp = events[0]?.timestamp ?? 0;
  const targetTimestamp = events[clamped]?.timestamp ?? 0;
  const elapsedOriginal = targetTimestamp - baseTimestamp;

  // When seeking from 'ended' to a non-final event, transition to 'paused'
  // so that play() resumes from the seek position instead of resetting to 0
  const newState = state.state === 'ended' && clamped < events.length - 1 ? 'paused' : state.state;

  return {
    ...state,
    state: newState,
    currentIndex: clamped,
    elapsedMs: elapsedOriginal, // elapsed in original time scale (for seek display)
  };
}

// ---------------------------------------------------------------------------
// Stepping
// ---------------------------------------------------------------------------

export function stepForward(state: ReplayEngineState): ReplayEngineState {
  const events = getEvents(state);
  if (events.length === 0) return state;

  const nextIndex = Math.min(state.currentIndex + 1, events.length - 1);
  const baseTimestamp = events[0]?.timestamp ?? 0;
  const targetTimestamp = events[nextIndex]?.timestamp ?? 0;

  return {
    ...state,
    state: state.state === 'playing' ? 'paused' : state.state,
    currentIndex: nextIndex,
    elapsedMs: targetTimestamp - baseTimestamp,
  };
}

export function stepBackward(state: ReplayEngineState): ReplayEngineState {
  const events = getEvents(state);
  if (events.length === 0) return state;

  const prevIndex = Math.max(state.currentIndex - 1, 0);
  const baseTimestamp = events[0]?.timestamp ?? 0;
  const targetTimestamp = events[prevIndex]?.timestamp ?? 0;

  return {
    ...state,
    state: state.state === 'playing' ? 'paused' : state.state,
    currentIndex: prevIndex,
    elapsedMs: targetTimestamp - baseTimestamp,
  };
}

// ---------------------------------------------------------------------------
// Log compression for tool call waits (AC-A2)
// ---------------------------------------------------------------------------

/**
 * Compute compressed display delay for a tool call wait.
 *
 * Uses logarithmic compression to preserve narrative pacing:
 *   10s → ~3s, 60s → ~6s, 600s → ~12s
 *
 * Formula: compressed = 1000 * ln(1 + originalMs/1000) * scaleFactor
 * where scaleFactor calibrated to hit the target points.
 *
 * Very short waits (< 1s) pass through unchanged.
 */
export function computeLogCompressedDelay(originalMs: number): number {
  if (originalMs <= 0) return 0;
  if (originalMs < 1000) return originalMs;

  // Calibration: we want ln(1 + 10) * scale ≈ 3
  // ln(11) ≈ 2.398, so scale ≈ 3000 / 2.398 ≈ 1251
  // Check: ln(1+60)*1251 ≈ ln(61)*1251 ≈ 4.111*1251 ≈ 5142 (close to 6000)
  // Check: ln(1+600)*1251 ≈ ln(601)*1251 ≈ 6.399*1251 ≈ 8001 (need adjustment)
  //
  // Better fit: use seconds as input unit
  // compressed_s = scaleFactor * ln(1 + original_s)
  // Target: ln(11)*s = 3 → s = 3/ln(11) = 1.251
  //         ln(61)*1.251 = 5.14 → want 6, adjust
  //
  // Two-parameter: compressed = a * ln(1 + original_s / b)
  // Fit: a * ln(1 + 10/b) = 3, a * ln(1 + 600/b) = 12
  // Ratio: ln(1+600/b) / ln(1+10/b) = 4
  // b=3: ln(201)/ln(4.33) = 5.303/1.466 = 3.62 (too low)
  // b=5: ln(121)/ln(3) = 4.796/1.099 = 4.36 (close!)
  // b=4: ln(151)/ln(3.5) = 5.017/1.253 = 4.005 ≈ 4 ✓
  // Then a = 3 / ln(1+10/4) = 3 / ln(3.5) = 3 / 1.253 = 2.394
  // Verify: 2.394 * ln(1+60/4) = 2.394 * ln(16) = 2.394 * 2.773 = 6.637 → close to 6
  // Verify: 2.394 * ln(1+600/4) = 2.394 * ln(151) = 2.394 * 5.017 = 12.01 ✓

  const originalSec = originalMs / 1000;
  const a = 2.394;
  const b = 4;
  const compressedSec = a * Math.log(1 + originalSec / b);
  return compressedSec * 1000;
}

/**
 * Compress inter-event timestamps using log compression (AC-A2).
 *
 * Only compresses gaps adjacent to tool_call events — these represent
 * tool wait times (e.g. npm install, API calls). Non-tool gaps (message→message,
 * thinking→message) are preserved to maintain conversational rhythm.
 *
 * Spec: "原始等待時間用 log 壓縮" under "Tool Call Renderer" (F252 line 98).
 *
 * Returns new array with compressed timestamps; original events are not mutated.
 */
export function compressEventTimestamps(events: ReplayEvent[]): ReplayEvent[] {
  if (events.length <= 1) return events;

  const result: ReplayEvent[] = [events[0]];
  let compressedTimestamp = events[0].timestamp;

  for (let i = 1; i < events.length; i++) {
    const rawGap = events[i].timestamp - events[i - 1].timestamp;
    // Only compress gaps where the preceding event is a tool_call (= tool wait)
    // or the current event is a tool_call following another tool_call
    const isToolWaitGap = events[i - 1].type === 'tool_call';
    const compressedGap = isToolWaitGap ? computeLogCompressedDelay(rawGap) : rawGap;
    compressedTimestamp += compressedGap;
    result.push({ ...events[i], timestamp: compressedTimestamp });
  }

  return result;
}
