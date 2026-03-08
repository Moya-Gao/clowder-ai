import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ChatContainer } from '@/components/ChatContainer';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockApiFetch = vi.fn(async (url: string, opts?: Record<string, unknown>) => ({ ok: true }));

// Sortable IDs matching backend format: 16-digit timestamp + 6-digit seq + 8-char hex
const REAL_ID_1 = '0000001772900001-000001-aabbcc01';
const REAL_ID_2 = '0000001772900002-000002-aabbcc02';
const REAL_ID_3 = '0000001772900003-000003-aabbcc03';

// Mutable store state — mutate between renders to simulate thread switching
let storeState = {
  currentThreadId: 'thread-A',
  messages: [{ id: REAL_ID_1, type: 'assistant' as const, content: 'hello from A', timestamp: Date.now(), catId: 'opus' }],
};

const baseStore = () => ({
  ...storeState,
  isLoading: false,
  hasActiveInvocation: false,
  intentMode: null,
  targetCats: [],
  catStatuses: {},
  catInvocations: {},
  addMessage: vi.fn(),
  removeMessage: vi.fn(),
  setLoading: vi.fn(),
  setHasActiveInvocation: vi.fn(),
  setIntentMode: vi.fn(),
  setTargetCats: vi.fn(),
  clearCatStatuses: vi.fn(),
  setCurrentThread: vi.fn(),
  updateThreadTitle: vi.fn(),
  setCurrentMode: vi.fn(),
  currentMode: null,
  pendingModeSwitchProposal: null,
  setPendingModeSwitchProposal: vi.fn(),
  viewMode: 'single' as const,
  setViewMode: vi.fn(),
  clearUnread: vi.fn(),
  splitPaneThreadIds: [],
  setSplitPaneThreadIds: vi.fn(),
  setSplitPaneTarget: vi.fn(),
  rightPanelMode: null,
  uiThinkingExpandedByDefault: false,
  queue: [],
  queuePaused: false,
  queuePauseReason: null,
  queueFull: false,
  queueFullSource: null,
});

vi.mock('@/stores/chatStore', () => {
  const hook = (selector?: (s: ReturnType<typeof baseStore>) => unknown) => {
    const state = baseStore();
    return selector ? selector(state) : state;
  };
  return { useChatStore: hook };
});

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: string[]) => mockApiFetch(args[0], args[1] as unknown as Record<string, unknown>),
  API_URL: 'http://localhost:3002',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => ({ tasks: [], addTask: vi.fn(), updateTask: vi.fn(), clearTasks: vi.fn() }),
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ cancelInvocation: vi.fn(), syncRooms: vi.fn() }),
}));

vi.mock('@/hooks/useAgentMessages', () => ({
  useAgentMessages: () => ({ handleAgentMessage: vi.fn(), handleStop: vi.fn(), resetRefs: vi.fn(), resetTimeout: vi.fn() }),
}));

vi.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({ handleScroll: vi.fn(), scrollContainerRef: { current: null }, messagesEndRef: { current: null }, isLoadingHistory: false, hasMore: false }),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: () => ({ handleSend: vi.fn() }),
}));

vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => ({ pending: [], respond: vi.fn(), handleAuthRequest: vi.fn(), handleAuthResponse: vi.fn() }),
}));

vi.mock('@/hooks/useSplitPaneKeys', () => ({ useSplitPaneKeys: vi.fn() }));
vi.mock('@/hooks/useCatData', () => ({ useCatData: () => ({ getCatById: () => undefined }) }));

vi.mock('@/components/ChatMessage', () => ({ ChatMessage: () => null }));
vi.mock('@/components/ChatInput', () => ({ ChatInput: () => null }));
vi.mock('@/components/ChatContainerHeader', () => ({ ChatContainerHeader: () => null }));
vi.mock('@/components/ThreadSidebar', () => ({ ThreadSidebar: () => null }));
vi.mock('@/components/RightStatusPanel', () => ({ RightStatusPanel: () => null }));
vi.mock('@/components/ParallelStatusBar', () => ({ ParallelStatusBar: () => null }));
vi.mock('@/components/ThinkingIndicator', () => ({ ThinkingIndicator: () => null }));
vi.mock('@/components/A2ACollapsible', () => ({ A2ACollapsible: () => null }));
vi.mock('@/components/ModeStatusBar', () => ({ ModeStatusBar: () => null }));
vi.mock('@/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/MessageNavigator', () => ({ MessageNavigator: () => null }));
vi.mock('@/components/MessageActions', () => ({ MessageActions: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/CatCafeHub', () => ({ CatCafeHub: () => null }));
vi.mock('@/components/SplitPaneView', () => ({ SplitPaneView: () => null }));
vi.mock('@/components/MobileStatusSheet', () => ({ MobileStatusSheet: () => null }));
vi.mock('@/components/QueuePanel', () => ({ QueuePanel: () => null }));
vi.mock('@/components/ScrollToBottomButton', () => ({ ScrollToBottomButton: () => null }));
vi.mock('@/components/AuthorizationCard', () => ({ AuthorizationCard: () => null }));
vi.mock('@/components/WorkspacePanel', () => ({ WorkspacePanel: () => null }));
vi.mock('@/components/icons/PawIcon', () => ({ PawIcon: () => null }));

describe('F069 Bug A: read ack thread-switch race guard', () => {
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
    mockApiFetch.mockClear();
    // Reset to thread-A state
    storeState = {
      currentThreadId: 'thread-A',
      messages: [{ id: '0000001772900001-000001-aabbcc01', type: 'assistant' as const, content: 'hello from A', timestamp: Date.now(), catId: 'opus' }],
    };
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('does NOT send ack when storeThreadId lags behind prop threadId (race window)', async () => {
    // Step 1: Render with thread-A — store is consistent
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-A' }));
    });
    // Allow effects to flush
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    // The initial ack for thread-A is fine — clear mock to focus on the race
    mockApiFetch.mockClear();

    // Step 2: Simulate the race — threadId prop changes to thread-B,
    // but store still has thread-A's currentThreadId and messages
    // (setCurrentThread hasn't run yet)
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-B' }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    // The guard should have prevented ack from firing with thread-B + 0000001772900001-000001-aabbcc01
    const raceCalls = mockApiFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('thread-B'),
    );
    expect(raceCalls.length).toBe(0);
  });

  it('sends ack correctly when store and prop threadId are consistent', async () => {
    // Store and prop both point to thread-A
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-A' }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    // Should have sent ack for thread-A with 0000001772900001-000001-aabbcc01
    const ackCalls = mockApiFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/read'),
    );
    expect(ackCalls.length).toBe(1);
    expect(ackCalls[0][0]).toContain('thread-A');
    const body = JSON.parse((ackCalls[0]![1] as { body: string }).body);
    expect(body.upToMessageId).toBe('0000001772900001-000001-aabbcc01');
  });

  it('skips all synthetic IDs and acks with last sortable-format message', async () => {
    // Messages list ends with various synthetic rows — ack should use the real sortable ID
    storeState = {
      currentThreadId: 'thread-A',
      messages: [
        { id: REAL_ID_2, type: 'assistant' as const, content: 'hi', timestamp: Date.now(), catId: 'opus' },
        { id: REAL_ID_3, type: 'assistant' as const, content: 'hey', timestamp: Date.now(), catId: 'opus' },
        { id: 'bg-sys-1772900004-opus-1', type: 'assistant' as const, content: 'info', timestamp: Date.now(), catId: 'opus' },
        { id: 'draft-inv-123', type: 'assistant' as const, content: '...', timestamp: Date.now(), catId: 'opus' },
        { id: 'summary-abc', type: 'assistant' as const, content: 'sum', timestamp: Date.now(), catId: 'opus' },
      ],
    };

    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-A' }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    const ackCalls = mockApiFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/read'),
    );
    expect(ackCalls.length).toBe(1);
    const body = JSON.parse((ackCalls[0]![1] as { body: string }).body);
    // Should use REAL_ID_3, not bg-sys-*, draft-*, or summary-*
    expect(body.upToMessageId).toBe(REAL_ID_3);
  });

  it('does not send ack when all messages are synthetic', async () => {
    storeState = {
      currentThreadId: 'thread-A',
      messages: [
        { id: 'draft-inv-1', type: 'assistant' as const, content: '...', timestamp: Date.now(), catId: 'opus' },
        { id: 'bg-sys-1772900004-opus-1', type: 'assistant' as const, content: 'info', timestamp: Date.now(), catId: 'opus' },
        { id: 'summary-xyz', type: 'assistant' as const, content: 'sum', timestamp: Date.now(), catId: 'opus' },
        { id: 'a2a-1772900005-codex', type: 'assistant' as const, content: 'chain', timestamp: Date.now(), catId: 'codex' },
        { id: 'err-1772900006-opus', type: 'assistant' as const, content: 'error', timestamp: Date.now(), catId: 'opus' },
      ],
    };

    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-A' }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    const ackCalls = mockApiFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/read'),
    );
    expect(ackCalls.length).toBe(0);
  });
});
