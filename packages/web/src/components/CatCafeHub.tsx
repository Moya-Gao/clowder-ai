'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { CatTab, SystemTab, type ConfigData, type Capabilities } from './config-viewer-tabs';
import { HubCommandsTab } from './HubCommandsTab';
import { HubEnvFilesTab } from './HubEnvFilesTab';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { PushSettingsPanel } from './PushSettingsPanel';
import { HubStrategyTab } from './HubStrategyTab';
import { HubSkillsTab } from './HubSkillsTab';
import { useCatData } from '@/hooks/useCatData';

// F032 P2: HubTabId now uses string for dynamic cat tabs
export type HubTabId = string;

// System tabs (non-cat) - these are static
const SYSTEM_TABS: { id: HubTabId; label: string }[] = [
  { id: 'system', label: '系统配置' },
  { id: 'skills', label: 'Skills 看板' },
  { id: 'commands', label: '命令速查' },
  { id: 'env', label: '环境 & 文件' },
  { id: 'voice', label: '语音设置' },
  { id: 'notify', label: '通知' },
  { id: 'strategy', label: 'Session 策略' },
];

/**
 * Global Hub modal — always mounted at ChatContainer root.
 * Open/close driven by chatStore.hubState (not props).
 */
export function CatCafeHub() {
  const hubState = useChatStore((s) => s.hubState);
  const closeHub = useChatStore((s) => s.closeHub);
  // F032 P2: Get dynamic cat data
  const { cats, getCatById } = useCatData();

  const open = hubState?.open ?? false;
  const requestedTab = (hubState?.tab ?? 'opus') as HubTabId;

  const [tab, setTab] = useState<HubTabId>('opus');
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [caps, setCaps] = useState<Record<string, Capabilities> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // F032 P2: Build TABS dynamically from cat data
  const TABS = useMemo(() => {
    // Get unique breed default variants (one tab per breed)
    const catTabs = cats
      .filter(c => c.isDefaultVariant !== false) // Include default variants and those without the flag
      .slice(0, 3) // Limit to first 3 breeds for UI space
      .map(c => ({ id: c.id, label: c.breedDisplayName ?? c.displayName }));
    return [...catTabs, ...SYSTEM_TABS];
  }, [cats]);

  // Sync tab to store-requested tab when opening
  useEffect(() => {
    if (open) setTab(requestedTab);
  }, [open, requestedTab]);

  // Cloud Codex R4 P2 fix: Fallback to valid tab when dynamic cat lookup misses
  useEffect(() => {
    if (!open) return;
    // Check if current tab is valid (either in TABS or is a valid cat)
    const isValidTab = TABS.some(t => t.id === tab) || SYSTEM_TABS.some(t => t.id === tab);
    if (!isValidTab) {
      // Fallback to first available cat tab, or 'system' if no cats
      const firstCatTab = TABS.find(t => !SYSTEM_TABS.some(st => st.id === t.id));
      setTab(firstCatTab?.id ?? 'system');
    }
  }, [open, tab, TABS]);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    const results = await Promise.allSettled([
      apiFetch('/api/config'),
      apiFetch('/api/capabilities'),
    ]);
    const [configResult, capsResult] = results;
    if (configResult.status === 'fulfilled' && configResult.value.ok) {
      const d = await configResult.value.json() as { config: ConfigData };
      setConfig(d.config);
    } else {
      setFetchError((prev) => prev ?? '配置加载失败');
    }
    if (capsResult.status === 'fulfilled' && capsResult.value.ok) {
      setCaps(await capsResult.value.json() as Record<string, Capabilities>);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeHub(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, closeHub]);

  if (!open) return null;

  // F032 P2: Check if current tab is a cat tab dynamically
  const catId = getCatById(tab) ? tab : null;
  const cat = catId ? config?.cats[catId] : undefined;
  const budget = catId ? config?.perCatBudgets[catId] : undefined;
  const catCaps = catId ? caps?.[catId] : undefined;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeHub}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <h2 className="text-base font-bold">Cat Caf&eacute; Hub</h2>
          <button onClick={closeHub} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="flex border-b border-gray-200 px-5 overflow-x-auto" style={{ flexShrink: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: 0 }}>
          {fetchError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{fetchError}</p>
          )}
          {catId && cat && budget ? (
            <CatTab cat={cat} budget={budget} caps={catCaps ?? undefined} />
          ) : tab === 'system' && config ? (
            <SystemTab config={config} />
          ) : tab === 'skills' ? (
            <HubSkillsTab />
          ) : tab === 'commands' ? (
            <HubCommandsTab />
          ) : tab === 'env' ? (
            <HubEnvFilesTab />
          ) : tab === 'voice' ? (
            <VoiceSettingsPanel />
          ) : tab === 'notify' ? (
            <PushSettingsPanel />
          ) : tab === 'strategy' ? (
            <HubStrategyTab />
          ) : !config && !fetchError ? (
            <p className="text-sm text-gray-400">加载中...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
