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
const mockSetMessageStreamInvocation = vi.fn((messageId: string, invocationId: string) => {
  storeState.messages = storeState.messages.map((m) =>
    m.id === messageId ? { ...m, extra: { ...m.extra, stream: { ...m.extra?.stream, invocationId } } } : m,
  );
});
const mockRemoveActiveInvocation = vi.fn((invocationId: string) => {
  delete storeState.activeInvocations[invocationId];
});

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
  setMessageStreamInvocation: mockSetMessageStreamInvocation,

  addMessageToThread: mockAddMessageToThread,
  clearThreadActiveInvocation: mockClearThreadActiveInvocation,
  resetThreadInvocationState: mockResetThreadInvocationState,
  setThreadMessageStreaming: mockSetThreadMessageStreaming,
  getThreadState: mockGetThreadState,
  currentThreadId: 'thread-1',
  catInvocations: {} as Record<string, { invocationId?: string }>,
  activeInvocations: {} as Record<string, { catId: string; mode: string }>,
  removeActiveInvocation: mockRemoveActiveInvocation,
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

describe('useAgentMessages bubble merge prevention (Bug B)', () => {
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

  it('done event clears invocationId to prevent stale recovery of finalized messages', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Setup: invocation 1 created a streaming message
    const msgA = {
      id: 'msg-A',
      type: 'assistant',
      catId: 'opus',
      content: 'Response A',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 2000,
    };
    storeState.messages.push(msgA);
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    // Invocation 1 sends text
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response A',
      });
    });

    // Invocation 1 completes — done event arrives
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // After done: message A should be finalized (isStreaming: false)
    // The key assertion: setCatInvocation should have been called to clear invocationId
    // so that findRecoverableAssistantMessage can't match the old message
    const clearCalls = mockSetCatInvocation.mock.calls.filter(
      ([catId, info]) => catId === 'opus' && info.invocationId === undefined,
    );
    expect(clearCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('callback with explicit invocationId creates standalone bubble when strict match fails', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Setup: an invocationless stream bubble exists (invocation_created was lost)
    const placeholderMsg = {
      id: 'msg-placeholder',
      type: 'assistant',
      catId: 'opus',
      content: 'streaming...',
      isStreaming: true,
      origin: 'stream',
      // No invocationId — this is the invocationless placeholder
      extra: { stream: {} },
      timestamp: Date.now() - 1000,
    };
    storeState.messages.push(placeholderMsg);

    // Simulate text arriving (so activeRefs gets set for this cat)
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'streaming...',
      });
    });

    vi.clearAllMocks();

    // Callback arrives WITH invocationId, but no bubble has that invocationId tagged
    // (because invocation_created was lost during micro-disconnect)
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Final callback response',
        invocationId: 'inv-lost',
        messageId: 'msg-final',
      });
    });

    // Strict rule: explicit invocationId must NOT fall back to invocationless
    // placeholder — the placeholder may belong to a newer invocation.
    // A standalone callback bubble is created instead.
    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(1);
    expect(newBubbleCalls[0][0].content).toBe('Final callback response');
  });

  it('callback with explicit invocationId does not reclaim an empty placeholder without rich/tool markers', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-empty-placeholder',
      type: 'assistant',
      catId: 'opus',
      content: '',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now() - 1000,
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Final callback response',
        invocationId: 'inv-empty',
        messageId: 'msg-final-empty',
      });
    });

    const newBubbleCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newBubbleCalls).toHaveLength(1);
    expect(newBubbleCalls[0][0].id).toBe('msg-final-empty');
  });

  it('new invocation text does not append to previous finalized message', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Invocation 1: streaming message A
    storeState.messages.push({
      id: 'msg-A',
      type: 'assistant',
      catId: 'opus',
      content: 'Response A',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now() - 2000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    // Invocation 1: stream text
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response A',
      });
    });

    // Invocation 1 completes — done event finalizes the message
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        isFinal: true,
      });
    });

    // After done: invocationId should be cleared (by the fix)
    // Message A should have isStreaming: false
    vi.clearAllMocks();

    // New invocation 2: first text arrives (invocation_created may or may not have arrived)
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Response D',
      });
    });

    // Bug B assertion: should NOT append to msg-A (finalized message)
    const appendToACalls = mockAppendToMessage.mock.calls.filter(([id]) => id === 'msg-A');
    expect(appendToACalls).toHaveLength(0);

    // Should have created a new message for the new invocation
    const newAssistantCalls = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(newAssistantCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('P1 regression: stale callback from inv-1 must NOT replace inv-2 active bubble (#266)', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const inv2Bubble = {
      id: 'msg-inv2',
      type: 'assistant',
      catId: 'opus',
      content: 'New response',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-2' } },
      timestamp: Date.now(),
    };
    storeState.messages.push(inv2Bubble);
    storeState.catInvocations = { opus: { invocationId: 'inv-2' } };

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'New response',
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Old inv-1 response',
        invocationId: 'inv-1',
        messageId: 'stored-inv1-msg',
      });
    });

    const newCallbackBubbles = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus' && msg.origin === 'callback',
    );
    expect(newCallbackBubbles.length).toBe(1);
    expect(newCallbackBubbles[0][0].content).toBe('Old inv-1 response');

    const appendToInv2 = mockAppendToMessage.mock.calls.filter(([id]) => id === 'msg-inv2');
    expect(appendToInv2).toHaveLength(0);
  });

  it('P1 regression: explicit-invocationId callback must NOT overwrite invocationless bubble when currentKnownInvId is undefined', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const newerBubble = {
      id: 'msg-newer',
      type: 'assistant',
      catId: 'opus',
      content: 'Newer response',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    };
    storeState.messages.push(newerBubble);
    storeState.catInvocations = {};

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Newer response',
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Old callback response',
        invocationId: 'inv-old',
        messageId: 'stored-old-msg',
      });
    });

    const appendToNewer = mockAppendToMessage.mock.calls.filter(([id]) => id === 'msg-newer');
    expect(appendToNewer).toHaveLength(0);
  });

  it('P1 regression: stale callback standalone bubble must NOT suppress live stream chunks via replacedInvocationsRef', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-live',
      type: 'assistant',
      catId: 'opus',
      content: 'Live response',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: 'Live response',
      });
    });

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'Old callback',
        invocationId: 'inv-stale',
        messageId: 'msg-stale-cb',
      });
    });

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: ' more live text',
      });
    });

    const appendCalls = mockAppendToMessage.mock.calls.filter(([id]) => id === 'msg-live');
    expect(appendCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('final done preserves a recovered partial stream bubble', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-partial-done',
      type: 'assistant',
      catId: 'opus',
      content: '铲屎官，我活着，',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-partial-done' } },
      timestamp: Date.now() - 1000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-partial-done' } };
    storeState.activeInvocations = {
      'inv-partial-done': { catId: 'opus', mode: 'execute' },
    };

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-partial-done',
        isFinal: true,
      });
    });

    expect(storeState.messages).toContainEqual(
      expect.objectContaining({
        id: 'msg-partial-done',
        content: '铲屎官，我活着，',
        isStreaming: false,
      }),
    );
  });

  it('terminal error preserves a recovered partial stream bubble', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    storeState.messages.push({
      id: 'msg-partial-error',
      type: 'assistant',
      catId: 'opus',
      content: '铲屎官，我活着，',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-partial-error' } },
      timestamp: Date.now() - 1000,
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-partial-error' } };
    storeState.activeInvocations = {
      'inv-partial-error': { catId: 'opus', mode: 'execute' },
    };

    act(() => {
      captured?.handleAgentMessage({
        type: 'error',
        catId: 'opus',
        error: 'stream interrupted',
        invocationId: 'inv-partial-error',
        isFinal: true,
      });
    });

    expect(storeState.messages).toContainEqual(
      expect.objectContaining({
        id: 'msg-partial-error',
        content: '铲屎官，我活着，',
        isStreaming: false,
      }),
    );
  });

  it('Bug-G: done back-fills invocationId when catInvocations positively confirms current invocation matches', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Setup: `invocation_created` for inv-1 DID arrive (catInvocations populated)
    // but the stream bubble was somehow created before the binding took effect
    // (rare race inside the hook — e.g. message ordering). Seed it directly so we
    // can observe back-fill via done.
    const streamBubbleId = 'msg-inv1-ghost';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    // catInvocations POSITIVELY confirms inv-1 is current → back-fill is safe
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Bug-G happy path: back-fill triggers because currentBinding === msg.invocationId
    expect(mockSetMessageStreamInvocation).toHaveBeenCalledWith(streamBubbleId, 'inv-1');
    const finalBubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(finalBubble?.extra?.stream?.invocationId, 'bubble must carry inv-1 after done').toBe('inv-1');

    // Now callback arrives with the same invocationId — it must adopt the bubble, not spawn a duplicate
    vi.clearAllMocks();
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        origin: 'callback',
        content: 'final authoritative reply',
        invocationId: 'inv-1',
        messageId: streamBubbleId,
      });
    });

    // Must NOT create a second bubble
    const duplicateCallbacks = mockAddMessage.mock.calls.filter(
      ([msg]) => msg.type === 'assistant' && msg.catId === 'opus',
    );
    expect(duplicateCallbacks).toHaveLength(0);
    // Must patch the existing bubble
    expect(mockPatchMessage).toHaveBeenCalledWith(
      streamBubbleId,
      expect.objectContaining({
        content: 'final authoritative reply',
        origin: 'callback',
        isStreaming: false,
      }),
    );
  });

  it('Bug-G stale-done guard: old done(inv-1) must NOT back-fill newer invocationless bubble when catInvocations says inv-2', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Simulate same-cat preempt: inv-1 ended earlier, inv-2 is now in flight
    // (invocation_created for inv-2 DID arrive → catInvocations[opus]=inv-2).
    const inv2BubbleId = 'msg-inv2-ghost';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-2' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    expect(mockSetMessageStreamInvocation).not.toHaveBeenCalled();
    const bubble = storeState.messages.find((m) => m.id === inv2BubbleId);
    expect(bubble?.extra?.stream?.invocationId, 'inv-2 bubble must remain invocationless').toBeUndefined();
  });

  it('Bug-G unknown-evidence → not stale (cloud R11): done(inv-1) with no contradicting evidence finalizes the invocationless bubble', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // R2-R10 defaulted "unknown evidence" to stale, but cloud R11 correctly
    // pointed out the real reconnect/loss-window scenario where ALL evidence
    // sources are lost but the terminal event is genuine. Defaulting to stale
    // leaves the UI stuck streaming.
    //
    // New policy: treat "unknown" as legitimate terminal, allow finalization +
    // back-fill. Residual misbinding risk accepted — in the extreme case of a
    // stale done + invocationless newer bubble + all-evidence-lost, F5 will
    // reconcile via authoritative server state.
    const bubbleId = 'msg-invocationless-empty-state';
    storeState.messages.push({
      id: bubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    storeState.activeInvocations = {};

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // With no contradicting evidence, the terminal is treated as legitimate →
    // bubble finalized + invocationId back-filled.
    expect(mockSetMessageStreamInvocation).toHaveBeenCalledWith(bubbleId, 'inv-1');
    const bubble = storeState.messages.find((m) => m.id === bubbleId);
    expect(bubble?.extra?.stream?.invocationId, 'bubble back-filled to msg invocationId').toBe('inv-1');
    expect(mockSetStreaming).toHaveBeenCalledWith(bubbleId, false);
  });

  it('Bug-G stale-done guard (cloud R3): old done(inv-1) must NOT back-fill when activeInvocations knows newer slot (inv-2) while catInvocations is empty', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Cloud-suggested edge: invocation_created lost but `intent_mode` / slot
    // registration still populated activeInvocations with inv-2. catInvocations
    // is empty. Guard must fall back to activeInvocations as positive evidence
    // and refuse to back-fill inv-1.
    const inv2BubbleId = 'msg-inv2-ghost-active-slot';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    expect(mockSetMessageStreamInvocation).not.toHaveBeenCalled();
    const bubble = storeState.messages.find((m) => m.id === inv2BubbleId);
    expect(bubble?.extra?.stream?.invocationId, 'inv-2 bubble must not be misbound to inv-1').toBeUndefined();
  });

  it('Bug-G slot-fresh override (cloud R15): stale bubble binding must NOT block real done when activeSlot confirms msg', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Cloud R15 scenario: previous done(inv-1) missed → activeRefs still points
    // to bubble, bubble has stale `extra.stream.invocationId=inv-1`. New invocation:
    // activeInvocations[inv-2] set via intent_mode, but invocation_created lost →
    // bubble binding NOT updated, direct NOT updated. Real done(inv-2) arrives.
    //
    // Prior hierarchy said bubble binding is authoritative ground truth →
    // inv-1 ≠ inv-2 → STALE → legitimate terminal skipped → UI stuck.
    //
    // Fix: activeSlot's positive confirmation of msg short-circuits to not-stale
    // BEFORE bubble binding is consulted.
    const streamBubbleId = 'msg-reused-stale-binding';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'inv-2 streaming into reused bubble',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } }, // stale binding from previous inv
      timestamp: Date.now(),
    });
    // Fresh intent_mode for inv-2; invocation_created for inv-2 lost
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };
    storeState.catInvocations = {}; // direct lost too

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-2',
        isFinal: true,
      });
    });

    // Real done(inv-2) must finalize — slot-fresh override beats stale bubble binding
    expect(mockSetStreaming).toHaveBeenCalledWith(streamBubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(bubble?.isStreaming, 'bubble must finalize when slot confirms msg').toBe(false);
  });

  it('Bug-G stale-done isFinal cleanup (cloud R14): stale done(isFinal=true) must NOT trigger global teardown when activeInvocations is empty', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Reconnect/loss window: a live invocation (inv-2) is streaming but has no
    // tracked slot in activeInvocations (slot registration was lost). A stale
    // done(inv-1, isFinal=true) arrives. `remainingInvocations === 0` fires and,
    // without the stale gate, triggers global teardown:
    //   setLoading(false) + setIntentMode(null) + clearCatStatuses() + clearDoneTimeout
    // That wipes inv-2's execution state mid-run. Fix: gate global teardown on
    // !isStaleDone (mirrors error branch).
    const inv2BubbleId = 'msg-inv2-isfinal-global';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'inv-2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-2' } }, // bubble contradicts msg=inv-1
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    storeState.activeInvocations = {}; // empty — remainingInvocations will be 0

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Global teardown MUST be skipped for stale done
    expect(mockSetLoading, 'stale done must not clear global loading').not.toHaveBeenCalledWith(false);
    expect(mockSetIntentMode).not.toHaveBeenCalled();
    expect(mockClearCatStatuses).not.toHaveBeenCalled();
  });

  it('Bug-G resolver hierarchy (cloud R13): activeSlot=inv-2 confirms msg=inv-2 even when direct=inv-1 lags', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Cloud R13 scenario: the lag window where `invocation_created` for inv-2
    // has pushed the fresh slot into activeInvocations but hasn't yet updated
    // catInvocations.direct. A LEGITIMATE done/error(inv-2) arrives.
    //
    // Naive contradiction-any: activeSlot confirms but direct contradicts →
    // still STALE → legitimate terminal skipped.
    // Hierarchical fix: activeSlot is authoritative over direct; direct lag
    // cannot override a positive slot confirmation.
    const bubbleId = 'msg-inv2-resolver-hierarchy';
    storeState.messages.push({
      id: bubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'inv-2 streaming',
      isStreaming: true,
      origin: 'stream',
      // No explicit binding yet — test the slot/direct fallback order
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } }; // stale lag

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-2',
        isFinal: true,
      });
    });

    // activeSlot=inv-2 confirms msg=inv-2 → NOT stale → finalize runs
    expect(mockSetStreaming).toHaveBeenCalledWith(bubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === bubbleId);
    expect(bubble?.isStreaming, 'legitimate done must finalize despite stale direct').toBe(false);
  });

  it('Bug-G stale-done direct cleanup (cloud R12): stale done(inv-1) still clears matching catInvocations.direct=inv-1', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Preempt window: activeInvocations=inv-2 fresh, catInvocations=inv-1 stale
    // (invocation_created for inv-2 not yet processed). Stale done(inv-1) arrives.
    // R4-R13 gated the catInvocations cleanup inside !isStaleDone, so direct=inv-1
    // survived. Later, getCurrentInvocationStateForCat (catInvocations-first) would
    // return stale inv-1 and misbind inv-2's first stream bubble. Fix: clear direct
    // conditionally on direct === msg.invocationId, even when stale.
    const inv2BubbleId = 'msg-inv2-stale-direct-cleanup';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-2' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } }; // stale direct
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: false,
      });
    });

    // Bubble side effects still skipped (stale)
    expect(mockSetStreaming).not.toHaveBeenCalledWith(inv2BubbleId, false);
    // But direct cleanup runs: setCatInvocation called with invocationId: undefined
    expect(mockSetCatInvocation).toHaveBeenCalledWith('opus', { invocationId: undefined });
    expect(storeState.catInvocations.opus?.invocationId, 'stale direct=inv-1 must be cleared').toBeUndefined();
  });

  it('Bug-G stale-done direct cleanup (cloud R12 guard): stale done(inv-1) must NOT clobber fresh direct=inv-2', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Variant: direct has already moved on to inv-2 (invocation_created for inv-2
    // arrived and set it). Stale done(inv-1) must NOT clear the fresh direct.
    const inv2BubbleId = 'msg-inv2-direct-fresh';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-2' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-2' } }; // fresh
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: false,
      });
    });

    // Direct must survive — it's inv-2, not inv-1, so nothing to clear
    expect(mockSetCatInvocation).not.toHaveBeenCalledWith('opus', { invocationId: undefined });
    expect(storeState.catInvocations.opus?.invocationId, 'fresh direct=inv-2 must survive stale done').toBe('inv-2');
  });

  it('Bug-G stale-done guard (砚砚 R10): stale done(inv-1) must NOT delete hydrated slot representing current invocation', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Reconnect hydration scenario: the hydrated slot IS the representation of
    // the current in-flight invocation (server only provided synthetic key).
    // Active bubble belongs to inv-2. Stale done(inv-1) arrives.
    //
    // Bug: unguarded hydrated-orphan cleanup sees `findLatest` return the hydrated
    // key, starts-with 'hydrated-' → removes it → activeInvocations empty →
    // remainingInvocations === 0 → isFinal global cleanup fires → wipes
    // loading/intentMode/catStatuses/streaming refs for inv-2.
    //
    // Fix: hydrated-orphan cleanup gated on !isStaleDone.
    const inv2BubbleId = 'msg-inv2-hydrated-stale-done';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      // inv-2 bubble has its own binding (invocation_created path 或 intent_mode)
      extra: { stream: { invocationId: 'inv-2' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    // Only hydrated — represents inv-2's current slot
    storeState.activeInvocations = {
      'hydrated-thread-1-opus': { catId: 'opus', mode: 'stream' },
    };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1', // stale
        isFinal: true,
      });
    });

    // Hydrated slot must NOT be removed (it represents inv-2, current)
    expect(mockRemoveActiveInvocation).not.toHaveBeenCalledWith('hydrated-thread-1-opus');
    // Global cleanup must NOT fire
    expect(mockSetStreaming).not.toHaveBeenCalledWith(inv2BubbleId, false);
    expect(
      storeState.activeInvocations['hydrated-thread-1-opus'],
      'hydrated slot must survive stale done',
    ).toBeDefined();
  });

  it('Bug-G reconnect hydration (砚砚 R8): hydrated slot only + empty direct + bubble carrying real invocationId → done(inv-1) must finalize', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Reconnect reconciliation scenario: `useChatHistory` populates only
    // `activeInvocations['hydrated-${threadId}-${catId}']`, does NOT touch
    // `catInvocations`. Bubbles that survived reconnect still carry their own
    // `extra.stream.invocationId` binding. Without bubble-identity fallback in
    // the resolver, real done(inv-1) sees realActiveSlot=undefined + direct=
    // undefined → resolved=undefined → stale → bubble stuck streaming.
    const streamBubbleId = 'msg-reconnect-hydrated-done';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    // Only a hydrated synthetic slot; no real activeSlot, no direct binding
    storeState.activeInvocations = {
      'hydrated-thread-1-opus': { catId: 'opus', mode: 'stream' },
    };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Real done must finalize via bubble-identity fallback evidence
    expect(mockSetStreaming).toHaveBeenCalledWith(streamBubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(bubble?.isStreaming, 'bubble must finalize via bubble.extra.stream.invocationId evidence').toBe(false);
  });

  it('Bug-G reconnect hydration (砚砚 R8 error path): hydrated slot only + empty direct + bubble carrying real invocationId → error(inv-1) must finalize', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    const streamBubbleId = 'msg-reconnect-hydrated-error';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    storeState.activeInvocations = {
      'hydrated-thread-1-opus': { catId: 'opus', mode: 'stream' },
    };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'error',
        catId: 'opus',
        error: 'inv-1 stream interrupted',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    expect(mockSetStreaming).toHaveBeenCalledWith(streamBubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(bubble?.isStreaming, 'bubble must finalize via bubble-identity fallback for error path').toBe(false);
    const errorSystemMsgCalls = mockAddMessage.mock.calls.filter(([m]) => m.type === 'system' && m.variant === 'error');
    expect(errorSystemMsgCalls, 'real error must inject system message after reconnect hydration').toHaveLength(1);
  });

  it('Bug-G stale-terminal guard (cloud R7): hydrated-${threadId}-${catId} synthetic slot must NOT shadow real direct binding', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Reconnect reconciliation populates `hydrated-${threadId}-${catId}` synthetic
    // keys in activeInvocations. Naive "latest active slot wins" priority would
    // return the hydrated key, normalize it to `hydrated-thread-1`, compare to
    // real msg.invocationId='inv-1' → NEVER equal → misclassify legitimate done
    // as stale → skip bubble finalization → bubble stuck streaming after done.
    // Fix: skip hydrated-* keys when resolving, fall through to direct binding.
    const streamBubbleId = 'msg-hydrated-race';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };
    // Hydrated synthetic key present (from reconnect reconciliation)
    storeState.activeInvocations = {
      'hydrated-thread-1-opus': { catId: 'opus', mode: 'stream' },
    };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Real done must still finalize the bubble — hydrated synthetic slot must
    // not make us misclassify as stale.
    expect(mockSetStreaming).toHaveBeenCalledWith(streamBubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(bubble?.isStreaming, 'bubble must be finalized — hydrated slot should not block real done').toBe(false);
  });

  it('Bug-G stale-terminal guard (砚砚 R7 + error path): hydrated synthetic slot must NOT block real error(inv-1) finalization', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Symmetric to the R7 done-path test, but exercising the error branch.
    // Verifies the shared `isStaleTerminalEvent` helper also demotes hydrated-*
    // for legitimate error flows: a real error(inv-1) must finalize the bubble,
    // not get blocked by a hydrated synthetic slot left over from reconnect.
    const streamBubbleId = 'msg-hydrated-race-error';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };
    storeState.activeInvocations = {
      'hydrated-thread-1-opus': { catId: 'opus', mode: 'stream' },
    };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'error',
        catId: 'opus',
        error: 'inv-1 stream interrupted',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Real error must finalize the bubble even when hydrated slot is present
    expect(mockSetStreaming).toHaveBeenCalledWith(streamBubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === streamBubbleId);
    expect(bubble?.isStreaming, 'bubble must be finalized — hydrated slot should not block real error').toBe(false);
    // Error system message must be injected (real error, not stale)
    const errorSystemMsgCalls = mockAddMessage.mock.calls.filter(([m]) => m.type === 'system' && m.variant === 'error');
    expect(errorSystemMsgCalls, 'real error must inject system message').toHaveLength(1);
  });

  it('Bug-G stale-error guard (砚砚 R6): late error(inv-1) must NOT terminate inv-2 bubble or clear activeRefs', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Error branch has the same terminal-side-effect shape as done: setCatStatus,
    // taskProgress flip, setStreaming(false), activeRefs.delete. 砚砚 pointed out
    // a late error(inv-1) with inv-2 live would corrupt inv-2 just like stale
    // done used to. Verify the shared `isStaleTerminalEvent` guard covers error.
    const inv2BubbleId = 'msg-inv2-stale-error';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    // Preempt window: catInvocations stale direct=inv-1; activeInvocations fresh inv-2
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'error',
        catId: 'opus',
        error: 'inv-1 stream interrupted',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    // Stale error must NOT terminate inv-2 bubble
    expect(mockSetStreaming).not.toHaveBeenCalledWith(inv2BubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === inv2BubbleId);
    expect(bubble?.isStreaming, 'inv-2 bubble must remain streaming').toBe(true);

    // Stale error must NOT inject error system message into thread
    const errorSystemMsgCalls = mockAddMessage.mock.calls.filter(([m]) => m.type === 'system' && m.variant === 'error');
    expect(errorSystemMsgCalls, 'no error system message for stale inv-1').toHaveLength(0);

    // Subsequent inv-2 text must still recover original bubble (activeRefs not cleared)
    vi.clearAllMocks();
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: ' continuation',
      });
    });
    const newStreamBubbles = mockAddMessage.mock.calls.filter(
      ([m]) => m.type === 'assistant' && m.catId === 'opus' && m.origin === 'stream',
    );
    expect(newStreamBubbles, 'inv-2 must still find its active bubble, not spawn a new one').toHaveLength(0);
  });

  it('Bug-G stale-done guard (cloud R5): multi-cat done for non-primary cat must NOT be misclassified as stale (slot key normalization)', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Multi-cat run: non-primary cats are keyed as `${invocationId}-${catId}` in
    // activeInvocations (useSocket.ts intent_mode registration), but backend
    // broadcasts `done` with the BARE parent invocationId to all cats. Before
    // the slot-key normalization, isStaleDone = `'inv-1-gpt52' !== 'inv-1'` =
    // true — non-primary cat's done gets skipped, bubble stuck streaming.
    const gpt52BubbleId = 'msg-gpt52-nonprimary';
    storeState.messages.push({
      id: gpt52BubbleId,
      type: 'assistant',
      catId: 'gpt52',
      content: 'gpt52 response',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: { invocationId: 'inv-1' } },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    // Non-primary cat registered with `${invocationId}-${catId}` key
    storeState.activeInvocations = { 'inv-1-gpt52': { catId: 'gpt52', mode: 'stream' } };

    vi.clearAllMocks();

    // done carries bare `inv-1` (parent invocation)
    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'gpt52',
        invocationId: 'inv-1',
        isFinal: false,
      });
    });

    // Non-primary done must be processed — bubble must be finalized
    expect(mockSetStreaming).toHaveBeenCalledWith(gpt52BubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === gpt52BubbleId);
    expect(bubble?.isStreaming, 'gpt52 bubble must be finalized (isStreaming=false)').toBe(false);
  });

  it('Bug-G stale-done guard (cloud R4): stale catInvocations=inv-1 must NOT trump fresh activeInvocations=inv-2 during preempt', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Cloud-identified edge: during same-cat preempt, `intent_mode` registers a
    // fresh activeInvocations[inv-2] BEFORE `invocation_created` for inv-2 arrives
    // (which would clear the old catInvocations[opus]=inv-1). In this window,
    // direct `catInvocations` still says inv-1. Late `done(inv-1)` must be treated
    // as stale because the freshest signal (activeSlot=inv-2) disagrees with the
    // direct cat binding.
    const inv2BubbleId = 'msg-inv2-cloud-r4';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    // Preempt window: catInvocations still has STALE inv-1, but activeInvocations
    // already registered FRESH inv-2 slot.
    storeState.catInvocations = { opus: { invocationId: 'inv-1' } };
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: false,
      });
    });

    // Stale signal must NOT act on inv-2 bubble
    expect(mockSetMessageStreamInvocation).not.toHaveBeenCalled();
    expect(mockSetStreaming).not.toHaveBeenCalledWith(inv2BubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === inv2BubbleId);
    expect(bubble?.isStreaming, 'inv-2 bubble must remain streaming despite direct catInvocations=inv-1').toBe(true);
    expect(bubble?.extra?.stream?.invocationId, 'bubble must not be misbound to inv-1').toBeUndefined();
  });

  it('Bug-G stale-done guard (砚砚 R4): stale done(inv-1) must NOT terminate inv-2 bubble (no setStreaming/activeRefs side effects)', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Same setup as R3 negative test, but extend assertions to cover phase-3
    // bubble side effects (setStreaming, activeRefs.delete via end-to-end probe).
    // A stale done must NOT flip inv-2's streaming bubble to isStreaming=false
    // nor clear the activeRef — doing so orphans the newer invocation and
    // re-creates Bug-G as "old done kills newer bubble" instead of misbinding.
    const inv2BubbleId = 'msg-inv2-phase3-guard';
    storeState.messages.push({
      id: inv2BubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'invocation 2 partial',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = { opus: { invocationId: 'inv-2' } };
    storeState.activeInvocations = { 'inv-2': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: false,
      });
    });

    // Bubble-level assertions: no identity rewrite + no streaming termination
    expect(mockSetMessageStreamInvocation).not.toHaveBeenCalled();
    expect(mockSetStreaming).not.toHaveBeenCalledWith(inv2BubbleId, false);
    const bubble = storeState.messages.find((m) => m.id === inv2BubbleId);
    expect(bubble?.isStreaming, 'inv-2 bubble must remain streaming').toBe(true);
    expect(
      bubble?.extra?.stream?.invocationId,
      'inv-2 bubble must stay invocationless (no misbinding)',
    ).toBeUndefined();

    // Next chunk for inv-2 must still recover via activeRefs (the ref must not
    // have been cleared by stale done). If activeRef was wiped, a new bubble
    // would be created — failing this assertion.
    vi.clearAllMocks();
    act(() => {
      captured?.handleAgentMessage({
        type: 'text',
        catId: 'opus',
        content: ' continuation',
      });
    });
    // Must append to existing bubble, not spawn a new one
    const newStreamBubbles = mockAddMessage.mock.calls.filter(
      ([m]) => m.type === 'assistant' && m.catId === 'opus' && m.origin === 'stream',
    );
    expect(newStreamBubbles).toHaveLength(0);
  });

  it('Bug-G back-fill via activeInvocations fallback: happy path when invocation_created lost but slot registered', () => {
    act(() => {
      root.render(React.createElement(Harness));
    });

    // Happy path using activeInvocations as resolution source (invocation_created
    // lost, but slot got registered independently). done(inv-1) arrives, guard
    // resolves "current invocation" = inv-1 via fallback → back-fill safe.
    const streamBubbleId = 'msg-inv1-active-slot';
    storeState.messages.push({
      id: streamBubbleId,
      type: 'assistant',
      catId: 'opus',
      content: 'streaming reply',
      isStreaming: true,
      origin: 'stream',
      extra: { stream: {} },
      timestamp: Date.now(),
    });
    storeState.catInvocations = {};
    storeState.activeInvocations = { 'inv-1': { catId: 'opus', mode: 'stream' } };

    vi.clearAllMocks();

    act(() => {
      captured?.handleAgentMessage({
        type: 'done',
        catId: 'opus',
        invocationId: 'inv-1',
        isFinal: true,
      });
    });

    expect(mockSetMessageStreamInvocation).toHaveBeenCalledWith(streamBubbleId, 'inv-1');
  });
});
