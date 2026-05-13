import type { FastifyRequest } from 'fastify';
import { normalizeTelegramBotToken } from '../infrastructure/connectors/telegram-token.js';
import { isConnectorSecret } from './connector-secrets-allowlist.js';

export const REDACTED_PLACEHOLDER = '••••••';

export interface ConnectorWriteRouteError {
  status: number;
  error: string;
}

export interface ConnectorSecretUpdateInput {
  name: string;
  value: string | null;
}

export function resolveConnectorSessionUserId(request: FastifyRequest): string | null {
  const sessionUserId = (request as FastifyRequest & { sessionUserId?: string }).sessionUserId;
  return typeof sessionUserId === 'string' && sessionUserId.trim() ? sessionUserId.trim() : null;
}

export function requireConnectorWriteOwner(userId: string): ConnectorWriteRouteError | null {
  const ownerId = process.env.DEFAULT_OWNER_USER_ID?.trim();
  if (!ownerId) {
    return {
      status: 403,
      error: 'Connector credential writes require DEFAULT_OWNER_USER_ID to be configured',
    };
  }
  if (userId !== ownerId) {
    return {
      status: 403,
      error: 'Connector credential writes can only be modified by the configured owner',
    };
  }
  return null;
}

export function containsRedactedPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(REDACTED_PLACEHOLDER);
  if (Array.isArray(value)) return value.some((item) => containsRedactedPlaceholder(item));
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => containsRedactedPlaceholder(item));
  }
  return false;
}

export function validateConnectorSecretUpdate(update: ConnectorSecretUpdateInput): string | null {
  if (!isConnectorSecret(update.name)) return `'${update.name}' is not in connector secrets allowlist`;
  if (containsRedactedPlaceholder(update.value)) {
    return 'Refusing to write redacted connector placeholder values';
  }
  if (
    update.name === 'TELEGRAM_BOT_TOKEN' &&
    update.value != null &&
    update.value !== '' &&
    normalizeTelegramBotToken(update.value) == null
  ) {
    return 'TELEGRAM_BOT_TOKEN must look like a Telegram BotFather token (<digits>:<token>)';
  }
  return null;
}

export function validateConnectorSecretUpdates(updates: ConnectorSecretUpdateInput[]): string | null {
  for (const update of updates) {
    const error = validateConnectorSecretUpdate(update);
    if (error) return error;
  }
  return null;
}
