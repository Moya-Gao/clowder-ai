/**
 * Message Actions Routes
 * DELETE /api/messages/:id       — soft/hard delete (ADR-008 D3 / S5+S6)
 * PATCH  /api/messages/:id/restore — restore soft-deleted message
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface MessageActionsRoutesOptions {
  messageStore: IMessageStore;
  socketManager: SocketManager;
  threadStore?: IThreadStore;
}

const deleteBodySchema = z.object({
  userId: z.string().min(1).max(100),
  mode: z.enum(['soft', 'hard']).default('soft'),
  /** Required for hard delete — must match thread title as confirmation */
  confirmTitle: z.string().optional(),
});

const restoreBodySchema = z.object({
  userId: z.string().min(1).max(100),
});

export const messageActionsRoutes: FastifyPluginAsync<MessageActionsRoutesOptions> =
  async (app, opts) => {

  // DELETE /api/messages/:id — soft or hard delete a single message
  app.delete<{ Params: { id: string } }>('/api/messages/:id', async (request, reply) => {
    const parseResult = deleteBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { id } = request.params;
    const { userId, mode, confirmTitle } = parseResult.data;

    if (mode === 'hard') {
      // Hard delete requires confirmTitle matching the thread title
      const msg = await opts.messageStore.getById(id);
      if (!msg) {
        reply.status(404);
        return { error: '消息不存在', code: 'MESSAGE_NOT_FOUND' };
      }

      if (!confirmTitle) {
        reply.status(400);
        return { error: '硬删除需要输入对话标题确认', code: 'CONFIRM_TITLE_REQUIRED' };
      }

      if (opts.threadStore) {
        const thread = await opts.threadStore.get(msg.threadId);
        if (thread && thread.title !== null && thread.title !== confirmTitle) {
          reply.status(400);
          return { error: '对话标题不匹配', code: 'CONFIRM_TITLE_MISMATCH' };
        }
      }

      const deleted = await opts.messageStore.hardDelete(id, userId);
      if (!deleted) {
        reply.status(404);
        return { error: '消息不存在', code: 'MESSAGE_NOT_FOUND' };
      }

      opts.socketManager.broadcastToRoom(
        `thread:${deleted.threadId}`,
        'message_hard_deleted',
        { messageId: id, threadId: deleted.threadId, deletedBy: userId },
      );

      return {
        id: deleted.id,
        threadId: deleted.threadId,
        deletedAt: deleted.deletedAt,
        deletedBy: deleted.deletedBy,
        _tombstone: true,
      };
    }

    // Soft delete (default)
    const deleted = await opts.messageStore.softDelete(id, userId);
    if (!deleted) {
      reply.status(404);
      return { error: '消息不存在', code: 'MESSAGE_NOT_FOUND' };
    }

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

  // PATCH /api/messages/:id/restore — restore a soft-deleted message (rejects tombstones)
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
      return { error: '消息不存在、未被删除、或已硬删除', code: 'MESSAGE_NOT_RESTORABLE' };
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
