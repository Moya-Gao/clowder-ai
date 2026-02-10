'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { SendIcon } from './icons/SendIcon';
import { LoadingIcon } from './icons/LoadingIcon';
import { AttachIcon } from './icons/AttachIcon';
import { ImagePreview } from './ImagePreview';
import { compressImage } from '@/utils/compressImage';

interface ChatInputProps {
  onSend: (content: string, images?: File[]) => void;
  onStop?: () => void;
  disabled?: boolean;
}

const CAT_OPTIONS = [
  { id: 'opus', label: '@\u5E03\u5076\u732B', desc: 'Opus \u00B7 \u67B6\u6784 & \u5F00\u53D1', insert: '@\u5E03\u5076 ', color: 'text-opus-primary' },
  { id: 'codex', label: '@\u7F05\u56E0\u732B', desc: 'Codex \u00B7 \u5BA1\u67E5 & \u6D4B\u8BD5', insert: '@\u7F05\u56E0 ', color: 'text-codex-primary' },
  { id: 'gemini', label: '@\u6684\u7F57\u732B', desc: 'Gemini \u00B7 \u8BBE\u8BA1 & \u521B\u610F', insert: '@\u6684\u7F57 ', color: 'text-gemini-primary' },
];

const MODE_OPTIONS = [
  { id: 'brainstorm', icon: '\u{1F9E0}', label: '\u5934\u8111\u98CE\u66B4', desc: '/mode brainstorm <\u8BAE\u9898> @\u732B', insert: '/mode brainstorm ' },
  { id: 'debate', icon: '\u2694\uFE0F', label: '\u8FA9\u8BBA', desc: '/mode debate <\u8BAE\u9898> @A @B', insert: '/mode debate ' },
  { id: 'dev-loop', icon: '\uD83D\uDD04', label: '\u5F00\u53D1\u81EA\u95ED\u73AF', desc: '/mode dev-loop @\u5F00\u53D1\u732B @review\u732B <\u9700\u6C42>', insert: '/mode dev-loop ' },
  { id: 'end', icon: '\u23F9', label: '\u7ED3\u675F\u6A21\u5F0F', desc: '/mode end [\u7ED3\u8BBA]', insert: '/mode end ' },
  { id: 'status', icon: '\u{1F4CB}', label: '\u67E5\u770B\u72B6\u6001', desc: '/mode status', insert: '/mode status' },
];

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

export function ChatInput({ onSend, onStop, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [images, setImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMenu = showMentions ? 'mention' : showModeMenu ? 'mode' : null;
  const activeOptions = activeMenu === 'mention' ? CAT_OPTIONS : MODE_OPTIONS;

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed, images.length > 0 ? images : undefined);
      setInput('');
      setImages([]);
      setShowMentions(false);
      setShowModeMenu(false);
    }
  }, [input, disabled, onSend, images]);

  const insertOption = useCallback((text: string) => {
    setInput(text);
    setShowMentions(false);
    setShowModeMenu(false);
    setMentionStart(-1);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(text.length, text.length); }
    }, 0);
  }, []);

  const insertMention = useCallback((option: typeof CAT_OPTIONS[number]) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(textareaRef.current?.selectionStart ?? mentionStart + 1);
    const text = before + option.insert + after;
    setInput(text);
    setShowMentions(false);
    setMentionStart(-1);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, mentionStart]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // /mode autocomplete: triggers when input starts with /mode (or partial /m, /mo, /mod)
    const trimmed = val.trimStart();
    if (/^\/m(o(d(e( .*)?)?)?)?$/i.test(trimmed) && trimmed.length <= 6) {
      setShowModeMenu(true);
      setShowMentions(false);
      setSelectedIdx(0);
      return;
    }
    setShowModeMenu(false);

    // @ mention autocomplete
    const pos = e.target.selectionStart;
    const textBefore = val.slice(0, pos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx >= 0) {
      const fragment = textBefore.slice(atIdx + 1);
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
    if (e.nativeEvent.isComposing) return;

    if (activeMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % activeOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + activeOptions.length) % activeOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (activeMenu === 'mention') {
          insertMention(CAT_OPTIONS[selectedIdx]);
        } else {
          insertOption(MODE_OPTIONS[selectedIdx].insert);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        setShowModeMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const toAdd: File[] = [];
    for (let i = 0; i < files.length && images.length + toAdd.length < 5; i++) {
      toAdd.push(await compressImage(files[i]));
    }
    setImages((prev) => [...prev, ...toAdd].slice(0, 5));
    e.target.value = '';
  }, [images]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleModeClick = useCallback(() => {
    setShowMentions(false);
    setMentionStart(-1);
    setInput('/mode ');
    setShowModeMenu(true);
    setSelectedIdx(0);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(6, 6); }
    }, 0);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!activeMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMentions(false);
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenu]);

  return (
    <div className="border-t border-owner-light bg-owner-bg relative">
      {/* @ Mention autocomplete menu */}
      {showMentions && (
        <div ref={menuRef} className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-64 z-10">
          {CAT_OPTIONS.map((opt, i) => (
            <button key={opt.id} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === selectedIdx ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setSelectedIdx(i)} onMouseDown={(e) => { e.preventDefault(); insertMention(opt); }}>
              <img src={`/avatars/${opt.id}.png`} alt={opt.label} className="w-7 h-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <div className={`text-sm font-semibold ${opt.color}`}>{opt.label}</div>
                <div className="text-xs text-gray-400">{opt.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-300 border-t border-gray-100">{'\u2191\u2193 \u9009\u62E9 \u00B7 Enter \u786E\u8BA4 \u00B7 Esc \u5173\u95ED'}</div>
        </div>
      )}

      {/* /mode autocomplete menu */}
      {showModeMenu && (
        <div ref={menuRef} className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-72 z-10">
          {MODE_OPTIONS.map((opt, i) => (
            <button key={opt.id} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === selectedIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setSelectedIdx(i)} onMouseDown={(e) => { e.preventDefault(); insertOption(opt.insert); }}>
              <span className="text-lg w-7 text-center">{opt.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-700">{opt.label}</div>
                <div className="text-xs text-gray-400 font-mono">{opt.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-300 border-t border-gray-100">{'\u2191\u2193 \u9009\u62E9 \u00B7 Enter \u786E\u8BA4 \u00B7 Esc \u5173\u95ED'}</div>
        </div>
      )}

      <ImagePreview files={images} onRemove={handleRemoveImage} />

      <div className="flex gap-2 items-end p-4 pt-2">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileSelect} />

        {/* Attach button */}
        <button onClick={() => fileInputRef.current?.click()} disabled={disabled || images.length >= 5}
          className="p-3 rounded-xl text-gray-400 hover:text-owner-primary hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Attach images">
          <AttachIcon className="w-5 h-5" />
        </button>

        {/* Mode button */}
        <button onClick={handleModeClick} disabled={disabled}
          className="p-3 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Mode">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
          </svg>
        </button>

        <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={'\u8F93\u5165\u6D88\u606F... (@ \u53EC\u5524\u732B\u732B, /mode \u5207\u6362\u6A21\u5F0F)'}
          className="flex-1 resize-none rounded-xl border border-owner-light bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-owner-primary placeholder:text-gray-400"
          rows={2} disabled={disabled} />

        {disabled && onStop ? (
          <button onClick={onStop} className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors" aria-label="Stop generation">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="4" width="12" height="12" rx="2" /></svg>
          </button>
        ) : (
          <button onClick={handleSend} disabled={disabled || !input.trim()}
            className="p-3 rounded-xl bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
            {disabled ? <LoadingIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
