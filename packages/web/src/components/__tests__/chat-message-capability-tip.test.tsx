import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const chatStoreMock = vi.hoisted(() => ({
  catStatuses: {} as Record<string, string>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/hooks/useCoCreatorConfig', () => ({
  useCoCreatorConfig: () => ({
    name: '铲屎官',
    color: { primary: '#7c3aed' },
  }),
}));

vi.mock('@/hooks/useTts', () => ({
  useTts: () => ({ state: 'idle', synthesize: vi.fn(), activeMessageId: null }),
}));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentThreadId: 'thread-f244',
      isLoadingThreads: false,
      threads: [{ id: 'thread-f244', title: 'F244 dogfood' }],
      messages: [],
      catStatuses: chatStoreMock.catStatuses,
      globalBubbleDefaults: { thinking: 'collapsed', cliOutput: 'collapsed' },
    }),
  resolveBubbleExpanded: (override: string | undefined, globalDefault: string) => {
    if (override && override !== 'global') return override === 'expanded';
    return globalDefault === 'expanded';
  },
}));

vi.mock('@/components/CatAvatar', () => ({
  CatAvatar: () => React.createElement('span', { 'data-testid': 'cat-avatar' }, 'avatar'),
}));

vi.mock('@/components/CollapsibleMarkdown', () => ({
  CollapsibleMarkdown: ({ content }: { content: string }) =>
    React.createElement('span', { 'data-testid': 'message-text' }, content),
}));

describe('F244 ChatMessage capability tips', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    chatStoreMock.catStatuses = {};
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function streamingMessage() {
    return {
      id: 'msg-streaming',
      type: 'assistant',
      catId: 'opus',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      origin: 'stream',
      visibility: 'public',
      contentBlocks: null,
      toolEvents: null,
      metadata: null,
      summary: null,
      evidence: null,
      extra: null,
      source: null,
    };
  }

  function getCatById() {
    return {
      id: 'opus',
      displayName: '布偶猫',
      variantLabel: 'Opus 4.7',
      breedId: 'ragdoll',
      clientId: 'anthropic',
      defaultModel: 'claude-opus-4-7',
      avatar: '/avatars/opus.png',
      mentionPatterns: ['@opus'],
      roleDescription: '',
      personality: '',
      color: { primary: '#9B7EBD', secondary: '#E8DFF5' },
    };
  }

  it('renders the waiting tip inside the streaming assistant bubble', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    await act(async () => {
      root.render(
        React.createElement(ChatMessage, {
          message: streamingMessage() as never,
          getCatById: getCatById as never,
          showCapabilityTip: true,
        }),
      );
      await Promise.resolve();
    });

    const bubble = container.querySelector('[data-message-id="msg-streaming"]');
    expect(bubble?.textContent).toContain('Thinking...');
    expect(bubble?.querySelector('[data-testid="capability-tip-strip"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    expect(bubble?.querySelector('[data-testid="capability-tip-strip"]')).not.toBeNull();
    expect(bubble?.textContent).toContain('了解更多');
  });

  it.each([
    'suspected_stall',
    'alive_but_silent',
  ])('hides the waiting tip inside the streaming assistant bubble when the cat is %s', async (status) => {
    chatStoreMock.catStatuses = { opus: status };
    const { ChatMessage } = await import('@/components/ChatMessage');

    await act(async () => {
      root.render(
        React.createElement(ChatMessage, {
          message: streamingMessage() as never,
          getCatById: getCatById as never,
          showCapabilityTip: true,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    const bubble = container.querySelector('[data-message-id="msg-streaming"]');
    expect(bubble?.textContent).toContain('Thinking...');
    expect(bubble?.querySelector('[data-testid="capability-tip-strip"]')).toBeNull();
  });
});
