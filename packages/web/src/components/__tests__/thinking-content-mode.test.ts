/**
 * F045: ThinkingContent dynamic display — debug mode expands, play mode collapses.
 * Regression test for thinkingMode toggle behavior.
 */
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

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

describe('F045: ThinkingContent dynamic thinkingMode', () => {
  it('play mode: thinking and stream content are collapsed by default', () => {
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
          thinkingMode: 'play',
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

  it('debug mode: thinking and stream content are expanded by default', () => {
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
          thinkingMode: 'debug',
        })
      );
    });

    const buttons = container.querySelectorAll('button');
    const thinkingButton = Array.from(buttons).find((b) => b.textContent?.includes('🧠 Thinking'));
    const heartButton = Array.from(buttons).find((b) => b.textContent?.includes('💭 心里话'));

    expect(thinkingButton).toBeTruthy();
    expect(heartButton).toBeTruthy();

    // In debug mode, the expanded markdown content SHOULD be visible
    const markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(2); // one for 🧠, one for 💭
  });

  it('absent thinkingMode defaults to debug (expanded)', () => {
    // R2 P1: when thinkingMode is not passed, should default to debug (match ThinkingModeToggle)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
          // thinkingMode deliberately omitted
        })
      );
    });

    // Should be expanded (debug default), not collapsed (play)
    const markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(2); // one for 🧠, one for 💭
  });

  it('toggling from play to debug expands all blocks', () => {
    // Start in play mode (collapsed)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
          thinkingMode: 'play',
        })
      );
    });

    let markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(0); // collapsed

    // Switch to debug mode
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMessage,
          getCatById,
          thinkingMode: 'debug',
        })
      );
    });

    markdownDivs = container.querySelectorAll('.border-l-2.border-gray-300');
    expect(markdownDivs.length).toBe(2); // expanded
  });
});
