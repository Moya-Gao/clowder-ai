/**
 * P1-2 + P2 regression tests for background thread socket message handling.
 *
 * Since useSocket is a React hook with socket.io dependency,
 * we test the background message processing logic at the store level
 * by simulating what the socket handler should do.
 *
 * We extract the expected behavior from useSocket and verify the store actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@/stores/chatStore';
import { useToastStore } from '@/stores/toastStore';

/** Monotonic counter matching useSocket.ts bgSeq */
let testBgSeq = 0;

/**
 * Simulates the background-thread branch of the agent_message handler.
 * This mirrors the logic in useSocket.ts (post-fix version).
 */
function simulateBackgroundMessage(msg: {
  type: string;
  catId: string;
  threadId: string;
  content?: string;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string };
  timestamp: number;
}) {
  const store = useChatStore.getState();

  if (msg.type === 'text' && msg.content) {
    store.addMessageToThread(msg.threadId, {
      id: `bg-${msg.timestamp}-${msg.catId}-${testBgSeq++}`,
      type: 'assistant',
      catId: msg.catId,
      content: msg.content,
      ...(msg.metadata ? { metadata: msg.metadata } : {}),
      timestamp: msg.timestamp,
    });
    store.updateThreadCatStatus(msg.threadId, msg.catId, msg.isFinal ? 'done' : 'streaming');
    if (msg.isFinal) {
      useToastStore.getState().addToast({
        type: 'success',
        title: `${msg.catId} 完成`,
        message: msg.content.slice(0, 80),
        threadId: msg.threadId,
        duration: 5000,
      });
    }
  } else if (msg.type === 'error') {
    store.addMessageToThread(msg.threadId, {
      id: `bg-err-${msg.timestamp}-${msg.catId}-${testBgSeq++}`,
      type: 'system',
      catId: msg.catId,
      content: `Error: ${msg.error ?? 'Unknown error'}`,
      timestamp: msg.timestamp,
    });
    store.updateThreadCatStatus(msg.threadId, msg.catId, 'error');
    useToastStore.getState().addToast({
      type: 'error',
      title: `${msg.catId} 出错`,
      message: msg.error ?? 'Unknown error',
      threadId: msg.threadId,
      duration: 8000,
    });
  } else if (msg.type === 'done') {
    // P1-2 fix: handle explicit done events from backend
    // P1-3 fix: don't overwrite error status with success
    const currentStatus = store.getThreadState(msg.threadId).catStatuses[msg.catId];
    if (currentStatus !== 'error') {
      store.updateThreadCatStatus(msg.threadId, msg.catId, 'done');
      useToastStore.getState().addToast({
        type: 'success',
        title: `${msg.catId} 完成`,
        message: `${msg.catId} 已完成处理`,
        threadId: msg.threadId,
        duration: 5000,
      });
    }
  } else if (msg.type === 'status') {
    const statusMap: Record<string, string> = { streaming: 'streaming', thinking: 'pending', done: 'done' };
    const mapped = statusMap[msg.content ?? ''] ?? 'streaming';
    store.updateThreadCatStatus(msg.threadId, msg.catId, mapped as 'streaming' | 'pending' | 'done');
  }
}

describe('background thread socket handling', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isLoading: false,
      isLoadingHistory: false,
      hasMore: true,
      hasActiveInvocation: false,
      intentMode: null,
      targetCats: [],
      catStatuses: {},
      catInvocations: {},
      currentMode: null,
      pendingModeSwitchProposal: null,
      threadStates: {},
      viewMode: 'single',
      splitPaneThreadIds: [],
      splitPaneTargetId: null,
      currentThreadId: 'thread-active',
      currentProjectPath: 'default',
      threads: [],
      isLoadingThreads: false,
    });
    useToastStore.setState({ toasts: [] });
    testBgSeq = 0;
  });

  describe('P1-2: done event handling', () => {
    it('done event updates cat status to done', () => {
      // First set streaming status
      useChatStore.getState().updateThreadCatStatus('thread-bg', 'opus', 'streaming');

      simulateBackgroundMessage({
        type: 'done',
        catId: 'opus',
        threadId: 'thread-bg',
        timestamp: Date.now(),
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      expect(ts.catStatuses['opus']).toBe('done');
    });

    it('done event fires success toast', () => {
      simulateBackgroundMessage({
        type: 'done',
        catId: 'codex',
        threadId: 'thread-bg',
        timestamp: Date.now(),
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].title).toBe('codex 完成');
      expect(toasts[0].threadId).toBe('thread-bg');
    });

    it('text with isFinal also transitions to done', () => {
      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'final answer',
        isFinal: true,
        timestamp: Date.now(),
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      expect(ts.catStatuses['opus']).toBe('done');
    });
  });

  describe('P1-3 (R2): error must not be overwritten by done', () => {
    it('done after error preserves error status', () => {
      // Backend sends error then done
      simulateBackgroundMessage({
        type: 'error',
        catId: 'opus',
        threadId: 'thread-bg',
        error: 'something broke',
        timestamp: Date.now(),
      });
      // Status should be error
      expect(useChatStore.getState().getThreadState('thread-bg').catStatuses['opus']).toBe('error');

      simulateBackgroundMessage({
        type: 'done',
        catId: 'opus',
        threadId: 'thread-bg',
        timestamp: Date.now(),
      });

      // Status must still be error, NOT done
      const ts = useChatStore.getState().getThreadState('thread-bg');
      expect(ts.catStatuses['opus']).toBe('error');
    });

    it('done after error does not emit success toast', () => {
      simulateBackgroundMessage({
        type: 'error',
        catId: 'opus',
        threadId: 'thread-bg',
        error: 'fail',
        timestamp: Date.now(),
      });
      // 1 error toast
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].type).toBe('error');

      simulateBackgroundMessage({
        type: 'done',
        catId: 'opus',
        threadId: 'thread-bg',
        timestamp: Date.now(),
      });

      // Should still be just 1 toast (the error), no success toast added
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('P2: message ID uniqueness', () => {
    it('multiple chunks in same ms should not collide', () => {
      const now = Date.now();

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'chunk 1',
        timestamp: now,
      });

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'chunk 2',
        timestamp: now, // Same ms!
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      // Both chunks should be stored (not deduplicated)
      expect(ts.messages).toHaveLength(2);
      expect(ts.messages[0].content).toBe('chunk 1');
      expect(ts.messages[1].content).toBe('chunk 2');
    });
  });
});
