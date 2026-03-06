'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Thread, useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { TaskPanel } from '../TaskPanel';
import { DirectoryPickerModal, type SessionBinding } from './DirectoryPickerModal';
import { SectionGroup } from './SectionGroup';
import { ThreadItem } from './ThreadItem';
import { getProjectPaths, sortAndGroupThreads } from './thread-utils';
import { createToggleWithReconcile } from './toggle-with-reconcile';

interface ThreadSidebarProps {
  /** Called to close the sidebar drawer on mobile */
  onClose?: () => void;
}

export function ThreadSidebar({ onClose }: ThreadSidebarProps) {
  const router = useRouter();
  const {
    threads,
    currentThreadId,
    setThreads,
    setCurrentProject,
    isLoadingThreads,
    setLoadingThreads,
    updateThreadTitle,
    getThreadState,
    threadStates,
  } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [bindWarning, setBindWarning] = useState<string | null>(null);

  // Shared seq maps — created once, cross-referenced between pin/fav toggle instances
  const pinSeqMap = useRef(new Map<string, number>());
  const favSeqMap = useRef(new Map<string, number>());

  // Stable toggle-with-reconcile instances (lazy-init in ref, survive re-renders)
  const pinToggle = useRef<ReturnType<typeof createToggleWithReconcile>>();
  const favToggle = useRef<ReturnType<typeof createToggleWithReconcile>>();
  if (!pinToggle.current) {
    pinToggle.current = createToggleWithReconcile({
      fetch: apiFetch,
      onUpdate: (id, val) => useChatStore.getState().updateThreadPin(id, val),
      field: 'pinned',
      seqMap: pinSeqMap.current,
      siblingSeqMap: favSeqMap.current,
      onUpdateSibling: (id, val) => useChatStore.getState().updateThreadFavorite(id, val),
      siblingField: 'favorited',
    });
  }
  if (!favToggle.current) {
    favToggle.current = createToggleWithReconcile({
      fetch: apiFetch,
      onUpdate: (id, val) => useChatStore.getState().updateThreadFavorite(id, val),
      field: 'favorited',
      seqMap: favSeqMap.current,
      siblingSeqMap: pinSeqMap.current,
      onUpdateSibling: (id, val) => useChatStore.getState().updateThreadPin(id, val),
      siblingField: 'pinned',
    });
  }

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

  const navigateToThread = useCallback(
    (threadId: string) => {
      router.push(threadId === 'default' ? '/' : `/thread/${threadId}`);
    },
    [router],
  );

  const createInProject = useCallback(
    async (projectPath?: string, preferredCats?: string[], sessionBindings?: SessionBinding[]) => {
      setIsCreating(true);
      setShowPicker(false);
      try {
        const res = await apiFetch(`/api/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(projectPath ? { projectPath } : {}),
            ...(preferredCats?.length ? { preferredCats } : {}),
          }),
        });
        if (!res.ok) return;
        const thread: Thread = await res.json();

        // F33: Bind external sessions after thread creation (best-effort, parallel)
        if (sessionBindings?.length) {
          const results = await Promise.allSettled(
            sessionBindings.map(({ catId, cliSessionId }) =>
              apiFetch(`/api/threads/${thread.id}/sessions/${catId}/bind`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cliSessionId }),
              }),
            ),
          );
          const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
          if (failed.length > 0) {
            setBindWarning(`Session 绑定部分失败（${failed.length}/${results.length}），可在 Session 面板重试`);
            setTimeout(() => setBindWarning(null), 6000);
          }
        }

        if (projectPath) setCurrentProject(projectPath);
        navigateToThread(thread.id);
        // Auto-close sidebar on mobile after creating a new conversation
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          onClose?.();
        }
        await loadThreads();
      } catch {
        // Silently ignore
      } finally {
        setIsCreating(false);
      }
    },
    [setCurrentProject, navigateToThread, loadThreads, onClose],
  );

  const handleDelete = useCallback(
    async (threadId: string) => {
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
    },
    [currentThreadId, navigateToThread, loadThreads],
  );

  const handleRename = useCallback(
    async (threadId: string, title: string) => {
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
    },
    [updateThreadTitle],
  );

  const handleTogglePin = useCallback(
    (threadId: string, pinned: boolean) => void pinToggle.current?.toggle(threadId, pinned),
    [],
  );

  const handleToggleFavorite = useCallback(
    (threadId: string, favorited: boolean) => void favToggle.current?.toggle(threadId, favorited),
    [],
  );

  const handleUpdatePreferredCats = useCallback(async (threadId: string, cats: string[]) => {
    const res = await apiFetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredCats: cats }),
    });
    if (!res.ok) throw new Error('保存失败');
    useChatStore.getState().updateThreadPreferredCats(threadId, cats);
  }, []);

  const handleSelect = useCallback(
    (threadId: string) => {
      if (threadId === currentThreadId) return;
      navigateToThread(threadId);
      // Auto-close sidebar on mobile after selecting a thread
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        onClose?.();
      }
    },
    [currentThreadId, navigateToThread, onClose],
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
      const threadId = thread.id.toLowerCase();
      return (
        title.includes(normalizedQuery) ||
        fallback.includes(normalizedQuery) ||
        project.includes(normalizedQuery) ||
        threadId.includes(normalizedQuery)
      );
    });
  }, [threads, normalizedQuery]);

  const unreadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const thread of threads) {
      const ts = threadStates[thread.id];
      if (ts && ts.unreadCount > 0) {
        ids.add(thread.id);
      }
    }
    return ids;
  }, [threads, threadStates]);

  const threadGroups = useMemo(() => sortAndGroupThreads(filteredThreads, unreadIds), [filteredThreads, unreadIds]);
  const existingProjects = useMemo(() => getProjectPaths(threads), [threads]);
  const showDefaultThread = normalizedQuery.length === 0 || '大厅'.includes(normalizedQuery);

  return (
    <>
      <aside className="w-60 border-r border-owner-light bg-white flex flex-col h-full">
        <div className="p-3 border-b border-owner-light flex items-center justify-between">
          <span className="text-sm font-semibold text-cafe-black">对话</span>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={isCreating}
            className="text-xs px-2 py-1 rounded-lg bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 transition-colors"
          >
            {isCreating ? '...' : '+ 新对话'}
          </button>
        </div>

        <div className="px-3 py-2 border-b border-owner-light">
          <button
            type="button"
            onClick={() => {
              const fromParam = currentThreadId ? `?from=${encodeURIComponent(currentThreadId)}` : '';
              router.push(`/mission-hub${fromParam}`);
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                onClose?.();
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-[#D8C6AD] bg-[#FCF7EE] px-2.5 py-1.5 text-left text-xs font-medium text-[#6C563F] transition-colors hover:bg-[#F7EEDB]"
            data-testid="sidebar-mission-control"
          >
            <svg
              className="h-4 w-4 shrink-0 text-[#9A866F]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Mission Hub
          </button>
        </div>

        {bindWarning && (
          <div className="px-3 py-1.5 bg-yellow-50 border-b border-yellow-200 text-[10px] text-yellow-700">
            {bindWarning}
          </div>
        )}

        <div className="px-3 py-2 border-b border-owner-light">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话、项目或 ID..."
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
                    onUpdatePreferredCats={handleUpdatePreferredCats}
                    isPinned={t.pinned}
                    isFavorited={t.favorited}
                    threadState={getThreadState(t.id)}
                    indented={group.type === 'project'}
                    preferredCats={t.preferredCats}
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
