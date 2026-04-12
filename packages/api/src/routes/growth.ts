/**
 * Growth Routes — F157 Cat Growth RPG
 * GET  /api/growth/overview             — team-wide growth overview
 * GET  /api/growth/:catId               — single cat growth profile
 * GET  /api/growth/:catId/events        — XP event audit trail (AC-A5)
 * POST /api/growth/:catId/export-image  — PNG screenshot of profile card (AC-A3)
 */

import type { FastifyPluginAsync } from 'fastify';
import { resolveFrontendBaseUrl } from '../config/frontend-origin.js';
import type { GrowthService } from '../domains/cats/services/growth/GrowthService.js';
import { ImageExporter } from '../services/ImageExporter.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface GrowthRoutesOptions {
  growthService: GrowthService;
}

export const growthRoutes: FastifyPluginAsync<GrowthRoutesOptions> = async (app, opts) => {
  const { growthService } = opts;

  // Plugin-scoped singleton ImageExporter (browser reuse across requests)
  let sharedExporter: ImageExporter | null = null;
  app.addHook('onClose', async () => {
    if (sharedExporter) {
      await sharedExporter.close();
      sharedExporter = null;
    }
  });

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

  /** AC-A5: XP event audit trail — newest first, with pagination. */
  app.get<{ Params: { catId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/growth/:catId/events',
    async (request, reply) => {
      const userId = resolveHeaderUserId(request);
      if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

      const { catId } = request.params;
      const limit = Math.min(Math.max(parseInt(request.query.limit ?? '50', 10) || 50, 1), 200);
      const offset = Math.max(parseInt(request.query.offset ?? '0', 10) || 0, 0);

      const events = await growthService.getXpEvents(catId, limit, offset);
      return { catId, events, limit, offset };
    },
  );

  /** AC-A3: Export cat profile card as PNG image */
  app.post<{ Params: { catId: string } }>('/api/growth/:catId/export-image', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const { catId } = request.params;

    // Verify cat exists before launching Puppeteer
    const profile = await growthService.getProfile(catId);
    if (!profile) {
      return reply.status(404).send({ error: `Cat not found: ${catId}` });
    }

    try {
      const frontendUrl = resolveFrontendBaseUrl(process.env, app.log);
      const url = `${frontendUrl}/growth-export/${catId}`;
      app.log.info({ catId, url }, 'Exporting growth card to PNG');

      const exporter = sharedExporter ?? (sharedExporter = new ImageExporter());
      const imageBuffer = await exporter.capture(url, userId, 480);

      return reply.type('image/png').send(imageBuffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      app.log.error({ error: msg, catId }, 'Growth card export failed');
      return reply.status(500).send({ error: 'Export failed', message: msg });
    }
  });
};
