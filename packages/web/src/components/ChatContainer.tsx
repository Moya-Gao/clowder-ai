'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore, type TaskItem } from '@/stores/taskStore';
import { useSocket, type SocketCallbacks } from '@/hooks/useSocket';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ThreadSidebar } from './ThreadSidebar';
import { ParallelStatusBar } from './ParallelStatusBar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { PawIcon } from './icons/PawIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const HISTORY_PAGE_SIZE = 50;

/** Format ConfigSnapshot into readable multi-line text for /config display */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatConfigForDisplay(config: any): string {
  const lines: string[] = ['⚙️ Cat Cafe 运行配置', ''];

  if (config.context) {
    lines.push('📋 上下文预算');
    lines.push(`  历史条数: ${config.context.maxMessages}`);
    lines.push(`  每条截断: ${config.context.maxContentLength} 字符`);
    lines.push(`  总上下文: ${config.context.maxTotalChars} 字符`);
    lines.push(`  总 prompt: ${config.context.maxPromptChars} 字符`);
    lines.push('');
  }

  if (config.cli) {
    lines.push('🖥️ CLI');
    lines.push(`  超时: ${config.cli.timeoutMs / 1000}s`);
    lines.push(`  强制终止: ${config.cli.killGraceMs / 1000}s`);
    lines.push('');
  }

  if (config.storage) {
    lines.push('💾 存储');
    lines.push(`  消息 TTL: ${config.storage.messageTTL}`);
    lines.push(`  对话 TTL: ${config.storage.threadTTL}`);
    lines.push(`  任务 TTL: ${config.storage.taskTTL}`);
    lines.push(`  最大消息数: ${config.storage.maxMessages}`);
    lines.push(`  最大对话数: ${config.storage.maxThreads}`);
    lines.push('');
  }

  if (config.upload) {
    lines.push('📎 上传');
    lines.push(`  最大文件: ${config.upload.maxFileSize}`);
    lines.push(`  最大数量: ${config.upload.maxFiles}`);
    lines.push('');
  }

  if (config.server) {
    lines.push('🌐 服务器');
    lines.push(`  地址: ${config.server.host}:${config.server.port}`);
    lines.push(`  存储: ${config.server.redis === 'connected' ? 'Redis' : '内存'}`);
    lines.push('');
  }

  if (config.cats) {
    lines.push('🐱 猫猫配置');
    for (const [id, cat] of Object.entries(config.cats)) {
      const c = cat as { displayName: string; provider: string; model: string; mcpSupport: boolean };
      lines.push(`  ${c.displayName} (${id}): ${c.provider}/${c.model} ${c.mcpSupport ? '[MCP]' : ''}`);
    }
    lines.push('');
  }

  if (config.a2a) {
    lines.push('🔗 A2A 猫猫互调');
    lines.push(`  启用: ${config.a2a.enabled ? '是' : '否'}`);
    lines.push(`  最大深度: ${config.a2a.maxDepth}`);
  }

  return lines.join('\n');
}

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
    setTargetCats,
    clearCatStatuses,
    clearMessages,
    updateThreadTitle,
  } = useChatStore();
  const { setTasks, addTask, updateTask, clearTasks } = useTaskStore();
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
    onIntentMode: (data) => {
      setIntentMode(data.mode as 'ideate' | 'execute');
      const cats = (data as { targetCats?: string[] }).targetCats;
      if (cats && cats.length > 0) setTargetCats(cats);
    },
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
  }), [handleAgentMessage, updateThreadTitle, setIntentMode, setTargetCats, addTask, updateTask, addMessage]);

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
      clearCatStatuses();
      switchRoom(threadId);
      void fetchHistory(undefined, threadId);
      void fetchTasks(threadId);
    },
    [resetRefs, clearMessages, clearTasks, setIntentMode, clearCatStatuses, switchRoom, fetchHistory, fetchTasks]
  );

  const handleSend = useCallback(
    async (content: string, images?: File[]) => {
      resetRefs();

      // /config command — fetch and display config snapshot
      if (content.trim() === '/config') {
        try {
          const res = await fetch(`${API_URL}/api/config`);
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          const data = await res.json();
          addMessage({
            id: `config-${Date.now()}`,
            type: 'system',
            variant: 'info',
            content: formatConfigForDisplay(data.config),
            timestamp: Date.now(),
          });
        } catch (err) {
          addMessage({
            id: `err-${Date.now()}`,
            type: 'system',
            content: `Failed to load config: ${err instanceof Error ? err.message : 'Unknown'}`,
            timestamp: Date.now(),
          });
        }
        return;
      }

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

        {intentMode === 'ideate' && <ParallelStatusBar />}
        {intentMode === 'execute' && <ThinkingIndicator />}

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
