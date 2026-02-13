'use client';

import { useChatStore, type Thread } from '@/stores/chatStore';
import { getCatStatusType } from './ThreadCatStatus';
import { CatAvatar } from './CatAvatar';

interface MiniThreadSidebarProps {
  onAssignToPane: (threadId: string) => void;
}

/**
 * Collapsed sidebar for split-pane mode (~40px wide).
 * Shows thread icons with status color dots.
 * Click a thread icon to assign it to the currently selected pane.
 */
export function MiniThreadSidebar({ onAssignToPane }: MiniThreadSidebarProps) {
  const { threads, splitPaneThreadIds, getThreadState } = useChatStore();
  const assignedSet = new Set(splitPaneThreadIds);

  // Filter out 'default' and already-assigned threads
  const available = threads.filter(
    (t) => t.id !== 'default' && !assignedSet.has(t.id)
  );
  const assigned = threads.filter(
    (t) => assignedSet.has(t.id)
  );

  return (
    <aside className="w-10 border-r border-owner-light bg-white flex flex-col h-full items-center py-2 gap-1 overflow-y-auto">
      {/* Assigned threads (in panes) */}
      {assigned.map((t) => (
        <MiniThreadIcon key={t.id} thread={t} isInPane getThreadState={getThreadState} />
      ))}

      {assigned.length > 0 && available.length > 0 && (
        <div className="w-5 border-t border-gray-200 my-1" />
      )}

      {/* Available threads (not yet in panes) */}
      {available.map((t) => (
        <MiniThreadIcon
          key={t.id}
          thread={t}
          getThreadState={getThreadState}
          onClick={() => onAssignToPane(t.id)}
        />
      ))}
    </aside>
  );
}

function MiniThreadIcon({
  thread,
  isInPane,
  getThreadState,
  onClick,
}: {
  thread: Thread;
  isInPane?: boolean;
  getThreadState: (id: string) => { catStatuses: Record<string, string>; unreadCount: number };
  onClick?: () => void;
}) {
  const ts = getThreadState(thread.id);
  const status = getCatStatusType(ts.catStatuses);
  const dotColor =
    status === 'error'
      ? 'bg-red-400'
      : status === 'working'
        ? 'bg-amber-400 animate-pulse'
        : status === 'done'
          ? 'bg-green-400'
          : '';

  const firstCat = thread.participants[0];
  const initial = (thread.title ?? thread.id).charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        isInPane
          ? 'bg-owner-bg ring-1 ring-owner-light'
          : 'hover:bg-gray-100'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      title={thread.title ?? thread.id}
    >
      {firstCat ? (
        <CatAvatar catId={firstCat} size={20} />
      ) : (
        <span className="text-xs font-medium text-gray-500">{initial}</span>
      )}
      {dotColor && (
        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
      )}
      {ts.unreadCount > 0 && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-amber-500 text-white rounded-full min-w-[12px] px-0.5 text-center leading-3">
          {ts.unreadCount > 9 ? '9+' : ts.unreadCount}
        </span>
      )}
    </button>
  );
}
