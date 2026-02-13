import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../chatStore';
import type { ChatMessage } from '../chat-types';

function makeMsg(id: string, content = 'hello'): ChatMessage {
  return { id, type: 'user', content, timestamp: Date.now() };
}

describe('chatStore multi-thread state', () => {
  beforeEach(() => {
    // Reset store to initial state
    useChatStore.setState({
      messages: [],
      isLoading: false,
      isLoadingHistory: false,
      hasMore: true,
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
      currentThreadId: 'thread-a',
      currentProjectPath: 'default',
      threads: [],
      isLoadingThreads: false,
    });
  });

  it('preserves messages when switching threads', () => {
    const store = useChatStore.getState();

    // Add messages to thread A
    store.addMessage(makeMsg('a1', 'from A'));
    store.addMessage(makeMsg('a2', 'also from A'));
    expect(useChatStore.getState().messages).toHaveLength(2);

    // Switch to thread B
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().currentThreadId).toBe('thread-b');
    expect(useChatStore.getState().messages).toHaveLength(0); // fresh thread

    // Add messages to thread B
    useChatStore.getState().addMessage(makeMsg('b1', 'from B'));
    expect(useChatStore.getState().messages).toHaveLength(1);

    // Switch back to thread A — messages should be restored
    useChatStore.getState().setCurrentThread('thread-a');
    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe('a1');
    expect(msgs[1].id).toBe('a2');
  });

  it('preserves catStatuses when switching threads', () => {
    // Set cat status on thread A
    useChatStore.getState().setTargetCats(['opus', 'codex']);
    useChatStore.getState().setCatStatus('opus', 'streaming');
    expect(useChatStore.getState().catStatuses['opus']).toBe('streaming');

    // Switch to thread B
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().targetCats).toHaveLength(0);
    expect(useChatStore.getState().catStatuses).toEqual({});

    // Switch back to thread A — statuses restored
    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().targetCats).toEqual(['opus', 'codex']);
    expect(useChatStore.getState().catStatuses['opus']).toBe('streaming');
  });

  it('preserves intentMode when switching threads', () => {
    useChatStore.getState().setIntentMode('ideate');
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().intentMode).toBeNull();

    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().intentMode).toBe('ideate');
  });

  it('preserves currentMode when switching threads', () => {
    const mode = { name: 'brainstorm', config: { topic: 'test' }, startedAt: '2026-01-01' };
    useChatStore.getState().setCurrentMode(mode);
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().currentMode).toBeNull();

    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().currentMode).toEqual(mode);
  });

  it('does nothing when switching to same thread', () => {
    useChatStore.getState().addMessage(makeMsg('x1'));
    const before = useChatStore.getState();
    useChatStore.getState().setCurrentThread('thread-a');
    const after = useChatStore.getState();
    expect(before).toBe(after); // exact same reference (no state change)
  });

  describe('addMessageToThread', () => {
    it('adds to flat state when thread is active', () => {
      useChatStore.getState().addMessageToThread('thread-a', makeMsg('m1'));
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('adds to map when thread is not active', () => {
      useChatStore.getState().addMessageToThread('thread-b', makeMsg('m1'));
      // Flat state unchanged
      expect(useChatStore.getState().messages).toHaveLength(0);
      // Map updated
      const ts = useChatStore.getState().threadStates['thread-b'];
      expect(ts).toBeDefined();
      expect(ts!.messages).toHaveLength(1);
      expect(ts!.unreadCount).toBe(1);
    });

    it('deduplicates by id', () => {
      useChatStore.getState().addMessageToThread('thread-b', makeMsg('m1'));
      useChatStore.getState().addMessageToThread('thread-b', makeMsg('m1'));
      const ts = useChatStore.getState().threadStates['thread-b'];
      expect(ts!.messages).toHaveLength(1);
    });
  });

  describe('getThreadState', () => {
    it('returns active thread state from flat fields', () => {
      useChatStore.getState().addMessage(makeMsg('g1'));
      useChatStore.getState().setLoading(true);
      const ts = useChatStore.getState().getThreadState('thread-a');
      expect(ts.messages).toHaveLength(1);
      expect(ts.isLoading).toBe(true);
    });

    it('returns background thread state from map', () => {
      useChatStore.getState().addMessageToThread('thread-c', makeMsg('g2'));
      const ts = useChatStore.getState().getThreadState('thread-c');
      expect(ts.messages).toHaveLength(1);
    });

    it('returns defaults for unknown thread', () => {
      const ts = useChatStore.getState().getThreadState('thread-unknown');
      expect(ts.messages).toHaveLength(0);
      expect(ts.isLoading).toBe(false);
    });
  });

  describe('unread tracking', () => {
    it('incrementUnread updates background thread', () => {
      // Set up a background thread with state
      useChatStore.getState().addMessageToThread('thread-b', makeMsg('u1'));
      useChatStore.getState().incrementUnread('thread-b');
      const ts = useChatStore.getState().threadStates['thread-b'];
      // 1 from addMessageToThread + 1 from incrementUnread
      expect(ts!.unreadCount).toBe(2);
    });

    it('clearUnread resets count', () => {
      useChatStore.getState().addMessageToThread('thread-b', makeMsg('u2'));
      useChatStore.getState().clearUnread('thread-b');
      expect(useChatStore.getState().threadStates['thread-b']!.unreadCount).toBe(0);
    });

    it('incrementUnread is no-op for active thread', () => {
      const before = useChatStore.getState();
      useChatStore.getState().incrementUnread('thread-a');
      const after = useChatStore.getState();
      expect(before).toBe(after);
    });
  });

  describe('viewMode', () => {
    it('defaults to single', () => {
      expect(useChatStore.getState().viewMode).toBe('single');
    });

    it('can switch to split', () => {
      useChatStore.getState().setViewMode('split');
      expect(useChatStore.getState().viewMode).toBe('split');
    });

    it('manages split pane thread IDs', () => {
      useChatStore.getState().setSplitPaneThreadIds(['a', 'b', 'c', 'd']);
      expect(useChatStore.getState().splitPaneThreadIds).toEqual(['a', 'b', 'c', 'd']);
    });

    it('manages split pane target', () => {
      useChatStore.getState().setSplitPaneTarget('b');
      expect(useChatStore.getState().splitPaneTargetId).toBe('b');
    });
  });

  it('preserves isLoading across thread switches', () => {
    useChatStore.getState().setLoading(true);
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().isLoading).toBe(false); // fresh thread

    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().isLoading).toBe(true); // restored
  });

  describe('updateThreadCatStatus', () => {
    it('updates active thread cat status via flat state', () => {
      useChatStore.getState().updateThreadCatStatus('thread-a', 'opus', 'streaming');
      expect(useChatStore.getState().catStatuses['opus']).toBe('streaming');
    });

    it('updates background thread cat status in map', () => {
      useChatStore.getState().updateThreadCatStatus('thread-b', 'codex', 'error');
      const ts = useChatStore.getState().threadStates['thread-b'];
      expect(ts).toBeDefined();
      expect(ts!.catStatuses['codex']).toBe('error');
    });

    it('preserves existing cat statuses when updating one cat', () => {
      useChatStore.getState().updateThreadCatStatus('thread-b', 'opus', 'streaming');
      useChatStore.getState().updateThreadCatStatus('thread-b', 'codex', 'done');
      const ts = useChatStore.getState().threadStates['thread-b']!;
      expect(ts.catStatuses['opus']).toBe('streaming');
      expect(ts.catStatuses['codex']).toBe('done');
    });

    it('updates lastActivity when updating background thread', () => {
      const before = Date.now();
      useChatStore.getState().updateThreadCatStatus('thread-b', 'opus', 'done');
      const ts = useChatStore.getState().threadStates['thread-b']!;
      expect(ts.lastActivity).toBeGreaterThanOrEqual(before);
    });
  });

  it('handles rapid multi-thread switches', () => {
    // thread-a: add message
    useChatStore.getState().addMessage(makeMsg('r1'));
    // switch to b
    useChatStore.getState().setCurrentThread('thread-b');
    useChatStore.getState().addMessage(makeMsg('r2'));
    // switch to c
    useChatStore.getState().setCurrentThread('thread-c');
    useChatStore.getState().addMessage(makeMsg('r3'));
    // switch back to a
    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['r1']);
    // switch to b
    useChatStore.getState().setCurrentThread('thread-b');
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['r2']);
    // switch to c
    useChatStore.getState().setCurrentThread('thread-c');
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['r3']);
  });
});
