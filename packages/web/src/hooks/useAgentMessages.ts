'use client';

import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';

interface AgentMsg {
  type: string;
  catId: string;
  content?: string;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string };
}

/**
 * Hook for handling agent message streaming.
 * Tracks the current streaming message via a single ref (serial only).
 * Phase 3.5 Step 6 will convert to Map<catId, ref> for parallel streams.
 *
 * Returns:
 * - handleAgentMessage: socket event handler
 * - handleStop: cancel handler for stop button
 * - resetRefs: cleanup for thread switching
 */
export function useAgentMessages() {
  const {
    addMessage,
    appendToLastMessage,
    setStreaming,
    setLoading,
  } = useChatStore();

  const currentMessageRef = useRef<{ id: string; catId: string } | null>(null);

  const handleAgentMessage = useCallback(
    (msg: AgentMsg) => {
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
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
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

  const handleStop = useCallback(
    (cancelFn: (threadId: string) => void, threadId: string) => {
      cancelFn(threadId);
      setLoading(false);
      if (currentMessageRef.current) {
        setStreaming(currentMessageRef.current.id, false);
        currentMessageRef.current = null;
      }
    },
    [setLoading, setStreaming]
  );

  const resetRefs = useCallback(() => {
    currentMessageRef.current = null;
  }, []);

  return { handleAgentMessage, handleStop, resetRefs };
}
