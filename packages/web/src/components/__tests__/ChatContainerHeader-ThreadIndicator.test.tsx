import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStore: {
  threads: Array<{ id: string; title?: string; projectPath?: string }>;
} = { threads: [] };

vi.mock('@/stores/chatStore', () => {
  const hook = Object.assign(
    (selector?: (s: typeof mockStore) => unknown) => (selector ? selector(mockStore) : mockStore),
    { getState: () => mockStore },
  );
  return { useChatStore: hook };
});

import { ThreadIndicator } from '../ChatContainerHeader';

const LONG_TITLE = 'A'.repeat(120);

describe('ThreadIndicator — P1-1 truncation layout (#727)', () => {
  beforeEach(() => {
    mockStore.threads = [{ id: 'thread-1', title: LONG_TITLE, projectPath: '/Users/me/workspace/AI/clowder-ai' }];
  });

  it('renders title and project tag as flex siblings so the tag is not truncated with the title', () => {
    const html = renderToStaticMarkup(<ThreadIndicator threadId="thread-1" />);
    // Outer flex container with min-w-0 so the truncating child can shrink.
    expect(html).toMatch(/class="flex min-w-0[^"]*"/);
    // Title span owns the truncation.
    expect(html).toMatch(/<span class="truncate min-w-0[^"]*"[^>]*>A{120}<\/span>/);
    // Project tag span uses flex-shrink-0 so it survives long titles.
    expect(html).toContain('flex-shrink-0');
    // Project name still rendered (long-title scenario must not eat the tag).
    expect(html).toContain('· clowder-ai');
  });

  it('omits the project chip entirely for the default sentinel thread', () => {
    mockStore.threads = [{ id: 'thread-1', title: 'x', projectPath: 'default' }];
    const html = renderToStaticMarkup(<ThreadIndicator threadId="thread-1" />);
    expect(html).not.toContain('flex-shrink-0');
    expect(html).not.toContain('· ');
  });

  it('renders a stable lobby string for the default threadId without touching projectPath', () => {
    const html = renderToStaticMarkup(<ThreadIndicator threadId="default" />);
    expect(html).toContain('大厅');
    expect(html).not.toContain('flex-shrink-0');
  });
});

describe('ThreadIndicator — P1-2 clipboard guard', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalClipboard: PropertyDescriptor | undefined;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStore.threads = [{ id: 'thread-1', title: 't', projectPath: '/Users/me/workspace/AI/clowder-ai' }];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('does not throw when navigator.clipboard is undefined (insecure context / older webview)', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    act(() => root.render(<ThreadIndicator threadId="thread-1" />));
    const tag = container.querySelector('[role="button"]') as HTMLElement | null;
    expect(tag).not.toBeNull();
    expect(() => act(() => tag?.click())).not.toThrow();
  });

  it('does not throw when navigator.clipboard.writeText throws synchronously', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          throw new Error('NotAllowedError');
        },
      },
      configurable: true,
    });
    act(() => root.render(<ThreadIndicator threadId="thread-1" />));
    const tag = container.querySelector('[role="button"]') as HTMLElement | null;
    expect(() => act(() => tag?.click())).not.toThrow();
  });

  it('does not throw when writeText() rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    act(() => root.render(<ThreadIndicator threadId="thread-1" />));
    const tag = container.querySelector('[role="button"]') as HTMLElement | null;
    await expect(
      (async () => {
        await act(async () => {
          tag?.click();
        });
      })(),
    ).resolves.toBeUndefined();
  });
});
