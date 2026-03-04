/**
 * F051 — HubQuotaBoardTab v2 tests
 *
 * Tests the rewritten quota board that fetches from GET /api/quota
 * (official page data) instead of telemetry snapshots.
 */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuotaResponse } from './quota-test-fixtures';

// --- Fixtures ---

const MOCK_QUOTA_RESPONSE: QuotaResponse = {
  claude: {
    platform: 'claude',
    activeBlock: {
      id: 'block-1',
      startTime: '2026-03-02T12:00:00Z',
      endTime: '2026-03-02T17:00:00Z',
      isActive: true,
      isGap: false,
      entries: 42,
      totalTokens: 500000,
      costUSD: 12.5,
      models: ['claude-opus-4-6', 'claude-sonnet-4-6'],
      burnRate: { tokensPerMinute: 1200, costPerHour: 3.5 },
      projection: { totalTokens: 800000, totalCost: 20.0, remainingMinutes: 120 },
    },
    recentBlocks: [],
    lastChecked: '2026-03-02T16:45:00Z',
  },
  codex: {
    platform: 'codex',
    usageItems: [{ label: '每周使用限额', usedPercent: 97, percentKind: 'remaining' }],
    lastChecked: '2026-03-02T16:30:00Z',
  },
  antigravity: {
    platform: 'antigravity',
    status: 'not-yet-implemented',
    hint: '暹罗猫额度待接入（下一迭代）',
  },
  fetchedAt: '2026-03-02T16:45:00Z',
};

const BASE_PROBES_RESPONSE = {
  probes: [
    {
      id: 'official-browser',
      sourceKind: 'browser',
      refreshMode: 'manual',
      enabled: false,
      status: 'disabled',
      targets: ['codex', 'claude'],
      actions: [{ kind: 'refresh', method: 'POST', path: '/api/quota/refresh/official', requiresInteractive: true }],
      reason: 'disabled',
    },
  ],
  fetchedAt: '2026-03-02T16:45:00Z',
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Mocks ---

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn((path: string) => {
    if (path === '/api/quota') return Promise.resolve(jsonResponse(MOCK_QUOTA_RESPONSE));
    if (path === '/api/quota/probes') return Promise.resolve(jsonResponse(BASE_PROBES_RESPONSE));
    return Promise.resolve(new Response('{}', { status: 404 }));
  }),
}));

import { HubQuotaBoardTab } from '@/components/HubQuotaBoardTab';
import { CodexCard } from '@/components/quota-cards';
import { apiFetch } from '@/utils/api-client';

describe('HubQuotaBoardTab v2 — official quota API', () => {
  it('renders the 猫粮看板 title', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('猫粮看板');
    expect(html).toContain('状态总览');
    expect(html).toContain('操作建议');
  });

  it('renders three platform cards (claude, codex, antigravity)', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('布偶猫');
    expect(html).toContain('缅因猫');
    expect(html).toContain('暹罗猫');
  });

  it('renders one-click official fetch button', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('点击获取官方额度');
  });

  it('renders phase5 widget entry link', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('打开小组件视图');
    expect(html).toContain('/widget/quota');
  });

  it('renders antigravity as not-yet-implemented placeholder', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('待接入');
  });

  it('does NOT contain old telemetry disclaimer', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).not.toContain('Telemetry');
    expect(html).not.toContain('遥测');
  });
});

describe('HubQuotaBoardTab — polling', () => {
  it('exports POLL_INTERVAL_MS for periodic refresh', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(mod.POLL_INTERVAL_MS).toBeGreaterThanOrEqual(10_000);
    expect(mod.POLL_INTERVAL_MS).toBeLessThanOrEqual(60_000);
  });

  it('warn-guard detects QUOTA_BROWSER_CDP_URL guidance text', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(
      mod.shouldPromptBeforeOfficialRefresh({
        isFirstAttempt: false,
        guidanceText: 'Missing QUOTA_BROWSER_CDP_URL. Start Chrome with --remote-debugging-port=9222, then retry.',
      }),
    ).toBe(true);
    expect(
      mod.shouldPromptBeforeOfficialRefresh({
        isFirstAttempt: false,
        guidanceText: 'official fetch failed: timeout',
      }),
    ).toBe(false);
    expect(
      mod.shouldPromptBeforeOfficialRefresh({
        isFirstAttempt: false,
        guidanceText: null,
      }),
    ).toBe(false);
  });

  it('warn-guard prompts on first click even without prior guidance text', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(
      mod.shouldPromptBeforeOfficialRefresh({
        isFirstAttempt: true,
        guidanceText: null,
      }),
    ).toBe(true);
  });

  it('builds probe hint text from official-browser probe status', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(
      mod.buildOfficialProbeHint([
        {
          id: 'official-browser',
          sourceKind: 'browser',
          refreshMode: 'manual',
          enabled: false,
          status: 'disabled',
          targets: ['codex', 'claude'],
          actions: [{ kind: 'refresh', method: 'POST', path: '/api/quota/refresh/official', requiresInteractive: true }],
          reason: 'disabled',
        },
      ]),
    ).toContain('已禁用');
    expect(
      mod.buildOfficialProbeHint([
        {
          id: 'official-browser',
          sourceKind: 'browser',
          refreshMode: 'manual',
          enabled: true,
          status: 'ok',
          targets: ['codex', 'claude'],
          actions: [{ kind: 'refresh', method: 'POST', path: '/api/quota/refresh/official', requiresInteractive: true }],
          reason: 'enabled',
        },
      ]),
    ).toBeNull();
    expect(
      mod.buildOfficialProbeHint([
        {
          id: 'official-browser',
          sourceKind: 'browser',
          refreshMode: 'manual',
          enabled: true,
          status: 'error',
          targets: ['codex', 'claude'],
          actions: [{ kind: 'refresh', method: 'POST', path: '/api/quota/refresh/official', requiresInteractive: true }],
          reason: 'failed',
        },
      ]),
    ).toContain('运行异常');
    expect(mod.buildOfficialProbeHint(null)).toBeNull();
  });

  it('sends quota risk notification on first high-risk transition', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(
      mod.shouldSendQuotaRiskNotification({
        currentRisk: 'high',
        previousRisk: 'warn',
        lastAlertAt: 0,
        nowMs: 1_000,
      }),
    ).toBe(true);
  });

  it('dedupes repeated high-risk notifications within time window', async () => {
    const mod = await import('@/components/HubQuotaBoardTab');
    expect(
      mod.shouldSendQuotaRiskNotification({
        currentRisk: 'high',
        previousRisk: 'high',
        lastAlertAt: 1_000,
        nowMs: 1_000 + mod.QUOTA_ALERT_DEDUPE_WINDOW_MS - 1,
      }),
    ).toBe(false);
    expect(
      mod.shouldSendQuotaRiskNotification({
        currentRisk: 'high',
        previousRisk: 'high',
        lastAlertAt: 1_000,
        nowMs: 1_000 + mod.QUOTA_ALERT_DEDUPE_WINDOW_MS + 1,
      }),
    ).toBe(true);
  });
});

describe('HubQuotaBoardTab — probe hint integration', () => {
  const mockedApiFetch = vi.mocked(apiFetch);
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
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders disabled hint from /api/quota/probes', async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/api/quota') return Promise.resolve(jsonResponse(MOCK_QUOTA_RESPONSE));
      if (path === '/api/quota/probes') return Promise.resolve(jsonResponse(BASE_PROBES_RESPONSE));
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root.render(React.createElement(HubQuotaBoardTab));
    });
    await flushEffects();
    expect(container.textContent).toContain('官方网页探针：已禁用');
    expect(container.textContent).toContain('止血模式');
  });

  it('renders error hint from /api/quota/probes', async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/api/quota') return Promise.resolve(jsonResponse(MOCK_QUOTA_RESPONSE));
      if (path === '/api/quota/probes') {
        return Promise.resolve(
          jsonResponse({
            ...BASE_PROBES_RESPONSE,
            probes: [
              {
                ...BASE_PROBES_RESPONSE.probes[0],
                enabled: true,
                status: 'error',
                reason: 'official fetch failed',
              },
            ],
          }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root.render(React.createElement(HubQuotaBoardTab));
    });
    await flushEffects();
    expect(container.textContent).toContain('官方网页探针：运行异常');
    expect(container.textContent).toContain('风险提示');
  });

  it('does not render risk hint block when probe is ok and utilization is low', async () => {
    mockedApiFetch.mockImplementation((path: string) => {
      if (path === '/api/quota') return Promise.resolve(jsonResponse(MOCK_QUOTA_RESPONSE));
      if (path === '/api/quota/probes') {
        return Promise.resolve(
          jsonResponse({
            ...BASE_PROBES_RESPONSE,
            probes: [
              {
                ...BASE_PROBES_RESPONSE.probes[0],
                enabled: true,
                status: 'ok',
                reason: 'enabled',
              },
            ],
          }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root.render(React.createElement(HubQuotaBoardTab));
    });
    await flushEffects();
    expect(container.textContent).not.toContain('风险提示');
  });
});

describe('CodexCard official-value rendering', () => {
  it('renders official remaining percent directly (no 100-remaining conversion)', () => {
    const html = renderToStaticMarkup(
      React.createElement(CodexCard, {
        data: {
          platform: 'codex',
          usageItems: [{ label: '每周使用限额', usedPercent: 97, percentKind: 'remaining' }],
          lastChecked: '2026-03-02T16:30:00Z',
        },
      }),
    );
    expect(html).toContain('97% 剩余');
    expect(html).not.toContain('3% used');
  });

  it('shows actionable empty-state guidance for click-to-fetch flow', () => {
    const html = renderToStaticMarkup(
      React.createElement(CodexCard, {
        data: {
          platform: 'codex',
          usageItems: [],
          lastChecked: null,
        },
      }),
    );
    expect(html).toContain('点击获取');
    expect(html).toContain('启动隔离浏览器');
  });
});
