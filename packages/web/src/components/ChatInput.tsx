'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { SendIcon } from './icons/SendIcon';
import { LoadingIcon } from './icons/LoadingIcon';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-owner-light p-4 bg-owner-bg">
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (@ 可召唤猫猫)"
          className="flex-1 resize-none rounded-xl border border-owner-light bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-owner-primary placeholder:text-gray-400"
          rows={2}
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="p-3 rounded-xl bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {disabled ? (
            <LoadingIcon className="w-5 h-5" />
          ) : (
            <SendIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
