/**
 * A2A invocation trigger for MCP callback post_message.
 * When a cat's post_message contains @mentions of other cats,
 * this module creates an InvocationRecord and runs background execution.
 */

import type { FastifyBaseLogger } from 'fastify';
import type { CatId } from '@cat-cafe/shared';
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

  const intent = parseIntent(content, targetCats.length);

  const createResult = await invocationRecordStore.create({
    threadId,
    userId,
    targetCats,
    intent: intent.intent,
    idempotencyKey: triggerMessage.id,
  });

  if (createResult.outcome === 'duplicate') return;

  const controller = invocationTracker?.start(threadId, userId);
  if (controller?.signal.aborted) return;

  await invocationRecordStore.update(createResult.invocationId, {
    userMessageId: triggerMessage.id,
  });

  // Background execution — fire and forget
  void (async () => {
    try {
      await invocationRecordStore.update(createResult.invocationId, {
        status: 'running',
      });

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
    } finally {
      invocationTracker?.complete(threadId, controller);
    }
  })();
}
