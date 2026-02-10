/**
 * Unified request identity resolver.
 *
 * Priority: X-Cat-Cafe-User header > userId query param > null
 *
 * Header-based identity is preferred because:
 * - Not logged in access logs / referer headers / browser history
 * - Single injection point in frontend api-client
 * - Easier to upgrade to JWT/session later
 */

import type { FastifyRequest } from 'fastify';

export function resolveUserId(request: FastifyRequest): string | null {
  const fromHeader = request.headers['x-cat-cafe-user'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const query = request.query as Record<string, unknown>;
  const fromQuery = query['userId'];
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }
  return null;
}
