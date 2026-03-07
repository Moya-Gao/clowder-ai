/**
 * A2A invocation trigger for MCP callback post_message (F27 rewrite).
 *
 * BEFORE F27: callback detected @mentions → spawned independent routeExecution
 *   → dual-path bug (double-fire + uncontrollable children + infinite recursion)
 *
 * AFTER F27: callback detected @mentions → pushes targets to parent worklist
 *   → single path, shared AbortController, shared depth limit
 *
 * Fallback: if no parent worklist exists (shouldn't happen in practice,
 * since callbacks only fire during cat execution), creates a standalone
 * invocation as before.
 */

import type { CatId } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import { getDefaultCatId } from '../config/cat-config-loader.js';
import type { InvocationTracker } from '../domains/cats/services/agents/invocation/InvocationTracker.js';
import { hasWorklist, pushToWorklist } from '../domains/cats/services/agents/routing/WorklistRegistry.js';
import { parseIntent } from '../domains/cats/services/context/IntentParser.js';
import type { AgentRouter } from '../domains/cats/services/index.js';
import type { DeliveryCursorStore } from '../domains/cats/services/stores/ports/DeliveryCursorStore.js';
import type { IInvocationRecordStore } from '../domains/cats/services/stores/ports/InvocationRecordStore.js';
import type { StoredMessage } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface QueueProcessorLike {
  onInvocationComplete(threadId: string, status: 'succeeded' | 'failed' | 'canceled'): Promise<void>;
}

export interface A2ATriggerDeps {
  router: AgentRouter;
  invocationRecordStore: IInvocationRecordStore;
  socketManager: SocketManager;
  invocationTracker?: InvocationTracker;
  deliveryCursorStore?: DeliveryCursorStore;
  queueProcessor?: QueueProcessorLike;
  log: FastifyBaseLogger;
}

/**
 * Enqueue @mentioned cats into the parent's worklist (F27 unified path).
 *
 * Returns the cats that were actually enqueued. If no parent worklist exists,
 * falls back to standalone invocation (legacy path, should be rare).
 */
export async function enqueueA2ATargets(
  deps: A2ATriggerDeps,
  opts: {
    targetCats: CatId[];
    content: string;
    userId: string;
    threadId: string;
    triggerMessage: StoredMessage;
    /** The cat that triggered this A2A callback (for worklist caller guard). */
    callerCatId?: CatId;
  },
): Promise<{ enqueued: CatId[]; fallback: boolean }> {
  const { log } = deps;
  const { targetCats, threadId, callerCatId } = opts;
  const triggerMessageId = opts.triggerMessage.id;
  const { deliveryCursorStore } = deps;

  // F27: Try to push to parent worklist first
  if (hasWorklist(threadId)) {
    const enqueued = pushToWorklist(threadId, targetCats, callerCatId);
    if (enqueued.length > 0) {
      if (deliveryCursorStore) {
        // F27 + #77: Best-effort auto-ack to prevent surprise backlog when cats later
        // call pending-mentions. This intentionally advances the mention-ack cursor
        // using the current trigger message ID (cursor semantics, not a per-message receipt).
        //
        // Best-effort: ack failure should NOT fail /post-message, since the message has
        // already been stored/broadcast; failing would cause retries/duplicates and amplify noise.
        const ackTargets = enqueued.filter((catId) => opts.triggerMessage.mentions.includes(catId));
        const results = await Promise.allSettled(
          ackTargets.map((catId) =>
            deliveryCursorStore.ackMentionCursor(opts.userId, catId, opts.threadId, triggerMessageId),
          ),
        );
        const failed = results
          .map((r, i) => ({ r, catId: ackTargets[i] }))
          .filter((x): x is { r: PromiseRejectedResult; catId: CatId } => x.r.status === 'rejected');
        if (failed.length > 0) {
          log.warn(
            {
              threadId,
              triggerMessageId,
              failedAckCats: failed.map((f) => f.catId),
            },
            '[F27] A2A callback: mention auto-ack failed (best-effort)',
          );
        }
      }
      log.info(
        {
          threadId,
          triggerMessageId,
          enqueued,
          targetCats,
        },
        '[F27] A2A callback: enqueued targets to parent worklist',
      );
    } else {
      log.info(
        {
          threadId,
          triggerMessageId,
          targetCats,
        },
        '[F27] A2A callback: targets not enqueued (depth limit or already in worklist)',
      );
    }
    return { enqueued, fallback: false };
  }

  // Fallback: no parent worklist (shouldn't normally happen)
  // Guard: if parent invocation is active (e.g. routeParallel), don't start
  // a standalone fallback because tracker.start() would abort it. (缅因猫 R1 P1-2)
  const { invocationTracker } = deps;
  if (invocationTracker?.has(threadId)) {
    log.warn(
      {
        threadId,
        targetCats,
      },
      '[F27] A2A fallback skipped: no worklist but parent invocation active, refusing to abort',
    );
    return { enqueued: [], fallback: true };
  }

  // Create standalone invocation like the old triggerA2AInvocation
  log.warn(
    {
      threadId,
      targetCats,
    },
    '[F27] A2A callback: no parent worklist found, falling back to standalone invocation',
  );

  await triggerA2AInvocation(deps, opts);
  return { enqueued: targetCats, fallback: true };
}

/**
 * Legacy standalone invocation (fallback + backward compat).
 * Kept for edge cases where callback fires outside a routeSerial context.
 */
export async function triggerA2AInvocation(
  deps: A2ATriggerDeps,
  opts: {
    targetCats: CatId[];
    content: string;
    userId: string;
    threadId: string;
    triggerMessage: StoredMessage;
  },
): Promise<void> {
  const { router, invocationRecordStore, socketManager, invocationTracker, log } = deps;
  const { targetCats, content, userId, threadId, triggerMessage } = opts;
  const statusCatId = targetCats[0] ?? getDefaultCatId();
  const intent = parseIntent(content, targetCats.length);

  // Guard: if parent invocation is active, don't start a standalone fallback.
  // tracker.start() would abort the running parent (e.g. routeParallel). (缅因猫 R1 P1-2)
  const parentActive = invocationTracker?.has(threadId) ?? false;
  if (parentActive) {
    const activeCats = invocationTracker?.getCatIds?.(threadId) ?? [];
    // Redundant A2A short-circuit (砚砚 4ee660b defense-in-depth):
    // if parent already includes all targets, skip entirely.
    if (targetCats.length > 0 && targetCats.every((catId) => activeCats.includes(catId))) {
      log.info(
        {
          threadId,
          targetCats,
          activeCats,
          triggerMessageId: triggerMessage.id,
        },
        '[callbacks] A2A skipped: target already covered by active parent invocation',
      );
      return;
    }
    // Parent is active but targets differ — cannot safely start standalone
    // because tracker.start() would abort the parent. Log and bail.
    log.warn(
      {
        threadId,
        targetCats,
        activeCats,
        triggerMessageId: triggerMessage.id,
      },
      '[F27] A2A fallback skipped: parent invocation active, refusing to abort it',
    );
    return;
  }

  const createResult = await invocationRecordStore.create({
    threadId,
    userId,
    targetCats,
    intent: intent.intent,
    idempotencyKey: triggerMessage.id,
  });

  if (createResult.outcome === 'duplicate') return;

  // Safe: no active parent invocation, so tracker.start() won't abort anything unexpected.
  const controller = invocationTracker?.start(threadId, userId, targetCats);
  if (controller?.signal.aborted) {
    invocationTracker?.complete(threadId, controller);
    await invocationRecordStore.update(createResult.invocationId, {
      status: 'canceled',
    });
    return;
  }

  await invocationRecordStore.update(createResult.invocationId, {
    userMessageId: triggerMessage.id,
  });

  const { queueProcessor } = deps;

  // Background execution — fire and forget
  void (async () => {
    let finalStatus: 'succeeded' | 'failed' | 'canceled' = 'failed';
    try {
      await invocationRecordStore.update(createResult.invocationId, {
        status: 'running',
      });

      socketManager.broadcastToRoom(`thread:${threadId}`, 'intent_mode', { threadId, mode: intent.intent, targetCats });

      for await (const msg of router.routeExecution(userId, content, threadId, triggerMessage.id, targetCats, intent, {
        ...(controller?.signal ? { signal: controller.signal } : {}),
      })) {
        if (controller?.signal.aborted) break;
        socketManager.broadcastAgentMessage(msg, threadId);
      }

      if (controller?.signal.aborted) {
        finalStatus = 'canceled';
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'canceled',
        });
      } else {
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'succeeded',
        });
        finalStatus = 'succeeded';
      }
    } catch (err) {
      if (controller?.signal.aborted) {
        finalStatus = 'canceled';
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'canceled',
        });
      } else {
        log.error(`[callbacks] Standalone A2A invocation failed: ${String(err)}`);
        try {
          await invocationRecordStore.update(createResult.invocationId, {
            status: 'failed',
            ...(err instanceof Error ? { error: err.message } : {}),
          });
        } catch {
          /* best-effort */
        }
        socketManager.broadcastAgentMessage(
          {
            type: 'error',
            catId: statusCatId,
            error: err instanceof Error ? err.message : String(err),
            timestamp: Date.now(),
          },
          threadId,
        );
        socketManager.broadcastAgentMessage(
          {
            type: 'done',
            catId: statusCatId,
            isFinal: true,
            timestamp: Date.now(),
          },
          threadId,
        );
      }
    } finally {
      if (controller) {
        invocationTracker?.complete(threadId, controller);
      }
      queueProcessor?.onInvocationComplete(threadId, finalStatus).catch(() => {
        /* best-effort */
      });
    }
  })();
}
