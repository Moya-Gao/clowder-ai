import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionControlPage } from '@/components/mission-control/MissionControlPage';
import { useMissionControlStore } from '@/stores/missionControlStore';
import {
  createMissionControlMockBackend,
  flush,
  mockResponse,
  setNativeValue,
  type MissionControlMockBackend,
  type MutableBacklogItem,
} from './mission-control-page.test-helpers';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('@/components/ThreadSidebar', () => ({
  ThreadSidebar: () => React.createElement('aside', { 'data-testid': 'thread-sidebar' }),
}));

describe('MissionControlPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let backend: MissionControlMockBackend;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useMissionControlStore.setState({
      items: [],
      loading: false,
      submitting: false,
      selectedItemId: null,
      selectedPhase: 'coding',
      error: null,
    });

    backend = createMissionControlMockBackend();
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) =>
      backend.handleRequest(path, init));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('creates backlog items from quick create form', async () => {
    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    expect(container.textContent).toContain('Mission Hub');

    const titleInput = container.querySelector('[data-testid="mc-create-title"]') as HTMLInputElement | null;
    const summaryInput = container.querySelector('[data-testid="mc-create-summary"]') as HTMLInputElement | null;
    const submitButton = container.querySelector('[data-testid="mc-create-submit"]') as HTMLButtonElement | null;

    expect(titleInput).not.toBeNull();
    expect(summaryInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    if (!titleInput || !summaryInput || !submitButton) return;

    await act(async () => {
      setNativeValue(titleInput, '新增任务');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(summaryInput, '用于验证快速创建流程');
      summaryInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      submitButton.click();
    });
    await flush(act);

    expect(container.textContent).toContain('新增任务');
    expect(backend.getItems().some((item) => item.title === '新增任务')).toBe(true);
  });

  it('imports active docs backlog items via manual refresh button', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/backlog/import-active-features' && init?.method === 'POST') {
        backend.setItems([{
          id: 'imported-f010',
          userId: 'u_test',
          title: 'F010 手机端猫猫',
          summary: '来自 docs/BACKLOG.md',
          priority: 'p1',
          tags: ['source:docs-backlog', 'feature:f010'],
          status: 'open',
          createdBy: 'user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          audit: [{
            id: 'a-imported',
            action: 'created',
            actor: { kind: 'user', id: 'u_test' },
            timestamp: Date.now(),
          }],
        } satisfies MutableBacklogItem]);
        return Promise.resolve(mockResponse(200, { imported: 1, skipped: 0, totalActive: 1 }));
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const importButton = container.querySelector('[data-testid="mc-import-docs"]') as HTMLButtonElement | null;
    expect(importButton).not.toBeNull();
    expect(importButton?.textContent).toContain('从文档导入/刷新');
    if (!importButton) return;

    await act(async () => {
      importButton.click();
    });
    await flush(act);

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/backlog/import-active-features',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(container.querySelector('[data-testid="mc-lane-open"]')?.textContent).toContain('F010 手机端猫猫');
  });

  it('moves item from open to dispatched through suggest and approve flow', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-1',
      userId: 'u_test',
      title: '种子任务',
      summary: '先建议，再批准',
      priority: 'p1',
      tags: ['f049'],
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-seed', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('种子任务'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const whyInput = container.querySelector('[data-testid="mc-suggest-why"]') as HTMLTextAreaElement | null;
    const planInput = container.querySelector('[data-testid="mc-suggest-plan"]') as HTMLTextAreaElement | null;
    const suggestButton = container.querySelector('[data-testid="mc-suggest-submit"]') as HTMLButtonElement | null;

    expect(whyInput).not.toBeNull();
    expect(planInput).not.toBeNull();
    expect(suggestButton).not.toBeNull();
    if (!whyInput || !planInput || !suggestButton) return;

    await act(async () => {
      setNativeValue(whyInput, '这个任务适合先由 codex 领');
      whyInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(planInput, '先拆分接口与页面，再执行验收');
      planInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const suggestForm = suggestButton.closest('form');
    expect(suggestForm).not.toBeNull();
    if (!suggestForm) return;

    await act(async () => {
      suggestForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush(act);
    await flush(act);

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/backlog/items/seed-1/suggest-claim',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(container.querySelector('[data-testid="mc-lane-suggested"]')?.textContent).toContain('种子任务');

    const approveButton = container.querySelector('[data-testid="mc-approve-submit"]') as HTMLButtonElement | null;
    expect(approveButton).not.toBeNull();
    if (!approveButton) return;

    await act(async () => {
      approveButton.click();
    });
    await flush(act);

    expect(container.querySelector('[data-testid="mc-lane-dispatched"]')?.textContent).toContain('种子任务');
    const threadLink = container.querySelector('[data-testid="mc-open-thread-link"]') as HTMLAnchorElement | null;
    expect(threadLink?.getAttribute('href')).toBe('/thread/thread-1');
  });

  it('rejects suggested item back to open lane', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-reject',
      userId: 'u_test',
      title: '驳回路径',
      summary: '建议后应可退回 open',
      priority: 'p2',
      tags: ['f049'],
      status: 'suggested',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-reject', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
      suggestion: {
        catId: 'codex',
        why: '先给建议',
        plan: '再驳回',
        requestedPhase: 'coding',
        status: 'pending',
        suggestedAt: now,
      },
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('驳回路径'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const rejectButton = container.querySelector('[data-testid="mc-reject-submit"]') as HTMLButtonElement | null;
    expect(rejectButton).not.toBeNull();
    if (!rejectButton) return;

    await act(async () => {
      rejectButton.click();
    });
    await flush(act);

    expect(container.querySelector('[data-testid="mc-lane-open"]')?.textContent).toContain('驳回路径');
  });

  it('shows retry action for approved item and dispatches on click', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-approved',
      userId: 'u_test',
      title: '已批准待派发',
      summary: '模拟 approve 与 dispatch 之间中断',
      priority: 'p1',
      tags: ['recover'],
      status: 'approved',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-approved', action: 'approved', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
      suggestion: {
        catId: 'codex',
        why: '可恢复',
        plan: '手动重试',
        requestedPhase: 'coding',
        status: 'approved',
        suggestedAt: now - 1_000,
        decidedAt: now,
        decidedBy: 'u_test',
      },
      approvedAt: now,
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('已批准待派发'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const retryButton = container.querySelector('[data-testid="mc-approve-submit"]') as HTMLButtonElement | null;
    expect(retryButton).not.toBeNull();
    if (!retryButton) return;

    await act(async () => {
      retryButton.click();
    });
    await flush(act);

    expect(container.querySelector('[data-testid="mc-lane-dispatched"]')?.textContent).toContain('已批准待派发');
  });

  it('renders loading hint while backlog list is pending', async () => {
    let resolveList: ((value: Response) => void) | null = null;
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/backlog/items' && (!init?.method || init.method === 'GET')) {
        return new Promise<Response>((resolve) => {
          resolveList = resolve;
        });
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });

    expect(container.textContent).toContain('加载 backlog 中...');
    resolveList?.(mockResponse(200, { items: [] }));
    await flush(act);
  });

  it('renders API error in alert banner', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/backlog/items' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(mockResponse(500, { error: 'load failed' }));
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const banner = container.querySelector('[data-testid="mc-error"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.textContent).toContain('load failed');
  });
});
