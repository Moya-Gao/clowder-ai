import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { loadEvalHubSummary } from '../infrastructure/harness-eval/eval-hub-read-model.js';

export interface EvalHubRoutesOptions {
  harnessFeedbackRoot: string;
}

function requireSession(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = (request as FastifyRequest & { sessionUserId?: string }).sessionUserId;
  if (!userId) {
    reply.status(401).send({ error: 'Session required' });
    return null;
  }
  return userId;
}

export const evalHubRoutes: FastifyPluginAsync<EvalHubRoutesOptions> = async (app, opts) => {
  app.get('/api/eval-hub/summary', async (request, reply) => {
    if (!requireSession(request, reply)) return;

    try {
      return loadEvalHubSummary({ harnessFeedbackRoot: opts.harnessFeedbackRoot });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: 'Eval Hub summary unavailable', detail: message });
    }
  });
};
