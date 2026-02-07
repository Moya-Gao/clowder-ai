'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore } from '@/stores/taskStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const HISTORY_PAGE_SIZE = 50;

/**
 * Hook for managing chat history: fetching, pagination, scroll handling.
 * Extracted from ChatContainer to reduce component size.
 */
export function useChatHistory() {
  const {
    messages,
    isLoadingHistory,
    hasMore,
    currentThreadId,
    prependHistory,
    setLoadingHistory,
  } = useChatStore();
  const { setTasks } = useTaskStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Scroll state for prepend handling
  const prevFirstIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  const scrollSnapshotRef = useRef<number | null>(null);

  // Fetch history page from API
  const fetchHistory = useCallback(
    async (cursor?: string, threadId?: string) => {
      if (isLoadingHistory) return;
      setLoadingHistory(true);
      try {
        const tid = threadId ?? currentThreadId;
        const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (cursor) params.set('before', cursor);
        params.set('threadId', tid);
        const res = await fetch(`${API_URL}/api/messages?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const historyMsgs = (data.messages ?? []).map(
          (m: { id: string; type: string; catId?: string; content: string; contentBlocks?: unknown[]; metadata?: { provider: string; model: string; sessionId?: string }; timestamp: number }) => ({
            id: m.id,
            type: m.type as 'user' | 'assistant' | 'system',
            catId: m.catId,
            content: m.content,
            ...(m.contentBlocks ? { contentBlocks: m.contentBlocks } : {}),
            ...(m.metadata ? { metadata: m.metadata } : {}),
            timestamp: m.timestamp,
          } as ChatMessageData)
        );
        prependHistory(historyMsgs, data.hasMore ?? false);
      } catch {
        // Silently ignore fetch errors for history
      } finally {
        setLoadingHistory(false);
      }
    },
    [isLoadingHistory, setLoadingHistory, prependHistory, currentThreadId]
  );

  const fetchTasks = useCallback(async (threadId?: string) => {
    try {
      const tid = threadId ?? currentThreadId;
      const res = await fetch(`${API_URL}/api/tasks?threadId=${encodeURIComponent(tid)}`);
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch { /* ignore */ }
  }, [currentThreadId, setTasks]);

  // Load initial history + tasks on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void fetchHistory();
      void fetchTasks();
    }
  }, [fetchHistory, fetchTasks]);

  // Snapshot scroll height before history load
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isLoadingHistory) {
      scrollSnapshotRef.current = el.scrollHeight;
    }
  }, [isLoadingHistory]);

  // Scroll adjustment after messages change
  useEffect(() => {
    const el = scrollContainerRef.current;
    const prevCount = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;
    const currentFirstId = messages.length > 0 ? messages[0].id : null;

    prevCountRef.current = messages.length;
    prevFirstIdRef.current = currentFirstId;

    if (messages.length === 0) return;

    // Initial load - scroll to bottom
    if (prevCount === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    // Prepend case - maintain scroll position
    if (prevFirstId && currentFirstId !== prevFirstId && el && scrollSnapshotRef.current !== null) {
      const heightDelta = el.scrollHeight - scrollSnapshotRef.current;
      el.scrollTop += heightDelta;
      scrollSnapshotRef.current = null;
      return;
    }

    // Append case - smooth scroll to bottom
    if (messages.length > prevCount) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load more when scrolled to top
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !hasMore || isLoadingHistory) return;
    if (el.scrollTop < 80 && messages.length > 0) {
      const oldest = messages[0];
      void fetchHistory(`${oldest.timestamp}:${oldest.id}`);
    }
  }, [hasMore, isLoadingHistory, messages, fetchHistory]);

  return {
    fetchHistory,
    fetchTasks,
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  };
}
