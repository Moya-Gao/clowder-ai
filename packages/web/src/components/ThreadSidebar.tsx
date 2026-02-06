'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatStore, type Thread } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { PawIcon } from './icons/PawIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface ThreadSidebarProps {
  onThreadSwitch: (threadId: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${Math.floor(diff / 86400_000)}天前`;
}

/** Extract display name from a project path */
function projectDisplayName(path: string): string {
  if (path === 'default') return '未分类';
  // Take the last directory component
  const parts = path.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || path;
}

/** Group threads by projectPath, with default thread pulled out */
function groupThreadsByProject(threads: Thread[]) {
  const groups = new Map<string, Thread[]>();

  for (const thread of threads) {
    if (thread.id === 'default') continue; // handled separately
    const key = thread.projectPath;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(thread);
  }

  // Sort groups: non-default projects first (alphabetically), 'default' last
  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return a.localeCompare(b);
  });

  return sorted;
}

export function ThreadSidebar({ onThreadSwitch }: ThreadSidebarProps) {
  const {
    threads,
    currentThreadId,
    currentProjectPath,
    setThreads,
    setCurrentThread,
    setCurrentProject,
    isLoadingThreads,
    setLoadingThreads,
  } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch(`${API_URL}/api/threads?userId=default-user`);
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

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default-user',
          ...(currentProjectPath !== 'default' ? { projectPath: currentProjectPath } : {}),
        }),
      });
      if (!res.ok) return;
      const thread: Thread = await res.json();
      setThreads([thread, ...threads]);
      setCurrentThread(thread.id);
      onThreadSwitch(thread.id);
    } catch {
      // Silently ignore
    } finally {
      setIsCreating(false);
    }
  }, [threads, currentProjectPath, setThreads, setCurrentThread, onThreadSwitch]);

  const handleSelect = useCallback(
    (threadId: string) => {
      if (threadId === currentThreadId) return;
      setCurrentThread(threadId);
      onThreadSwitch(threadId);
    },
    [currentThreadId, setCurrentThread, onThreadSwitch]
  );

  const toggleProject = useCallback((projectPath: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectPath)) next.delete(projectPath);
      else next.add(projectPath);
      return next;
    });
  }, []);

  const selectProject = useCallback(
    (projectPath: string) => {
      setCurrentProject(projectPath);
    },
    [setCurrentProject]
  );

  const grouped = useMemo(() => groupThreadsByProject(threads), [threads]);

  return (
    <aside className="w-60 border-r border-owner-light bg-white flex flex-col h-full">
      <div className="p-3 border-b border-owner-light flex items-center justify-between">
        <span className="text-sm font-semibold text-cafe-black">对话</span>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="text-xs px-2 py-1 rounded-lg bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 transition-colors"
        >
          {isCreating ? '...' : '+ 新对话'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingThreads && threads.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-400">加载中...</div>
        )}

        {/* Default thread (lobby) always at top */}
        <ThreadItem
          id="default"
          title="大厅"
          participants={[]}
          lastActiveAt={Date.now()}
          isActive={currentThreadId === 'default'}
          onSelect={handleSelect}
        />

        {/* Project groups */}
        {grouped.map(([projectPath, projectThreads]) => (
          <ProjectGroup
            key={projectPath}
            projectPath={projectPath}
            threads={projectThreads}
            isCollapsed={collapsedProjects.has(projectPath)}
            isSelectedProject={currentProjectPath === projectPath}
            currentThreadId={currentThreadId}
            onToggle={toggleProject}
            onSelectProject={selectProject}
            onSelectThread={handleSelect}
          />
        ))}
      </div>
    </aside>
  );
}

function ProjectGroup({
  projectPath,
  threads,
  isCollapsed,
  isSelectedProject,
  currentThreadId,
  onToggle,
  onSelectProject,
  onSelectThread,
}: {
  projectPath: string;
  threads: Thread[];
  isCollapsed: boolean;
  isSelectedProject: boolean;
  currentThreadId: string;
  onToggle: (path: string) => void;
  onSelectProject: (path: string) => void;
  onSelectThread: (threadId: string) => void;
}) {
  return (
    <div className="mt-1">
      <button
        onClick={() => {
          onToggle(projectPath);
          onSelectProject(projectPath);
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 transition-colors ${
          isSelectedProject ? 'bg-gray-50' : ''
        }`}
        title={projectPath === 'default' ? '未分类对话' : projectPath}
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${
            isCollapsed ? '' : 'rotate-90'
          }`}
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
  indented,
}: {
  id: string;
  title: string | null;
  participants: string[];
  lastActiveAt: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  indented?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full text-left ${indented ? 'pl-7 pr-3' : 'px-3'} py-2.5 border-b border-gray-50 transition-colors ${
        isActive ? 'bg-owner-bg' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-sm truncate ${isActive ? 'font-semibold text-cafe-black' : 'text-gray-700'}`}>
          {title ?? (id === 'default' ? '大厅' : '未命名对话')}
        </span>
        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
          {formatRelativeTime(lastActiveAt)}
        </span>
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
    </button>
  );
}
