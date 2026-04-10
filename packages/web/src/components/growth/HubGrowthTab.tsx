'use client';

import type { GrowthOverview } from '@cat-cafe/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { CatProfileCard } from './CatProfileCard';

export function HubGrowthTab() {
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/growth/overview');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? '加载失败');
        return;
      }
      setOverview((await res.json()) as GrowthOverview);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cafe">猫猫成长</h2>
          <p className="mt-0.5 text-xs text-cafe-muted">真实协作数据结晶 · 六维属性 · AI Agent 养成</p>
        </div>
        {overview ? (
          <div className="text-right">
            <span className="text-2xl font-bold" style={{ color: '#9B7EBD' }}>
              Lv.{overview.teamLevel}
            </span>
            <p className="text-xs text-cafe-muted">团队等级 · {overview.teamTotalXp.toLocaleString()} XP</p>
          </div>
        ) : null}
      </div>

      {/* Loading / Error */}
      {loading && !overview ? (
        <div className="flex items-center justify-center py-12 text-sm text-cafe-muted">加载中...</div>
      ) : null}
      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</div> : null}

      {/* Cat cards grid */}
      {overview ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {overview.profiles.map((profile) => (
            <CatProfileCard key={profile.catId} profile={profile} cardId={`growth-card-${profile.catId}`} />
          ))}
        </div>
      ) : null}

      {/* Empty state */}
      {overview && overview.profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-cafe-muted">
          <p className="text-sm">还没有猫猫成长数据</p>
          <p className="mt-1 text-xs">猫猫完成任务、review 代码后会自动积累经验值</p>
        </div>
      ) : null}
    </div>
  );
}
