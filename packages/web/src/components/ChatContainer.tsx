'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PawIcon } from './icons/PawIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const HISTORY_PAGE_SIZE = 50;

export function ChatContainer() {
  const {
    messages,
    isLoading,
    isLoadingHistory,
    hasMore,
    addMessage,
    prependHistory,
    appendToLastMessage,
    setStreaming,
    setLoading,
    setLoadingHistory,
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<{ id: string; catId: string } | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch history page from API
  const fetchHistory = useCallback(
    async (cursor?: string) => {
      if (isLoadingHistory) return;
      setLoadingHistory(true);
      try {
        const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (cursor) params.set('before', cursor);
        const res = await fetch(`${API_URL}/api/messages?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const historyMsgs = (data.messages ?? []).map(
          (m: { id: string; type: string; catId?: string; content: string; timestamp: number }) => ({
            id: m.id,
            type: m.type as 'user' | 'assistant' | 'system',
            catId: m.catId,
            content: m.content,
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
    [isLoadingHistory, setLoadingHistory, prependHistory]
  );

  // Load initial history on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void fetchHistory();
    }
  }, [fetchHistory]);

  // Detect prepend vs append and handle scroll accordingly
  const prevFirstIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(0);
  const scrollSnapshotRef = useRef<number | null>(null);

  // Before render: snapshot scroll height when we expect a prepend
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isLoadingHistory) {
      scrollSnapshotRef.current = el.scrollHeight;
    }
  }, [isLoadingHistory]);

  // After messages change: scroll to bottom on append, preserve position on prepend
  useEffect(() => {
    const el = scrollContainerRef.current;
    const prevCount = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;
    const currentFirstId = messages.length > 0 ? messages[0].id : null;

    prevCountRef.current = messages.length;
    prevFirstIdRef.current = currentFirstId;

    if (messages.length === 0) return;

    // First load: scroll to bottom
    if (prevCount === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    // Prepend detected: first message ID changed → preserve viewport
    if (prevFirstId && currentFirstId !== prevFirstId && el && scrollSnapshotRef.current !== null) {
      const heightDelta = el.scrollHeight - scrollSnapshotRef.current;
      el.scrollTop += heightDelta;
      scrollSnapshotRef.current = null;
      return;
    }

    // Append: new messages added at the end → scroll to bottom
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

  const handleAgentMessage = useCallback(
    (msg: { type: string; catId: string; content?: string; error?: string; isFinal?: boolean }) => {
      if (msg.type === 'text' && msg.content) {
        const needNewMessage =
          !currentMessageRef.current ||
          currentMessageRef.current.catId !== msg.catId;

        if (needNewMessage) {
          const id = `msg-${Date.now()}-${msg.catId}`;
          currentMessageRef.current = { id, catId: msg.catId };
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            timestamp: Date.now(),
            isStreaming: true,
          });
        } else {
          appendToLastMessage(msg.content);
        }
      } else if (msg.type === 'done') {
        if (currentMessageRef.current) {
          setStreaming(currentMessageRef.current.id, false);
        }
        if (msg.isFinal) {
          setLoading(false);
        }
      } else if (msg.type === 'error') {
        currentMessageRef.current = null;
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          catId: msg.catId,
          content: `Error: ${msg.error ?? 'Unknown error'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, appendToLastMessage, setStreaming, setLoading]
  );

  useSocket(handleAgentMessage);

  const handleSend = useCallback(
    async (content: string) => {
      currentMessageRef.current = null;

      addMessage({
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      });

      setLoading(true);

      try {
        await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
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
    [addMessage, setLoading]
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-owner-light px-5 py-3 bg-owner-bg flex items-center gap-2">
        <PawIcon className="w-6 h-6 text-owner-primary" />
        <div>
          <h1 className="text-lg font-bold text-cafe-black">Cat Cafe</h1>
          <p className="text-xs text-gray-500">三只 AI 猫猫的协作空间</p>
        </div>
      </header>

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

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
