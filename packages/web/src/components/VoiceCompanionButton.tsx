'use client';

import { useCallback } from 'react';
import { useVoiceSessionStore } from '@/stores/voiceSessionStore';

/**
 * F092 P0: "开始语音陪伴" button — starts/stops Voice Companion mode.
 *
 * On click:
 * - Creates + resumes AudioContext (browser autoplay unlock via user gesture)
 * - Starts VoiceSession bound to current thread + cat
 *
 * Visual: pill-shaped floating button above ChatInput.
 */

/** Unlock browser autoplay by creating and resuming an AudioContext.
 *  Returns true if unlock succeeded, false otherwise. */
function unlockAutoplay(): boolean {
  try {
    const ctx = new AudioContext();
    // Play a tiny silent buffer to fully unlock autoplay
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    ctx.resume();
    return ctx.state !== 'suspended';
  } catch {
    return false;
  }
}

interface VoiceCompanionButtonProps {
  threadId: string;
  /** Default cat to bind to (first target cat or 'opus') */
  defaultCatId: string;
}

export function VoiceCompanionButton({ threadId, defaultCatId }: VoiceCompanionButtonProps) {
  const session = useVoiceSessionStore((s) => s.session);
  const start = useVoiceSessionStore((s) => s.start);
  const stop = useVoiceSessionStore((s) => s.stop);

  const isActive = session?.voiceMode && session.boundThreadId === threadId;

  const handleClick = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      const unlocked = unlockAutoplay();
      start(threadId, defaultCatId, unlocked);
    }
  }, [isActive, threadId, defaultCatId, start, stop]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200 shadow-sm
        ${
          isActive
            ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 dark:shadow-green-900/30'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
      aria-label={isActive ? '停止语音陪伴' : '开始语音陪伴'}
      title={isActive ? '停止语音陪伴 (Voice Companion)' : '开始语音陪伴 (Voice Companion)'}
    >
      {isActive ? (
        <>
          {/* Active: headphones icon with pulse */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="animate-pulse"
            role="img"
            aria-label="语音陪伴中"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
          <span>语音陪伴中</span>
          {session?.playbackState === 'playing' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
        </>
      ) : (
        <>
          {/* Inactive: headphones icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            role="img"
            aria-label="语音陪伴"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
          <span>语音陪伴</span>
        </>
      )}
    </button>
  );
}
