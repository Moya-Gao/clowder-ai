/**
 * Connector Router
 * Routes inbound messages from external platforms to Cat Café threads.
 *
 * Flow:
 *   1. Dedup check (skip webhook retries)
 *   2. Lookup existing binding or create new thread + binding
 *   3. Post connector message to thread (with ConnectorSource)
 *   4. Broadcast to WebSocket
 *   5. Trigger cat invocation
 *
 * Follows ReviewRouter pattern but for chat platform messages.
 *
 * F088 Multi-Platform Chat Gateway
 */

import type { CatId, ConnectorSource } from '@cat-cafe/shared';
import { getConnectorDefinition } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';
import type { InboundMessageDedup } from './InboundMessageDedup.js';

export type RouteResult = { kind: 'routed'; threadId: string; messageId: string } | { kind: 'skipped'; reason: string };

export interface ConnectorRouterOptions {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly dedup: InboundMessageDedup;
  readonly messageStore: {
    append(input: {
      threadId: string;
      userId: string;
      catId: null;
      content: string;
      source: ConnectorSource;
      mentions: CatId[];
      timestamp: number;
    }): Promise<{ id: string }>;
  };
  readonly threadStore: {
    create(userId: string, title?: string): { id: string } | Promise<{ id: string }>;
  };
  readonly invokeTrigger: {
    trigger(threadId: string, catId: CatId, userId: string, message: string, messageId: string): void;
  };
  readonly socketManager?:
    | {
        broadcastToRoom(room: string, event: string, data: unknown): void;
      }
    | undefined;
  readonly defaultUserId: string;
  readonly defaultCatId: CatId;
  readonly log: FastifyBaseLogger;
}

export class ConnectorRouter {
  constructor(private readonly opts: ConnectorRouterOptions) {}

  async route(
    connectorId: string,
    externalChatId: string,
    text: string,
    externalMessageId: string,
  ): Promise<RouteResult> {
    const { bindingStore, dedup, messageStore, threadStore, invokeTrigger, socketManager, log } = this.opts;

    // 1. Dedup check
    if (dedup.isDuplicate(connectorId, externalChatId, externalMessageId)) {
      log.info({ connectorId, externalMessageId }, '[ConnectorRouter] Duplicate message skipped');
      return { kind: 'skipped', reason: 'duplicate' };
    }

    // 2. Lookup or create binding
    let binding = bindingStore.getByExternal(connectorId, externalChatId);
    if (!binding) {
      const def = getConnectorDefinition(connectorId);
      const title = `${def?.displayName ?? connectorId} DM`;
      const thread = await threadStore.create(this.opts.defaultUserId, title);
      binding = bindingStore.bind(connectorId, externalChatId, thread.id, this.opts.defaultUserId);
      log.info(
        { connectorId, externalChatId, threadId: thread.id },
        '[ConnectorRouter] New thread created for external chat',
      );
    }

    // 3. Post connector message
    const def = getConnectorDefinition(connectorId);
    const source: ConnectorSource = {
      connector: connectorId,
      label: def?.displayName ?? connectorId,
      icon: def?.icon ?? '💬',
    };

    const stored = await messageStore.append({
      threadId: binding.threadId,
      userId: this.opts.defaultUserId,
      catId: null,
      content: text,
      source,
      mentions: [this.opts.defaultCatId],
      timestamp: Date.now(),
    });

    // 4. Broadcast to WebSocket
    socketManager?.broadcastToRoom(`thread:${binding.threadId}`, 'connector_message', {
      threadId: binding.threadId,
      messageId: stored.id,
      connectorId,
      content: text,
    });

    // 5. Trigger cat invocation
    invokeTrigger.trigger(binding.threadId, this.opts.defaultCatId, this.opts.defaultUserId, text, stored.id);

    log.info(
      {
        connectorId,
        externalChatId,
        threadId: binding.threadId,
        messageId: stored.id,
      },
      '[ConnectorRouter] Message routed',
    );

    return {
      kind: 'routed',
      threadId: binding.threadId,
      messageId: stored.id,
    };
  }
}
