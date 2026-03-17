'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

/** F122B AC-B8: Per-cat execution status bar showing which cats are currently active. */
export function ThreadExecutionBar() {
  const activeInvocations = useChatStore((s) => s.activeInvocations);
  const [, setTick] = useState(0);

  // Extract unique active cats from invocations
  const activeCats = Object.values(activeInvocations).reduce(
    (acc, inv) => {
      if (!acc.some((c) => c.catId === inv.catId)) {
        acc.push({ catId: inv.catId, startedAt: inv.startedAt ?? Date.now() });
      }
      return acc;
    },
    [] as Array<{ catId: string; startedAt: number }>,
  );

  // Auto-update elapsed time every second when cats are active
  useEffect(() => {
    if (activeCats.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeCats.length]);

  if (activeCats.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs border-b border-[#9B7EBD]/10">
      <span className="text-gray-400 font-medium shrink-0">执行中</span>
      {activeCats.map(({ catId, startedAt }) => (
        <CatStatusChip key={catId} catId={catId} startedAt={startedAt} />
      ))}
    </div>
  );
}

const CAT_COLORS: Record<string, string> = {
  opus: '#9B7EBD',
  sonnet: '#9B7EBD',
  codex: '#4CAF50',
  gpt52: '#4CAF50',
  gemini: '#E91E63',
};

function CatStatusChip({ catId, startedAt }: { catId: string; startedAt: number }) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const color = CAT_COLORS[catId] ?? '#9B7EBD';

  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/50">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
      <span className="text-gray-600 font-medium">{catId}</span>
      <span className="text-gray-400 tabular-nums">{timeStr}</span>
    </span>
  );
}
