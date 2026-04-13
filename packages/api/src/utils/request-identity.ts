/**
 * Unified request identity resolver.
 *
 * Browser path (Origin header present): session cookie only.
 * Non-browser path (no Origin): session cookie > X-Cat-Cafe-User header > fallback.
 *
 * This prevents cross-origin pages from exploiting the X-Cat-Cafe-User header
 * or default-user fallback, even when CORS_ALLOW_PRIVATE_NETWORK is enabled.
 */

import type { FastifyRequest } from 'fastify';

export interface ResolveUserIdOptions {
  /** Optional explicit fallback (e.g., legacy body/form field). */
  fallbackUserId?: unknown;
  /** Optional final fallback (e.g., 'default-user' for backward compatibility). */
  defaultUserId?: string;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveHeaderUserId(request: FastifyRequest): string | null {
  const fromSession = nonEmptyString((request as FastifyRequest & { sessionUserId?: string }).sessionUserId);
  if (fromSession) return fromSession;
  if (request.headers.origin) return null;
  return nonEmptyString(request.headers['x-cat-cafe-user']);
}

export function resolveUserId(request: FastifyRequest, options?: ResolveUserIdOptions): string | null {
  // F156 D-1: session cookie is the primary identity source
  const fromSession = nonEmptyString((request as FastifyRequest & { sessionUserId?: string }).sessionUserId);
  if (fromSession) return fromSession;

  const fromHeader = resolveHeaderUserId(request);
  if (fromHeader) return fromHeader;

  if (request.headers.origin) return null;

  const fromFallback = nonEmptyString(options?.fallbackUserId);
  if (fromFallback) return fromFallback;

  return nonEmptyString(options?.defaultUserId);
}
