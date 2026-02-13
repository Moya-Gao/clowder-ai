'use client';

import { useCallback } from 'react';
import { useChatStore, type Thread } from '@/stores/chatStore';
import { SplitPaneCell, SplitPanePlaceholder } from './SplitPaneCell';
import { MiniThreadSidebar } from './MiniThreadSidebar';
import { ChatInput } from './ChatInput';

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

  /** Assign a thread from the mini sidebar to the currently selected (or first empty) pane */
  const handleAssignToPane = useCallback(
    (threadId: string) => {
      const next = [...splitPaneThreadIds];
      // Find the selected pane index or first empty slot
      const targetIdx = splitPaneTargetId
        ? paneSlots.indexOf(splitPaneTargetId)
        : paneSlots.findIndex((s) => s === null);
      const insertIdx = targetIdx >= 0 ? targetIdx : paneSlots.findIndex((s) => s === null);
      if (insertIdx < 0) return; // All panes full

      // Replace or fill the slot
      while (next.length <= insertIdx) next.push('');
      next[insertIdx] = threadId;
      setSplitPaneThreadIds(next.filter(Boolean));
      setSplitPaneTarget(threadId);
    },
    [splitPaneThreadIds, splitPaneTargetId, paneSlots, setSplitPaneThreadIds, setSplitPaneTarget]
  );

  const isTargetLoading = splitPaneTargetId
    ? getThreadState(splitPaneTargetId).isLoading
    : false;

  return (
    <div className="flex h-screen">
      <MiniThreadSidebar onAssignToPane={handleAssignToPane} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* 2x2 grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
          {paneSlots.map((tid, i) => {
            if (!tid) {
              return (
                <SplitPanePlaceholder
                  key={`empty-${i}`}
                  index={i}
                  isSelected={false}
                  onSelect={() => {}}
                />
              );
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
  );
}
