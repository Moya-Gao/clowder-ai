'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore, type TaskItem } from '@/stores/taskStore';
import { useSocket, type SocketCallbacks } from '@/hooks/useSocket';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { useChatHistory } from '@/hooks/useChatHistory';
import { useSendMessage } from '@/hooks/useSendMessage';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MessageActions } from './MessageActions';
import { RightStatusPanel } from './RightStatusPanel';
import { ThreadSidebar } from './ThreadSidebar';
import { ParallelStatusBar } from './ParallelStatusBar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { PawIcon } from './icons/PawIcon';

interface ChatContainerProps {
  threadId: string;
}

/**
 * Main chat container component.
 * Orchestrates hooks for history, commands, messaging, and socket communication.
 * threadId is driven by the URL route param (source of truth).
 */
export function ChatContainer({ threadId }: ChatContainerProps) {
  const {
    messages,
    isLoading,
    intentMode,
    targetCats,
    catStatuses,
    addMessage,
    removeMessage,
    setIntentMode,
    setTargetCats,
    clearCatStatuses,
    setCurrentThread,
    updateThreadTitle,
  } = useChatStore();
  const { tasks, addTask, updateTask, clearTasks } = useTaskStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { handleAgentMessage, handleStop: stopHandler, resetRefs, resetTimeout } = useAgentMessages();
  const {
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  } = useChatHistory(threadId);
  const { handleSend } = useSendMessage();

  const messageSummary = useMemo(() => {
    let assistant = 0;
    let system = 0;
    let evidence = 0;
    let followup = 0;

    for (const msg of messages) {
      if (msg.type === 'assistant') assistant += 1;
      if (msg.type === 'system') {
        system += 1;
        if (msg.variant === 'evidence') evidence += 1;
        if (msg.variant === 'a2a_followup') followup += 1;
      }
    }

    return {
      total: messages.length,
      assistant,
      system,
      evidence,
      followup,
    };
  }, [messages]);

  const taskSummary = useMemo(() => {
    let done = 0;
    for (const task of tasks) {
      if (task.status === 'done') done += 1;
    }

    return {
      total: tasks.length,
      done,
    };
  }, [tasks]);

  // P2 fix: suppress stale socket messages during thread switch window.
  // Set true synchronously when threadId changes; cleared after room switch completes.
  // Ref is stable across renders, so useMemo closures can read .current at call time.
  const suppressMessagesRef = useRef(false);

  // Sync URL-driven threadId to store (store is follower, URL is source of truth)
  const prevThreadRef = useRef(threadId);
  useEffect(() => {
    setCurrentThread(threadId);
    if (prevThreadRef.current !== threadId) {
      // Suppress socket messages during the switch window
      suppressMessagesRef.current = true;
      // Thread changed via navigation — clean up old state
      resetRefs();
      clearTasks();
      setIntentMode(null);
      clearCatStatuses();
      prevThreadRef.current = threadId;
      // Unsuppress after all effects from this render cycle have fired
      // (including useSocket's room switch effect)
      const timer = setTimeout(() => { suppressMessagesRef.current = false; }, 0);
      return () => clearTimeout(timer);
    }
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket callbacks
  const socketCallbacks = useMemo<SocketCallbacks>(() => ({
    onMessage: (msg) => {
      if (suppressMessagesRef.current) return;
      handleAgentMessage(msg);
    },
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
    onMessageDeleted: (data: { messageId: string }) => removeMessage(data.messageId),
    onMessageRestored: () => { /* full reload handled by re-fetching history if needed */ },
    onThreadBranched: () => { /* branch navigation handled by the action initiator */ },
  }), [handleAgentMessage, updateThreadTitle, setIntentMode, setTargetCats, addTask, updateTask, addMessage, removeMessage, resetTimeout]);

  const { cancelInvocation } = useSocket(socketCallbacks, threadId);

  const handleStop = useCallback(() => {
    stopHandler(cancelInvocation, threadId);
  }, [stopHandler, cancelInvocation, threadId]);

  return (
    <div className="flex h-screen">
      {sidebarOpen && (
        <ThreadSidebar />
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
            messages.map((msg) => (
              <MessageActions key={msg.id} message={msg} threadId={threadId}>
                <ChatMessage message={msg} />
              </MessageActions>
            ))
          )}
          <div ref={messagesEndRef} />
        </main>

        <ChatInput onSend={handleSend} onStop={handleStop} disabled={isLoading} />
      </div>

      <RightStatusPanel
        intentMode={intentMode}
        targetCats={targetCats}
        catStatuses={catStatuses}
        messageSummary={messageSummary}
        taskSummary={taskSummary}
      />
    </div>
  );
}
