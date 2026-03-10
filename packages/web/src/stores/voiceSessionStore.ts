'use client';

import { create } from 'zustand';
import { apiFetch } from '@/utils/api-client';

/**
 * F092: Voice Companion Session — manages voice mode state.
 *
 * VoiceSession is ephemeral (memory only, no persistence).
 * Closing the page ends the session.
 *
 * P0 scope: one thread, one cat, auto-play, PTT.
 */

export type PlaybackState = 'idle' | 'playing';

export interface VoiceSession {
  sessionId: string;
  boundThreadId: string;
  activeCatId: string;
  voiceMode: boolean;
  /** Whether user gesture has unlocked browser autoplay */
  autoplayUnlocked: boolean;
  playbackState: PlaybackState;
  /** Track which audio block IDs have been auto-played (avoid replays on re-render) */
  playedBlockIds: Set<string>;
}

/** Fire-and-forget: notify backend about voice mode toggle for prompt injection. */
function syncVoiceModeToBackend(threadId: string, voiceMode: boolean): void {
  apiFetch(`/api/threads/${threadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceMode }),
  }).catch(() => {
    // Best-effort — voice mode prompt injection is non-critical path
  });
}

interface VoiceSessionActions {
  session: VoiceSession | null;
  /** Start voice companion — binds to current thread + cat */
  start: (threadId: string, catId: string, autoplayUnlocked: boolean) => void;
  /** Stop voice companion */
  stop: () => void;
  setPlaybackState: (state: PlaybackState) => void;
  /** Confirm autoplay is unlocked (called on first successful play) */
  confirmAutoplayUnlocked: () => void;
  /** Mark an audio block as auto-played */
  markPlayed: (blockId: string) => void;
  /** Check if a block has been auto-played */
  hasPlayed: (blockId: string) => boolean;
}

let sessionCounter = 0;

export const useVoiceSessionStore = create<VoiceSessionActions>((set, get) => ({
  session: null,

  start: (threadId, catId, autoplayUnlocked) => {
    sessionCounter++;
    set({
      session: {
        sessionId: `vs-${Date.now()}-${sessionCounter}`,
        boundThreadId: threadId,
        activeCatId: catId,
        voiceMode: true,
        autoplayUnlocked,
        playbackState: 'idle',
        playedBlockIds: new Set(),
      },
    });
    syncVoiceModeToBackend(threadId, true);
  },

  stop: () => {
    const { session } = get();
    set({ session: null });
    if (session?.boundThreadId) {
      syncVoiceModeToBackend(session.boundThreadId, false);
    }
  },

  confirmAutoplayUnlocked: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, autoplayUnlocked: true } });
  },

  setPlaybackState: (playbackState) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, playbackState } });
  },

  markPlayed: (blockId) => {
    const { session } = get();
    if (!session) return;
    const next = new Set(session.playedBlockIds);
    next.add(blockId);
    set({ session: { ...session, playedBlockIds: next } });
  },

  hasPlayed: (blockId) => {
    const { session } = get();
    return session?.playedBlockIds.has(blockId) ?? false;
  },
}));
