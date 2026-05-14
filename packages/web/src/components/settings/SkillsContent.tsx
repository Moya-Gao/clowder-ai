'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { HubIcon } from '../hub-icons';
import {
  settingsResourceAvatarClass,
  settingsResourceCardClass,
  settingsResourceRowClass,
} from '../SettingsResourceCard';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SkillPreviewModal } from './SkillPreviewModal';

interface SkillMount {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
  kimi: boolean;
}

interface SkillMcpDependency {
  id: string;
  status: 'ready' | 'missing' | 'unresolved';
}

interface SkillEntry {
  name: string;
  category: string;
  trigger: string;
  mounts: SkillMount;
  requiresMcp: SkillMcpDependency[];
}

interface SkillsStaleness {
  stale: boolean;
  newSkills: string[];
  removedSkills: string[];
}

interface SkillConflict {
  skillName: string;
  projectTarget: string;
  userTarget: string;
  activeLayer: 'user' | 'project';
}

interface SkillsData {
  skills: SkillEntry[];
  summary: {
    total: number;
    allMounted: boolean;
    registrationConsistent: boolean;
  };
  staleness: SkillsStaleness | null;
  conflicts: SkillConflict[];
}

interface SkillsApiEntry extends Omit<SkillEntry, 'requiresMcp'> {
  requiresMcp?: SkillMcpDependency[];
}

interface SkillsApiData extends Omit<SkillsData, 'skills'> {
  skills: SkillsApiEntry[];
}

const ALL_CATEGORIES = '全部';
const PROVIDER_KEYS: Array<keyof SkillMount> = ['claude', 'codex', 'gemini', 'kimi'];

function getMountedCount(mounts: SkillMount): number {
  return PROVIDER_KEYS.filter((key) => mounts[key]).length;
}

function dependencyTone(status: SkillMcpDependency['status']): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-700';
  if (status === 'missing') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSkillsData(payload: SkillsApiData): SkillsData {
  return {
    ...payload,
    skills: payload.skills.map((skill) => ({
      ...skill,
      requiresMcp: skill.requiresMcp ?? [],
    })),
  };
}

export function SkillsContent() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [previewSkill, setPreviewSkill] = useState<SkillEntry | null>(null);

  const fetchSkills = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/skills');
      if (!res.ok) {
        setError(`Skills 数据加载失败 (${res.status})`);
        return;
      }
      setData(normalizeSkillsData((await res.json()) as SkillsApiData));
    } catch {
      setError('Skills 数据加载失败');
    }
  }, []);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const categories = useMemo(() => {
    if (!data) return [ALL_CATEGORIES];
    const seen = new Set<string>();
    for (const skill of data.skills) {
      if (skill.category) seen.add(skill.category);
    }
    return [ALL_CATEGORIES, ...seen];
  }, [data]);

  const filteredSkills = useMemo(() => {
    if (!data) return [];
    const needle = normalizeSearch(query);
    return data.skills.filter((skill) => {
      if (activeCategory !== ALL_CATEGORIES && skill.category !== activeCategory) return false;
      if (!needle) return true;
      return `${skill.name} ${skill.category} ${skill.trigger}`.toLowerCase().includes(needle);
    });
  }, [activeCategory, data, query]);

  return (
    <div className="space-y-5">
      <SettingsPageHeader title="Skill 管理" subtitle="Skill 列表、触发条件和 SKILL.md 预览。" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}

      {data?.staleness?.stale && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span className="font-semibold">Skills 有更新</span>
          {data.staleness.newSkills.length > 0 && <span className="ml-2">+{data.staleness.newSkills.length} 新增</span>}
          {data.staleness.removedSkills.length > 0 && (
            <span className="ml-2">-{data.staleness.removedSkills.length} 移除</span>
          )}
        </div>
      )}

      {data && data.conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Skill 来源冲突</span>
          <span className="ml-2">{data.conflicts.length} 项需要在同步流程中处理。</span>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-3 rounded-2xl bg-[var(--console-panel-bg)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                data-active={activeCategory === category ? 'true' : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === category
                    ? 'bg-[var(--console-active-bg)] text-cafe-interactive'
                    : 'bg-[var(--console-card-bg)] text-cafe-muted hover:text-cafe-secondary'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <label className="flex min-w-[220px] items-center gap-2 rounded-[12px] bg-[var(--console-card-bg)] px-3 py-2 text-xs text-cafe-muted">
            <HubIcon name="search" className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="筛选 Skill"
              className="min-w-0 flex-1 bg-transparent text-cafe-secondary outline-none placeholder:text-cafe-muted"
            />
          </label>
        </div>
      )}

      {!data && !error && <p className="text-sm text-cafe-muted">加载中...</p>}

      {data && filteredSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--console-card-bg)] px-8 py-16 text-center">
          <HubIcon name="zap" className="mb-3 h-10 w-10 text-cafe-muted opacity-40" />
          <p className="text-[15px] font-semibold text-cafe">暂无匹配的 Skill</p>
          <p className="mt-1 text-xs text-cafe-muted">调整分类或搜索条件后再试。</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredSkills.map((skill) => {
          const mountedCount = getMountedCount(skill.mounts);
          const allMounted = mountedCount === PROVIDER_KEYS.length;
          return (
            <div key={skill.name} className={settingsResourceCardClass}>
              <div className={settingsResourceRowClass}>
                <button
                  type="button"
                  onClick={() => setPreviewSkill(skill)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <div className={settingsResourceAvatarClass}>{skill.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-cafe">{skill.name}</p>
                    <p className="mt-0.5 truncate text-xs text-cafe-secondary">{skill.trigger ? skill.trigger : '—'}</p>
                    <p className="mt-0.5 text-label text-cafe-muted">{skill.category ? skill.category : '未分类'}</p>
                  </div>
                </button>
                <div className="shrink-0 text-right">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      allMounted ? 'bg-conn-emerald-bg text-conn-emerald-text' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {allMounted ? '全部挂载' : `${mountedCount}/${PROVIDER_KEYS.length} 已挂载`}
                  </span>
                </div>
              </div>
              {skill.requiresMcp.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {skill.requiresMcp.map((dep) => (
                    <span
                      key={`${skill.name}:${dep.id}`}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dependencyTone(dep.status)}`}
                    >
                      {dep.id}:{dep.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data && (
        <div className="rounded-lg border border-cafe bg-cafe-surface-elevated/70 p-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-cafe-secondary">{data.summary.total} skills</span>
            <span className={data.summary.allMounted ? 'text-green-600' : 'text-amber-600'}>
              {data.summary.allMounted ? '全部正确挂载' : '部分挂载缺失'}
            </span>
            <span className={data.summary.registrationConsistent ? 'text-green-600' : 'text-amber-600'}>
              {data.summary.registrationConsistent ? '注册一致' : '注册不一致'}
            </span>
          </div>
        </div>
      )}

      {previewSkill && (
        <SkillPreviewModal
          skillId={previewSkill.name}
          skillName={previewSkill.name}
          description={previewSkill.trigger}
          triggers={previewSkill.trigger ? [previewSkill.trigger] : []}
          category={previewSkill.category}
          onClose={() => setPreviewSkill(null)}
        />
      )}
    </div>
  );
}
