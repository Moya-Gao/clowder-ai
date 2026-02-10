'use client';

import { useChatStore } from '@/stores/chatStore';

const MODE_LABELS: Record<string, { icon: string; label: string }> = {
  brainstorm: { icon: '🧠', label: '头脑风暴' },
  debate: { icon: '⚔️', label: '辩论' },
};

export function ModeStatusBar() {
  const currentMode = useChatStore((s) => s.currentMode);

  if (!currentMode?.config) return null;

  const info = MODE_LABELS[currentMode.name] ?? { icon: '🔄', label: currentMode.name };

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950 border-b border-indigo-200 dark:border-indigo-800 text-sm text-indigo-700 dark:text-indigo-300">
      <span>{info.icon}</span>
      <span className="font-medium">{info.label}</span>
      <span className="text-indigo-400 dark:text-indigo-500">·</span>
      <span className="truncate">{String((currentMode.config as Record<string, unknown>).topic ?? '...')}</span>
    </div>
  );
}
