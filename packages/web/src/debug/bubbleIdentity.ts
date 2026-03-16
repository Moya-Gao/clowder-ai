import type { ChatMessage } from '@/stores/chat-types';

export function getBubbleInvocationId(msg: ChatMessage): string | undefined {
  if (msg.extra?.stream?.invocationId) return msg.extra.stream.invocationId;
  if (msg.id.startsWith('draft-')) return msg.id.slice('draft-'.length);
  return undefined;
}

export function getBubbleIdentityKey(msg: ChatMessage): string | undefined {
  if (msg.type !== 'assistant' || !msg.catId) return undefined;
  const invocationId = getBubbleInvocationId(msg);
  if (!invocationId) return undefined;
  return `${msg.catId}:${invocationId}:text`;
}

export function shouldForceReplaceHydrationForCachedMessages(messages: ChatMessage[]): boolean {
  const seenIdentityKeys = new Set<string>();
  for (const msg of messages) {
    if (msg.type !== 'assistant') continue;

    // Draft/streaming bubbles are local runtime state, not authoritative history.
    if (msg.isStreaming || msg.id.startsWith('draft-')) return true;

    const identityKey = getBubbleIdentityKey(msg);
    if (!identityKey) continue;
    if (seenIdentityKeys.has(identityKey)) return true;
    seenIdentityKeys.add(identityKey);
  }
  return false;
}
