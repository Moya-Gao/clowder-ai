'use client';

import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { CatOverviewTab, SystemTab, type ConfigData } from './config-viewer-tabs';
import { HubCommandsTab } from './HubCommandsTab';
import { HubEnvFilesTab } from './HubEnvFilesTab';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { PushSettingsPanel } from './PushSettingsPanel';
import { HubStrategyTab } from './HubStrategyTab';
import { HubCapabilityTab } from './HubCapabilityTab';
import { HubRoutingPolicyTab } from './HubRoutingPolicyTab';
import { HubProviderProfilesTab } from './HubProviderProfilesTab';
import { useCatData } from '@/hooks/useCatData';

// F032 P2: HubTabId now uses string for dynamic cat tabs
export type HubTabId = string;

// Hub tabs — cat overview merged into single tab, Skills 看板 replaced by 能力看板
const HUB_TABS: { id: HubTabId; label: string }[] = [
  { id: 'cats', label: '猫猫总览' },
  { id: 'system', label: '系统配置' },
  { id: 'capabilities', label: '能力中心' },
  { id: 'routing', label: '猫粮看板' },
  { id: 'commands', label: '命令速查' },
  { id: 'env', label: '环境 & 文件' },
  { id: 'provider-profiles', label: '账号配置' },
  { id: 'voice', label: '语音设置' },
  { id: 'notify', label: '通知' },
  { id: 'strategy', label: 'Session 策略' },
];

export function resolveRequestedHubTab(
  requestedTab: string,
  getCatById: (catId: string) => unknown,
): HubTabId {
  if (requestedTab === 'quota') return 'routing';
  if (getCatById(requestedTab)) return 'cats';
  return requestedTab;
}

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
  const requestedTab = (hubState?.tab ?? 'cats') as HubTabId;
  const normalizedRequestedTab = resolveRequestedHubTab(requestedTab, getCatById);

  const [tab, setTab] = useState<HubTabId>(normalizedRequestedTab);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [capTabEverOpened, setCapTabEverOpened] = useState(false);

  // Sync tab to store-requested tab when opening
  useEffect(() => {
    if (open) {
      setTab(normalizedRequestedTab);
    }
  }, [open, normalizedRequestedTab]);

  // Fallback to valid tab if current is invalid
  useEffect(() => {
    if (!open) return;
    const isValid = HUB_TABS.some(t => t.id === tab);
    if (!isValid) setTab('cats');
  }, [open, tab]);

  // Keep 能力中心 mounted after first visit so switching tabs doesn't "flash" on re-mount.
  useEffect(() => {
    if (!open) return;
    if (tab === 'capabilities') setCapTabEverOpened(true);
  }, [open, tab]);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await apiFetch('/api/config');
      if (res.ok) {
        const d = await res.json() as { config: ConfigData };
        setConfig(d.config);
      } else {
        setFetchError('配置加载失败');
      }
    } catch {
      setFetchError('网络错误');
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

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeHub}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <h2 className="text-base font-bold">Cat Caf&eacute; Hub</h2>
          <button onClick={closeHub} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="flex border-b border-gray-200 px-5 overflow-x-auto" style={{ flexShrink: 0 }}>
          {HUB_TABS.map((t) => (
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

          {/* Keep 能力中心 mounted after first open to avoid re-mount loading flash */}
          {(tab === 'capabilities' || capTabEverOpened) && (
            <div className={tab === 'capabilities' ? '' : 'hidden'}>
              <HubCapabilityTab />
            </div>
          )}

          {tab === 'cats' && (
            config ? <CatOverviewTab config={config} cats={cats} /> : !fetchError ? <p className="text-sm text-gray-400">加载中...</p> : null
          )}
          {tab === 'system' && (
            config ? <SystemTab config={config} /> : !fetchError ? <p className="text-sm text-gray-400">加载中...</p> : null
          )}
          {tab === 'commands' && <HubCommandsTab />}
          {tab === 'routing' && <HubRoutingPolicyTab />}
          {tab === 'env' && <HubEnvFilesTab />}
          {tab === 'provider-profiles' && <HubProviderProfilesTab />}
          {tab === 'voice' && <VoiceSettingsPanel />}
          {tab === 'notify' && <PushSettingsPanel />}
          {tab === 'strategy' && <HubStrategyTab />}
        </div>
      </div>
    </div>
  );
}
