'use client';

import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup, EditorView } from 'codemirror';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type TreeNode, useWorkspace } from '@/hooks/useWorkspace';
import { useChatStore } from '@/stores/chatStore';

function getLanguageExtension(mime: string, path: string) {
  if (mime === 'text/typescript' || mime === 'text/tsx' || path.endsWith('.ts') || path.endsWith('.tsx'))
    return javascript({ typescript: true, jsx: path.endsWith('x') });
  if (mime === 'text/javascript' || mime === 'text/jsx' || path.endsWith('.js') || path.endsWith('.jsx'))
    return javascript({ jsx: path.endsWith('x') });
  if (mime === 'application/json' || path.endsWith('.json')) return json();
  if (mime === 'text/markdown' || path.endsWith('.md')) return markdown();
  if (mime === 'text/css' || path.endsWith('.css')) return css();
  if (mime === 'text/html' || path.endsWith('.html')) return html();
  return javascript({ typescript: true });
}

/* ── Tree item ───────────────────── */
function TreeItem({
  node,
  depth,
  onSelect,
  expandedPaths,
  toggleExpand,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
}) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);

  return (
    <div>
      <button
        onClick={() => (isDir ? toggleExpand(node.path) : onSelect(node.path))}
        className="w-full text-left px-1 py-0.5 text-xs hover:bg-gray-100 rounded flex items-center gap-1 truncate"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={node.path}
      >
        <span className="w-4 text-center flex-shrink-0">{isDir ? (isExpanded ? '▼' : '▶') : ''}</span>
        <span className="flex-shrink-0">{isDir ? '📂' : '📄'}</span>
        <span className="truncate">{node.name}</span>
      </button>
      {isDir &&
        isExpanded &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            expandedPaths={expandedPaths}
            toggleExpand={toggleExpand}
          />
        ))}
    </div>
  );
}

/* ── CodeMirror viewer ───────────── */
function CodeViewer({
  content,
  mime,
  path,
  scrollToLine,
}: {
  content: string;
  mime: string;
  path: string;
  scrollToLine: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous
    viewRef.current?.destroy();

    const lang = getLanguageExtension(mime, path);
    const state = EditorState.create({
      doc: content,
      extensions: [basicSetup, lang, oneDark, EditorView.editable.of(false), EditorState.readOnly.of(true)],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    // Scroll to line if specified
    if (scrollToLine && scrollToLine > 0) {
      const line = Math.min(scrollToLine, view.state.doc.lines);
      const lineInfo = view.state.doc.line(line);
      view.dispatch({
        effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
      });
    }

    return () => {
      view.destroy();
    };
  }, [content, mime, path, scrollToLine]);

  return <div ref={containerRef} className="flex-1 overflow-auto text-sm" />;
}

/* ── Main panel ──────────────────── */
export function WorkspacePanel() {
  const { worktrees, worktreeId, tree, file, searchResults, loading, error, search, setSearchResults } = useWorkspace();

  const setWorktreeId = useChatStore((s) => s.setWorkspaceWorktreeId);
  const setOpenFile = useChatStore((s) => s.setWorkspaceOpenFile);
  const openFilePath = useChatStore((s) => s.workspaceOpenFilePath);
  const scrollToLine = useChatStore((s) => s.workspaceOpenFileLine);
  const setRightPanelMode = useChatStore((s) => s.setRightPanelMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'content' | 'filename'>('content');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

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
    },
    [setOpenFile, setSearchResults],
  );

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        search(searchQuery.trim(), searchMode);
      }
    },
    [searchQuery, searchMode, search],
  );

  const handleSearchResultClick = useCallback(
    (path: string, line: number) => {
      setOpenFile(path, line);
      setSearchResults([]);
    },
    [setOpenFile, setSearchResults],
  );

  const currentWorktree = worktrees.find((w) => w.id === worktreeId);

  return (
    <aside className="hidden lg:flex w-80 border-l border-owner-light bg-white/95 flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-700">Workspace</span>
          {currentWorktree && (
            <span
              className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded truncate max-w-[120px]"
              title={currentWorktree.branch}
            >
              {currentWorktree.branch}
            </span>
          )}
        </div>
        <button
          onClick={() => setRightPanelMode('status')}
          className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100"
          title="切换到状态面板"
        >
          ✕
        </button>
      </div>

      {/* Worktree selector (if multiple) */}
      {worktrees.length > 1 && (
        <div className="px-3 py-1.5 border-b border-gray-100">
          <select
            value={worktreeId ?? ''}
            onChange={(e) => setWorktreeId(e.target.value || null)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            {worktrees.map((w) => (
              <option key={w.id} value={w.id}>
                {w.branch} ({w.id})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="px-3 py-2 border-b border-gray-100 flex gap-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchMode === 'content' ? '搜索内容...' : '搜索文件名...'}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setSearchMode((m) => (m === 'content' ? 'filename' : 'content'))}
          className="text-[10px] px-1.5 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500"
          title={searchMode === 'content' ? '切换到文件名搜索' : '切换到内容搜索'}
        >
          {searchMode === 'content' ? 'Aa' : '📄'}
        </button>
        <button type="submit" className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600">
          🔍
        </button>
      </form>

      {/* Error */}
      {error && <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50">{error}</div>}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="border-b border-gray-100 max-h-48 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] text-gray-400 font-semibold">搜索结果 ({searchResults.length})</div>
          {searchResults.map((r, i) => (
            <button
              key={`${r.path}:${r.line}:${i}`}
              onClick={() => handleSearchResultClick(r.path, r.line)}
              className="w-full text-left px-3 py-1 text-xs hover:bg-blue-50 border-b border-gray-50"
            >
              <div className="text-blue-600 truncate">
                {r.path}:{r.line}
              </div>
              <div className="text-gray-500 truncate font-mono text-[10px]">{r.content}</div>
            </button>
          ))}
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1 min-h-0" style={{ maxHeight: file ? '40%' : undefined }}>
        {loading && tree.length === 0 ? (
          <div className="text-xs text-gray-400 p-3">加载中...</div>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              onSelect={handleFileSelect}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>

      {/* File viewer */}
      {file && (
        <div className="flex-1 flex flex-col border-t border-gray-200 min-h-0">
          <div className="px-3 py-1.5 bg-gray-800 text-gray-300 text-[10px] flex items-center justify-between">
            <span className="truncate font-mono">{openFilePath}</span>
            <button
              onClick={() => setOpenFile(null)}
              className="text-gray-400 hover:text-white ml-2 flex-shrink-0"
              title="关闭文件"
            >
              ✕
            </button>
          </div>
          {file.binary ? (
            <div className="p-4 text-xs text-gray-500 text-center">
              二进制文件 ({file.mime}, {Math.round(file.size / 1024)}KB)
            </div>
          ) : (
            <CodeViewer content={file.content} mime={file.mime} path={file.path} scrollToLine={scrollToLine} />
          )}
          {file.truncated && (
            <div className="px-3 py-1 text-[10px] text-amber-600 bg-amber-50 border-t border-amber-200">
              文件已截断 (超过 1MB)
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
