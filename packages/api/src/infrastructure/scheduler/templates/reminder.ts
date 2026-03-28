import type { TaskSpec_P1 } from '../types.js';
import type { DynamicTaskParams, TaskTemplate } from './types.js';

/** Reminder template — fires on schedule, posts a message to the delivery thread */
export const reminderTemplate: TaskTemplate = {
  templateId: 'reminder',
  label: '定时提醒',
  category: 'system',
  description: '按设定时间发送提醒消息到指定对话',
  subjectKind: 'none',
  defaultTrigger: { type: 'cron', expression: '0 9 * * *' },
  paramSchema: {
    message: { type: 'string', required: true, description: '提醒内容' },
  },
  createSpec(instanceId: string, p: DynamicTaskParams): TaskSpec_P1 {
    const message = (p.params.message as string) || '定时提醒';
    const threadId = p.deliveryThreadId;
    return {
      id: instanceId,
      profile: 'awareness',
      trigger: p.trigger,
      admission: {
        async gate() {
          if (!threadId) return { run: false, reason: 'no deliveryThreadId' };
          return { run: true, workItems: [{ signal: message, subjectKey: `thread-${threadId}` }] };
        },
      },
      run: {
        overlap: 'skip',
        timeoutMs: 30_000,
        async execute(_signal, subjectKey, ctx) {
          if (!ctx.deliver) throw new Error('deliver not available');
          const tid = subjectKey.startsWith('thread-') ? subjectKey.slice(7) : subjectKey;
          await ctx.deliver({
            threadId: tid,
            content: message,
            catId: ctx.assignedCatId ?? 'system',
            userId: 'scheduler',
          });
        },
      },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
      display: {
        label: message.slice(0, 30),
        category: 'system',
        description: message,
        subjectKind: 'none',
      },
    };
  },
};
