'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore, type Thread } from '@/stores/chatStore';
import { TaskPanel } from '../TaskPanel';
import { apiFetch } from '@/utils/api-client';
import { ThreadItem } from './ThreadItem';
import { DirectoryPickerModal } from './DirectoryPickerModal';
import { getProjectPaths, sortAndGroupThreads } from './thread-utils';

export function ThreadSidebar() {
  const router = useRouter();
  const {
    threads,
    currentThreadId,
    setThreads,
    setCurrentProject,
    isLoadingThreads,
    setLoadingThreads,
    updateThreadTitle,
    updateThreadPin,
    updateThreadFavorite,
    getThreadState,
  } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Per-thread request sequence counters to prevent stale response overwrites
  const pinSeqRef = useRef<Map<string, number>>(new Map());
  const favSeqRef = useRef<Map<string, number>>(new Map());

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await apiFetch('/api/threads');
      if (!res.ok) return;
      const data = await res.json();
      setThreads(data.threads ?? []);
    } catch {
      // Silently ignore
    } finally {
      setLoadingThreads(false);
    }
  }, [setThreads, setLoadingThreads]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const navigateToThread = useCallback((threadId: string) => {
    router.push(threadId === 'default' ? '/' : `/thread/${threadId}`);
  }, [router]);

  const createInProject = useCallback(async (projectPath?: string) => {
    setIsCreating(true);
    setShowPicker(false);
    try {
      const res = await apiFetch(`/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(projectPath ? { projectPath } : {}),
        }),
      });
      if (!res.ok) return;
      const thread: Thread = await res.json();
      if (projectPath) setCurrentProject(projectPath);
      navigateToThread(thread.id);
      await loadThreads();
    } catch {
      // Silently ignore
    } finally {
      setIsCreating(false);
    }
  }, [setCurrentProject, navigateToThread, loadThreads]);

  const handleDelete = useCallback(async (threadId: string) => {
    try {
      const res = await apiFetch(`/api/threads/${threadId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) return;
      if (threadId === currentThreadId) {
        navigateToThread('default');
      }
      await loadThreads();
    } catch {
      // Silently ignore
    }
  }, [currentThreadId, navigateToThread, loadThreads]);

  const handleRename = useCallback(async (threadId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    try {
      const res = await apiFetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      updateThreadTitle(threadId, updated.title ?? nextTitle);
    } catch {
      // Silently ignore
    }
  }, [updateThreadTitle]);

  /** Reconcile pin/fav state from server. Only applies if seq refs haven't moved. */
  const reconcileThread = useCallback(async (
    threadId: string,
    expectedPinSeq: number,
    expectedFavSeq: number,
  ) => {
    try {
      const res = await apiFetch(`/api/threads/${threadId}`);
      if (!res.ok) return;
      const t = await res.json();
      // Only apply if no newer request has been issued since reconcile was triggered
      if (t.pinned !== undefined && pinSeqRef.current.get(threadId) === expectedPinSeq) {
        updateThreadPin(threadId, t.pinned);
      }
      if (t.favorited !== undefined && favSeqRef.current.get(threadId) === expectedFavSeq) {
        updateThreadFavorite(threadId, t.favorited);
      }
    } catch {
      // best-effort
    }
  }, [updateThreadPin, updateThreadFavorite]);

  const handleTogglePin = useCallback(async (threadId: string, pinned: boolean) => {
    const seq = (pinSeqRef.current.get(threadId) ?? 0) + 1;
    pinSeqRef.current.set(threadId, seq);
    const favSeq = favSeqRef.current.get(threadId) ?? 0;
    try {
      const res = await apiFetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) {
        // Request failed — reconcile with server to avoid drift
        if (pinSeqRef.current.get(threadId) === seq) {
          void reconcileThread(threadId, seq, favSeq);
        }
        return;
      }
      // Only apply if this is still the latest request for this thread
      if (pinSeqRef.current.get(threadId) !== seq) return;
      const updated = await res.json();
      updateThreadPin(threadId, updated.pinned ?? pinned);
    } catch {
      if (pinSeqRef.current.get(threadId) === seq) {
        void reconcileThread(threadId, seq, favSeq);
      }
    }
  }, [updateThreadPin, reconcileThread]);

  const handleToggleFavorite = useCallback(async (threadId: string, favorited: boolean) => {
    const seq = (favSeqRef.current.get(threadId) ?? 0) + 1;
    favSeqRef.current.set(threadId, seq);
    const pinSeq = pinSeqRef.current.get(threadId) ?? 0;
    try {
      const res = await apiFetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited }),
      });
      if (!res.ok) {
        // Request failed — reconcile with server to avoid drift
        if (favSeqRef.current.get(threadId) === seq) {
          void reconcileThread(threadId, pinSeq, seq);
        }
        return;
      }
      // Only apply if this is still the latest request for this thread
      if (favSeqRef.current.get(threadId) !== seq) return;
      const updated = await res.json();
      updateThreadFavorite(threadId, updated.favorited ?? favorited);
    } catch {
      if (favSeqRef.current.get(threadId) === seq) {
        void reconcileThread(threadId, pinSeq, seq);
      }
    }
  }, [updateThreadFavorite, reconcileThread]);

  const handleSelect = useCallback(
    (threadId: string) => {
      if (threadId === currentThreadId) return;
      navigateToThread(threadId);
    },
    [currentThreadId, navigateToThread]
  );

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    if (!normalizedQuery) return threads;
    return threads.filter((thread) => {
      const title = (thread.title ?? '').toLowerCase();
      const fallback = (thread.id === 'default' ? '大厅' : '未命名对话').toLowerCase();
      const project = (thread.projectPath ?? '').toLowerCase();
      return (
        title.includes(normalizedQuery) ||
        fallback.includes(normalizedQuery) ||
        project.includes(normalizedQuery)
      );
    });
  }, [threads, normalizedQuery]);

  const threadGroups = useMemo(() => sortAndGroupThreads(filteredThreads), [filteredThreads]);
  const existingProjects = useMemo(() => getProjectPaths(threads), [threads]);
  const showDefaultThread = normalizedQuery.length === 0 || '大厅'.includes(normalizedQuery);

  return (
    <>
      <aside className="w-60 border-r border-owner-light bg-white flex flex-col h-full">
        <div className="p-3 border-b border-owner-light flex items-center justify-between">
          <span className="text-sm font-semibold text-cafe-black">对话</span>
          <button
            onClick={() => setShowPicker(true)}
            disabled={isCreating}
            className="text-xs px-2 py-1 rounded-lg bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 transition-colors"
          >
            {isCreating ? '...' : '+ 新对话'}
          </button>
        </div>

        <div className="px-3 py-2 border-b border-owner-light">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话或项目..."
            className="w-full rounded-lg border border-owner-light px-2.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-owner-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingThreads && threads.length === 0 && (
            <div className="text-center py-4 text-xs text-gray-400">加载中...</div>
          )}

          {showDefaultThread && (
            <ThreadItem
              id="default"
              title="大厅"
              participants={[]}
              lastActiveAt={Date.now()}
              isActive={currentThreadId === 'default'}
              onSelect={handleSelect}
              threadState={getThreadState('default')}
            />
          )}

          {threadGroups.map((group) => {
            const groupKey = group.projectPath ?? group.type;
            const isCollapsed = collapsedGroups.has(groupKey);

            return (
              <SectionGroup
                key={groupKey}
                label={group.label}
                icon={group.type === 'pinned' ? 'pin' : group.type === 'favorites' ? 'star' : undefined}
                count={group.threads.length}
                isCollapsed={isCollapsed}
                onToggle={() => toggleGroup(groupKey)}
                projectPath={group.projectPath}
              >
                {group.threads.map((t) => (
                  <ThreadItem
                    key={t.id}
                    id={t.id}
                    title={t.title}
                    participants={t.participants}
                    lastActiveAt={t.lastActiveAt}
                    isActive={currentThreadId === t.id}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onTogglePin={handleTogglePin}
                    onToggleFavorite={handleToggleFavorite}
                    isPinned={t.pinned}
                    isFavorited={t.favorited}
                    threadState={getThreadState(t.id)}
                    indented={group.type === 'project'}
                  />
                ))}
              </SectionGroup>
            );
          })}

          {normalizedQuery.length > 0 && threadGroups.length === 0 && !showDefaultThread && (
            <div className="px-3 py-4 text-xs text-gray-400">没有匹配的对话</div>
          )}
        </div>

        <TaskPanel />
      </aside>

      {showPicker && (
        <DirectoryPickerModal
          existingProjects={existingProjects}
          onSelect={createInProject}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ─── Section Group (replaces ProjectGroup) ───

function SectionGroup({
  label,
  icon,
  count,
  isCollapsed,
  onToggle,
  projectPath,
  children,
}: {
  label: string;
  icon?: 'pin' | 'star';
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  projectPath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        title={projectPath && projectPath !== 'default' ? projectPath : undefined}
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        {icon === 'pin' && (
          <svg className="w-3 h-3 text-owner-primary flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.456 2.013a.75.75 0 011.06-.034l6.5 6a.75.75 0 01-.034 1.06l-1.99 1.838.637 3.22a.75.75 0 01-1.196.693L6.5 12.526l-2.933 2.264a.75.75 0 01-1.196-.693l.637-3.22-1.99-1.838a.75.75 0 01-.034-1.06l5.472-5.966z" />
          </svg>
        )}
        {icon === 'star' && (
          <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1.5l2.09 4.26 4.71.68-3.41 3.32.8 4.69L8 12.26l-4.19 2.19.8-4.69L1.2 6.44l4.71-.68L8 1.5z" />
          </svg>
        )}
        <span className="text-xs font-medium text-gray-500 truncate">
          {label}
        </span>
        <span className="text-[10px] text-gray-300 flex-shrink-0 ml-auto">
          {count}
        </span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}
