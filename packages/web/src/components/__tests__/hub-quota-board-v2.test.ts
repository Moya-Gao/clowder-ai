/**
 * F051 — HubQuotaBoardTab v2 tests
 *
 * Tests the rewritten quota board that fetches from GET /api/quota
 * (official page data) instead of telemetry snapshots.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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

// --- Mocks ---

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(MOCK_QUOTA_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ),
}));

import { HubQuotaBoardTab } from '@/components/HubQuotaBoardTab';
import { CodexCard } from '@/components/quota-cards';

describe('HubQuotaBoardTab v2 — official quota API', () => {
  it('renders the 猫粮看板 title', () => {
    const html = renderToStaticMarkup(React.createElement(HubQuotaBoardTab));
    expect(html).toContain('猫粮看板');
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
      mod.shouldWarnBeforeOfficialRefresh(
        'Missing QUOTA_BROWSER_CDP_URL. Start Chrome with --remote-debugging-port=9222, then retry.',
      ),
    ).toBe(true);
    expect(mod.shouldWarnBeforeOfficialRefresh('official fetch failed: timeout')).toBe(false);
    expect(mod.shouldWarnBeforeOfficialRefresh(null)).toBe(false);
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
    expect(html).toContain('配置本机 Chrome CDP');
  });
});
