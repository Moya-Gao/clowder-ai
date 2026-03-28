/**
 * Phase 4 (AC-H1): Delivery function factory for scheduled task execution.
 * Templates call deliver() to post messages to threads without going through MCP callbacks.
 */
import type { DeliverOpts } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

export interface DeliveryDeps {
  messageStore: { append: AnyFn };
  socketManager: { broadcastAgentMessage: AnyFn };
}

export function createDeliverFn(deps: DeliveryDeps): (opts: DeliverOpts) => Promise<string> {
  return async (opts: DeliverOpts): Promise<string> => {
    const stored = await deps.messageStore.append({
      userId: opts.userId,
      catId: opts.catId,
      content: opts.content,
      mentions: [],
      origin: 'callback',
      timestamp: Date.now(),
      threadId: opts.threadId,
    });
    deps.socketManager.broadcastAgentMessage(
      {
        type: 'text',
        catId: opts.catId,
        content: opts.content,
        origin: 'callback',
        messageId: stored.id,
        timestamp: Date.now(),
      },
      opts.threadId,
    );
    return stored.id;
  };
}
