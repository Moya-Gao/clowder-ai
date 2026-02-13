'use client';

import { useCallback } from 'react';
import { useChatStore, type Thread } from '@/stores/chatStore';
import { SplitPaneCell, SplitPanePlaceholder } from './SplitPaneCell';
import { MiniThreadSidebar } from './MiniThreadSidebar';
import { ChatInput } from './ChatInput';
import { PawIcon } from './icons/PawIcon';

interface SplitPaneViewProps {
  onSend: (content: string, images?: File[], overrideThreadId?: string) => void;
  onStop: () => void;
  /** Switch from split to single mode, focusing the given thread */
  onZoomToThread: (threadId: string) => void;
}

const PANE_COUNT = 4;

/**
 * Split-pane mode: 2x2 grid of mini chat views + mini sidebar + shared input.
 * The shared input bar sends to the currently selected pane (splitPaneTargetId).
 */
export function SplitPaneView({ onSend, onStop, onZoomToThread }: SplitPaneViewProps) {
  const {
    threads,
    splitPaneThreadIds,
    splitPaneTargetId,
    setSplitPaneTarget,
    setSplitPaneThreadIds,
    getThreadState,
  } = useChatStore();

  const threadMap = new Map<string, Thread>();
  for (const t of threads) threadMap.set(t.id, t);

  // Ensure we always have exactly PANE_COUNT slots (pad with empty)
  const paneSlots: (string | null)[] = [];
  for (let i = 0; i < PANE_COUNT; i++) {
    paneSlots.push(splitPaneThreadIds[i] ?? null);
  }

  const handleSelectPane = useCallback(
    (threadId: string) => setSplitPaneTarget(threadId),
    [setSplitPaneTarget]
  );

  const handleDoubleClick = useCallback(
    (threadId: string) => onZoomToThread(threadId),
    [onZoomToThread]
  );

  /** Assign a thread from the mini sidebar to the next empty pane (or replace selected if full) */
  const handleAssignToPane = useCallback(
    (threadId: string) => {
      if (splitPaneThreadIds.includes(threadId)) return; // already in a pane
      const next = [...splitPaneThreadIds];
      const emptyIdx = paneSlots.findIndex((s) => s === null);
      if (emptyIdx >= 0) {
        // Fill the first empty slot
        while (next.length <= emptyIdx) next.push('');
        next[emptyIdx] = threadId;
      } else {
        // All panes full — replace the currently selected pane
        const selectedIdx = splitPaneTargetId ? paneSlots.indexOf(splitPaneTargetId) : 0;
        const idx = selectedIdx >= 0 ? selectedIdx : 0;
        next[idx] = threadId;
      }
      setSplitPaneThreadIds(next.filter(Boolean));
      setSplitPaneTarget(threadId);
    },
    [splitPaneThreadIds, splitPaneTargetId, paneSlots, setSplitPaneThreadIds, setSplitPaneTarget]
  );

  const isTargetLoading = splitPaneTargetId
    ? getThreadState(splitPaneTargetId).isLoading
    : false;

  const handleBackToSingle = useCallback(() => {
    const target = splitPaneTargetId ?? splitPaneThreadIds[0];
    if (target) {
      onZoomToThread(target);
    } else {
      useChatStore.getState().setViewMode('single');
    }
  }, [splitPaneTargetId, splitPaneThreadIds, onZoomToThread]);

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar — always visible in split mode */}
      <header className="flex items-center gap-2 border-b border-owner-light bg-owner-bg px-4 py-2 flex-shrink-0">
        <PawIcon className="w-5 h-5 text-owner-primary" />
        <span className="text-sm font-bold text-cafe-black">Cat Cafe</span>
        <span className="text-xs text-gray-400 ml-1">分屏模式</span>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-400 hidden sm:inline">⌘\ 切换</span>
        <button
          onClick={handleBackToSingle}
          className="px-2.5 py-1 text-xs rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        >
          返回单屏
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <MiniThreadSidebar onAssignToPane={handleAssignToPane} />

        <div className="flex flex-col flex-1 min-w-0">
          {/* 2x2 grid */}
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
          {paneSlots.map((tid, i) => {
            if (!tid) {
              return <SplitPanePlaceholder key={`empty-${i}`} index={i} />;
            }
            const thread = threadMap.get(tid);
            return (
              <SplitPaneCell
                key={tid}
                threadId={tid}
                threadTitle={thread?.title ?? '未命名对话'}
                threadState={getThreadState(tid)}
                isSelected={splitPaneTargetId === tid}
                onSelect={handleSelectPane}
                onDoubleClick={handleDoubleClick}
              />
            );
          })}
        </div>

        {/* Shared input bar */}
        <div className="border-t border-owner-light bg-white px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-gray-400">
              {splitPaneTargetId
                ? `发往: ${threadMap.get(splitPaneTargetId)?.title ?? splitPaneTargetId}`
                : '请选择一个窗格'}
            </span>
          </div>
          <ChatInput
            onSend={(content: string, images?: File[]) => onSend(content, images, splitPaneTargetId ?? undefined)}
            onStop={onStop}
            disabled={isTargetLoading || !splitPaneTargetId}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
