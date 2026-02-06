'use client';

import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';

const CAT_STYLES: Record<string, {
  bg: string;
  border: string;
  name: string;
  radius: string;
  font?: string;
}> = {
  opus: {
    bg: 'bg-opus-bg',
    border: 'border-opus-light',
    name: '布偶猫',
    radius: 'rounded-2xl rounded-bl-sm',
  },
  codex: {
    bg: 'bg-codex-bg',
    border: 'border-codex-light',
    name: '缅因猫',
    radius: 'rounded-2xl rounded-br-sm',
    font: 'font-mono',
  },
  gemini: {
    bg: 'bg-gemini-bg',
    border: 'border-gemini-light',
    name: '暹罗猫',
    radius: 'rounded-2xl rounded-tr-sm',
  },
};

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const cat = message.catId ? CAT_STYLES[message.catId] : null;

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <div className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-owner-light text-owner-dark rounded-2xl rounded-br-sm px-4 py-3 transition-transform hover:-translate-y-0.5">
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-4 items-end">
      {cat && <CatAvatar catId={message.catId!} size={32} />}
      <div
        className={`max-w-[75%] border px-4 py-3 transition-transform hover:-translate-y-0.5 ${
          cat
            ? `${cat.bg} ${cat.border} ${cat.radius} ${cat.font ?? ''}`
            : 'bg-white border-gray-200 rounded-2xl'
        }`}
      >
        {cat && (
          <div className="text-xs font-semibold mb-1 opacity-60">
            {cat.name}
          </div>
        )}
        <div className={`whitespace-pre-wrap text-sm ${cat?.font ?? ''}`}>
          {message.content}
        </div>
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 rounded-full opacity-50" />
        )}
      </div>
    </div>
  );
}
