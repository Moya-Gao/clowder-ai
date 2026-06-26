/**
 * F252 Story Player — Page Route
 *
 * Route: /story/:storyId
 *
 * Phase A: `session:<sessionId>` → single session replay
 * Phase C: `feat:<featId>` → feature story (multi-thread swimlane + causal edges)
 * Phase D: Annotations at arbitrary timestamps + sanitized export
 *
 * Full-screen immersive layout. Story type determines which view to render.
 */

'use client';

import type { StoryAnnotation } from '@cat-cafe/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnotationEditor } from '@/components/story-player/AnnotationEditor';
import { AnnotationOverlay } from '@/components/story-player/AnnotationOverlay';
import { FeatureStoryView } from '@/components/story-player/FeatureStoryView';
import { ReplayControls } from '@/components/story-player/ReplayControls';
import { ReplayEventBubble } from '@/components/story-player/ReplayEventBubble';
import { useReplayEngine } from '@/lib/story-player/useReplayEngine';
import { apiFetch } from '@/utils/api-client';
import { parseStoryId } from './parseStoryId';

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function StoryPlayerPage() {
  const params = useParams();
  const storyId = typeof params.storyId === 'string' ? params.storyId : '';
  const parsed = parseStoryId(storyId);

  if (!parsed) {
    return (
      <div style={styles.errorContainer}>
        <h2>Invalid Story ID</h2>
        <p>
          Story ID must be in format <code>session:{'<sessionId>'}</code> or <code>feat:{'<featId>'}</code>.
        </p>
        <p style={{ opacity: 0.6, fontSize: 'var(--console-font-compact)' }}>
          Received: <code>{storyId}</code>
        </p>
      </div>
    );
  }

  if (parsed.type === 'feat') {
    return <FeatureStoryView featId={parsed.featId} />;
  }

  return <SessionReplayView sessionId={parsed.sessionId} />;
}

// ---------------------------------------------------------------------------
// Session Replay View
// ---------------------------------------------------------------------------

function SessionReplayView({ sessionId }: { sessionId: string }) {
  const storyId = `session:${sessionId}`;
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
    doToggleDisplayMode,
    doToggleAdaptivePacing,
  } = useReplayEngine({ sessionId });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Phase D: Annotation state
  const [annotations, setAnnotations] = useState<StoryAnnotation[]>([]);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Track which annotations have triggered auto-pause (prevent re-pause after dismiss)
  const [pausedAnnotationIds, setPausedAnnotationIds] = useState<Set<string>>(new Set());

  // Fetch annotations on mount
  useEffect(() => {
    apiFetch(`/api/story/${encodeURIComponent(storyId)}/annotations`)
      .then((r) => r.json())
      .then((data) => setAnnotations(data.annotations ?? []))
      .catch(() => {}); // annotations are optional — don't block replay
  }, [storyId]);

  const handleAnnotationSave = useCallback(() => {
    // Refetch annotations after save
    apiFetch(`/api/story/${encodeURIComponent(storyId)}/annotations`)
      .then((r) => r.json())
      .then((data) => setAnnotations(data.annotations ?? []))
      .catch(() => {});
  }, [storyId]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/story/${encodeURIComponent(storyId)}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Session ${sessionId.slice(0, 8)}` }),
      });
      const manifest = await res.json();
      setExportUrl(`/story/${encodeURIComponent(storyId)}/public`);
      void manifest; // manifest used for URL derivation
    } catch {
      // Export is non-critical
    } finally {
      setExporting(false);
    }
  }, [storyId, sessionId]);

  const handleAnnotationDismiss = useCallback(() => {
    // Resume playback after annotation dismissal (auto-pause or manual)
    if (engine.state === 'paused') {
      togglePlayPause();
    }
  }, [engine.state, togglePlayPause]);

  // Wrap doSeek to clear auto-pause tracking (revisiting annotations should re-pause)
  const handleSeek = useCallback(
    (index: number) => {
      setPausedAnnotationIds(new Set());
      doSeek(index);
    },
    [doSeek],
  );

  // Current replay time (from the currently displayed event) — safe with empty events (returns 0)
  const currentTime =
    engine.currentIndex < visibleEvents.length ? (visibleEvents[engine.currentIndex]?.timestamp ?? 0) : 0;

  // Auto-scroll to bottom as new events appear (eventCount triggers re-run)
  const eventCount = visibleEvents.length;
  useEffect(() => {
    if (eventCount > 0 && scrollRef.current && engine.state === 'playing') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventCount, engine.state]);

  // Auto-pause at annotation timestamps (AC-D1: "回放时注解自动弹出 / 暂停模式下手动浏览")
  // Only pauses for annotations not yet seen in this playback pass.
  // Seek clears the seen set so revisiting annotations re-pauses.
  useEffect(() => {
    if (engine.state !== 'playing' || annotations.length === 0) return;
    const activeUnseen = annotations.filter(
      (a) => Math.abs(a.at - currentTime) <= 500 && !pausedAnnotationIds.has(a.id),
    );
    if (activeUnseen.length > 0) {
      togglePlayPause();
      setPausedAnnotationIds((prev) => {
        const next = new Set(prev);
        for (const a of activeUnseen) next.add(a.id);
        return next;
      });
    }
  }, [engine.state, currentTime, annotations, togglePlayPause, pausedAnnotationIds]);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading session events...</p>
        <p style={{ opacity: 0.5, fontSize: 'var(--console-font-xs)' }}>Session: {sessionId}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h2>Failed to load session</h2>
        <p>{error}</p>
        <p style={{ opacity: 0.5, fontSize: 'var(--console-font-xs)' }}>Session: {sessionId}</p>
      </div>
    );
  }

  if (engine.totalEvents === 0) {
    return (
      <div style={styles.errorContainer}>
        <h2>Empty session</h2>
        <p>No events found for this session.</p>
      </div>
    );
  }

  const effectiveSpeed = typeof engine.speed === 'number' ? engine.speed : 100;

  // Compute time range from events for annotation editor
  const timeRange =
    visibleEvents.length > 0
      ? { start: visibleEvents[0].timestamp, end: visibleEvents[visibleEvents.length - 1].timestamp }
      : { start: 0, end: 0 };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ fontSize: 'var(--console-font-sm)', fontWeight: 600 }}>🎬 Story Player</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Annotation count */}
          {annotations.length > 0 && (
            <span style={{ fontSize: 'var(--console-font-label)', opacity: 0.6 }}>📝 {annotations.length}</span>
          )}
          {/* Add Note button (AC-D1) */}
          <button
            type="button"
            onClick={() => setShowAnnotationEditor(true)}
            style={styles.headerButton}
            title="Add annotation at current position"
          >
            📝 Add Note
          </button>
          {/* Export button (AC-D2) */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{ ...styles.headerButton, opacity: exporting ? 0.5 : 1 }}
            title="Create sanitized public export"
          >
            {exporting ? '⏳' : '📤'} Export
          </button>
          {/* Export URL display */}
          {exportUrl && (
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 'var(--console-font-label)', color: 'var(--color-accent, #6366f1)' }}
            >
              🔗 Public
            </a>
          )}
          <span style={{ opacity: 0.5, fontSize: 'var(--console-font-xs)', fontFamily: 'var(--font-mono, monospace)' }}>
            {sessionId.slice(0, 16)}...
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} style={styles.chatArea}>
        {visibleEvents.map((event, i) => (
          <ReplayEventBubble
            key={event.eventNo}
            event={event}
            displayMode={engine.displayMode}
            isRevealing={i === visibleEvents.length - 1 && engine.state === 'playing'}
            speedMultiplier={effectiveSpeed}
          />
        ))}
      </div>

      {/* Annotation overlay (AC-D1) — shows during replay at annotation timestamps */}
      {annotations.length > 0 && (
        <AnnotationOverlay annotations={annotations} currentTime={currentTime} onDismiss={handleAnnotationDismiss} />
      )}

      {/* Annotation editor modal (AC-D1) */}
      {showAnnotationEditor && (
        <AnnotationEditor
          storyId={storyId}
          currentTime={currentTime}
          timeRange={timeRange}
          onSave={handleAnnotationSave}
          onClose={() => setShowAnnotationEditor(false)}
        />
      )}

      {/* Controls */}
      <ReplayControls
        engine={engine}
        activeSkip={activeSkip}
        chapters={chapters}
        onTogglePlayPause={togglePlayPause}
        onSeek={handleSeek}
        onSetSpeed={doSetSpeed}
        onToggleDisplayMode={doToggleDisplayMode}
        onToggleAdaptivePacing={doToggleAdaptivePacing}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--color-surface, #0d0d1a)',
    color: 'var(--color-text-primary, #e0e0e0)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border, #333)',
    background: 'var(--color-surface-elevated, #1a1a2e)',
  },
  headerButton: {
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid var(--color-border, #555)',
    borderRadius: '4px',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 'var(--console-font-xs)',
  },
  chatArea: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    paddingBottom: '64px', // space for fixed controls bar
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: 'var(--color-text-primary, #e0e0e0)',
    background: 'var(--color-surface, #0d0d1a)',
    gap: '12px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: 'var(--color-text-primary, #e0e0e0)',
    background: 'var(--color-surface, #0d0d1a)',
    gap: '8px',
    textAlign: 'center',
    padding: '20px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--color-border, #333)',
    borderTopColor: 'var(--color-accent, #6366f1)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
