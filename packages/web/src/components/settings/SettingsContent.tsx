'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCatData } from '@/hooks/useCatData';
import { apiFetch } from '@/utils/api-client';
import { BrakeSettingsPanel } from '../BrakeSettingsPanel';
import { CatOverviewTab, type ConfigData } from '../config-viewer-tabs';
import { HubAccountsTab } from '../HubAccountsTab';
import { HubConnectorConfigTab } from '../HubConnectorConfigTab';
import { HubEnvFilesTab } from '../HubEnvFilesTab';
import { HubGovernanceTab } from '../HubGovernanceTab';
import { HubSkillsTab } from '../HubSkillsTab';
import { PushSettingsPanel } from '../PushSettingsPanel';
import { VoiceSettingsPanel } from '../VoiceSettingsPanel';
import { MarketplaceContent } from './MarketplaceContent';
import { McpManageContent } from './McpManageContent';
import { OpsContent } from './OpsContent';
import { PluginsContent } from './PluginsContent';
import { RulesPromptsContent } from './RulesPromptsContent';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsPlaceholder } from './SettingsPlaceholder';
import { SETTINGS_SECTIONS } from './settings-nav-config';

interface SettingsContentProps {
  section: string;
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
  if (section === 'marketplace') return <MarketplaceContent />;

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
        return <OpsContent />;
      case 'rules':
        return (
          <div className="space-y-5">
            <RulesPromptsContent />
            <HubGovernanceTab />
            <BrakeSettingsPanel />
          </div>
        );
      case 'mcp':
        return <McpManageContent />;
      case 'plugins':
        return <PluginsContent />;
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
