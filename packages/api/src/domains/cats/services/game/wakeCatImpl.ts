/**
 * WakeCatFn production implementation — bridges GameNarratorDriver → A2A dispatch.
 *
 * Flow: wakeCat(catId, briefing) → whisper message → InvocationQueue → CLI session
 */

import type { CatId } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { InvocationQueue } from '../agents/invocation/InvocationQueue.js';
import type { IMessageStore, StoredMessage } from '../stores/ports/MessageStore.js';
import type { IThreadStore } from '../stores/ports/ThreadStore.js';
import type { WakeCatFn } from './GameNarratorDriver.js';

export interface QueueProcessorLike {
  tryAutoExecute(threadId: string): Promise<void>;
}

export interface WakeCatDeps {
  messageStore: IMessageStore;
  threadStore: IThreadStore;
  invocationQueue: InvocationQueue;
  queueProcessor: QueueProcessorLike;
  log: FastifyBaseLogger;
}

export function createWakeCatFn(deps: WakeCatDeps): WakeCatFn {
  const { messageStore, threadStore, invocationQueue, queueProcessor, log } = deps;

  return async (params: { threadId: string; catId: CatId; briefing: string; timeoutMs: number }): Promise<void> => {
    const { threadId, catId, briefing } = params;

    // Resolve thread owner for InvocationQueue scope
    const thread = await threadStore.get(threadId);
    const userId = thread?.createdBy ?? 'default-user';

    const storedMsg: StoredMessage | Promise<StoredMessage> = messageStore.append({
      userId: 'system',
      catId: null,
      content: briefing,
      mentions: [catId],
      timestamp: Date.now(),
      threadId,
      visibility: 'whisper',
      whisperTo: [catId],
    });
    const msg = storedMsg instanceof Promise ? await storedMsg : storedMsg;

    const result = invocationQueue.enqueue({
      threadId,
      userId,
      content: briefing,
      source: 'agent',
      targetCats: [catId],
      intent: 'execute',
      autoExecute: true,
    });

    if (result.outcome === 'full') {
      log.warn({ threadId, catId, gameWake: true }, '[F101] wakeCat: queue full');
      return;
    }

    if (result.entry) {
      if (result.outcome === 'enqueued') {
        invocationQueue.backfillMessageId(threadId, userId, result.entry.id, msg.id);
      } else {
        invocationQueue.appendMergedMessageId(threadId, userId, result.entry.id, msg.id);
      }
    }

    await queueProcessor.tryAutoExecute(threadId);

    log.info(
      { threadId, catId, outcome: result.outcome, entryId: result.entry?.id, gameWake: true },
      '[F101] wakeCat: cat enqueued for game action',
    );
  };
}
