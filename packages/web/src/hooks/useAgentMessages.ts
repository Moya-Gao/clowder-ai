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
 * Hook for handling agent message streaming (parallel-aware).
 * Tracks active streams via Map<catId, ref> for simultaneous multi-cat output.
 *
 * Returns:
 * - handleAgentMessage: socket event handler
 * - handleStop: cancel handler for stop button
 * - resetRefs: cleanup for thread switching
 */
export function useAgentMessages() {
  const {
    addMessage,
    appendToMessage,
    setStreaming,
    setLoading,
    setIntentMode,
    setCatStatus,
    clearCatStatuses,
  } = useChatStore();

  /** Map<catId, { id: messageId, catId }> — one entry per active stream */
  const activeRefs = useRef<Map<string, { id: string; catId: string }>>(new Map());

  const handleAgentMessage = useCallback(
    (msg: AgentMsg) => {
      if (msg.type === 'text' && msg.content) {
        const existing = activeRefs.current.get(msg.catId);
        setCatStatus(msg.catId, 'streaming');

        if (existing) {
          // Append to this cat's active message
          appendToMessage(existing.id, msg.content);
        } else {
          // New message for this cat
          const id = `msg-${Date.now()}-${msg.catId}`;
          activeRefs.current.set(msg.catId, { id, catId: msg.catId });
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: Date.now(),
            isStreaming: true,
          });
        }
      } else if (msg.type === 'done') {
        setCatStatus(msg.catId, 'done');
        const ref = activeRefs.current.get(msg.catId);
        if (ref) {
          setStreaming(ref.id, false);
          activeRefs.current.delete(msg.catId);
        }
        if (msg.isFinal) {
          setLoading(false);
          setIntentMode(null);
          clearCatStatuses();
        }
      } else if (msg.type === 'a2a_handoff') {
        addMessage({
          id: `a2a-${Date.now()}-${msg.catId}`,
          type: 'system',
          variant: 'info',
          content: msg.content ?? '',
          timestamp: Date.now(),
        });
      } else if (msg.type === 'system_info') {
        // System notifications: budget warnings, cancel feedback, etc.
        addMessage({
          id: `sysinfo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          variant: 'info',
          content: msg.content ?? '',
          timestamp: Date.now(),
        });
      } else if (msg.type === 'error') {
        setCatStatus(msg.catId, 'error');
        const ref = activeRefs.current.get(msg.catId);
        if (ref) {
          setStreaming(ref.id, false);
          activeRefs.current.delete(msg.catId);
        }
        addMessage({
          id: `err-${Date.now()}-${msg.catId}`,
          type: 'system',
          catId: msg.catId,
          content: `Error: ${msg.error ?? 'Unknown error'}`,
          timestamp: Date.now(),
        });
        // Only stop loading on isFinal; size===0 would false-positive in serial gaps
        if (msg.isFinal) {
          setLoading(false);
          setIntentMode(null);
        }
      }
    },
    [addMessage, appendToMessage, setStreaming, setLoading, setIntentMode, setCatStatus, clearCatStatuses]
  );

  const handleStop = useCallback(
    (cancelFn: (threadId: string) => void, threadId: string) => {
      cancelFn(threadId);
      setLoading(false);
      setIntentMode(null);
      clearCatStatuses();
      // Stop all active streams
      for (const ref of activeRefs.current.values()) {
        setStreaming(ref.id, false);
      }
      activeRefs.current.clear();
    },
    [setLoading, setStreaming, setIntentMode, clearCatStatuses]
  );

  const resetRefs = useCallback(() => {
    activeRefs.current.clear();
  }, []);

  return { handleAgentMessage, handleStop, resetRefs };
}
