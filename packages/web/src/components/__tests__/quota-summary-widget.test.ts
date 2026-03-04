import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildNextAction,
  formatSummaryPercent,
  QuotaSummaryWidget,
  resolveRiskLabel,
  type QuotaSummaryResponse,
} from '@/components/QuotaSummaryWidget';

const BASE_SUMMARY: QuotaSummaryResponse = {
  fetchedAt: '2026-03-03T20:00:00.000Z',
  risk: {
    level: 'warn',
    reasons: ['官方网页探针已禁用（止血模式）'],
    maxUtilization: 81,
  },
  platforms: {
    codex: {
      id: 'codex',
      label: '缅因猫 (Codex + GPT-5.2)',
      displayPercent: 81,
      displayKind: 'used',
      utilizationPercent: 81,
      status: 'warn',
      note: '每周使用限额',
      lastChecked: '2026-03-03T20:00:00.000Z',
    },
    claude: {
      id: 'claude',
      label: '布偶猫 (Claude)',
      displayPercent: 45,
      displayKind: 'used',
      utilizationPercent: 45,
      status: 'ok',
      note: 'Current week (all models)',
      lastChecked: '2026-03-03T20:00:00.000Z',
    },
    antigravity: {
      id: 'antigravity',
      label: '暹罗猫 (Antigravity)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'pending',
      note: '待接入',
      lastChecked: null,
    },
  },
  probes: {
    official: {
      enabled: false,
      status: 'disabled',
      reason: 'Disabled by default',
    },
    claudeCli: {
      enabled: true,
      status: 'ok',
      reason: 'Uses ccusage',
    },
  },
  actions: {
    refreshOfficialPath: '/api/quota/refresh/official',
    refreshClaudePath: '/api/quota/refresh/claude',
  },
};

describe('QuotaSummaryWidget helpers', () => {
  it('formats percentage with remaining/used semantics', () => {
    expect(formatSummaryPercent(BASE_SUMMARY.platforms.codex)).toBe('81% 已用');
    expect(
      formatSummaryPercent({
        ...BASE_SUMMARY.platforms.codex,
        displayPercent: 93,
        displayKind: 'remaining',
      }),
    ).toBe('93% 剩余');
    expect(
      formatSummaryPercent({
        ...BASE_SUMMARY.platforms.codex,
        displayPercent: null,
        displayKind: null,
      }),
    ).toBe('—');
  });

  it('resolves risk labels', () => {
    expect(resolveRiskLabel('ok')).toBe('正常');
    expect(resolveRiskLabel('warn')).toBe('需关注');
    expect(resolveRiskLabel('high')).toBe('高风险');
  });

  it('builds next action guidance from summary state', () => {
    expect(buildNextAction({ ...BASE_SUMMARY, risk: { ...BASE_SUMMARY.risk, level: 'high' } })).toContain('先处理风险项');
    expect(buildNextAction(BASE_SUMMARY)).toContain('先启用官方探针');
    expect(
      buildNextAction({
        ...BASE_SUMMARY,
        risk: { ...BASE_SUMMARY.risk, level: 'ok' },
        probes: { ...BASE_SUMMARY.probes, official: { ...BASE_SUMMARY.probes.official, status: 'ok' } },
      }),
    ).toContain('维持按需刷新');
  });
});

describe('QuotaSummaryWidget rendering', () => {
  it('renders widget title, risk and platform cards with initial summary', () => {
    const html = renderToStaticMarkup(React.createElement(QuotaSummaryWidget, { initialSummary: BASE_SUMMARY }));
    expect(html).toContain('猫粮摘要小组件');
    expect(html).toContain('需关注');
    expect(html).toContain('官方网页探针已禁用');
    expect(html).toContain('缅因猫 (Codex + GPT-5.2)');
    expect(html).toContain('布偶猫 (Claude)');
    expect(html).toContain('刷新官方额度');
  });
});
