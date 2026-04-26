/**
 * F173 Phase E (KD-1 handler unification) — single dispatch fixture
 *
 * 砚砚 PR #1421 review P1: useSocket-thread-guard 测试只验 useSocket forward
 * 到 onMessage (vi.fn())，没真实跑 useAgentMessages.handleAgentMessage 的 active vs
 * background 分发。如果 dispatch 实现把 active/bg 路由反了 / bg refs 没接上 /
 * background 误写 flat state，旧测试仍会绿。
 *
 * 这里钉真实 dispatch 行为：
 *   - currentThreadId=A，收 threadId=B 的 msg → background path（handleBackgroundAgentMessage 被调）
 *   - currentThreadId=B，收 threadId=B 的 msg → active path（store.addMessage / setCatStatus 被调）
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentMessages } from '@/hooks/useAgentMessages';

// Mock the background handler so we can spy on its invocation.
const mockHandleBackgroundAgentMessage = vi.fn();
const mockClearBackgroundStreamRefForActiveEvent = vi.fn();
vi.mock('@/hooks/useSocket-background', () => ({
  handleBackgroundAgentMessage: (msg: unknown, options: unknown) => mockHandleBackgroundAgentMessage(msg, options),
  clearBackgroundStreamRefForActiveEvent: (msg: unknown, refs: unknown) =>
    mockClearBackgroundStreamRefForActiveEvent(msg, refs),
}));

const mockAddMessage = vi.fn();
const mockSetCatStatus = vi.fn();
const mockSetCatInvocation = vi.fn();
const mockAppendToMessage = vi.fn();
const mockAppendToolEvent = vi.fn();
const mockAppendRichBlock = vi.fn();
const mockSetStreaming = vi.fn();
const mockSetLoading = vi.fn();
const mockSetHasActiveInvocation = vi.fn();
const mockSetIntentMode = vi.fn();
const mockClearCatStatuses = vi.fn();
const mockSetMessageUsage = vi.fn();
const mockRequestStreamCatchUp = vi.fn();
const mockSetMessageMetadata = vi.fn();
const mockSetMessageThinking = vi.fn();

const mockAddMessageToThread = vi.fn();
const mockClearThreadActiveInvocation = vi.fn();
const mockResetThreadInvocationState = vi.fn();
const mockSetThreadMessageStreaming = vi.fn();
const mockGetThreadState = vi.fn(() => ({ messages: [] }));

const storeState = {
  messages: [] as Array<{ id: string; type: string; catId?: string; content: string; timestamp: number }>,
  addMessage: mockAddMessage,
  appendToMessage: mockAppendToMessage,
  appendToolEvent: mockAppendToolEvent,
  appendRichBlock: mockAppendRichBlock,
  setStreaming: mockSetStreaming,
  setLoading: mockSetLoading,
  setHasActiveInvocation: mockSetHasActiveInvocation,
  setIntentMode: mockSetIntentMode,
  setCatStatus: mockSetCatStatus,
  clearCatStatuses: mockClearCatStatuses,
  setCatInvocation: mockSetCatInvocation,
  setMessageUsage: mockSetMessageUsage,
  requestStreamCatchUp: mockRequestStreamCatchUp,
  setMessageMetadata: mockSetMessageMetadata,
  setMessageThinking: mockSetMessageThinking,

  addMessageToThread: mockAddMessageToThread,
  clearThreadActiveInvocation: mockClearThreadActiveInvocation,
  resetThreadInvocationState: mockResetThreadInvocationState,
  setThreadMessageStreaming: mockSetThreadMessageStreaming,
  getThreadState: mockGetThreadState,
  currentThreadId: 'thread-active', // 默认 active = thread-active
};

vi.mock('@/stores/chatStore', () => {
  const useChatStoreMock = Object.assign(() => storeState, { getState: () => storeState });
  return { useChatStore: useChatStoreMock };
});

const mockAddToast = vi.fn();
vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

let captured: ReturnType<typeof useAgentMessages> | undefined;
function Harness() {
  captured = useAgentMessages();
  return null;
}

describe('useAgentMessages — F173 Phase E single dispatch (KD-1 handler unification)', () => {
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
    captured = undefined;
    storeState.currentThreadId = 'thread-active';
    storeState.messages = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('background dispatch: currentThreadId !== msg.threadId', () => {
    it('routes msg with threadId !== currentThreadId to handleBackgroundAgentMessage with bg context (砚砚 P1)', () => {
      storeState.currentThreadId = 'thread-active';
      act(() => {
        root.render(React.createElement(Harness));
      });

      act(() => {
        captured?.handleAgentMessage({
          type: 'text',
          catId: 'opus',
          threadId: 'thread-background', // 不同于 currentThreadId
          content: 'hello from bg thread',
          timestamp: Date.now(),
        });
      });

      // background path 必须被调，且收到正确的 bg context
      expect(mockHandleBackgroundAgentMessage).toHaveBeenCalledTimes(1);
      const [msg, options] = mockHandleBackgroundAgentMessage.mock.calls[0];
      expect(msg).toMatchObject({ type: 'text', catId: 'opus', threadId: 'thread-background' });
      expect(options).toMatchObject({
        store: storeState,
        bgStreamRefs: expect.any(Map),
        finalizedBgRefs: expect.any(Map),
        nextBgSeq: expect.any(Function),
        addToast: expect.any(Function),
        clearDoneTimeout: expect.any(Function),
      });

      // active path writers 必须 NOT 被调（防止 background 误写 flat state）
      expect(mockAddMessage).not.toHaveBeenCalled();
      expect(mockSetCatStatus).not.toHaveBeenCalled();
    });

    it('routes msg with no threadId to active path (defensive legacy fallback)', () => {
      storeState.currentThreadId = 'thread-active';
      act(() => {
        root.render(React.createElement(Harness));
      });

      act(() => {
        // No threadId — legacy malformed payload, falls to active path
        captured?.handleAgentMessage({
          type: 'system_info',
          catId: 'opus',
          content: JSON.stringify({ type: 'liveness_warning', __livenessWarning: true, level: 'alive_but_silent' }),
        });
      });

      // background must NOT be called (no threadId, falls to active legacy)
      expect(mockHandleBackgroundAgentMessage).not.toHaveBeenCalled();
      // active path runs (setCatStatus from liveness_warning processing)
      expect(mockSetCatStatus).toHaveBeenCalledWith('opus', 'alive_but_silent');
    });
  });

  describe('active dispatch: currentThreadId === msg.threadId', () => {
    it('routes msg with threadId === currentThreadId to active path (NOT bg)', () => {
      storeState.currentThreadId = 'thread-active';
      act(() => {
        root.render(React.createElement(Harness));
      });

      act(() => {
        captured?.handleAgentMessage({
          type: 'text',
          catId: 'opus',
          threadId: 'thread-active', // same as current
          content: 'hello from active thread',
          timestamp: Date.now(),
        });
      });

      // background path NOT called
      expect(mockHandleBackgroundAgentMessage).not.toHaveBeenCalled();
      // active path must update cat status (text event → 'streaming')
      expect(mockSetCatStatus).toHaveBeenCalledWith('opus', 'streaming');
    });

    it('runs defensive clearBackgroundStreamRefForActiveEvent for active path (matches pre-Phase E behavior)', () => {
      storeState.currentThreadId = 'thread-active';
      act(() => {
        root.render(React.createElement(Harness));
      });

      act(() => {
        captured?.handleAgentMessage({
          type: 'text',
          catId: 'opus',
          threadId: 'thread-active',
          content: 'hello',
          timestamp: Date.now(),
        });
      });

      // Defensive cleanup: clearBg called even on active path (was useSocket pre-Phase E behavior)
      expect(mockClearBackgroundStreamRefForActiveEvent).toHaveBeenCalled();
    });
  });
});
