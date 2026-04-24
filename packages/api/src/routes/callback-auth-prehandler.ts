/**
 * Unified callback auth preHandler (#476)
 *
 * Extracts X-Invocation-Id + X-Callback-Token from HTTP headers,
 * verifies via InvocationRegistry, and decorates request.callbackAuth.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { InvocationRecord, VerifyResult } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import { recordCallbackAuthFailure } from './callback-auth-telemetry.js';
import { makeCallbackAuthError } from './callback-errors.js';

/**
 * F174 Phase D1: derive a concise tool name from the request URL for
 * `cat_cafe.callback_auth.failures{callback.tool}` attribute. Strips
 * `/api/callbacks/` prefix and any query string; returns `unknown` if
 * the URL doesn't follow the callback route shape (defensive default).
 */
function callbackToolFromUrl(url: string): string {
  const path = url.split('?')[0];
  const match = path.match(/^\/api\/callbacks\/([^/]+)/);
  return match ? match[1] : 'unknown';
}

declare module 'fastify' {
  interface FastifyRequest {
    callbackAuth?: InvocationRecord;
  }
}

interface CallbackAuthRegistry {
  verify(invocationId: string, callbackToken: string): Promise<VerifyResult>;
}

/** Register the callbackAuth decoration + preHandler on a Fastify instance.
 *
 *  Behavior:
 *  1. Try X-Invocation-Id + X-Callback-Token headers (preferred)
 *  2. Fallback: read from body/query (legacy compat window, logs deprecation)
 *  3. Neither present → no-op (panel / non-callback request)
 *  4. Credentials present but invalid → immediate 401 (fail-closed, #474)
 */
export function registerCallbackAuthHook(app: FastifyInstance, registry: CallbackAuthRegistry): void {
  if (!app.hasRequestDecorator('callbackAuth')) {
    app.decorateRequest('callbackAuth', undefined);
  }
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // F174-C (cloud Codex P2 #1368, 05de7c98b): refresh-token route does its
    // own atomic verifyLatest in preValidation and pre-populates callbackAuth.
    // Skip the second verify here to avoid double-slide and to preserve the
    // atomicity guarantee against the preValidation/preHandler race window.
    if (request.callbackAuth) return;

    let invocationId = firstHeaderValue(request.headers['x-invocation-id']);
    let callbackToken = firstHeaderValue(request.headers['x-callback-token']);
    let legacy = false;

    // Fallback: body/query for legacy MCP clients (#476 compat window)
    if (!invocationId && !callbackToken) {
      const fromBody = extractLegacyCredentials(request);
      if (fromBody) {
        invocationId = fromBody.invocationId;
        callbackToken = fromBody.callbackToken;
        legacy = true;
      }
    }

    if (!invocationId && !callbackToken) return;
    const tool = callbackToolFromUrl(request.url);
    if (!invocationId || !callbackToken) {
      recordCallbackAuthFailure({ reason: 'missing_creds', tool });
      reply.status(401).send(makeCallbackAuthError('missing_creds'));
      return;
    }
    const result = await registry.verify(invocationId, callbackToken);
    if (!result.ok) {
      recordCallbackAuthFailure({ reason: result.reason, tool });
      reply.status(401).send(makeCallbackAuthError(result.reason));
      return;
    }
    if (legacy) {
      request.log.warn(
        { invocationId, path: request.url },
        '[#476 DEPRECATED] Callback credentials received via body/query — migrate to X-Invocation-Id / X-Callback-Token headers',
      );
    }
    request.callbackAuth = result.record;
  });
}

/**
 * F174-C — single source of truth for "what callback creds does this request
 * actually present?" Used by both preHandler and refresh-token preValidation
 * so the cooldown decision matches the auth decision (gpt52 P1 #3 #1368:
 * mismatched rules let mixed-source bad-auth burn cooldown slot).
 *
 * Rule (mirror of preHandler's auth flow):
 *   - If both headers present → headers win (returns the header pair)
 *   - Else if BOTH headers absent and legacy body/query has both → legacy creds
 *   - Otherwise (partial headers, mixed source, etc.) → null (request will
 *     be rejected by preHandler as missing_creds)
 *
 * Returns canonical creds (both fields present) or null. Caller can detect
 * "auth attempt happened" separately if it needs to distinguish panel path
 * from missing_creds.
 */
export function extractCallbackCredentials(
  request: FastifyRequest,
): { invocationId: string; callbackToken: string } | null {
  const headerInv = firstHeaderValue(request.headers['x-invocation-id']);
  const headerTok = firstHeaderValue(request.headers['x-callback-token']);

  if (headerInv && headerTok) {
    return { invocationId: headerInv, callbackToken: headerTok };
  }
  // Legacy fallback ONLY when both headers absent (matches preHandler line 40).
  // Mixed-source (e.g. header inv + body tok) explicitly returns null so
  // cooldown is never claimed for a request that preHandler will 401.
  if (!headerInv && !headerTok) {
    const legacy = extractLegacyCredentials(request);
    if (legacy?.invocationId && legacy?.callbackToken) {
      return { invocationId: legacy.invocationId, callbackToken: legacy.callbackToken };
    }
  }
  return null;
}

/**
 * Extract legacy credentials from body (POST) or query (GET).
 * Returns partial results so the caller's `!id || !token` guard
 * rejects malformed requests (fail-closed, consistent with headers).
 *
 * Exported for F174-C refresh-token cooldown — that hook needs to recognize
 * legacy creds path so cooldown applies uniformly (cloud Codex P1 #1368).
 */
export function extractLegacyCredentials(
  request: FastifyRequest,
): { invocationId: string | undefined; callbackToken: string | undefined } | null {
  const body = request.body as Record<string, unknown> | undefined;
  if (body) {
    const id = typeof body.invocationId === 'string' ? body.invocationId : undefined;
    const tok = typeof body.callbackToken === 'string' ? body.callbackToken : undefined;
    if (id || tok) return { invocationId: id, callbackToken: tok };
  }
  const query = request.query as Record<string, unknown> | undefined;
  if (query) {
    const id = typeof query.invocationId === 'string' ? query.invocationId : undefined;
    const tok = typeof query.callbackToken === 'string' ? query.callbackToken : undefined;
    if (id || tok) return { invocationId: id, callbackToken: tok };
  }
  return null;
}

/** Require callbackAuth on the request — returns record or sends 401. */
export function requireCallbackAuth(request: FastifyRequest, reply: FastifyReply): InvocationRecord | null {
  if (request.callbackAuth) return request.callbackAuth;
  reply.status(401);
  // unknown_invocation: preHandler didn't decorate the request, which means
  // either creds were missing entirely (handled above) or the route was hit
  // without going through the preHandler chain. Surfacing as unknown is safer
  // than expired (we don't actually know the registry state here).
  recordCallbackAuthFailure({ reason: 'unknown_invocation', tool: callbackToolFromUrl(request.url) });
  reply.send(makeCallbackAuthError('unknown_invocation'));
  return null;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (Array.isArray(value)) return value[0] || undefined;
  return undefined;
}
