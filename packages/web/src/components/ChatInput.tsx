'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { AttachIcon } from './icons/AttachIcon';
import { ImagePreview } from './ImagePreview';
import { ChatInputActionButton } from './ChatInputActionButton';
import { ChatInputMenus } from './ChatInputMenus';
import { CAT_OPTIONS, MODE_OPTIONS, detectMenuTrigger, type CatOption } from './chat-input-options';
import { MobileInputToolbar } from './MobileInputToolbar';
import { compressImage } from '@/utils/compressImage';
import type { UploadStatus, WhisperOptions } from '@/hooks/useSendMessage';
import { deriveImageLifecycleStatus, isImageLifecycleBlockingSend } from './chat-input-upload-state';

interface ChatInputProps {
  onSend: (content: string, images?: File[], whisper?: WhisperOptions) => void;
  onStop?: () => void;
  disabled?: boolean;
  hasActiveInvocation?: boolean;
  uploadStatus?: UploadStatus;
  uploadError?: string | null;
}

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

export function ChatInput({
  onSend,
  onStop,
  disabled,
  hasActiveInvocation,
  uploadStatus = 'idle',
  uploadError = null,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [images, setImages] = useState<File[]>([]);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<Set<string>>(new Set());
  const [mobileToolbar, setMobileToolbar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageLifecycleStatus = deriveImageLifecycleStatus(isPreparingImages, uploadStatus);
  const sendTemporarilyDisabled = isImageLifecycleBlockingSend(imageLifecycleStatus);

  const handleTranscript = useCallback((text: string) => {
    setInput((prev) => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + text;
    });
  }, []);

  const activeMenu = showMentions ? 'mention' : showModeMenu ? 'mode' : null;
  const activeOptions = activeMenu === 'mention' ? CAT_OPTIONS : MODE_OPTIONS;

  const handleSend = useCallback(() => {
    if (sendTemporarilyDisabled) return;
    // Block send if whisper mode is on but no recipients selected
    if (whisperMode && whisperTargets.size === 0) return;
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      const whisper = whisperMode && whisperTargets.size > 0
        ? { visibility: 'whisper' as const, whisperTo: [...whisperTargets] }
        : undefined;
      onSend(trimmed, images.length > 0 ? images : undefined, whisper);
      setInput('');
      setImages([]);
      setShowMentions(false);
      setShowModeMenu(false);
      // Keep whisper mode on for consecutive whispers (user can toggle off manually)
    }
  }, [input, disabled, onSend, images, sendTemporarilyDisabled, whisperMode, whisperTargets]);

  const closeMenus = useCallback(() => {
    setShowMentions(false);
    setShowModeMenu(false);
  }, []);

  const insertOption = useCallback((text: string) => {
    setInput(text);
    closeMenus();
    setMentionStart(-1);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(text.length, text.length); }
    }, 0);
  }, [closeMenus]);

  const insertMention = useCallback((option: CatOption) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice(textareaRef.current?.selectionStart ?? mentionStart + 1);
    setInput(before + option.insert + after);
    setShowMentions(false);
    setMentionStart(-1);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, mentionStart]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const trigger = detectMenuTrigger(val, e.target.selectionStart);
    if (trigger?.type === 'mode') {
      setShowModeMenu(true); setShowMentions(false); setSelectedIdx(0);
    } else if (trigger?.type === 'mention') {
      setShowMentions(true); setShowModeMenu(false); setMentionStart(trigger.start); setSelectedIdx(0);
    } else {
      closeMenus();
    }
  }, [closeMenus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (activeMenu) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => (i + 1) % activeOptions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => (i - 1 + activeOptions.length) % activeOptions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (activeMenu === 'mention') insertMention(CAT_OPTIONS[selectedIdx]);
        else insertOption(MODE_OPTIONS[selectedIdx].insert);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeMenus(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsPreparingImages(true);
    try {
      const toAdd: File[] = [];
      for (let i = 0; i < files.length && images.length + toAdd.length < 5; i++) {
        toAdd.push(await compressImage(files[i]));
      }
      setImages((prev) => [...prev, ...toAdd].slice(0, 5));
    } finally {
      setIsPreparingImages(false);
    }
    e.target.value = '';
  }, [images]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setIsPreparingImages(true);
    try {
      const toAdd: File[] = [];
      for (const file of imageFiles) {
        if (images.length + toAdd.length >= 5) break;
        toAdd.push(await compressImage(file));
      }
      setImages((prev) => [...prev, ...toAdd].slice(0, 5));
    } finally {
      setIsPreparingImages(false);
    }
  }, [images]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleWhisperTarget = useCallback((catId: string) => {
    setWhisperTargets((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const handleWhisperToggle = useCallback(() => {
    setWhisperMode((prev) => {
      if (!prev) {
        // Entering whisper mode — auto-select all cats
        setWhisperTargets(new Set(CAT_OPTIONS.map((c) => c.id)));
      }
      return !prev;
    });
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

  // Auto-resize textarea based on content
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const isMobile = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false;
    const maxH = isMobile ? 120 : 200; // ~5 lines mobile, ~8 lines desktop
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [input]);

  useEffect(() => {
    if (!activeMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenus();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeMenu, closeMenus]);

  return (
    <div className="border-t border-owner-light bg-owner-bg relative safe-area-bottom">
      <ChatInputMenus
        showMentions={showMentions} showModeMenu={showModeMenu} selectedIdx={selectedIdx}
        onSelectIdx={setSelectedIdx} onInsertMention={insertMention} onInsertOption={insertOption} menuRef={menuRef}
      />

      {imageLifecycleStatus === 'preparing' && (
        <div className="px-4 pt-2 text-xs text-gray-500" role="status">
          图片处理中，完成后可发送
        </div>
      )}
      {imageLifecycleStatus === 'uploading' && (
        <div className="px-4 pt-2 text-xs text-indigo-500" role="status">
          图片上传中，请稍候...
        </div>
      )}
      {imageLifecycleStatus === 'failed' && uploadError && (
        <div className="px-4 pt-2 text-xs text-red-500" role="alert">
          图片发送失败：{uploadError}
        </div>
      )}

      {whisperMode && (
        <div className="px-4 pt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-amber-600 font-medium">悄悄话发给:</span>
          {CAT_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleWhisperTarget(cat.id)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                whisperTargets.has(cat.id)
                  ? `${cat.color} border-current bg-amber-50 font-medium`
                  : 'text-gray-400 border-gray-200 hover:border-gray-400'
              }`}
            >
              {cat.label.replace('@', '')}
            </button>
          ))}
          {whisperTargets.size === 0 && (
            <span className="text-xs text-red-400">请至少选一只猫猫</span>
          )}
        </div>
      )}

      <ImagePreview files={images} onRemove={handleRemoveImage} />

      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileSelect} />

      {/* Mobile expanded toolbar (above input row) */}
      {mobileToolbar && (
        <MobileInputToolbar
          onAttach={() => fileInputRef.current?.click()}
          onWhisperToggle={handleWhisperToggle}
          onModeClick={handleModeClick}
          onClose={() => setMobileToolbar(false)}
          disabled={disabled}
          sendDisabled={sendTemporarilyDisabled}
          maxImages={images.length >= 5}
          whisperMode={whisperMode}
        />
      )}

      <div className="flex gap-2 items-end p-4 pt-2">
        {/* Mobile: + toggle button */}
        <button onClick={() => setMobileToolbar((v) => !v)}
          className={`p-3 rounded-xl transition-all md:hidden ${
            mobileToolbar
              ? 'text-owner-primary bg-owner-light rotate-45'
              : 'text-gray-400 hover:text-owner-primary hover:bg-white'
          }`} aria-label="展开工具栏">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Desktop: tool buttons always visible */}
        <button onClick={() => fileInputRef.current?.click()} disabled={disabled || sendTemporarilyDisabled || images.length >= 5}
          className="hidden md:block p-3 rounded-xl text-gray-400 hover:text-owner-primary hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Attach images">
          <AttachIcon className="w-5 h-5" />
        </button>

        <button onClick={handleWhisperToggle} disabled={disabled || sendTemporarilyDisabled}
          className={`hidden md:block p-3 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            whisperMode
              ? 'text-amber-500 bg-amber-50 ring-1 ring-amber-300'
              : 'text-gray-400 hover:text-amber-500 hover:bg-white'
          }`} aria-label="Whisper mode" title="悄悄话模式">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </button>

        <button onClick={handleModeClick} disabled={disabled || sendTemporarilyDisabled}
          className="hidden md:block p-3 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Mode">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
          </svg>
        </button>

        <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
          placeholder={whisperMode ? '\u60C4\u60C4\u8BDD...' : '\u8F93\u5165\u6D88\u606F... (@ \u53EC\u5524\u732B\u732B, /mode \u5207\u6362\u6A21\u5F0F)'}
          className={`flex-1 resize-none rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
            whisperMode
              ? 'border-amber-300 bg-amber-50/50 focus:ring-amber-400'
              : 'border-owner-light bg-white focus:ring-owner-primary'
          }`}
          rows={1} disabled={disabled} />

        <ChatInputActionButton
          onTranscript={handleTranscript} onSend={handleSend} onStop={onStop}
          disabled={disabled}
          sendDisabled={sendTemporarilyDisabled}
          hasActiveInvocation={hasActiveInvocation}
          hasText={!!input.trim()}
        />
      </div>
    </div>
  );
}
