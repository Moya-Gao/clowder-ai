import type { TaskProgressItem } from '@/stores/chat-types';
import type {
  BackgroundAgentMessage,
  BackgroundStreamRef,
  HandleBackgroundMessageOptions,
} from './useSocket-background.types';

interface SystemInfoConsumeResult {
  consumed: boolean;
  content: string;
  variant: 'info' | 'a2a_followup';
}

export function consumeBackgroundSystemInfo(
  msg: BackgroundAgentMessage,
  existingRef: BackgroundStreamRef | undefined,
  options: HandleBackgroundMessageOptions,
): SystemInfoConsumeResult {
  let sysContent = msg.content ?? '';
  let sysVariant: 'info' | 'a2a_followup' = 'info';
  let consumed = false;

  try {
    const parsed = JSON.parse(sysContent);
    if (parsed?.type === 'invocation_metrics') {
      if (parsed.kind === 'session_started') {
        options.store.setThreadCatInvocation(msg.threadId, msg.catId, {
          sessionId: parsed.sessionId,
          invocationId: parsed.invocationId,
          startedAt: Date.now(),
          taskProgress: { tasks: [], lastUpdate: 0 },
          ...(parsed.sessionSeq !== undefined ? { sessionSeq: parsed.sessionSeq, sessionSealed: false } : {}),
        });
      } else if (parsed.kind === 'invocation_complete') {
        options.store.setThreadCatInvocation(msg.threadId, msg.catId, {
          durationMs: parsed.durationMs,
          sessionId: parsed.sessionId,
        });
      }
      consumed = true;
    } else if (parsed?.type === 'invocation_usage') {
      options.store.setThreadCatInvocation(msg.threadId, msg.catId, {
        usage: parsed.usage,
      });
      if (existingRef?.id) {
        options.store.setThreadMessageUsage(msg.threadId, existingRef.id, parsed.usage);
      }
      consumed = true;
    } else if (parsed?.type === 'context_health') {
      const targetCatId = parsed.catId ?? msg.catId;
      options.store.setThreadCatInvocation(msg.threadId, targetCatId, {
        contextHealth: parsed.health,
      });
      consumed = true;
    } else if (parsed?.type === 'task_progress') {
      const targetCatId = parsed.catId ?? msg.catId;
      const tasks = (parsed.tasks ?? []) as TaskProgressItem[];
      options.store.setThreadCatInvocation(msg.threadId, targetCatId, {
        taskProgress: {
          tasks,
          lastUpdate: Date.now(),
        },
      });
      consumed = true;
    } else if (parsed?.type === 'session_seal_requested') {
      if (parsed.catId) {
        options.store.setThreadCatInvocation(msg.threadId, parsed.catId, {
          sessionSeq: parsed.sessionSeq,
          sessionSealed: true,
        });
        const pct = parsed.healthSnapshot?.fillRatio ? Math.round(parsed.healthSnapshot.fillRatio * 100) : '?';
        sysContent = `${parsed.catId} 的会话 #${parsed.sessionSeq} 已封存（上下文 ${pct}%），下次调用将自动创建新会话`;
      }
    } else if (parsed?.type === 'a2a_followup_available') {
      const mentions = parsed.mentions as Array<{ catId: string; mentionedBy: string }>;
      if (Array.isArray(mentions) && mentions.length > 0) {
        sysContent = mentions.map((m) => `${m.mentionedBy} @了 ${m.catId}`).join('、');
        sysVariant = 'a2a_followup';
      }
    } else if (parsed?.type === 'mode_switch_proposal') {
      const by = parsed.proposedBy ?? '猫猫';
      sysContent = `${by} 提议切换到 ${parsed.proposedMode} 模式。`;
    } else if (parsed?.type === 'thinking') {
      // F045: Embed thinking into the assistant bubble (matches foreground path)
      const thinkingText = parsed.text ?? '';
      if (thinkingText) {
        let targetId = existingRef?.id;
        if (!targetId) {
          // Thinking arrived before any text/tool chunk — create placeholder assistant bubble
          const streamKey = `${msg.threadId}::${msg.catId}`;
          targetId = `bg-think-${Date.now()}-${msg.catId}-${options.nextBgSeq()}`;
          options.bgStreamRefs.set(streamKey, { id: targetId, threadId: msg.threadId, catId: msg.catId });
          options.store.addMessageToThread(msg.threadId, {
            id: targetId,
            type: 'assistant',
            catId: msg.catId,
            content: '',
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            timestamp: msg.timestamp,
            isStreaming: true,
            origin: 'stream',
          });
        }
        options.store.setThreadMessageThinking(msg.threadId, targetId, thinkingText);
      }
      consumed = true;
    }
  } catch {
    // Not JSON; keep original content as user-facing system info.
  }

  return { consumed, content: sysContent, variant: sysVariant };
}
