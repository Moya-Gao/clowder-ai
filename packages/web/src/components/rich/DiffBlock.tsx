'use client';

import type { RichDiffBlock } from '@/stores/chat-types';

export function DiffBlock({ block }: { block: RichDiffBlock }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-mono text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
        {block.filePath}
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto bg-gray-50 dark:bg-gray-900 whitespace-pre-wrap">
        {block.diff}
      </pre>
    </div>
  );
}
