/**
 * F163: Admin routes — knowledge promotion API (AC-A6)
 * POST /api/f163/promote — upgrade authority level (observed→candidate→validated)
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { F163Authority } from '../domains/memory/f163-types.js';

const AUTHORITY_LEVELS: F163Authority[] = ['observed', 'candidate', 'validated', 'constitutional'];

const promoteSchema = z.object({
  anchor: z.string().min(1),
  targetAuthority: z.enum(['observed', 'candidate', 'validated', 'constitutional']),
  reason: z.string().min(1),
});

interface F163AdminRoutesOptions {
  evidenceStore: {
    getByAnchor(anchor: string): Promise<{ authority?: string } | null>;
    getDb(): { prepare(sql: string): { run(...args: unknown[]): { changes: number } } };
    runExclusive<T>(fn: () => T | Promise<T>): Promise<T>;
  };
}

export const f163AdminRoutes: FastifyPluginAsync<F163AdminRoutesOptions> = async (app, opts) => {
  app.post('/api/f163/promote', async (request, reply) => {
    // Localhost-only guard
    const remoteIp = request.ip;
    if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
      reply.status(403);
      return { error: 'promote only allowed from localhost' };
    }

    const parsed = promoteSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { anchor, targetAuthority, reason } = parsed.data;

    // Find current item
    const item = await opts.evidenceStore.getByAnchor(anchor);
    if (!item) {
      reply.status(404);
      return { error: `Anchor not found: ${anchor}` };
    }

    const currentAuthority = (item.authority as F163Authority) ?? 'observed';
    const currentLevel = AUTHORITY_LEVELS.indexOf(currentAuthority);
    const targetLevel = AUTHORITY_LEVELS.indexOf(targetAuthority);

    // Constitutional requires CVO-only flag (not implemented yet — block for now)
    if (targetAuthority === 'constitutional') {
      reply.status(403);
      return { error: 'Promotion to constitutional requires CVO approval (not yet available via API)' };
    }

    // Only allow upward promotion
    if (targetLevel <= currentLevel) {
      reply.status(400);
      return { error: `Can only promote upward: ${currentAuthority} → ${targetAuthority} is not an upgrade` };
    }

    // Apply promotion — routed through single-writer queue (F163 AC-A5)
    const now = new Date().toISOString();
    const result = await opts.evidenceStore.runExclusive(() => {
      const db = opts.evidenceStore.getDb();
      return db
        .prepare('UPDATE evidence_docs SET authority = ?, verified_at = ? WHERE anchor = ?')
        .run(targetAuthority, now, anchor);
    });

    if (result.changes === 0) {
      reply.status(500);
      return { error: 'Update failed' };
    }

    return {
      ok: true,
      anchor,
      previousAuthority: currentAuthority,
      newAuthority: targetAuthority,
      reason,
      verifiedAt: now,
    };
  });
};
