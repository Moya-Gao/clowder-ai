import type { FastifyPluginAsync } from 'fastify';
import { SignalArticleStatusSchema } from '@cat-cafe/shared';
import { z } from 'zod';
import { resolveSignalPaths } from '../domains/signals/config/sources-loader.js';
import { SignalArticleQueryService } from '../domains/signals/services/article-query-service.js';
import { StudyMetaService } from '../domains/signals/services/study-meta-service.js';
import { resolveUserId } from '../utils/request-identity.js';

const linkThreadBodySchema = z.object({
  threadId: z.string().min(1),
});

const batchArticleBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['update', 'delete']),
  fields: z
    .object({
      status: SignalArticleStatusSchema.optional(),
      tags: z.array(z.string().min(1).max(80)).max(32).optional(),
      note: z.string().max(2000).optional(),
    })
    .optional(),
});

export const signalStudyRoutes: FastifyPluginAsync = async (app) => {
  const paths = resolveSignalPaths();
  const articleQuery = new SignalArticleQueryService({ paths });
  const studyMeta = new StudyMetaService();

  app.get('/api/signals/articles/:id/study', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const params = request.params as { id?: string };
    if (!params.id) {
      reply.status(400);
      return { error: 'Article id is required' };
    }

    const article = await articleQuery.getArticleById(params.id);
    if (!article) {
      reply.status(404);
      return { error: `Article not found: ${params.id}` };
    }

    const meta = await studyMeta.readMeta(params.id, article.filePath);
    return { meta };
  });

  app.post('/api/signals/articles/:id/threads', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const params = request.params as { id?: string };
    if (!params.id) {
      reply.status(400);
      return { error: 'Article id is required' };
    }

    const parsed = linkThreadBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const article = await articleQuery.getArticleById(params.id);
    if (!article) {
      reply.status(404);
      return { error: `Article not found: ${params.id}` };
    }

    const meta = await studyMeta.linkThread(params.id, article.filePath, {
      threadId: parsed.data.threadId,
      linkedBy: userId,
    });

    return { meta };
  });

  app.delete('/api/signals/articles/:id/threads/:threadId', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const params = request.params as { id?: string; threadId?: string };
    if (!params.id || !params.threadId) {
      reply.status(400);
      return { error: 'Article id and thread id are required' };
    }

    const article = await articleQuery.getArticleById(params.id);
    if (!article) {
      reply.status(404);
      return { error: `Article not found: ${params.id}` };
    }

    const meta = await studyMeta.unlinkThread(params.id, article.filePath, params.threadId);
    return { meta };
  });

  // --- Article DELETE (soft-delete) and batch operations ---

  app.delete('/api/signals/articles/:id', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }

    const params = request.params as { id?: string };
    if (!params.id || params.id.trim().length === 0) {
      reply.status(400);
      return { error: 'Article id is required' };
    }

    const article = await articleQuery.updateArticle(params.id, {
      deletedAt: new Date().toISOString(),
    });
    if (!article) {
      reply.status(404);
      return { error: `Article not found: ${params.id}` };
    }

    return { deleted: true, id: params.id };
  });

  app.post('/api/signals/articles/batch', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) { reply.status(401); return { error: 'Identity required' }; }

    const parsed = batchArticleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { ids, action, fields } = parsed.data;
    let affected = 0;

    for (const id of ids) {
      const input = action === 'delete'
        ? { deletedAt: new Date().toISOString() }
        : fields ?? {};
      const result = await articleQuery.updateArticle(id, input);
      if (result) affected++;
    }

    return { affected, action };
  });
};
