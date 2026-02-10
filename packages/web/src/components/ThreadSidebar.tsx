'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore, type Thread } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { TaskPanel } from './TaskPanel';
import { PawIcon } from './icons/PawIcon';
import { apiFetch, API_URL } from '@/utils/api-client';

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${Math.floor(diff / 86400_000)}天前`;
}

function projectDisplayName(path: string): string {
  if (path === 'default') return '未分类';
  const parts = path.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || path;
}

function getProjectPaths(threads: Thread[]): string[] {
  const paths = new Set<string>();
  for (const t of threads) {
    if (t.projectPath && t.projectPath !== 'default') {
      paths.add(t.projectPath);
    }
  }
  return [...paths].sort();
}

function groupThreadsByProject(threads: Thread[]) {
  const groups = new Map<string, Thread[]>();
  for (const thread of threads) {
    if (thread.id === 'default') continue;
    const key = thread.projectPath;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(thread);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return a.localeCompare(b);
  });
}

// ─── Directory Browser Modal ───

interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface BrowseResult {
  current: string;
  name: string;
  parent: string | null;
  entries: DirEntry[];
}

function DirectoryPickerModal({
  existingProjects,
  onSelect,
  onCancel,
}: {
  existingProjects: string[];
  onSelect: (projectPath: string | undefined) => void;
  onCancel: () => void;
}) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const browseTo = useCallback(async (path?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : '';
      const res = await apiFetch(`/api/projects/browse${params}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to browse');
        return;
      }
      setBrowseData(await res.json());
    } catch {
      setError('无法连接到服务器');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start from server's cwd
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/projects/cwd`);
        if (res.ok) {
          const data = await res.json();
          await browseTo(data.path);
        } else {
          await browseTo();
        }
      } catch {
        await browseTo();
      }
    })();
  }, [browseTo]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cafe-black">选择项目目录</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Quick options: lobby + existing projects */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-1">
          <button
            onClick={() => onSelect(undefined)}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-base">🏠</span>
            <span>大厅 (无项目)</span>
          </button>
          {existingProjects.map((path) => (
            <button
              key={path}
              onClick={() => onSelect(path)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
              title={path}
            >
              <FolderIcon className="text-owner-primary" />
              <span className="truncate font-medium">{projectDisplayName(path)}</span>
              <span className="text-[10px] text-gray-300 ml-auto truncate max-w-[180px]">{path}</span>
            </button>
          ))}
        </div>

        {/* Directory browser */}
        <div className="flex-1 overflow-y-auto">
          {/* Current path bar */}
          {browseData && (
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <FolderIcon className="text-gray-400 flex-shrink-0" />
              <span className="truncate" title={browseData.current}>{browseData.current}</span>
              {/* Select current directory */}
              <button
                onClick={() => onSelect(browseData.current)}
                className="ml-auto flex-shrink-0 px-2.5 py-1 rounded-md bg-owner-primary text-white text-xs hover:bg-owner-dark transition-colors"
              >
                选择此目录
              </button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
          )}
          {error && (
            <div className="text-center py-8 text-sm text-red-400">{error}</div>
          )}

          {browseData && !isLoading && (
            <div className="py-1">
              {/* Go up */}
              {browseData.parent && (
                <button
                  onClick={() => browseTo(browseData.parent!)}
                  className="w-full text-left px-5 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  <span>.. 上级目录</span>
                </button>
              )}

              {browseData.entries.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-300">无子目录</div>
              )}

              {browseData.entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => browseTo(entry.path)}
                  className="w-full text-left px-5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 group"
                >
                  <FolderIcon className="text-gray-400 group-hover:text-owner-primary" />
                  <span className="truncate">{entry.name}</span>
                  <svg className="w-3 h-3 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4V2z" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 ${className ?? ''}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
    </svg>
  );
}

// ─── Main Sidebar ───

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
  } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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
      // Reload full list from server (avoids stale closure)
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
      // Reload full list from server (avoids stale closure)
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

  const handleSelect = useCallback(
    (threadId: string) => {
      if (threadId === currentThreadId) return;
      navigateToThread(threadId);
    },
    [currentThreadId, navigateToThread]
  );

  const toggleProject = useCallback((projectPath: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectPath)) next.delete(projectPath);
      else next.add(projectPath);
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

  const grouped = useMemo(() => groupThreadsByProject(filteredThreads), [filteredThreads]);
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
            />
          )}

          {grouped.map(([projectPath, projectThreads]) => (
            <ProjectGroup
              key={projectPath}
              projectPath={projectPath}
              threads={projectThreads}
              isCollapsed={collapsedProjects.has(projectPath)}
              currentThreadId={currentThreadId}
              onToggle={toggleProject}
              onSelectThread={handleSelect}
              onDeleteThread={handleDelete}
              onRenameThread={handleRename}
            />
          ))}

          {normalizedQuery.length > 0 && grouped.length === 0 && !showDefaultThread && (
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

// ─── Sub-components ───

function ProjectGroup({
  projectPath,
  threads,
  isCollapsed,
  currentThreadId,
  onToggle,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
}: {
  projectPath: string;
  threads: Thread[];
  isCollapsed: boolean;
  currentThreadId: string;
  onToggle: (path: string) => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
}) {
  return (
    <div className="mt-1">
      <button
        onClick={() => onToggle(projectPath)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        title={projectPath === 'default' ? '未分类对话' : projectPath}
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        <span className="text-xs font-medium text-gray-500 truncate">
          {projectDisplayName(projectPath)}
        </span>
        <span className="text-[10px] text-gray-300 flex-shrink-0 ml-auto">
          {threads.length}
        </span>
      </button>

      {!isCollapsed &&
        threads.map((t) => (
          <ThreadItem
            key={t.id}
            id={t.id}
            title={t.title}
            participants={t.participants}
            lastActiveAt={t.lastActiveAt}
            isActive={currentThreadId === t.id}
            onSelect={onSelectThread}
            onDelete={onDeleteThread}
            onRename={onRenameThread}
            indented
          />
        ))}
    </div>
  );
}

function ThreadItem({
  id,
  title,
  participants,
  lastActiveAt,
  isActive,
  onSelect,
  onDelete,
  onRename,
  indented,
}: {
  id: string;
  title: string | null;
  participants: string[];
  lastActiveAt: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void | Promise<void>;
  indented?: boolean;
}) {
  const canDelete = id !== 'default' && onDelete;
  const canRename = id !== 'default' && onRename;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraftTitle(title ?? '');
  }, [title, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const submitRename = useCallback(async () => {
    if (!onRename) return;
    const next = draftTitle.trim();
    if (!next) {
      setDraftTitle(title ?? '');
      setIsEditing(false);
      return;
    }
    if (next === (title ?? '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onRename(id, next);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [onRename, draftTitle, title, id]);

  return (
    <div
      className={`group relative ${indented ? 'pl-7 pr-3' : 'px-3'} py-2.5 border-b border-gray-50 transition-colors cursor-pointer ${
        isActive ? 'bg-owner-bg' : 'hover:bg-gray-50'
      }`}
      onClick={() => onSelect(id)}
    >
      <div className="flex items-center justify-between mb-0.5">
        {isEditing ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitRename();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraftTitle(title ?? '');
                setIsEditing(false);
              }
            }}
            onBlur={() => { void submitRename(); }}
            disabled={isSaving}
            maxLength={200}
            className="text-sm px-1.5 py-0.5 rounded border border-owner-light focus:outline-none focus:border-owner-primary w-full mr-2 disabled:opacity-70"
          />
        ) : (
          <span className={`text-sm truncate ${isActive ? 'font-semibold text-cafe-black' : 'text-gray-700'}`}>
            {title ?? (id === 'default' ? '大厅' : '未命名对话')}
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {canRename && !isEditing && (
            <button
              onMouseDown={(e) => {
                // Prevent focus transfer from input to button, avoids blur/click race flicker.
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-owner-bg transition-all"
              title="重命名对话"
            >
              <svg className="w-3 h-3 text-gray-300 hover:text-owner-primary" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 112.474 2.474l-7.2 7.2a2 2 0 01-.84.49l-2.22.634a.75.75 0 01-.926-.926l.634-2.22a2 2 0 01.49-.84l7.588-7.588zm1.414 1.06a.25.25 0 00-.353 0L11.2 3.36l1.44 1.44.874-.874a.25.25 0 000-.353l-1.086-1.086zM11.58 5.86l-1.44-1.44-6.072 6.072a.5.5 0 00-.123.21l-.303 1.06 1.06-.303a.5.5 0 00.21-.123l6.668-6.668z" />
                <path d="M2.25 13A.75.75 0 013 12.25v-.5a.75.75 0 011.5 0v.5c0 .138.112.25.25.25h8a.75.75 0 010 1.5h-8A1.75 1.75 0 012.25 13z" />
              </svg>
            </button>
          )}
          {id !== 'default' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`${API_URL}/api/export/thread/${id}?format=md`);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-blue-50 transition-all"
              title="导出对话"
            >
              <svg className="w-3 h-3 text-gray-300 hover:text-blue-400" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z" />
                <path d="M7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06l1.97 1.969z" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-all"
              title="删除对话"
            >
              <svg className="w-3 h-3 text-gray-300 hover:text-red-400" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <span className="text-[10px] text-gray-400">
            {formatRelativeTime(lastActiveAt)}
          </span>
        </div>
      </div>
      {participants.length > 0 && (
        <div className="flex gap-1 mt-1">
          {participants.map((catId) => (
            <CatAvatar key={catId} catId={catId} size={16} />
          ))}
        </div>
      )}
      {participants.length === 0 && id !== 'default' && (
        <div className="flex items-center gap-1 mt-1">
          <PawIcon className="w-3 h-3 text-gray-300" />
          <span className="text-[10px] text-gray-300">还没有猫猫加入</span>
        </div>
      )}
    </div>
  );
}
