/**
 * F252 Story Player — Page Route
 *
 * Route: /story/:storyId
 *
 * Phase A (current): single session replay.
 * storyId format: "session:<sessionId>" = ephemeral single-session replay.
 *
 * Full-screen immersive layout: chat area + bottom control bar.
 */

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ReplayControls } from '@/components/story-player/ReplayControls';
import { ReplayEventBubble } from '@/components/story-player/ReplayEventBubble';
import { useReplayEngine } from '@/lib/story-player/useReplayEngine';
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
          Story ID must be in format <code>session:{'<sessionId>'}</code> (Phase A).
        </p>
        <p style={{ opacity: 0.6, fontSize: 'var(--console-font-compact)' }}>
          Received: <code>{storyId}</code>
        </p>
      </div>
    );
  }

  return <SessionReplayView sessionId={parsed.sessionId} />;
}

// ---------------------------------------------------------------------------
// Session Replay View
// ---------------------------------------------------------------------------

function SessionReplayView({ sessionId }: { sessionId: string }) {
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

  // Auto-scroll to bottom as new events appear (eventCount triggers re-run)
  const eventCount = visibleEvents.length;
  useEffect(() => {
    if (eventCount > 0 && scrollRef.current && engine.state === 'playing') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventCount, engine.state]);

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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ fontSize: 'var(--console-font-sm)', fontWeight: 600 }}>🎬 Story Player</span>
        <span style={{ opacity: 0.5, fontSize: 'var(--console-font-xs)', fontFamily: 'var(--font-mono, monospace)' }}>
          {sessionId.slice(0, 16)}...
        </span>
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

      {/* Controls */}
      <ReplayControls
        engine={engine}
        activeSkip={activeSkip}
        chapters={chapters}
        onTogglePlayPause={togglePlayPause}
        onSeek={doSeek}
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
