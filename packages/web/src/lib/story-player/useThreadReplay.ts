'use client';

/**
 * F252 Phase E — Thread Replay Orchestrator Hook
 *
 * Combines useReplayEngine + bridgeReplayEvent to provide a complete
 * thread replay state for TheaterOverlay + ReplayMessageList.
 *
 * This is the single integration point that ties together:
 * - Thread-level event fetching (useReplayEngine with threadId)
 * - ReplayEvent → ChatMessage bridging
 * - Visible message computation
 */

import { useMemo } from 'react';
import type { Chapter } from './chapters';
import type { ReplayChatMessage } from './replay-chat-bridge';
import { bridgeReplayEvent } from './replay-chat-bridge';
import { useReplayEngine } from './useReplayEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseThreadReplayOptions {
  /** Thread ID to replay */
  threadId: string;
}

export interface UseThreadReplayResult {
  /** Bridged visible messages (ready for ReplayMessageList) */
  messages: ReplayChatMessage[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Raw engine state (for ReplayControls) */
  engine: ReturnType<typeof useReplayEngine>['engine'];
  /** Active skip indicator — non-null when current event follows a long idle gap (Phase B) */
  activeSkip: { originalGapMs: number } | null;
  /** Chapters for timeline navigation (Phase B AC-B2) */
  chapters: Chapter[];
  /** Playback controls */
  togglePlayPause: () => void;
  doSeek: (index: number) => void;
  doSetSpeed: ReturnType<typeof useReplayEngine>['doSetSpeed'];
  doStepForward: () => void;
  doStepBackward: () => void;
  doToggleDisplayMode: () => void;
  doToggleAdaptivePacing: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useThreadReplay({ threadId }: UseThreadReplayOptions): UseThreadReplayResult {
  const {
    engine,
    visibleEvents,
    isLoading,
    error,
    activeSkip,
    chapters,
    togglePlayPause,
    doSeek,
    doSetSpeed,
    doStepForward,
    doStepBackward,
    doToggleDisplayMode,
    doToggleAdaptivePacing,
  } = useReplayEngine({ threadId });

  // Bridge visible events to ChatMessage-compatible format
  const messages = useMemo(() => visibleEvents.map(bridgeReplayEvent), [visibleEvents]);

  return {
    messages,
    isLoading,
    error,
    engine,
    activeSkip,
    chapters,
    togglePlayPause,
    doSeek,
    doSetSpeed,
    doStepForward,
    doStepBackward,
    doToggleDisplayMode,
    doToggleAdaptivePacing,
  };
}
