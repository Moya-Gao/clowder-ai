'use client';

import { useState } from 'react';
import type { ChatMessageMetadata } from '@/stores/chatStore';

export function MetadataBadge({ metadata }: { metadata: ChatMessageMetadata }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="mt-1 text-[10px] text-gray-400 hover:text-gray-500 transition-colors cursor-pointer select-none"
    >
      <span>{metadata.model || 'unknown'} · {metadata.provider || 'unknown'}</span>
      {expanded && metadata.sessionId && (
        <span className="ml-1 text-gray-300">· {metadata.sessionId.slice(0, 12)}...</span>
      )}
    </button>
  );
}
