import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushSettingsPanel } from '../PushSettingsPanel';
import { useToastStore } from '@/stores/toastStore';
import { usePushNotify } from '@/hooks/usePushNotify';

vi.mock('@/hooks/usePushNotify', () => ({
  usePushNotify: vi.fn(),
}));

const mockUsePushNotify = vi.mocked(usePushNotify);

describe('PushSettingsPanel test push feedback', () => {
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
    useToastStore.setState({ toasts: [] });

    mockUsePushNotify.mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      isLoading: false,
      subscribe: vi.fn(async () => {}),
      unsubscribe: vi.fn(async () => {}),
      sendTest: vi.fn(async () => ({ ok: true, message: '测试推送已发送' })),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('shows success toast after clicking 发送测试通知', async () => {
    mockUsePushNotify.mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      isLoading: false,
      subscribe: vi.fn(async () => {}),
      unsubscribe: vi.fn(async () => {}),
      sendTest: vi.fn(async () => ({ ok: true, message: '测试推送已发送' })),
    });

    await act(async () => {
      root.render(React.createElement(PushSettingsPanel));
    });

    const testBtn = Array.from(container.querySelectorAll('button')).find(
      (node) => node.textContent?.includes('发送测试通知'),
    ) as HTMLButtonElement | undefined;
    expect(testBtn).toBeDefined();

    await act(async () => {
      testBtn?.click();
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'success' && t.title === '系统通知已请求发送')).toBe(true);
  });

  it('shows error toast when test push fails', async () => {
    mockUsePushNotify.mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      isLoading: false,
      subscribe: vi.fn(async () => {}),
      unsubscribe: vi.fn(async () => {}),
      sendTest: vi.fn(async () => ({ ok: false, message: 'Push not configured' })),
    });

    await act(async () => {
      root.render(React.createElement(PushSettingsPanel));
    });

    const testBtn = Array.from(container.querySelectorAll('button')).find(
      (node) => node.textContent?.includes('发送测试通知'),
    ) as HTMLButtonElement | undefined;
    expect(testBtn).toBeDefined();

    await act(async () => {
      testBtn?.click();
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'error' && t.title === '系统通知发送失败')).toBe(true);
  });
});
