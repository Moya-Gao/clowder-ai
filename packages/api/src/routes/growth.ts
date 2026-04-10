/**
 * Growth Routes — F157 Cat Growth RPG
 * GET /api/growth/overview — team-wide growth overview
 * GET /api/growth/:catId   — single cat growth profile
 */

import type { FastifyPluginAsync } from 'fastify';
import type { GrowthService } from '../domains/cats/services/growth/GrowthService.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface GrowthRoutesOptions {
  growthService: GrowthService;
}

export const growthRoutes: FastifyPluginAsync<GrowthRoutesOptions> = async (app, opts) => {
  const { growthService } = opts;

  /** Team overview — all cats' growth profiles */
  app.get('/api/growth/overview', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const overview = await growthService.getOverview();
    return overview;
  });

  /** Single cat growth profile */
  app.get<{ Params: { catId: string } }>('/api/growth/:catId', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const { catId } = request.params;
    const profile = await growthService.getProfile(catId);
    if (!profile) {
      return reply.status(404).send({ error: `Cat not found: ${catId}` });
    }
    return profile;
  });
};
