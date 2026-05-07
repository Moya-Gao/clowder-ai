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

import type { RichBlock } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import { Bot, GrammyError, InputFile } from 'grammy';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';
import { formatTelegramHtml } from './telegram-html-formatter.js';

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const TELEGRAM_POLLING_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000] as const;
const TELEGRAM_MAX_CONFLICT_RETRIES = 10;
const INLINE_PLACEHOLDER_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

type TelegramStartOptions = Parameters<Bot['start']>[0];

interface TelegramPollingControls {
  start: (options: TelegramStartOptions) => Promise<void>;
  stop: () => Promise<void>;
  close: () => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  backoffMs: readonly number[];
  maxConflictRetries: number;
}

export interface TelegramAttachment {
  type: 'image' | 'file' | 'audio';
  telegramFileId: string;
  fileName?: string;
  duration?: number;
}

export interface TelegramInboundMessage {
  chatId: string;
  text: string;
  messageId: string;
  senderId: string;
  attachments?: TelegramAttachment[];
}

function isTelegramConflictError(err: unknown): boolean {
  if (err instanceof GrammyError) return err.error_code === 409;
  if (!err || typeof err !== 'object') return false;
  const errorCode = (err as { error_code?: unknown }).error_code;
  return errorCode === 409;
}

export class TelegramAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'telegram';
  private readonly bot: Bot;
  private readonly log: FastifyBaseLogger;
  private sendMessageFn: ((chatId: string, text: string, opts?: Record<string, unknown>) => Promise<unknown>) | null =
    null;
  private readonly placeholderChats = new Map<string, string>();
  private readonly pendingInlineFinal = new Map<string, string>();
  private readonly inlinePlaceholderTs = new Map<string, number>();
  private nowFn: () => number = () => Date.now();
  private botApiSendMessageFn: ((chatId: number, text: string) => Promise<{ message_id: number }>) | null = null;
  private botApiDeleteMessageFn: ((chatId: number, messageId: number) => Promise<void>) | null = null;
  private sendMediaFns: {
    sendPhoto: (chatId: number, input: string | InputFile) => Promise<unknown>;
    sendDocument: (chatId: number, input: string | InputFile) => Promise<unknown>;
    sendVoice: (chatId: number, input: string | InputFile) => Promise<unknown>;
  } | null = null;
  private pollingStopped = false;
  private pollingRunId = 0;
  private pollingControls: TelegramPollingControls | null = null;

  constructor(botToken: string, log: FastifyBaseLogger) {
    this.bot = new Bot(botToken);
    this.log = log;
  }

  private getPollingControls(): TelegramPollingControls {
    return (
      this.pollingControls ?? {
        start: (options) => this.bot.start(options),
        stop: () => this.bot.stop(),
        close: () => this.bot.api.close(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        backoffMs: TELEGRAM_POLLING_BACKOFF_MS,
        maxConflictRetries: TELEGRAM_MAX_CONFLICT_RETRIES,
      }
    );
  }

  /**
   * Parse a Telegram update into an inbound message.
   * Supports text, photo, document, and voice messages.
   * Returns null for group or bot messages.
   */
  parseUpdate(update: unknown): TelegramInboundMessage | null {
    if (!update || typeof update !== 'object') return null;

    const u = update as Record<string, unknown>;
    const message = u.message as Record<string, unknown> | undefined;
    if (!message) return null;

    // MVP: DM only (private chats)
    const chat = message.chat as Record<string, unknown> | undefined;
    if (!chat || chat.type !== 'private') return null;

    // Skip bot messages
    const from = message.from as Record<string, unknown> | undefined;
    if (!from || from.is_bot === true) return null;

    const base = {
      chatId: String(chat.id),
      messageId: String(message.message_id),
      senderId: String(from.id),
    };

    const caption = typeof message.caption === 'string' ? message.caption : undefined;

    // Text message
    const text = message.text;
    if (typeof text === 'string') {
      return { ...base, text };
    }

    // Photo message — pick largest photo (last in array)
    const photo = message.photo as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(photo) && photo.length > 0) {
      const largest = photo[photo.length - 1]!;
      return {
        ...base,
        text: caption ?? '[图片]',
        attachments: [{ type: 'image', telegramFileId: largest.file_id as string }],
      };
    }

    // Document message
    const document = message.document as Record<string, unknown> | undefined;
    if (document) {
      const fileName = document.file_name as string | undefined;
      return {
        ...base,
        text: caption ?? (fileName ? `[文件] ${fileName}` : '[文件]'),
        attachments: [{ type: 'file', telegramFileId: document.file_id as string, ...(fileName ? { fileName } : {}) }],
      };
    }

    // Voice message
    const voice = message.voice as Record<string, unknown> | undefined;
    if (voice) {
      const duration = voice.duration as number | undefined;
      return {
        ...base,
        text: '[语音]',
        attachments: [
          { type: 'audio', telegramFileId: voice.file_id as string, ...(duration != null ? { duration } : {}) },
        ],
      };
    }

    return null;
  }

  /**
   * Send a reply to a Telegram chat.
   * K2: If a pending inline placeholder exists for this chatId, edits it in-place
   * instead of sending a new message (consumed on first use).
   * Truncates messages exceeding Telegram's 4096 char limit.
   */
  async sendReply(externalChatId: string, content: string): Promise<void> {
    const inlineMsgId = this.pendingInlineFinal.get(externalChatId);
    if (inlineMsgId) {
      const age = this.nowFn() - (this.inlinePlaceholderTs.get(externalChatId) ?? 0);
      if (age > INLINE_PLACEHOLDER_MAX_AGE_MS) {
        // Stale placeholder from a previously-failed delivery: skip edit, clean up, fall through.
        this.pendingInlineFinal.delete(externalChatId);
        this.inlinePlaceholderTs.delete(externalChatId);
        await this.deleteMessage(inlineMsgId, externalChatId).catch(() => {});
      } else {
        try {
          await this.editMessage(externalChatId, inlineMsgId, content);
          // Unconditionally clean placeholderChats: this ID is now a finalized reply.
          // cloud-R12 P1: must not be conditional — concurrent registration can replace pendingInlineFinal
          // before we get here, making the old entry uncleanable via clearInlinePlaceholder.
          this.placeholderChats.delete(inlineMsgId);
          if (this.pendingInlineFinal.get(externalChatId) === inlineMsgId) {
            this.pendingInlineFinal.delete(externalChatId);
            this.inlinePlaceholderTs.delete(externalChatId);
          }
          return;
        } catch (err) {
          this.log.warn({ err }, '[TelegramAdapter] sendReply: editMessage failed, falling back to send');
          // Key intentionally preserved so cleanupPlaceholders can delete the stale card.
        }
      }
    }

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
   * Handles text, photo, document, and voice DMs.
   */
  startPolling(handler: (msg: TelegramInboundMessage) => Promise<void>): void {
    this.pollingStopped = false;
    const runId = ++this.pollingRunId;
    const handleUpdate = async (ctx: { message?: unknown }) => {
      if (!ctx.message) return;
      const parsed = this.parseUpdate({ message: ctx.message });
      if (!parsed) return;

      try {
        await handler(parsed);
      } catch (err) {
        this.log.error({ err, chatId: parsed.chatId }, '[TelegramAdapter] Handler error');
      }
    };

    this.bot.on('message:text', handleUpdate);
    this.bot.on('message:photo', handleUpdate);
    this.bot.on('message:document', handleUpdate);
    this.bot.on('message:voice', handleUpdate);

    void this.runPollingLoop(runId);
  }

  private async runPollingLoop(runId: number): Promise<void> {
    const controls = this.getPollingControls();
    let attempt = 0;
    while (!this.pollingStopped && runId === this.pollingRunId) {
      try {
        await controls.start({
          onStart: () => {
            attempt = 0;
            this.log.info('[TelegramAdapter] Long polling started');
          },
        });
        return;
      } catch (err) {
        if (this.pollingStopped || runId !== this.pollingRunId) return;

        if (!isTelegramConflictError(err)) {
          this.log.error({ err }, '[TelegramAdapter] Long polling failed');
          return;
        }

        const shouldRetry = await this.recoverPollingConflict(err, controls, attempt);
        if (!shouldRetry) return;
        attempt += 1;
      }
    }
  }

  private async recoverPollingConflict(
    err: unknown,
    controls: TelegramPollingControls,
    attempt: number,
  ): Promise<boolean> {
    if (attempt >= controls.maxConflictRetries) {
      this.log.error({ err, attempts: attempt }, '[TelegramAdapter] 409 conflict retry limit reached');
      return false;
    }

    const waitMs =
      controls.backoffMs[Math.min(attempt, controls.backoffMs.length - 1)] ?? controls.backoffMs.at(-1) ?? 60_000;
    this.log.warn(
      { err, attempt: attempt + 1, waitMs },
      '[TelegramAdapter] 409 conflict; releasing session and retrying',
    );
    try {
      await controls.close();
    } catch (closeErr) {
      this.log.warn({ err: closeErr }, '[TelegramAdapter] bot.api.close() failed during 409 recovery');
    }
    await controls.sleep(waitMs);
    return true;
  }

  /**
   * Stop long polling gracefully.
   */
  async stopPolling(): Promise<void> {
    this.pollingStopped = true;
    this.pollingRunId += 1;
    const controls = this.getPollingControls();
    try {
      await controls.stop();
    } catch (err) {
      this.log.warn({ err }, '[TelegramAdapter] bot.stop() failed');
    }
    try {
      await controls.close();
    } catch (err) {
      this.log.warn({ err }, '[TelegramAdapter] bot.api.close() failed');
    }
  }

  /**
   * Send a rich message as Telegram HTML-formatted text.
   * K2: If a pending inline placeholder exists for this chatId, edits it in-place
   * with HTML content instead of sending a new message.
   */
  async sendRichMessage(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
  ): Promise<void> {
    const html = formatTelegramHtml(blocks, catDisplayName, textContent);

    const inlineMsgId = this.pendingInlineFinal.get(externalChatId);
    if (inlineMsgId) {
      const age = this.nowFn() - (this.inlinePlaceholderTs.get(externalChatId) ?? 0);
      if (age > INLINE_PLACEHOLDER_MAX_AGE_MS) {
        // Stale placeholder: skip edit, clean up, fall through to send.
        this.pendingInlineFinal.delete(externalChatId);
        this.inlinePlaceholderTs.delete(externalChatId);
        await this.deleteMessage(inlineMsgId, externalChatId).catch(() => {});
      } else {
        try {
          await this.editMessage(externalChatId, inlineMsgId, html, { parse_mode: 'HTML' });
          // cloud-R12 P1: unconditionally clean placeholderChats (same fix as sendReply).
          this.placeholderChats.delete(inlineMsgId);
          if (this.pendingInlineFinal.get(externalChatId) === inlineMsgId) {
            this.pendingInlineFinal.delete(externalChatId);
            this.inlinePlaceholderTs.delete(externalChatId);
          }
          return;
        } catch (err) {
          this.log.warn({ err }, '[TelegramAdapter] sendRichMessage: editMessage failed, falling back to send');
          // Key intentionally preserved so cleanupPlaceholders can delete the stale card.
        }
      }
    }

    if (this.sendMessageFn) {
      await this.sendMessageFn(externalChatId, html, { parse_mode: 'HTML' });
      return;
    }

    await this.bot.api.sendMessage(externalChatId, html, { parse_mode: 'HTML' });
  }

  /**
   * Send a placeholder message for streaming and return its message ID.
   * Records the externalChatId mapping so deleteMessage can clean it up later.
   */
  async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
    const msg = this.botApiSendMessageFn
      ? await this.botApiSendMessageFn(Number(externalChatId), text)
      : await this.bot.api.sendMessage(Number(externalChatId), text);
    const msgId = String(msg.message_id);
    this.placeholderChats.set(msgId, externalChatId);
    return msgId;
  }

  /**
   * Delete a placeholder message after outbound delivery succeeds.
   * No-op if platformMessageId is unknown (delivery failed before placeholder was registered).
   * Cleans up the mapping after deletion to prevent double-delete.
   */
  async deleteMessage(platformMessageId: string, externalChatId?: string): Promise<void> {
    // Prefer caller-provided chatId; fall back to Map for adapters that don't pass it.
    // Telegram message_ids are only unique per-chat, so the Map alone is unsafe for multi-chat.
    const chatId = externalChatId ?? this.placeholderChats.get(platformMessageId);
    if (!chatId) return;
    try {
      if (this.botApiDeleteMessageFn) {
        await this.botApiDeleteMessageFn(Number(chatId), Number(platformMessageId));
      } else {
        await this.bot.api.deleteMessage(Number(chatId), Number(platformMessageId));
      }
    } finally {
      this.placeholderChats.delete(platformMessageId);
    }
  }

  /**
   * Edit an already-sent message in place (for streaming progressive updates and K2 inline final).
   * Truncates to Telegram's 4096-char limit.
   * opts.parse_mode: pass 'HTML' when editing with rich HTML content (K2 sendRichMessage inline).
   */
  async editMessage(
    externalChatId: string,
    platformMessageId: string,
    text: string,
    opts?: { parse_mode?: string },
  ): Promise<void> {
    const truncated =
      text.length > TELEGRAM_MAX_MESSAGE_LENGTH ? `${text.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH - 1)}…` : text;
    if (opts?.parse_mode) {
      await this.bot.api.editMessageText(
        Number(externalChatId),
        Number(platformMessageId),
        truncated,
        opts as Record<string, unknown>,
      );
    } else {
      await this.bot.api.editMessageText(Number(externalChatId), Number(platformMessageId), truncated);
    }
  }

  /**
   * K2: Register a pending inline-final placeholder.
   * The next sendReply or sendRichMessage to this chatId will edit this placeholder
   * instead of sending a new message. Consumed on first use.
   */
  registerInlinePlaceholder(externalChatId: string, platformMessageId: string): void {
    this.pendingInlineFinal.set(externalChatId, platformMessageId);
    this.inlinePlaceholderTs.set(externalChatId, this.nowFn());
  }

  /**
   * K2: Clear a registered inline-final placeholder without delivering content.
   * Called when delivery is skipped so stale state doesn't corrupt the next delivery.
   * If the placeholder was already consumed by sendReply/sendRichMessage, this is a no-op.
   * Deletes the streaming card from Telegram when entry was still pending (delivery skipped).
   */
  async clearInlinePlaceholder(chatId: string, platformMessageId?: string): Promise<void> {
    if (platformMessageId) {
      const stored = this.pendingInlineFinal.get(chatId);
      if (stored === platformMessageId) {
        // Only clear when the stored ID matches: protects a newer invocation's registration
        // that may have overwritten this one while cleanup was deferred.
        this.pendingInlineFinal.delete(chatId);
        this.inlinePlaceholderTs.delete(chatId);
        await this.deleteMessage(platformMessageId, chatId).catch(() => {});
      } else if (stored !== undefined) {
        // A newer placeholder (stored) has overwritten this one (platformMessageId).
        // Only delete platformMessageId if it's still a raw, unconsumed placeholder —
        // i.e. it was never edited by sendReply/sendRichMessage (which deletes from placeholderChats).
        if (this.placeholderChats.has(platformMessageId)) {
          await this.deleteMessage(platformMessageId, chatId).catch(() => {});
        }
      }
    } else {
      this.pendingInlineFinal.delete(chatId);
      this.inlinePlaceholderTs.delete(chatId);
    }
  }

  /**
   * Phase 5+6: Send a media message (image, file, or audio) to a Telegram chat.
   * Handles both public URLs and local file paths (via grammy InputFile).
   */
  async sendMedia(
    externalChatId: string,
    payload: { type: 'image' | 'file' | 'audio'; url?: string; absPath?: string; [key: string]: unknown },
  ): Promise<void> {
    if (!payload.url && !payload.absPath) return;
    const chatId = Number(externalChatId);
    // Priority: absPath (resolved by OutboundDeliveryHook) → local absolute path → URL string
    const absPath = typeof payload.absPath === 'string' ? payload.absPath : undefined;
    let source: string | InputFile;
    if (absPath) {
      source = new InputFile(absPath);
    } else if (payload.url?.startsWith('/') && !payload.url.startsWith('/api/')) {
      source = new InputFile(payload.url);
    } else {
      source = payload.url!;
    }
    const fns = this.sendMediaFns ?? {
      sendPhoto: (cid: number, input: string | InputFile) => this.bot.api.sendPhoto(cid, input),
      sendDocument: (cid: number, input: string | InputFile) => this.bot.api.sendDocument(cid, input),
      sendVoice: (cid: number, input: string | InputFile) => this.bot.api.sendVoice(cid, input),
    };
    switch (payload.type) {
      case 'image':
        await fns.sendPhoto(chatId, source);
        break;
      case 'file':
        await fns.sendDocument(chatId, source);
        break;
      case 'audio':
        await fns.sendVoice(chatId, source);
        break;
    }
  }

  /**
   * Test helper: inject a mock sendMessage function.
   * @internal
   */
  _injectSendMessage(fn: (chatId: string, text: string, opts?: Record<string, unknown>) => Promise<unknown>): void {
    this.sendMessageFn = fn;
  }

  /**
   * Test helper: inject mock media send functions.
   * @internal
   */
  _injectSendMedia(fns: {
    sendPhoto: (chatId: number, input: string | InputFile) => Promise<unknown>;
    sendDocument: (chatId: number, input: string | InputFile) => Promise<unknown>;
    sendVoice: (chatId: number, input: string | InputFile) => Promise<unknown>;
  }): void {
    this.sendMediaFns = fns;
  }

  /** @internal */
  _injectBotApiSendMessage(fn: (chatId: number, text: string) => Promise<{ message_id: number }>): void {
    this.botApiSendMessageFn = fn;
  }

  /** @internal */
  _injectBotApiDeleteMessage(fn: (chatId: number, messageId: number) => Promise<void>): void {
    this.botApiDeleteMessageFn = fn;
  }

  /** @internal — override Date.now() for TTL-sensitive tests. */
  _injectNowFn(fn: () => number): void {
    this.nowFn = fn;
  }

  /**
   * Test helper: inject long polling lifecycle controls.
   * @internal
   */
  _injectPollingControls(fns: Partial<TelegramPollingControls>): void {
    const defaults = this.getPollingControls();
    this.pollingControls = { ...defaults, ...fns };
  }
}
