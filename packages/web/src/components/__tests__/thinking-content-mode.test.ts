/**
 * Thinking UI behavior (2026-03-01):
 * - Default is COLLAPSED (reduce fatigue)
 * - `Thread.thinkingMode` is cross-cat visibility semantics, NOT UI expansion state
 */
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useChatStore } from '@/stores/chatStore';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Stub TTS hook (ChatMessage uses it)
vi.mock('@/hooks/useTts', () => ({
  useTts: () => ({ state: 'idle', synthesize: vi.fn(), activeMessageId: null }),
}));

// Stub heavy sub-components
vi.mock('../RichBlocks', () => ({ RichBlocks: () => null }));
vi.mock('../ToolEventsPanel', () => ({ ToolEventsPanel: () => null }));
vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => ({
    cats: [],
    isLoading: false,
    getCatById: () => undefined,
    getCatsByBreed: () => new Map(),
  }),
}));

const { ChatMessage } = await import('../ChatMessage');

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
  // Stable default for each test (independent of localStorage)
  useChatStore.getState().setUiThinkingExpandedByDefault(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const thinkingMessage = {
  id: 'msg-1',
  type: 'assistant' as const,
  catId: 'opus',
  content: 'CLI stream output text',
  thinking: 'Extended reasoning content here',
  origin: 'stream' as const,
  timestamp: Date.now(),
  isStreaming: false,
};

const getCatById = () => undefined;

describe('ThinkingContent default collapse', () => {
  it('default: thinking and stream content are collapsed', () => {
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
        })
      );
    });

    const buttons = container.querySelectorAll('button');
    const thinkingButton = Array.from(buttons).find((b) => b.textContent?.includes('🧠 Thinking'));
    const heartButton = Array.from(buttons).find((b) => b.textContent?.includes('💭 心里话'));

    expect(thinkingButton).toBeTruthy();
    expect(heartButton).toBeTruthy();

    // In play mode, the expanded markdown content should NOT be visible
    // (ThinkingContent renders MarkdownContent only when expanded)
    const markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(0);
  });

  it('global toggle: enabling expands thinking blocks', () => {
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
        })
      );
    });

    expect(container.querySelectorAll('.border-l-2.border-gray-300').length).toBe(0);

    // Flip global preference → should expand all blocks
    act(() => {
      useChatStore.getState().setUiThinkingExpandedByDefault(true);
    });

    const markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(2); // one for 🧠, one for 💭 (stream wrapper)
  });
});
