/**
 * Mode switch proposal regression tests (R5 P1 fix)
 *
 * Static rendering tests:
 * 1. ConfirmDialog renders when proposal exists
 * 2. ConfirmDialog absent when no proposal
 * 3. Proposal carries threadId for cross-thread safety
 *
 * DOM interaction tests (R6):
 * 4. threadId mismatch → confirm click does NOT call handleSend
 * 5. Thread switch → setPendingModeSwitchProposal(null) called
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { ChatContainer } from '@/components/ChatContainer';

const mockSetPendingModeSwitchProposal = vi.fn();
const mockSetCurrentThread = vi.fn();
const mockSetCurrentMode = vi.fn();
const mockHandleSend = vi.fn();

let pendingProposal: {
  proposedMode: string;
  command: string;
  proposedBy: string;
  threadId: string;
} | null = null;

vi.mock('@/stores/chatStore', () => ({
  useChatStore: () => ({
    messages: [],
    isLoading: false,
    intentMode: null,
    targetCats: [],
    catStatuses: {},
    catInvocations: {},
    addMessage: vi.fn(),
    removeMessage: vi.fn(),
    setIntentMode: vi.fn(),
    setTargetCats: vi.fn(),
    clearCatStatuses: vi.fn(),
    setCurrentThread: mockSetCurrentThread,
    updateThreadTitle: vi.fn(),
    setCurrentMode: mockSetCurrentMode,
    currentMode: null,
    pendingModeSwitchProposal: pendingProposal,
    setPendingModeSwitchProposal: mockSetPendingModeSwitchProposal,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => ({
    tasks: [],
    addTask: vi.fn(),
    updateTask: vi.fn(),
    clearTasks: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ cancelInvocation: vi.fn() }),
}));

vi.mock('@/hooks/useAgentMessages', () => ({
  useAgentMessages: () => ({
    handleAgentMessage: vi.fn(),
    handleStop: vi.fn(),
    resetRefs: vi.fn(),
    resetTimeout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    handleScroll: vi.fn(),
    scrollContainerRef: { current: null },
    messagesEndRef: { current: null },
    isLoadingHistory: false,
    hasMore: false,
  }),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: () => ({ handleSend: mockHandleSend }),
}));

vi.mock('@/components/ChatMessage', () => ({ ChatMessage: () => null }));
vi.mock('@/components/ChatInput', () => ({ ChatInput: () => null }));
vi.mock('@/components/ThreadSidebar', () => ({ ThreadSidebar: () => null }));
vi.mock('@/components/RightStatusPanel', () => ({ RightStatusPanel: () => null }));
vi.mock('@/components/ParallelStatusBar', () => ({ ParallelStatusBar: () => null }));
vi.mock('@/components/ThinkingIndicator', () => ({ ThinkingIndicator: () => null }));
vi.mock('@/components/A2ACollapsible', () => ({ A2ACollapsible: () => null }));

describe('ChatContainer mode switch proposal — static (R5)', () => {
  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
  });

  beforeEach(() => {
    mockSetPendingModeSwitchProposal.mockClear();
    mockHandleSend.mockClear();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
  });

  it('renders ConfirmDialog when proposal exists', () => {
    pendingProposal = {
      proposedMode: 'debate',
      command: '/mode debate',
      proposedBy: 'opus',
      threadId: 'thread-1',
    };

    const html = renderToStaticMarkup(React.createElement(ChatContainer, { threadId: 'thread-1' }));

    expect(html).toContain('模式切换确认');
    expect(html).toContain('确认切换');
    expect(html).toContain('忽略');

    pendingProposal = null;
  });

  it('does NOT render ConfirmDialog when no proposal', () => {
    pendingProposal = null;

    const html = renderToStaticMarkup(React.createElement(ChatContainer, { threadId: 'thread-1' }));

    expect(html).not.toContain('模式切换确认');
  });

  it('proposal carries threadId for cross-thread validation', () => {
    pendingProposal = {
      proposedMode: 'brainstorm',
      command: '/mode brainstorm',
      proposedBy: 'codex',
      threadId: 'thread-X',
    };

    const html = renderToStaticMarkup(React.createElement(ChatContainer, { threadId: 'thread-Y' }));

    expect(html).toContain('模式切换确认');

    pendingProposal = null;
  });
});

describe('ChatContainer mode switch proposal — interaction (R6)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockSetPendingModeSwitchProposal.mockClear();
    mockHandleSend.mockClear();
    mockSetCurrentThread.mockClear();
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    pendingProposal = null;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
  });

  it('threadId mismatch: clicking confirm does NOT call handleSend', () => {
    pendingProposal = {
      proposedMode: 'debate',
      command: '/mode debate',
      proposedBy: 'opus',
      threadId: 'thread-A',
    };

    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-B' }));
    });

    // Find the confirm button by its text content
    const buttons = container.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find(b => b.textContent === '确认切换');
    expect(confirmBtn).toBeTruthy();

    // Click confirm — should NOT call handleSend because threadId mismatch
    act(() => { confirmBtn!.click(); });

    expect(mockHandleSend).not.toHaveBeenCalled();
    // Should still clear the proposal
    expect(mockSetPendingModeSwitchProposal).toHaveBeenCalledWith(null);
  });

  it('thread switch calls setPendingModeSwitchProposal(null)', () => {
    pendingProposal = {
      proposedMode: 'debate',
      command: '/mode debate',
      proposedBy: 'opus',
      threadId: 'thread-A',
    };

    // Initial render with thread-A
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-A' }));
    });

    mockSetPendingModeSwitchProposal.mockClear();

    // Switch to thread-B
    act(() => {
      root.render(React.createElement(ChatContainer, { threadId: 'thread-B' }));
    });

    // Thread switch should clear the pending proposal
    expect(mockSetPendingModeSwitchProposal).toHaveBeenCalledWith(null);
  });
});
