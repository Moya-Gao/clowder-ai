'use client';

// biome-ignore lint/correctness/noUnusedImports: React must be in scope for SSR JSX runtime in tests.
import React, { useCallback, useEffect, useState } from 'react';
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
  return '官方网页探针：已启用（仅手动触发）';
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
  const officialProbeHint = buildOfficialProbeHint(probes);

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
    <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-700">猫粮看板</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-red-600 text-white disabled:opacity-50"
          >
            {refreshing ? '获取中...' : '点击获取官方额度'}
          </button>
          {quota?.fetchedAt && (
            <span className="text-[10px] text-gray-400">
              最后检查: {new Date(quota.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      {refreshError && <div className="mb-3 text-[11px] text-red-600">{refreshError}</div>}
      {officialProbeHint && <div className="mb-3 text-[11px] text-amber-700">{officialProbeHint}</div>}

      <div className="grid grid-cols-3 gap-3">
        <ClaudeCard data={claude} />
        <CodexCard data={codex} />
        <AntigravityCard data={antigravity} />
      </div>
    </section>
  );
}
