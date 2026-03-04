'use client';

// biome-ignore lint/correctness/noUnusedImports: React must be in scope for SSR JSX runtime in tests.
import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

const WIDGET_POLL_INTERVAL_MS = 30_000;

export type QuotaWidgetRiskLevel = 'ok' | 'warn' | 'high';

export interface QuotaSummaryPlatform {
  id: 'codex' | 'claude' | 'antigravity';
  label: string;
  displayPercent: number | null;
  displayKind: 'used' | 'remaining' | null;
  utilizationPercent: number | null;
  status: 'ok' | 'warn' | 'error' | 'pending';
  note: string;
  lastChecked: string | null;
}

export interface QuotaSummaryResponse {
  fetchedAt: string;
  risk: {
    level: QuotaWidgetRiskLevel;
    reasons: string[];
    maxUtilization: number | null;
  };
  platforms: {
    codex: QuotaSummaryPlatform;
    claude: QuotaSummaryPlatform;
    antigravity: QuotaSummaryPlatform;
  };
  probes: {
    official: {
      enabled: boolean;
      status: 'ok' | 'warn' | 'error' | 'disabled';
      reason: string;
    };
    claudeCli: {
      enabled: boolean;
      status: 'ok' | 'warn' | 'error' | 'disabled';
      reason: string;
    };
  };
  actions: {
    refreshOfficialPath: '/api/quota/refresh/official';
    refreshClaudePath: '/api/quota/refresh/claude';
  };
}

export function formatSummaryPercent(platform: QuotaSummaryPlatform): string {
  if (platform.displayPercent == null) return '—';
  if (platform.displayKind === 'remaining') return `${platform.displayPercent}% 剩余`;
  return `${platform.displayPercent}% 已用`;
}

export function resolveRiskLabel(level: QuotaWidgetRiskLevel): string {
  if (level === 'high') return '高风险';
  if (level === 'warn') return '需关注';
  return '正常';
}

export function resolveRiskTone(level: QuotaWidgetRiskLevel): string {
  if (level === 'high') return 'text-rose-700 bg-rose-50 border-rose-200';
  if (level === 'warn') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export function buildNextAction(summary: QuotaSummaryResponse | null): string {
  if (!summary) return '等待摘要数据加载';
  if (summary.risk.level === 'high') return '先处理风险项，再进行刷新。';
  if (summary.probes.official.status === 'disabled') return '先启用官方探针，再点击刷新。';
  return '维持按需刷新策略。';
}

export function QuotaSummaryWidget({ initialSummary = null }: { initialSummary?: QuotaSummaryResponse | null }) {
  const [summary, setSummary] = useState<QuotaSummaryResponse | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/quota/summary');
      if (!res.ok) {
        setError('加载猫粮摘要失败');
        return;
      }
      const payload = (await res.json()) as QuotaSummaryResponse;
      setSummary(payload);
      setError(null);
    } catch {
      setError('加载猫粮摘要失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!summary) void fetchSummary();
    const id = setInterval(() => {
      void fetchSummary();
    }, WIDGET_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchSummary, summary]);

  const triggerOfficialRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const path = summary?.actions.refreshOfficialPath ?? '/api/quota/refresh/official';
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactive: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? '刷新官方额度失败');
      }
      await fetchSummary();
    } catch {
      setError('刷新官方额度失败');
    } finally {
      setRefreshing(false);
    }
  }, [fetchSummary, summary?.actions.refreshOfficialPath]);

  const riskLevel = summary?.risk.level ?? 'warn';
  const riskLabel = resolveRiskLabel(riskLevel);
  const riskTone = resolveRiskTone(riskLevel);
  const platforms = summary
    ? [summary.platforms.codex, summary.platforms.claude, summary.platforms.antigravity]
    : [];

  return (
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/95 shadow-sm p-4 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">猫粮摘要小组件</h1>
          <p className="text-xs text-slate-500 mt-1">Phase 5（Widget）：轻量常驻概览（桌面/移动统一）。</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${riskTone}`}>{riskLabel}</span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {platforms.map((platform) => (
          <article key={platform.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
            <p className="text-[11px] text-slate-500">{platform.label}</p>
            <p className="text-sm font-semibold text-slate-900">{formatSummaryPercent(platform)}</p>
            <p className="text-[11px] text-slate-500 line-clamp-2">{platform.note}</p>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
        <p className="text-xs text-slate-700 font-medium">下一步动作</p>
        <p className="text-xs text-slate-600">{buildNextAction(summary)}</p>
      </div>

      {summary && summary.risk.reasons.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-900">风险细节</p>
          <ul className="mt-1 text-xs text-amber-800 list-disc pl-4 space-y-1">
            {summary.risk.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      <footer className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {summary?.fetchedAt ? `最后检查 ${new Date(summary.fetchedAt).toLocaleTimeString()}` : loading ? '加载中…' : '暂无数据'}
        </p>
        <button
          type="button"
          onClick={() => {
            void triggerOfficialRefresh();
          }}
          disabled={refreshing}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 text-white disabled:opacity-60"
        >
          {refreshing ? '刷新中…' : '刷新官方额度'}
        </button>
      </footer>
    </section>
  );
}
