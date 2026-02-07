'use client';

import { useCallback, useMemo, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore, type TaskItem } from '@/stores/taskStore';
import { useSocket, type SocketCallbacks } from '@/hooks/useSocket';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { useChatHistory } from '@/hooks/useChatHistory';
import { useSendMessage } from '@/hooks/useSendMessage';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ThreadSidebar } from './ThreadSidebar';
import { ParallelStatusBar } from './ParallelStatusBar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { PawIcon } from './icons/PawIcon';

/**
 * Main chat container component.
 * Orchestrates hooks for history, commands, messaging, and socket communication.
 * Refactored in Phase 4.0 to reduce size from ~400 lines to ~150 lines.
 */
export function ChatContainer() {
  const {
    messages,
    isLoading,
    currentThreadId,
    intentMode,
    addMessage,
    setIntentMode,
    setTargetCats,
    clearCatStatuses,
    clearMessages,
    updateThreadTitle,
  } = useChatStore();
  const { addTask, updateTask, clearTasks } = useTaskStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { handleAgentMessage, handleStop: stopHandler, resetRefs, resetTimeout } = useAgentMessages();
  const {
    fetchHistory,
    fetchTasks,
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  } = useChatHistory();
  const { handleSend } = useSendMessage();

  // Socket callbacks
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
      } as ChatMessageData);
    },
    onHeartbeat: () => resetTimeout(),
  }), [handleAgentMessage, updateThreadTitle, setIntentMode, setTargetCats, addTask, updateTask, addMessage, resetTimeout]);

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
