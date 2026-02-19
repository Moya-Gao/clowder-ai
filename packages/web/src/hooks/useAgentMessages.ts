'use client';

import { useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { compactToolResultDetail } from '@/utils/toolPreview';

/** Timeout for done(isFinal) - 5 minutes */
const DONE_TIMEOUT_MS = 5 * 60 * 1000;
/** Monotonic counter for collision-safe callback bubble IDs */
let cbSeq = 0;
const DEBUG_SKIP_FILE_CHANGE_UI = process.env.NEXT_PUBLIC_DEBUG_SKIP_FILE_CHANGE_UI === '1';

interface AgentMsg {
  type: string;
  catId: string;
  content?: string;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string; usage?: import('../stores/chat-types').TokenUsage };
  /** Tool name (for 'tool_use' events from backend) */
  toolName?: string;
  /** Tool input params (for 'tool_use' events from backend) */
  toolInput?: Record<string, unknown>;
  /** Message origin: stream = CLI stdout (thinking), callback = MCP post_message (speech) */
  origin?: 'stream' | 'callback';
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
    appendRichBlock,
    setStreaming,
    setLoading,
    setHasActiveInvocation,
    setIntentMode,
    setCatStatus,
    clearCatStatuses,
    setCatInvocation,
    setMessageUsage,
    setPendingModeSwitchProposal,
    currentThreadId,
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
    const timeoutThreadId = useChatStore.getState().currentThreadId;
    timeoutRef.current = setTimeout(() => {
      const store = useChatStore.getState();
      const isActiveThreadTimeout = store.currentThreadId === timeoutThreadId;

      if (!isActiveThreadTimeout) {
        const threadState = store.getThreadState(timeoutThreadId);
        for (const message of threadState.messages) {
          if (message.type === 'assistant' && message.isStreaming) {
            store.setThreadMessageStreaming(timeoutThreadId, message.id, false);
          }
        }
        store.resetThreadInvocationState(timeoutThreadId);
        store.addMessageToThread(timeoutThreadId, {
          id: `sysinfo-timeout-${Date.now()}`,
          type: 'system',
          variant: 'info',
          content: '⏱ Response timed out. The operation may still be running in the background.',
          timestamp: Date.now(),
        });
        return;
      }

      // Timeout fired — stop loading and show system message
      setLoading(false);
      setHasActiveInvocation(false);
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
  }, [setLoading, setHasActiveInvocation, setIntentMode, clearCatStatuses, setStreaming, addMessage]);

  /** Clear the timeout (called on done with isFinal) */
  const clearDoneTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const findStreamingMessageId = useCallback((catId: string): string | null => {
    const currentMessages = useChatStore.getState().messages;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      const msg = currentMessages[i];
      if (msg.type === 'assistant' && msg.catId === catId && msg.isStreaming) {
        return msg.id;
      }
    }
    return null;
  }, []);

  const handleAgentMessage = useCallback(
    (msg: AgentMsg) => {
      // Reset timeout on any message (keeps timer alive during streaming)
      resetTimeout();

      if (msg.type === 'text' && msg.content) {
        setCatStatus(msg.catId, 'streaming');

        if (msg.origin === 'callback') {
          // MCP callback message: always a separate bubble (never merge into stream)
          const id = `msg-${Date.now()}-${msg.catId}-cb-${++cbSeq}`;
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            origin: 'callback',
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            ...(a2aGroupRef.current ? { a2aGroupId: a2aGroupRef.current } : {}),
            timestamp: Date.now(),
          });
        } else {
          // CLI stream message (thinking): append to active stream bubble
          const existing = activeRefs.current.get(msg.catId);
          if (existing) {
            appendToMessage(existing.id, msg.content);
          } else {
            const resumedId = findStreamingMessageId(msg.catId);
            if (resumedId) {
              // Recover background-stream message after thread switch (activeRefs are reset on switch)
              activeRefs.current.set(msg.catId, { id: resumedId, catId: msg.catId });
              appendToMessage(resumedId, msg.content);
            } else {
              // New stream message for this cat
              const id = `msg-${Date.now()}-${msg.catId}`;
              activeRefs.current.set(msg.catId, { id, catId: msg.catId });
              addMessage({
                id,
                type: 'assistant',
                catId: msg.catId,
                content: msg.content,
                origin: 'stream',
                ...(msg.metadata ? { metadata: msg.metadata } : {}),
                ...(a2aGroupRef.current ? { a2aGroupId: a2aGroupRef.current } : {}),
                timestamp: Date.now(),
                isStreaming: true,
              });
            }
          }
        }
      } else if (msg.type === 'tool_use') {
        setCatStatus(msg.catId, 'streaming');
        const toolName = msg.toolName ?? 'unknown';
        const detail = msg.toolInput ? safeJsonPreview(msg.toolInput, 200) : undefined;
        const isFileChange = toolName === 'file_change';
        if (isFileChange) {
          console.info('[agent_message] file_change tool_use received', {
            catId: msg.catId,
            activeRefCount: activeRefs.current.size,
            skipUi: DEBUG_SKIP_FILE_CHANGE_UI,
            detail: detail ?? null,
          });
          if (DEBUG_SKIP_FILE_CHANGE_UI) {
            console.warn('[agent_message] file_change UI append skipped', {
              catId: msg.catId,
              reason: 'NEXT_PUBLIC_DEBUG_SKIP_FILE_CHANGE_UI=1',
            });
            return;
          }
        }

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

        appendToolEvent(messageId, {
          id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'tool_use',
          label: `${msg.catId} → ${toolName}`,
          ...(detail ? { detail } : {}),
          timestamp: Date.now(),
        });
        if (isFileChange) {
          console.info('[agent_message] file_change tool_use appended', {
            catId: msg.catId,
            messageId,
            activeRefCount: activeRefs.current.size,
          });
        }
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
        let ref = activeRefs.current.get(msg.catId);
        if (!ref) {
          const resumedId = findStreamingMessageId(msg.catId);
          if (resumedId) {
            ref = { id: resumedId, catId: msg.catId };
          }
        }
        if (ref) {
          setStreaming(ref.id, false);
          activeRefs.current.delete(msg.catId);
        }
        if (msg.isFinal) {
          clearDoneTimeout();
          setLoading(false);
          setHasActiveInvocation(false);
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
        // System notifications: budget warnings, cancel feedback, A2A follow-up hints, invocation metrics
        let sysContent = msg.content ?? '';
        let sysVariant: 'info' | 'a2a_followup' = 'info';
        let consumed = false;
        try {
          const parsed = JSON.parse(sysContent);
          if (parsed?.type === 'a2a_followup_available') {
            const mentions = parsed.mentions as Array<{ catId: string; mentionedBy: string }>;
            sysContent = mentions.map((m) => `${m.mentionedBy} @了 ${m.catId}`).join('、');
            sysVariant = 'a2a_followup';
          } else if (parsed?.type === 'mode_switch_proposal') {
            // Mode switch confirmation: trigger ConfirmDialog via store
            const by = parsed.proposedBy ?? '猫猫';
            const cmd = parsed.command ?? `/mode ${parsed.proposedMode}`;
            setPendingModeSwitchProposal({
              proposedMode: parsed.proposedMode,
              command: cmd,
              proposedBy: by,
              threadId: currentThreadId,
            });
            sysContent = `${by} 提议切换到 ${parsed.proposedMode} 模式。`;
            sysVariant = 'info';
          } else if (parsed?.type === 'invocation_metrics') {
            // Store metrics silently — don't show as system message
            if (parsed.kind === 'session_started') {
              setCatInvocation(msg.catId, {
                sessionId: parsed.sessionId,
                invocationId: parsed.invocationId,
                startedAt: Date.now(),
                taskProgress: { tasks: [], lastUpdate: 0 },
                ...(parsed.sessionSeq !== undefined ? { sessionSeq: parsed.sessionSeq, sessionSealed: false } : {}),
              });
            } else if (parsed.kind === 'invocation_complete') {
              setCatInvocation(msg.catId, {
                durationMs: parsed.durationMs,
                sessionId: parsed.sessionId,
              });
            }
            consumed = true;
          } else if (parsed?.type === 'invocation_usage') {
            // F8: Store token usage silently — don't show as system message
            setCatInvocation(msg.catId, {
              usage: parsed.usage,
            });
            // Also persist usage on the cat's last assistant message (message-scoped)
            const ref = activeRefs.current.get(msg.catId);
            if (ref) {
              setMessageUsage(ref.id, parsed.usage);
            }
            consumed = true;
          } else if (parsed?.type === 'context_health') {
            // F24: Store context health silently
            const targetCatId = parsed.catId ?? msg.catId;
            if (targetCatId) {
              setCatInvocation(targetCatId, {
                contextHealth: parsed.health,
              });
              consumed = true;
            }
          } else if (parsed?.type === 'task_progress') {
            // F26: Store task progress silently
            const tasks = (parsed.tasks ?? []) as import('../stores/chat-types').TaskProgressItem[];
            setCatInvocation(parsed.catId ?? msg.catId, {
              taskProgress: {
                tasks,
                lastUpdate: Date.now(),
              },
            });
            consumed = true;
          } else if (parsed?.type === 'rich_block') {
            // F22: Append rich block to current cat's active message
            let ref = activeRefs.current.get(msg.catId);
            if (!ref) {
              // Callback-first: rich block arrived before text/tool_use — create message ref
              const id = `msg-${Date.now()}-${msg.catId}`;
              activeRefs.current.set(msg.catId, { id, catId: msg.catId });
              addMessage({
                id,
                type: 'assistant',
                catId: msg.catId,
                content: '',
                timestamp: Date.now(),
                isStreaming: true,
              });
              ref = activeRefs.current.get(msg.catId)!;
            }
            if (parsed.block) {
              appendRichBlock(ref.id, parsed.block);
            }
            consumed = true;
          } else if (parsed?.type === 'session_seal_requested') {
            // F24 Phase B: Session sealed — update session info + show notification
            setCatInvocation(parsed.catId, {
              sessionSeq: parsed.sessionSeq,
              sessionSealed: true,
            });
            const pct = parsed.healthSnapshot?.fillRatio ? Math.round(parsed.healthSnapshot.fillRatio * 100) : '?';
            sysContent = `${parsed.catId} 的会话 #${parsed.sessionSeq} 已封存（上下文 ${pct}%），下次调用将自动创建新会话`;
          }
        } catch {
          /* not JSON, use raw content */
        }
        if (!consumed) {
          addMessage({
            id: `sysinfo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'system',
            variant: sysVariant,
            content: sysContent,
            timestamp: Date.now(),
          });
        }
      } else if (msg.type === 'error') {
        setCatStatus(msg.catId, 'error');
        let ref = activeRefs.current.get(msg.catId);
        if (!ref) {
          const resumedId = findStreamingMessageId(msg.catId);
          if (resumedId) {
            ref = { id: resumedId, catId: msg.catId };
          }
        }
        if (ref) {
          setStreaming(ref.id, false);
          activeRefs.current.delete(msg.catId);
        }
        addMessage({
          id: `err-${Date.now()}-${msg.catId}`,
          type: 'system',
          variant: 'error',
          catId: msg.catId,
          content: `Error: ${msg.error ?? 'Unknown error'}`,
          timestamp: Date.now(),
        });
        // Only stop loading on isFinal; size===0 would false-positive in serial gaps
        if (msg.isFinal) {
          clearDoneTimeout(); // prevent 5-min timer from firing timeout text after error
          setLoading(false);
          setHasActiveInvocation(false);
          setIntentMode(null);
          // Clear ALL remaining streaming refs — global catch uses catId='opus' which may
          // not match the cat that was actually running (e.g. codex/gemini)
          for (const ref of activeRefs.current.values()) {
            setStreaming(ref.id, false);
          }
          activeRefs.current.clear();
        }
      }
    },
    [
      addMessage,
      appendToMessage,
      appendToolEvent,
      appendRichBlock,
      setStreaming,
      setLoading,
      setHasActiveInvocation,
      setIntentMode,
      setCatStatus,
      clearCatStatuses,
      setCatInvocation,
      setPendingModeSwitchProposal,
      currentThreadId,
      resetTimeout,
      clearDoneTimeout,
      findStreamingMessageId,
      setMessageUsage,
    ],
  );

  const handleStop = useCallback(
    (cancelFn: (threadId: string) => void, threadId: string) => {
      cancelFn(threadId);
      clearDoneTimeout();
      const store = useChatStore.getState();
      const isActiveThreadStop = threadId === store.currentThreadId;

      if (!isActiveThreadStop) {
        const threadState = store.getThreadState(threadId);
        for (const message of threadState.messages) {
          if (message.type === 'assistant' && message.isStreaming) {
            store.setThreadMessageStreaming(threadId, message.id, false);
          }
        }
        store.resetThreadInvocationState(threadId);
        return;
      }

      setLoading(false);
      setHasActiveInvocation(false);
      setIntentMode(null);
      clearCatStatuses();
      // Stop all active streams
      for (const ref of activeRefs.current.values()) {
        setStreaming(ref.id, false);
      }
      activeRefs.current.clear();
    },
    [setLoading, setHasActiveInvocation, setStreaming, setIntentMode, clearCatStatuses, clearDoneTimeout],
  );

  const resetRefs = useCallback(() => {
    activeRefs.current.clear();
  }, []);

  return { handleAgentMessage, handleStop, resetRefs, resetTimeout, clearDoneTimeout };
}
