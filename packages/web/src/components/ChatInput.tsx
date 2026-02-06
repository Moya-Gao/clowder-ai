'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { SendIcon } from './icons/SendIcon';
import { LoadingIcon } from './icons/LoadingIcon';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

const CAT_OPTIONS = [
  { id: 'opus', label: '@布偶猫', desc: 'Opus · 架构 & 开发', insert: '@布偶 ', color: 'text-opus-primary' },
  { id: 'codex', label: '@缅因猫', desc: 'Codex · 审查 & 测试', insert: '@缅因 ', color: 'text-codex-primary' },
  { id: 'gemini', label: '@暹罗猫', desc: 'Gemini · 设计 & 创意', insert: '@暹罗 ', color: 'text-gemini-primary' },
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
      setShowMentions(false);
    }
  }, [input, disabled, onSend]);

  const insertMention = useCallback((option: typeof CAT_OPTIONS[number]) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(textareaRef.current?.selectionStart ?? mentionStart + 1);
    setInput(before + option.insert + after);
    setShowMentions(false);
    setMentionStart(-1);
    // Focus back on textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, mentionStart]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const pos = e.target.selectionStart;
    // Check if we just typed @ or are in the middle of @xxx
    const textBefore = val.slice(0, pos);
    const atIdx = textBefore.lastIndexOf('@');

    if (atIdx >= 0) {
      const fragment = textBefore.slice(atIdx + 1);
      // Show menu if @ is at start or preceded by whitespace, and fragment is short
      const charBefore = atIdx > 0 ? val[atIdx - 1] : ' ';
      if (/\s/.test(charBefore!) && fragment.length <= 4 && !/\s/.test(fragment)) {
        setShowMentions(true);
        setMentionStart(atIdx);
        setSelectedIdx(0);
        return;
      }
    }
    setShowMentions(false);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composing guard
    if (e.nativeEvent.isComposing) return;

    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % CAT_OPTIONS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + CAT_OPTIONS.length) % CAT_OPTIONS.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(CAT_OPTIONS[selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close menu on outside click
  useEffect(() => {
    if (!showMentions) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMentions]);

  return (
    <div className="border-t border-owner-light p-4 bg-owner-bg relative">
      {/* @ Mention autocomplete menu */}
      {showMentions && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-64 z-10"
        >
          {CAT_OPTIONS.map((opt, i) => (
            <button
              key={opt.id}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                i === selectedIdx ? 'bg-gray-50' : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setSelectedIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                insertMention(opt);
              }}
            >
              <img
                src={`/avatars/${opt.id}.png`}
                alt={opt.label}
                className="w-7 h-7 rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <div className={`text-sm font-semibold ${opt.color}`}>{opt.label}</div>
                <div className="text-xs text-gray-400">{opt.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-300 border-t border-gray-100">
            ↑↓ 选择 · Enter 确认 · Esc 关闭
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
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
