import type { TaskSpec_P1 } from '../types.js';
import type { DynamicTaskParams, TaskTemplate } from './types.js';

/** Web digest template — periodically fetch a URL and summarize new content */
export const webDigestTemplate: TaskTemplate = {
  templateId: 'web-digest',
  label: '网页摘要',
  category: 'external',
  description: '定期抓取网页内容并生成摘要',
  subjectKind: 'external',
  defaultTrigger: { type: 'cron', expression: '0 9 * * *' },
  paramSchema: {
    url: { type: 'string', required: true, description: '目标网页 URL' },
    topic: { type: 'string', required: false, description: '关注的主题关键词' },
  },
  createSpec(instanceId: string, p: DynamicTaskParams): TaskSpec_P1 {
    const url = (p.params.url as string) || '';
    const topic = (p.params.topic as string) || '';
    return {
      id: instanceId,
      profile: 'awareness',
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
        label: topic ? `${topic} 摘要` : '网页摘要',
        category: 'external',
        description: `定期摘要: ${url}`,
        subjectKind: 'external',
      },
    };
  },
};
