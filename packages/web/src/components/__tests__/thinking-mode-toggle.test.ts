/**
 * F045 P1 regression: ThinkingContent defaultExpanded + useEffect mode-sync
 *
 * Verifies:
 * 1. play mode → thinking blocks collapsed (preview shown)
 * 2. debug mode → thinking blocks expanded (full content shown)
 * 3. Toggling thinkingMode re-renders already-mounted blocks
 */
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// ── Stub hooks used by ChatMessage ──
vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => ({ cats: [], isLoading: false, getCatById: () => undefined, getCatsByBreed: () => new Map() }),
}));
vi.mock('@/hooks/useTts', () => ({
  useTts: () => ({ state: 'idle', synthesize: vi.fn(), activeMessageId: null }),
}));

// ── Stub heavy sub-components ──
vi.mock('@/components/CatAvatar', () => ({
  CatAvatar: () => React.createElement('span', null, 'avatar'),
}));
vi.mock('@/components/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => React.createElement('span', null, content),
}));
vi.mock('@/components/EvidencePanel', () => ({ EvidencePanel: () => null }));
vi.mock('@/components/MetadataBadge', () => ({ MetadataBadge: () => null }));
vi.mock('@/components/SummaryCard', () => ({ SummaryCard: () => null }));
vi.mock('@/components/rich/RichBlocks', () => ({ RichBlocks: () => null }));

const THINKING_TEXT = 'I am thinking about the meaning of cats and coffee.';

describe('F045: ThinkingContent thinkingMode toggle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const thinkingMsg = {
    id: 't1',
    type: 'assistant' as const,
    catId: 'opus',
    content: 'visible reply',
    thinking: THINKING_TEXT,
    timestamp: Date.now(),
    contentBlocks: [],
  };

  const getCatById = vi.fn(() => ({
    id: 'opus',
    displayName: '布偶猫',
    color: { primary: '#9B7EBD', secondary: '#E8DFF5' },
    breedId: 'ragdoll',
    provider: 'anthropic',
    defaultModel: 'claude-sonnet-4-5-20250929',
    avatar: '/avatars/opus.png',
    mentionPatterns: [],
    roleDescription: '',
    personality: '',
  }));

  it('play mode: thinking block is collapsed by default', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'play',
        }),
      );
    });

    // Collapsed: button visible with label, full thinking text NOT rendered
    const buttons = container.querySelectorAll('button');
    const thinkingButton = Array.from(buttons).find((b) => b.textContent?.includes('Thinking'));
    expect(thinkingButton).toBeTruthy();

    // Full content should NOT be in the DOM when collapsed
    // The border-l-2 div with MarkdownContent only renders when expanded
    const expandedBlocks = container.querySelectorAll('.border-l-2');
    expect(expandedBlocks.length).toBe(0);
  });

  it('debug mode: thinking block is expanded by default', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'debug',
        }),
      );
    });

    // Expanded: full thinking content rendered in the DOM
    const expandedBlocks = container.querySelectorAll('.border-l-2');
    expect(expandedBlocks.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain(THINKING_TEXT);
  });

  it('switching play→debug expands already-rendered thinking blocks', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    // Step 1: render in play mode (collapsed)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'play',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBe(0);

    // Step 2: re-render with debug mode (should expand via useEffect)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'debug',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain(THINKING_TEXT);
  });

  it('switching debug→play collapses already-rendered thinking blocks', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    // Step 1: render in debug mode (expanded)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'debug',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBeGreaterThanOrEqual(1);

    // Step 2: switch to play mode (should collapse via useEffect)
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: thinkingMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'play',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBe(0);
  });

  it('stream-origin messages also respect thinkingMode', async () => {
    const { ChatMessage } = await import('@/components/ChatMessage');

    const streamMsg = {
      id: 's1',
      type: 'assistant' as const,
      catId: 'opus',
      content: 'stream inner monologue content here',
      origin: 'stream',
      isStreaming: false,
      timestamp: Date.now(),
      contentBlocks: [],
    };

    // debug mode → stream-origin content expanded
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: streamMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'debug',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('stream inner monologue content here');

    // play mode → collapsed
    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: streamMsg as never,
          getCatById: getCatById as never,
          thinkingMode: 'play',
        }),
      );
    });

    expect(container.querySelectorAll('.border-l-2').length).toBe(0);
  });
});
