/**
 * Cats API Routes
 * GET /api/cats - 获取所有猫猫信息
 * GET /api/cats/:id/status - 获取猫猫状态
 */

import type { FastifyPluginAsync } from 'fastify';
import { CAT_CONFIGS } from '@cat-cafe/shared';

export const catsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/cats - 获取所有猫猫配置
  app.get('/api/cats', async () => {
    return {
      cats: Object.values(CAT_CONFIGS).map((cat) => ({
        id: cat.id,
        displayName: cat.displayName,
        color: cat.color,
        mentionPatterns: cat.mentionPatterns,
      })),
    };
  });

  // GET /api/cats/:id/status - 获取猫猫状态
  app.get<{ Params: { id: string } }>('/api/cats/:id/status', async (request, reply) => {
    const { id } = request.params;
    const cat = CAT_CONFIGS[id as keyof typeof CAT_CONFIGS];

    if (!cat) {
      reply.status(404);
      return { error: 'Cat not found' };
    }

    // Cat status is currently tracked via WebSocket events (ThinkingIndicator/ParallelStatusBar).
    // This endpoint returns placeholder data; Redis-backed polling status is a future enhancement.
    // See: InvocationTracker for per-thread tracking, not per-cat.
    return {
      id: cat.id,
      displayName: cat.displayName,
      status: 'idle',
      lastActive: Date.now(),
    };
  });
};
