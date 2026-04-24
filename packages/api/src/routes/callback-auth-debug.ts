/**
 * F174 Phase D1 — GET /api/debug/callback-auth (AC-D3).
 *
 * Returns the live failure-telemetry snapshot so operators can triage
 * callback auth issues without Prometheus / log tails. Shape matches
 * `getCallbackAuthFailureSnapshot()` from callback-auth-telemetry.
 *
 * Cloud Codex P1 sequence (PR #1377) walked through the bypass classes:
 *   - 18:50Z: public endpoint leaked per-tool failure counts + catIds
 *   - 19:11Z: resolveHeaderUserId trusted-origin fallback to 'default-user'
 *   - 19:31Z: raw X-Cat-Cafe-User header spoofable by any client
 *   - 20:30Z: same-origin browser GET can omit Origin
 *   - 20:46Z: DEFAULT_OWNER_USER_ID mismatch made endpoint unreachable
 *   - 21:00Z: `/api/session` mints sessions for anonymous callers —
 *             "has session" ≠ "authorized", so owner check IS required
 *
 * Final design: two-layer gate — session required AND session user must
 * match the configured owner. Owner defaults to 'default-user' (what
 * F156 D-1 session plugin currently mints). Operators running with
 * non-default DEFAULT_OWNER_USER_ID get 403 until session minting is
 * extended (F156 future work) — better fail-closed than silently public.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getCallbackAuthFailureSnapshot } from './callback-auth-telemetry.js';

function resolveSessionUserId(request: FastifyRequest): string | null {
  const fromSession = (request as FastifyRequest & { sessionUserId?: string }).sessionUserId;
  if (typeof fromSession === 'string' && fromSession.trim().length > 0) {
    return fromSession.trim();
  }
  return null;
}

export function registerCallbackAuthDebugRoute(app: FastifyInstance): void {
  app.get('/api/debug/callback-auth', async (request, reply) => {
    const operator = resolveSessionUserId(request);
    if (!operator) {
      reply.status(401);
      return { error: 'Authenticated session required (establish via GET /api/session)' };
    }
    // Cloud Codex P1 (PR #1377, 21:13Z): /api/session mints sessions for
    // anonymous callers as 'default-user', so a default-fallback owner gate
    // would let any network client read this telemetry. Mirror config.ts
    // sensitive-env pattern: require DEFAULT_OWNER_USER_ID to be EXPLICITLY
    // set — fail-closed beats permissive default. Operator opting in to
    // 'default-user' explicitly is informed consent for the F156 D-1
    // anonymous-minting limitation.
    const ownerId = process.env.DEFAULT_OWNER_USER_ID?.trim();
    if (!ownerId) {
      reply.status(403);
      return { error: 'Callback auth telemetry requires DEFAULT_OWNER_USER_ID to be explicitly configured' };
    }
    if (operator !== ownerId) {
      reply.status(403);
      return { error: 'Callback auth telemetry can only be accessed by the configured owner' };
    }
    return getCallbackAuthFailureSnapshot();
  });
}
