import { readFile } from 'node:fs/promises';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveSignalPaths } from '../domains/signals/config/sources-loader.js';
import { SignalArticleQueryService } from '../domains/signals/services/article-query-service.js';
import { generatePodcastScript } from '../domains/signals/services/podcast-generator.js';
import { StudyMetaService } from '../domains/signals/services/study-meta-service.js';
import { resolveUserId } from '../utils/request-identity.js';

const podcastBodySchema = z.object({
  mode: z.enum(['essence', 'deep']).default('essence'),
});

async function buildThreadContext(
  studyMeta: StudyMetaService,
  articleId: string,
  filePath: string,
): Promise<string | undefined> {
  const meta = await studyMeta.readMeta(articleId, filePath);
  const parts: string[] = [];

  // Include notes artifacts content if available
  const notesArtifacts = meta.artifacts.filter((a) => a.kind === 'note' && a.state === 'ready' && a.filePath);
  for (const notes of notesArtifacts.slice(0, 2)) {
    try {
      const content = await readFile(notes.filePath!, 'utf-8');
      parts.push(`[学习笔记]\n${content.slice(0, 2000)}`);
    } catch {
      /* file missing, skip */
    }
  }

  // Include linked thread IDs for reference
  if (meta.threads.length > 0) {
    parts.push(`[关联讨论线程] ${meta.threads.map((t) => t.threadId).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

export const signalPodcastRoutes: FastifyPluginAsync = async (app) => {
  const paths = resolveSignalPaths();
  const articleQuery = new SignalArticleQueryService({ paths });
  const studyMeta = new StudyMetaService();

  app.post('/api/signals/articles/:id/podcast', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const params = request.params as { id?: string };
    if (!params.id) {
      reply.status(400);
      return { error: 'Article id required' };
    }

    const parsed = podcastBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid body', details: parsed.error.issues };
    }

    const article = await articleQuery.getArticleById(params.id);
    if (!article) {
      reply.status(404);
      return { error: `Article not found: ${params.id}` };
    }

    const content = article.content ?? '';
    const threadContext = await buildThreadContext(studyMeta, params.id, article.filePath);

    const artifact = await generatePodcastScript({
      articleId: params.id,
      articleFilePath: article.filePath,
      articleTitle: article.title,
      articleContent: content,
      mode: parsed.data.mode,
      requestedBy: userId,
      threadContext,
    });

    reply.status(202);
    return { artifact };
  });

  // AC-5: Read podcast script for playback
  app.get('/api/signals/articles/:id/podcast/:artifactId', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    const params = request.params as { id?: string; artifactId?: string };
    if (!params.id || !params.artifactId) {
      reply.status(400);
      return { error: 'Missing params' };
    }

    const article = await articleQuery.getArticleById(params.id);
    if (!article) {
      reply.status(404);
      return { error: 'Article not found' };
    }

    const studyData = await studyMeta.readMeta(params.id, article.filePath);
    const artifact = studyData.artifacts.find((a) => a.id === params.artifactId);
    if (!artifact || artifact.kind !== 'podcast') {
      reply.status(404);
      return { error: 'Podcast not found' };
    }
    if (!artifact.filePath) {
      reply.status(404);
      return { error: 'Script not yet generated' };
    }

    try {
      const raw = await readFile(artifact.filePath, 'utf-8');
      const script = JSON.parse(raw) as Record<string, unknown>;
      return { artifact, script };
    } catch {
      reply.status(404);
      return { error: 'Script file not readable' };
    }
  });
};
