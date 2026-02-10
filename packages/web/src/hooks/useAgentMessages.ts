'use client';

import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { compactToolResultDetail } from '@/utils/toolPreview';

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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function safeJsonPreview(value: unknown, maxLength: number): string {
  try {
    const raw = JSON.stringify(value);
    return truncate(raw, maxLength);
  } catch {
    return '[unserializable input]';
  }
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
    appendToolEvent,
    setStreaming,
    setLoading,
    setIntentMode,
    setCatStatus,
    clearCatStatuses,
  } = useChatStore();

  /** Map<catId, { id: messageId, catId }> — one entry per active stream */
  const activeRefs = useRef<Map<string, { id: string; catId: string }>>(new Map());

  /** Current A2A group ID — set on a2a_handoff, cleared on done(isFinal) */
  const a2aGroupRef = useRef<string | null>(null);

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
            ...(a2aGroupRef.current ? { a2aGroupId: a2aGroupRef.current } : {}),
            timestamp: Date.now(),
            isStreaming: true,
          });
        }
      } else if (msg.type === 'tool_use') {
        setCatStatus(msg.catId, 'streaming');
        const existing = activeRefs.current.get(msg.catId);
        let messageId = existing?.id;
        if (!messageId) {
          messageId = `msg-${Date.now()}-${msg.catId}`;
          activeRefs.current.set(msg.catId, { id: messageId, catId: msg.catId });
          addMessage({
            id: messageId,
            type: 'assistant',
            catId: msg.catId,
            content: '',
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: Date.now(),
            isStreaming: true,
          });
        }

        const toolName = msg.toolName ?? 'unknown';
        const detail = msg.toolInput
          ? safeJsonPreview(msg.toolInput, 200)
          : undefined;
        appendToolEvent(messageId, {
          id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'tool_use',
          label: `${msg.catId} → ${toolName}`,
          ...(detail ? { detail } : {}),
          timestamp: Date.now(),
        });
      } else if (msg.type === 'tool_result') {
        setCatStatus(msg.catId, 'streaming');
        const existing = activeRefs.current.get(msg.catId);
        let messageId = existing?.id;
        if (!messageId) {
          messageId = `msg-${Date.now()}-${msg.catId}`;
          activeRefs.current.set(msg.catId, { id: messageId, catId: msg.catId });
          addMessage({
            id: messageId,
            type: 'assistant',
            catId: msg.catId,
            content: '',
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: Date.now(),
            isStreaming: true,
          });
        }

        const detail = compactToolResultDetail(msg.content ?? '');
        appendToolEvent(messageId, {
          id: `toolr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'tool_result',
          label: `${msg.catId} ← result`,
          detail,
          timestamp: Date.now(),
        });
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
          a2aGroupRef.current = null;
        }
      } else if (msg.type === 'a2a_handoff') {
        // Start or continue an A2A group
        if (!a2aGroupRef.current) {
          a2aGroupRef.current = `a2a-group-${Date.now()}`;
        }
        addMessage({
          id: `a2a-${Date.now()}-${msg.catId}`,
          type: 'system',
          variant: 'info',
          content: msg.content ?? '',
          a2aGroupId: a2aGroupRef.current,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'system_info') {
        // System notifications: budget warnings, cancel feedback, A2A follow-up hints
        let sysContent = msg.content ?? '';
        let sysVariant: 'info' | 'a2a_followup' = 'info';
        try {
          const parsed = JSON.parse(sysContent);
          if (parsed?.type === 'a2a_followup_available') {
            const mentions = parsed.mentions as Array<{ catId: string; mentionedBy: string }>;
            sysContent = mentions.map((m) => `${m.mentionedBy} @了 ${m.catId}`).join('、');
            sysVariant = 'a2a_followup';
          }
        } catch { /* not JSON, use raw content */ }
        addMessage({
          id: `sysinfo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          variant: sysVariant,
          content: sysContent,
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
    [addMessage, appendToMessage, appendToolEvent, setStreaming, setLoading, setIntentMode, setCatStatus, clearCatStatuses, resetTimeout, clearDoneTimeout]
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
