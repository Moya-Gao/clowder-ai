import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentMessages } from '@/hooks/useAgentMessages';

const mockAddMessage = vi.fn();
const mockAppendToMessage = vi.fn();
const mockAppendToolEvent = vi.fn();
const mockSetStreaming = vi.fn();
const mockSetLoading = vi.fn();
const mockSetHasActiveInvocation = vi.fn();
const mockSetIntentMode = vi.fn();
const mockSetCatStatus = vi.fn();
const mockClearCatStatuses = vi.fn();
const mockSetCatInvocation = vi.fn();
const mockSetMessageUsage = vi.fn();
const mockSetPendingModeSwitchProposal = vi.fn();

const storeState = {
  messages: [] as Array<{ id: string; type: string; catId?: string; content: string; isStreaming?: boolean; timestamp: number }>,
  addMessage: mockAddMessage,
  appendToMessage: mockAppendToMessage,
  appendToolEvent: mockAppendToolEvent,
  setStreaming: mockSetStreaming,
  setLoading: mockSetLoading,
  setHasActiveInvocation: mockSetHasActiveInvocation,
  setIntentMode: mockSetIntentMode,
  setCatStatus: mockSetCatStatus,
  clearCatStatuses: mockClearCatStatuses,
  setCatInvocation: mockSetCatInvocation,
  setMessageUsage: mockSetMessageUsage,
  setPendingModeSwitchProposal: mockSetPendingModeSwitchProposal,
  currentThreadId: 'thread-1',
};

let captured:
  | ReturnType<typeof useAgentMessages>
  | undefined;

vi.mock('@/stores/chatStore', () => {
  const useChatStoreMock = Object.assign(
    () => storeState,
    { getState: () => storeState }
  );
  return {
    useChatStore: useChatStoreMock,
  };
});

function Harness() {
  captured = useAgentMessages();
  return null;
}

describe('useAgentMessages loading lifecycle', () => {
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
    storeState.messages = [];
    mockAddMessage.mockClear();
    mockAppendToMessage.mockClear();
    mockAppendToolEvent.mockClear();
    mockSetStreaming.mockClear();
    mockSetLoading.mockClear();
    mockSetHasActiveInvocation.mockClear();
    mockSetIntentMode.mockClear();
    mockSetCatStatus.mockClear();
    mockClearCatStatuses.mockClear();
    mockSetCatInvocation.mockClear();
    mockSetMessageUsage.mockClear();
    mockSetPendingModeSwitchProposal.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('clears loading when final done is received', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    expect(captured).toBeTruthy();
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'codex',
        isFinal: true,
      });
    });

    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(mockSetHasActiveInvocation).toHaveBeenCalledWith(false);
    expect(mockSetIntentMode).toHaveBeenCalledWith(null);
    expect(mockClearCatStatuses).toHaveBeenCalled();
  });

  it('clears hasActiveInvocation on error with isFinal', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'error',
        catId: 'opus',
        error: 'something broke',
        isFinal: true,
      });
    });

    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(mockSetHasActiveInvocation).toHaveBeenCalledWith(false);
    expect(mockSetIntentMode).toHaveBeenCalledWith(null);
  });

  it('closes existing streaming bubble on done even when activeRefs are empty', () => {
    storeState.messages = [
      {
        id: 'bg-msg-1',
        type: 'assistant',
        catId: 'codex',
        content: 'partial',
        isStreaming: true,
        timestamp: Date.now(),
      },
    ];

    act(() => {
      root.render(React.createElement(Harness));
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'codex',
      });
    });

    expect(mockSetStreaming).toHaveBeenCalledWith('bg-msg-1', false);
  });

  it('keeps handleAgentMessage stable when only messages change', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const firstHandler = captured?.handleAgentMessage;
    expect(firstHandler).toBeTruthy();

    storeState.messages = [
      {
        id: 'msg-new',
        type: 'assistant',
        catId: 'codex',
        content: 'delta',
        isStreaming: true,
        timestamp: Date.now(),
      },
    ];

    act(() => {
      root.render(React.createElement(Harness));
    });

    expect(captured?.handleAgentMessage).toBe(firstHandler);
  });
});
