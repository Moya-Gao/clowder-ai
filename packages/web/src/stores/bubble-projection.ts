/**
 * F194 Phase Z8 — Unified Canonical Bubble Projection
 *
 * Pure function: raw assistant records → canonical UI bubbles.
 * Same projection rule used by:
 *   - live reducer (each event → re-project the cat's raw record buffer)
 *   - hydrate (`mergeReplaceHydrationMessages` → project history records)
 *
 * Contract (KD-27, AC-Z20):
 *   - Group by `(catId, getBubbleInvocationId(msg))` — same key as the legacy
 *     hydrate `streamKey`. Records without catId or invocation key are passed
 *     through unchanged (system / user / un-namespaced bubbles).
 *   - Within a group, records are sorted by `timestamp asc` then `id asc` for
 *     determinism. The *first* (earliest) record's id becomes the canonical
 *     bubble id, but a callback record (origin === 'callback') wins the id if
 *     present — callbacks are the cat's own finalize step and their ids are
 *     server-canonical.
 *   - Content: concat non-empty `content` fragments by ts asc, separated by
 *     '\n\n'. Empty fragments skipped to avoid leading separators.
 *   - toolEvents: dedupe by `event.id`, ordered by record ts then event ts.
 *   - rich blocks (`extra.rich.blocks`): dedupe by `block.id`, preserve order
 *     (first occurrence wins).
 *   - thinking: concat non-empty `thinking` fragments by ts asc, separated by
 *     '\n\n'.
 *   - isStreaming: callback/terminal-aware (砚砚 R1 P1)。优先级：(1) 任一 record
 *     是 callback origin → false (callback 是 cat 自己 finalize，认 done); (2) 否则
 *     按 ts asc 取最后一个 record 的显式 isStreaming 值；(3) 没有显式值 → false。
 *     **不能用 ANY=true** — 旧 stream record 残留 isStreaming=true + 后到 callback
 *     final 时，ANY 会把投影 bubble 当成仍 streaming，复活我们要杀的 live 残留。
 *   - origin: 'callback' if any record has callback origin; else 'stream'.
 *   - timestamp: earliest record ts (for stable sort).
 *
 * Why this contract: the alpha thread `thread_moyfjyjc0662weit` opus
 * invocation `2fe279aa` persists 3 raw records (2 stream + 1 callback) with
 * 3 distinct content segments sharing the same invocationId. F5 hydrate
 * "看起来" 收敛成 1 bubble; live reducer creates 3 bubbles. Z8 makes both
 * paths use this single projection so live ≡ hydrate.
 */

import { getBubbleInvocationId } from '@/debug/bubbleIdentity';
import type { ChatMessage } from './chat-types';

interface ProjectionInput {
  /** Raw assistant records to project. May include system/user msgs which
   *  are passed through unchanged. */
  records: ChatMessage[];
}

interface ProjectionOutput {
  /** Canonical bubbles ordered by earliest timestamp asc. */
  messages: ChatMessage[];
}

interface GroupKey {
  catId: string;
  invocationId: string;
}

function bubbleGroupKey(msg: ChatMessage): GroupKey | null {
  if (msg.type !== 'assistant') return null;
  if (!msg.catId) return null;
  const inv = getBubbleInvocationId(msg as ChatMessage);
  if (!inv) return null;
  return { catId: msg.catId, invocationId: inv };
}

function compareRecords(a: ChatMessage, b: ChatMessage): number {
  const at = a.timestamp ?? 0;
  const bt = b.timestamp ?? 0;
  if (at !== bt) return at - bt;
  return (a.id ?? '').localeCompare(b.id ?? '');
}

function projectGroup(records: ChatMessage[]): ChatMessage {
  const sorted = records.slice().sort(compareRecords);
  const first = sorted[0]!;

  const callbackRecord = sorted.find((r) => r.origin === 'callback');
  const canonicalId = callbackRecord?.id ?? first.id;
  const origin: ChatMessage['origin'] = callbackRecord ? 'callback' : (first.origin ?? 'stream');

  const contentParts: string[] = [];
  // F194 Phase Z11 (铲屎官 R15): split content by origin so the merged
  // (callback-origin) bubble can still surface the stream working log in the
  // CLI Output block. cliStdout/speechContent are only emitted when the group
  // has BOTH stream and callback records (the merge case); pure groups leave
  // them undefined so existing rendering is unchanged.
  const streamContentParts: string[] = [];
  const callbackContentParts: string[] = [];
  const thinkingParts: string[] = [];
  const seenToolIds = new Set<string>();
  const toolEvents: NonNullable<ChatMessage['toolEvents']> = [];
  const seenBlockIds = new Set<string>();
  const richBlocks: NonNullable<NonNullable<ChatMessage['extra']>['rich']>['blocks'] = [];
  // cloud R2 P2 (codex): merge contentBlocks across records — stream may have
  // image/structured blocks that callback doesn't, dropping them = data loss.
  const contentBlocks: NonNullable<ChatMessage['contentBlocks']> = [];
  let mentionsUser = false;

  for (const r of sorted) {
    if (r.content && r.content.trim().length > 0) {
      contentParts.push(r.content);
      // F194 Phase Z11: bucket by origin for cliStdout / speechContent split.
      if (r.origin === 'callback') callbackContentParts.push(r.content);
      else streamContentParts.push(r.content);
    }
    if (r.thinking && r.thinking.trim().length > 0) thinkingParts.push(r.thinking);
    if (r.mentionsUser) mentionsUser = true;
    for (const ev of r.toolEvents ?? []) {
      if (seenToolIds.has(ev.id)) continue;
      seenToolIds.add(ev.id);
      toolEvents.push(ev);
    }
    for (const b of r.extra?.rich?.blocks ?? []) {
      if (seenBlockIds.has(b.id)) continue;
      seenBlockIds.add(b.id);
      richBlocks.push(b);
    }
    for (const block of r.contentBlocks ?? []) {
      contentBlocks.push(block);
    }
  }

  // F194 Phase Z8 R1 P1#1 (砚砚): callback/terminal-aware isStreaming.
  // (1) 任一 callback origin → false；(2) 否则按 ts asc 取最后 record 的显式
  // isStreaming；(3) 没有显式值 → false。
  let isStreaming = false;
  if (!callbackRecord) {
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const r = sorted[i]!;
      if (typeof r.isStreaming === 'boolean') {
        isStreaming = r.isStreaming;
        break;
      }
    }
  }

  // F194 Phase Z8 cloud Codex R1 P1: preserve all assistant fields (metadata, replyTo,
  // replyPreview, visibility, whisperTo, revealedAt, deliveredAt, source, summary,
  // evidence, contentBlocks, etc.) from canonical record. Base = callback record if
  // present else first record by ts asc; then override projection-specific fields.
  const base = callbackRecord ?? first;
  const projected: ChatMessage = {
    ...base,
    id: canonicalId,
    type: 'assistant',
    catId: first.catId,
    content: contentParts.join('\n\n'),
    timestamp: first.timestamp ?? 0,
    isStreaming,
    origin,
  };
  if (toolEvents.length > 0) projected.toolEvents = toolEvents;
  else delete projected.toolEvents;
  if (thinkingParts.length > 0) projected.thinking = thinkingParts.join('\n\n');
  else delete projected.thinking;
  // cloud R2 P2 (codex): merged contentBlocks (image/structured) from all records.
  if (contentBlocks.length > 0) projected.contentBlocks = contentBlocks;
  else delete projected.contentBlocks;
  if (mentionsUser) projected.mentionsUser = true;

  // F194 Phase Z11 (铲屎官 R15): merge case = group has BOTH stream and
  // callback content. Expose the origin-split portions so ChatMessage keeps
  // CLI Output behavior consistent (stream working log → CLI Output stdout;
  // post_msg speech → main body) regardless of whether a post_msg happened.
  const isMergeCase = streamContentParts.length > 0 && callbackContentParts.length > 0;
  const cliStdout = isMergeCase ? streamContentParts.join('\n\n') : undefined;
  const speechContent = isMergeCase ? callbackContentParts.join('\n\n') : undefined;

  // Preserve stream identity on the projected bubble — downstream code uses
  // `getBubbleInvocationId` to dedupe further (e.g. live cleanup, suppression).
  const firstStream = sorted.find((r) => r.extra?.stream)?.extra?.stream;
  const baseExtra = base.extra ?? {};
  if (firstStream || richBlocks.length > 0 || isMergeCase || Object.keys(baseExtra).length > 0) {
    const extra: NonNullable<ChatMessage['extra']> = { ...baseExtra };
    if (firstStream || isMergeCase) {
      extra.stream = {
        ...firstStream,
        ...(cliStdout !== undefined ? { cliStdout } : {}),
        ...(speechContent !== undefined ? { speechContent } : {}),
      };
    }
    if (richBlocks.length > 0) extra.rich = { v: 1, blocks: richBlocks };
    projected.extra = extra;
  }

  return projected;
}

/**
 * Apply Z8 unified canonical projection to raw records.
 *
 * Records without a (catId, invocationId) namespace pass through unchanged
 * and keep their original position (sorted by timestamp asc among themselves).
 * Records with a key are grouped and each group becomes one canonical bubble.
 */
export function projectCanonicalBubbles({ records }: ProjectionInput): ProjectionOutput {
  const groupedKeys = new Map<string, ChatMessage[]>();
  const passthrough: ChatMessage[] = [];

  for (const r of records) {
    const k = bubbleGroupKey(r);
    if (!k) {
      passthrough.push(r);
      continue;
    }
    const keyStr = `${k.catId}::${k.invocationId}`;
    const list = groupedKeys.get(keyStr);
    if (list) list.push(r);
    else groupedKeys.set(keyStr, [r]);
  }

  const projected: ChatMessage[] = [];
  for (const list of groupedKeys.values()) {
    projected.push(projectGroup(list));
  }
  for (const p of passthrough) {
    projected.push(p as ChatMessage);
  }

  projected.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0) || (a.id ?? '').localeCompare(b.id ?? ''));
  return { messages: projected };
}
