import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: { uiThinkingExpandedByDefault: boolean }) => unknown) => selector({ uiThinkingExpandedByDefault: false }),
}));

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe('ChatMessage layout-change event timing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('dispatches chat-layout-changed after thinking collapse state commits (cloud P2)', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    const message = {
      id: 'm1',
      type: 'assistant',
      catId: 'codex',
      timestamp: Date.now(),
      visibility: 'public',
      revealedAt: null,
      whisperTo: null,
      origin: 'assistant',
      variant: null,
      isStreaming: false,
      content: '',
      thinking: 'hello thinking',
      contentBlocks: null,
      toolEvents: null,
      metadata: null,
      summary: null,
      evidence: null,
      extra: null,
      source: null,
    } as const;

    let expandedPresentAtEvent: boolean | null = null;
    const handler = () => {
      expandedPresentAtEvent = Boolean(container.querySelector('div.border-l-2'));
    };
    window.addEventListener('catcafe:chat-layout-changed', handler);

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: message as unknown,
          getCatById: () => undefined,
        }),
      );
    });

    const thinkingToggle = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('🧠 Thinking'));
    expect(thinkingToggle).toBeTruthy();

    act(() => {
      (thinkingToggle as HTMLButtonElement).click();
    });

    expect(container.querySelector('div.border-l-2')).toBeTruthy();
    expect(expandedPresentAtEvent).toBe(true);

    window.removeEventListener('catcafe:chat-layout-changed', handler);
  });

  it('dispatches chat-layout-changed after tool-events collapse state commits (cloud P2)', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    const message = {
      id: 'm2',
      type: 'assistant',
      catId: 'codex',
      timestamp: Date.now(),
      visibility: 'public',
      revealedAt: null,
      whisperTo: null,
      origin: 'assistant',
      variant: null,
      isStreaming: false,
      content: '',
      thinking: '',
      contentBlocks: null,
      toolEvents: [
        { id: 't1', type: 'tool_use', label: 'tool 1', detail: 'detail-1' },
      ],
      metadata: null,
      summary: null,
      evidence: null,
      extra: null,
      source: null,
    } as const;

    let expandedPresentAtEvent: boolean | null = null;
    const handler = () => {
      expandedPresentAtEvent = (container.textContent ?? '').includes('detail-1');
    };
    window.addEventListener('catcafe:chat-layout-changed', handler);

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: message as unknown,
          getCatById: () => undefined,
        }),
      );
    });

    const toolToggle = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('个工具调用'));
    expect(toolToggle).toBeTruthy();

    act(() => {
      (toolToggle as HTMLButtonElement).click();
    });

    expect((container.textContent ?? '').includes('detail-1')).toBe(true);
    expect(expandedPresentAtEvent).toBe(true);

    window.removeEventListener('catcafe:chat-layout-changed', handler);
  });
});
