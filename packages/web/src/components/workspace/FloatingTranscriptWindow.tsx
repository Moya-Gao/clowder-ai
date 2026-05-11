'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';

interface TranscriptLine {
  ts: number;
  elapsed_s: number;
  chunk_num: number;
  asr_latency: number;
  text: string;
}

interface FloatingTranscriptWindowProps {
  lines: TranscriptLine[];
  connected: boolean;
  recording: boolean;
  sourceLabel?: string;
  elapsed?: number;
  onClose: () => void;
  onStop?: () => void;
  onMinimize?: () => void;
}

const STORAGE_KEY = 'cat-cafe-floating-transcript';

interface PersistedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadLayout(): PersistedLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedLayout;
  } catch {}
  return { x: 100, y: 100, width: 380, height: 420 };
}

function saveLayout(layout: PersistedLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FloatingTranscriptWindow({
  lines,
  connected,
  recording,
  sourceLabel,
  elapsed = 0,
  onClose,
  onStop,
  onMinimize,
}: FloatingTranscriptWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  const [minimized, setMinimized] = useState(false);
  const [layout, setLayout] = useState<PersistedLayout>(loadLayout);

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const handleMinimize = useCallback(() => {
    setMinimized((v) => !v);
    onMinimize?.();
  }, [onMinimize]);

  const avgLatency = lines.length ? (lines.reduce((s, l) => s + l.asr_latency, 0) / lines.length).toFixed(2) : '—';

  if (minimized) {
    return (
      <Rnd
        default={{ x: layout.x, y: layout.y, width: 260, height: 36 }}
        minWidth={200}
        minHeight={36}
        maxHeight={36}
        enableResizing={false}
        bounds="window"
        tabIndex={-1}
        className="z-[9999]"
        onDragStop={(_e, d) => {
          const next = { ...layout, x: d.x, y: d.y };
          setLayout(next);
          saveLayout(next);
        }}
      >
        <div
          tabIndex={-1}
          className="flex h-9 items-center gap-2 rounded-lg border border-cafe-border bg-cafe-surface-primary px-3 shadow-lg"
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${recording ? 'bg-green-500 animate-pulse' : 'bg-cafe-text-muted'}`}
          />
          <span className="flex-1 truncate text-xs text-cafe-text-primary">
            {recording ? (sourceLabel ?? 'Recording') : 'Transcript'}
          </span>
          {recording && (
            <span className="font-mono text-[10px] text-cafe-text-secondary">{formatDuration(elapsed)}</span>
          )}
          <button
            type="button"
            onClick={handleMinimize}
            className="text-xs text-cafe-text-muted hover:text-cafe-text-primary"
            title="Restore"
          >
            &#9723;
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-cafe-text-muted hover:text-cafe-text-primary"
            title="Close"
          >
            &times;
          </button>
        </div>
      </Rnd>
    );
  }

  return (
    <Rnd
      default={{ x: layout.x, y: layout.y, width: layout.width, height: layout.height }}
      minWidth={280}
      minHeight={200}
      bounds="window"
      tabIndex={-1}
      className="z-[9999]"
      onDragStop={(_e, d) => {
        const next = { ...layout, x: d.x, y: d.y };
        setLayout(next);
        saveLayout(next);
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const next = { x: pos.x, y: pos.y, width: ref.offsetWidth, height: ref.offsetHeight };
        setLayout(next);
        saveLayout(next);
      }}
    >
      <div
        tabIndex={-1}
        className="flex h-full flex-col rounded-lg border border-cafe-border bg-cafe-surface-primary shadow-xl"
      >
        {/* Header — drag handle */}
        <div className="flex items-center gap-2 border-b border-cafe-border px-3 py-2 cursor-move select-none">
          <span
            className={`inline-block h-2 w-2 rounded-full ${recording ? 'bg-green-500 animate-pulse' : 'bg-cafe-text-muted'}`}
          />
          <span className="flex-1 truncate text-sm font-medium text-cafe-text-primary">
            {recording ? (sourceLabel ?? 'Recording') : 'Transcript'}
          </span>
          {recording && (
            <>
              <span className="font-mono text-xs text-cafe-text-secondary">{formatDuration(elapsed)}</span>
              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Stop
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleMinimize}
            className="rounded px-1 py-0.5 text-xs text-cafe-text-muted hover:text-cafe-text-primary"
            title="Minimize"
          >
            Minimize
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 py-0.5 text-xs text-cafe-text-muted hover:text-cafe-text-primary"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Transcript body */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
          {lines.length === 0 && (
            <p className="mt-8 text-center text-cafe-text-muted">
              {recording ? 'Waiting for first transcript chunk...' : 'No transcript data.'}
            </p>
          )}
          {lines.map((l, i) => (
            <div key={l.chunk_num ?? i} className="mb-1 flex gap-2">
              <span className="shrink-0 text-cafe-text-muted">[{formatTime(l.ts)}]</span>
              <span className="text-cafe-text-primary">{l.text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-cafe-border px-3 py-1.5 text-[10px] text-cafe-text-muted">
          <span>{lines.length} chunks</span>
          <span>avg {avgLatency}s</span>
          <span className={connected ? 'text-green-500' : 'text-red-400'}>{connected ? 'SSE' : 'disconnected'}</span>
        </div>
      </div>
    </Rnd>
  );
}
