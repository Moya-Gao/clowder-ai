'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

/** Collapsible wrapper for thinking content (🧠 Thinking only — CLI output moved to CliOutputBlock) */
export function ThinkingContent({
  content,
  className,
  label = '🧠 Thinking',
  defaultExpanded = false,
  expandInExport = true,
}: {
  content: string;
  className?: string;
  label?: string;
  defaultExpanded?: boolean;
  expandInExport?: boolean;
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

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-1"
      >
        <span
          className="text-[10px]"
          style={{
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
        <div className="border-l-2 border-gray-300 pl-3 opacity-80">
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}
