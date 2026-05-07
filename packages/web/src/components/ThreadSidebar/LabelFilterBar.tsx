'use client';

import { useEffect, useRef, useState } from 'react';
import { type ThreadLabel } from '@/stores/label-store';

const MAX_INLINE = 5;

interface LabelFilterBarProps {
  labels: ThreadLabel[];
  selectedFilter: string | null;
  onSelect: (filter: string | null) => void;
  uncategorizedCount: number;
}

export function LabelFilterBar({ labels, selectedFilter, onSelect, uncategorizedCount }: LabelFilterBarProps) {
  const [showOverflow, setShowOverflow] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const inlineLabels = labels.slice(0, MAX_INLINE);
  const overflowLabels = labels.slice(MAX_INLINE);

  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  const handleClick = (filter: string | null) => {
    onSelect(selectedFilter === filter ? null : filter);
  };

  if (labels.length === 0 && uncategorizedCount === 0) return null;

  return (
    <div className="px-3 py-1.5 flex items-center gap-1 flex-wrap border-b border-cafe-subtle">
      {uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={() => handleClick('__uncategorized__')}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
            selectedFilter === '__uncategorized__'
              ? 'border-cafe-muted bg-cafe-surface-elevated text-cafe-black'
              : 'border-transparent text-cafe-muted hover:text-cafe-secondary'
          }`}
        >
          未分类 ({uncategorizedCount})
        </button>
      )}
      {inlineLabels.map((label) => (
        <button
          key={label.id}
          type="button"
          onClick={() => handleClick(label.id)}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
            selectedFilter === label.id
              ? 'border-cafe-muted bg-cafe-surface-elevated text-cafe-black'
              : 'border-transparent text-cafe-muted hover:text-cafe-secondary'
          }`}
          title={label.name}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
          <span className="truncate max-w-[60px]">{label.name}</span>
        </button>
      ))}
      {overflowLabels.length > 0 && (
        <div className="relative" ref={overflowRef}>
          <button
            type="button"
            onClick={() => setShowOverflow(!showOverflow)}
            className="text-[10px] px-1 py-0.5 text-cafe-muted hover:text-cafe-secondary"
          >
            ...
          </button>
          {showOverflow && (
            <div className="absolute top-full left-0 mt-1 bg-cafe-surface rounded-lg shadow-lg border border-cafe z-50 py-1 min-w-[120px]">
              {overflowLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    handleClick(label.id);
                    setShowOverflow(false);
                  }}
                  className={`w-full text-left text-[10px] px-2 py-1 flex items-center gap-1.5 hover:bg-cafe-surface-elevated ${
                    selectedFilter === label.id ? 'text-cafe-black font-medium' : 'text-cafe-muted'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="truncate">{label.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {selectedFilter && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-[10px] px-1 py-0.5 text-red-400 hover:text-red-500 ml-auto"
        >
          ✕
        </button>
      )}
    </div>
  );
}
