import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ModeStatusBar } from '@/components/ModeStatusBar';

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
});
afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
});

const mockSetCurrentMode = vi.fn();
const mockAddMessage = vi.fn();
let mockApiFetch: ReturnType<typeof vi.fn>;

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = {
      currentMode: {
        name: 'brainstorm',
        config: { topic: 'test topic' },
        startedAt: new Date().toISOString(),
      },
      currentThreadId: 'thread-1',
      setCurrentMode: mockSetCurrentMode,
      addMessage: mockAddMessage,
    };
    return selector(store);
  },
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/utils/userId', () => ({
  getUserId: () => 'test-user',
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockSetCurrentMode.mockClear();
  mockAddMessage.mockClear();
  mockApiFetch = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() => {
    root.render(React.createElement(ModeStatusBar));
  });
}

function getEndButton(): HTMLButtonElement {
  return container.querySelector('button')!;
}

describe('ModeStatusBar end-mode error handling', () => {
  it('clears stale mode on 404 response', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 404 });
    render();

    await act(async () => {
      getEndButton().click();
    });

    expect(mockSetCurrentMode).toHaveBeenCalledWith(null);
    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('shows error message on 500 response', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500 });
    render();

    await act(async () => {
      getEndButton().click();
    });

    expect(mockSetCurrentMode).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    const msg = mockAddMessage.mock.calls[0][0];
    expect(msg.variant).toBe('error');
    expect(msg.content).toContain('500');
  });

  it('shows network error message on fetch failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));
    render();

    await act(async () => {
      getEndButton().click();
    });

    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    const msg = mockAddMessage.mock.calls[0][0];
    expect(msg.variant).toBe('error');
    expect(msg.content).toContain('\u7F51\u7EDC\u9519\u8BEF');
  });

  it('clears mode and shows info on successful end', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ended: { name: 'brainstorm' } }),
    });
    render();

    await act(async () => {
      getEndButton().click();
    });

    expect(mockSetCurrentMode).toHaveBeenCalledWith(null);
    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    const msg = mockAddMessage.mock.calls[0][0];
    expect(msg.variant).toBe('info');
  });
});
