'use client';

import { useState, useRef, useEffect } from 'react';
import type { RichAudioBlock } from '@/stores/chat-types';
import { apiFetch } from '@/utils/api-client';

export function AudioBlock({ block }: { block: RichAudioBlock }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  // Fetch audio via apiFetch (carries auth header) → blob URL
  useEffect(() => {
    if (!block.url.startsWith('/api/')) {
      setBlobSrc(block.url);
      return;
    }
    let cancelled = false;
    apiFetch(block.url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!cancelled && blob) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setBlobSrc(url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [block.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onTimeUpdate = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [blobSrc]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
  };

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
      <button
        onClick={toggle}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <rect x="1" y="0" width="3" height="14" rx="1" />
            <rect x="8" y="0" width="3" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <path d="M0 0L12 7L0 14V0Z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {block.title && (
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{block.title}</div>
        )}
        <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {block.durationSec != null && block.durationSec > 0 && (
        <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
          {formatDuration(block.durationSec)}
        </span>
      )}

      {blobSrc && <audio ref={audioRef} src={blobSrc} preload="none" />}
    </div>
  );
}
