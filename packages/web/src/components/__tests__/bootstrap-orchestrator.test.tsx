import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BootstrapProgress, IndexState, ProjectSummary } from '@/hooks/useIndexState';
import { BootstrapOrchestrator } from '../BootstrapOrchestrator';

Object.assign(globalThis as Record<string, unknown>, { React });

const missingState: IndexState = {
  status: 'missing',
  fingerprint: '',
  docs_indexed: 0,
  docs_total: 0,
  error_message: null,
  summary_json: null,
  snoozed_until: null,
  last_scan_at: null,
};

const buildingState: IndexState = { ...missingState, status: 'building' };
const readyState: IndexState = { ...missingState, status: 'ready', docs_indexed: 42 };

const mockProgress: BootstrapProgress = {
  phase: 'scanning',
  phaseIndex: 0,
  totalPhases: 4,
  docsProcessed: 0,
  docsTotal: 0,
  elapsedMs: 500,
};

const mockSummary: ProjectSummary = {
  projectName: 'test',
  techStack: ['node'],
  dirStructure: ['src'],
  coreModules: [],
  docsList: [{ path: 'README.md', tier: 'authoritative' }],
  tierCoverage: { authoritative: 1 },
};

describe('BootstrapOrchestrator', () => {
  const noop = () => {};

  it('shows PromptCard when index missing and not new project', () => {
    const html = renderToStaticMarkup(
      <BootstrapOrchestrator
        projectPath="/tmp/foo"
        indexState={missingState}
        isSnoozed={false}
        progress={null}
        summary={null}
        onStartBootstrap={noop}
        onSnooze={noop}
      />,
    );
    expect(html).toContain('bootstrap-prompt-card');
    expect(html).toContain('这个项目还没有记忆索引');
  });

  it('shows ProgressPill when building', () => {
    const html = renderToStaticMarkup(
      <BootstrapOrchestrator
        projectPath="/tmp/foo"
        indexState={buildingState}
        isSnoozed={false}
        progress={mockProgress}
        summary={null}
        onStartBootstrap={noop}
        onSnooze={noop}
      />,
    );
    expect(html).toContain('bootstrap-progress-pill');
    expect(html).toContain('建立记忆索引…');
  });

  it('shows SummaryCard when ready', () => {
    const html = renderToStaticMarkup(
      <BootstrapOrchestrator
        projectPath="/tmp/foo"
        indexState={readyState}
        isSnoozed={false}
        progress={null}
        summary={mockSummary}
        onStartBootstrap={noop}
        onSnooze={noop}
      />,
    );
    expect(html).toContain('bootstrap-summary-card');
    expect(html).toContain('记忆索引就绪');
  });

  it('renders nothing when snoozed and missing', () => {
    const html = renderToStaticMarkup(
      <BootstrapOrchestrator
        projectPath="/tmp/foo"
        indexState={missingState}
        isSnoozed={true}
        progress={null}
        summary={null}
        onStartBootstrap={noop}
        onSnooze={noop}
      />,
    );
    expect(html).toBe('');
  });

  it('renders nothing for new project with governance done (auto-start handled via effect)', () => {
    const html = renderToStaticMarkup(
      <BootstrapOrchestrator
        projectPath="/tmp/foo"
        indexState={missingState}
        isSnoozed={false}
        progress={null}
        summary={null}
        isNewProject
        governanceDone
        onStartBootstrap={noop}
        onSnooze={noop}
      />,
    );
    expect(html).toBe('');
  });
});
