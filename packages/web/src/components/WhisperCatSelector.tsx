'use client';

import { useCallback } from 'react';
import type { CatData } from '@/hooks/useCatData';

interface WhisperCatSelectorProps {
  cats: CatData[];
  selected: Set<string>;
  activeCatIds: Set<string>;
  onToggle: (catId: string) => void;
}

/** F108 Scene 2: Dropdown-style cat selector for whisper mode.
 *  Design spec: colored circle + "品种 · 昵称" + status badge.
 *  Executing cats are grayed out and not selectable. */
export function WhisperCatSelector({ cats, selected, activeCatIds, onToggle }: WhisperCatSelectorProps) {
  return (
    <div className="mx-3 mt-2 rounded-xl border border-cafe/50 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1.5">
        <span className="text-xs font-semibold text-amber-600">选择悄悄话目标：</span>
      </div>
      <div className="px-2 pb-2 space-y-0.5">
        {cats.map((cat) => (
          <CatRow
            key={cat.id}
            cat={cat}
            isActive={activeCatIds.has(cat.id)}
            isSelected={selected.has(cat.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
      {selected.size === 0 && (
        <div className="px-4 pb-2">
          <span className="text-xs text-red-400">请至少选一只猫猫</span>
        </div>
      )}
    </div>
  );
}

function CatRow({
  cat,
  isActive,
  isSelected,
  onToggle,
}: {
  cat: CatData;
  isActive: boolean;
  isSelected: boolean;
  onToggle: (catId: string) => void;
}) {
  const handleClick = useCallback(() => {
    if (!isActive) onToggle(cat.id);
  }, [isActive, cat.id, onToggle]);

  const color = cat.color.primary;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isActive}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'opacity-50 cursor-not-allowed'
          : isSelected
            ? 'bg-amber-50/80 ring-1 ring-amber-200'
            : 'hover:bg-cafe-surface/50'
      }`}
    >
      {/* Colored circle — filled dot when selected, empty ring when not */}
      <span
        className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center ${
          isSelected && !isActive ? '' : 'border-cafe'
        }`}
        style={isSelected && !isActive ? { borderColor: color, backgroundColor: `${color}18` } : undefined}
      >
        {isSelected && !isActive && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
      </span>

      {/* Cat name: "品种 · 昵称" or displayName fallback */}
      <span className={`flex-1 text-left text-sm ${isActive ? 'text-cafe-muted' : 'text-cafe-secondary font-medium'}`}>
        {formatSelectorName(cat)}
      </span>

      {/* Status badge */}
      <span
        className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
          isActive ? 'bg-gray-100 text-cafe-muted' : 'bg-emerald-50 text-emerald-600'
        }`}
      >
        {isActive ? '执行中' : '空闲'}
      </span>
    </button>
  );
}

/** Format as "品种 · 昵称" (e.g. "布偶猫 · 宪宪") matching design spec Scene 2. */
function formatSelectorName(cat: CatData): string {
  const breed = cat.breedDisplayName;
  const nick = cat.nickname || cat.displayName;
  if (breed && nick && breed !== nick) return `${breed} · ${nick}`;
  return cat.displayName;
}
