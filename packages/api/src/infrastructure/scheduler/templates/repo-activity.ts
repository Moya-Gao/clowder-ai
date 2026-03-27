import type { TaskSpec_P1 } from '../types.js';
import type { DynamicTaskParams, TaskTemplate } from './types.js';

/** Repo activity template — watch a GitHub repo for new issues/PRs */
export const repoActivityTemplate: TaskTemplate = {
  templateId: 'repo-activity',
  label: '仓库动态',
  category: 'repo',
  description: '监控 GitHub 仓库的新 Issue 和 PR',
  subjectKind: 'repo',
  defaultTrigger: { type: 'interval', ms: 3600_000 },
  paramSchema: {
    repo: { type: 'string', required: true, description: 'GitHub 仓库全名 (owner/repo)' },
  },
  createSpec(instanceId: string, p: DynamicTaskParams): TaskSpec_P1 {
    const repo = (p.params.repo as string) || '';
    return {
      id: instanceId,
      profile: 'poller',
      trigger: p.trigger,
      admission: {
        async gate() {
          // Stub template: gate skip until execute is implemented (P1-3)
          return { run: false, reason: 'template not yet activated' };
        },
      },
      run: {
        overlap: 'skip',
        timeoutMs: 60_000,
        async execute(_signal, _subjectKey, _ctx) {
          // Not yet implemented — gate skips execution
        },
      },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
      display: {
        label: repo ? `${repo} 动态` : '仓库动态',
        category: 'repo',
        description: `监控 ${repo} 的新 Issue/PR`,
        subjectKind: 'repo',
      },
    };
  },
};
