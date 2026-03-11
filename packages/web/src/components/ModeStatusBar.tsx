'use client';

import { useCallback, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { getUserId } from '@/utils/userId';

const MODE_LABELS: Record<string, { icon: string; label: string }> = {
  brainstorm: { icon: '\u{1F9E0}', label: '\u5934\u8111\u98CE\u66B4' },
  debate: { icon: '\u2694\uFE0F', label: '\u8FA9\u8BBA' },
  'dev-loop': { icon: '\uD83D\uDD04', label: '\u5F00\u53D1\u81EA\u95ED\u73AF' },
};

function useElapsed(startedAt: string | undefined): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return '';
  const diffMs = now - new Date(startedAt).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '\u521A\u5F00\u59CB';
  if (mins < 60) return `${mins} \u5206\u949F`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} \u5C0F\u65F6 ${mins % 60} \u5206\u949F`;
}

export function ModeStatusBar() {
  const currentMode = useChatStore((s) => s.currentMode);
  const threadId = useChatStore((s) => s.currentThreadId);
  const setCurrentMode = useChatStore((s) => s.setCurrentMode);
  const addMessage = useChatStore((s) => s.addMessage);
  const [ending, setEnding] = useState(false);
  const elapsed = useElapsed(currentMode?.startedAt);

  const handleEnd = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      const res = await apiFetch(`/api/threads/${encodeURIComponent(threadId)}/mode`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-cat-cafe-user': getUserId(),
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentMode(null);
        addMessage({
          id: `mode-end-${Date.now()}`,
          type: 'system',
          variant: 'info',
          content: `\u6A21\u5F0F\u5DF2\u7ED3\u675F: ${data.ended?.name ?? 'unknown'}`,
          timestamp: Date.now(),
        });
      } else if (res.status === 404) {
        setCurrentMode(null);
      } else {
        addMessage({
          id: `mode-end-err-${Date.now()}`,
          type: 'system',
          variant: 'error',
          content: `\u7ED3\u675F\u6A21\u5F0F\u5931\u8D25 (${res.status})`,
          timestamp: Date.now(),
        });
      }
    } catch {
      addMessage({
        id: `mode-end-err-${Date.now()}`,
        type: 'system',
        variant: 'error',
        content: '\u7ED3\u675F\u6A21\u5F0F\u5931\u8D25\uFF1A\u7F51\u7EDC\u9519\u8BEF',
        timestamp: Date.now(),
      });
    } finally {
      setEnding(false);
    }
  }, [ending, threadId, setCurrentMode, addMessage]);

  if (!currentMode?.config) return null;

  const info = MODE_LABELS[currentMode.name] ?? { icon: '\u{1F504}', label: currentMode.name };
  const cfg = currentMode.config as Record<string, unknown>;
  const topic = currentMode.name === 'dev-loop' ? String(cfg.requirement ?? '...') : String(cfg.topic ?? '...');
  const devLoopPhase =
    currentMode.name === 'dev-loop' && currentMode.state ? (currentMode.state as Record<string, unknown>) : null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950 border-b border-indigo-200 dark:border-indigo-800 text-sm text-indigo-700 dark:text-indigo-300">
      <span>{info.icon}</span>
      <span className="font-medium">{info.label}</span>
      <span className="text-indigo-400 dark:text-indigo-500">&middot;</span>
      <span className="truncate flex-1">{topic}</span>
      {devLoopPhase && (
        <>
          <span className="text-indigo-400 dark:text-indigo-500">&middot;</span>
          <span className="text-xs font-mono whitespace-nowrap">
            {String(devLoopPhase.phase ?? '')}
            {typeof devLoopPhase.iteration === 'number' ? ` (\u7B2C ${devLoopPhase.iteration + 1} \u8F6E)` : ''}
          </span>
        </>
      )}
      {elapsed && (
        <>
          <span className="text-indigo-400 dark:text-indigo-500">&middot;</span>
          <span className="text-xs text-indigo-400 dark:text-indigo-500 whitespace-nowrap">{elapsed}</span>
        </>
      )}
      <button
        onClick={handleEnd}
        disabled={ending}
        className="ml-2 px-2 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-400 disabled:opacity-50 transition-colors"
      >
        {ending ? '\u7ED3\u675F\u4E2D...' : '\u7ED3\u675F'}
      </button>
    </div>
  );
}
