/**
 * F154 Phase B — ThreadCatPill: shows preferred cat in header, opens CatSelector popover.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const TEST_CATS = [
  {
    id: 'opus',
    displayName: 'opus',
    nickname: '宪宪',
    variantLabel: undefined,
    breedDisplayName: '布偶猫',
    color: { primary: '#FFAB91', secondary: '#8D6E63' },
    clientId: 'anthropic',
    defaultModel: 'claude-opus-4-6',
    isDefaultVariant: true,
    source: 'seed' as const,
  },
  {
    id: 'codex',
    displayName: 'codex',
    nickname: '砚砚',
    variantLabel: undefined,
    breedDisplayName: '缅因猫',
    color: { primary: '#66BB6A', secondary: '#2E7D32' },
    clientId: 'openai',
    defaultModel: 'gpt-5.3-codex',
    isDefaultVariant: true,
    source: 'seed' as const,
  },
];

const mockCatData = {
  cats: TEST_CATS,
  isLoading: false,
  getCatById: (id: string) => TEST_CATS.find((c) => c.id === id),
  getCatsByBreed: () => new Map(),
  refresh: vi.fn(),
};
vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => mockCatData,
  formatCatName: (cat: { displayName: string; variantLabel?: string }) =>
    cat.variantLabel ? `${cat.displayName} ${cat.variantLabel}` : cat.displayName,
}));

const TEST_THREAD = {
  id: 'thread_pill_test',
  title: 'Pill Test Thread',
  projectPath: '/projects/cat-cafe',
  createdBy: 'user1',
  participants: ['user1'],
  lastActiveAt: Date.now(),
  createdAt: Date.now(),
  pinned: false,
  favorited: false,
  preferredCats: ['opus'] as string[],
};

const mockStore: Record<string, unknown> = {
  threads: [TEST_THREAD],
  updateThreadPreferredCats: vi.fn(),
};
vi.mock('@/stores/chatStore', () => {
  const hook = Object.assign(
    (selector?: (s: typeof mockStore) => unknown) => (selector ? selector(mockStore) : mockStore),
    { getState: () => mockStore },
  );
  return { useChatStore: hook };
});

// Lazy import after mocks
const { ThreadCatPill } = await import('@/components/ThreadCatPill');

describe('ThreadCatPill (F154 Phase B)', () => {
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
    mockStore.threads = [{ ...TEST_THREAD, preferredCats: ['opus'] }];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders pill with cat name when preferredCats is set', () => {
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_pill_test' }));
    });
    expect(container.textContent).toContain('opus');
  });

  it('renders nothing when preferredCats is empty', () => {
    mockStore.threads = [{ ...TEST_THREAD, preferredCats: [] }];
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_pill_test' }));
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when preferredCats is undefined', () => {
    mockStore.threads = [{ ...TEST_THREAD, preferredCats: undefined }];
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_pill_test' }));
    });
    expect(container.innerHTML).toBe('');
  });

  it('shows persona color dot matching the cat', () => {
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_pill_test' }));
    });
    const dot = container.querySelector('[data-testid="pill-dot"]');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(255, 171, 145)'); // #FFAB91
  });

  it('renders nothing for unknown threadId', () => {
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_nonexistent' }));
    });
    expect(container.innerHTML).toBe('');
  });

  it('shows chevron indicating expandable', () => {
    act(() => {
      root.render(React.createElement(ThreadCatPill, { threadId: 'thread_pill_test' }));
    });
    expect(container.textContent).toContain('▾');
  });
});
