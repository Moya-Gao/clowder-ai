'use client';

import { useCallback } from 'react';
import { useVoiceSessionStore } from '@/stores/voiceSessionStore';

/**
 * F092 P0: Voice Companion toggle — icon-only header button.
 *
 * On click:
 * - Creates + resumes AudioContext (browser autoplay unlock via user gesture)
 * - Starts/stops VoiceSession bound to current thread + cat
 *
 * Visual: icon-only, matches other header buttons (ExportButton, Signal Inbox).
 * Hover tooltip: "语音陪伴" / "停止语音陪伴"
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
        p-1 rounded-lg transition-colors
        ${
          isActive
            ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'text-gray-500 hover:bg-owner-light'
        }
      `}
      aria-label={isActive ? '停止语音陪伴' : '语音陪伴'}
      title={isActive ? '停止语音陪伴' : '语音陪伴'}
    >
      <svg
        className={`w-5 h-5${isActive ? ' animate-pulse' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    </button>
  );
}
