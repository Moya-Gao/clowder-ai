/**
 * Telegram Bot Adapter
 * Inbound: Parse Telegram update → extract private text message
 * Outbound: Send reply via Bot API
 *
 * Uses grammy for long polling (no public webhook needed).
 * MVP: DM-only, text-only, single-owner.
 *
 * F088 Multi-Platform Chat Gateway
 */

import type { FastifyBaseLogger } from 'fastify';
import { Bot } from 'grammy';
import type { RichBlock } from '@cat-cafe/shared';
import type { IOutboundAdapter } from '../OutboundDeliveryHook.js';
import { formatTelegramHtml } from './telegram-html-formatter.js';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export interface TelegramInboundMessage {
  chatId: string;
  text: string;
  messageId: string;
  senderId: string;
}

export class TelegramAdapter implements IOutboundAdapter {
  readonly connectorId = 'telegram';
  private readonly bot: Bot;
  private readonly log: FastifyBaseLogger;
  private sendMessageFn: ((chatId: string, text: string, opts?: Record<string, unknown>) => Promise<unknown>) | null =
    null;

  constructor(botToken: string, log: FastifyBaseLogger) {
    this.bot = new Bot(botToken);
    this.log = log;
  }

  /**
   * Parse a Telegram update into an inbound message.
   * Returns null for non-text, group, or bot messages.
   */
  parseUpdate(update: unknown): TelegramInboundMessage | null {
    if (!update || typeof update !== 'object') return null;

    const u = update as Record<string, unknown>;
    const message = u['message'] as Record<string, unknown> | undefined;
    if (!message) return null;

    // MVP: text only
    const text = message['text'];
    if (typeof text !== 'string') return null;

    // MVP: DM only (private chats)
    const chat = message['chat'] as Record<string, unknown> | undefined;
    if (!chat || chat['type'] !== 'private') return null;

    // Skip bot messages
    const from = message['from'] as Record<string, unknown> | undefined;
    if (!from || from['is_bot'] === true) return null;

    return {
      chatId: String(chat['id']),
      text,
      messageId: String(message['message_id']),
      senderId: String(from['id']),
    };
  }

  /**
   * Send a reply to a Telegram chat.
   * Truncates messages exceeding Telegram's 4096 char limit.
   */
  async sendReply(externalChatId: string, content: string): Promise<void> {
    const text =
      content.length > TELEGRAM_MAX_MESSAGE_LENGTH ? `${content.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH - 1)}…` : content;

    if (this.sendMessageFn) {
      await this.sendMessageFn(externalChatId, text);
      return;
    }

    await this.bot.api.sendMessage(externalChatId, text);
  }

  /**
   * Start long polling for inbound messages.
   * Each text DM is passed to the handler.
   */
  startPolling(handler: (msg: TelegramInboundMessage) => Promise<void>): void {
    this.bot.on('message:text', async (ctx) => {
      const parsed = this.parseUpdate({ message: ctx.message });
      if (!parsed) return;

      try {
        await handler(parsed);
      } catch (err) {
        this.log.error({ err, chatId: parsed.chatId }, '[TelegramAdapter] Handler error');
      }
    });

    this.bot.start({
      onStart: () => {
        this.log.info('[TelegramAdapter] Long polling started');
      },
    });
  }

  /**
   * Stop long polling gracefully.
   */
  async stopPolling(): Promise<void> {
    await this.bot.stop();
  }

  /**
   * Send a rich message as Telegram HTML-formatted text.
   */
  async sendRichMessage(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
  ): Promise<void> {
    const html = formatTelegramHtml(blocks, catDisplayName, textContent);

    if (this.sendMessageFn) {
      await this.sendMessageFn(externalChatId, html, { parse_mode: 'HTML' });
      return;
    }

    await this.bot.api.sendMessage(externalChatId, html, { parse_mode: 'HTML' });
  }

  /**
   * Test helper: inject a mock sendMessage function.
   * @internal
   */
  _injectSendMessage(fn: (chatId: string, text: string, opts?: Record<string, unknown>) => Promise<unknown>): void {
    this.sendMessageFn = fn;
  }
}
