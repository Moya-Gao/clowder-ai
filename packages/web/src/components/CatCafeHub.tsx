'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useCatData } from '@/hooks/useCatData';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { BrakeSettingsPanel } from './BrakeSettingsPanel';
import { CatOverviewTab, type ConfigData, SystemTab } from './config-viewer-tabs';
import { HubCapabilityTab } from './HubCapabilityTab';
import { HubCommandsTab } from './HubCommandsTab';
import { HubEnvFilesTab } from './HubEnvFilesTab';
import { HubGovernanceTab } from './HubGovernanceTab';
import { HubLeaderboardTab } from './HubLeaderboardTab';
import { HubProviderProfilesTab } from './HubProviderProfilesTab';
import { HubRoutingPolicyTab } from './HubRoutingPolicyTab';
import { HubStrategyTab } from './HubStrategyTab';
import { PushSettingsPanel } from './PushSettingsPanel';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

// F032 P2: HubTabId now uses string for dynamic cat tabs
export type HubTabId = string;

// F099: Bento Box grouped navigation — 3 groups by user intent
interface HubGroup {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string;
  borderColor: string;
  iconBg: string;
  tabs: { id: HubTabId; label: string }[];
}

const HUB_GROUPS: HubGroup[] = [
  {
    id: 'cats',
    label: '猫猫与协作',
    emoji: '🐾',
    description: '猫猫总览 · 能力中心 · 猫粮看板 · 排行榜',
    color: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-600',
    tabs: [
      { id: 'cats', label: '猫猫总览' },
      { id: 'capabilities', label: '能力中心' },
      { id: 'routing', label: '猫粮看板' },
      { id: 'leaderboard', label: '排行榜' },
    ],
  },
  {
    id: 'settings',
    label: '系统配置',
    emoji: '⚙️',
    description: '系统配置 · 环境&文件 · 账号配置 · 语音设置 · 通知 · Session 策略',
    color: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-600',
    tabs: [
      { id: 'system', label: '系统配置' },
      { id: 'env', label: '环境 & 文件' },
      { id: 'provider-profiles', label: '账号配置' },
      { id: 'voice', label: '语音设置' },
      { id: 'notify', label: '通知' },
      { id: 'strategy', label: 'Session 策略' },
    ],
  },
  {
    id: 'monitor',
    label: '监控与治理',
    emoji: '📊',
    description: '治理看板 · 健康 · 命令速查',
    color: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-600',
    tabs: [
      { id: 'governance', label: '治理看板' },
      { id: 'health', label: '健康' },
      { id: 'commands', label: '命令速查' },
    ],
  },
];

// Flat list for backward compat (resolveRequestedHubTab, fallback validation)
const ALL_TABS = HUB_GROUPS.flatMap((g) => g.tabs);

/** Find which group a tab belongs to */
function findGroupForTab(tabId: string): HubGroup | undefined {
  return HUB_GROUPS.find((g) => g.tabs.some((t) => t.id === tabId));
}

export function resolveRequestedHubTab(requestedTab: string, getCatById: (catId: string) => unknown): HubTabId {
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
  const rawRequestedTab = hubState?.tab as HubTabId | undefined;
  // F099: undefined = Bento home (no deep-link)
  const normalizedRequestedTab = rawRequestedTab ? resolveRequestedHubTab(rawRequestedTab, getCatById) : undefined;

  const [tab, setTab] = useState<HubTabId>('cats');
  // F099: null = Bento home, string = group id
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [capTabEverOpened, setCapTabEverOpened] = useState(false);

  // Sync tab to store-requested tab when opening
  useEffect(() => {
    if (open) {
      if (!normalizedRequestedTab) {
        // No specific tab → show Bento home
        setActiveGroup(null);
        return;
      }
      const group = findGroupForTab(normalizedRequestedTab);
      if (group) {
        setActiveGroup(group.id);
        setTab(normalizedRequestedTab);
      } else {
        setActiveGroup(null);
        setTab('cats');
      }
    }
  }, [open, normalizedRequestedTab]);

  // Fallback to valid tab if current is invalid
  useEffect(() => {
    if (!open) return;
    const isValid = ALL_TABS.some((t) => t.id === tab);
    if (!isValid) setTab('cats');
  }, [open, tab]);

  const navigateToGroup = useCallback((groupId: string) => {
    const group = HUB_GROUPS.find((g) => g.id === groupId);
    if (group) {
      setActiveGroup(groupId);
      setTab(group.tabs[0].id);
    }
  }, []);

  const navigateHome = useCallback(() => {
    setActiveGroup(null);
  }, []);

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
        const d = (await res.json()) as { config: ConfigData };
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
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHub();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, closeHub]);

  if (!open) return null;

  const currentGroup = activeGroup ? HUB_GROUPS.find((g) => g.id === activeGroup) : null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeHub}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            {currentGroup && (
              <button
                onClick={navigateHome}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="返回 Hub 首页"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            <h2 className="text-base font-bold">
              {currentGroup ? `${currentGroup.emoji} ${currentGroup.label}` : 'Cat Caf\u00e9 Hub'}
            </h2>
          </div>
          <button onClick={closeHub} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        {/* F099: Group-level tab bar (only when inside a group) */}
        {currentGroup && (
          <div className="flex border-b border-gray-200 px-5 overflow-x-auto" style={{ flexShrink: 0 }}>
            {currentGroup.tabs.map((t) => (
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
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: 0 }}>
          {fetchError && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{fetchError}</p>}

          {/* F099: Bento Box home — shown when no group is selected */}
          {!currentGroup && (
            <div className="flex flex-col gap-5 py-2">
              <p className="text-sm text-gray-500">选择一个分组开始管理</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {HUB_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => navigateToGroup(g.id)}
                    className={`${g.color} border ${g.borderColor} rounded-2xl p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col gap-3`}
                  >
                    <span className={`${g.iconBg} w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg`}>
                      {g.emoji}
                    </span>
                    <span className="font-semibold text-gray-900">{g.label}</span>
                    <span className="text-xs text-gray-500 leading-relaxed">{g.description}</span>
                    <span className="text-xs font-medium text-gray-400 mt-auto">
                      {g.tabs.length} 项功能
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab content (only when inside a group) */}
          {currentGroup && (
            <>
              {/* Keep 能力中心 mounted after first open to avoid re-mount loading flash */}
              {(tab === 'capabilities' || capTabEverOpened) && (
                <div className={tab === 'capabilities' ? '' : 'hidden'}>
                  <HubCapabilityTab />
                </div>
              )}

              {tab === 'cats' &&
                (config ? (
                  <CatOverviewTab config={config} cats={cats} />
                ) : !fetchError ? (
                  <p className="text-sm text-gray-400">加载中...</p>
                ) : null)}
              {tab === 'system' &&
                (config ? (
                  <SystemTab config={config} />
                ) : !fetchError ? (
                  <p className="text-sm text-gray-400">加载中...</p>
                ) : null)}
              {tab === 'commands' && <HubCommandsTab />}
              {tab === 'routing' && <HubRoutingPolicyTab />}
              {tab === 'env' && <HubEnvFilesTab />}
              {tab === 'provider-profiles' && <HubProviderProfilesTab />}
              {tab === 'voice' && <VoiceSettingsPanel />}
              {tab === 'notify' && <PushSettingsPanel />}
              {tab === 'strategy' && <HubStrategyTab />}
              {tab === 'governance' && <HubGovernanceTab />}
              {tab === 'health' && <BrakeSettingsPanel />}
              {tab === 'leaderboard' && <HubLeaderboardTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
