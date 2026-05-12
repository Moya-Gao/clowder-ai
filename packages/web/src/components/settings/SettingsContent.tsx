'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCatData } from '@/hooks/useCatData';
import { apiFetch } from '@/utils/api-client';
import { BrakeSettingsPanel } from '../BrakeSettingsPanel';
import { CatOverviewTab, type ConfigData } from '../config-viewer-tabs';
import { HubAccountsTab } from '../HubAccountsTab';
import { HubClaudeRescueSection } from '../HubClaudeRescueSection';
import { HubCommandsTab } from '../HubCommandsTab';
import { HubConnectorConfigTab } from '../HubConnectorConfigTab';
import { HubEnvFilesTab } from '../HubEnvFilesTab';
import { HubGovernanceTab } from '../HubGovernanceTab';
import { HubLeaderboardTab } from '../HubLeaderboardTab';
import { HubObservabilityTab } from '../HubObservabilityTab';
import { HubRoutingPolicyTab } from '../HubRoutingPolicyTab';
import { HubSkillsTab } from '../HubSkillsTab';
import { HubToolUsageTab } from '../HubToolUsageTab';
import { PushSettingsPanel } from '../PushSettingsPanel';
import { VoiceSettingsPanel } from '../VoiceSettingsPanel';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsPlaceholder } from './SettingsPlaceholder';
import { SETTINGS_SECTIONS } from './settings-nav-config';

interface SettingsContentProps {
  section: string;
}

const OPS_TABS = [
  { id: 'observability', label: '观测', render: () => <HubObservabilityTab /> },
  { id: 'tool-usage', label: '工具', render: () => <HubToolUsageTab /> },
  { id: 'commands', label: '命令', render: () => <HubCommandsTab /> },
  { id: 'governance', label: '治理', render: () => <HubGovernanceTab /> },
  { id: 'routing', label: '路由', render: () => <HubRoutingPolicyTab /> },
  { id: 'leaderboard', label: '排行', render: () => <HubLeaderboardTab /> },
  { id: 'rescue', label: '救援', render: () => <HubClaudeRescueSection /> },
] as const;

function OpsPanel() {
  const [active, setActive] = useState<(typeof OPS_TABS)[number]['id']>('observability');
  const tab = OPS_TABS.find((item) => item.id === active) ?? OPS_TABS[0];

  return (
    <div className="space-y-4">
      <div className="console-segmented flex-wrap" role="tablist" aria-label="运维监控分区">
        {OPS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="console-segmented-button"
            data-active={item.id === active ? 'true' : 'false'}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab.render()}
    </div>
  );
}

function MembersPanel() {
  const { cats } = useCatData();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/config');
      if (!res.ok) {
        setError(`配置加载失败 (${res.status})`);
        return;
      }
      const payload = (await res.json()) as { config: ConfigData };
      setConfig(payload.config);
    } catch {
      setError('配置加载失败');
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (error) return <p className="text-sm text-[var(--semantic-error-text)]">{error}</p>;
  if (!config) return <p className="text-sm text-cafe-muted">加载中...</p>;
  return <CatOverviewTab config={config} cats={cats} />;
}

export function SettingsContent({ section }: SettingsContentProps) {
  const meta = SETTINGS_SECTIONS.find((item) => item.id === section) ?? SETTINGS_SECTIONS[0];

  const content = (() => {
    switch (meta.id) {
      case 'members':
        return <MembersPanel />;
      case 'accounts':
        return <HubAccountsTab />;
      case 'im':
        return <HubConnectorConfigTab />;
      case 'skills':
        return <HubSkillsTab />;
      case 'voice':
        return <VoiceSettingsPanel />;
      case 'system':
        return <HubEnvFilesTab />;
      case 'notify':
        return <PushSettingsPanel />;
      case 'ops':
        return <OpsPanel />;
      case 'rules':
        return (
          <div className="space-y-5">
            <HubGovernanceTab />
            <BrakeSettingsPanel />
          </div>
        );
      case 'mcp':
      case 'plugins':
      case 'marketplace':
        return <SettingsPlaceholder section={meta.label} description="此分区需要后续 manual-port 接入服务接口" />;
      default:
        return <SettingsPlaceholder section={meta.label} description="此分区即将上线" />;
    }
  })();

  return (
    <>
      <SettingsPageHeader title={meta.label} subtitle={meta.description} />
      {content}
    </>
  );
}
