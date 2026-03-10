'use client';

import { useEffect, useRef } from 'react';
import type { RichAudioBlock } from '@/stores/chat-types';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceSessionStore } from '@/stores/voiceSessionStore';
import { apiFetch } from '@/utils/api-client';

/**
 * F092: Auto-play incoming audio blocks when Voice Companion is active.
 *
 * Watches the message list for new assistant messages containing audio blocks.
 * When voice mode is on + autoplay unlocked, plays them automatically.
 *
 * Uses a module-level singleton Audio element (same pattern as useTts)
 * to ensure only one auto-play at a time.
 */

let autoplayAudio: HTMLAudioElement | null = null;
let autoplayBlobUrl: string | null = null;

function cleanupAutoplay(): void {
  if (autoplayAudio) {
    autoplayAudio.pause();
    autoplayAudio.onended = null;
    autoplayAudio.onerror = null;
    autoplayAudio = null;
  }
  if (autoplayBlobUrl) {
    URL.revokeObjectURL(autoplayBlobUrl);
    autoplayBlobUrl = null;
  }
}

async function fetchAndPlay(block: RichAudioBlock): Promise<void> {
  cleanupAutoplay();

  const { markPlayed, setPlaybackState } = useVoiceSessionStore.getState();

  try {
    let blobUrl: string;

    if (block.url.startsWith('/api/')) {
      const res = await apiFetch(block.url);
      if (!res.ok) return;
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
      autoplayBlobUrl = blobUrl;
    } else {
      blobUrl = block.url;
    }

    // Re-check voice mode is still active after async fetch
    const { session } = useVoiceSessionStore.getState();
    if (!session?.voiceMode) {
      cleanupAutoplay();
      return;
    }

    const audio = new Audio(blobUrl);
    autoplayAudio = audio;
    setPlaybackState('playing');

    audio.onended = () => {
      setPlaybackState('idle');
      autoplayAudio = null;
    };
    audio.onerror = () => {
      setPlaybackState('idle');
      autoplayAudio = null;
    };

    await audio.play();
    markPlayed(block.id);
  } catch {
    setPlaybackState('idle');
  }
}

/** Scan new messages for the latest unplayed audio block (latest-wins per KD-4) */
function findUnplayedAudioBlock(
  newMessages: ReadonlyArray<{ type: string; extra?: { rich?: { blocks: Array<{ kind: string; id: string }> } } }>,
): RichAudioBlock | null {
  for (let i = newMessages.length - 1; i >= 0; i--) {
    const msg = newMessages[i];
    if (msg.type !== 'assistant') continue;

    const blocks = msg.extra?.rich?.blocks;
    if (!blocks) continue;

    const audioBlocks = blocks.filter((b): b is RichAudioBlock => b.kind === 'audio');
    if (audioBlocks.length === 0) continue;

    const lastBlock = audioBlocks[audioBlocks.length - 1];
    if (!useVoiceSessionStore.getState().hasPlayed(lastBlock.id)) {
      return lastBlock;
    }
  }
  return null;
}

export function useVoiceAutoPlay(): void {
  const messages = useChatStore((s) => s.messages);
  const session = useVoiceSessionStore((s) => s.session);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (!session?.voiceMode || !session.autoplayUnlocked) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messages.length <= prevCount) return;

    const block = findUnplayedAudioBlock(messages.slice(prevCount));
    if (block) fetchAndPlay(block);
  }, [messages, session]);

  // Cleanup on unmount or voice mode stop
  useEffect(() => {
    if (!session?.voiceMode) {
      cleanupAutoplay();
    }
    return () => cleanupAutoplay();
  }, [session?.voiceMode]);
}
