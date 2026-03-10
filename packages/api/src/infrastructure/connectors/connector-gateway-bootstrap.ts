/**
 * Connector Gateway Bootstrap
 * Wires all connector gateway components together.
 *
 * Follows github-review-bootstrap.ts pattern:
 * - Takes options with dependencies
 * - Checks env config before starting
 * - Returns lifecycle handle { stop }
 *
 * F088 Multi-Platform Chat Gateway
 */

import type { CatId, ConnectorSource } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import type { FastifyBaseLogger } from 'fastify';
import type { ConnectorWebhookHandler, WebhookHandleResult } from '../../routes/connector-webhooks.js';
import { FeishuAdapter } from './adapters/FeishuAdapter.js';
import { TelegramAdapter } from './adapters/TelegramAdapter.js';
import { ConnectorRouter } from './ConnectorRouter.js';
import { MemoryConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';
import { InboundMessageDedup } from './InboundMessageDedup.js';
import { type IOutboundAdapter, OutboundDeliveryHook } from './OutboundDeliveryHook.js';
import { RedisConnectorThreadBindingStore } from './RedisConnectorThreadBindingStore.js';

export interface ConnectorGatewayConfig {
  telegramBotToken?: string | undefined;
  feishuAppId?: string | undefined;
  feishuAppSecret?: string | undefined;
  feishuVerificationToken?: string | undefined;
  /** Override owner userId for connector threads. Read from DEFAULT_OWNER_USER_ID env. */
  ownerUserId?: string | undefined;
}

export interface ConnectorGatewayDeps {
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
  readonly redis?: RedisClient | undefined;
  readonly log: FastifyBaseLogger;
}

export interface ConnectorGatewayHandle {
  readonly outboundHook: OutboundDeliveryHook;
  readonly webhookHandlers: Map<string, ConnectorWebhookHandler>;
  stop(): Promise<void>;
}

export function loadConnectorGatewayConfig(): ConnectorGatewayConfig {
  return {
    telegramBotToken: process.env['TELEGRAM_BOT_TOKEN'],
    feishuAppId: process.env['FEISHU_APP_ID'],
    feishuAppSecret: process.env['FEISHU_APP_SECRET'],
    feishuVerificationToken: process.env['FEISHU_VERIFICATION_TOKEN'],
    ownerUserId: process.env['DEFAULT_OWNER_USER_ID'],
  };
}

export async function startConnectorGateway(
  config: ConnectorGatewayConfig,
  deps: ConnectorGatewayDeps,
): Promise<ConnectorGatewayHandle | null> {
  const { log } = deps;

  const hasTelegram = Boolean(config.telegramBotToken);
  const hasFeishu = Boolean(config.feishuAppId && config.feishuAppSecret && config.feishuVerificationToken);

  if (!hasTelegram && !hasFeishu) {
    log.info(
      '[ConnectorGateway] No connectors configured (set TELEGRAM_BOT_TOKEN or FEISHU_APP_ID + FEISHU_APP_SECRET + FEISHU_VERIFICATION_TOKEN)',
    );
    return null;
  }

  const bindingStore = deps.redis
    ? new RedisConnectorThreadBindingStore(deps.redis)
    : new MemoryConnectorThreadBindingStore();
  const dedup = new InboundMessageDedup();
  log.info({ store: deps.redis ? 'redis' : 'memory' }, '[ConnectorGateway] Binding store initialized');
  const adapters = new Map<string, IOutboundAdapter>();
  const webhookHandlers = new Map<string, ConnectorWebhookHandler>();
  const stopFns: Array<() => Promise<void>> = [];

  // Use ownerUserId from config (DEFAULT_OWNER_USER_ID env) if set,
  // otherwise fall back to deps.defaultUserId.
  // This ensures connector threads are created with the real owner's userId,
  // making them visible in the frontend thread list. (F088 ISSUE-1 fix)
  const effectiveUserId = config.ownerUserId || deps.defaultUserId;

  const connectorRouter = new ConnectorRouter({
    bindingStore,
    dedup,
    messageStore: deps.messageStore,
    threadStore: deps.threadStore,
    invokeTrigger: deps.invokeTrigger,
    socketManager: deps.socketManager,
    defaultUserId: effectiveUserId,
    defaultCatId: deps.defaultCatId,
    log,
  });

  // ── Telegram (long polling) ──
  if (hasTelegram) {
    const telegram = new TelegramAdapter(config.telegramBotToken!, log);
    adapters.set('telegram', telegram);

    telegram.startPolling(async (msg) => {
      await connectorRouter.route('telegram', msg.chatId, msg.text, msg.messageId);
    });

    stopFns.push(async () => telegram.stopPolling());
    log.info('[ConnectorGateway] Telegram adapter started (long polling)');
  }

  // ── Feishu (webhook) ──
  if (hasFeishu) {
    const feishu = new FeishuAdapter(config.feishuAppId!, config.feishuAppSecret!, log, {
      verificationToken: config.feishuVerificationToken,
    });
    adapters.set('feishu', feishu);

    // Register webhook handler for the route
    webhookHandlers.set('feishu', {
      connectorId: 'feishu',
      async handleWebhook(body, _headers): Promise<WebhookHandleResult> {
        // Handle verification challenge (no token check — challenge is pre-auth)
        const challenge = feishu.isVerificationChallenge(body);
        if (challenge) {
          return { kind: 'challenge', response: { challenge: challenge.challenge } };
        }

        // Verify event token (AC-4: webhook authentication)
        if (!feishu.verifyEventToken(body)) {
          return { kind: 'error', status: 403, message: 'Invalid verification token' };
        }

        // Parse event
        const parsed = feishu.parseEvent(body);
        if (!parsed) {
          return { kind: 'skipped', reason: 'unsupported_event' };
        }

        const result = await connectorRouter.route('feishu', parsed.chatId, parsed.text, parsed.messageId);

        if (result.kind === 'skipped') {
          return { kind: 'skipped', reason: result.reason };
        }

        return { kind: 'processed', messageId: result.messageId };
      },
    });

    log.info('[ConnectorGateway] Feishu adapter registered (webhook mode)');
  }

  const outboundHook = new OutboundDeliveryHook({
    bindingStore,
    adapters,
    log,
  });

  return {
    outboundHook,
    webhookHandlers,
    async stop() {
      await Promise.allSettled(stopFns.map((fn) => fn()));
      log.info('[ConnectorGateway] Stopped');
    },
  };
}
