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
import {
  handleBackgroundAgentMessage,
  clearBackgroundStreamRefForActiveEvent,
  cleanupDroppedActiveTerminalBackgroundStream,
  type BackgroundAgentMessage,
} from '../useSocket-background';

/** Monotonic counter matching useSocket.ts bgSeq */
let testBgSeq = 0;
const testBgStreamRefs = new Map<string, { id: string; threadId: string; catId: string }>();

/**
 * Runs the extracted background-thread branch handler with real stores.
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
  handleBackgroundAgentMessage(msg as BackgroundAgentMessage, {
    store: useChatStore.getState(),
    bgStreamRefs: testBgStreamRefs,
    nextBgSeq: () => testBgSeq++,
    addToast: (toast) => useToastStore.getState().addToast(toast),
  });
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
    testBgStreamRefs.clear();
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

  describe('R2-P2: text(isFinal) clears hasActiveInvocation', () => {
    it('background text with isFinal clears hasActiveInvocation for that thread', () => {
      // Set up: switch to thread-bg, mark active invocation, switch away
      useChatStore.getState().setCurrentThread('thread-bg');
      useChatStore.getState().setHasActiveInvocation(true);
      // Switch back to thread-active — thread-bg gets snapshotted with hasActiveInvocation=true
      useChatStore.getState().setCurrentThread('thread-active');
      expect(useChatStore.getState().threadStates['thread-bg']?.hasActiveInvocation).toBe(true);

      // Simulate background text(isFinal)
      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'final answer',
        isFinal: true,
        timestamp: Date.now(),
      });

      // hasActiveInvocation should be cleared
      expect(useChatStore.getState().threadStates['thread-bg']?.hasActiveInvocation).toBe(false);
    });
  });

  describe('P2: message ID uniqueness', () => {
    it('same timestamp but different cats still create separate messages', () => {
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
        catId: 'codex',
        threadId: 'thread-bg',
        content: 'chunk 2',
        timestamp: now, // Same ms!
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      // Different cats should produce different messages even with same timestamp
      expect(ts.messages).toHaveLength(2);
      expect(ts.messages[0].content).toBe('chunk 1');
      expect(ts.messages[1].content).toBe('chunk 2');
    });
  });

  describe('regression: background stream chunk merging', () => {
    it('merges text chunks from same cat/thread into one assistant message', () => {
      const now = Date.now();

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: '你',
        timestamp: now,
      });

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: '好',
        timestamp: now + 1,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      expect(ts.messages).toHaveLength(1);
      expect(ts.messages[0].content).toBe('你好');
    });

    it('multi-chunk with final chunk closes streaming and keeps merged content', () => {
      const now = Date.now();

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: '你',
        timestamp: now,
      });
      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: '好',
        timestamp: now + 1,
      });
      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: '呀',
        isFinal: true,
        timestamp: now + 2,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      expect(ts.messages).toHaveLength(1);
      expect(ts.messages[0].content).toBe('你好呀');
      expect(ts.messages[0].isStreaming).toBe(false);
      expect(testBgStreamRefs.has('thread-bg::opus')).toBe(false);
    });

    it('error during streaming clears ref and stops existing stream message', () => {
      const now = Date.now();

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'partial',
        timestamp: now,
      });

      const streamKey = 'thread-bg::opus';
      const messageId = testBgStreamRefs.get(streamKey)?.id;
      expect(messageId).toBeDefined();

      simulateBackgroundMessage({
        type: 'error',
        catId: 'opus',
        threadId: 'thread-bg',
        error: 'oops',
        timestamp: now + 1,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      const merged = ts.messages.find((m) => m.id === messageId);
      expect(merged?.isStreaming).toBe(false);
      expect(testBgStreamRefs.has(streamKey)).toBe(false);
    });

    it('active non-terminal event must not clear background ref needed by later background done', () => {
      const now = Date.now();
      const streamKey = 'thread-bg::opus';

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'partial',
        timestamp: now,
      });

      const messageId = testBgStreamRefs.get(streamKey)?.id;
      expect(messageId).toBeDefined();

      // Simulate thread became active and received non-terminal text chunk.
      clearBackgroundStreamRefForActiveEvent({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'more',
        timestamp: now + 1,
      }, testBgStreamRefs);

      // Switch away again; terminal done is now handled by background branch.
      simulateBackgroundMessage({
        type: 'done',
        catId: 'opus',
        threadId: 'thread-bg',
        timestamp: now + 2,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      const merged = ts.messages.find((m) => m.id === messageId);
      expect(merged?.isStreaming).toBe(false);
      expect(testBgStreamRefs.has(streamKey)).toBe(false);
    });

    it('active non-final error must not clear background ref before terminal background event', () => {
      const now = Date.now();
      const streamKey = 'thread-bg::opus';

      simulateBackgroundMessage({
        type: 'text',
        catId: 'opus',
        threadId: 'thread-bg',
        content: 'partial',
        timestamp: now,
      });

      const messageId = testBgStreamRefs.get(streamKey)?.id;
      expect(messageId).toBeDefined();

      clearBackgroundStreamRefForActiveEvent({
        type: 'error',
        catId: 'opus',
        threadId: 'thread-bg',
        error: 'transient',
        isFinal: false,
        timestamp: now + 1,
      }, testBgStreamRefs);

      simulateBackgroundMessage({
        type: 'done',
        catId: 'opus',
        threadId: 'thread-bg',
        timestamp: now + 2,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      const merged = ts.messages.find((m) => m.id === messageId);
      expect(merged?.isStreaming).toBe(false);
      expect(testBgStreamRefs.has(streamKey)).toBe(false);
    });

    it('suppressed active terminal event clears stale ref and prevents next invocation merge', () => {
      const now = Date.now();
      const streamKey = 'thread-bg::codex';

      simulateBackgroundMessage({
        type: 'text',
        catId: 'codex',
        threadId: 'thread-bg',
        content: 'partial',
        timestamp: now,
      });
      expect(testBgStreamRefs.has(streamKey)).toBe(true);
      const firstMessageId = testBgStreamRefs.get(streamKey)?.id;
      expect(firstMessageId).toBeDefined();

      // Simulate active-thread terminal event dropped by ChatContainer suppression window.
      cleanupDroppedActiveTerminalBackgroundStream(
        {
          type: 'done',
          catId: 'codex',
          threadId: 'thread-bg',
          timestamp: now + 1,
        },
        {
          store: useChatStore.getState(),
          bgStreamRefs: testBgStreamRefs,
        }
      );

      const stateAfterDrop = useChatStore.getState().getThreadState('thread-bg');
      const firstMessageAfterDrop = stateAfterDrop.messages.find((m) => m.id === firstMessageId);
      expect(firstMessageAfterDrop?.isStreaming).toBe(false);
      expect(testBgStreamRefs.has(streamKey)).toBe(false);

      simulateBackgroundMessage({
        type: 'text',
        catId: 'codex',
        threadId: 'thread-bg',
        content: 'new invocation',
        timestamp: now + 2,
      });

      const ts = useChatStore.getState().getThreadState('thread-bg');
      const first = ts.messages.find((m) => m.id === firstMessageId);
      const second = ts.messages.find((m) => m.id !== firstMessageId);
      expect(ts.messages).toHaveLength(2);
      expect(first?.content).toBe('partial');
      expect(second?.content).toBe('new invocation');
    });
  });
});
