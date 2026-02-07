'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore, type TaskItem } from '@/stores/taskStore';
import { useSocket, type SocketCallbacks } from '@/hooks/useSocket';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ThreadSidebar } from './ThreadSidebar';
import { IdeateHeader } from './IdeateHeader';
import { PawIcon } from './icons/PawIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const HISTORY_PAGE_SIZE = 50;

export function ChatContainer() {
  const {
    messages,
    isLoading,
    isLoadingHistory,
    hasMore,
    currentThreadId,
    intentMode,
    addMessage,
    prependHistory,
    setLoading,
    setLoadingHistory,
    setIntentMode,
    clearMessages,
    updateThreadTitle,
  } = useChatStore();
  const { addTask, updateTask, clearTasks } = useTaskStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { handleAgentMessage, handleStop: stopHandler, resetRefs } = useAgentMessages();

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
          })
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

  // Load initial history on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void fetchHistory();
    }
  }, [fetchHistory]);

  // Scroll handling for prepend vs append
  const prevFirstIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  const scrollSnapshotRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isLoadingHistory) {
      scrollSnapshotRef.current = el.scrollHeight;
    }
  }, [isLoadingHistory]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    const prevCount = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;
    const currentFirstId = messages.length > 0 ? messages[0].id : null;

    prevCountRef.current = messages.length;
    prevFirstIdRef.current = currentFirstId;

    if (messages.length === 0) return;

    if (prevCount === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    if (prevFirstId && currentFirstId !== prevFirstId && el && scrollSnapshotRef.current !== null) {
      const heightDelta = el.scrollHeight - scrollSnapshotRef.current;
      el.scrollTop += heightDelta;
      scrollSnapshotRef.current = null;
      return;
    }

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

  const socketCallbacks = useMemo<SocketCallbacks>(() => ({
    onMessage: handleAgentMessage,
    onThreadUpdated: (data) => updateThreadTitle(data.threadId, data.title),
    onIntentMode: (data) => setIntentMode(data.mode as 'ideate' | 'execute'),
    onTaskCreated: (task) => addTask(task as unknown as TaskItem),
    onTaskUpdated: (task) => updateTask(task as unknown as TaskItem),
    onThreadSummary: (summary) => {
      const s = summary as { id: string; threadId: string; topic: string; conclusions: string[]; openQuestions: string[]; createdBy: string; createdAt: number };
      addMessage({
        id: `summary-${s.id}`,
        type: 'summary',
        content: s.topic,
        timestamp: s.createdAt,
        summary: { id: s.id, topic: s.topic, conclusions: s.conclusions, openQuestions: s.openQuestions, createdBy: s.createdBy },
      });
    },
  }), [handleAgentMessage, updateThreadTitle, setIntentMode, addTask, updateTask, addMessage]);

  const { switchRoom, cancelInvocation } = useSocket(socketCallbacks, currentThreadId);

  const handleStop = useCallback(() => {
    stopHandler(cancelInvocation, currentThreadId);
  }, [stopHandler, cancelInvocation, currentThreadId]);

  const handleThreadSwitch = useCallback(
    (threadId: string) => {
      resetRefs();
      clearMessages();
      clearTasks();
      setIntentMode(null);
      switchRoom(threadId);
      void fetchHistory(undefined, threadId);
    },
    [resetRefs, clearMessages, clearTasks, setIntentMode, switchRoom, fetchHistory]
  );

  const handleSend = useCallback(
    async (content: string, images?: File[]) => {
      resetRefs();

      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      };
      if (images && images.length > 0) {
        userMsg.contentBlocks = [
          { type: 'text' as const, text: content },
          ...images.map((img) => ({
            type: 'image' as const,
            url: URL.createObjectURL(img),
          })),
        ];
      }
      addMessage(userMsg);
      setLoading(true);

      try {
        if (images && images.length > 0) {
          const formData = new FormData();
          formData.append('content', content);
          formData.append('threadId', currentThreadId);
          for (const img of images) {
            formData.append('images', img);
          }
          const res = await fetch(`${API_URL}/api/messages`, {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
        } else {
          const res = await fetch(`${API_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              threadId: currentThreadId,
            }),
          });
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
        }
      } catch (err) {
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown'}`,
          timestamp: Date.now(),
        });
      }
    },
    [resetRefs, addMessage, setLoading, currentThreadId]
  );

  return (
    <div className="flex h-screen">
      {sidebarOpen && (
        <ThreadSidebar onThreadSwitch={handleThreadSwitch} />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="border-b border-owner-light px-5 py-3 bg-owner-bg flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1 rounded-lg hover:bg-owner-light transition-colors mr-1"
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <PawIcon className="w-6 h-6 text-owner-primary" />
          <div>
            <h1 className="text-lg font-bold text-cafe-black">Cat Cafe</h1>
            <p className="text-xs text-gray-500">三只 AI 猫猫的协作空间</p>
          </div>
        </header>

        {intentMode === 'ideate' && <IdeateHeader />}

        <main
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4"
        >
          {isLoadingHistory && (
            <div className="text-center py-3 text-sm text-gray-400">
              加载历史消息...
            </div>
          )}
          {!hasMore && messages.length > 0 && (
            <div className="text-center py-3 text-xs text-gray-300">
              没有更多消息了
            </div>
          )}
          {messages.length === 0 && !isLoadingHistory ? (
            <div className="text-center mt-20">
              <PawIcon className="w-12 h-12 text-owner-light mx-auto mb-4" />
              <p className="text-lg text-gray-500 mb-1">欢迎来到 Cat Cafe!</p>
              <p className="text-sm text-gray-400">输入 @布偶 召唤布偶猫开始聊天</p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </main>

        <ChatInput onSend={handleSend} onStop={handleStop} disabled={isLoading} />
      </div>
    </div>
  );
}
