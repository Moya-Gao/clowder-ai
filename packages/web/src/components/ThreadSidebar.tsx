'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const parts = path.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || path;
}

/** Collect unique project paths from threads */
function getProjectPaths(threads: Thread[]): string[] {
  const paths = new Set<string>();
  for (const t of threads) {
    if (t.projectPath && t.projectPath !== 'default') {
      paths.add(t.projectPath);
    }
  }
  return [...paths].sort();
}

/** Group threads by projectPath, with default thread pulled out */
function groupThreadsByProject(threads: Thread[]) {
  const groups = new Map<string, Thread[]>();

  for (const thread of threads) {
    if (thread.id === 'default') continue;
    const key = thread.projectPath;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(thread);
  }

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
    setThreads,
    setCurrentThread,
    setCurrentProject,
    isLoadingThreads,
    setLoadingThreads,
  } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showProjectPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
        setNewProjectInput('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjectPicker]);

  // Focus input when picker opens
  useEffect(() => {
    if (showProjectPicker) inputRef.current?.focus();
  }, [showProjectPicker]);

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

  const createInProject = useCallback(async (projectPath?: string) => {
    setIsCreating(true);
    setShowProjectPicker(false);
    setNewProjectInput('');
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default-user',
          ...(projectPath ? { projectPath } : {}),
        }),
      });
      if (!res.ok) return;
      const thread: Thread = await res.json();
      setThreads([thread, ...threads]);
      setCurrentThread(thread.id);
      if (projectPath) setCurrentProject(projectPath);
      onThreadSwitch(thread.id);
    } catch {
      // Silently ignore
    } finally {
      setIsCreating(false);
    }
  }, [threads, setThreads, setCurrentThread, setCurrentProject, onThreadSwitch]);

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
  const existingProjects = useMemo(() => getProjectPaths(threads), [threads]);

  return (
    <aside className="w-60 border-r border-owner-light bg-white flex flex-col h-full">
      <div className="p-3 border-b border-owner-light flex items-center justify-between relative">
        <span className="text-sm font-semibold text-cafe-black">对话</span>
        <button
          onClick={() => setShowProjectPicker((v) => !v)}
          disabled={isCreating}
          className="text-xs px-2 py-1 rounded-lg bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 transition-colors"
        >
          {isCreating ? '...' : '+ 新对话'}
        </button>

        {/* Project picker dropdown */}
        {showProjectPicker && (
          <div
            ref={pickerRef}
            className="absolute top-full right-2 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
          >
            <div className="px-3 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              选择项目目录
            </div>

            {/* "No project" option */}
            <button
              onClick={() => createInProject()}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-owner-bg transition-colors flex items-center gap-2"
            >
              <span className="text-gray-400">--</span>
              <span>大厅 (无项目)</span>
            </button>

            {/* Existing projects */}
            {existingProjects.map((path) => (
              <button
                key={path}
                onClick={() => createInProject(path)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-owner-bg transition-colors flex items-center gap-2"
                title={path}
              >
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                </svg>
                <span className="truncate">{projectDisplayName(path)}</span>
              </button>
            ))}

            {/* New project path input */}
            <div className="border-t border-gray-100 px-3 py-2">
              <div className="text-[11px] text-gray-400 mb-1">新目录路径</div>
              <div className="flex gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newProjectInput}
                  onChange={(e) => setNewProjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProjectInput.trim()) {
                      createInProject(newProjectInput.trim());
                    }
                  }}
                  placeholder="/Users/.../project"
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-owner-primary min-w-0"
                />
                <button
                  onClick={() => {
                    if (newProjectInput.trim()) createInProject(newProjectInput.trim());
                  }}
                  disabled={!newProjectInput.trim()}
                  className="text-xs px-2 py-1.5 rounded-md bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}
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
  currentThreadId,
  onToggle,
  onSelectProject,
  onSelectThread,
}: {
  projectPath: string;
  threads: Thread[];
  isCollapsed: boolean;
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
        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
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
