import type { FastifyPluginAsync } from 'fastify';
import { runEnvironmentCheck } from '../domains/cats/services/bootcamp/env-check.js';
import { resolveUserId } from '../utils/request-identity.js';

export const bootcampRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/bootcamp/env-check', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    return runEnvironmentCheck();
  });
};
