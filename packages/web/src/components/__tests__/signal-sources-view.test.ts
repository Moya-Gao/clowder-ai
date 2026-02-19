import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalSourcesView } from '@/components/signals/SignalSourcesView';

const mocks = vi.hoisted(() => ({
  fetchSignalSources: vi.fn(),
  updateSignalSource: vi.fn(),
}));

vi.mock('@/utils/signals-api', () => ({
  fetchSignalSources: (...args: unknown[]) => mocks.fetchSignalSources(...args),
  updateSignalSource: (...args: unknown[]) => mocks.updateSignalSource(...args),
}));

describe('SignalSourcesView', () => {
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
    mocks.fetchSignalSources.mockReset();
    mocks.updateSignalSource.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders visit link for each source url', async () => {
    mocks.fetchSignalSources.mockResolvedValueOnce([
      {
        id: 'anthropic-news',
        name: 'Anthropic Newsroom',
        url: 'https://www.anthropic.com/news',
        tier: 1,
        category: 'official',
        enabled: true,
        fetch: { method: 'webpage' },
        schedule: { frequency: 'daily' },
      },
    ]);

    await act(async () => {
      root.render(React.createElement(SignalSourcesView));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const visitLink = Array.from(container.querySelectorAll('a[href="https://www.anthropic.com/news"]'))
      .find((item) => item.textContent?.includes('访问'));
    expect(visitLink).not.toBeNull();
    expect(visitLink?.textContent ?? '').toContain('访问');
  });
});
