import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatData } from '@/hooks/useCatData';
import { primeCoCreatorConfigCache, resetCoCreatorConfigCacheForTest } from '@/hooks/useCoCreatorConfig';
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      uiThinkingExpandedByDefault: false,
      threads: [],
      currentThreadId: null,
      isLoadingThreads: false,
      messages: [],
      globalBubbleDefaults: { thinking: 'collapsed', cliOutput: 'collapsed' },
    }),
  resolveBubbleExpanded: () => false,
}));

vi.mock('@/hooks/useTts', () => ({
  useTts: () => ({ state: 'idle', synthesize: vi.fn(), activeMessageId: null }),
}));

vi.mock('@/components/CatAvatar', () => ({
  CatAvatar: () => React.createElement('span', null, 'avatar'),
}));
vi.mock('@/components/ConnectorBubble', () => ({ ConnectorBubble: () => null }));
vi.mock('@/components/EvidencePanel', () => ({ EvidencePanel: () => null }));
vi.mock('@/components/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) =>
    React.createElement('span', { 'data-testid': 'rendered-markdown' }, content),
}));
vi.mock('@/components/MetadataBadge', () => ({ MetadataBadge: () => null }));
vi.mock('@/components/SummaryCard', () => ({ SummaryCard: () => null }));
vi.mock('@/components/rich/RichBlocks', () => ({ RichBlocks: () => null }));
vi.mock('@/components/TimeoutDiagnosticsPanel', () => ({ TimeoutDiagnosticsPanel: () => null }));
vi.mock('@/components/TtsPlayButton', () => ({ TtsPlayButton: () => null }));

const opusCat = (): CatData =>
  ({
    id: 'opus',
    displayName: '布偶猫',
    breedId: 'ragdoll',
    color: { primary: '#FFD700', secondary: '#FFF8DC' },
  }) as unknown as CatData;

describe('ChatMessage stream-origin text + tools rendering', () => {
  let container: HTMLDivElement;
  let root: Root;
  let ChatMessage: React.FC<{ message: ChatMessageType; getCatById: (id: string) => CatData | undefined }>;

  beforeAll(async () => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const mod = await import('@/components/ChatMessage');
    ChatMessage = mod.ChatMessage;
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    resetCoCreatorConfigCacheForTest();
    primeCoCreatorConfigCache({
      name: '铲屎官',
      aliases: [],
      mentionPatterns: ['@owner'],
      avatar: '/uploads/owner.png',
      color: { primary: '#000', secondary: '#FFF' },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetCoCreatorConfigCacheForTest();
  });

  it('renders final text content separately when stream-origin assistant has both content and tool events (4.6 final answer + tools)', () => {
    const MARKER = 'FINAL_ANSWER_MARKER_XYZ_12345';

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: {
            id: 'msg-stream-with-tools',
            type: 'assistant',
            catId: 'opus',
            origin: 'stream',
            content: `这是布偶猫的最终回答。${MARKER}`,
            contentBlocks: [],
            toolEvents: [
              {
                id: 'te-1',
                type: 'tool_use',
                label: 'opus → Read',
                timestamp: 100,
                detail: '{"file_path":"/foo.ts"}',
              },
              { id: 'te-2', type: 'tool_result', label: 'Read result', timestamp: 200, detail: 'file content' },
            ],
            timestamp: Date.now(),
            isStreaming: false,
          },
          getCatById: (id: string) => (id === 'opus' ? opusCat() : undefined),
        }),
      );
    });

    expect(container.textContent).toContain(MARKER);
    expect(container.textContent).toContain('CLI Output');

    const cliBody = container.querySelector('[data-testid="cli-output-body"]');
    const allMarkdowns = container.querySelectorAll('[data-testid="rendered-markdown"]');
    const outsideCli = Array.from(allMarkdowns).filter((el) => !cliBody || !cliBody.contains(el));
    const someOutsideContainsMarker = outsideCli.some((el) => el.textContent?.includes(MARKER));
    expect(someOutsideContainsMarker).toBe(true);
  });

  it('renders final text content for stream-origin assistant when there are NO tool events (defensive: stream + text alone)', () => {
    const MARKER = 'PLAIN_STREAM_TEXT_ONLY_67890';

    act(() => {
      root.render(
        React.createElement(ChatMessage, {
          message: {
            id: 'msg-stream-text-only',
            type: 'assistant',
            catId: 'opus',
            origin: 'stream',
            content: `布偶猫的纯文本回答。${MARKER}`,
            contentBlocks: [],
            timestamp: Date.now(),
            isStreaming: false,
          },
          getCatById: (id: string) => (id === 'opus' ? opusCat() : undefined),
        }),
      );
    });

    expect(container.textContent).toContain(MARKER);
    const allMarkdowns = container.querySelectorAll('[data-testid="rendered-markdown"]');
    expect(Array.from(allMarkdowns).some((el) => el.textContent?.includes(MARKER))).toBe(true);
  });
});
