'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { HubIcon } from '../hub-icons';
import { ProjectSelector } from './capability-settings-ui';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SkillConflictBanner } from './SkillConflictBanner';
import { SkillPreviewModal } from './SkillPreviewModal';
import { HealthStrip, SkillRow } from './SkillsSubComponents';
import type { SettingsSkillItem, SkillsApiData, SkillsData } from './skills-types';
import { ALL_CATEGORIES, composeSkillItems, normalizeSearch, normalizeSkillsData } from './skills-types';
import { useSkillControls } from './useSkillControls';

export function SkillsContent() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [previewSkill, setPreviewSkill] = useState<SettingsSkillItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string | null>(null);

  const controls = useSkillControls();
  const skillsFetchGen = useRef(0);
  const latestProjectRef = useRef(controls.projectPath);
  latestProjectRef.current = controls.projectPath;

  const fetchSkills = useCallback(async (forProject?: string) => {
    const generation = ++skillsFetchGen.current;
    const isCurrent = () => skillsFetchGen.current === generation;
    setError(null);
    try {
      const q = forProject ? `?projectPath=${encodeURIComponent(forProject)}` : '';
      const res = await apiFetch(`/api/skills${q}`);
      if (!isCurrent()) return;
      if (!res.ok) {
        setError(`Skills 数据加载失败 (${res.status})`);
        return;
      }
      const parsed = normalizeSkillsData((await res.json()) as SkillsApiData);
      if (!isCurrent()) return;
      setData(parsed);
    } catch {
      if (!isCurrent()) return;
      setError('Skills 数据加载失败');
    }
  }, []);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const composedItems = useMemo(() => {
    if (!data) return [];
    return composeSkillItems(data, controls.items);
  }, [data, controls.items]);

  const categories = useMemo(() => {
    if (!data) return [ALL_CATEGORIES];
    const seen = new Set<string>();
    for (const skill of data.skills) {
      if (skill.category) seen.add(skill.category);
    }
    return [ALL_CATEGORIES, ...seen];
  }, [data]);

  const filteredSkills = useMemo(() => {
    const needle = normalizeSearch(query);
    return composedItems.filter((skill) => {
      if (activeCategory !== ALL_CATEGORIES && skill.category !== activeCategory) return false;
      if (!needle) return true;
      return `${skill.name} ${skill.category} ${skill.trigger}`.toLowerCase().includes(needle);
    });
  }, [activeCategory, composedItems, query]);

  async function handleSync() {
    setSyncing(true);
    setWriteError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (latestProjectRef.current) payload.projectPath = latestProjectRef.current;
      const res = await apiFetch('/api/skills/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setWriteError(body.error ?? `Sync failed (${res.status})`);
        return;
      }
      await Promise.all([fetchSkills(latestProjectRef.current ?? undefined), controls.refetch()]);
    } catch {
      setWriteError('Sync request failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleResolveConflict(skillName: string, choice: 'official' | 'mine') {
    setResolving(skillName);
    setWriteError(null);
    try {
      const payload: Record<string, unknown> = { skillName, choice };
      if (latestProjectRef.current) payload.projectPath = latestProjectRef.current;
      const res = await apiFetch('/api/skills/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setWriteError(body.error ?? `Resolve failed (${res.status})`);
        return;
      }
      await Promise.all([fetchSkills(latestProjectRef.current ?? undefined), controls.refetch()]);
    } catch {
      setWriteError('Resolve request failed');
    } finally {
      setResolving(null);
    }
  }

  const combinedError = error || controls.error;

  return (
    <div className="space-y-5">
      <SettingsPageHeader title="Skill 管理" subtitle="Skill 注册治理、能力开关和 SKILL.md 预览。" />

      <ProjectSelector
        resolvedPath={controls.resolvedProjectPath}
        knownProjects={controls.knownProjects}
        currentSelection={controls.projectPath}
        onSwitch={(path) => {
          setData(null);
          setActiveCategory(ALL_CATEGORIES);
          setQuery('');
          controls.switchProject(path);
          void fetchSkills(path ?? undefined);
        }}
      />

      {combinedError && (
        <p className="rounded-lg bg-conn-red-bg px-3 py-2 text-sm text-conn-red-text">{combinedError}</p>
      )}
      {writeError && <p className="rounded-lg bg-conn-red-bg px-3 py-2 text-sm text-conn-red-text">{writeError}</p>}

      {data && (
        <HealthStrip
          summary={data.summary}
          staleness={data.staleness}
          conflictCount={data.conflicts.length}
          syncing={syncing}
          onSync={handleSync}
        />
      )}

      {data && data.conflicts.length > 0 && (
        <SkillConflictBanner conflicts={data.conflicts} resolving={resolving} onResolve={handleResolveConflict} />
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
          <label className="flex min-w-[220px] items-center gap-2 rounded-xl bg-[var(--console-card-bg)] px-3 py-2 text-xs text-cafe-muted">
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
          <p className="text-base font-semibold text-cafe">暂无匹配的 Skill</p>
          <p className="mt-1 text-xs text-cafe-muted">调整分类或搜索条件后再试。</p>
        </div>
      )}

      <div className="space-y-3" data-testid="skills-list">
        {filteredSkills.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            catFamilies={controls.catFamilies}
            toggling={controls.toggling}
            expandedCats={expandedCats}
            onPreview={() => setPreviewSkill(skill)}
            onToggle={controls.handleToggle}
            onExpandCats={(id) => setExpandedCats(expandedCats === id ? null : id)}
          />
        ))}
      </div>

      {data && (
        <div className="rounded-lg border border-cafe bg-cafe-surface-elevated/70 p-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-cafe-secondary">{data.summary.total} skills</span>
            <span className={data.summary.allMounted ? 'text-conn-green-text' : 'text-conn-amber-text'}>
              {data.summary.allMounted ? '全部正确挂载' : '部分挂载缺失'}
            </span>
            <span className={data.summary.registrationConsistent ? 'text-conn-green-text' : 'text-conn-amber-text'}>
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
          projectPath={controls.projectPath}
          onClose={() => setPreviewSkill(null)}
        />
      )}
    </div>
  );
}
