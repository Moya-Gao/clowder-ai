/**
 * A2A invocation trigger for MCP callback post_message.
 * When a cat's post_message contains @mentions of other cats,
 * this module creates an InvocationRecord and runs background execution.
 */

import type { FastifyBaseLogger } from 'fastify';
import { createCatId, type CatId } from '@cat-cafe/shared';
import type { AgentRouter } from '../domains/cats/services/index.js';
import type { StoredMessage } from '../domains/cats/services/MessageStore.js';
import { parseIntent } from '../domains/cats/services/IntentParser.js';
import type { IInvocationRecordStore } from '../domains/cats/services/InvocationRecordStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import type { InvocationTracker } from '../domains/cats/services/InvocationTracker.js';

export interface A2ATriggerDeps {
  router: AgentRouter;
  invocationRecordStore: IInvocationRecordStore;
  socketManager: SocketManager;
  invocationTracker?: InvocationTracker;
  log: FastifyBaseLogger;
}

/**
 * Fire-and-forget: create an InvocationRecord for @mentioned cats and
 * run `router.routeExecution()` in the background.
 *
 * Messages are persisted inside routeSerial/routeParallel — we only need
 * to broadcast the yielded AgentMessages via socketManager.
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
  const { router, invocationRecordStore, socketManager,
    invocationTracker, log } = deps;
  const { targetCats, content, userId, threadId, triggerMessage } = opts;
  const statusCatId = targetCats[0] ?? createCatId('opus');
  const intent = parseIntent(content, targetCats.length);

  const createResult = await invocationRecordStore.create({
    threadId,
    userId,
    targetCats,
    intent: intent.intent,
    idempotencyKey: triggerMessage.id,
  });

  if (createResult.outcome === 'duplicate') return;

  // A2A chains fire DURING a parent invocation (cat callback with @mention).
  // If parent is active, skip tracker.start() to avoid aborting the parent.
  // The child runs without its own tracker entry (no individual cancel support,
  // but the InvocationRecord provides audit trail).
  const parentActive = invocationTracker?.has(threadId) ?? false;
  let controller: AbortController | undefined;

  if (!parentActive) {
    controller = invocationTracker?.start(threadId, userId, targetCats);
    if (controller?.signal.aborted) {
      // P2-1: thread is deleting — mark record as canceled, don't leave it pending
      invocationTracker?.complete(threadId, controller);
      await invocationRecordStore.update(createResult.invocationId, {
        status: 'canceled',
      });
      return;
    }
  } else {
    log.info({
      threadId,
      invocationId: createResult.invocationId,
      targetCats,
    }, '[callbacks] A2A chain: parent invocation active, running as child (no tracker.start)');
  }

  await invocationRecordStore.update(createResult.invocationId, {
    userMessageId: triggerMessage.id,
  });

  // Background execution — fire and forget
  void (async () => {
    try {
      await invocationRecordStore.update(createResult.invocationId, {
        status: 'running',
      });

      socketManager.broadcastToRoom(
        `thread:${threadId}`,
        'intent_mode',
        { threadId, mode: intent.intent, targetCats },
      );

      for await (const msg of router.routeExecution(
        userId, content, threadId, triggerMessage.id,
        targetCats, intent,
        { ...(controller?.signal ? { signal: controller.signal } : {}) },
      )) {
        // Messages already persisted by routeSerial/routeParallel
        socketManager.broadcastAgentMessage(msg, threadId);
      }

      await invocationRecordStore.update(createResult.invocationId, {
        status: 'succeeded',
      });
    } catch (err) {
      log.error(`[callbacks] A2A invocation failed: ${String(err)}`);
      try {
        await invocationRecordStore.update(createResult.invocationId, {
          status: 'failed',
          ...(err instanceof Error ? { error: err.message } : {}),
        });
      } catch { /* best-effort */ }
      // Ensure frontend receives terminal state and can clear loading lock.
      socketManager.broadcastAgentMessage({
        type: 'error',
        catId: statusCatId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      }, threadId);
      socketManager.broadcastAgentMessage({
        type: 'done',
        catId: statusCatId,
        isFinal: true,
        timestamp: Date.now(),
      }, threadId);
    } finally {
      if (controller) {
        invocationTracker?.complete(threadId, controller);
      }
    }
  })();
}
