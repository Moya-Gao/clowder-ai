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
import { catRegistry, getConnectorDefinition } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { ConnectorCommandLayer } from './ConnectorCommandLayer.js';
import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';
import type { InboundMessageDedup } from './InboundMessageDedup.js';
import { parseMentions } from './mention-parser.js';
import type { IOutboundAdapter } from './OutboundDeliveryHook.js';

export type RouteResult =
  | { kind: 'routed'; threadId: string; messageId: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'command' };

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
  readonly commandLayer?: ConnectorCommandLayer | undefined;
  readonly adapters?: Map<string, IOutboundAdapter> | undefined;
}

export class ConnectorRouter {
  constructor(private readonly opts: ConnectorRouterOptions) {}

  /** Build @-mention patterns from catRegistry for parseMentions. */
  private getMentionPatterns(): Map<string, string[]> {
    const patterns = new Map<string, string[]>();
    for (const catId of catRegistry.getAllIds()) {
      const entry = catRegistry.tryGet(catId);
      if (entry?.config.mentionPatterns && entry.config.mentionPatterns.length > 0) {
        patterns.set(catId, [...entry.config.mentionPatterns]);
      }
    }
    return patterns;
  }

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

    // 1b. Command interception — handle /commands before agent routing
    if (this.opts.commandLayer && text.trim().startsWith('/')) {
      const cmdResult = await this.opts.commandLayer.handle(connectorId, externalChatId, this.opts.defaultUserId, text);
      if (cmdResult.kind !== 'not-command' && cmdResult.response) {
        const adapter = this.opts.adapters?.get(connectorId);
        if (adapter) {
          await adapter.sendReply(externalChatId, cmdResult.response);
        }
        log.info({ connectorId, command: cmdResult.kind }, '[ConnectorRouter] Command handled');
        return { kind: 'command' as const };
      }
    }

    // 2. Lookup or create binding
    let binding = await bindingStore.getByExternal(connectorId, externalChatId);
    if (!binding) {
      const def = getConnectorDefinition(connectorId);
      const title = `${def?.displayName ?? connectorId} DM`;
      const thread = await threadStore.create(this.opts.defaultUserId, title);
      binding = await bindingStore.bind(connectorId, externalChatId, thread.id, this.opts.defaultUserId);
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

    // Parse @-mentions to determine target cat
    const mentionPatterns = this.getMentionPatterns();
    const { targetCatId } = parseMentions(text, mentionPatterns, this.opts.defaultCatId);

    const stored = await messageStore.append({
      threadId: binding.threadId,
      userId: this.opts.defaultUserId,
      catId: null,
      content: text,
      source,
      mentions: [targetCatId],
      timestamp: Date.now(),
    });

    // 4. Broadcast to WebSocket
    socketManager?.broadcastToRoom(`thread:${binding.threadId}`, 'connector_message', {
      threadId: binding.threadId,
      messageId: stored.id,
      connectorId,
      content: text,
    });

    // 5. Trigger cat invocation (use parsed targetCatId)
    invokeTrigger.trigger(binding.threadId, targetCatId, this.opts.defaultUserId, text, stored.id);

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
