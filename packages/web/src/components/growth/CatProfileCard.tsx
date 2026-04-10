'use client';

import type { CatGrowthProfile, GrowthDimension } from '@cat-cafe/shared';
import { useCatData } from '@/hooks/useCatData';
import { GrowthRadarChart } from './GrowthRadarChart';

const DIM_LABELS: Record<GrowthDimension, string> = {
  architecture: '架构力',
  review: '审查力',
  aesthetics: '审美力',
  execution: '执行力',
  collaboration: '协作力',
  insight: '洞察力',
};

const DIMENSIONS: GrowthDimension[] = ['architecture', 'review', 'aesthetics', 'execution', 'collaboration', 'insight'];

interface Props {
  profile: CatGrowthProfile;
  /** ID for PNG export via html2canvas */
  cardId?: string;
}

export function CatProfileCard({ profile, cardId }: Props) {
  const { getCatById } = useCatData();
  const catData = getCatById(profile.catId);
  const primaryColor = catData?.color?.primary ?? '#9B7EBD';

  const { attributes } = profile;
  const { stats, overallLevel, totalXp } = attributes;

  return (
    <div
      id={cardId}
      className="rounded-xl bg-cafe-surface shadow-[0_1px_8px_rgba(0,0,0,0.03)] p-5"
      style={{ borderTop: `3px solid ${primaryColor}` }}
    >
      {/* Header: avatar + name + level */}
      <div className="mb-4 flex items-center gap-3">
        {catData?.avatar ? (
          <img src={catData.avatar} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {profile.displayName.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-cafe">{profile.nickname ?? profile.displayName}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Lv.{overallLevel}
            </span>
          </div>
          <span className="text-xs text-cafe-muted">
            {profile.currentTitle?.label.zh ?? profile.displayName}
            {' · '}
            {totalXp.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Radar chart */}
      <div className="flex justify-center">
        <GrowthRadarChart stats={stats} size={200} color={primaryColor} />
      </div>

      {/* Dimension bars */}
      <div className="mt-4 space-y-2">
        {DIMENSIONS.map((d) => {
          const s = stats[d];
          if (!s) return null;
          const progress =
            s.xpToNext > 0 ? (s.xp - s.level * s.level * 100) / (s.xpToNext + s.xp - s.level * s.level * 100) : 1;
          return (
            <div key={d} className="flex items-center gap-2 text-xs">
              <span className="w-14 text-right text-cafe-secondary">{DIM_LABELS[d]}</span>
              <span className="w-8 font-medium" style={{ color: primaryColor }}>
                Lv.{s.level}
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-cafe-surface-elevated">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(progress * 100, 100)}%`,
                    backgroundColor: primaryColor,
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="w-12 text-right text-cafe-muted">{s.xp} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
