/**
 * Connector Invoke Trigger
 * Programmatically triggers a cat invocation after a connector message is posted.
 *
 * Phase 3b: Closes the loop — review email → connector message → cat invocation.
 * Uses the same AgentRouter pipeline as POST /api/messages but triggered
 * by the email watcher instead of an HTTP request.
 *
 * BACKLOG #97 Phase 3b
 */

import type { CatId } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AgentRouter } from '../../domains/cats/services/agents/routing/AgentRouter.js';
import type { IInvocationRecordStore } from '../../domains/cats/services/stores/ports/InvocationRecordStore.js';
import type { InvocationTracker } from '../../domains/cats/services/agents/invocation/InvocationTracker.js';
import type { InvocationQueue } from '../../domains/cats/services/agents/invocation/InvocationQueue.js';
import type { QueueProcessor } from '../../domains/cats/services/agents/invocation/QueueProcessor.js';
import type { SocketManager } from '../../infrastructure/websocket/index.js';
import { getDefaultCatId } from '../../config/cat-config-loader.js';
import type { PersistenceContext } from '../../domains/cats/services/agents/routing/route-helpers.js';
import { mergeTokenUsage, type TokenUsage } from '../../domains/cats/services/types.js';

export interface ConnectorInvokeTriggerOptions {
  readonly router: AgentRouter;
  readonly socketManager: SocketManager;
  readonly invocationRecordStore: IInvocationRecordStore;
  readonly invocationTracker: InvocationTracker;
  readonly invocationQueue: InvocationQueue;
  readonly queueProcessor?: QueueProcessor;
  readonly log: FastifyBaseLogger;
}

/**
 * Fire-and-forget invocation trigger for connector messages.
 *
 * Flow:
 *   1. Create InvocationRecord (atomic)
 *   2. Start InvocationTracker
 *   3. Run routeExecution in background (fire-and-forget)
 *   4. Broadcast agent messages to WebSocket room
 *   5. Ack cursor boundaries + update status
 */
export class ConnectorInvokeTrigger {
  private readonly opts: ConnectorInvokeTriggerOptions;

  constructor(opts: ConnectorInvokeTriggerOptions) {
    this.opts = opts;
  }

  /**
   * Trigger a cat invocation for a connector message.
   * Returns immediately — execution happens in background.
   *
   * @param threadId  Thread where the connector message was posted
   * @param catId     Target cat to invoke
   * @param userId    User context for the invocation
   * @param message   The connector message content (used as invocation trigger)
   * @param messageId The stored connector message ID (for InvocationRecord backfill)
   */
  trigger(
    threadId: string,
    catId: CatId,
    userId: string,
    message: string,
    messageId: string,
  ): void {
    const { invocationTracker, invocationQueue, socketManager, log } = this.opts;

    // F39: If a cat is already running in this thread, enqueue instead of direct execution.
    // Connector messages should never abort active invocations (铲屎官: "永远排队，永远不打断").
    if (invocationTracker.has(threadId)) {
      const result = invocationQueue.enqueue({
        threadId,
        userId,
        content: message,
        source: 'connector',
        targetCats: [catId],
        intent: 'execute',
      });

      if (result.outcome === 'full') {
        socketManager.emitToUser(userId, 'queue_full_warning', {
          threadId,
          source: 'connector',
          queueSize: invocationQueue.size(threadId, userId),
          queue: invocationQueue.list(threadId, userId),
        });
        log.warn({ threadId, catId, userId },
          '[ConnectorInvokeTrigger] Queue full, connector message not enqueued');
        return;
      }

      // Backfill messageId (connector messages already have a messageId)
      if (result.entry) {
        if (result.outcome === 'enqueued') {
          invocationQueue.backfillMessageId(threadId, userId, result.entry.id, messageId);
        } else if (result.outcome === 'merged') {
          invocationQueue.appendMergedMessageId(threadId, userId, result.entry.id, messageId);
        }
      }

      socketManager.emitToUser(userId, 'queue_updated', {
        threadId,
        queue: invocationQueue.list(threadId, userId),
        action: result.outcome,
      });
      log.info({ threadId, catId, outcome: result.outcome },
        '[ConnectorInvokeTrigger] Queued (active invocation running)');
      return;
    }

    // No active invocation → direct execution (existing flow)
    this.executeInBackground(threadId, catId, userId, message, messageId)
      .catch((err) => {
        // Last-resort guard: prevent unhandledRejection from pre-try errors
        this.opts.log.error(`[ConnectorInvokeTrigger] Unhandled: ${err instanceof Error ? err.message : String(err)}`);
      });
  }

  private async executeInBackground(
    threadId: string,
    catId: CatId,
    userId: string,
    message: string,
    messageId: string,
  ): Promise<void> {
    const { router, socketManager, invocationRecordStore, invocationTracker, invocationQueue, log } = this.opts;
    const targetCats: CatId[] = [catId];
    let finalStatus: 'succeeded' | 'failed' | 'canceled' = 'failed';

    // ① Atomic create InvocationRecord
    const createResult = await invocationRecordStore.create({
      threadId,
      userId,
      targetCats,
      intent: 'execute',
      idempotencyKey: `connector-${messageId}`,
    });

    if (createResult.outcome === 'duplicate') {
      log.info(`[ConnectorInvokeTrigger] Duplicate invocation for message ${messageId}, skipping`);
      return;
    }

    // Tracker started here — must be completed in finally no matter what
    const controller = invocationTracker.start(threadId, userId, targetCats);

    const HEARTBEAT_INTERVAL_MS = 30_000;
    let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

    try {
      if (controller?.signal.aborted) {
        finalStatus = 'canceled';
        await invocationRecordStore.update(createResult.invocationId, { status: 'canceled' });
        log.warn(`[ConnectorInvokeTrigger] Thread ${threadId} is being deleted, skipping`);
        return;
      }

      // ② Backfill userMessageId (the connector message that triggered this)
      await invocationRecordStore.update(createResult.invocationId, {
        userMessageId: messageId,
      });

      heartbeatInterval = setInterval(() => {
        socketManager.broadcastToRoom(
          `thread:${threadId}`,
          'heartbeat',
          { threadId, timestamp: Date.now() },
        );
      }, HEARTBEAT_INTERVAL_MS);

      // ③ Set status running + broadcast intent
      await invocationRecordStore.update(createResult.invocationId, { status: 'running' });

      socketManager.broadcastToRoom(
        `thread:${threadId}`,
        'intent_mode',
        { threadId, mode: 'execute', targetCats },
      );

      // ④ Run routeExecution and broadcast each agent message
      const cursorBoundaries = new Map<string, string>();
      const persistenceContext: PersistenceContext = { failed: false, errors: [] };
      const collectedUsage = new Map<string, TokenUsage>();

      const intent = { intent: 'execute' as const, explicit: false, promptTags: [] as string[] };

      for await (const msg of router.routeExecution(
        userId, message, threadId, messageId,
        targetCats, intent,
        {
          ...(controller?.signal ? { signal: controller.signal } : {}),
          queueHasQueuedMessages: (tid: string) => invocationQueue.hasQueuedForThread(tid),
          cursorBoundaries,
          persistenceContext,
        },
      )) {
        // F39 bugfix: stop broadcasting after cancel (drain pipe buffer silently)
        if (controller?.signal.aborted) break;
        if (msg.type === 'done' && msg.catId && msg.metadata?.usage) {
          collectedUsage.set(
            msg.catId,
            mergeTokenUsage(collectedUsage.get(msg.catId), msg.metadata.usage),
          );
        }
        socketManager.broadcastAgentMessage(msg, threadId);
      }

      // ⑤ Finalize: abort guard → persistence check → ack + succeeded
      // F39 P1 fix (砚砚 R1): abort guard after loop — same pattern as messages.ts.
      // When signal aborted and generator ends normally, break exits loop but
      // post-loop code would still run ack+succeeded without this guard.
      if (controller?.signal.aborted) {
        finalStatus = 'canceled';
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'canceled',
        });
        // Skip ack/succeeded — let finally handle cleanup
      } else if (persistenceContext.failed) {
        const errorDetail = persistenceContext.errors
          .map(e => `${e.catId}: ${e.error}`)
          .join('; ');
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'failed',
          error: `Connector invoke: message delivered but persistence failed: ${errorDetail}`,
        });
      } else {
        await router.ackCollectedCursors(userId, threadId, cursorBoundaries);
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'succeeded',
          ...(collectedUsage.size > 0 ? {
            usageByCat: Object.fromEntries(collectedUsage),
          } : {}),
        });
        finalStatus = 'succeeded';
      }

      log.info(`[ConnectorInvokeTrigger] Invocation ${createResult.invocationId} completed for ${catId} in thread ${threadId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      log.error(`[ConnectorInvokeTrigger] Invocation failed: ${errorMsg}`);

      // Best-effort status update — don't let this throw mask the original error
      try {
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'failed',
          error: errorMsg,
        });
      } catch { /* best-effort */ }

      socketManager.broadcastAgentMessage({
        type: 'error',
        catId: getDefaultCatId(),
        error: `Connector invoke failed: ${errorMsg}`,
        isFinal: true,
        timestamp: Date.now(),
      }, threadId);
    } finally {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      invocationTracker.complete(threadId, controller);
      // F39 P1 fix: Notify queue processor for auto-dequeue chain
      // (same pattern as messages.ts and invocations.ts)
      this.opts.queueProcessor?.onInvocationComplete(threadId, finalStatus)
        .catch(() => { /* best-effort, don't crash background task */ });
    }
  }
}
