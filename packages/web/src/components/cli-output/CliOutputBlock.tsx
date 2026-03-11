'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent';
import type { CliEvent, CliStatus } from '@/stores/chat-types';

/* ── Inline SVG icons (Lucide-style, F056 compliant — no emoji) ── */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-150 flex-shrink-0"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 opacity-60"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 text-cyan-400"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PawPrint() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="flex-shrink-0 opacity-60"
    >
      <path d="M12 15C15 15 17.5 17 17.5 19.5C17.5 21 16 22.5 12 22.5C8 22.5 6.5 21 6.5 19.5C6.5 17 9 15 12 15Z" />
      <ellipse cx="6" cy="11.5" rx="2.5" ry="3" />
      <ellipse cx="12" cy="10" rx="3" ry="3.5" />
      <ellipse cx="18" cy="11.5" rx="2.5" ry="3" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 animate-spin opacity-60"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/* ── Breed-tinted dark background helper ── */

function breedDarkBg(hex: string | undefined): string {
  if (!hex) return 'rgb(30, 27, 46)'; // default dark violet (ragdoll fallback)
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  // Mix 15% breed color + 85% near-black base
  const base = { r: 15, g: 17, b: 30 };
  const mix = 0.15;
  return `rgb(${Math.round(base.r * (1 - mix) + r * mix)}, ${Math.round(base.g * (1 - mix) + g * mix)}, ${Math.round(base.b * (1 - mix) + b * mix)})`;
}

function breedDividerColor(hex: string | undefined): string {
  if (!hex) return 'rgb(55, 48, 75)';
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const base = { r: 40, g: 38, b: 55 };
  const mix = 0.2;
  return `rgb(${Math.round(base.r * (1 - mix) + r * mix)}, ${Math.round(base.g * (1 - mix) + g * mix)}, ${Math.round(base.b * (1 - mix) + b * mix)})`;
}

/* ── Status helpers ── */

const STATUS_LABEL: Record<CliStatus, string> = {
  streaming: 'streaming',
  done: 'done',
  failed: 'failed',
  interrupted: 'interrupted',
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m${rem}s` : `${m}m`;
}

function buildSummary(events: CliEvent[], status: CliStatus): string {
  const toolCount = events.filter((e) => e.kind === 'tool_use').length;
  const statusLabel = STATUS_LABEL[status];
  const timestamps = events.map((e) => e.timestamp).filter(Boolean);
  const duration =
    timestamps.length >= 2 && status !== 'streaming'
      ? ` · ${formatDuration(Math.max(...timestamps) - Math.min(...timestamps))}`
      : '';

  if (status === 'streaming') {
    const last = [...events].reverse().find((e) => e.kind === 'tool_use');
    return `CLI Output · ${statusLabel}${last ? ` · ${last.label}...` : ''}`;
  }

  if (toolCount > 0) {
    return `CLI Output · ${statusLabel} · ${toolCount} tool${toolCount > 1 ? 's' : ''}${duration}`;
  }

  const lineCount = events
    .filter((e) => e.kind === 'text')
    .reduce((n, e) => n + (e.content?.split('\n').length ?? 0), 0);
  return `CLI Output · ${statusLabel} · ${lineCount} line${lineCount !== 1 ? 's' : ''}${duration}`;
}

/* ── Tool row (individually collapsible — AC-A2) ── */

function ToolRow({
  event,
  isActive,
  onUserInteract,
}: {
  event: CliEvent;
  isActive: boolean;
  onUserInteract?: () => void;
}) {
  const [rowExpanded, setRowExpanded] = useState(false);
  const hasResult = event.detail != null;
  return (
    <button
      type="button"
      data-testid={`tool-row-${event.id}`}
      className={`w-full text-left cursor-pointer px-2 py-[5px] rounded font-mono text-[11px] ${isActive ? 'bg-white/5 border-l-2 border-purple-400' : ''}`}
      onClick={() => {
        setRowExpanded((v) => !v);
        onUserInteract?.();
      }}
    >
      <div className="flex items-center gap-2">
        {isActive ? <LoaderIcon /> : hasResult ? <CheckIcon /> : <WrenchIcon />}
        <span className="text-slate-200 font-medium">{event.label}</span>
        {hasResult && !rowExpanded && <ChevronIcon expanded={false} />}
      </div>
      {rowExpanded && hasResult && <div className="mt-1 pl-5 text-slate-500 whitespace-pre-wrap">{event.detail}</div>}
    </button>
  );
}

/* ── Collapsible tools section (tools collapse independently, stdout stays visible) ── */

function ToolsSection({
  toolUses,
  toolResults,
  lastToolId,
  status,
  onUserInteract,
}: {
  toolUses: CliEvent[];
  toolResults: CliEvent[];
  lastToolId: string | undefined;
  status: CliStatus;
  onUserInteract: () => void;
}) {
  // streaming 时展开看进度，done/failed 时自动折叠成一行
  const isStreaming = status === 'streaming';
  const [toolsExpanded, setToolsExpanded] = useState(isStreaming);
  const toolsUserInteracted = useRef(false);

  // streaming → done：自动折叠（除非用户手动展开过）
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'streaming' && !isStreaming && !toolsUserInteracted.current) {
      setToolsExpanded(false);
    }
    prevStatus.current = status;
  }, [status, isStreaming]);

  // streaming 时强制展开
  if (isStreaming && !toolsExpanded) {
    setToolsExpanded(true);
  }

  const toolSummary = `${toolUses.length} tool${toolUses.length > 1 ? 's' : ''}`;

  return (
    <div className="py-1">
      <button
        type="button"
        data-testid="tools-section-toggle"
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 transition-colors rounded"
        onClick={() => {
          toolsUserInteracted.current = true;
          setToolsExpanded((v) => !v);
          onUserInteract();
        }}
      >
        <ChevronIcon expanded={toolsExpanded} />
        <span>{toolsExpanded ? toolSummary : `${toolSummary} (collapsed)`}</span>
      </button>
      {toolsExpanded && (
        <div className="space-y-0.5">
          {toolUses.map((e, i) => {
            const result = toolResults[i];
            return (
              <ToolRow
                key={e.id}
                event={{ ...e, detail: result?.detail ?? e.detail }}
                isActive={e.id === lastToolId}
                onUserInteract={onUserInteract}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

interface CliOutputBlockProps {
  events: CliEvent[];
  status: CliStatus;
  thinkingMode?: 'debug' | 'play';
  defaultExpanded?: boolean;
  breedColor?: string;
}

export function CliOutputBlock({
  events,
  status,
  thinkingMode,
  defaultExpanded = false,
  breedColor,
}: CliOutputBlockProps) {
  const isExport =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export') === 'true';
  const forceExpanded = status === 'streaming' || isExport;
  const [expanded, setExpanded] = useState(forceExpanded || defaultExpanded);
  const userInteracted = useRef(false);
  const hasMounted = useRef(false);

  // Streaming → always expanded (unless user pinned collapsed, which doesn't make sense for streaming)
  // Done + no user interaction → allow auto-collapse
  if (forceExpanded && !expanded) {
    setExpanded(true);
  }

  // P1-2: auto-collapse when streaming→done and user hasn't interacted
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === 'streaming' && status !== 'streaming' && !userInteracted.current) {
      setExpanded(false);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Notify scroll-dependent UI after DOM commit
  // biome-ignore lint/correctness/useExhaustiveDependencies: expanded is intentional — dispatch on toggle
  useLayoutEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('catcafe:chat-layout-changed'));
    }
  }, [expanded]);

  if (events.length === 0) return null;

  const summary = buildSummary(events, status);
  const toolUses = events.filter((e) => e.kind === 'tool_use');
  const toolResults = events.filter((e) => e.kind === 'tool_result');
  const textEvents = events.filter((e) => e.kind === 'text');
  const lastToolId = status === 'streaming' ? [...events].reverse().find((e) => e.kind === 'tool_use')?.id : undefined;

  const handleToggle = () => {
    userInteracted.current = true;
    setExpanded((v) => !v);
  };

  const darkBg = breedDarkBg(breedColor);
  const dividerBg = breedDividerColor(breedColor);

  return (
    <div className="mt-2 mb-1 rounded-[10px] overflow-hidden" style={{ backgroundColor: darkBg }}>
      {/* Summary / header bar — breed-tinted dark */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-slate-400 hover:brightness-110 transition-colors"
        style={{ backgroundColor: darkBg }}
      >
        <span style={{ color: breedColor || '#7C3AED' }}>
          <ChevronIcon expanded={expanded} />
        </span>
        <span className="font-medium">{summary}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
          {thinkingMode === 'debug' ? (
            <>
              <PawPrint />
              <span>shared</span>
            </>
          ) : (
            <span>private</span>
          )}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div data-testid="cli-output-body" className="text-slate-200 text-xs" style={{ backgroundColor: darkBg }}>
          <div className="h-px" style={{ backgroundColor: dividerBg }} />
          {/* Collapsible tools section */}
          {toolUses.length > 0 && (
            <ToolsSection
              toolUses={toolUses}
              toolResults={toolResults}
              lastToolId={lastToolId}
              status={status}
              onUserInteract={() => {
                userInteracted.current = true;
              }}
            />
          )}

          {/* stdout section — always visible when block is expanded */}
          {textEvents.length > 0 && (
            <>
              {toolUses.length > 0 && (
                <>
                  <div className="h-px mx-0" style={{ backgroundColor: dividerBg }} />
                  <div className="px-3 pt-2 pb-1 font-mono text-[10px] text-slate-600">─── stdout ───</div>
                </>
              )}
              <div className="px-3 py-2 font-mono text-[11px] text-slate-300 leading-relaxed cli-output-md">
                <MarkdownContent content={textEvents.map((e) => e.content).join('\n')} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
