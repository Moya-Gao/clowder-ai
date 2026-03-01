/**
 * Connector bubble theming
 * - GitHub Review notifications should be visually distinct from generic connector bubbles.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConnectorBubble } from '../ConnectorBubble';
import type { ChatMessage } from '@/stores/chat-types';

describe('ConnectorBubble theme', () => {
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

  it('uses slate theme for github-review connector', () => {
    const message: ChatMessage = {
      id: 'm1',
      type: 'connector',
      content: '**GitHub Review 通知**',
      timestamp: Date.now(),
      source: {
        connector: 'github-review',
        label: 'GitHub Review',
        icon: '🔔',
        url: 'https://github.com/zts212653/cat-cafe/pull/97',
      },
    };

    act(() => {
      root.render(React.createElement(ConnectorBubble, { message }));
    });

    const html = container.innerHTML;
    expect(html).toContain('bg-slate-100');
    expect(html).toContain('border-slate-200');
    expect(html).not.toContain('bg-blue-100');
  });
});

