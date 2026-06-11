'use client';

/**
 * F229 PR-A2: ConciergePanel — compact drawer 对话面板
 *
 * Non-modal (INV-7 / micro-spec §4):
 *   - no focus trap (role="dialog" aria-modal="false")
 *   - Esc closes panel
 *   - panelOpen=false → returns null → zero DOM
 *
 * INV-9: fetchThreadId called lazily on first open (guarded in store)
 * Input focus change → inputFocused=true → ballState=listening (INV-4)
 *
 * z-30: same layer as ball (below FloatingPresentationSurface z-[35])
 */

import { useCallback, useEffect, useRef } from 'react';
import { useConciergeStore } from '@/stores/conciergeStore';

export function ConciergePanel() {
  const panelOpen = useConciergeStore((s) => s.panelOpen);
  const setPanelOpen = useConciergeStore((s) => s.setPanelOpen);
  const setInputFocused = useConciergeStore((s) => s.setInputFocused);
  const fetchThreadId = useConciergeStore((s) => s.fetchThreadId);
  const displayName = useConciergeStore((s) => s.displayName);
  const invocationStatus = useConciergeStore((s) => s.invocationStatus);
  const muted = useConciergeStore((s) => s.muted);
  const setMuted = useConciergeStore((s) => s.setMuted);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // INV-9: lazy thread creation on first panel open
  useEffect(() => {
    if (panelOpen) {
      void fetchThreadId();
    }
  }, [panelOpen, fetchThreadId]);

  // Esc closes panel (a11y §4)
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [panelOpen, setPanelOpen]);

  const handleInputFocus = useCallback(() => setInputFocused(true), [setInputFocused]);
  const handleInputBlur = useCallback(() => setInputFocused(false), [setInputFocused]);
  const handleClose = useCallback(() => setPanelOpen(false), [setPanelOpen]);
  // AC-A6: muted toggle — accessible from panel, no need to visit /settings
  const handleMuteToggle = useCallback(() => void setMuted(!muted), [muted, setMuted]);

  // INV-3 variant: panelOpen=false → nothing in DOM
  if (!panelOpen) return null;

  return (
    <div
      role="dialog"
      aria-label={`${displayName} 对话面板`}
      aria-modal="false"
      className={[
        'fixed bottom-20 right-6',
        'z-30',
        'w-80 max-h-[70vh]',
        'flex flex-col',
        'rounded-2xl shadow-xl',
        'bg-white dark:bg-zinc-900',
        'border border-zinc-200 dark:border-zinc-700',
        'overflow-hidden',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex-1">{displayName}</span>
        {invocationStatus === 'error' && (
          <span className="text-xs text-red-500" role="status">
            连接失败
          </span>
        )}
        {/* AC-A6: muted toggle — 设置以外的 muted 切换入口 */}
        <button
          type="button"
          aria-label={muted ? '取消静音' : '静音'}
          onClick={handleMuteToggle}
          title={muted ? '取消静音，召回猫猫球' : '静音，隐藏猫猫球'}
          className={[
            'p-1 rounded',
            muted ? 'text-amber-500 hover:text-amber-700' : 'text-zinc-400 hover:text-zinc-600',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
          ].join(' ')}
        >
          {muted ? '🔔' : '🔕'}
        </button>
        <button
          type="button"
          aria-label="关闭面板"
          onClick={handleClose}
          className={[
            'p-1 rounded',
            'text-zinc-400 hover:text-zinc-600',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
          ].join(' ')}
        >
          ✕
        </button>
      </div>

      {/* Message area — Phase A: placeholder; PR-A3 fills with thread messages */}
      {/* role="region" allows aria-label; aria-live="polite" for quiet updates (§3.2) */}
      <div
        role="region"
        className="flex-1 overflow-y-auto px-4 py-3 min-h-[120px]"
        aria-live="polite"
        aria-label="对话内容"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-4">
          {invocationStatus === 'error' ? '无法加载对话，请重试' : '你好！我是值班前台猫，有什么可以帮你？'}
        </p>
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2">
        <textarea
          ref={inputRef}
          rows={2}
          placeholder="发消息给前台猫…"
          aria-label="消息输入框"
          className={[
            'w-full resize-none text-sm',
            'bg-zinc-50 dark:bg-zinc-800',
            'rounded-lg px-3 py-2',
            'text-zinc-900 dark:text-zinc-100',
            'placeholder-zinc-400',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
            'border border-transparent focus:border-zinc-300',
          ].join(' ')}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />

        {/* Quick action shortcuts (Phase A placeholder buttons — wired in PR-A3) */}
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            aria-label="发送"
            disabled={invocationStatus === 'pending' || invocationStatus === 'in_progress'}
            className={[
              'ml-auto px-3 py-1 rounded-lg text-xs font-medium',
              'bg-blue-500 text-white',
              'hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
            ].join(' ')}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
