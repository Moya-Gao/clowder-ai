import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentMessages } from '@/hooks/useAgentMessages';

const mockAddMessage = vi.fn();
const mockAppendToMessage = vi.fn();
const mockAppendToolEvent = vi.fn();
const mockAppendRichBlock = vi.fn();
const mockSetStreaming = vi.fn((id: string, streaming: boolean) => {
  storeState.messages = storeState.messages.map((m) => (m.id === id ? { ...m, isStreaming: streaming } : m));
});
const mockSetLoading = vi.fn();
const mockSetHasActiveInvocation = vi.fn();
const mockSetIntentMode = vi.fn();
const mockSetCatStatus = vi.fn();
const mockClearCatStatuses = vi.fn();
const mockSetCatInvocation = vi.fn((catId: string, info: Record<string, unknown>) => {
  storeState.catInvocations = {
    ...storeState.catInvocations,
    [catId]: { ...storeState.catInvocations[catId], ...info },
  };
});
const mockSetMessageUsage = vi.fn();
const mockSetMessageMetadata = vi.fn();
const mockSetMessageThinking = vi.fn();
const mockRequestStreamCatchUp = vi.fn();
const mockReplaceMessageId = vi.fn();
const mockPatchMessage = vi.fn();
const mockRemoveMessage = vi.fn();

const mockAddMessageToThread = vi.fn();
const mockClearThreadActiveInvocation = vi.fn();
const mockResetThreadInvocationState = vi.fn();
const mockSetThreadMessageStreaming = vi.fn();
const mockGetThreadState = vi.fn(() => ({ messages: [] }));

const storeState = {
  messages: [] as Array<{
    id: string;
    type: string;
    catId?: string;
    content: string;
    isStreaming?: boolean;
    origin?: string;
    extra?: { stream?: { invocationId?: string } };
    timestamp: number;
  }>,
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
  replaceMessageId: mockReplaceMessageId,
  patchMessage: mockPatchMessage,
  removeMessage: mockRemoveMessage,

  addMessageToThread: mockAddMessageToThread,
  clearThreadActiveInvocation: mockClearThreadActiveInvocation,
  resetThreadInvocationState: mockResetThreadInvocationState,
  setThreadMessageStreaming: mockSetThreadMessageStreaming,
  getThreadState: mockGetThreadState,
  currentThreadId: 'thread-1',
  catInvocations: {} as Record<string, { invocationId?: string }>,
  activeInvocations: {} as Record<string, { catId: string; mode: string }>,
};

let captured: ReturnType<typeof useAgentMessages> | undefined;

vi.mock('@/stores/chatStore', () => {
  const useChatStoreMock = Object.assign(() => storeState, { getState: () => storeState });
  return {
    useChatStore: useChatStoreMock,
  };
});

function Harness() {
  captured = useAgentMessages();
  return null;
}

describe('useAgentMessages late callback dedup (finalizedStreamRef across invocation boundary)', () => {
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
    storeState.catInvocations = {};
    storeState.activeInvocations = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('late callback from previous invocation finds finalized bubble after invocation_created', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Invocation 1: streaming message
    const bubble1 = {
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: 'Response from inv-1',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 3000,
    };
    storeState.messages.push(bubble1);
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    // Stream text so activeRefs is set
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response from inv-1',
      });
    });

    // Invocation 1 done — finalizes the bubble, sets finalizedStreamRef
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // Invocation 2 starts — invocation_created arrives
    act(() => {
      captured?.handleAgentMessage({
        type: 'system_info',
        catId: 'opus',
        content: JSON.stringify({
          type: 'invocation_created',
          catId: 'opus',
          invocationId: 'inv-2',
        }),
      });
    });

    vi.clearAllMocks();

    // Late callback from inv-1 arrives WITHOUT msg.invocationId
    // (e.g., MCP post_message where backend omitted invocationId)
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Final callback from inv-1',
      });
    });

    // Key assertion: should patch the finalized bubble (msg-inv1), NOT create a new bubble.
    // The finalizedStreamRef should have survived invocation_created.
    const patchCalls = mockPatchMessage.mock.calls.filter(
      ([id]) => id === 'msg-inv1',
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);

    // No new assistant bubble should be created
    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(0);
  });

  it('thread switch clears finalizedStreamRef (resetRefs still works)', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Invocation 1: streaming + done
    storeState.messages.push({
      id: 'msg-finalized',
      type: 'assistant',
      catId: 'opus',
      content: 'Done',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 2000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Done',
      });
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // Thread switch — resetRefs should clear finalizedStreamRef
    act(() => {
      captured?.resetRefs();
    });

    vi.clearAllMocks();

    // Late callback arrives after thread switch — should NOT find finalized bubble
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Late callback after thread switch',
      });
    });

    // Should create a new bubble (no finalized ref available after reset)
    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(1);
  });
});
