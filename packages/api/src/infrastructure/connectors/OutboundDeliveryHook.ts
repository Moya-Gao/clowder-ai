import { type CatId, catRegistry, type RichBlock } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';
import { ConnectorMessageFormatter, type MessageEnvelope } from './ConnectorMessageFormatter.js';
import { renderAllRichBlocksPlaintext } from './rich-block-plaintext.js';

export interface IOutboundAdapter {
  readonly connectorId: string;
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  sendRichMessage?(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  sendFormattedReply?(externalChatId: string, envelope: MessageEnvelope): Promise<void>;
}

export interface ThreadMeta {
  readonly threadShortId: string;
  readonly threadTitle?: string | undefined;
  readonly featId?: string | undefined;
  readonly deepLinkUrl?: string | undefined;
}

export interface OutboundDeliveryHookOptions {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly adapters: Map<string, IOutboundAdapter>;
  readonly log: FastifyBaseLogger;
}

export class OutboundDeliveryHook {
  private readonly formatter = new ConnectorMessageFormatter();

  constructor(private readonly opts: OutboundDeliveryHookOptions) {}

  async deliver(
    threadId: string,
    content: string,
    catId?: CatId,
    richBlocks?: RichBlock[],
    threadMeta?: ThreadMeta,
  ): Promise<void> {
    const bindings = this.opts.bindingStore.getByThread(threadId);
    if (bindings.length === 0) return;

    const entry = catId ? catRegistry.tryGet(catId) : undefined;
    const catDisplayName = entry?.config.displayName ?? '';
    const catEmoji = '🐱';
    const textPrefix = catDisplayName ? `[${catDisplayName}🐱] ` : '';
    const finalContent = `${textPrefix}${content}`;

    const hasRichBlocks = richBlocks && richBlocks.length > 0;

    await Promise.allSettled(
      bindings.map(async (binding) => {
        const adapter = this.opts.adapters.get(binding.connectorId);
        if (!adapter) {
          this.opts.log.warn({ connectorId: binding.connectorId }, 'No adapter registered for connector');
          return;
        }
        try {
          // Prefer sendFormattedReply when adapter supports it and threadMeta is available
          if (adapter.sendFormattedReply && threadMeta && !hasRichBlocks) {
            const envelope = this.formatter.format({
              catDisplayName: catDisplayName || 'Cat',
              catEmoji,
              threadShortId: threadMeta.threadShortId,
              threadTitle: threadMeta.threadTitle,
              featId: threadMeta.featId,
              body: content,
              deepLinkUrl: threadMeta.deepLinkUrl,
              timestamp: new Date(),
            });
            await adapter.sendFormattedReply(binding.externalChatId, envelope);
          } else if (hasRichBlocks && adapter.sendRichMessage) {
            await adapter.sendRichMessage(
              binding.externalChatId,
              content,
              richBlocks,
              catDisplayName || 'Cat',
              undefined,
            );
          } else if (hasRichBlocks) {
            // Fallback: append plaintext-rendered blocks to text
            const blockText = renderAllRichBlocksPlaintext(richBlocks);
            await adapter.sendReply(binding.externalChatId, `${finalContent}\n\n${blockText}`, undefined);
          } else {
            await adapter.sendReply(binding.externalChatId, finalContent, undefined);
          }
        } catch (err) {
          this.opts.log.error(
            {
              err,
              connectorId: binding.connectorId,
              externalChatId: binding.externalChatId,
            },
            'Outbound delivery failed',
          );
        }
      }),
    );
  }
}
