'use client';

import { useCallback, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';

export interface WorktreeEntry {
  id: string;
  root: string;
  branch: string;
  head: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export interface FileData {
  path: string;
  content: string;
  sha256: string;
  size: number;
  mime: string;
  truncated: boolean;
  binary?: boolean;
}

export interface SearchResult {
  path: string;
  line: number;
  content: string;
  contextBefore: string;
  contextAfter: string;
}

export function useWorkspace() {
  const worktreeId = useChatStore((s) => s.workspaceWorktreeId);
  const openFilePath = useChatStore((s) => s.workspaceOpenFilePath);
  const setWorktreeId = useChatStore((s) => s.setWorkspaceWorktreeId);

  const [worktrees, setWorktrees] = useState<WorktreeEntry[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [file, setFile] = useState<FileData | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch worktrees on mount
  const fetchWorktrees = useCallback(async () => {
    try {
      const res = await apiFetch('/api/workspace/worktrees');
      if (res.ok) {
        const data = await res.json();
        const newList: typeof worktrees = data.worktrees ?? [];
        setWorktrees(newList);
        // Auto-select first worktree if none selected or current was removed
        const currentStillExists = worktreeId && newList.some((w: { id: string }) => w.id === worktreeId);
        if (!currentStillExists && newList.length > 0) {
          setWorktreeId(newList[0].id);
        }
      }
    } catch {
      /* ignore */
    }
  }, [worktreeId, setWorktreeId]);

  useEffect(() => {
    fetchWorktrees();
  }, [fetchWorktrees]);

  // Fetch tree when worktree changes
  const fetchTree = useCallback(
    async (subpath?: string) => {
      if (!worktreeId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ worktreeId, depth: '3' });
        if (subpath) params.set('path', subpath);
        const res = await apiFetch(`/api/workspace/tree?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTree(data.tree ?? []);
        } else {
          setError('Failed to load file tree');
        }
      } catch {
        setError('Failed to load file tree');
      } finally {
        setLoading(false);
      }
    },
    [worktreeId],
  );

  useEffect(() => {
    if (worktreeId) fetchTree();
  }, [worktreeId, fetchTree]);

  // Fetch file content
  const fetchFile = useCallback(
    async (path: string) => {
      if (!worktreeId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ worktreeId, path });
        const res = await apiFetch(`/api/workspace/file?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFile(data);
        } else {
          const data = await res.json().catch(() => ({ error: 'Unknown error' }));
          setError(data.error ?? 'Failed to load file');
        }
      } catch {
        setError('Failed to load file');
      } finally {
        setLoading(false);
      }
    },
    [worktreeId],
  );

  // Load file when openFilePath changes
  useEffect(() => {
    if (openFilePath) fetchFile(openFilePath);
    else setFile(null);
  }, [openFilePath, fetchFile]);

  // Search
  const search = useCallback(
    async (query: string, type: 'content' | 'filename' = 'content') => {
      if (!worktreeId || !query.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch('/api/workspace/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worktreeId, query, type }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [worktreeId],
  );

  return {
    worktrees,
    worktreeId,
    tree,
    file,
    searchResults,
    loading,
    error,
    fetchWorktrees,
    fetchTree,
    fetchFile,
    search,
    setSearchResults,
  };
}
