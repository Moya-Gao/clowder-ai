/**
 * F227 PR-1 Task 3 — Event Memory query route.
 *
 * GET /api/memory/events — filtered, paged, newest-first event list backed by
 * EventMemoryStore. Enum filters reuse the shared single-source const arrays.
 */

import { randomUUID } from 'node:crypto';
import type { StoredEventMemory } from '@cat-cafe/shared';
import { COGNITIVE_TRANSITIONS, EVENT_CONFIDENCES, EVENT_TRIGGERS } from '@cat-cafe/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { EventMemoryFilter, IEventMemoryStore } from '../domains/memory/EventMemoryStore.js';
import type { AgentKeyAuthRegistry, CallbackAuthRegistry } from './callback-auth-prehandler.js';
import { registerCallbackAuthHook } from './callback-auth-prehandler.js';

/**
 * F227 (砚砚 P1): Event Memory routes expose stored events + broadcast teleport
 * side effects — they must not be unauthenticated. Accept either a logged-in user
 * session (Hub frontend) or a verified callback principal (MCP via callbackPost).
 * The global callback-auth preHandler decorates request.callbackPrincipal;
 * the session middleware decorates request.sessionUserId.
 */
function isAuthenticated(request: FastifyRequest): boolean {
  const r = request as FastifyRequest & { sessionUserId?: string; callbackPrincipal?: unknown };
  return Boolean(r.sessionUserId) || Boolean(r.callbackPrincipal);
}

/** Query params — z.coerce handles GET string → number; enums reuse shared arrays. */
const listSchema = z.object({
  trigger: z.enum(EVENT_TRIGGERS).optional(),
  cat: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
  confidence: z.enum(EVENT_CONFIDENCES).optional(),
  cognitiveTransition: z.enum(COGNITIVE_TRANSITIONS).optional(),
  since: z.coerce.number().int().optional(),
  until: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export interface EventsRoutesOptions {
  eventMemoryStore: IEventMemoryStore;
  /** F227: socket emitter for thread:teleport navigation events. */
  socketEmit?: (event: string, data: unknown, room: string) => void;
  /** F227 (砚砚 R2 P1): callback auth for the MCP path (cat_cafe_teleport via
   * callbackPost). Fastify encapsulation means a sibling plugin's hook does NOT
   * cover us — register our own in this plugin's scope. */
  callbackRegistry?: CallbackAuthRegistry;
  agentKeyRegistry?: AgentKeyAuthRegistry;
}

export interface EventsListResponse {
  events: StoredEventMemory[];
  meta: { count: number; limit: number | null; offset: number };
}

export const eventsRoutes: FastifyPluginAsync<EventsRoutesOptions> = async (app, opts) => {
  // F227 (砚砚 R2 P1): register callback auth in THIS plugin's scope so MCP
  // callbackPost (cat_cafe_teleport) X-Invocation-Id/X-Callback-Token headers
  // actually decorate request.callbackPrincipal. Fastify encapsulation means a
  // sibling plugin's hook does not reach sibling routes.
  if (opts.callbackRegistry) {
    registerCallbackAuthHook(app, opts.callbackRegistry, { agentKeyRegistry: opts.agentKeyRegistry });
  }

  app.get('/api/memory/events', async (request, reply) => {
    if (!isAuthenticated(request)) {
      reply.status(401);
      return { error: 'auth required' };
    }
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parsed.error.issues };
    }

    const filter: EventMemoryFilter = parsed.data;
    const events = opts.eventMemoryStore.listEvents(filter);
    const response: EventsListResponse = {
      events,
      meta: { count: events.length, limit: filter.limit ?? null, offset: filter.offset ?? 0 },
    };
    return response;
  });

  // F227 Task 4: generic teleport — POST /api/memory/teleport → socket thread:teleport.
  // Independent socket event (does NOT reuse workspace:navigate, per design gate).
  // Takes a real (threadId, messageId); the Hub switches thread + scrolls to it.
  app.post<{ Body: { threadId?: string; messageId?: string; catId?: string } }>(
    '/api/memory/teleport',
    async (request, reply) => {
      if (!isAuthenticated(request)) {
        reply.status(401);
        return { error: 'auth required' };
      }
      const { threadId, messageId } = request.body ?? {};
      if (!threadId || !messageId) {
        reply.status(400);
        return { error: 'threadId and messageId required' };
      }
      const eventData = { threadId, messageId, eventId: randomUUID() };
      opts.socketEmit?.('thread:teleport', eventData, 'workspace:global');
      return { ok: true, threadId, messageId };
    },
  );
};
