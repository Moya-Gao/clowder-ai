/**
 * F252 Story Player — Replay Controls Bar
 *
 * Bottom control bar with: play/pause, speed selector, progress bar (seekable),
 * time display, display mode toggle.
 */

'use client';

import type { Chapter } from '@/lib/story-player/chapters';
import type { ReplayEngineState, SpeedMultiplier } from '@/lib/story-player/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReplayControlsProps {
  engine: ReplayEngineState;
  /** Active skip indicator — non-null when current event follows a long idle gap */
  activeSkip: { originalGapMs: number } | null;
  /** Chapters for timeline navigation (AC-B2) */
  chapters: Chapter[];
  onTogglePlayPause: () => void;
  onSeek: (index: number) => void;
  onSetSpeed: (speed: SpeedMultiplier) => void;
  onToggleDisplayMode: () => void;
  onToggleAdaptivePacing: () => void;
}

// ---------------------------------------------------------------------------
// Speed options
// ---------------------------------------------------------------------------

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 10, 50, 100, 'max'];

function formatSpeed(speed: SpeedMultiplier): string {
  return speed === 'max' ? 'MAX' : `${speed}×`;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Format skip duration for the "⏩ 跳过 N 分钟" indicator */
function formatSkipDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.round(ms / 1000)} 秒`;
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return remainMin > 0 ? `${hours} 小时 ${remainMin} 分钟` : `${hours} 小时`;
}

/** Icon for chapter kind */
function chapterIcon(kind: Chapter['kind']): string {
  switch (kind) {
    case 'session_start':
      return '▶';
    case 'session_end':
      return '⏹';
    case 'invocation':
      return '🔄';
    case 'pass_ball':
      return '🏐';
    case 'post_idle':
      return '⏩';
    default:
      return '📍';
  }
}

export function ReplayControls({
  engine,
  activeSkip,
  chapters,
  onTogglePlayPause,
  onSeek,
  onSetSpeed,
  onToggleDisplayMode,
  onToggleAdaptivePacing,
}: ReplayControlsProps) {
  const progress =
    engine.totalEvents > 1
      ? (engine.currentIndex / (engine.totalEvents - 1)) * 100
      : engine.totalEvents === 1
        ? 100
        : 0;

  const playIcon = engine.state === 'playing' ? '⏸' : engine.state === 'ended' ? '↻' : '▶';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--color-surface-elevated, #1a1a2e)',
        borderTop: '1px solid var(--color-border, #333)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100,
        color: 'var(--color-text-primary, #e0e0e0)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 'var(--console-font-compact)',
      }}
    >
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={onTogglePlayPause}
        aria-label={engine.state === 'playing' ? 'Pause' : 'Play'}
        style={{
          background: 'none',
          border: '1px solid var(--color-border, #555)',
          borderRadius: '4px',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 'var(--console-font-base)',
          padding: '4px 8px',
          minWidth: '36px',
        }}
      >
        {playIcon}
      </button>

      {/* Progress bar */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Replay progress"
        aria-valuemin={0}
        aria-valuemax={Math.max(engine.totalEvents - 1, 0)}
        aria-valuenow={engine.currentIndex}
        style={{ flex: 1, position: 'relative', height: '6px', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const targetIndex = Math.round(pct * Math.max(engine.totalEvents - 1, 0));
          onSeek(targetIndex);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(engine.currentIndex + 1, engine.totalEvents - 1));
          else if (e.key === 'ArrowLeft') onSeek(Math.max(engine.currentIndex - 1, 0));
        }}
      >
        {/* Track */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--color-surface-secondary, #2a2a3e)',
            borderRadius: '3px',
          }}
        />
        {/* AC-B2: Chapter markers on progress bar */}
        {chapters
          .filter((ch) => ch.kind !== 'session_start' && ch.kind !== 'session_end')
          .map((ch) => {
            const pct = engine.totalEvents > 1 ? (ch.eventIndex / (engine.totalEvents - 1)) * 100 : 0;
            return (
              <button
                type="button"
                key={`ch-${ch.eventIndex}`}
                title={`${chapterIcon(ch.kind)} ${ch.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(ch.eventIndex);
                }}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: '-4px',
                  width: '8px',
                  height: '14px',
                  transform: 'translateX(-50%)',
                  background:
                    ch.eventIndex <= engine.currentIndex
                      ? 'var(--color-accent, #6366f1)'
                      : 'var(--color-text-secondary, #888)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  zIndex: 2,
                  opacity: 0.8,
                  fontSize: 'var(--console-font-label)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  color: 'inherit',
                }}
              >
                <span style={{ pointerEvents: 'none' }}>{chapterIcon(ch.kind)}</span>
              </button>
            );
          })}
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${progress}%`,
            background: 'var(--color-accent, #6366f1)',
            borderRadius: '3px',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Event counter */}
      <span style={{ minWidth: '80px', textAlign: 'center', fontSize: 'var(--console-font-xs)', opacity: 0.8 }}>
        {engine.currentIndex + 1} / {engine.totalEvents}
      </span>

      {/* Time display */}
      <span style={{ minWidth: '100px', textAlign: 'center', fontSize: 'var(--console-font-xs)', opacity: 0.7 }}>
        {formatDuration(engine.elapsedMs)} / {formatDuration(engine.totalDurationMs)}
      </span>

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {SPEED_OPTIONS.map((s) => (
          <button
            type="button"
            key={String(s)}
            onClick={() => onSetSpeed(s)}
            style={{
              background: engine.speed === s ? 'var(--color-accent, #6366f1)' : 'transparent',
              border: '1px solid var(--color-border, #555)',
              borderRadius: '3px',
              color: engine.speed === s ? '#fff' : 'inherit',
              cursor: 'pointer',
              fontSize: 'var(--console-font-label)',
              padding: '2px 6px',
            }}
          >
            {formatSpeed(s)}
          </button>
        ))}
      </div>

      {/* Adaptive pacing toggle (AC-B1) */}
      <button
        type="button"
        onClick={onToggleAdaptivePacing}
        title={
          engine.adaptivePacing
            ? 'Adaptive pacing ON — auto-skips idle gaps, slows at pass-ball'
            : 'Adaptive pacing OFF — fixed speed only'
        }
        style={{
          background: engine.adaptivePacing ? 'var(--color-accent, #6366f1)' : 'transparent',
          border: '1px solid var(--color-border, #555)',
          borderRadius: '3px',
          color: engine.adaptivePacing ? '#fff' : 'inherit',
          cursor: 'pointer',
          fontSize: 'var(--console-font-label)',
          padding: '2px 8px',
        }}
      >
        🎯 Adaptive
      </button>

      {/* Display mode toggle */}
      <button
        type="button"
        onClick={onToggleDisplayMode}
        title={`Mode: ${engine.displayMode}`}
        style={{
          background: 'none',
          border: '1px solid var(--color-border, #555)',
          borderRadius: '3px',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 'var(--console-font-label)',
          padding: '2px 8px',
        }}
      >
        {engine.displayMode === 'cinematic' ? '🎬 Cinematic' : '📋 Faithful'}
      </button>

      {/* Skip indicator (AC-B1) — shown when current event follows a long idle gap */}
      {activeSkip && (
        <>
          <style>{`
            @keyframes skipFadeInOut {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
              15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: 'var(--console-font-base)',
              fontFamily: 'var(--font-mono, monospace)',
              pointerEvents: 'none',
              zIndex: 200,
              animation: 'skipFadeInOut 2s ease-in-out forwards',
            }}
          >
            ⏩ 跳过 {formatSkipDuration(activeSkip.originalGapMs)}
          </div>
        </>
      )}
    </div>
  );
}
