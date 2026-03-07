'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { useTaskStore } from '@/stores/taskStore';
import { useSocket } from '@/hooks/useSocket';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { useChatHistory } from '@/hooks/useChatHistory';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useChatSocketCallbacks } from '@/hooks/useChatSocketCallbacks';
import { ChatMessage } from './ChatMessage';
import { useCatData } from '@/hooks/useCatData';
import { ChatInput } from './ChatInput';
import { ChatContainerHeader } from './ChatContainerHeader';
import { MessageActions } from './MessageActions';
import { RightStatusPanel } from './RightStatusPanel';
import { WorkspacePanel } from './WorkspacePanel';
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
import { SplitPaneView } from './SplitPaneView';
import { CatCafeHub } from './CatCafeHub';
import { MobileStatusSheet } from './MobileStatusSheet';
import { QueuePanel } from './QueuePanel';
import { useSplitPaneKeys } from '@/hooks/useSplitPaneKeys';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { computeScrollRecomputeSignal } from '@/utils/scrollRecomputeSignal';
import { ResizeHandle } from './workspace/ResizeHandle';

interface ChatContainerProps {
  threadId: string;
}

export function ChatContainer({ threadId }: ChatContainerProps) {
  const {
    messages, hasActiveInvocation, intentMode, targetCats,
    catStatuses, catInvocations, setCurrentThread,
    pendingModeSwitchProposal, setPendingModeSwitchProposal,
    viewMode, setViewMode, clearUnread, rightPanelMode,
  } = useChatStore();
  const uiThinkingExpandedByDefault = useChatStore((s) => s.uiThinkingExpandedByDefault);

  // Export mode: ?export=true triggers print-friendly layout (no scroll containers)
  const isExport = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('export') === 'true';
  const { clearTasks } = useTaskStore();
  const { getCatById } = useCatData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(true);
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
  // F063: resizable split pane — chatBasis as percentage (20-80)
  const [chatBasis, setChatBasis] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleHorizontalResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.offsetWidth;
    if (totalWidth === 0) return;
    const pct = (delta / totalWidth) * 100;
    setChatBasis((prev) => Math.min(80, Math.max(20, prev + pct)));
  }, []);

  // F063: auto-open panel when message file path click triggers workspace mode
  useEffect(() => {
    if (rightPanelMode === 'workspace' && !statusPanelOpen) {
      setStatusPanelOpen(true);
    }
  }, [rightPanelMode, statusPanelOpen]);

  // Desktop: auto-open sidebar on mount (mobile stays closed)
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches) {
      setSidebarOpen(true);
    }
  }, []);

  const { handleAgentMessage, handleStop: stopHandler, resetRefs, resetTimeout, clearDoneTimeout } = useAgentMessages();
  const {
    handleScroll,
    scrollContainerRef,
    messagesEndRef,
    isLoadingHistory,
    hasMore,
  } = useChatHistory(threadId);
  const { handleSend, uploadStatus, uploadError } = useSendMessage(threadId);
  const { pending: authPending, respond: authRespond, handleAuthRequest, handleAuthResponse } = useAuthorization(threadId);

  const messageSummary = useMemo(() => {
    const c = { total: messages.length, assistant: 0, system: 0, evidence: 0, followup: 0 };
    for (const msg of messages) {
      const isAssistant = msg.type === 'assistant' || (msg.type === 'user' && !!msg.catId);
      if (isAssistant) c.assistant++;
      if (msg.type === 'system') {
        c.system++;
        if (msg.variant === 'evidence') c.evidence++;
        if (msg.variant === 'a2a_followup') c.followup++;
      }
    }
    return c;
  }, [messages]);

  // Sync URL-driven threadId to store (store is follower, URL is source of truth)
  // setCurrentThread saves old thread state to map, restores new thread state.
  const prevThreadRef = useRef(threadId);
  useEffect(() => {
    if (prevThreadRef.current !== threadId) {
      // Thread switch: store saves/restores per-thread state automatically
      setCurrentThread(threadId);
      // Clean up non-thread-scoped refs
      resetRefs();
      clearTasks();
      prevThreadRef.current = threadId;
    }
    // First mount — sync threadId to store without save/restore
    setCurrentThread(threadId);
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const socketCallbacks = useChatSocketCallbacks({
    threadId,
    handleAgentMessage,
    resetTimeout,
    clearDoneTimeout,
    handleAuthRequest,
    handleAuthResponse,
  });

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
        <ChatMessage message={msg} getCatById={getCatById} />
      </MessageActions>
    ),
    [threadId, getCatById]
  );

  const { cancelInvocation, syncRooms } = useSocket(socketCallbacks, threadId);

  useSplitPaneKeys();
  const splitPaneThreadIds = useChatStore((s) => s.splitPaneThreadIds);
  const setSplitPaneThreadIds = useChatStore((s) => s.setSplitPaneThreadIds);
  const setSplitPaneTarget = useChatStore((s) => s.setSplitPaneTarget);

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

  useEffect(() => { clearUnread(threadId); }, [threadId, clearUnread]);

  // F069: Ack read cursor on server when messages are loaded
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastMessageId) return;
    apiFetch(`/api/threads/${encodeURIComponent(threadId)}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upToMessageId: lastMessageId }),
    }).catch((err) => { console.debug('[F069] read ack failed:', err); });
  }, [threadId, lastMessageId]);

  const handleStop = useCallback((overrideThreadId?: unknown) => {
    const targetThreadId = typeof overrideThreadId === 'string' ? overrideThreadId : threadId;
    stopHandler(cancelInvocation, targetThreadId);
  }, [stopHandler, cancelInvocation, threadId]);

  const router = useRouter();

  const handleZoomToThread = useCallback(
    (tid: string) => {
      setViewMode('single');
      router.push(`/thread/${tid}`);
    },
    [setViewMode, router]
  );

  if (viewMode === 'split') {
    return (
      <>
        <SplitPaneView
          onSend={handleSend}
          onStop={handleStop}
          uploadStatus={uploadStatus}
          uploadError={uploadError}
          onZoomToThread={handleZoomToThread}
        />
        <CatCafeHub />
      </>
    );
  }

  // Export mode: print-friendly layout — no sidebars, no scroll containers
  if (isExport) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto p-4">
          {renderItems.map((item) =>
            item.kind === 'a2a_group' ? (
              <A2ACollapsible
                key={item.groupId}
                group={{ groupId: item.groupId, messages: item.messages }}
                renderMessage={renderSingleMessage}
              />
            ) : (
              renderSingleMessage(item.msg)
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-screen h-dvh">
      {sidebarOpen && (
        <>
          {/* Backdrop — mobile only */}
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-30 md:static md:z-auto">
            <ThreadSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div
        className="flex flex-col min-w-0"
        style={statusPanelOpen && rightPanelMode === 'workspace' ? { flexBasis: `${chatBasis}%`, flexGrow: 0, flexShrink: 0 } : { flex: '1 1 0%' }}
      >
        <ChatContainerHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          threadId={threadId}
          authPendingCount={authPending.length}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode(viewMode === 'single' ? 'split' : 'single')}
          onOpenMobileStatus={() => setMobileStatusOpen(true)}
          statusPanelOpen={statusPanelOpen}
          onToggleStatusPanel={() => setStatusPanelOpen((v) => !v)}
        />

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
          <ScrollToBottomButton
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
            recomputeSignal={computeScrollRecomputeSignal(threadId, messages, uiThinkingExpandedByDefault ? 1 : 0)}
            observerKey={threadId}
          />
          {messages.length > 5 && <MessageNavigator messages={messages} scrollContainerRef={scrollContainerRef} />}
        </div>

        {authPending.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50/40 py-2">
            {authPending.map((req) => (
              <AuthorizationCard key={req.requestId} request={req} onRespond={authRespond} />
            ))}
          </div>
        )}

        <QueuePanel threadId={threadId} />

        <ChatInput
          key={threadId}
          threadId={threadId}
          onSend={(content, images, whisper, deliveryMode) => handleSend(content, images, undefined, whisper, deliveryMode)}
          onStop={handleStop}
          disabled={false}
          hasActiveInvocation={hasActiveInvocation}
          uploadStatus={uploadStatus}
          uploadError={uploadError}
        />

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

      {statusPanelOpen && rightPanelMode === 'status' && (
        <RightStatusPanel
          intentMode={intentMode}
          targetCats={targetCats}
          catStatuses={catStatuses}
          catInvocations={catInvocations}
          threadId={threadId}
          messageSummary={messageSummary}
        />
      )}
      {statusPanelOpen && rightPanelMode === 'workspace' && (
        <>
          <ResizeHandle
            direction="horizontal"
            onResize={handleHorizontalResize}
            onDoubleClick={() => setChatBasis(50)}
          />
          <WorkspacePanel />
        </>
      )}
      <MobileStatusSheet
        open={mobileStatusOpen}
        onClose={() => setMobileStatusOpen(false)}
        intentMode={intentMode}
        targetCats={targetCats}
        catStatuses={catStatuses}
        catInvocations={catInvocations}
        threadId={threadId}
        messageSummary={messageSummary}
      />
      <CatCafeHub />
    </div>
  );
}
