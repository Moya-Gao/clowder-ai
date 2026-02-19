import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
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
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe('useChatCommands /mode kickoff', () => {
  let container: HTMLDivElement;
  let root: Root;

  function getLatestSystemMessageContent(): string | null {
    const msg = getLatestSystemMessage();
    return typeof msg?.content === 'string' ? msg.content : null;
  }

  function getLatestSystemMessage(): Record<string, unknown> | null {
    const calls = mocks.mockAddMessage.mock.calls as Array<[Record<string, unknown>]>;
    for (let i = calls.length - 1; i >= 0; i -= 1) {
      const msg = calls[i][0];
      if (msg.type === 'system') return msg;
    }
    return null;
  }

  async function setupProcessCommand(): Promise<(input: string) => Promise<boolean>> {
    let processCommand: ((input: string) => Promise<boolean>) | null = null;
    await act(async () => {
      root.render(React.createElement(Harness, { onReady: (fn) => { processCommand = fn; } }));
    });
    if (!processCommand) throw new Error('processCommand not initialized');
    return processCommand;
  }

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
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });

    let handled = false;
    await act(async () => {
      handled = await processCommand('/mode brainstorm 模式启动回归 @布偶 @缅因');
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

  it('auto-kicks debate after /mode debate starts successfully', async () => {
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });

    let handled = false;
    await act(async () => {
      handled = await processCommand('/mode debate 是否需要合并 @布偶 @缅因 3');
    });

    expect(handled).toBe(true);
    expect(mocks.mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/messages',
      expect.objectContaining({
        body: JSON.stringify({
          content: '是否需要合并',
          threadId: 'thread-1',
        }),
      }),
    );
  });

  it('auto-kicks dev-loop after /mode dev-loop starts successfully', async () => {
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });

    let handled = false;
    await act(async () => {
      handled = await processCommand('/mode dev-loop @布偶 @缅因 修复线上崩溃');
    });

    expect(handled).toBe(true);
    expect(mocks.mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/messages',
      expect.objectContaining({
        body: JSON.stringify({
          content: '修复线上崩溃',
          threadId: 'thread-1',
        }),
      }),
    );
  });

  it('reports kickoff error when kickoff request fails', async () => {
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockRejectedValueOnce(new Error('kickoff network down'));

    await act(async () => {
      await processCommand('/mode brainstorm kickoff失败路径 @布偶 @缅因');
    });

    expect(mocks.mockApiFetch).toHaveBeenCalledTimes(2);
    expect(getLatestSystemMessageContent()).toContain('模式已启动，但自动发起失败: kickoff network down');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('reports kickoff error when kickoff response is not ok', async () => {
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 'kickoff bad gateway' }),
      });

    await act(async () => {
      await processCommand('/mode debate kickoff非200路径 @布偶 @缅因 2');
    });

    expect(mocks.mockApiFetch).toHaveBeenCalledTimes(2);
    expect(getLatestSystemMessageContent()).toContain('模式已启动，但自动发起失败: kickoff bad gateway');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /config set failure as error variant', async () => {
    const processCommand = await setupProcessCommand();
    mocks.mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'bad config' }),
    });

    await act(async () => {
      await processCommand('/config set cli.timeoutMs 12345');
    });

    expect(getLatestSystemMessageContent()).toContain('配置更新失败: bad config');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /mode unknown-mode validation message as error variant', async () => {
    const processCommand = await setupProcessCommand();

    await act(async () => {
      await processCommand('/mode foo');
    });

    expect(getLatestSystemMessageContent()).toContain('未知模式: foo');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /mode dev-loop missing-args validation message as error variant', async () => {
    const processCommand = await setupProcessCommand();

    await act(async () => {
      await processCommand('/mode dev-loop');
    });

    expect(getLatestSystemMessageContent()).toContain('用法: /mode dev-loop @开发猫 @review猫 <需求描述>');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /config set usage error as error variant', async () => {
    const processCommand = await setupProcessCommand();

    await act(async () => {
      await processCommand('/config set onlyKey');
    });

    expect(getLatestSystemMessageContent()).toContain('用法: /config set <key> <value>');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /config unknown subcommand as error variant', async () => {
    const processCommand = await setupProcessCommand();

    await act(async () => {
      await processCommand('/config foo');
    });

    expect(getLatestSystemMessageContent()).toContain('未知 /config 子命令: foo');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });

  it('marks /remember usage error as error variant', async () => {
    const processCommand = await setupProcessCommand();

    await act(async () => {
      await processCommand('/remember onlyKey');
    });

    expect(getLatestSystemMessageContent()).toContain('用法: /remember <key> <value>');
    expect(getLatestSystemMessage()).toEqual(
      expect.objectContaining({
        variant: 'error',
      }),
    );
  });
});
