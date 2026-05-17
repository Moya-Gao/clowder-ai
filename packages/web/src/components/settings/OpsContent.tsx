'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrakeSettingsPanel } from '../BrakeSettingsPanel';
import { HubAgentSessionsTab } from '../HubAgentSessionsTab';
import { HubClaudeRescueSection } from '../HubClaudeRescueSection';
import { HubCommandsTab } from '../HubCommandsTab';
import { HubGovernanceTab } from '../HubGovernanceTab';
import { HubLeaderboardTab } from '../HubLeaderboardTab';
import { HubObservabilityTab } from '../HubObservabilityTab';
import { HubRoutingPolicyTab } from '../HubRoutingPolicyTab';
import { HubToolUsageTab } from '../HubToolUsageTab';
import { DEFAULT_OPS_SUBSECTION, OPS_SUBSECTIONS } from './ops-nav-config';

export function OpsContent() {
  const searchParams = useSearchParams();
  const opsParam = searchParams.get('ops');
  const obsRaw = searchParams.get('obs');
  const OBS_VALID: ReadonlySet<string> = new Set(['overview', 'traces', 'health', 'callback-auth']);
  const obsParam =
    obsRaw && OBS_VALID.has(obsRaw) ? (obsRaw as 'overview' | 'traces' | 'health' | 'callback-auth') : null;
  const validOpsParam = opsParam && OPS_SUBSECTIONS.some((s) => s.id === opsParam) ? opsParam : null;
  const [activeTab, setActiveTab] = useState(validOpsParam ?? DEFAULT_OPS_SUBSECTION);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (validOpsParam) {
      setActiveTab(validOpsParam);
      setNonce((n) => n + 1);
    }
  }, [validOpsParam]);

  return (
    <div>
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {OPS_SUBSECTIONS.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setActiveTab(sub.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === sub.id
                ? 'bg-cafe-accent text-[var(--cafe-surface)]'
                : 'console-pill text-cafe-secondary hover:text-cafe'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>
      <OpsSubsectionContent subsection={activeTab} obsSubTab={obsParam} nonce={nonce} />
    </div>
  );
}

function OpsSubsectionContent({
  subsection,
  obsSubTab,
  nonce,
}: {
  subsection: string;
  obsSubTab?: 'overview' | 'traces' | 'health' | 'callback-auth' | null;
  nonce: number;
}) {
  switch (subsection) {
    case 'usage':
      return (
        <div className="space-y-6">
          <HubRoutingPolicyTab />
          <HubToolUsageTab />
        </div>
      );
    case 'leaderboard':
      return <HubLeaderboardTab />;
    case 'observability':
      return <HubObservabilityTab initialSubTab={obsSubTab ?? undefined} subTabNonce={nonce} />;
    case 'agent-sessions':
      return <HubAgentSessionsTab />;
    case 'health':
      return (
        <div className="space-y-6">
          <HubGovernanceTab />
          <BrakeSettingsPanel />
        </div>
      );
    case 'commands':
      return <HubCommandsTab />;
    case 'rescue':
      return <HubClaudeRescueSection />;
    default:
      return null;
  }
}
