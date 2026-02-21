import { useMemo } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useTaskStore, type TaskItem } from '@/stores/taskStore';
import type { SocketCallbacks } from '@/hooks/useSocket';

interface ExternalDeps {
  threadId: string;
  handleAgentMessage: SocketCallbacks['onMessage'];
  resetTimeout: () => void;
  handleAuthRequest: NonNullable<SocketCallbacks['onAuthorizationRequest']>;
  handleAuthResponse: NonNullable<SocketCallbacks['onAuthorizationResponse']>;
}

/**
 * Socket event callbacks for a chat thread.
 * Extracted from ChatContainer to reduce file size.
 */
export function useChatSocketCallbacks({
  threadId,
  handleAgentMessage,
  resetTimeout,
  handleAuthRequest,
  handleAuthResponse,
}: ExternalDeps): SocketCallbacks {
  const {
    updateThreadTitle,
    setLoading,
    setHasActiveInvocation,
    setIntentMode,
    setTargetCats,
    addMessage,
    removeMessage,
    setCurrentMode,
  } = useChatStore();
  const { addTask, updateTask } = useTaskStore();

  return useMemo<SocketCallbacks>(() => ({
    onMessage: (msg) => {
      handleAgentMessage(msg);
      return true;
    },
    onThreadUpdated: (data) => updateThreadTitle(data.threadId, data.title),
    onIntentMode: (data) => {
      // Socket layer (useSocket) already applies dual-pointer guard + background routing.
      // This callback only fires for the truly active thread.
      setLoading(true);
      setHasActiveInvocation(true);
      setIntentMode(data.mode as 'ideate' | 'execute');
      setTargetCats((data as { targetCats?: string[] }).targetCats ?? []);
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
    onHeartbeat: (data) => {
      if (data.threadId === threadId) resetTimeout();
    },
    onMessageDeleted: (data: { messageId: string }) => removeMessage(data.messageId),
    onMessageRestored: () => { /* re-fetching history if needed */ },
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
}
