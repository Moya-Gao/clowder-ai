import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatHistory } from '../useChatHistory';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(),
}));

function HookHost({ threadId }: { threadId: string }) {
  useChatHistory(threadId);
  return null;
}

describe('useChatHistory thread switch ordering', () => {
  let container: HTMLDivElement;
  let root: Root;
  const apiFetchMock = vi.mocked(apiFetch);

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useChatStore.setState({
      messages: [{ id: 'a1', type: 'user', content: 'thread-a message', timestamp: Date.now() }],
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
      currentThreadId: 'thread-a',
      viewMode: 'single',
      splitPaneThreadIds: [],
      splitPaneTargetId: null,
      currentProjectPath: 'default',
      threads: [],
      isLoadingThreads: false,
    });

    // Keep requests pending so this test only observes immediate switch side-effects.
    apiFetchMock.mockImplementation(() => new Promise<Response>(() => { }));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    apiFetchMock.mockReset();
  });

  it('does not clear previous thread messages before setCurrentThread runs', () => {
    act(() => {
      root.render(React.createElement(HookHost, { threadId: 'thread-b' }));
    });

    const state = useChatStore.getState();
    expect(state.currentThreadId).toBe('thread-a');
    expect(state.messages.map((m) => m.id)).toEqual(['a1']);
  });

  it('clears messages when thread is already synced with no cache', () => {
    act(() => {
      root.render(React.createElement(HookHost, { threadId: 'thread-a' }));
    });

    const state = useChatStore.getState();
    expect(state.currentThreadId).toBe('thread-a');
    expect(state.messages).toHaveLength(0);
  });
});
