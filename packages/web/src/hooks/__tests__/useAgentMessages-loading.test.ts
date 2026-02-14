import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentMessages } from '@/hooks/useAgentMessages';

const mockSetLoading = vi.fn();
const mockSetIntentMode = vi.fn();
const mockClearCatStatuses = vi.fn();

let captured:
  | ReturnType<typeof useAgentMessages>
  | undefined;

vi.mock('@/stores/chatStore', () => {
  const makeState = () => ({
    addMessage: vi.fn(),
    appendToMessage: vi.fn(),
    appendToolEvent: vi.fn(),
    setStreaming: vi.fn(),
    setLoading: mockSetLoading,
    setIntentMode: mockSetIntentMode,
    setCatStatus: vi.fn(),
    clearCatStatuses: mockClearCatStatuses,
    setCatInvocation: vi.fn(),
    setMessageUsage: vi.fn(),
    setPendingModeSwitchProposal: vi.fn(),
    currentThreadId: 'thread-1',
  });
  return {
    useChatStore: () => makeState(),
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
    mockSetLoading.mockClear();
    mockSetIntentMode.mockClear();
    mockClearCatStatuses.mockClear();
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
    expect(mockSetIntentMode).toHaveBeenCalledWith(null);
    expect(mockClearCatStatuses).toHaveBeenCalled();
  });
});
