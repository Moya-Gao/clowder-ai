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
  '将尝试重启 Chrome 以开启官方额度抓取所需的 CDP（9222）。未保存页面可能受影响，是否继续？';

export function shouldWarnBeforeOfficialRefresh(message: string | null | undefined): boolean {
  if (!message) return false;
  return /QUOTA_BROWSER_CDP_URL|remote-debugging-port=9222/i.test(message);
}

export function HubQuotaBoardTab() {
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await apiFetch('/api/quota');
      if (res.ok) {
        const data = (await res.json()) as QuotaResponse;
        setQuota(data);
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
    if (shouldWarnBeforeOfficialRefresh(guidanceText)) {
      const confirmFn: ((message?: string) => boolean) | undefined =
        typeof window !== 'undefined' ? window.confirm : undefined;
      const proceed = confirmFn ? confirmFn(RESTART_WARNING_TEXT) : true;
      if (!proceed) {
        return;
      }
    }
    setRefreshing(true);
    try {
      const refreshRes = await apiFetch('/api/quota/refresh/official', { method: 'POST' });
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
  }, [fetchQuota, quota, refreshError]);

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

      <div className="grid grid-cols-3 gap-3">
        <ClaudeCard data={claude} />
        <CodexCard data={codex} />
        <AntigravityCard data={antigravity} />
      </div>
    </section>
  );
}
