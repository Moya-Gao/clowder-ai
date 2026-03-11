'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

/* ── Same surface colors as CliOutputBlock — design-aligned ── */
const SURFACE = '#283548';
const SURFACE_INNER = '#243040';

function ThinkingChevron({ expanded, color }: { expanded: boolean; color?: string }) {
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
      className="flex-shrink-0 transition-transform duration-150"
      style={{ color: color || '#94A3B8', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Brain SVG icon — matches design */
function BrainIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 opacity-70"
    >
      <path d="M12 2a5 5 0 0 1 4.9 4 4.5 4.5 0 0 1 2.1 4 5 5 0 0 1-1 6.4V20a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-3.6A5 5 0 0 1 5 10a4.5 4.5 0 0 1 2.1-4A5 5 0 0 1 12 2z" />
      <path d="M12 2v8" />
      <path d="M8 6h8" />
    </svg>
  );
}

/** Collapsible thinking panel — same dark surface as CLI block, with brain SVG */
export function ThinkingContent({
  content,
  className,
  label = 'Thinking',
  defaultExpanded = false,
  expandInExport = true,
  breedColor,
}: {
  content: string;
  className?: string;
  label?: string;
  defaultExpanded?: boolean;
  expandInExport?: boolean;
  breedColor?: string;
}) {
  const isExport =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export') === 'true';
  const shouldExpand = (isExport && expandInExport) || defaultExpanded;
  const [expanded, setExpanded] = useState(shouldExpand);
  const hasMounted = useRef(false);
  useEffect(() => {
    setExpanded((isExport && expandInExport) || defaultExpanded);
  }, [isExport, expandInExport, defaultExpanded]);
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
  const previewLength = 60;
  const preview = content.length > previewLength ? `${content.slice(0, previewLength)}…` : content;
  const accent = breedColor || '#94A3B8';

  return (
    <div className="mt-2 mb-1 rounded-[10px] overflow-hidden" style={{ backgroundColor: SURFACE }}>
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-slate-400 hover:brightness-110 transition-colors"
        style={{ backgroundColor: SURFACE }}
      >
        <span style={{ color: accent }}>
          <ThinkingChevron expanded={expanded} color={accent} />
        </span>
        <BrainIcon />
        <span className="font-medium">{label}</span>
        {!expanded && <span className="text-slate-500 truncate max-w-[240px]">{preview}</span>}
      </button>
      {expanded && (
        <div style={{ backgroundColor: SURFACE_INNER }}>
          <div className="h-px" style={{ backgroundColor: '#334155' }} />
          <div className="px-3 py-2 text-xs text-slate-300 leading-relaxed">
            <MarkdownContent content={content} className={className} />
          </div>
        </div>
      )}
    </div>
  );
}
