/**
 * Thread Cats Callback Route — TD #408
 * GET /api/callbacks/thread-cats — discover cats in a thread via MCP callback auth.
 *
 * Reuses the same categorization logic as GET /api/threads/:id/cats (F142)
 * but authenticated via invocationId + callbackToken instead of binding-owner header.
 */

import { catRegistry, createCatId } from '@cat-cafe/shared';
import type { FastifyInstance } from 'fastify';
import { isCatAvailable } from '../config/cat-config-loader.js';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { callbackAuthSchema } from './callback-auth-schema.js';
import { EXPIRED_CREDENTIALS_ERROR } from './callback-errors.js';

interface ThreadCatsCallbackDeps {
  registry: InvocationRegistry;
  threadStore: IThreadStore;
  agentRegistry: { getAllEntries(): Map<string, unknown> };
}

const threadCatsQuerySchema = callbackAuthSchema.extend({});

export function registerCallbackThreadCatsRoutes(app: FastifyInstance, deps: ThreadCatsCallbackDeps): void {
  const { registry, threadStore, agentRegistry } = deps;

  app.get('/api/callbacks/thread-cats', async (request, reply) => {
    const parsed = threadCatsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Missing invocationId or callbackToken' };
    }

    const { invocationId, callbackToken } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    const threadId = record.threadId;
    if (!threadId) {
      reply.status(400);
      return { error: 'No threadId associated with this invocation' };
    }

    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    // Gather data — same logic as thread-cats.ts (F142)
    const participantActivity = await threadStore.getParticipantsWithActivity(threadId);
    const registeredServices = agentRegistry.getAllEntries();
    const allCatConfigs = catRegistry.getAllConfigs();
    const allCatIds = Object.keys(allCatConfigs);
    const participantIds = new Set(participantActivity.map((p) => p.catId));

    const getName = (catId: string): string => allCatConfigs[catId]?.displayName ?? catId;

    // Categorize (same as F142 KD-9)
    const routableNow: Array<{ catId: string; displayName: string }> = [];
    const routableNotJoined: Array<{ catId: string; displayName: string }> = [];
    const notRoutable: Array<{ catId: string; displayName: string }> = [];

    for (const catId of allCatIds) {
      const hasService = registeredServices.has(catId);
      const available = isCatAvailable(catId);
      const isParticipant = participantIds.has(createCatId(catId));

      if (!available && !isParticipant) {
        notRoutable.push({ catId, displayName: getName(catId) });
      } else if (hasService && available && !isParticipant) {
        routableNotJoined.push({ catId, displayName: getName(catId) });
      }
    }

    for (const p of participantActivity) {
      if (registeredServices.has(p.catId) && isCatAvailable(p.catId)) {
        routableNow.push({ catId: p.catId, displayName: getName(p.catId) });
      }
    }

    return {
      threadId,
      participants: participantActivity.map((p) => ({
        catId: p.catId,
        displayName: getName(p.catId),
        lastMessageAt: p.lastMessageAt,
        messageCount: p.messageCount,
      })),
      routableNow,
      routableNotJoined,
      notRoutable,
      routingPolicy: thread.routingPolicy ? `v${thread.routingPolicy.v}` : null,
    };
  });
}
