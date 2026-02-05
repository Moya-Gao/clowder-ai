'use client';

import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';

const CAT_COLORS: Record<string, { bg: string; border: string; name: string }> = {
  opus: { bg: 'bg-opus-secondary', border: 'border-opus-primary', name: '布偶猫' },
  codex: { bg: 'bg-codex-secondary', border: 'border-codex-primary', name: '缅因猫' },
  gemini: { bg: 'bg-gemini-secondary', border: 'border-gemini-primary', name: '暹罗猫' },
};

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.type === 'user';
  const cat = message.catId ? CAT_COLORS[message.catId] : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'bg-gray-200 text-gray-900'
            : cat
            ? `${cat.bg} border-l-4 ${cat.border}`
            : 'bg-white border border-gray-200'
        }`}
      >
        {!isUser && cat && (
          <div className="text-sm font-medium mb-1 text-gray-600">
            {cat.name}
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
