'use client';

// biome-ignore lint/correctness/noUnusedImports: React must be in scope for SSR JSX runtime in tests.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import {
  AntigravityCard,
  type AntigravityQuota,
  ClaudeCard,
  type ClaudeQuota,
  CodexCard,
  type CodexQuota,
  type QuotaResponse,
} from './quota-cards';

/** How often to poll GET /api/quota while the tab is mounted (ms) */
export const POLL_INTERVAL_MS = 30_000;
export const RESTART_WARNING_TEXT =
  '将启动隔离浏览器窗口用于官方额度抓取（不会关闭你当前 Chrome）。首次使用请先在该窗口登录 OpenAI/Claude，是否继续？';
export const QUOTA_ALERT_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

export interface QuotaProbeDescriptor {
  id: 'claude-cli' | 'official-browser' | 'antigravity-placeholder';
  sourceKind: 'cli' | 'browser' | 'placeholder';
  refreshMode: 'manual' | 'scheduled';
  enabled: boolean;
  status: 'ok' | 'error' | 'disabled';
  targets: Array<'claude' | 'codex' | 'antigravity'>;
  actions: Array<{
    kind: 'refresh';
    method: 'POST';
    path: string;
    requiresInteractive: boolean;
  }>;
  reason: string;
}

function findOfficialBrowserProbe(probes: QuotaProbeDescriptor[]): QuotaProbeDescriptor | undefined {
  return probes.find(
    (probe) =>
      probe.sourceKind === 'browser' && probe.actions.some((action) => action.path === '/api/quota/refresh/official'),
  );
}

export function buildOfficialProbeHint(probes: QuotaProbeDescriptor[] | null): string | null {
  if (!probes) return null;
  const official = findOfficialBrowserProbe(probes);
  if (!official) return null;
  if (official.status === 'disabled') return '官方网页探针：已禁用（止血模式）';
  if (official.status === 'error') return '官方网页探针：运行异常（请检查配置/登录）';
  return null;
}

function extractUtilizationSignals(quota: QuotaResponse | null): number[] {
  if (!quota) return [];
  const values: number[] = [];
  for (const item of quota.codex.usageItems) {
    const normalized = item.percentKind === 'remaining' ? 100 - item.usedPercent : item.usedPercent;
    values.push(normalized);
  }
  for (const item of quota.claude.usageItems ?? []) {
    values.push(item.usedPercent);
  }
  return values.filter((value) => Number.isFinite(value));
}

function resolveBoardRiskLevel({
  quota,
  refreshError,
  officialProbeHint,
}: {
  quota: QuotaResponse | null;
  refreshError: string | null;
  officialProbeHint: string | null;
}): 'ok' | 'warn' | 'high' {
  if (refreshError || quota?.codex?.error || quota?.claude?.error) return 'high';
  if (officialProbeHint?.includes('运行异常')) return 'high';
  if (officialProbeHint?.includes('已禁用')) return 'warn';

  const utilizationSignals = extractUtilizationSignals(quota);
  if (utilizationSignals.some((value) => value >= 95)) return 'high';
  if (utilizationSignals.some((value) => value >= 80)) return 'warn';
  return 'ok';
}

function describeRisk(level: 'ok' | 'warn' | 'high'): string {
  if (level === 'high') return '高风险';
  if (level === 'warn') return '需关注';
  return '正常';
}

function riskTextClass(level: 'ok' | 'warn' | 'high'): string {
  if (level === 'high') return 'text-rose-700';
  if (level === 'warn') return 'text-amber-700';
  return 'text-emerald-700';
}

export function shouldSendQuotaRiskNotification({
  currentRisk,
  previousRisk,
  lastAlertAt,
  nowMs,
  windowMs = QUOTA_ALERT_DEDUPE_WINDOW_MS,
}: {
  currentRisk: 'ok' | 'warn' | 'high';
  previousRisk: 'ok' | 'warn' | 'high';
  lastAlertAt: number;
  nowMs: number;
  windowMs?: number;
}): boolean {
  if (currentRisk !== 'high') return false;
  if (previousRisk !== 'high') return true;
  return nowMs - lastAlertAt >= windowMs;
}

export function shouldPromptBeforeOfficialRefresh({
  isFirstAttempt,
  guidanceText,
}: {
  isFirstAttempt: boolean;
  guidanceText: string | null | undefined;
}): boolean {
  if (isFirstAttempt) return true;
  if (!guidanceText) return false;
  return /QUOTA_BROWSER_CDP_URL|remote-debugging-port=\d+/i.test(guidanceText);
}

export function HubQuotaBoardTab() {
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [probes, setProbes] = useState<QuotaProbeDescriptor[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [hasAttemptedOfficialRefresh, setHasAttemptedOfficialRefresh] = useState(false);
  const previousRiskRef = useRef<'ok' | 'warn' | 'high'>('ok');
  const lastAlertAtRef = useRef<number>(0);
  const officialProbeHint = buildOfficialProbeHint(probes);
  const riskLevel = resolveBoardRiskLevel({ quota, refreshError, officialProbeHint });
  const riskNotes = [refreshError, quota?.codex?.error, quota?.claude?.error, officialProbeHint].filter(
    (value): value is string => Boolean(value),
  );

  const fetchQuota = useCallback(async () => {
    try {
      const [quotaRes, probesRes] = await Promise.all([
        apiFetch('/api/quota'),
        apiFetch('/api/quota/probes'),
      ]);
      if (quotaRes.ok) {
        const data = (await quotaRes.json()) as QuotaResponse;
        setQuota(data);
      }
      if (probesRes.ok) {
        const payload = (await probesRes.json()) as { probes?: QuotaProbeDescriptor[] };
        setProbes(payload.probes ?? null);
      }
    } catch {
      // silently fail — cards will show empty state
    }
  }, []);

  useEffect(() => {
    fetchQuota();
    const id = setInterval(fetchQuota, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchQuota]);

  useEffect(() => {
    const previousRisk = previousRiskRef.current;
    const now = Date.now();
    const shouldNotify = shouldSendQuotaRiskNotification({
      currentRisk: riskLevel,
      previousRisk,
      lastAlertAt: lastAlertAtRef.current,
      nowMs: now,
    });
    previousRiskRef.current = riskLevel;

    if (!shouldNotify) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;

    const note = riskNotes[0] ?? '额度进入高风险，请及时处理。';
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration) return;
        lastAlertAtRef.current = now;
        return registration.showNotification('猫粮高风险预警', {
          body: note,
          tag: 'quota-alert',
          data: {
            url: '/',
            forceSystemNotification: true,
            threadId: 'quota-board',
          },
        });
      })
      .catch(() => {
        // no-op: keep UI actionable even if system notification API fails
      });
  }, [riskLevel, riskNotes]);

  const onRefresh = useCallback(async () => {
    const guidanceText = refreshError ?? quota?.codex?.error ?? quota?.claude?.error ?? null;
    if (
      shouldPromptBeforeOfficialRefresh({
        isFirstAttempt: !hasAttemptedOfficialRefresh,
        guidanceText,
      })
    ) {
      const confirmFn: ((message?: string) => boolean) | undefined =
        typeof window !== 'undefined' ? window.confirm : undefined;
      const proceed = confirmFn ? confirmFn(RESTART_WARNING_TEXT) : true;
      if (!proceed) {
        return;
      }
    }
    setHasAttemptedOfficialRefresh(true);
    setRefreshing(true);
    try {
      const refreshRes = await apiFetch('/api/quota/refresh/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactive: true }),
      });
      if (!refreshRes.ok) {
        const body = (await refreshRes.json().catch(() => ({}))) as { error?: string };
        setRefreshError(body.error ?? '获取官方额度失败');
      } else {
        setRefreshError(null);
      }
      await fetchQuota();
    } catch {
      setRefreshError('获取官方额度失败，请稍后重试');
      await fetchQuota();
    } finally {
      setRefreshing(false);
    }
  }, [fetchQuota, hasAttemptedOfficialRefresh, quota, refreshError]);

  // SSR / initial render: show card structure with empty state
  const claude: ClaudeQuota = quota?.claude ?? {
    platform: 'claude',
    activeBlock: null,
    recentBlocks: [],
    lastChecked: null,
  };
  const codex: CodexQuota = quota?.codex ?? {
    platform: 'codex',
    usageItems: [],
    lastChecked: null,
  };
  const antigravity: AntigravityQuota = quota?.antigravity ?? {
    platform: 'antigravity',
    status: 'not-yet-implemented',
    hint: '暹罗猫额度待接入（下一迭代）',
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">猫粮看板</h3>
          <p className="text-xs text-gray-500 mt-1">点击触发官方抓取，不做后台持续爬取。</p>
        </div>
        {quota?.fetchedAt && (
          <span className="text-[11px] text-gray-400">
            最后检查: {new Date(quota.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">状态总览</p>
          <p className={`text-sm font-semibold ${riskTextClass(riskLevel)}`}>{describeRisk(riskLevel)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">数据更新时间</p>
          <p className="text-sm font-semibold text-gray-800">
            {quota?.fetchedAt ? new Date(quota.fetchedAt).toLocaleTimeString() : '暂无'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-500">操作建议</p>
          <p className="text-sm font-semibold text-gray-800">
            {riskLevel === 'high' ? '先排查错误后再刷新' : riskLevel === 'warn' ? '建议手动刷新确认' : '维持按需刷新'}
          </p>
        </div>
      </div>

      {riskNotes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">风险提示</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-800 list-disc pl-4">
            {riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs text-gray-600">
          主动作：手动获取官方额度（交互式，会使用隔离浏览器）。
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/widget/quota"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            打开小组件视图
          </a>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-red-600 text-white disabled:opacity-50"
          >
            {refreshing ? '获取中...' : '点击获取官方额度'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ClaudeCard data={claude} />
        <CodexCard data={codex} />
        <AntigravityCard data={antigravity} />
      </div>
    </section>
  );
}
