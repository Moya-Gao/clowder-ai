'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

/** Breed-tinted semi-transparent background for thinking block */
function thinkingBg(hex: string | undefined): string {
  if (!hex) return 'rgba(30, 27, 46, 0.35)';
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  // Very subtle breed tint — 8% breed color, 92% near-black, at 35% opacity
  const base = { r: 15, g: 17, b: 30 };
  const mix = 0.08;
  const mr = Math.round(base.r * (1 - mix) + r * mix);
  const mg = Math.round(base.g * (1 - mix) + g * mix);
  const mb = Math.round(base.b * (1 - mix) + b * mix);
  return `rgba(${mr}, ${mg}, ${mb}, 0.35)`;
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
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-gray-500 hover:text-gray-400 transition-colors"
      >
        <span
          className="text-[10px]"
          style={{
            color: breedColor || '#7C3AED',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
            transition: 'transform 0.15s',
          }}
        >
          ▶
        </span>
        <span>{label}</span>
        {!expanded && <span className="text-gray-400 truncate max-w-[200px]">{preview}</span>}
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-gray-400 leading-relaxed opacity-80">
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}
