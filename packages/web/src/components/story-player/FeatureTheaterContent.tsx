'use client';

/**
 * F252 Phase E PR E-4 — Feature Theater Content
 *
 * Orchestrator that wires useFeatureReplay → MultiCamStage + ReplayControls.
 * Feature-level equivalent of TheaterReplayContent (which handles single-thread).
 *
 * AC-E5: Multi-cam split screen layout
 * AC-E3: Spotlight/dim visual state per panel
 */

import { useFeatureReplay } from '@/lib/story-player/useFeatureReplay';
import { MultiCamStage } from './MultiCamStage';
import { ReplayControls } from './ReplayControls';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeatureTheaterContent({ featId }: { featId: string }) {
  const {
    threadPanels,
    layout,
    isLoading,
    error,
    engine,
    activeSkip,
    chapters,
    densityBuckets,
    togglePlayPause,
    doSeek,
    doSetSpeed,
    doToggleDisplayMode,
    doToggleAdaptivePacing,
  } = useFeatureReplay({ featId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-[var(--console-text-secondary,#aaa)]">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
          <span className="text-sm">Loading feature threads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-[var(--semantic-critical,#f44)]">{error}</p>
          <p className="text-xs text-[var(--console-text-tertiary,#888)] mt-2">Try closing and reopening the replay</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="feature-theater-content">
      {/* Multi-cam stage (dynamic layout with spotlight/dim panels) */}
      <MultiCamStage panels={threadPanels} layout={layout} displayMode={engine.displayMode} />

      {/* Shared playback controls */}
      <div className="border-t border-[var(--console-border,rgba(255,255,255,0.1))] px-4 py-3 bg-[var(--console-shell-bg,#111)]">
        <ReplayControls
          engine={engine}
          activeSkip={activeSkip}
          chapters={chapters}
          densityBuckets={densityBuckets}
          onTogglePlayPause={togglePlayPause}
          onSeek={doSeek}
          onSetSpeed={doSetSpeed}
          onToggleDisplayMode={doToggleDisplayMode}
          onToggleAdaptivePacing={doToggleAdaptivePacing}
        />
      </div>
    </div>
  );
}
