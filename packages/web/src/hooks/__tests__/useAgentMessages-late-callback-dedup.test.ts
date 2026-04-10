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
const mockRemoveActiveInvocation = vi.fn();
const mockClearAllActiveInvocations = vi.fn();
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
    extra?: { stream?: { invocationId?: string }; callbackBridge?: { skipDedup?: boolean } };
    timestamp: number;
  }>,
  addMessage: mockAddMessage,
  appendToMessage: mockAppendToMessage,
  appendToolEvent: mockAppendToolEvent,
  appendRichBlock: mockAppendRichBlock,
  setStreaming: mockSetStreaming,
  setLoading: mockSetLoading,
  setHasActiveInvocation: mockSetHasActiveInvocation,
  removeActiveInvocation: mockRemoveActiveInvocation,
  clearAllActiveInvocations: mockClearAllActiveInvocations,
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

  it('late callback with SAME content merges into finalized bubble after invocation_created', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const responseText = 'Response from inv-1';

    // Invocation 1: streaming message
    const bubble1 = {
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: responseText,
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
        content: responseText,
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

    // Invocation 2 starts — invocation_created arrives (fences finalizedStreamRef)
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

    // Late callback from inv-1 arrives WITHOUT msg.invocationId but with
    // SAME content as the finalized bubble — should merge (true late dup)
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: responseText,
      });
    });

    // Key assertion: should patch the finalized bubble (msg-inv1)
    const patchCalls = mockPatchMessage.mock.calls.filter(([id]) => id === 'msg-inv1');
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);

    // No new assistant bubble should be created
    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(0);
  });

  it('does not suppress the new invocation after a fenced late callback merged into the previous bubble', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const responseText = 'Response from inv-1';

    storeState.messages.push({
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: responseText,
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 3000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: responseText,
      });
    });
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });
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

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: responseText,
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Fresh stream from inv-2',
      });
    });

    expect(mockAppendToMessage).not.toHaveBeenCalled();
    const streamBubble = mockAddMessage.mock.calls.find(([msg]) => msg.origin === 'stream')?.[0];
    expect(streamBubble?.content).toBe('Fresh stream from inv-2');
    expect(streamBubble?.extra).toEqual({ stream: { invocationId: 'inv-2' } });
  });

  it('P2 regression: suppresses late stream chunks from finalized_fallback invocation after callback merge', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const responseText = 'Response from inv-1';

    storeState.messages.push({
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: responseText,
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 3000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: responseText,
        invocationId: 'inv-1',
      });
    });
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
        invocationId: 'inv-1',
      });
    });
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

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: responseText,
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'late stream chunk from inv-1',
        invocationId: 'inv-1',
      });
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
    expect(mockAppendToMessage).not.toHaveBeenCalled();
  });

  it('P1 regression: callback with DIFFERENT content does NOT merge across invocation boundary', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Invocation 1: streaming + finalize
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

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response from inv-1',
      });
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // Invocation 2: callback-only (e.g. post_message) — invocation_created fences the ref
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

    // Inv-2's callback with DIFFERENT content — must NOT overwrite inv-1's bubble
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Scheduled task created',
      });
    });

    // Should NOT patch the finalized bubble
    const patchCalls = mockPatchMessage.mock.calls.filter(([id]) => id === 'msg-inv1');
    expect(patchCalls).toHaveLength(0);

    // Should create a new bubble for inv-2's output
    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(1);
    expect(newBubbleCalls[0][0].content).toBe('Scheduled task created');
  });

  it('invalidates a fenced finalized ref when a second invocation boundary arrives', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: 'Shared content',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 4000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Shared content',
      });
    });
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // First boundary fences the inv-1 finalized ref.
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

    // inv-2 is callback-only with different content, so the fenced inv-1 ref survives.
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Different inv-2 content',
      });
    });

    vi.clearAllMocks();

    // Second boundary must invalidate the stale inv-1 ref.
    act(() => {
      captured?.handleAgentMessage({
        type: 'system_info',
        catId: 'opus',
        content: JSON.stringify({
          type: 'invocation_created',
          catId: 'opus',
          invocationId: 'inv-3',
        }),
      });
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Shared content',
      });
    });

    const patchCalls = mockPatchMessage.mock.calls.filter(([id]) => id === 'msg-inv1');
    expect(patchCalls).toHaveLength(0);

    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(1);
    expect(newBubbleCalls[0][0].content).toBe('Shared content');
    expect(newBubbleCalls[0][0].extra).toEqual({ callbackBridge: { skipDedup: true } });
  });

  it('keeps suppressing late stream chunks when callback creates a bubble after a non-matchable finalized ref', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-inv1',
      type: 'assistant',
      catId: 'opus',
      content: 'Response from inv-1',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 4000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response from inv-1',
      });
    });
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

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

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Delayed callback from inv-1',
      });
    });

    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    const callbackBubble = mockAddMessage.mock.calls[0]?.[0];
    expect(callbackBubble?.origin).toBe('callback');
    expect(callbackBubble?.extra?.stream?.invocationId).toBeUndefined();
    expect(callbackBubble?.extra?.callbackBridge).toEqual({ skipDedup: true });

    storeState.messages.push({
      ...callbackBubble,
      timestamp: Date.now(),
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Fresh stream from inv-2',
      });
    });

    expect(mockAppendToMessage).not.toHaveBeenCalled();
    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('keeps suppressing late stream chunks for callback-first invocations without explicit invocationId', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.catInvocations = { opus: { invocationId: 'inv-callback-first' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Callback arrived before stream',
      });
    });

    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    expect(mockAddMessage.mock.calls[0]?.[0].extra).toEqual({ callbackBridge: { skipDedup: true } });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'late stream chunk from same invocation',
      });
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
    expect(mockAppendToMessage).not.toHaveBeenCalled();
  });

  it('keeps suppressing late stream chunks after callback replaces an invocationless placeholder', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.catInvocations = { opus: { invocationId: 'inv-invocationless-placeholder' } };
    storeState.messages.push({
      id: 'msg-invocationless-placeholder',
      type: 'assistant',
      catId: 'opus',
      content: 'thinking...',
      isStreaming: true,
      origin: 'stream',
      timestamp: Date.now() - 1000,
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'thinking...',
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'final answer',
      });
    });

    expect(mockPatchMessage).toHaveBeenCalledWith(
      'msg-invocationless-placeholder',
      expect.objectContaining({
        content: 'final answer',
        origin: 'callback',
        isStreaming: false,
      }),
    );

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: ' late chunk from same invocation',
      });
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
    expect(mockAppendToMessage).not.toHaveBeenCalled();
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
