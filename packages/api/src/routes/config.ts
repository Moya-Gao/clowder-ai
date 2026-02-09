/**
 * Config Route
 * GET   /api/config — 返回运行时配置快照
 * PATCH /api/config — 热更新可变配置 (F4)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collectConfigSnapshot } from '../config/ConfigRegistry.js';
import { configStore } from '../config/ConfigStore.js';

const patchSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/config', async () => ({
    config: collectConfigSnapshot(),
  }));

  app.patch('/api/config', async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request', details: parsed.error.issues };
    }
    try {
      configStore.set(parsed.data.key, String(parsed.data.value));
    } catch (err) {
      reply.status(400);
      return { error: (err as Error).message };
    }
    return { config: collectConfigSnapshot() };
  });
}
