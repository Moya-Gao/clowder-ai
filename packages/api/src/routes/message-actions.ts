/**
 * Message Actions Routes
 * DELETE /api/messages/:id  — soft delete (ADR-008 D3 / S5)
 * PATCH  /api/messages/:id/restore — restore soft-deleted message
 *
 * Hard delete (S6) will extend DELETE with mode='hard'.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface MessageActionsRoutesOptions {
  messageStore: IMessageStore;
  socketManager: SocketManager;
}

const deleteBodySchema = z.object({
  userId: z.string().min(1).max(100),
  mode: z.enum(['soft']).default('soft'),
});

const restoreBodySchema = z.object({
  userId: z.string().min(1).max(100),
});

export const messageActionsRoutes: FastifyPluginAsync<MessageActionsRoutesOptions> =
  async (app, opts) => {

  // DELETE /api/messages/:id — soft delete a single message
  app.delete<{ Params: { id: string } }>('/api/messages/:id', async (request, reply) => {
    const parseResult = deleteBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { id } = request.params;
    const { userId } = parseResult.data;

    const deleted = await opts.messageStore.softDelete(id, userId);
    if (!deleted) {
      reply.status(404);
      return { error: '消息不存在', code: 'MESSAGE_NOT_FOUND' };
    }

    // Broadcast to thread room so frontend can update in real time
    opts.socketManager.broadcastToRoom(
      `thread:${deleted.threadId}`,
      'message_deleted',
      { messageId: id, threadId: deleted.threadId, deletedBy: userId },
    );

    return {
      id: deleted.id,
      threadId: deleted.threadId,
      deletedAt: deleted.deletedAt,
      deletedBy: deleted.deletedBy,
    };
  });

  // PATCH /api/messages/:id/restore — restore a soft-deleted message
  app.patch<{ Params: { id: string } }>('/api/messages/:id/restore', async (request, reply) => {
    const parseResult = restoreBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { id } = request.params;

    const restored = await opts.messageStore.restore(id);
    if (!restored) {
      reply.status(404);
      return { error: '消息不存在或未被删除', code: 'MESSAGE_NOT_DELETED' };
    }

    opts.socketManager.broadcastToRoom(
      `thread:${restored.threadId}`,
      'message_restored',
      { messageId: id, threadId: restored.threadId },
    );

    return {
      id: restored.id,
      threadId: restored.threadId,
      content: restored.content,
      timestamp: restored.timestamp,
    };
  });
};
