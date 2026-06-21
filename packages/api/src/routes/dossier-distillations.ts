/**
 * F208 Phase E: Dossier Distillation API Routes
 *
 * POST /api/dossier/distillations           — create proposal (cat-initiated, AC-E1)
 * GET  /api/dossier/distillations           — list proposals (pending, or by cat)
 * GET  /api/dossier/distillations/:id       — get specific proposal
 * POST /api/dossier/distillations/:id/approve — CVO approves (AC-E3)
 * POST /api/dossier/distillations/:id/reject  — CVO rejects
 * POST /api/dossier/distillations/:id/apply   — cat applies approved draft (KD-18)
 *
 * KD-16: Independent from F231 profile-update routes (different semantics).
 * KD-17: evidenceRefs must be non-empty (fail-closed), sourceId for idempotency.
 * KD-18: v1 no auto-commit — CVO approve, then cat apply + git commit later.
 *
 * State machine:
 *   pending → approved → applied
 *   pending → rejected
 */

import type { CatId, DistillationEvidenceRef, DistillationSourceEvent } from '@cat-cafe/shared';
import { isDistillationSourceEvent } from '@cat-cafe/shared';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { IDossierDistillationProposalStore } from '../domains/cats/services/stores/ports/DossierDistillationProposalStore.js';
import { resolveOwnerGate } from '../utils/owner-gate.js';
import { resolveStrictUserId } from '../utils/request-identity.js';

export interface DistillationRoutesOptions {
  distillationStore: IDossierDistillationProposalStore;
}

export const distillationRoutes: FastifyPluginAsync<DistillationRoutesOptions> = async (app: FastifyInstance, opts) => {
  const store = opts.distillationStore;

  // ─── POST /api/dossier/distillations ── create proposal ───────────
  app.post('/api/dossier/distillations', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) {
      reply.status(400);
      return { error: 'Request body is required' };
    }

    // Validate required fields
    const {
      sourceEvent,
      sourceId,
      targetCatId,
      targetFields,
      beforeSnapshot,
      afterDraft,
      rationale,
      evidenceRefs,
      baseHash,
    } = body as Record<string, unknown>;

    if (!sourceEvent || !isDistillationSourceEvent(sourceEvent)) {
      reply.status(400);
      return { error: 'sourceEvent is required and must be a valid distillation source event' };
    }
    if (!sourceId || typeof sourceId !== 'string') {
      reply.status(400);
      return { error: 'sourceId is required' };
    }
    if (!targetCatId || typeof targetCatId !== 'string') {
      reply.status(400);
      return { error: 'targetCatId is required' };
    }
    if (!Array.isArray(targetFields) || targetFields.length === 0) {
      reply.status(400);
      return { error: 'targetFields is required and must be a non-empty array' };
    }
    if (typeof beforeSnapshot !== 'string') {
      reply.status(400);
      return { error: 'beforeSnapshot is required' };
    }
    if (!afterDraft || typeof afterDraft !== 'string') {
      reply.status(400);
      return { error: 'afterDraft is required' };
    }
    if (!rationale || typeof rationale !== 'string') {
      reply.status(400);
      return { error: 'rationale is required' };
    }
    if (!baseHash || typeof baseHash !== 'string') {
      reply.status(400);
      return { error: 'baseHash is required' };
    }

    // KD-17 fail-closed: evidenceRefs must be non-empty, each ref structurally valid
    if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
      reply.status(400);
      return { error: 'evidenceRefs must be a non-empty array (KD-17 fail-closed)' };
    }
    const VALID_REF_TYPES = new Set(['observation', 'review', 'trajectory', 'cvo-comment']);
    for (const ref of evidenceRefs as Array<Record<string, unknown>>) {
      if (!ref || typeof ref.type !== 'string' || !VALID_REF_TYPES.has(ref.type)) {
        reply.status(400);
        return { error: 'Each evidenceRef must have a valid type (observation|review|trajectory|cvo-comment)' };
      }
      if (typeof ref.id !== 'string' || ref.id.length === 0) {
        reply.status(400);
        return { error: 'Each evidenceRef must have a non-empty id' };
      }
    }

    // Auth gate BEFORE idempotency — unauthenticated callers must not
    // reach the idempotent-read path (cloud review P1, defense-in-depth).
    const createdBy = resolveStrictUserId(request);
    if (!createdBy) {
      reply.status(401);
      return { error: 'Authentication required to create distillation proposals' };
    }

    // Idempotency: check if sourceId already exists
    const existing = await store.getBySourceId(sourceId as string);
    if (existing) {
      reply.status(200); // 200 not 201 — idempotent hit
      return { proposal: existing };
    }

    const proposal = await store.create({
      sourceEvent: sourceEvent as DistillationSourceEvent,
      sourceId: sourceId as string,
      targetCatId: targetCatId as CatId,
      targetFields: targetFields as string[],
      beforeSnapshot: beforeSnapshot as string,
      afterDraft: afterDraft as string,
      rationale: rationale as string,
      evidenceRefs: evidenceRefs as DistillationEvidenceRef[],
      baseHash: baseHash as string,
      createdBy,
    });

    reply.status(201);
    return { proposal };
  });

  // ─── GET /api/dossier/distillations ── list proposals ─────────────
  app.get('/api/dossier/distillations', async (request) => {
    const query = request.query as { catId?: string; status?: string; limit?: string };
    const limit = query.limit ? Math.min(Math.max(1, Number.parseInt(query.limit, 10) || 100), 100) : 100;

    if (query.catId) {
      const proposals = await store.listByCat(query.catId as CatId, limit);
      return { proposals };
    }

    // Default: list pending proposals
    const proposals = await store.listPending(limit);
    return { proposals };
  });

  // ─── GET /api/dossier/distillations/:proposalId ── get one ────────
  app.get('/api/dossier/distillations/:proposalId', async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const proposal = await store.get(proposalId);
    if (!proposal) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    return { proposal };
  });

  // ─── POST /api/dossier/distillations/:id/approve ── CVO approves ──
  app.post('/api/dossier/distillations/:proposalId/approve', async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const approvedBy = resolveStrictUserId(request);
    if (!approvedBy) {
      reply.status(401);
      return { error: 'Authentication required to approve proposals' };
    }

    // CVO gate: only the configured owner can approve proposals (KD-18, same as dossier-observations.ts)
    const ownerError = resolveOwnerGate(approvedBy, {
      errorMessage: 'Only the CVO can approve distillation proposals',
    });
    if (ownerError) {
      reply.status(ownerError.status);
      return { error: ownerError.error };
    }

    // Defense-in-depth: creator cannot approve their own proposal
    const existing = await store.get(proposalId);
    if (!existing) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (existing.createdBy === approvedBy) {
      reply.status(403);
      return { error: 'Cannot approve your own proposal (separation of duties)' };
    }

    const proposal = await store.markApproved(proposalId, approvedBy);
    if (!proposal) {
      reply.status(409);
      return { error: 'Proposal is not in pending status (may already be approved/rejected)' };
    }
    return { proposal };
  });

  // ─── POST /api/dossier/distillations/:id/reject ── CVO rejects ────
  app.post('/api/dossier/distillations/:proposalId/reject', async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const rejectedBy = resolveStrictUserId(request);
    if (!rejectedBy) {
      reply.status(401);
      return { error: 'Authentication required to reject proposals' };
    }

    // CVO gate: only the configured owner can reject proposals (KD-18)
    const ownerError = resolveOwnerGate(rejectedBy, {
      errorMessage: 'Only the CVO can reject distillation proposals',
    });
    if (ownerError) {
      reply.status(ownerError.status);
      return { error: ownerError.error };
    }

    // Defense-in-depth: creator cannot reject their own proposal
    const existing = await store.get(proposalId);
    if (!existing) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (existing.createdBy === rejectedBy) {
      reply.status(403);
      return { error: 'Cannot reject your own proposal (separation of duties)' };
    }

    const body = (request.body as { rejectionReason?: string } | null) ?? {};

    const proposal = await store.markRejected(proposalId, rejectedBy, body.rejectionReason);
    if (!proposal) {
      reply.status(409);
      return { error: 'Proposal is not in pending status (may already be approved/rejected)' };
    }
    return { proposal };
  });

  // ─── POST /api/dossier/distillations/:id/apply ── cat applies ─────
  app.post('/api/dossier/distillations/:proposalId/apply', async (request, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const body = (request.body as { commitSha?: string } | null) ?? {};

    if (!body.commitSha || typeof body.commitSha !== 'string') {
      reply.status(400);
      return { error: 'commitSha is required' };
    }

    const appliedBy = resolveStrictUserId(request);
    if (!appliedBy) {
      reply.status(401);
      return { error: 'Authentication required to apply proposals' };
    }

    // Ownership gate: only the target cat can apply distillation to their profile
    const existing = await store.get(proposalId);
    if (!existing) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (existing.targetCatId !== appliedBy) {
      reply.status(403);
      return { error: 'Only the target cat can apply distillation to their profile' };
    }

    const proposal = await store.markApplied(proposalId, appliedBy, body.commitSha);
    if (!proposal) {
      reply.status(409);
      return { error: 'Proposal is not in approved status (must be approved before apply)' };
    }
    return { proposal };
  });
};
