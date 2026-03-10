import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CollectionService } from '../domains/signals/services/collection-service.js';
import { resolveUserId } from '../utils/request-identity.js';

const createBodySchema = z.object({
  name: z.string().min(1).max(100),
  articleIds: z.array(z.string()).optional(),
});

const updateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  articleIds: z.array(z.string()).optional(),
});

export const signalCollectionRoutes: FastifyPluginAsync = async (app) => {
  const collections = new CollectionService();

  app.get('/api/signals/collections', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }
    const list = await collections.list();
    return { collections: list };
  });

  app.get('/api/signals/collections/:id', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }
    const params = request.params as { id?: string };
    if (!params.id) { reply.status(400); return { error: 'Collection id required' }; }
    const col = await collections.get(params.id);
    if (!col) { reply.status(404); return { error: 'Collection not found' }; }
    return { collection: col };
  });

  app.post('/api/signals/collections', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) { reply.status(400); return { error: 'Invalid body', details: parsed.error.issues }; }
    const col = await collections.create(parsed.data.name, parsed.data.articleIds);
    reply.status(201);
    return { collection: col };
  });

  app.patch('/api/signals/collections/:id', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }
    const params = request.params as { id?: string };
    if (!params.id) { reply.status(400); return { error: 'Collection id required' }; }
    const parsed = updateBodySchema.safeParse(request.body);
    if (!parsed.success) { reply.status(400); return { error: 'Invalid body', details: parsed.error.issues }; }
    const col = await collections.update(params.id, parsed.data);
    if (!col) { reply.status(404); return { error: 'Collection not found' }; }
    return { collection: col };
  });

  app.delete('/api/signals/collections/:id', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }
    const params = request.params as { id?: string };
    if (!params.id) { reply.status(400); return { error: 'Collection id required' }; }
    const removed = await collections.remove(params.id);
    if (!removed) { reply.status(404); return { error: 'Collection not found' }; }
    return { ok: true };
  });
};
