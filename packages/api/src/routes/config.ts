/**
 * Config Route
 * GET /api/config — 返回运行时配置快照
 */

import type { FastifyInstance } from 'fastify';
import { collectConfigSnapshot } from '../config/ConfigRegistry.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/config', async () => ({
    config: collectConfigSnapshot(),
  }));
}
