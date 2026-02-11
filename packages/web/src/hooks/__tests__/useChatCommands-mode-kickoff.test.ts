import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useChatCommands } from '../useChatCommands';

const mocks = vi.hoisted(() => {
  const mockAddMessage = vi.fn();
  const mockApiFetch = vi.fn();
  const useChatStoreMock = Object.assign(
    () => ({ addMessage: mockAddMessage }),
    {
      getState: () => ({ currentThreadId: 'thread-1' }),
    },
  );

  return { mockAddMessage, mockApiFetch, useChatStoreMock };
});

vi.mock('@/stores/chatStore', () => ({
  useChatStore: mocks.useChatStoreMock,
}));

vi.mock('@/utils/userId', () => ({
  getUserId: () => 'user-1',
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mocks.mockApiFetch(...args),
}));

interface HarnessProps {
  onReady: (fn: (input: string) => Promise<boolean>) => void;
}

function Harness({ onReady }: HarnessProps) {
  const { processCommand } = useChatCommands();

  React.useEffect(() => {
    onReady(processCommand);
  }, [onReady, processCommand]);

  return null;
}

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
});

afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
});

describe('useChatCommands /mode kickoff', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.mockAddMessage.mockClear();
    mocks.mockApiFetch.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('auto-kicks brainstorm after /mode command starts successfully', async () => {
    let processCommand: ((input: string) => Promise<boolean>) | null = null;

    act(() => {
      root.render(React.createElement(Harness, { onReady: (fn) => { processCommand = fn; } }));
    });

    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });

    let handled = false;
    await act(async () => {
      handled = await processCommand!('/mode brainstorm 模式启动回归 @布偶 @缅因');
    });

    expect(handled).toBe(true);
    expect(mocks.mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/messages',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '模式启动回归',
          threadId: 'thread-1',
        }),
      }),
    );
  });
});
