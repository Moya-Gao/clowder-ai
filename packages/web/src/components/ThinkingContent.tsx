'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

/** Breed-tinted background for thinking block — lighter than CLI block */
function thinkingBg(hex: string | undefined): string {
  if (!hex) return 'rgb(35, 30, 52)';
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  // 20% breed color — visible but lighter than CLI block (30%)
  const base = { r: 22, g: 22, b: 35 };
  const mix = 0.2;
  return `rgb(${Math.round(base.r * (1 - mix) + r * mix)}, ${Math.round(base.g * (1 - mix) + g * mix)}, ${Math.round(base.b * (1 - mix) + b * mix)})`;
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
      style={{ color: color || '#7C3AED', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Collapsible wrapper for thinking content (🧠 Thinking only — CLI output moved to CliOutputBlock) */
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
  // Sync with global UI preference: when defaultExpanded changes, update all blocks
  useEffect(() => {
    setExpanded((isExport && expandInExport) || defaultExpanded);
  }, [isExport, expandInExport, defaultExpanded]);
  // Notify scroll-dependent UI (e.g. "↓ 到最新") after the DOM has updated.
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

  const bg = thinkingBg(breedColor);

  return (
    <div className="mt-1 mb-1 rounded-lg overflow-hidden" style={{ backgroundColor: bg }}>
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-slate-400 hover:text-slate-300 transition-colors"
      >
        <ThinkingChevron expanded={expanded} color={breedColor} />
        <span>{label}</span>
        {!expanded && <span className="text-slate-500 truncate max-w-[200px]">{preview}</span>}
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-slate-300 leading-relaxed">
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}
