/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ClaudeAgentService } from '../domains/cats/services/index.js';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  const claudeService = new ClaudeAgentService();

  // POST /api/messages - 发送消息（SSE 流式响应）
  app.post('/api/messages', async (request, reply) => {
    // Validate request body
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }
    const body = parseResult.data;

    // Set up SSE
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    try {
      for await (const msg of claudeService.invoke(body.content)) {
        const data = JSON.stringify(msg);
        reply.raw.write(`data: ${data}\n\n`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
    }

    reply.raw.end();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    // TODO: Implement message history from file/redis
    return { messages: [], total: 0 };
  });
};
