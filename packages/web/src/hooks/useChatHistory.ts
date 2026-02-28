'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import type { TaskProgressItem, QueueEntry } from '@/stores/chat-types';
import { useTaskStore } from '@/stores/taskStore';
import { apiFetch } from '@/utils/api-client';
const HISTORY_PAGE_SIZE = 50;
// In export mode (?export=true), load all messages in one request for screenshot capture.
// Normal browsing still uses 50-per-page pagination.
const EXPORT_LIMIT = 10000;

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError';
}

/**
 * Hook for managing chat history: fetching, pagination, scroll handling.
 * Extracted from ChatContainer to reduce component size.
 *
 * @param threadId - The active thread ID (from URL route param).
 */
export function useChatHistory(threadId: string) {
  const {
    messages,
    isLoadingHistory,
    hasMore,
    prependHistory,
    setLoadingHistory,
    clearMessages,
    setCatInvocation,
    setThreadTargetCats,
    setQueue,
    setQueuePaused,
  } = useChatStore();
  const { setTasks } = useTaskStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll state for prepend handling
  const prevFirstIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  const scrollSnapshotRef = useRef<number | null>(null);

  // Track loading guard per-thread to prevent double-fetch
  const loadingRef = useRef(false);

  // P1 fix: AbortController to cancel in-flight requests on thread switch
  const abortRef = useRef<AbortController | null>(null);
  // Always-current threadId for stale response checks
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  // Fetch history page from API
  // When replace=true, clears existing messages before setting (used for force-refresh).
  const fetchHistory = useCallback(
    async (cursor?: string, options?: { replace?: boolean }) => {
      if (loadingRef.current) return;
      const controller = abortRef.current;
      if (!controller) return;

      loadingRef.current = true;
      setLoadingHistory(true);
      const fetchForThread = threadId; // capture at call time
      try {
        const isExport = typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('export') === 'true';
        const limit = isExport ? EXPORT_LIMIT : HISTORY_PAGE_SIZE;
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('before', cursor);
        params.set('threadId', fetchForThread);
        const res = await apiFetch(`/api/messages?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        // Stale check: discard if thread changed during fetch
        if (threadIdRef.current !== fetchForThread) return;
        const data = await res.json();
        const historyMsgs = (data.messages ?? []).map(
          (m: { id: string; type: string; catId?: string; content: string; contentBlocks?: unknown[]; toolEvents?: unknown[]; metadata?: { provider: string; model: string; sessionId?: string }; origin?: 'stream' | 'callback'; thinking?: string; extra?: { rich?: { v: number; blocks: unknown[] } }; timestamp: number; summary?: { id: string; topic: string; conclusions: string[]; openQuestions: string[]; createdBy: string }; visibility?: 'public' | 'whisper'; whisperTo?: string[]; revealedAt?: number; isDraft?: boolean; source?: { connector: string; label: string; icon: string; url?: string } }) => ({
            id: m.id,
            type: m.type as 'user' | 'assistant' | 'system' | 'summary' | 'connector',
            catId: m.catId,
            content: m.content,
            ...(m.contentBlocks ? { contentBlocks: m.contentBlocks } : {}),
            ...(m.toolEvents ? { toolEvents: m.toolEvents as import('../stores/chat-types').ToolEvent[] } : {}),
            ...(m.metadata ? { metadata: m.metadata } : {}),
            ...(m.origin ? { origin: m.origin } : {}),
            ...(m.thinking ? { thinking: m.thinking } : {}),
            ...(m.extra?.rich ? { extra: { rich: m.extra.rich } } : {}),
            ...(m.summary ? { summary: m.summary } : {}),
            ...(m.visibility ? { visibility: m.visibility } : {}),
            ...(m.whisperTo ? { whisperTo: m.whisperTo } : {}),
            ...(m.revealedAt ? { revealedAt: m.revealedAt } : {}),
            ...(m.source ? { source: m.source } : {}),
            // #80: Restore streaming indicator for draft messages recovered from Redis
            ...(m.isDraft ? { isStreaming: true } : {}),
            timestamp: m.timestamp,
          } as ChatMessageData)
        );
        if (options?.replace) {
          // #80 fix-A P1: Replace mode — clear stale cache before setting fresh data.
          // By the time this async callback runs, setCurrentThread has already executed,
          // so clearMessages targets the correct thread.
          clearMessages();
        }
        prependHistory(historyMsgs, data.hasMore ?? false);
      } catch (err) {
        // AbortError is expected during thread switch — ignore silently
        if (isAbortError(err)) return;
      } finally {
        // Do not let stale/aborted request clear loading state for a newer thread request.
        if (abortRef.current === controller && threadIdRef.current === fetchForThread) {
          loadingRef.current = false;
          setLoadingHistory(false);
        }
      }
    },
    [setLoadingHistory, prependHistory, clearMessages, threadId]
  );

  const fetchTasks = useCallback(async () => {
    const fetchForThread = threadId;
    const controller = abortRef.current;
    if (!controller) return;

    try {
      const res = await apiFetch(
        `/api/tasks?threadId=${encodeURIComponent(fetchForThread)}`,
        { signal: controller.signal },
      );
      if (!res.ok) return;
      if (abortRef.current !== controller) return;
      if (threadIdRef.current !== fetchForThread) return;
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (err) {
      if (isAbortError(err)) return;
    }
  }, [threadId, setTasks]);

  // F045: Fetch cached task progress on mount to restore Plan Checklist after page refresh
  const fetchTaskProgress = useCallback(async () => {
    const fetchForThread = threadId;
    const controller = abortRef.current;
    if (!controller) return;

    try {
      const res = await apiFetch(
        `/api/threads/${encodeURIComponent(fetchForThread)}/task-progress`,
        { signal: controller.signal },
      );
      if (!res.ok) return;
      if (abortRef.current !== controller) return;
      if (threadIdRef.current !== fetchForThread) return;
      const data = await res.json() as {
        taskProgress?: Record<string, { tasks: Array<{ id: string; subject: string; status: string; activeForm?: string }>; lastUpdate: number }>;
      };
      if (data.taskProgress) {
        const restoredCats: string[] = [];
        for (const [catId, progress] of Object.entries(data.taskProgress)) {
          setCatInvocation(catId, {
            taskProgress: {
              tasks: progress.tasks.map((t): TaskProgressItem => ({
                id: t.id,
                subject: t.subject,
                status: t.status === 'in_progress' ? 'in_progress' : t.status === 'completed' ? 'completed' : 'pending',
                ...(t.activeForm ? { activeForm: t.activeForm } : {}),
              })),
              lastUpdate: progress.lastUpdate,
            },
          });
          // Only mark cat as "active" if it has non-empty progress.
          // Empty tasks (from Codex todo_list clear) should not make a cat appear active.
          if (progress.tasks.length > 0) {
            restoredCats.push(catId);
          }
        }
        // Restore targetCats so RightStatusPanel shows the Plan Checklist.
        // Only restore if no live targetCats exist — avoids overwriting fresh
        // intent_mode socket events when the HTTP response arrives late.
        const currentTargets = useChatStore.getState().targetCats;
        if (restoredCats.length > 0 && currentTargets.length === 0) {
          setThreadTargetCats(fetchForThread, restoredCats);
        }
      }
    } catch (err) {
      if (isAbortError(err)) return;
    }
  }, [threadId, setCatInvocation, setThreadTargetCats]);

  // F39 Bug 1: Fetch queue state on mount/thread-switch to survive F5 refresh
  const fetchQueue = useCallback(async () => {
    const fetchForThread = threadId;
    const controller = abortRef.current;
    if (!controller) return;

    try {
      const res = await apiFetch(
        `/api/threads/${encodeURIComponent(fetchForThread)}/queue`,
        { signal: controller.signal },
      );
      if (!res.ok) return;
      if (abortRef.current !== controller) return;
      if (threadIdRef.current !== fetchForThread) return;
      const data = await res.json() as { queue: QueueEntry[]; paused: boolean; pauseReason?: 'canceled' | 'failed' };
      // Always sync server state — clears stale local data when server queue is empty
      setQueue(fetchForThread, data.queue);
      setQueuePaused(fetchForThread, data.paused, data.pauseReason);
    } catch (err) {
      if (isAbortError(err)) return;
    }
  }, [threadId, setQueue, setQueuePaused]);

  // Load history + tasks when threadId changes (handles initial mount and navigation)
  useEffect(() => {
    // Abort any in-flight requests from previous thread
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    loadingRef.current = false;

    // Check if this thread has cached messages in the threadStates map.
    // If so, the store's setCurrentThread already restored them — skip API fetch.
    const state = useChatStore.getState();
    const cached = state.threadStates[threadId];
    const hasCachedMessages = cached && cached.messages.length > 0;
    const isThreadSynced = state.currentThreadId === threadId;

    // #80 fix-A: If the thread has an active invocation, force-refresh from API
    // so that DraftStore drafts are merged into the response. Without this,
    // switching away and back shows stale cached messages (no streaming draft).
    const hasActiveInvocation = cached?.hasActiveInvocation === true;

    if (!hasCachedMessages) {
      // During route thread switches, this effect can run before setCurrentThread.
      // Clearing too early would wipe the previous thread snapshot in the store.
      if (isThreadSynced) {
        clearMessages();
      }
      void fetchHistory();
    } else if (hasActiveInvocation) {
      // #80 fix-A P1: Force-refresh with replace mode — the async response handler
      // will clear stale cache after setCurrentThread has run, then set fresh data
      // including DraftStore drafts in correct timestamp order.
      void fetchHistory(undefined, { replace: true });
    }

    void fetchTasks();
    void fetchTaskProgress();
    void fetchQueue();

    return () => {
      abortRef.current?.abort();
    };
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // #80 cloud R8 P2: skip draft rows — their synthetic IDs break cursor semantics
      const oldest = messages.find(m => !m.id.startsWith('draft-'));
      if (oldest) {
        void fetchHistory(`${oldest.timestamp}:${oldest.id}`);
      }
    }
  }, [hasMore, isLoadingHistory, messages, fetchHistory]);

  return {
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  };
}
