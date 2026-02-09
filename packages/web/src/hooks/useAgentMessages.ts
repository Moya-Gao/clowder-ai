'use client';

import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';

/** Timeout for done(isFinal) - 5 minutes */
const DONE_TIMEOUT_MS = 5 * 60 * 1000;

interface AgentMsg {
  type: string;
  catId: string;
  content?: string;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string };
  /** Tool name (for 'tool_use' events from backend) */
  toolName?: string;
  /** Tool input params (for 'tool_use' events from backend) */
  toolInput?: Record<string, unknown>;
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

  /** Timeout ref for done(isFinal) reachability */
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Start or reset the done timeout */
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      // Timeout fired — stop loading and show system message
      setLoading(false);
      setIntentMode(null);
      clearCatStatuses();
      for (const ref of activeRefs.current.values()) {
        setStreaming(ref.id, false);
      }
      activeRefs.current.clear();
      addMessage({
        id: `sysinfo-timeout-${Date.now()}`,
        type: 'system',
        variant: 'info',
        content: '⏱ Response timed out. The operation may still be running in the background.',
        timestamp: Date.now(),
      });
    }, DONE_TIMEOUT_MS);
  }, [setLoading, setIntentMode, clearCatStatuses, setStreaming, addMessage]);

  /** Clear the timeout (called on done with isFinal) */
  const clearDoneTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleAgentMessage = useCallback(
    (msg: AgentMsg) => {
      // Reset timeout on any message (keeps timer alive during streaming)
      resetTimeout();

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
          clearDoneTimeout();
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
      } else if (msg.type === 'tool_use') {
        // Show tool invocation for observability (BACKLOG F9)
        const toolName = msg.toolName ?? 'unknown';
        const inputSummary = msg.toolInput
          ? JSON.stringify(msg.toolInput).slice(0, 200)
          : '';
        addMessage({
          id: `tool-${Date.now()}-${msg.catId}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          variant: 'tool',
          content: `🔧 ${msg.catId} → ${toolName}${inputSummary ? ` ${inputSummary}` : ''}`,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'tool_result') {
        // Show tool result summary for observability (BACKLOG F9)
        const resultText = msg.content
          ? msg.content.slice(0, 300)
          : '(no output)';
        addMessage({
          id: `toolr-${Date.now()}-${msg.catId}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          variant: 'tool',
          content: `📋 ${msg.catId} ← ${resultText}`,
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
    [addMessage, appendToMessage, setStreaming, setLoading, setIntentMode, setCatStatus, clearCatStatuses, resetTimeout, clearDoneTimeout]
  );

  const handleStop = useCallback(
    (cancelFn: (threadId: string) => void, threadId: string) => {
      cancelFn(threadId);
      clearDoneTimeout();
      setLoading(false);
      setIntentMode(null);
      clearCatStatuses();
      // Stop all active streams
      for (const ref of activeRefs.current.values()) {
        setStreaming(ref.id, false);
      }
      activeRefs.current.clear();
    },
    [setLoading, setStreaming, setIntentMode, clearCatStatuses, clearDoneTimeout]
  );

  const resetRefs = useCallback(() => {
    activeRefs.current.clear();
  }, []);

  return { handleAgentMessage, handleStop, resetRefs, resetTimeout, clearDoneTimeout };
}
