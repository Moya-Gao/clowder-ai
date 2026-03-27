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
          return { run: false, reason: 'template not yet activated' };
        },
      },
      run: {
        overlap: 'skip',
        timeoutMs: 30_000,
        async execute(_signal, _subjectKey, _ctx) {
          // Phase 3A MVP: log the reminder; actual thread posting wired in integration
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
