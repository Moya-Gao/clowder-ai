/**
 * F098: Parse direction info from a chat message for display as a pill badge.
 * Priority: whisper > crossPost > @mention in content.
 */

export interface DirectionInfo {
  type: 'mention' | 'crossPost' | 'whisper';
  targets: string[];
  arrow: '→' | '↗';
}

interface MessageLike {
  origin?: 'stream' | 'callback';
  content: string;
  visibility?: 'public' | 'whisper';
  whisperTo?: string[];
  extra?: { crossPost?: { sourceThreadId: string } };
}

interface MentionData {
  toCat: Record<string, string>;
  re: RegExp;
}

export function parseDirection(message: MessageLike, getMentionData: () => MentionData): DirectionInfo | null {
  // Whisper — highest priority, has explicit targets
  if (message.visibility === 'whisper' && message.whisperTo?.length) {
    return { type: 'whisper', targets: message.whisperTo, arrow: '→' };
  }

  // CrossPost — has source thread metadata
  if (message.extra?.crossPost?.sourceThreadId) {
    const shortId = message.extra.crossPost.sourceThreadId.replace(/^thread_/, '').slice(0, 8);
    return { type: 'crossPost', targets: [shortId], arrow: '↗' };
  }

  // Stream messages don't need direction (catId in header is enough)
  if (message.origin === 'stream') return null;

  // Only parse @mentions for callback messages
  if (message.origin !== 'callback') return null;

  const { toCat, re } = getMentionData();
  const found = new Set<string>();
  re.lastIndex = 0;
  for (let match = re.exec(message.content); match !== null; match = re.exec(message.content)) {
    const alias = match[1].toLowerCase();
    const catId = toCat[alias];
    if (catId && catId !== '__owner__') found.add(catId);
  }

  if (found.size > 0) {
    return { type: 'mention', targets: [...found], arrow: '→' };
  }

  return null;
}
