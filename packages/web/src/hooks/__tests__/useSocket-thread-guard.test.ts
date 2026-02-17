/**
 * P1 regression test for cross-thread event leakage via useSocket.
 *
 * Tests the actual useSocket hook with a mock socket.io EventEmitter,
 * verifying that intent_mode and agent_message events from a non-active
 * thread are NOT forwarded to callbacks (preventing the "duplicate cat" bug).
 *
 * Red→Green: Before the fix, intent_mode had no threadIdRef guard in useSocket,
 * so events from thread A would leak into thread B's callback after a switch.
 */

import EventEmitter from 'node:events';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock socket.io-client ──
// Create a controllable EventEmitter that acts as a socket.io client.
const mockSocket = new EventEmitter() as EventEmitter & {
  id: string;
  io: { engine: { transport: { name: string }; on: () => void } };
  emit: (...args: unknown[]) => boolean;
  disconnect: () => void;
  connected: boolean;
};
mockSocket.id = 'mock-socket-id';
mockSocket.io = { engine: { transport: { name: 'websocket' }, on: vi.fn() } };
mockSocket.connected = true;
// Override emit to no-op (prevent join_room etc. from triggering listeners during tests)
mockSocket.emit = vi.fn(() => true) as unknown as typeof mockSocket.emit;
mockSocket.disconnect = vi.fn();

vi.mock('socket.io-client', () => ({
  io: () => mockSocket,
}));

// ── Mock stores ──
const mockAddMessageToThread = vi.fn();
const mockAppendToThreadMessage = vi.fn();
const mockSetThreadMessageStreaming = vi.fn();
const mockUpdateThreadCatStatus = vi.fn();
const mockClearThreadActiveInvocation = vi.fn();
let mockStoreCurrentThreadId = 'thread-B';

vi.mock('@/stores/chatStore', () => {
  const store = {
    getState: () => ({
      currentThreadId: mockStoreCurrentThreadId,
      addMessageToThread: mockAddMessageToThread,
      appendToThreadMessage: mockAppendToThreadMessage,
      setThreadMessageStreaming: mockSetThreadMessageStreaming,
      updateThreadCatStatus: mockUpdateThreadCatStatus,
      clearThreadActiveInvocation: mockClearThreadActiveInvocation,
      getThreadState: () => ({
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
        unreadCount: 0,
        lastActivity: 0,
      }),
    }),
  };
  return { useChatStore: store };
});

vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

vi.mock('@/utils/userId', () => ({
  getUserId: () => 'test-user',
}));

vi.mock('@/utils/api-client', () => ({
  API_URL: 'http://localhost:3100',
}));

// ── Import useSocket after mocks ──
import { type SocketCallbacks, useSocket } from '../useSocket';

/**
 * Minimal wrapper component to mount the useSocket hook with controlled threadId.
 */
function HookWrapper({ callbacks, threadId }: { callbacks: SocketCallbacks; threadId: string }) {
  useSocket(callbacks, threadId);
  return null;
}

/**
 * Simulate a server-side socket event arriving at the client.
 * Uses the original EventEmitter.emit (not the mocked socket.emit).
 */
function simulateServerEvent(event: string, data: unknown) {
  // Get all listeners registered on the mock socket and call them
  const listeners = mockSocket.listeners(event);
  for (const listener of listeners) {
    (listener as (data: unknown) => void)(data);
  }
}

describe('useSocket thread guard (P1 regression: cross-thread event leakage)', () => {
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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreCurrentThreadId = 'thread-B';
    mockAddMessageToThread.mockClear();
    mockAppendToThreadMessage.mockClear();
    mockSetThreadMessageStreaming.mockClear();
    mockUpdateThreadCatStatus.mockClear();
    mockClearThreadActiveInvocation.mockClear();
    // Clear all socket listeners from previous tests
    mockSocket.removeAllListeners();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('intent_mode from active thread is forwarded to callback', () => {
    const onIntentMode = vi.fn();
    const callbacks: SocketCallbacks = {
      onMessage: vi.fn(),
      onIntentMode,
    };

    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-A' }));
    });

    act(() => {
      simulateServerEvent('intent_mode', {
        threadId: 'thread-A',
        mode: 'execute',
        targetCats: ['opus'],
      });
    });

    expect(onIntentMode).toHaveBeenCalledTimes(1);
    expect(onIntentMode).toHaveBeenCalledWith({
      threadId: 'thread-A',
      mode: 'execute',
      targetCats: ['opus'],
    });
  });

  it('intent_mode from OTHER thread is BLOCKED at socket layer (prevents duplicate cat)', () => {
    const onIntentMode = vi.fn();
    const callbacks: SocketCallbacks = {
      onMessage: vi.fn(),
      onIntentMode,
    };

    // Mount with thread-B as active
    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-B' }));
    });

    // Simulate intent_mode arriving for thread-A (cross-thread event)
    act(() => {
      simulateServerEvent('intent_mode', {
        threadId: 'thread-A',
        mode: 'execute',
        targetCats: ['opus'],
      });
    });

    // MUST NOT be forwarded — this is the core regression guard
    expect(onIntentMode).not.toHaveBeenCalled();
  });

  it('intent_mode for switched-away thread is blocked after thread change', () => {
    const onIntentMode = vi.fn();
    const callbacks: SocketCallbacks = {
      onMessage: vi.fn(),
      onIntentMode,
    };

    // Start on thread-A
    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-A' }));
    });

    // Switch to thread-B (simulates user clicking another thread)
    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-B' }));
    });

    // Now thread-A's late intent_mode arrives — must be blocked
    act(() => {
      simulateServerEvent('intent_mode', {
        threadId: 'thread-A',
        mode: 'execute',
        targetCats: ['opus'],
      });
    });

    expect(onIntentMode).not.toHaveBeenCalled();

    // But thread-B's intent_mode should still work
    act(() => {
      simulateServerEvent('intent_mode', {
        threadId: 'thread-B',
        mode: 'ideate',
        targetCats: ['codex'],
      });
    });

    expect(onIntentMode).toHaveBeenCalledTimes(1);
    expect(onIntentMode).toHaveBeenCalledWith({
      threadId: 'thread-B',
      mode: 'ideate',
      targetCats: ['codex'],
    });
  });

  it('agent_message from other thread goes to background handler, not onMessage', () => {
    const onMessage = vi.fn();
    const callbacks: SocketCallbacks = {
      onMessage,
    };

    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-B' }));
    });

    // agent_message from thread-A (background)
    act(() => {
      simulateServerEvent('agent_message', {
        type: 'text',
        catId: 'opus',
        threadId: 'thread-A',
        content: 'hello from thread A',
        timestamp: Date.now(),
      });
    });

    // onMessage should NOT be called for background thread events
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('route/store mismatch: message for route thread must go background until store switches', () => {
    const onMessage = vi.fn();
    const callbacks: SocketCallbacks = {
      onMessage,
    };

    // Route has switched to thread-B, but store still points to old thread-A.
    mockStoreCurrentThreadId = 'thread-A';
    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks, threadId: 'thread-B' }));
    });

    // Message belongs to the new route thread (thread-B).
    act(() => {
      simulateServerEvent('agent_message', {
        type: 'text',
        catId: 'opus',
        threadId: 'thread-B',
        content: 'from thread B during switch window',
        timestamp: Date.now(),
      });
    });

    // Must not mutate old active flat state via onMessage.
    expect(onMessage).not.toHaveBeenCalled();
    // Must be routed as background so it lands in thread-B state map.
    expect(mockAddMessageToThread).toHaveBeenCalledTimes(1);
    expect(mockAddMessageToThread.mock.calls[0]?.[0]).toBe('thread-B');
  });

  it('socket is NOT disconnected/reconnected when callbacks change (callbacksRef pattern)', () => {
    const callbacks1: SocketCallbacks = { onMessage: vi.fn() };
    const callbacks2: SocketCallbacks = { onMessage: vi.fn() };

    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks: callbacks1, threadId: 'thread-A' }));
    });

    const disconnectCallCount = (mockSocket.disconnect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Re-render with different callbacks (simulates socketCallbacks useMemo rebuild)
    act(() => {
      root.render(React.createElement(HookWrapper, { callbacks: callbacks2, threadId: 'thread-A' }));
    });

    // Socket should NOT have been disconnected
    expect((mockSocket.disconnect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(disconnectCallCount);
  });

  it('updated callbacks are used after re-render (ref stays fresh)', () => {
    const onIntentMode1 = vi.fn();
    const onIntentMode2 = vi.fn();

    act(() => {
      root.render(
        React.createElement(HookWrapper, {
          callbacks: { onMessage: vi.fn(), onIntentMode: onIntentMode1 },
          threadId: 'thread-A',
        }),
      );
    });

    // Update callbacks (simulates thread switch causing useMemo rebuild)
    act(() => {
      root.render(
        React.createElement(HookWrapper, {
          callbacks: { onMessage: vi.fn(), onIntentMode: onIntentMode2 },
          threadId: 'thread-A',
        }),
      );
    });

    // Fire intent_mode — should use the LATEST callback (onIntentMode2)
    act(() => {
      simulateServerEvent('intent_mode', {
        threadId: 'thread-A',
        mode: 'execute',
        targetCats: ['opus'],
      });
    });

    expect(onIntentMode1).not.toHaveBeenCalled();
    expect(onIntentMode2).toHaveBeenCalledTimes(1);
  });
});
