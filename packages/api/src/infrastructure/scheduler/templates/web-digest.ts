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
    const threadId = p.deliveryThreadId;
    return {
      id: instanceId,
      profile: 'awareness',
      trigger: p.trigger,
      admission: {
        async gate() {
          if (!url) return { run: false, reason: 'no url param' };
          if (!threadId) return { run: false, reason: 'no deliveryThreadId' };
          return { run: true, workItems: [{ signal: null, subjectKey: `thread-${threadId}` }] };
        },
      },
      run: {
        overlap: 'skip',
        timeoutMs: 60_000,
        async execute(_signal, subjectKey, ctx) {
          if (!ctx.fetchContent) throw new Error('fetchContent not available');
          if (!ctx.deliver) throw new Error('deliver not available');
          const tid = subjectKey.startsWith('thread-') ? subjectKey.slice(7) : subjectKey;
          const result = await ctx.fetchContent(url);
          if (result.method === 'browser') {
            throw new Error(
              `Browser rendering required for ${url} — server-side fetch not supported for this site type`,
            );
          }
          const header = result.title || url;
          const topicLine = topic ? `\n**Topic:** ${topic}` : '';
          const truncNote = result.truncated ? '\n_[content truncated]_' : '';
          const content = `## ${header}${topicLine}\n\n${result.text}${truncNote}`;
          await ctx.deliver({
            threadId: tid,
            content,
            catId: ctx.assignedCatId ?? 'system',
            userId: 'scheduler',
          });
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
