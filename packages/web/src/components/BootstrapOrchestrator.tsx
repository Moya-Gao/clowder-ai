import { useEffect, useRef, useState } from 'react';
import type { BootstrapProgress, IndexState, ProjectSummary } from '@/hooks/useIndexState';
import { BootstrapProgressPill } from './BootstrapProgressPill';
import { BootstrapPromptCard } from './BootstrapPromptCard';
import { BootstrapSummaryCard } from './BootstrapSummaryCard';

interface BootstrapOrchestratorProps {
  projectPath: string;
  indexState: IndexState;
  isSnoozed: boolean;
  progress: BootstrapProgress | null;
  summary: ProjectSummary | null;
  isNewProject?: boolean;
  governanceDone?: boolean;
  onStartBootstrap: () => void;
  onSnooze: () => void;
}

export function BootstrapOrchestrator({
  projectPath,
  indexState,
  isSnoozed,
  progress,
  summary,
  isNewProject,
  governanceDone,
  onStartBootstrap,
  onSnooze,
}: BootstrapOrchestratorProps) {
  const [dismissed, setDismissed] = useState(false);
  const autoStartedRef = useRef(false);

  // AC-B9: Auto-start bootstrap for new projects after governance completes
  useEffect(() => {
    if (isNewProject && governanceDone && indexState.status === 'missing' && !isSnoozed && !autoStartedRef.current) {
      autoStartedRef.current = true;
      onStartBootstrap();
    }
  }, [isNewProject, governanceDone, indexState.status, isSnoozed, onStartBootstrap]);

  if (dismissed) return null;

  if (indexState.status === 'building' && progress) {
    return <BootstrapProgressPill progress={progress} />;
  }

  if (indexState.status === 'ready' && summary) {
    return (
      <BootstrapSummaryCard
        summary={summary}
        docsIndexed={indexState.docs_indexed}
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  if (indexState.status === 'missing' || indexState.status === 'stale' || indexState.status === 'failed') {
    if (isNewProject && governanceDone) return null; // auto-start handled above, will transition to building
    return (
      <BootstrapPromptCard
        indexState={indexState}
        isSnoozed={isSnoozed}
        projectPath={projectPath}
        onStartScan={onStartBootstrap}
        onSnooze={onSnooze}
      />
    );
  }

  return null;
}
