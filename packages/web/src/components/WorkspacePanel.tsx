'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useChatStore } from '@/stores/chatStore';
import { API_URL, apiFetch } from '@/utils/api-client';
import { CodeViewer } from './workspace/CodeViewer';
import { FileIcon } from './workspace/FileIcons';
import { ResizeHandle } from './workspace/ResizeHandle';
import { WorkspaceTree } from './workspace/WorkspaceTree';

/* ── Search result item ──────────────────────── */
function SearchResultItem({
  path: filePath,
  line,
  content,
  query,
  onClick,
}: {
  path: string;
  line: number;
  content: string;
  query: string;
  onClick: () => void;
}) {
  const fileName = filePath.split('/').pop() ?? filePath;
  const dir = filePath.slice(0, filePath.length - fileName.length);

  const highlighted = useMemo(() => {
    if (!query || !content) return content;
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return content;
    return (
      <>
        {content.slice(0, idx)}
        <mark className="bg-owner-light text-owner-dark rounded px-0.5">{content.slice(idx, idx + query.length)}</mark>
        {content.slice(idx + query.length)}
      </>
    );
  }, [content, query]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 hover:bg-owner-bg/60 transition-colors group"
    >
      <div className="flex items-center gap-1.5">
        <FileIcon name={fileName} />
        <span className="text-xs font-medium text-cafe-black truncate">{fileName}</span>
        {line > 0 && <span className="text-[10px] text-owner-dark/50 font-mono">:{line}</span>}
      </div>
      {dir && <div className="text-[10px] text-gray-400 truncate ml-5">{dir}</div>}
      {content && <div className="text-[10px] text-gray-500 truncate font-mono ml-5 mt-0.5">{highlighted}</div>}
    </button>
  );
}

/* ── SVG micro-icons ─────────────────────────── */
const CloseIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M1 1l8 8M9 1l-8 8" />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-3.5 h-3.5 text-owner-dark/40 flex-shrink-0"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-4 h-4 text-owner-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
      clipRule="evenodd"
    />
  </svg>
);

/* ── Main panel ──────────────────────────────── */
export function WorkspacePanel() {
  const { worktrees, worktreeId, tree, file, searchResults, loading, error, search, setSearchResults, fetchFile } = useWorkspace();

  const setWorktreeId = useChatStore((s) => s.setWorkspaceWorktreeId);
  const setOpenFile = useChatStore((s) => s.setWorkspaceOpenFile);
  const openFilePath = useChatStore((s) => s.workspaceOpenFilePath);
  const scrollToLine = useChatStore((s) => s.workspaceOpenFileLine);
  const setRightPanelMode = useChatStore((s) => s.setRightPanelMode);
  const setPendingChatInsert = useChatStore((s) => s.setPendingChatInsert);
  const currentThreadId = useChatStore((s) => s.currentThreadId);
  const editToken = useChatStore((s) => s.workspaceEditToken);
  const editTokenExpiry = useChatStore((s) => s.workspaceEditTokenExpiry);
  const setEditToken = useChatStore((s) => s.setWorkspaceEditToken);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'content' | 'filename'>('content');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // F063: vertical resize — treeBasis as percentage (20-80)
  const [treeBasis, setTreeBasis] = useState(40);
  const panelRef = useRef<HTMLElement>(null);
  const handleVerticalResize = useCallback((delta: number) => {
    if (!panelRef.current) return;
    const totalHeight = panelRef.current.offsetHeight;
    if (totalHeight === 0) return;
    const pct = (delta / totalHeight) * 100;
    setTreeBasis((prev) => Math.min(80, Math.max(20, prev + pct)));
  }, []);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleFileSelect = useCallback(
    (path: string) => {
      setOpenFile(path);
      setSearchResults([]);
      setEditMode(false);
    },
    [setOpenFile, setSearchResults],
  );

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) search(searchQuery.trim(), searchMode);
    },
    [searchQuery, searchMode, search],
  );

  const handleSearchResultClick = useCallback(
    (path: string, line: number) => {
      setOpenFile(path, line);
      setSearchResults([]);
      setEditMode(false);
    },
    [setOpenFile, setSearchResults],
  );

  const handleCite = useCallback(
    (path: string) => {
      setPendingChatInsert({ threadId: currentThreadId, text: `\`${path}\`` });
    },
    [setPendingChatInsert, currentThreadId],
  );

  const isTokenValid = editToken && editTokenExpiry && editTokenExpiry > Date.now();
  const canEdit = file && !file.binary && !file.truncated;

  const handleToggleEdit = useCallback(async () => {
    // If already editing with a valid token, toggle off
    if (editMode && isTokenValid) {
      setEditMode(false);
      return;
    }
    if (!worktreeId) return;
    setSaveError(null);

    // Get or refresh token (also handles expired-token-while-editing case)
    if (!isTokenValid) {
      try {
        const res = await apiFetch(`${API_URL}/api/workspace/edit-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worktreeId }),
        });
        if (!res.ok) {
          setSaveError('无法获取编辑权限');
          return;
        }
        const data = await res.json();
        setEditToken(data.token, data.expiresIn);
      } catch {
        setSaveError('网络错误');
        return;
      }
    }
    setEditMode(true);
  }, [editMode, worktreeId, isTokenValid, setEditToken]);

  const handleSave = useCallback(
    async (newContent: string) => {
      if (!worktreeId || !openFilePath || !file) return;
      if (!editToken) {
        setSaveError('编辑会话过期，请点击「编辑」按钮刷新权限后重试保存');
        return;
      }
      setSaveError(null);
      try {
        const res = await apiFetch(`${API_URL}/api/workspace/file`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worktreeId,
            path: openFilePath,
            content: newContent,
            baseSha256: file.sha256,
            editSessionToken: editToken,
          }),
        });
        if (res.status === 409) {
          setSaveError('冲突：文件已被修改，请重新加载');
          return;
        }
        if (res.status === 401) {
          setEditToken(null);
          // Keep editMode=true so unsaved edits aren't lost.
          // User can click the edit toggle to re-acquire a token and retry.
          setSaveError('编辑会话过期，请点击「编辑」按钮刷新权限后重试保存');
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          setSaveError(data.error || '保存失败');
          return;
        }
        // Re-fetch file to get new content + sha256
        if (openFilePath) await fetchFile(openFilePath);
      } catch {
        setSaveError('网络错误');
      }
    },
    [worktreeId, openFilePath, file, editToken, setEditToken, fetchFile],
  );

  const currentWorktree = worktrees.find((w) => w.id === worktreeId);

  return (
    <aside
      ref={panelRef}
      className="hidden lg:flex flex-1 min-w-0 border-l border-owner-light bg-cafe-white/95 flex-col overflow-hidden animate-slide-in-right"
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-owner-light flex items-center justify-between bg-owner-bg/50">
        <div className="flex items-center gap-2 min-w-0">
          <MenuIcon />
          <span className="text-sm font-semibold text-cafe-black">Workspace</span>
        </div>
        <button
          type="button"
          onClick={() => setRightPanelMode('status')}
          className="w-6 h-6 flex items-center justify-center rounded-md text-owner-dark/40 hover:text-owner-dark hover:bg-owner-light/60 transition-colors"
          title="切换到状态面板"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Worktree indicator */}
      {currentWorktree && (
        <div className="px-3 py-2 border-b border-owner-light/60 bg-owner-bg/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-xs font-medium text-cafe-black truncate">{currentWorktree.branch}</span>
            <span className="text-[10px] font-mono text-owner-dark/50">{currentWorktree.head}</span>
          </div>
          {worktrees.length > 1 && (
            <select
              value={worktreeId ?? ''}
              onChange={(e) => setWorktreeId(e.target.value || null)}
              className="mt-1.5 w-full text-[10px] border border-owner-light rounded-md px-2 py-1 bg-white/80 text-cafe-black focus:outline-none focus:border-owner-primary"
            >
              {worktrees.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.branch} ({w.head})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="px-3 py-2 border-b border-owner-light/40">
        <div className="flex items-center gap-1.5 bg-white/80 border border-owner-light rounded-lg px-2.5 py-1.5 focus-within:border-owner-primary focus-within:ring-1 focus-within:ring-owner-primary/20 transition-all">
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchMode === 'content' ? '搜索代码内容...' : '搜索文件名...'}
            className="flex-1 text-xs bg-transparent text-cafe-black placeholder:text-owner-dark/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setSearchMode((m) => (m === 'content' ? 'filename' : 'content'))}
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
              searchMode === 'filename'
                ? 'bg-owner-light text-owner-dark'
                : 'text-owner-dark/40 hover:text-owner-dark/60'
            }`}
            title={searchMode === 'content' ? '切换到文件名搜索' : '切换到内容搜索'}
          >
            {searchMode === 'content' ? 'Aa' : 'File'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && <div className="px-3 py-2 text-xs text-red-600 bg-red-50/80 border-b border-red-100">{error}</div>}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="border-b border-owner-light/40 max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] text-owner-dark/50 font-semibold uppercase tracking-wider sticky top-0 bg-cafe-white/95 backdrop-blur-sm">
            {searchResults.length} 个结果
          </div>
          {searchResults.map((r, i) => (
            <SearchResultItem
              key={`${r.path}:${r.line}:${i}`}
              path={r.path}
              line={r.line}
              content={r.content}
              query={searchQuery}
              onClick={() => handleSearchResultClick(r.path, r.line)}
            />
          ))}
        </div>
      )}

      {/* File tree */}
      <WorkspaceTree
        tree={tree}
        loading={loading}
        expandedPaths={expandedPaths}
        toggleExpand={toggleExpand}
        onSelect={handleFileSelect}
        onCite={handleCite}
        selectedPath={openFilePath}
        hasFile={!!file}
        basisPct={treeBasis}
      />

      {/* Vertical resize handle + File viewer */}
      {file && (
        <>
          <ResizeHandle direction="vertical" onResize={handleVerticalResize} onDoubleClick={() => setTreeBasis(40)} />
          <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
            <div className="px-3 py-1.5 bg-[#1E1E24] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon name={openFilePath ?? ''} />
                <span className="text-[11px] text-gray-300 truncate font-mono">{openFilePath}</span>
                {file.size > 0 && (
                  <span className="text-[9px] text-gray-500 font-mono flex-shrink-0">
                    {file.size < 1024 ? `${file.size}B` : `${Math.round(file.size / 1024)}KB`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      editMode
                        ? 'bg-green-600/80 text-white hover:bg-green-500'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    }`}
                    title={editMode ? '退出编辑' : '编辑文件'}
                  >
                    {editMode ? '编辑中' : '编辑'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setOpenFile(null); setEditMode(false); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
                  title="关闭文件"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            {saveError && (
              <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-900/20 border-b border-red-900/30">
                {saveError}
              </div>
            )}
            {file.binary ? (
              file.mime.startsWith('image/') ? (
                <div className="flex-1 flex items-center justify-center bg-[#1E1E24] p-4 overflow-auto">
                  <img
                    src={`${API_URL}/api/workspace/file/raw?worktreeId=${encodeURIComponent(worktreeId ?? '')}&path=${encodeURIComponent(file.path)}`}
                    alt={file.path}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 bg-[#1E1E24] text-gray-500 text-xs">
                  <span className="text-2xl mb-2">📄</span>
                  <p>二进制文件</p>
                  <p className="text-[10px] mt-1">
                    {file.mime} · {Math.round(file.size / 1024)}KB
                  </p>
                </div>
              )
            ) : (
              <CodeViewer content={file.content} mime={file.mime} path={file.path} scrollToLine={scrollToLine} editable={editMode} onSave={handleSave} />
            )}
            {file.truncated && (
              <div className="px-3 py-1.5 text-[10px] text-amber-400 bg-[#1E1E24] border-t border-amber-900/30">
                文件已截断 (超过 1MB)
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
