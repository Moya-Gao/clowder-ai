/**
 * Feishu (飞书/Lark) Bot Adapter
 * Inbound: Parse webhook event → extract private text message
 * Outbound: Send reply via Lark API
 *
 * Uses @larksuiteoapi/node-sdk for API calls.
 * MVP: DM-only (p2p), text-only, single-owner.
 *
 * F088 Multi-Platform Chat Gateway
 */

import type { RichBlock } from '@cat-cafe/shared';
import * as lark from '@larksuiteoapi/node-sdk';
import type { FastifyBaseLogger } from 'fastify';
import type { MessageEnvelope } from '../ConnectorMessageFormatter.js';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';
import { formatFeishuCard } from './feishu-card-formatter.js';

export interface FeishuInboundMessage {
  chatId: string;
  text: string;
  messageId: string;
  senderId: string;
}

export interface FeishuAdapterOptions {
  /** Feishu Verification Token for webhook event authentication. If not set, token verification is skipped. */
  verificationToken?: string | undefined;
}

export class FeishuAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'feishu';
  private readonly client: lark.Client;
  private readonly log: FastifyBaseLogger;
  private readonly verificationToken: string | null;
  private sendMessageFn: ((params: { chatId: string; content: string; msgType: string }) => Promise<unknown>) | null =
    null;
  private editMessageFn: ((params: { messageId: string; content: string }) => Promise<unknown>) | null = null;

  constructor(appId: string, appSecret: string, log: FastifyBaseLogger, options?: FeishuAdapterOptions) {
    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
    });
    this.log = log;
    this.verificationToken = options?.verificationToken ?? null;
  }

  /**
   * Check if the request body is a Feishu URL verification challenge.
   * Returns the challenge token if so, null otherwise.
   */
  isVerificationChallenge(body: unknown): { challenge: string } | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, unknown>;
    if (b['type'] === 'url_verification' && typeof b['challenge'] === 'string') {
      return { challenge: b['challenge'] };
    }
    return null;
  }

  /**
   * Verify event callback token.
   * Checks that the event body's header.token matches the configured verificationToken.
   * If no verificationToken is configured, verification is skipped (returns true).
   */
  verifyEventToken(body: unknown): boolean {
    if (!this.verificationToken) return true;
    if (!body || typeof body !== 'object') return false;
    const b = body as Record<string, unknown>;
    const header = b['header'] as Record<string, unknown> | undefined;
    if (!header) return false;
    return header['token'] === this.verificationToken;
  }

  /**
   * Parse a Feishu event callback into an inbound message.
   * Returns null for non-text, group, or unsupported events.
   */
  parseEvent(eventBody: unknown): FeishuInboundMessage | null {
    if (!eventBody || typeof eventBody !== 'object') return null;

    const body = eventBody as Record<string, unknown>;
    const header = body['header'] as Record<string, unknown> | undefined;
    if (!header || header['event_type'] !== 'im.message.receive_v1') return null;

    const event = body['event'] as Record<string, unknown> | undefined;
    if (!event) return null;

    const message = event['message'] as Record<string, unknown> | undefined;
    if (!message) return null;

    // MVP: text only
    if (message['message_type'] !== 'text') return null;

    // MVP: DM only (p2p)
    if (message['chat_type'] !== 'p2p') return null;

    // Parse content JSON
    let text: string;
    try {
      const content = JSON.parse(message['content'] as string);
      text = content.text;
      if (typeof text !== 'string') return null;
    } catch {
      return null;
    }

    // Extract sender
    const sender = event['sender'] as Record<string, unknown> | undefined;
    const senderId = (sender?.['sender_id'] as Record<string, unknown> | undefined)?.['open_id'];

    return {
      chatId: message['chat_id'] as string,
      text,
      messageId: message['message_id'] as string,
      senderId: String(senderId ?? 'unknown'),
    };
  }

  /**
   * Send a reply to a Feishu chat.
   */
  async sendReply(externalChatId: string, content: string): Promise<void> {
    const params = {
      chatId: externalChatId,
      content,
      msgType: 'text',
    };

    if (this.sendMessageFn) {
      await this.sendMessageFn(params);
      return;
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: externalChatId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      },
    });
  }

  /**
   * Send a rich message as Feishu interactive card.
   */
  async sendRichMessage(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
  ): Promise<void> {
    const card = formatFeishuCard(blocks, catDisplayName, textContent);
    const params = {
      chatId: externalChatId,
      content: JSON.stringify(card),
      msgType: 'interactive',
    };

    if (this.sendMessageFn) {
      await this.sendMessageFn(params);
      return;
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: externalChatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  }

  /**
   * Send a formatted reply using MessageEnvelope (platform-agnostic public layer).
   * Renders as Feishu interactive card.
   */
  async sendFormattedReply(externalChatId: string, envelope: MessageEnvelope): Promise<void> {
    const card = {
      header: {
        title: { tag: 'plain_text' as const, content: envelope.header },
        template: 'blue' as const,
      },
      elements: [
        { tag: 'markdown' as const, content: `**${envelope.subtitle}**` },
        { tag: 'markdown' as const, content: envelope.body },
        { tag: 'hr' as const },
        { tag: 'markdown' as const, content: envelope.footer },
      ],
    };

    const params = {
      chatId: externalChatId,
      content: JSON.stringify(card),
      msgType: 'interactive',
    };

    if (this.sendMessageFn) {
      await this.sendMessageFn(params);
      return;
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: externalChatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  }

  /**
   * Send a placeholder text message and return its platform message ID.
   * Used as the first step in edit-in-place streaming.
   */
  async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
    if (this.sendMessageFn) {
      const result = (await this.sendMessageFn({
        chatId: externalChatId,
        content: text,
        msgType: 'text',
      })) as { message_id?: string } | undefined;
      return result?.message_id ?? '';
    }

    const resp = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: externalChatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
    return resp?.data?.message_id ?? '';
  }

  /**
   * Edit an already-sent message in place.
   * Uses Lark im.message.patch API. Supports text messages sent within 14 days.
   */
  async editMessage(_externalChatId: string, platformMessageId: string, text: string): Promise<void> {
    if (this.editMessageFn) {
      await this.editMessageFn({ messageId: platformMessageId, content: text });
      return;
    }

    await this.client.im.message.patch({
      path: { message_id: platformMessageId },
      data: {
        content: JSON.stringify({ text }),
      },
    });
  }

  /**
   * Test helper: inject a mock send function.
   * @internal
   */
  _injectSendMessage(fn: (params: { chatId: string; content: string; msgType: string }) => Promise<unknown>): void {
    this.sendMessageFn = fn;
  }

  /**
   * Test helper: inject a mock edit function.
   * @internal
   */
  _injectEditMessage(fn: (params: { messageId: string; content: string }) => Promise<unknown>): void {
    this.editMessageFn = fn;
  }
}
