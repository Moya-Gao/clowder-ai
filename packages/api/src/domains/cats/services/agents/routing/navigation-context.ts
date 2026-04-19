export interface BatonContext {
  fromMessageId: string;
  fromSpeaker: string;
  fromSpeakerDisplay: string;
  timestamp: number;
  mentionExcerpt: string;
  staleHoldWarning: boolean;
}

const HOLD_PATTERNS = /别动|你.*等|不要.*动|等等|稍等|\bhold\b|\bwait\b/i;

export function extractBatonContext(
  messages: Array<{
    id: string;
    catId: string | null;
    content: string;
    timestamp: number;
    userId: string;
    origin?: string;
    mentions?: readonly string[];
  }>,
  targetCatId: string,
): BatonContext | null {
  const mentionPattern = new RegExp(`@${targetCatId}\\b`);

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const mentioned =
      m.mentions && m.mentions.length > 0 ? m.mentions.includes(targetCatId) : mentionPattern.test(m.content);
    if (!mentioned) continue;

    const fromSpeaker = m.catId ?? 'user';

    let staleHoldWarning = false;
    for (let j = i - 1; j >= 0; j--) {
      const prev = messages[j];
      if (prev.origin === 'stream') continue;
      const prevSpeaker = prev.catId ?? 'user';
      if (prevSpeaker !== fromSpeaker) continue;
      if (HOLD_PATTERNS.test(prev.content)) {
        staleHoldWarning = true;
      }
      break;
    }

    const excerpt = m.origin === 'stream' ? '' : m.content.split('\n')[0].replace(mentionPattern, '').trim();

    return {
      fromMessageId: m.id,
      fromSpeaker,
      fromSpeakerDisplay: m.catId ?? m.userId,
      timestamp: m.timestamp,
      mentionExcerpt: excerpt,
      staleHoldWarning,
    };
  }
  return null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  ownerCatId: string | null;
}

export function summarizeActiveTasks(
  tasks: Array<{ id: string; title: string; status: string; ownerCatId: string | null; updatedAt: number }>,
): TaskSummary[] {
  return tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
    .map(({ id, title, status, ownerCatId }) => ({ id, title, status, ownerCatId }));
}

export interface NavigationContext {
  baton: BatonContext | null;
  tasks: TaskSummary[];
}

export function formatNavigationHeader(ctx: NavigationContext): string {
  const lines: string[] = ['[导航]'];

  if (ctx.baton) {
    const timeStr = new Date(ctx.baton.timestamp).toISOString().slice(11, 16);
    lines.push(`传球: ${ctx.baton.fromSpeakerDisplay} → 你 (${timeStr})`);
    if (ctx.baton.mentionExcerpt) {
      lines.push(`原文: "${ctx.baton.mentionExcerpt}"`);
    }
    if (ctx.baton.staleHoldWarning) {
      lines.push(`⚠️ ${ctx.baton.fromSpeakerDisplay} 之前说过"别动/等等"，但已传球给你——以传球为准`);
    }
  }

  if (ctx.tasks.length > 0) {
    lines.push('活跃毛线球:');
    for (const t of ctx.tasks) {
      const owner = t.ownerCatId ? `@${t.ownerCatId}` : '未分配';
      lines.push(`  - [${t.status}] ${t.title} (${owner})`);
    }
  }

  lines.push('[/导航]');
  return lines.join('\n');
}
