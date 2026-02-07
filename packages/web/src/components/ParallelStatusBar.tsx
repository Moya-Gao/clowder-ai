'use client';

import { useChatStore } from '@/stores/chatStore';

/**
 * Per-cat status display for parallel (ideate) mode.
 * Shows each target cat with a status indicator:
 *   pending → gray pulse, streaming → colored pulse, done → check, error → cross
 */

const CAT_INFO: Record<string, { name: string; bg: string; text: string }> = {
  opus: { name: '布偶猫', bg: 'bg-opus-bg', text: 'text-opus-primary' },
  codex: { name: '缅因猫', bg: 'bg-codex-bg', text: 'text-codex-primary' },
  gemini: { name: '暹罗猫', bg: 'bg-gemini-bg', text: 'text-gemini-primary' },
};

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" />;
    case 'streaming':
      return <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
    case 'done':
      return <span className="text-green-500 text-xs">&#10003;</span>;
    case 'error':
      return <span className="text-red-500 text-xs">&#10007;</span>;
    default:
      return null;
  }
}

export function ParallelStatusBar() {
  const { targetCats, catStatuses } = useChatStore();

  if (targetCats.length === 0) return null;

  return (
    <div className="px-5 py-2.5 bg-gradient-to-r from-opus-bg via-codex-bg to-gemini-bg border-b border-gray-200">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600">独立观点采样中</span>
        {targetCats.map((catId) => {
          const info = CAT_INFO[catId];
          const status = catStatuses[catId] ?? 'pending';
          return (
            <div key={catId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${info?.bg ?? 'bg-gray-100'}`}>
              <StatusDot status={status} />
              <span className={`text-xs font-medium ${info?.text ?? 'text-gray-600'}`}>
                {info?.name ?? catId}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
