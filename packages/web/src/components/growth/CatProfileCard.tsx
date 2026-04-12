'use client';

import type { CatGrowthProfile, GrowthDimension } from '@cat-cafe/shared';
import { useCallback, useState } from 'react';
import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { useCatData } from '@/hooks/useCatData';
import { apiFetch } from '@/utils/api-client';
import { GrowthRadarChart } from './GrowthRadarChart';
import { XpAuditLog } from './XpAuditLog';

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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { attributes } = profile;
  const { stats, overallLevel, totalXp } = attributes;

  /** AC-A3: Download profile card as PNG */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await apiFetch(`/api/growth/${profile.catId}/export-image`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(body.message || body.error || '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.nickname ?? profile.displayName}-growth-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败';
      setExportError(msg);
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExporting(false);
    }
  }, [profile.catId, profile.nickname, profile.displayName]);

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
        {/* AC-A3: Export PNG button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg p-1.5 transition-colors hover:bg-cafe-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
          title="导出名片 PNG"
          aria-label="导出名片 PNG"
        >
          {exporting ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 animate-spin text-cafe-secondary"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 019.8 8" />
            </svg>
          ) : (
            <DownloadIcon className="h-4 w-4 text-cafe-secondary" />
          )}
        </button>
      </div>

      {/* Export error feedback */}
      {exportError ? <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-500">{exportError}</div> : null}

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

      {/* AC-A5: XP audit trail */}
      <XpAuditLog catId={profile.catId} color={primaryColor} />
    </div>
  );
}
