'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

function ThinkingChevron({ expanded, color }: { expanded: boolean; color?: string }) {
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
      className="flex-shrink-0 transition-transform duration-150"
      style={{ color: color || '#94A3B8', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Lightweight disclosure row for thinking content — no heavy card, just inline fold */
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

  return (
    <div className="mt-1 mb-0.5">
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-slate-400 transition-colors"
      >
        <ThinkingChevron expanded={expanded} color={breedColor} />
        <span>{label}</span>
        {!expanded && <span className="text-slate-500/60 truncate max-w-[240px]">{preview}</span>}
      </button>
      {expanded && (
        <div
          className="mt-1 ml-[3px] pl-3 text-xs text-slate-600 leading-relaxed"
          style={{ borderLeft: `2px solid ${breedColor || '#94A3B8'}` }}
        >
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}
