/**
 * F252 Story Player — React Hook for Replay Engine
 *
 * Bridges the pure replay-engine state machine with React state and
 * requestAnimationFrame timing. All replay logic is in replay-engine.ts;
 * this hook only handles:
 * - React state management (useState/useRef)
 * - RAF-based tick loop
 * - Keyboard shortcut bindings
 * - Session events fetching
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { adaptTranscriptEvents } from './adapter';
import {
  compressEventTimestamps,
  createReplayEngine,
  pause,
  play,
  seek,
  setDisplayMode,
  setSpeed,
  stepBackward,
  stepForward,
  tick,
} from './replay-engine';
import type { RawTranscriptEvent, ReplayEngineState, ReplayEvent, SpeedMultiplier } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseReplayEngineOptions {
  /** Session ID to fetch events for */
  sessionId: string;
}

export interface UseReplayEngineResult {
  /** Current engine state */
  engine: ReplayEngineState;
  /** All replay events (adapted from raw) */
  events: ReplayEvent[];
  /** Events up to and including currentIndex (visible events) */
  visibleEvents: ReplayEvent[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Controls */
  togglePlayPause: () => void;
  doSeek: (index: number) => void;
  doSetSpeed: (speed: SpeedMultiplier) => void;
  doStepForward: () => void;
  doStepBackward: () => void;
  doToggleDisplayMode: () => void;
}

// ---------------------------------------------------------------------------
// Event fetching
// ---------------------------------------------------------------------------

async function fetchAllSessionEvents(sessionId: string): Promise<RawTranscriptEvent[]> {
  const all: RawTranscriptEvent[] = [];
  // API returns nextCursor as { eventNo: number } (TranscriptReader.ts:37)
  let cursorEventNo: number | undefined;

  // Paginate through all events using project's apiFetch (handles URL, credentials, 401 retry)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = new URLSearchParams({ view: 'raw', limit: '200' });
    if (cursorEventNo != null) params.set('cursor', String(cursorEventNo));

    const response = await apiFetch(`/api/sessions/${sessionId}/events?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      events: RawTranscriptEvent[];
      nextCursor?: { eventNo: number };
    };

    all.push(...data.events);

    if (!data.nextCursor) break;
    cursorEventNo = data.nextCursor.eventNo;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Sub-hooks (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

type EngineSetter = React.Dispatch<React.SetStateAction<ReplayEngineState>>;

/** RAF-based tick loop that drives the replay engine forward */
function useReplayTick(setEngine: EngineSetter, engineRef: React.RefObject<ReplayEngineState>) {
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    let rafId: number;

    function rafLoop(timestamp: number) {
      if (lastTickRef.current === 0) lastTickRef.current = timestamp;
      const delta = timestamp - lastTickRef.current;
      lastTickRef.current = timestamp;

      if (engineRef.current?.state === 'playing') {
        setEngine((prev) => tick(prev, delta));
      }
      rafId = requestAnimationFrame(rafLoop);
    }

    rafId = requestAnimationFrame(rafLoop);
    return () => cancelAnimationFrame(rafId);
  }, [setEngine, engineRef]);

  return lastTickRef;
}

/** Keyboard shortcuts: Space=play/pause, ←→=step */
function useReplayKeyboard(setEngine: EngineSetter) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.getAttribute('role') === 'slider')
      )
        return;

      if (e.key === ' ') {
        e.preventDefault();
        setEngine((prev) => (prev.state === 'playing' ? pause(prev) : play(prev)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setEngine((prev) => stepForward(prev));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setEngine((prev) => stepBackward(prev));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEngine]);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useReplayEngine(options: UseReplayEngineOptions): UseReplayEngineResult {
  const { sessionId } = options;

  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [engine, setEngine] = useState<ReplayEngineState>(() => createReplayEngine([]));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef(engine);
  engineRef.current = engine;

  // ── Fetch events on mount ──
  useEffect(() => {
    let cancelled = false;

    fetchAllSessionEvents(sessionId)
      .then((rawEvents) => {
        if (cancelled) return;
        const adapted = adaptTranscriptEvents(rawEvents);
        // AC-A2: Apply log compression to inter-event gaps (10s→3s, 60s→6s, 600s→12s)
        const compressed = compressEventTimestamps(adapted);
        setEvents(compressed);
        setEngine(createReplayEngine(compressed));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load session events');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const lastTickRef = useReplayTick(setEngine, engineRef);
  useReplayKeyboard(setEngine);

  // ── Controls ──
  const togglePlayPause = useCallback(() => {
    setEngine((prev) => (prev.state === 'playing' ? pause(prev) : play(prev)));
    lastTickRef.current = 0;
  }, [lastTickRef]);

  const doSeek = useCallback((index: number) => {
    setEngine((prev) => seek(prev, index));
  }, []);

  const doSetSpeed = useCallback((speed: SpeedMultiplier) => {
    setEngine((prev) => setSpeed(prev, speed));
  }, []);

  const doStepForward = useCallback(() => {
    setEngine((prev) => stepForward(prev));
  }, []);

  const doStepBackward = useCallback(() => {
    setEngine((prev) => stepBackward(prev));
  }, []);

  const doToggleDisplayMode = useCallback(() => {
    setEngine((prev) => setDisplayMode(prev, prev.displayMode === 'cinematic' ? 'faithful' : 'cinematic'));
  }, []);

  const visibleEvents = events.slice(0, engine.currentIndex + 1);

  return {
    engine,
    events,
    visibleEvents,
    isLoading,
    error,
    togglePlayPause,
    doSeek,
    doSetSpeed,
    doStepForward,
    doStepBackward,
    doToggleDisplayMode,
  };
}
