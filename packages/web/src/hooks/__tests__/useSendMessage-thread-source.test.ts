import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const mockApiFetch = vi.fn();
const mockAddMessage = vi.fn();
const mockAddMessageToThread = vi.fn();
const mockSetLoading = vi.fn();
const mockSetHasActiveInvocation = vi.fn();
const mockSetThreadLoading = vi.fn();
const mockSetThreadHasActiveInvocation = vi.fn();
const mockResetRefs = vi.fn();
const mockProcessCommand = vi.fn(async () => false);
let storeCurrentThreadId = 'thread-stale';

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/hooks/useAgentMessages', () => ({
  useAgentMessages: () => ({ resetRefs: mockResetRefs }),
}));

vi.mock('@/hooks/useChatCommands', () => ({
  useChatCommands: () => ({ processCommand: mockProcessCommand }),
}));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: Object.assign(
    () => ({
      addMessage: mockAddMessage,
      addMessageToThread: mockAddMessageToThread,
      setLoading: mockSetLoading,
      setHasActiveInvocation: mockSetHasActiveInvocation,
      setThreadLoading: mockSetThreadLoading,
      setThreadHasActiveInvocation: mockSetThreadHasActiveInvocation,
      currentThreadId: storeCurrentThreadId,
    }),
    {
      getState: () => ({ currentThreadId: storeCurrentThreadId }),
    },
  ),
}));

import { useSendMessage } from '@/hooks/useSendMessage';

function SendRunner({
  activeThreadId,
  overrideThreadId,
  onDone,
}: {
  activeThreadId?: string;
  overrideThreadId?: string;
  onDone: () => void;
}) {
  const { handleSend } = useSendMessage(activeThreadId);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    handleSend('@布偶 @缅因 看图', undefined, overrideThreadId).then(onDone);
  }, [handleSend, onDone, overrideThreadId]);

  return null;
}

describe('useSendMessage thread source', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockAddMessage.mockReset();
    mockAddMessageToThread.mockReset();
    mockSetLoading.mockReset();
    mockSetHasActiveInvocation.mockReset();
    mockSetThreadLoading.mockReset();
    mockSetThreadHasActiveInvocation.mockReset();
    mockResetRefs.mockReset();
    mockProcessCommand.mockReset();
    mockProcessCommand.mockResolvedValue(false);
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    storeCurrentThreadId = 'thread-stale';

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('uses route threadId instead of stale store currentThreadId', async () => {
    await act(async () => {
      root.render(
        React.createElement(SendRunner, {
          activeThreadId: 'thread-route',
          overrideThreadId: undefined,
          onDone: () => {},
        }),
      );
    });

    expect(mockApiFetch).toHaveBeenCalled();
    const payload = JSON.parse(String(mockApiFetch.mock.calls[0]?.[1]?.body));
    expect(payload.threadId).toBe('thread-route');
    expect(payload.threadId).not.toBe('thread-stale');
  });

  it('falls back to useChatStore.getState().currentThreadId when route threadId is absent', async () => {
    await act(async () => {
      root.render(
        React.createElement(SendRunner, {
          activeThreadId: undefined,
          overrideThreadId: undefined,
          onDone: () => {},
        }),
      );
    });

    expect(mockApiFetch).toHaveBeenCalled();
    const payload = JSON.parse(String(mockApiFetch.mock.calls[0]?.[1]?.body));
    expect(payload.threadId).toBe('thread-stale');
  });

  it('sets loading/active flags on override target thread in split-pane send', async () => {
    await act(async () => {
      root.render(
        React.createElement(SendRunner, {
          activeThreadId: 'thread-route',
          overrideThreadId: 'thread-target',
          onDone: () => {},
        }),
      );
    });

    expect(mockSetThreadLoading).toHaveBeenCalledWith('thread-target', true);
    expect(mockSetThreadHasActiveInvocation).toHaveBeenCalledWith('thread-target', true);
    expect(mockSetLoading).not.toHaveBeenCalled();
  });

  it('routes send error message to override target thread in split-pane mode', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'target thread send failed' }),
    });

    await act(async () => {
      root.render(
        React.createElement(SendRunner, {
          activeThreadId: 'thread-route',
          overrideThreadId: 'thread-target',
          onDone: () => {},
        }),
      );
    });

    const systemCall = mockAddMessageToThread.mock.calls.find(([, msg]) =>
      typeof msg === 'object' && msg !== null && 'type' in msg && (msg as { type?: string }).type === 'system',
    );
    expect(systemCall?.[0]).toBe('thread-target');
    expect(systemCall?.[1]).toMatchObject({
      type: 'system',
      variant: 'error',
      content: expect.stringContaining('target thread send failed'),
    });
  });

  it('clears invocation state for source thread when send fails after thread switch', async () => {
    let rejectFetch: ((err: Error) => void) | null = null;
    mockApiFetch.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject;
        }),
    );

    await act(async () => {
      root.render(
        React.createElement(SendRunner, {
          activeThreadId: 'thread-A',
          overrideThreadId: undefined,
          onDone: () => {},
        }),
      );
    });

    // Simulate user switching to another thread before the request rejects.
    storeCurrentThreadId = 'thread-B';

    await act(async () => {
      rejectFetch?.(new Error('network down'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetThreadLoading).toHaveBeenCalledWith('thread-A', false);
    expect(mockSetThreadHasActiveInvocation).toHaveBeenCalledWith('thread-A', false);
    expect(mockSetLoading).not.toHaveBeenCalledWith(false);
    expect(mockSetHasActiveInvocation).not.toHaveBeenCalledWith(false);
  });
});
