/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CatId } from '@cat-cafe/shared';
import { ClaudeAgentService } from '../domains/cats/services/index.js';
import { getSocketManager } from '../index.js';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  const claudeService = new ClaudeAgentService();

  // POST /api/messages - 发送消息（WebSocket 广播）
  app.post('/api/messages', async (request, reply) => {
    // Validate request body
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }
    const body = parseResult.data;

    const socketManager = getSocketManager();

    // Return immediately with processing status
    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    void (async () => {
      try {
        for await (const msg of claudeService.invoke(body.content)) {
          socketManager.broadcastAgentMessage(msg);
        }
      } catch (err) {
        console.error('[messages] Background processing error:', err);
        socketManager.broadcastAgentMessage({
          type: 'error',
          catId: 'opus' as CatId,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    })();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    // TODO: Implement message history from file/redis
    return { messages: [], total: 0 };
  });
};
