import type { CatFamily } from '../capability-board-ui';
import { HubIcon } from '../hub-icons';
import {
  SettingsResourceToggleSwitch,
  settingsResourceAvatarClass,
  settingsResourceCardClass,
  settingsResourceRowClass,
} from '../SettingsResourceCard';
import { PROVIDER_KEYS, dependencyTone } from './skills-types';
import type { SettingsSkillItem, SkillsData, SkillsStaleness } from './skills-types';

export function HealthStrip({
  summary,
  staleness,
  conflictCount,
  syncing,
  onSync,
}: {
  summary: SkillsData['summary'];
  staleness: SkillsStaleness | null;
  conflictCount: number;
  syncing: boolean;
  onSync: () => void;
}) {
  const hasIssues = !summary.allMounted || !summary.registrationConsistent || conflictCount > 0;
  const isStale = staleness?.stale ?? false;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
        hasIssues
          ? 'border-conn-amber-ring bg-conn-amber-bg text-conn-amber-text'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={summary.allMounted ? 'text-emerald-600' : ''}>
          {summary.allMounted ? '挂载正常' : '挂载异常'}
        </span>
        <span className="text-cafe-muted">·</span>
        <span className={summary.registrationConsistent ? 'text-emerald-600' : ''}>
          {summary.registrationConsistent ? '注册一致' : '注册不一致'}
        </span>
        {conflictCount > 0 && (
          <>
            <span className="text-cafe-muted">·</span>
            <span>{conflictCount} 冲突</span>
          </>
        )}
        {isStale && (
          <>
            <span className="text-cafe-muted">·</span>
            <span className="font-semibold">有更新</span>
            {(staleness?.newSkills.length ?? 0) > 0 && <span>+{staleness?.newSkills.length} 新增</span>}
            {(staleness?.removedSkills.length ?? 0) > 0 && <span>-{staleness?.removedSkills.length} 移除</span>}
          </>
        )}
      </div>
      {isStale && (
        <button
          type="button"
          disabled={syncing}
          onClick={onSync}
          className="rounded-[10px] bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      )}
    </div>
  );
}

export function SkillRow({
  skill,
  catFamilies,
  toggling,
  expandedCats,
  onPreview,
  onToggle,
  onExpandCats,
}: {
  skill: SettingsSkillItem;
  catFamilies: CatFamily[];
  toggling: string | null;
  expandedCats: string | null;
  onPreview: () => void;
  onToggle: (skillId: string, enabled: boolean, catId?: string) => void;
  onExpandCats: (skillId: string) => void;
}) {
  const allMounted = skill.governance.mountedCount === PROVIDER_KEYS.length;
  const isExpanded = expandedCats === skill.id;
  const isGlobalToggling = toggling === skill.id;

  return (
    <div className={settingsResourceCardClass}>
      <div className={settingsResourceRowClass}>
        <button type="button" onClick={onPreview} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className={settingsResourceAvatarClass}>{skill.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-cafe">{skill.name}</p>
            <p className="mt-0.5 truncate text-xs text-cafe-secondary">{skill.trigger || '—'}</p>
            <p className="mt-0.5 text-label text-cafe-muted">{skill.category || '未分类'}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              allMounted ? 'bg-conn-emerald-bg text-conn-emerald-text' : 'bg-conn-amber-bg text-conn-amber-text'
            }`}
          >
            {allMounted ? '全部挂载' : `${skill.governance.mountedCount}/${PROVIDER_KEYS.length} 已挂载`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-2">
          {skill.controls && (
            <>
              <SettingsResourceToggleSwitch
                enabled={skill.controls.enabled}
                busy={isGlobalToggling}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(skill.id, !skill.controls?.enabled);
                }}
                title={skill.controls.enabled ? '全局禁用' : '全局启用'}
              />
              {catFamilies.length > 0 && Object.keys(skill.controls.cats).length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpandCats(skill.id);
                  }}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-[var(--console-hover-bg)] text-cafe-muted transition-colors hover:text-cafe-secondary"
                  title="按猫开关"
                >
                  <HubIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {skill.governance.requiresMcp.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {skill.governance.requiresMcp.map((dep) => (
            <span
              key={`${skill.id}:${dep.id}`}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dependencyTone(dep.status)}`}
            >
              {dep.id}:{dep.status}
            </span>
          ))}
        </div>
      )}

      {isExpanded && skill.controls && catFamilies.length > 0 && (
        <PerCatSkillToggles
          skillId={skill.id}
          cats={skill.controls.cats}
          catFamilies={catFamilies}
          toggling={toggling}
          onToggle={onToggle}
        />
      )}
    </div>
  );
}

function PerCatSkillToggles({
  skillId,
  cats,
  catFamilies,
  toggling,
  onToggle,
}: {
  skillId: string;
  cats: Record<string, boolean>;
  catFamilies: CatFamily[];
  toggling: string | null;
  onToggle: (skillId: string, enabled: boolean, catId?: string) => void;
}) {
  return (
    <div className="border-t border-[var(--console-border-soft)] px-4 pb-3 pt-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-cafe-muted">按猫开关</span>
      <div className="mt-1.5 space-y-1">
        {catFamilies.map((family) => {
          const relevantCats = family.catIds.filter((catId) => catId in cats);
          if (relevantCats.length === 0) return null;
          return (
            <div key={family.id} className="space-y-1">
              {relevantCats.length > 1 && <span className="text-[10px] text-cafe-muted">{family.name}</span>}
              {relevantCats.map((catId) => {
                const enabled = cats[catId] ?? false;
                const busy = toggling === `${skillId}:${catId}`;
                return (
                  <div key={catId} className="flex items-center justify-between">
                    <span className="text-[11px] text-cafe-secondary">{catId}</span>
                    <SettingsResourceToggleSwitch
                      enabled={enabled}
                      busy={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(skillId, !enabled, catId);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
