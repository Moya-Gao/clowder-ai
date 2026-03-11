'use client';

import type { RankedCat, StreakCat } from '@cat-cafe/shared';

export const AVATAR_MAP: Record<string, string> = {
  opus: '/avatars/opus-kawaii.png',
  codex: '/avatars/codex-kawaii.png',
  gemini: '/avatars/gemini-kawaii.png',
};

const CAT_TAG: Record<string, string> = {
  opus: '布偶猫 · Opus',
  codex: '缅因猫 · Codex',
  gemini: '暹罗猫 · Gemini',
};

const MEDAL = ['🥇', '🥈', '🥉'];

export function CatHeroCard({ cat, unit }: { cat: RankedCat; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl p-5" style={{ background: '#F4EFE7' }}>
      <span className="text-[28px]">{MEDAL[cat.rank - 1] ?? `#${cat.rank}`}</span>
      <img
        src={AVATAR_MAP[cat.catId] ?? '/avatars/opus.png'}
        alt={cat.displayName}
        className="w-[72px] h-[72px] rounded-full object-cover"
      />
      <span className="text-lg font-medium" style={{ fontFamily: 'Fraunces, serif', color: '#2D2D2D' }}>
        {cat.displayName}
      </span>
      <span
        className="text-[11px] font-medium"
        style={{ color: '#8E8E93', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        {CAT_TAG[cat.catId] ?? cat.catId}
      </span>
      <span className="text-4xl font-medium tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: '#8B6F47' }}>
        {cat.count}
      </span>
      <span className="text-[11px] font-medium" style={{ color: '#8E8E93' }}>
        {unit}
      </span>
    </div>
  );
}

export function WorkMetric({ cat, label }: { cat: RankedCat | undefined; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl p-5" style={{ background: '#F4EFE7' }}>
      <span className="text-4xl font-medium tracking-tight" style={{ fontFamily: 'Fraunces, serif', color: '#2D2D2D' }}>
        {cat?.count ?? 0}
      </span>
      <span className="text-xs font-medium" style={{ color: '#8E8E93', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        {label}
      </span>
      {cat && (
        <span
          className="inline-flex self-start rounded-md px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'rgba(139,111,71,0.08)', color: '#8B6F47', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          🏅 {cat.displayName}
        </span>
      )}
    </div>
  );
}

export function MiniRanked({ items, unit }: { items: RankedCat[]; unit: string }) {
  if (items.length === 0)
    return (
      <p className="text-sm" style={{ color: '#8E8E93' }}>
        暂无数据
      </p>
    );
  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((cat) => (
        <li key={cat.catId} className="flex items-center gap-2">
          <span className="text-sm">{MEDAL[cat.rank - 1] ?? `#${cat.rank}`}</span>
          <img
            src={AVATAR_MAP[cat.catId] ?? '/avatars/opus.png'}
            alt=""
            className="w-6 h-6 rounded-full object-cover"
          />
          <span className="text-[13px] font-semibold" style={{ color: '#2D2D2D' }}>
            {cat.displayName}
          </span>
          <span className="text-[11px] ml-auto" style={{ color: '#8E8E93' }}>
            {cat.count} {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StreakRanked({ items }: { items: StreakCat[] }) {
  if (items.length === 0)
    return (
      <p className="text-sm" style={{ color: '#8E8E93' }}>
        暂无数据
      </p>
    );
  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((cat) => (
        <li key={cat.catId} className="flex items-center gap-2">
          <span className="text-sm">{MEDAL[cat.rank - 1] ?? `#${cat.rank}`}</span>
          <span className="text-[13px] font-semibold" style={{ color: '#2D2D2D' }}>
            {cat.displayName}
          </span>
          <span className="text-[11px] ml-auto" style={{ color: '#8E8E93' }}>
            连续 {cat.currentStreak} 天 (最长 {cat.maxStreak})
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#FFFDF8' }}>
      <h3 className="text-xl font-medium" style={{ fontFamily: 'Fraunces, serif', color: '#2D2D2D' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ComingSoon({ label }: { label: string }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 opacity-50"
      style={{ background: '#FFFDF8' }}
    >
      <span className="text-2xl">🔒</span>
      <span className="text-sm font-medium" style={{ color: '#8E8E93' }}>
        {label}
      </span>
      <span className="text-[11px]" style={{ color: '#8E8E93' }}>
        Phase B/C 待实现
      </span>
    </div>
  );
}
