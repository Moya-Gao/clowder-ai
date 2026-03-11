'use client';

import type { LeaderboardRange, LeaderboardStatsResponse, RankedCat, StreakCat } from '@cat-cafe/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

const RANGE_OPTIONS: { value: LeaderboardRange; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
];

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm text-gray-400">#{rank}</span>;
}

function RankedList({ items, unit }: { items: RankedCat[]; unit: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">暂无数据</p>;
  return (
    <ul className="space-y-2">
      {items.map((cat) => (
        <li key={cat.catId} className="flex items-center gap-2">
          <Medal rank={cat.rank} />
          <span className="font-medium text-sm">{cat.displayName}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {cat.count} {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StreakList({ items }: { items: StreakCat[] }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">暂无数据</p>;
  return (
    <ul className="space-y-2">
      {items.map((cat) => (
        <li key={cat.catId} className="flex items-center gap-2">
          <Medal rank={cat.rank} />
          <span className="font-medium text-sm">{cat.displayName}</span>
          <span className="text-xs text-gray-500 ml-auto">
            连续 {cat.currentStreak} 天 (最长 {cat.maxStreak})
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function HubLeaderboardTab() {
  const [data, setData] = useState<LeaderboardStatsResponse | null>(null);
  const [range, setRange] = useState<LeaderboardRange>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (r: LeaderboardRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/leaderboard/stats?range=${r}`);
      if (res.ok) {
        setData((await res.json()) as LeaderboardStatsResponse);
      } else {
        setError('排行榜加载失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(range);
  }, [range, fetchStats]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">猫猫排行榜</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === opt.value
                  ? 'bg-white text-blue-600 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {loading && !data && <p className="text-sm text-gray-400">加载中...</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatCard title="最受欢迎" emoji="⭐">
            <RankedList items={data.mentions.favoriteCat} unit="次被 @" />
          </StatCard>
          <StatCard title="夜猫子" emoji="🌙">
            <RankedList items={data.mentions.nightOwl} unit="次深夜 @" />
          </StatCard>
          <StatCard title="话痨" emoji="💬">
            <RankedList items={data.mentions.chatty} unit="条消息" />
          </StatCard>
          <StatCard title="连续签到" emoji="🔥">
            <StreakList items={data.mentions.streak} />
          </StatCard>
          <StatCard title="代码贡献" emoji="💻">
            <RankedList items={data.work.commits} unit="次提交" />
          </StatCard>
          <StatCard title="Bug 猎手" emoji="🐛">
            <RankedList items={data.work.bugFixes} unit="个修复" />
          </StatCard>
          <StatCard title="Review 达人" emoji="👀">
            <RankedList items={data.work.reviews} unit="次 review" />
          </StatCard>
        </div>
      )}
    </div>
  );
}
