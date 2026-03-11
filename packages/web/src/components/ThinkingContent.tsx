'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

/** Convert hex to rgba with given opacity */
function breedBg(hex: string | undefined, opacity: number): string {
  if (!hex) return `rgba(148, 130, 180, ${opacity})`; // muted purple fallback
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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

/** Lightweight disclosure row for thinking — breed-tinted light bg, dark text */
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
    <div
      className="mt-1 mb-0.5 rounded-lg overflow-hidden"
      style={{ backgroundColor: breedBg(breedColor, 0.08) }}
    >
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-slate-700 hover:text-slate-900 transition-colors"
      >
        <ThinkingChevron expanded={expanded} color={breedColor} />
        <span className="font-medium">{label}</span>
        {!expanded && <span className="text-slate-500 truncate max-w-[240px]">{preview}</span>}
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-slate-700 leading-relaxed">
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}
