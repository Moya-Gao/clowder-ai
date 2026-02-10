/**
 * Thread Branch Route
 * POST /api/threads/:id/branch — create conversation branch (ADR-008 D4 / S7)
 *
 * Edit = Branch: editing a message creates a new thread with history
 * up to that message, replacing the last message with edited content.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface ThreadBranchRoutesOptions {
  threadStore: IThreadStore;
  messageStore: IMessageStore;
  socketManager: SocketManager;
}

const branchSchema = z.object({
  fromMessageId: z.string().min(1),
  editedContent: z.string().optional(),
  userId: z.string().min(1).max(100),
});

export const threadBranchRoutes: FastifyPluginAsync<ThreadBranchRoutesOptions> =
  async (app, opts) => {
  const { threadStore, messageStore, socketManager } = opts;

  // POST /api/threads/:id/branch — create branch from a message
  app.post<{ Params: { id: string } }>('/api/threads/:id/branch', async (request, reply) => {
    const { id } = request.params;
    const parseResult = branchSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { fromMessageId, editedContent, userId } = parseResult.data;

    // ① Verify source thread exists
    const sourceThread = await threadStore.get(id);
    if (!sourceThread) {
      reply.status(404);
      return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
    }

    // ② Verify fromMessage exists and belongs to this thread
    const fromMessage = await messageStore.getById(fromMessageId);
    if (!fromMessage || fromMessage.threadId !== id) {
      reply.status(400);
      return { error: '指定的消息不存在或不属于此对话', code: 'INVALID_FROM_MESSAGE' };
    }

    // ③ Get all visible messages up to and including fromMessage
    // getByThread filters soft-deleted/tombstone — cannot branch from deleted messages
    const allMessages = await messageStore.getByThread(id, 10000);
    const cutIndex = allMessages.findIndex(m => m.id === fromMessageId);
    if (cutIndex === -1) {
      reply.status(400);
      return { error: '无法从已删除的消息创建分支', code: 'FROM_MESSAGE_DELETED' };
    }
    const messagesToCopy = allMessages.slice(0, cutIndex + 1);

    // ④ Create new thread with "(分支)" suffix
    const branchTitle = sourceThread.title
      ? `${sourceThread.title} (分支)`
      : '分支对话';
    const newThread = await threadStore.create(userId, branchTitle, sourceThread.projectPath);

    // Copy participants from source thread
    if (sourceThread.participants.length > 0) {
      await threadStore.addParticipants(newThread.id, sourceThread.participants);
    }

    // ⑤ Copy messages to new thread (new IDs, original content preserved)
    for (let i = 0; i < messagesToCopy.length; i++) {
      const src = messagesToCopy[i]!;
      const isLast = i === messagesToCopy.length - 1;
      const content = (isLast && editedContent !== undefined) ? editedContent : src.content;

      await messageStore.append({
        userId: src.userId,
        catId: src.catId,
        content,
        // Drop contentBlocks on edited message (text changed)
        ...(src.contentBlocks && !(isLast && editedContent !== undefined)
          ? { contentBlocks: src.contentBlocks } : {}),
        ...(src.metadata ? { metadata: src.metadata } : {}),
        mentions: [...src.mentions],
        timestamp: src.timestamp,
        threadId: newThread.id,
      });
    }

    // Notify frontend about new branch
    socketManager.broadcastToRoom(
      `thread:${id}`,
      'thread_branched',
      { sourceThreadId: id, newThreadId: newThread.id, fromMessageId },
    );

    reply.status(201);
    return {
      threadId: newThread.id,
      messageCount: messagesToCopy.length,
      title: branchTitle,
    };
  });
};
