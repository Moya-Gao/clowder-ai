'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { A2ACollapsible } from './A2ACollapsible';
import { MessageNavigator } from './MessageNavigator';
import { AuthorizationCard } from './AuthorizationCard';
import { useAuthorization } from '@/hooks/useAuthorization';
import { ModeStatusBar } from './ModeStatusBar';
import { ConfirmDialog } from './ConfirmDialog';
import { ExportButton } from './ExportButton';
import { SplitPaneView } from './SplitPaneView';
import { CatCafeHub } from './CatCafeHub';
import { useSplitPaneKeys } from '@/hooks/useSplitPaneKeys';

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
    hasActiveInvocation,
    intentMode,
    targetCats,
    catStatuses,
    catInvocations,
    addMessage,
    removeMessage,
    setLoading,
    setHasActiveInvocation,
    setIntentMode,
    setTargetCats,
    setCurrentThread,
    updateThreadTitle,
    setCurrentMode,
    pendingModeSwitchProposal,
    setPendingModeSwitchProposal,
    viewMode,
    setViewMode,
    clearUnread,
  } = useChatStore();
  const { tasks, addTask, updateTask, clearTasks } = useTaskStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusPanelOpen, setStatusPanelOpen] = useState(true);

  const { handleAgentMessage, handleStop: stopHandler, resetRefs, resetTimeout } = useAgentMessages();
  const {
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  } = useChatHistory(threadId);
  const { handleSend } = useSendMessage(threadId);
  const { pending: authPending, respond: authRespond, handleAuthRequest, handleAuthResponse } = useAuthorization(threadId);

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
  // setCurrentThread saves old thread state to map, restores new thread state.
  const prevThreadRef = useRef(threadId);
  useEffect(() => {
    if (prevThreadRef.current !== threadId) {
      // Suppress socket messages during the switch window
      suppressMessagesRef.current = true;
      // Thread switch: store saves/restores per-thread state automatically
      setCurrentThread(threadId);
      // Clean up non-thread-scoped refs
      resetRefs();
      clearTasks();
      prevThreadRef.current = threadId;
      const timer = setTimeout(() => { suppressMessagesRef.current = false; }, 0);
      return () => clearTimeout(timer);
    }
    // First mount — sync threadId to store without save/restore
    setCurrentThread(threadId);
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket callbacks
  const socketCallbacks = useMemo<SocketCallbacks>(() => ({
    onMessage: (msg) => {
      if (suppressMessagesRef.current) return;
      handleAgentMessage(msg);
    },
    onThreadUpdated: (data) => updateThreadTitle(data.threadId, data.title),
    onIntentMode: (data) => {
      if (data.threadId !== threadId) return;
      setLoading(true);
      setHasActiveInvocation(true);
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
    onAuthorizationRequest: handleAuthRequest,
    onAuthorizationResponse: handleAuthResponse,
    onModeChanged: (data) => {
      if (data.action === 'started' && data.mode) {
        const m = data.mode as { record: { name: string; config: Record<string, unknown>; startedAt: string }; state?: Record<string, unknown> };
        setCurrentMode({ name: m.record.name, config: m.record.config, startedAt: m.record.startedAt, ...(m.state ? { state: m.state } : {}) });
      } else {
        setCurrentMode(null);
      }
    },
  }), [handleAgentMessage, updateThreadTitle, setLoading, setHasActiveInvocation, setIntentMode, setTargetCats, addTask, updateTask, addMessage, removeMessage, resetTimeout, handleAuthRequest, handleAuthResponse, setCurrentMode, threadId]);

  /**
   * Group consecutive A2A messages into collapsible sections.
   * Non-A2A messages are kept as-is, A2A messages are grouped by groupId.
   */
  type RenderItem =
    | { kind: 'message'; msg: ChatMessageData }
    | { kind: 'a2a_group'; groupId: string; messages: ChatMessageData[] };

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let currentGroup: { groupId: string; messages: ChatMessageData[] } | null = null;

    for (const msg of messages) {
      if (msg.a2aGroupId) {
        if (currentGroup && currentGroup.groupId === msg.a2aGroupId) {
          currentGroup.messages.push(msg);
        } else {
          if (currentGroup) items.push({ kind: 'a2a_group', ...currentGroup });
          currentGroup = { groupId: msg.a2aGroupId, messages: [msg] };
        }
      } else {
        if (currentGroup) {
          items.push({ kind: 'a2a_group', ...currentGroup });
          currentGroup = null;
        }
        items.push({ kind: 'message', msg });
      }
    }
    if (currentGroup) items.push({ kind: 'a2a_group', ...currentGroup });
    return items;
  }, [messages]);

  const renderSingleMessage = useCallback(
    (msg: ChatMessageData) => (
      <MessageActions key={msg.id} message={msg} threadId={threadId}>
        <ChatMessage message={msg} />
      </MessageActions>
    ),
    [threadId]
  );

  const { cancelInvocation, syncRooms } = useSocket(socketCallbacks, threadId);

  // Keyboard shortcuts for split-pane mode
  useSplitPaneKeys();

  // Auto-join socket rooms for all split-pane threads
  const splitPaneThreadIds = useChatStore((s) => s.splitPaneThreadIds);
  const setSplitPaneThreadIds = useChatStore((s) => s.setSplitPaneThreadIds);
  const setSplitPaneTarget = useChatStore((s) => s.setSplitPaneTarget);

  // Auto-populate first pane with current thread when entering split mode with empty panes
  useEffect(() => {
    if (viewMode === 'split' && splitPaneThreadIds.length === 0 && threadId !== 'default') {
      setSplitPaneThreadIds([threadId]);
      setSplitPaneTarget(threadId);
    }
  }, [viewMode, splitPaneThreadIds.length, threadId, setSplitPaneThreadIds, setSplitPaneTarget]);

  useEffect(() => {
    if (viewMode === 'split' && splitPaneThreadIds.length > 0) {
      // Join rooms for all threads in panes + the current active thread
      const allIds = new Set([...splitPaneThreadIds, threadId]);
      syncRooms([...allIds]);
    }
  }, [viewMode, splitPaneThreadIds, threadId, syncRooms]);

  // Clear unread when switching to a thread (the thread becomes active = user sees it)
  useEffect(() => {
    clearUnread(threadId);
  }, [threadId, clearUnread]);

  const handleStop = useCallback((overrideThreadId?: unknown) => {
    const targetThreadId = typeof overrideThreadId === 'string' ? overrideThreadId : threadId;
    stopHandler(cancelInvocation, targetThreadId);
  }, [stopHandler, cancelInvocation, threadId]);

  const router = useRouter();

  /** Double-click a split pane → zoom back to single mode on that thread */
  const handleZoomToThread = useCallback(
    (tid: string) => {
      setViewMode('single');
      router.push(`/thread/${tid}`);
    },
    [setViewMode, router]
  );

  // ── Split-pane mode ──
  if (viewMode === 'split') {
    return (
      <>
        <SplitPaneView
          onSend={handleSend}
          onStop={handleStop}
          onZoomToThread={handleZoomToThread}
        />
        <CatCafeHub />
      </>
    );
  }

  // ── Single mode (default) ──
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
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-cafe-black">Cat Cafe</h1>
            <p className="text-xs text-gray-500">三只 AI 猫猫的协作空间</p>
          </div>
          <ExportButton threadId={threadId} />
          <button
            onClick={() => setViewMode(viewMode === 'single' ? 'split' : 'single')}
            className="p-1 rounded-lg hover:bg-owner-light transition-colors"
            aria-label={viewMode === 'single' ? '切换分屏模式' : '切换单屏模式'}
            title={viewMode === 'single' ? '分屏模式' : '单屏模式'}
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              {viewMode === 'single' ? (
                <>
                  <rect x="2" y="2" width="7" height="7" rx="1" />
                  <rect x="11" y="2" width="7" height="7" rx="1" />
                  <rect x="2" y="11" width="7" height="7" rx="1" />
                  <rect x="11" y="11" width="7" height="7" rx="1" />
                </>
              ) : (
                <rect x="2" y="2" width="16" height="16" rx="2" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setStatusPanelOpen((v) => !v)}
            className="p-1 rounded-lg hover:bg-owner-light transition-colors ml-1 hidden lg:block"
            aria-label={statusPanelOpen ? 'Hide status panel' : 'Show status panel'}
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 0v12h10V4H5z" clipRule="evenodd" />
              {statusPanelOpen && <rect x="12" y="4" width="4" height="12" rx="0.5" opacity="0.3" />}
            </svg>
          </button>
        </header>

        <ModeStatusBar />
        {intentMode === 'ideate' && <ParallelStatusBar onStop={handleStop} />}
        {intentMode === 'execute' && <ThinkingIndicator />}

        <div className="flex-1 relative overflow-hidden">
          <main
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto p-4"
            data-chat-container
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
              renderItems.map((item) =>
                item.kind === 'a2a_group' ? (
                  <A2ACollapsible
                    key={item.groupId}
                    group={{ groupId: item.groupId, messages: item.messages }}
                    renderMessage={renderSingleMessage}
                  />
                ) : (
                  renderSingleMessage(item.msg)
                )
              )
            )}
            <div ref={messagesEndRef} />
          </main>
          {messages.length > 5 && <MessageNavigator messages={messages} scrollContainerRef={scrollContainerRef} />}
        </div>

        {authPending.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50/40 py-2">
            {authPending.map((req) => (
              <AuthorizationCard key={req.requestId} request={req} onRespond={authRespond} />
            ))}
          </div>
        )}

        <ChatInput onSend={handleSend} onStop={handleStop} disabled={isLoading} hasActiveInvocation={hasActiveInvocation} />

        {/* Mode switch confirmation dialog (P2-4: 弹确认对话框) */}
        <ConfirmDialog
          open={!!pendingModeSwitchProposal}
          title="模式切换确认"
          message={pendingModeSwitchProposal
            ? `${pendingModeSwitchProposal.proposedBy} 提议切换到 ${pendingModeSwitchProposal.proposedMode} 模式。确认切换？`
            : ''}
          confirmLabel="确认切换"
          cancelLabel="忽略"
          onConfirm={() => {
            if (pendingModeSwitchProposal && pendingModeSwitchProposal.threadId === threadId) {
              handleSend(pendingModeSwitchProposal.command);
            }
            setPendingModeSwitchProposal(null);
          }}
          onCancel={() => setPendingModeSwitchProposal(null)}
        />
      </div>

      {statusPanelOpen && (
        <RightStatusPanel
          intentMode={intentMode}
          targetCats={targetCats}
          catStatuses={catStatuses}
          catInvocations={catInvocations}
          threadId={threadId}
          messageSummary={messageSummary}
          taskSummary={taskSummary}
        />
      )}
      <CatCafeHub />
    </div>
  );
}
