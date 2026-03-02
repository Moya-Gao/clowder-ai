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
    vi.useRealTimers();
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

  it('renders thread situational summary for dispatched backlog items', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-situation',
      userId: 'u_test',
      title: '态势任务',
      summary: '应展示 thread 态势',
      priority: 'p1',
      tags: ['situation'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 10_000,
      updatedAt: now - 1_000,
      dispatchedAt: now - 5_000,
      dispatchedThreadId: 'thread-situation-1',
      dispatchedThreadPhase: 'coding',
      audit: [{ id: 'a-situation', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 5_000 }],
    } satisfies MutableBacklogItem]);
    backend.setThreads([{
      id: 'thread-situation-1',
      title: 'Thread Alpha',
      createdBy: 'u_test',
      lastActiveAt: now - 500,
      participants: ['codex'],
      backlogItemId: 'seed-situation',
    }]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const panel = container.querySelector('[data-testid="mc-thread-situation"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Thread Alpha');
    expect(panel?.textContent).toContain('codex');
    expect(panel?.textContent).toContain('态势任务');
    expect(panel?.textContent).toContain('最近活跃');
  });

  it('shows fallback message when dispatched item has no mapped thread', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-no-thread',
      userId: 'u_test',
      title: '待映射任务',
      summary: '应显示降级提示',
      priority: 'p2',
      tags: ['situation'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 10_000,
      updatedAt: now - 1_000,
      dispatchedAt: now - 5_000,
      dispatchedThreadId: 'thread-missing',
      dispatchedThreadPhase: 'coding',
      audit: [{ id: 'a-no-thread', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 5_000 }],
    } satisfies MutableBacklogItem]);
    backend.setThreads([]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const panel = container.querySelector('[data-testid="mc-thread-situation"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('待映射任务');
    expect(panel?.textContent).toContain('暂无可关联 thread');
  });

  it('ignores stale thread-situation responses and keeps latest mapping', async () => {
    const now = Date.now();
    const itemA: MutableBacklogItem = {
      id: 'seed-stale-a',
      userId: 'u_test',
      title: '旧任务',
      summary: '旧请求应被丢弃',
      priority: 'p1',
      tags: ['situation'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 10_000,
      updatedAt: now - 1_000,
      dispatchedAt: now - 5_000,
      dispatchedThreadId: 'thread-old',
      dispatchedThreadPhase: 'coding',
      audit: [{ id: 'a-stale-a', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 5_000 }],
    };
    const itemB: MutableBacklogItem = {
      ...itemA,
      id: 'seed-stale-b',
      title: '新任务',
      dispatchedThreadId: 'thread-new',
      audit: [{ id: 'a-stale-b', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 3_000 }],
    };

    backend.setItems([itemA]);
    backend.setThreads([]);

    let resolveFirstThreads: ((response: Response) => void) | null = null;

    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith('/api/threads?') && (!init?.method || init.method === 'GET')) {
        const url = new URL(path, 'http://localhost');
        const backlogIds = url.searchParams.get('backlogItemIds') ?? '';
        if (backlogIds.includes(itemA.id)) {
          return new Promise<Response>((resolve) => {
            resolveFirstThreads = resolve;
          });
        }
        if (backlogIds.includes(itemB.id)) {
          return Promise.resolve(mockResponse(200, {
            threads: [{
              id: 'thread-new',
              title: 'Thread New',
              createdBy: 'u_test',
              lastActiveAt: now - 200,
              participants: ['codex'],
              backlogItemId: itemB.id,
            }],
          }));
        }
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    expect(resolveFirstThreads).not.toBeNull();
    if (!resolveFirstThreads) return;

    await act(async () => {
      useMissionControlStore.setState({
        items: [itemB],
        selectedItemId: itemB.id,
      });
    });
    await flush(act);

    resolveFirstThreads(mockResponse(200, {
      threads: [{
        id: 'thread-old',
        title: 'Thread Old',
        createdBy: 'u_test',
        lastActiveAt: now - 1_000,
        participants: ['codex'],
        backlogItemId: itemA.id,
      }],
    }));
    await flush(act);

    const panel = container.querySelector('[data-testid="mc-thread-situation"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('新任务');
    expect(panel?.textContent).toContain('Thread New');
    expect(panel?.textContent).not.toContain('Thread Old');
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

  it('shows self-claim button when policy allows global self-claim', async () => {
    const now = Date.now();
    backend.setSelfClaimScope('codex', 'global');
    backend.setItems([{
      id: 'seed-self-claim',
      userId: 'u_test',
      title: '可直接自领',
      summary: 'policy=global 时应展示自领按钮',
      priority: 'p1',
      tags: ['ratchet'],
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-self-claim', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('可直接自领'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const selfClaimButton = container.querySelector('[data-testid="mc-self-claim-submit"]') as HTMLButtonElement | null;
    expect(selfClaimButton).not.toBeNull();
  });

  it('hides self-claim button when policy is disabled', async () => {
    const now = Date.now();
    backend.setSelfClaimScope('codex', 'disabled');
    backend.setItems([{
      id: 'seed-self-claim-disabled',
      userId: 'u_test',
      title: '禁用自领',
      summary: 'policy=disabled 时不展示直通按钮',
      priority: 'p2',
      tags: ['ratchet'],
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-self-claim-disabled', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('禁用自领'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const selfClaimButton = container.querySelector('[data-testid="mc-self-claim-submit"]') as HTMLButtonElement | null;
    expect(selfClaimButton).toBeNull();
  });

  it('shows once policy blocker reason when self-claim API rejects with once scope conflict', async () => {
    const now = Date.now();
    backend.setSelfClaimScope('codex', 'once');
    backend.setItems([{
      id: 'seed-self-claim-once',
      userId: 'u_test',
      title: 'once 策略阻断',
      summary: '触发 once 阻断文案',
      priority: 'p1',
      tags: ['ratchet'],
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-self-claim-once', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/backlog/items/seed-self-claim-once/self-claim' && init?.method === 'POST') {
        return Promise.resolve(mockResponse(403, { error: 'Self-claim once policy already consumed for this cat' }));
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('once 策略阻断'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const whyInput = container.querySelector('[data-testid="mc-suggest-why"]') as HTMLTextAreaElement | null;
    const planInput = container.querySelector('[data-testid="mc-suggest-plan"]') as HTMLTextAreaElement | null;
    const selfClaimButton = container.querySelector('[data-testid="mc-self-claim-submit"]') as HTMLButtonElement | null;
    expect(whyInput).not.toBeNull();
    expect(planInput).not.toBeNull();
    expect(selfClaimButton).not.toBeNull();
    if (!whyInput || !planInput || !selfClaimButton) return;

    await act(async () => {
      setNativeValue(whyInput, '触发 once 阻断');
      whyInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(planInput, '验证阻断提示');
      planInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      selfClaimButton.click();
    });
    await flush(act);

    const blocker = container.querySelector('[data-testid="mc-self-claim-blocker-once"]');
    expect(blocker).not.toBeNull();
    expect(container.querySelector('[data-testid="mc-error"]')?.textContent).toContain('once 策略阻断');
  });

  it('shows thread policy blocker reason when self-claim API rejects with active lease conflict', async () => {
    const now = Date.now();
    backend.setSelfClaimScope('codex', 'thread');
    backend.setItems([{
      id: 'seed-self-claim-thread',
      userId: 'u_test',
      title: 'thread 策略阻断',
      summary: '触发 thread 阻断文案',
      priority: 'p1',
      tags: ['ratchet'],
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      audit: [{ id: 'a-self-claim-thread', action: 'created', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/backlog/items/seed-self-claim-thread/self-claim' && init?.method === 'POST') {
        return Promise.resolve(mockResponse(409, { error: 'Self-claim thread policy blocked by existing active leased thread' }));
      }
      return backend.handleRequest(path, init);
    });

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('thread 策略阻断'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const whyInput = container.querySelector('[data-testid="mc-suggest-why"]') as HTMLTextAreaElement | null;
    const planInput = container.querySelector('[data-testid="mc-suggest-plan"]') as HTMLTextAreaElement | null;
    const selfClaimButton = container.querySelector('[data-testid="mc-self-claim-submit"]') as HTMLButtonElement | null;
    expect(whyInput).not.toBeNull();
    expect(planInput).not.toBeNull();
    expect(selfClaimButton).not.toBeNull();
    if (!whyInput || !planInput || !selfClaimButton) return;

    await act(async () => {
      setNativeValue(whyInput, '触发 thread 阻断');
      whyInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(planInput, '验证活跃 lease 冲突提示');
      planInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      selfClaimButton.click();
    });
    await flush(act);

    const blocker = container.querySelector('[data-testid="mc-self-claim-blocker-thread"]');
    expect(blocker).not.toBeNull();
    expect(container.querySelector('[data-testid="mc-error"]')?.textContent).toContain('thread 策略阻断');
  });

  it('shows lease controls and sends heartbeat for active lease', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-lease-ui',
      userId: 'u_test',
      title: '租约任务',
      summary: '已派发且 lease 激活',
      priority: 'p1',
      tags: ['lease'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 3_000,
      updatedAt: now,
      dispatchedAt: now - 2_000,
      dispatchedThreadId: 'thread-lease-ui',
      dispatchedThreadPhase: 'coding',
      lease: {
        ownerCatId: 'codex',
        state: 'active',
        acquiredAt: now - 2_000,
        heartbeatAt: now - 1_000,
        expiresAt: now + 30_000,
      },
      audit: [{ id: 'a-lease-ui', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('租约任务'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const heartbeatButton = container.querySelector('[data-testid="mc-lease-heartbeat"]') as HTMLButtonElement | null;
    expect(heartbeatButton).not.toBeNull();
    if (!heartbeatButton) return;

    await act(async () => {
      heartbeatButton.click();
    });
    await flush(act);

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/backlog/items/seed-lease-ui/lease/heartbeat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('hides heartbeat and shows reclaim for expired active lease', async () => {
    const now = Date.now();
    backend.setItems([{
      id: 'seed-lease-expired',
      userId: 'u_test',
      title: '过期租约任务',
      summary: 'active 但 expiresAt 已过期',
      priority: 'p1',
      tags: ['lease'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 6_000,
      updatedAt: now - 1_000,
      dispatchedAt: now - 5_000,
      dispatchedThreadId: 'thread-lease-expired',
      dispatchedThreadPhase: 'coding',
      lease: {
        ownerCatId: 'codex',
        state: 'active',
        acquiredAt: now - 5_000,
        heartbeatAt: now - 4_000,
        expiresAt: now - 500,
      },
      audit: [{ id: 'a-lease-expired', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 5_000 }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await flush(act);

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('过期租约任务'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });

    const heartbeatButton = container.querySelector('[data-testid="mc-lease-heartbeat"]') as HTMLButtonElement | null;
    const reclaimButton = container.querySelector('[data-testid="mc-lease-reclaim"]') as HTMLButtonElement | null;
    expect(heartbeatButton).toBeNull();
    expect(reclaimButton).not.toBeNull();
    if (!reclaimButton) return;

    await act(async () => {
      reclaimButton.click();
    });
    await flush(act);

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/backlog/items/seed-lease-expired/lease/reclaim',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('switches heartbeat to reclaim after lease expiry without extra interaction', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    backend.setItems([{
      id: 'seed-lease-ticking',
      userId: 'u_test',
      title: '租约自动过期任务',
      summary: '打开后等待过期，应自动从 heartbeat 切到 reclaim',
      priority: 'p1',
      tags: ['lease'],
      status: 'dispatched',
      createdBy: 'user',
      createdAt: now - 4_000,
      updatedAt: now - 2_000,
      dispatchedAt: now - 3_000,
      dispatchedThreadId: 'thread-lease-ticking',
      dispatchedThreadPhase: 'coding',
      lease: {
        ownerCatId: 'codex',
        state: 'active',
        acquiredAt: now - 3_000,
        heartbeatAt: now - 2_000,
        expiresAt: now + 1_000,
      },
      audit: [{ id: 'a-lease-ticking', action: 'dispatched', actor: { kind: 'user', id: 'u_test' }, timestamp: now - 3_000 }],
    } satisfies MutableBacklogItem]);

    await act(async () => {
      root.render(React.createElement(MissionControlPage));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const card = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('租约自动过期任务'));
    expect(card).toBeTruthy();
    if (!card) return;

    await act(async () => {
      card.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="mc-lease-heartbeat"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mc-lease-reclaim"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="mc-lease-heartbeat"]')).toBeNull();
    expect(container.querySelector('[data-testid="mc-lease-reclaim"]')).not.toBeNull();
  });
});
