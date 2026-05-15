'use client';

interface SkillConflict {
  skillName: string;
  projectTarget: string;
  userTarget: string;
  activeLayer: 'user' | 'project';
}

interface SkillConflictBannerProps {
  conflicts: SkillConflict[];
  resolving: string | null;
  onResolve: (name: string, choice: 'official' | 'mine') => void;
}

export function SkillConflictBanner({ conflicts, resolving, onResolve }: SkillConflictBannerProps) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <p className="font-semibold">Skill 来源冲突 ({conflicts.length})</p>
      {conflicts.map((c) => (
        <div key={c.skillName} className="flex items-center justify-between gap-3 rounded-lg bg-amber-100/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{c.skillName}</p>
            <p className="mt-0.5 text-[10px] text-amber-700">
              active: {c.activeLayer} · project: {c.projectTarget ? 'yes' : 'no'} · user: {c.userTarget ? 'yes' : 'no'}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={resolving === c.skillName}
              onClick={() => void onResolve(c.skillName, 'official')}
              className="rounded-[8px] bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Official
            </button>
            <button
              type="button"
              disabled={resolving === c.skillName}
              onClick={() => void onResolve(c.skillName, 'mine')}
              className="rounded-[8px] bg-white px-2.5 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Mine
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
