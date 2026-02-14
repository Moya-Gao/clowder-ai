/**
 * P2 regression: background thread invocation lifecycle cleanup.
 *
 * When a background thread's invocation completes (done/isFinal or error/isFinal),
 * its hasActiveInvocation should be cleared in the threadStates map.
 * Otherwise, switching back to that thread would show stale "active" state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../chatStore';

describe('chatStore background thread invocation lifecycle (P2 regression)', () => {
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
      currentThreadId: 'thread-a',
      currentProjectPath: 'default',
      threads: [],
      isLoadingThreads: false,
    });
  });

  it('clearThreadActiveInvocation clears hasActiveInvocation for background thread', () => {
    const store = useChatStore.getState();

    // Thread A active: set hasActiveInvocation=true, then switch to B
    store.setHasActiveInvocation(true);
    store.setCurrentThread('thread-b');
    // Thread A is now in background with hasActiveInvocation=true
    expect(useChatStore.getState().threadStates['thread-a']?.hasActiveInvocation).toBe(true);

    // Simulate background thread A completing
    useChatStore.getState().clearThreadActiveInvocation('thread-a');

    // Should be cleared in the map
    expect(useChatStore.getState().threadStates['thread-a']?.hasActiveInvocation).toBe(false);

    // Switch back to thread A — hasActiveInvocation should be false
    useChatStore.getState().setCurrentThread('thread-a');
    expect(useChatStore.getState().hasActiveInvocation).toBe(false);
  });

  it('clearThreadActiveInvocation works on active thread too (sets flat state)', () => {
    useChatStore.getState().setHasActiveInvocation(true);
    expect(useChatStore.getState().hasActiveInvocation).toBe(true);

    useChatStore.getState().clearThreadActiveInvocation('thread-a');
    expect(useChatStore.getState().hasActiveInvocation).toBe(false);
  });

  it('clearThreadActiveInvocation is no-op for unknown thread', () => {
    useChatStore.getState().clearThreadActiveInvocation('thread-unknown');
    // Should not create a new entry in threadStates for unknown thread
    expect(useChatStore.getState().threadStates['thread-unknown']).toBeUndefined();
  });
});
