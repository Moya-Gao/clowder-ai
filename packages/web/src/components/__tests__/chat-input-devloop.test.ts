import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/ChatInput';

vi.mock('@/components/icons/SendIcon', () => ({
  SendIcon: () => React.createElement('span', null, 'send'),
}));
vi.mock('@/components/icons/LoadingIcon', () => ({
  LoadingIcon: () => React.createElement('span', null, 'loading'),
}));
vi.mock('@/components/icons/AttachIcon', () => ({
  AttachIcon: () => React.createElement('span', null, 'attach'),
}));
vi.mock('@/components/ImagePreview', () => ({
  ImagePreview: () => null,
}));
vi.mock('@/utils/compressImage', () => ({
  compressImage: (f: File) => Promise.resolve(f),
}));

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
});
afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
});

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
});

describe('ChatInput dev-loop option', () => {
  it('MODE_OPTIONS includes dev-loop entry', () => {
    const noop = vi.fn();
    act(() => {
      root.render(React.createElement(ChatInput, { onSend: noop }));
    });

    // Click mode button to show menu
    const modeBtn = container.querySelector('button[aria-label="Mode"]') as HTMLButtonElement;
    act(() => {
      modeBtn.click();
    });

    // Find the dev-loop option in the menu
    const buttons = container.querySelectorAll('button');
    const devLoopBtn = Array.from(buttons).find((b) => b.textContent?.includes('\u5F00\u53D1\u81EA\u95ED\u73AF'));
    expect(devLoopBtn).toBeTruthy();
    expect(devLoopBtn?.textContent).toContain('dev-loop');
  });

  it('selecting dev-loop inserts /mode dev-loop prefix', () => {
    const noop = vi.fn();
    act(() => {
      root.render(React.createElement(ChatInput, { onSend: noop }));
    });

    // Click mode button
    const modeBtn = container.querySelector('button[aria-label="Mode"]') as HTMLButtonElement;
    act(() => {
      modeBtn.click();
    });

    // Click dev-loop option
    const buttons = container.querySelectorAll('button');
    const devLoopBtn = Array.from(buttons).find((b) => b.textContent?.includes('\u5F00\u53D1\u81EA\u95ED\u73AF'));
    act(() => {
      devLoopBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('/mode dev-loop ');
  });
});
