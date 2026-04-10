import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BootstrapProgress, IndexState, ProjectSummary } from '@/hooks/useIndexState';
import { BootstrapProgressPill } from '../BootstrapProgressPill';
import { BootstrapPromptCard } from '../BootstrapPromptCard';
import { BootstrapSummaryCard } from '../BootstrapSummaryCard';

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

const failedState: IndexState = {
  ...missingState,
  status: 'failed',
  error_message: 'disk full',
};

const readyState: IndexState = {
  ...missingState,
  status: 'ready',
  docs_indexed: 42,
};

const staleState: IndexState = {
  ...missingState,
  status: 'stale',
};

const mockSummary: ProjectSummary = {
  projectName: 'test-project',
  techStack: ['node', 'typescript'],
  dirStructure: ['src', 'docs', 'packages'],
  coreModules: ['api', 'web', 'shared'],
  docsList: [
    { path: 'docs/README.md', tier: 'authoritative' },
    { path: 'docs/ARCH.md', tier: 'derived' },
  ],
  tierCoverage: { authoritative: 1, derived: 1 },
};

const scanningProgress: BootstrapProgress = {
  phase: 'scanning',
  phaseIndex: 0,
  totalPhases: 4,
  docsProcessed: 0,
  docsTotal: 0,
  elapsedMs: 500,
};

const extractingProgress: BootstrapProgress = {
  phase: 'extracting',
  phaseIndex: 1,
  totalPhases: 4,
  docsProcessed: 5,
  docsTotal: 20,
  elapsedMs: 1500,
};

describe('BootstrapPromptCard', () => {
  it('renders prompt when index state is missing', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={missingState}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toContain('这个项目还没有记忆索引');
    expect(html).toContain('开始扫描');
    expect(html).toContain('稍后再说');
    expect(html).toContain('bootstrap-prompt-card');
  });

  it('renders retry message when failed', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={failedState}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toContain('记忆索引构建失败');
    expect(html).toContain('disk full');
    expect(html).toContain('重试扫描');
  });

  it('renders update message when stale', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={staleState}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toContain('记忆索引已过期');
    expect(html).toContain('更新索引');
  });

  it('renders nothing when snoozed', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={missingState}
        isSnoozed={true}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders nothing when ready', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={readyState}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders nothing when building', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={{ ...missingState, status: 'building' }}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('shows project directory name', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={missingState}
        isSnoozed={false}
        projectPath="/home/user/my-project"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toContain('my-project');
  });

  it('uses cocreator color classes', () => {
    const html = renderToStaticMarkup(
      <BootstrapPromptCard
        indexState={missingState}
        isSnoozed={false}
        projectPath="/tmp/foo"
        onStartScan={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(html).toContain('cocreator-primary');
    expect(html).toContain('cocreator-bg');
  });
});

describe('BootstrapProgressPill', () => {
  it('renders collapsed pill with percentage', () => {
    const html = renderToStaticMarkup(<BootstrapProgressPill progress={scanningProgress} />);
    expect(html).toContain('建立记忆索引…');
    expect(html).toContain('bootstrap-progress-pill');
    expect(html).not.toContain('扫描文件');
  });

  it('renders expanded view with phase list', () => {
    const html = renderToStaticMarkup(<BootstrapProgressPill progress={extractingProgress} expanded />);
    expect(html).toContain('扫描文件');
    expect(html).toContain('提取结构');
    expect(html).toContain('建立索引');
    expect(html).toContain('生成摘要');
  });

  it('shows done checkmark for completed phases', () => {
    const html = renderToStaticMarkup(<BootstrapProgressPill progress={extractingProgress} expanded />);
    expect(html).toContain('✓');
  });

  it('shows doc progress when available', () => {
    const html = renderToStaticMarkup(<BootstrapProgressPill progress={extractingProgress} expanded />);
    expect(html).toContain('5 / 20 文档');
  });

  it('uses cocreator colors', () => {
    const html = renderToStaticMarkup(<BootstrapProgressPill progress={scanningProgress} />);
    expect(html).toContain('cocreator-primary');
  });
});

describe('BootstrapSummaryCard', () => {
  it('renders summary with project name and doc count', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={42} />);
    expect(html).toContain('记忆索引就绪');
    expect(html).toContain('test-project');
    expect(html).toContain('42 份文档');
    expect(html).toContain('bootstrap-summary-card');
  });

  it('shows tech stack badges', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={10} />);
    expect(html).toContain('node');
    expect(html).toContain('typescript');
  });

  it('shows directory structure', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={10} />);
    expect(html).toContain('src');
    expect(html).toContain('docs');
    expect(html).toContain('packages');
  });

  it('shows tier coverage', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={10} />);
    expect(html).toContain('权威');
    expect(html).toContain('推导');
  });

  it('shows core modules', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={10} />);
    expect(html).toContain('api, web, shared');
  });

  it('shows duration when provided', () => {
    const html = renderToStaticMarkup(
      <BootstrapSummaryCard summary={mockSummary} docsIndexed={10} durationMs={2500} />,
    );
    expect(html).toContain('2.5s');
  });

  it('renders dismiss button when onDismiss provided', () => {
    const html = renderToStaticMarkup(
      <BootstrapSummaryCard summary={mockSummary} docsIndexed={10} onDismiss={() => {}} />,
    );
    expect(html).toContain('✕');
  });

  it('uses cocreator color for tech badges', () => {
    const html = renderToStaticMarkup(<BootstrapSummaryCard summary={mockSummary} docsIndexed={10} />);
    expect(html).toContain('cocreator-primary');
  });
});
