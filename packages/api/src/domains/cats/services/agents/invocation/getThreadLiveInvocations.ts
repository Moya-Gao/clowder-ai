/**
 * F194: Invocation Liveness Canonical Read Model
 *
 * Read-only helper that answers "which invocations are live for (threadId, userId)?"
 * by reconciling three independent stores with non-equivalent semantics:
 *
 * - InvocationTracker  → per-process control plane (AbortController) — NOT a lifecycle SoT
 * - InvocationRecord   → cross-process lifecycle SoT (status='running'/'done'/...) — may be zombie
 * - DraftStore         → 300s TTL content cache; draft.updatedAt is the freshness proxy
 *
 * Decision table (KD-3, KD-6 + R1 P1-1/P1-2 from 砚砚 review 2026-05-07):
 *
 * | record  | tracker          | draft fresh? | result                                                  |
 * |---------|------------------|--------------|---------------------------------------------------------|
 * | running | active+assoc     | —            | active source='record+tracker' degraded=false           |
 * | running | active no assoc  | yes          | active source='record+draft' degraded=true              |
 * |         |                  |              | reason='record_running_with_fresh_draft'                |
 * | running | missing          | yes          | active source='record+draft' degraded=true              |
 * | running | —                | no, age<=th  | active source='record-only' degraded=true               |
 * |         |                  |              | reason='liveness_pending' (grace window)                |
 * | running | —                | no, age>th   | zombie (not exposed in active[])                        |
 * | absent  | active+draft-assoc | yes        | active source='tracker+draft' degraded=true             |
 * |         |                  |              | reason='tracker_active_missing_record' (recovery path)  |
 * | absent  | other            | —            | drop (orphan filter)                                    |
 * | other   | —                | —            | drop                                                    |
 *
 * **Tracker association rules** (R1 P1-2 + R2 P1 + R3 P1 fix): a tracker slot is single-injectively
 * mapped to at most one invocation per cat — the slot's owner. Strong & weak paths are bound by
 * ownership, not just timing:
 *  - **slot owner** = the cat's earliest-anchored draft (slot was running before/when that draft
 *    was first created → it's the slot that produced this draft). Pre-computed in
 *    `slotClaimedByDraft` (Map<catId, draft>).
 *  - **STRONG (R3 P1)**: only the slot's owner candidate (record+own-draft OR draft-only owner)
 *    may use record+tracker / tracker+draft. Other candidates whose drafts merely overlap the
 *    slot in time get rejected from these tracker-backed sources.
 *  - **WEAK**: same-cat has exactly one running record AND record.createdAt <= slot.startedAt
 *           AND no other draft strongly claims this slot — fallback for records without their own
 *           draft (single-record-per-cat is unambiguous).
 *  R3 P1 closes the loophole where two candidates' drafts both individually anchored the slot in
 *  time but only one was the true owner: timing-only `slotAssocWithDraft` was reverse-claiming.
 *
 * **Enumeration** (R1 P1-1 fix): candidate set = running records ∪ drafts (by invocationId).
 *  Drafts without a record can still surface as live via the 'tracker+draft' fall-back path,
 *  preserving messages.ts:1400-1406 hotfix3 behavior (AC-B5).
 *
 * `record.updatedAt` is NOT a heartbeat — it changes on status transitions only,
 * so we use `draft.updatedAt` as the freshness signal (DraftStore.touch() refreshes
 * on every stream chunk). Zombie threshold defaults to 2× DraftStore TTL = 600s
 * and ONLY applies when no fresh draft exists, so long-running streams are never
 * mistakenly killed.
 */

import type { CatId } from '@cat-cafe/shared';
import type { DraftRecord } from '../../stores/ports/DraftStore.js';
import type { InvocationRecord } from '../../stores/ports/InvocationRecordStore.js';
import type { ActiveSlotInfo } from './InvocationTracker.js';

export const DEFAULT_FRESH_DRAFT_WINDOW_MS = 300_000;
export const DEFAULT_ZOMBIE_GRACE_MS = 600_000;

export type LivenessSource = 'record+tracker' | 'record+draft' | 'record-only' | 'tracker+draft';

export type LivenessReason =
  | 'tracker_present'
  | 'record_running_with_fresh_draft'
  | 'liveness_pending'
  | 'tracker_active_missing_record';

export interface LiveInvocation {
  /** First targetCat or draft catId; null only when record has no targetCats and no draft */
  catId: CatId | null;
  invocationId: string;
  /** Best-effort start time: tracker slot startedAt > draft.createdAt > record.updatedAt */
  startedAt: number;
  source: LivenessSource;
  degraded: boolean;
  reason: LivenessReason;
}

export type ZombieReason = 'no_tracker_no_fresh_draft_age_exceeded';

export interface ZombieRecord {
  invocationId: string;
  catId: CatId | null;
  recordStatus: 'running';
  recordUpdatedAt: number;
  reason: ZombieReason;
}

export interface LivenessReadResult {
  active: LiveInvocation[];
  /** Detected zombie records — NOT exposed via read endpoints; consumed by cleanup pathway (Phase C) */
  zombies: ZombieRecord[];
}

/** F194 Phase B (Bundle) AC-B11: structured diagnostic events emitted by the helper. */
export type LivenessEventKind = 'liveness_degraded' | 'liveness_pending' | 'record_zombie_detected';

export interface LivenessEvent {
  kind: LivenessEventKind;
  threadId: string;
  userId: string;
  invocationId: string;
  catId: string | null;
  /** Source classification (live entries) or null for zombies. */
  source: LivenessSource | null;
  reason: LivenessReason | ZombieReason;
  /** Diagnostic context (record/draft/tracker state at decision time). */
  recordStatus: 'running' | 'absent';
  recordUpdatedAt: number | null;
  trackerSlotPresent: boolean;
  draftFresh: boolean | null;
  draftAge: number | null;
}

export interface LivenessReadDeps {
  /** Enumerate running InvocationRecords for (threadId, userId). Required so zombies are visible
   *  even when their drafts have already been TTL-reaped (DraftStore TTL < zombie threshold). */
  listRunningRecords: (threadId: string, userId: string) => Promise<InvocationRecord[]> | InvocationRecord[];
  /** InvocationTracker.getActiveSlots(threadId) */
  getActiveSlots: (threadId: string) => ActiveSlotInfo[];
  /** InvocationTracker.getUserId(threadId, catId) — guards against cross-user tracker collisions */
  getTrackerUserId: (threadId: string, catId: string) => string | null;
  /** DraftStore.getByThread(userId, threadId) */
  getDrafts: (userId: string, threadId: string) => Promise<DraftRecord[]> | DraftRecord[];
  /** F194 AC-B12: optional structured event sink. Helper emits liveness_degraded /
   *  liveness_pending / record_zombie_detected at the matching decision points so the
   *  callsite (messages.ts/queue.ts) can route them into a logger. Sink failure must NOT
   *  interrupt the read — exceptions are swallowed. */
  onLog?: (event: LivenessEvent) => void;
}

export interface LivenessReadOptions {
  /** Override Date.now() (tests / deterministic replay) */
  now?: number;
  /** Window where a draft.updatedAt counts as fresh proof of life (default 300_000 ms = DraftStore TTL) */
  freshDraftWindowMs?: number;
  /** Grace window past which a record-only running record (no tracker, no fresh draft) is judged zombie
   *  (default 600_000 ms = 2× DraftStore TTL). Applies ONLY to no-fresh-draft case. */
  zombieGraceMs?: number;
}

type Classification =
  | { kind: 'live'; live: LiveInvocation }
  | { kind: 'zombie'; zombie: ZombieRecord }
  | { kind: 'drop' };

interface ClassifyContext {
  invocationId: string;
  record: InvocationRecord | undefined;
  draft: DraftRecord | undefined;
  slot: ActiveSlotInfo | undefined;
  trackerOwnerMatches: boolean;
  /** R3 P1: cat slot's earliest-anchored draft is THIS candidate's draft (it is the slot's owner).
   *  Required for both strong record+tracker AND tracker+draft fall-back. Implies slot exists,
   *  draft exists, and timing anchored. */
  slotClaimedByThisDraft: boolean;
  /** R2 P1: cat slot is strongly claimed by a draft *other than* this candidate's draft.
   *  Disables weak record-tracker (single-record-per-cat fallback). */
  slotClaimedByOtherDraft: boolean;
  /** Weak record-tracker eligibility: single running record per cat, no draft contention. */
  slotAssocWithRecordSingle: boolean;
  catId: CatId | null;
  now: number;
  freshDraftWindowMs: number;
  zombieGraceMs: number;
}

function tryRecordTracker(ctx: ClassifyContext): LiveInvocation | null {
  // R3 P1: strong path requires THIS candidate to own the slot (earliest-anchored draft).
  // Weak path allows single-record-per-cat fallback when no draft contests the slot.
  const trackerAssoc = ctx.slotClaimedByThisDraft || ctx.slotAssocWithRecordSingle;
  if (!ctx.record || !ctx.slot || !ctx.trackerOwnerMatches || !ctx.catId || !trackerAssoc) return null;
  return {
    catId: ctx.catId,
    invocationId: ctx.invocationId,
    startedAt: ctx.slot.startedAt,
    source: 'record+tracker',
    degraded: false,
    reason: 'tracker_present',
  };
}

function tryTrackerDraft(ctx: ClassifyContext): LiveInvocation | null {
  // R3 P1: only the slot's owner draft (earliest-anchored) may surface as tracker+draft.
  if (ctx.record || !ctx.draft || !ctx.slot || !ctx.trackerOwnerMatches || !ctx.catId) return null;
  if (!ctx.slotClaimedByThisDraft) return null;
  return {
    catId: ctx.catId,
    invocationId: ctx.invocationId,
    startedAt: ctx.slot.startedAt,
    source: 'tracker+draft',
    degraded: true,
    reason: 'tracker_active_missing_record',
  };
}

function tryRecordFreshDraft(ctx: ClassifyContext): LiveInvocation | null {
  if (!ctx.record || !ctx.draft) return null;
  if (ctx.now - ctx.draft.updatedAt > ctx.freshDraftWindowMs) return null;
  return {
    catId: ctx.catId,
    invocationId: ctx.invocationId,
    startedAt: ctx.draft.createdAt ?? ctx.draft.updatedAt,
    source: 'record+draft',
    degraded: true,
    reason: 'record_running_with_fresh_draft',
  };
}

function tryRecordGraceOrZombie(ctx: ClassifyContext): Classification | null {
  if (!ctx.record) return null;
  const recordAge = ctx.now - ctx.record.updatedAt;
  if (recordAge <= ctx.zombieGraceMs) {
    return {
      kind: 'live',
      live: {
        catId: ctx.catId,
        invocationId: ctx.invocationId,
        startedAt: ctx.record.updatedAt,
        source: 'record-only',
        degraded: true,
        reason: 'liveness_pending',
      },
    };
  }
  return {
    kind: 'zombie',
    zombie: {
      invocationId: ctx.invocationId,
      catId: ctx.catId,
      recordStatus: 'running',
      recordUpdatedAt: ctx.record.updatedAt,
      reason: 'no_tracker_no_fresh_draft_age_exceeded',
    },
  };
}

function classifyCandidate(ctx: ClassifyContext): Classification {
  const recordTracker = tryRecordTracker(ctx);
  if (recordTracker) return { kind: 'live', live: recordTracker };

  const trackerDraft = tryTrackerDraft(ctx);
  if (trackerDraft) return { kind: 'live', live: trackerDraft };

  const recordDraft = tryRecordFreshDraft(ctx);
  if (recordDraft) return { kind: 'live', live: recordDraft };

  const recordGrace = tryRecordGraceOrZombie(ctx);
  if (recordGrace) return recordGrace;

  return { kind: 'drop' };
}

function buildDegradedEvent(
  threadId: string,
  userId: string,
  ctx: ClassifyContext,
  live: LiveInvocation,
): LivenessEvent {
  const isPending = live.reason === 'liveness_pending';
  return {
    kind: isPending ? 'liveness_pending' : 'liveness_degraded',
    threadId,
    userId,
    invocationId: ctx.invocationId,
    catId: live.catId,
    source: live.source,
    reason: live.reason,
    recordStatus: ctx.record ? 'running' : 'absent',
    recordUpdatedAt: ctx.record?.updatedAt ?? null,
    trackerSlotPresent: !!ctx.slot,
    draftFresh: ctx.draft ? ctx.now - ctx.draft.updatedAt <= ctx.freshDraftWindowMs : null,
    draftAge: ctx.draft ? ctx.now - ctx.draft.updatedAt : null,
  };
}

function buildZombieEvent(threadId: string, userId: string, ctx: ClassifyContext, zombie: ZombieRecord): LivenessEvent {
  return {
    kind: 'record_zombie_detected',
    threadId,
    userId,
    invocationId: ctx.invocationId,
    catId: zombie.catId,
    source: null,
    reason: zombie.reason,
    recordStatus: 'running',
    recordUpdatedAt: zombie.recordUpdatedAt,
    trackerSlotPresent: !!ctx.slot,
    draftFresh: false,
    draftAge: ctx.draft ? ctx.now - ctx.draft.updatedAt : null,
  };
}

/** AC-B11/B12: emit a structured event for `degraded` live + zombie outcomes.
 *  Sink failure is swallowed — diagnostic should never break the read path. */
function emitLivenessEvent(
  onLog: ((event: LivenessEvent) => void) | undefined,
  threadId: string,
  userId: string,
  ctx: ClassifyContext,
  result: Classification,
): void {
  if (!onLog) return;
  let event: LivenessEvent | null = null;
  if (result.kind === 'live' && result.live.degraded) {
    event = buildDegradedEvent(threadId, userId, ctx, result.live);
  } else if (result.kind === 'zombie') {
    event = buildZombieEvent(threadId, userId, ctx, result.zombie);
  }
  if (!event) return;
  try {
    onLog(event);
  } catch {
    // swallow — sink errors must not interrupt read path
  }
}

interface IndexBundle {
  recordById: Map<string, InvocationRecord>;
  draftById: Map<string, DraftRecord>;
  slotByCatId: Map<string, ActiveSlotInfo>;
  runningRecordsByCat: Map<string, InvocationRecord[]>;
  /** R2 P1 fix: per-cat, the earliest-anchored draft that strongly claims that cat's tracker slot.
   *  A weak record-tracker association must NOT fire if the slot is already claimed by another
   *  invocation's draft (cat slot reuse / coexistence with record-missing recovery). */
  slotClaimedByDraft: Map<string, DraftRecord>;
}

function buildRunningRecordsByCat(
  records: InvocationRecord[],
  threadId: string,
  userId: string,
): Map<string, InvocationRecord[]> {
  const out = new Map<string, InvocationRecord[]>();
  for (const r of records) {
    if (r.status !== 'running' || r.threadId !== threadId || r.userId !== userId) continue;
    const cat = r.targetCats[0] as string | undefined;
    if (!cat) continue;
    let bucket = out.get(cat);
    if (!bucket) {
      bucket = [];
      out.set(cat, bucket);
    }
    bucket.push(r);
  }
  return out;
}

/** R2 P1 + cloud R5 P1: per-cat earliest-anchored draft that strongly claims that cat's tracker slot.
 *  Stale drafts (updatedAt past freshDraftWindowMs) are excluded — they shouldn't grant ownership
 *  that disables a still-live record's weak path. */
function buildSlotClaimedByDraft(
  drafts: DraftRecord[],
  slotByCatId: Map<string, ActiveSlotInfo>,
  threadId: string,
  userId: string,
  now: number,
  freshDraftWindowMs: number,
): Map<string, DraftRecord> {
  // Pre-filter: only fresh in-scope drafts can claim slot ownership (cloud R5 P1).
  const eligible = drafts.filter(
    (d) => d.threadId === threadId && d.userId === userId && now - d.updatedAt <= freshDraftWindowMs,
  );
  const out = new Map<string, DraftRecord>();
  for (const draft of eligible) {
    const slot = slotByCatId.get(draft.catId);
    if (!slot) continue;
    const anchorTs = draft.createdAt ?? draft.updatedAt;
    if (slot.startedAt > anchorTs) continue;
    const incumbent = out.get(draft.catId);
    const incumbentAnchor = incumbent ? (incumbent.createdAt ?? incumbent.updatedAt) : Number.POSITIVE_INFINITY;
    if (anchorTs < incumbentAnchor) out.set(draft.catId, draft);
  }
  return out;
}

function buildIndexes(
  records: InvocationRecord[],
  drafts: DraftRecord[],
  slots: ActiveSlotInfo[],
  threadId: string,
  userId: string,
  now: number,
  freshDraftWindowMs: number,
): IndexBundle {
  const recordById = new Map<string, InvocationRecord>();
  for (const r of records) recordById.set(r.id, r);
  const draftById = new Map<string, DraftRecord>();
  for (const d of drafts) draftById.set(d.invocationId, d);
  const slotByCatId = new Map<string, ActiveSlotInfo>();
  for (const s of slots) slotByCatId.set(s.catId, s);
  const runningRecordsByCat = buildRunningRecordsByCat(records, threadId, userId);
  const slotClaimedByDraft = buildSlotClaimedByDraft(drafts, slotByCatId, threadId, userId, now, freshDraftWindowMs);
  return { recordById, draftById, slotByCatId, runningRecordsByCat, slotClaimedByDraft };
}

interface BuildContextDeps {
  threadId: string;
  userId: string;
  invocationId: string;
  index: IndexBundle;
  getTrackerUserId: (threadId: string, catId: string) => string | null;
  now: number;
  freshDraftWindowMs: number;
  zombieGraceMs: number;
}

function lookupCandidate(
  deps: BuildContextDeps,
): { record: InvocationRecord | undefined; draft: DraftRecord | undefined } | null {
  const record = deps.index.recordById.get(deps.invocationId);
  // In-scope but not running → drop (treated as not live)
  if (record && (record.status !== 'running' || record.threadId !== deps.threadId || record.userId !== deps.userId)) {
    return null;
  }
  const draft = deps.index.draftById.get(deps.invocationId);
  // Defensive: drafts come scoped from getDrafts(userId, threadId), but guard against caller misuse.
  if (draft && (draft.threadId !== deps.threadId || draft.userId !== deps.userId)) return null;
  return { record, draft };
}

function resolveCatId(record: InvocationRecord | undefined, draft: DraftRecord | undefined): CatId | null {
  const recordCatId = (record?.targetCats[0] as CatId | undefined) ?? null;
  const draftCatId = (draft?.catId as CatId | undefined) ?? null;
  return recordCatId ?? draftCatId;
}

function computeAssociations(args: {
  slot: ActiveSlotInfo | undefined;
  record: InvocationRecord | undefined;
  sameCatRecordCount: number;
  /** R2 P1: true iff cat slot is strongly claimed by a draft other than this candidate's.
   *  Disables weak record association so a fresh slot can't reverse-prove an unrelated record. */
  slotClaimedByOtherDraft: boolean;
}): { slotAssocWithRecordSingle: boolean } {
  const { slot, record, sameCatRecordCount, slotClaimedByOtherDraft } = args;
  const slotAssocWithRecordSingle = !!(
    slot &&
    record &&
    sameCatRecordCount === 1 &&
    record.createdAt <= slot.startedAt &&
    !slotClaimedByOtherDraft
  );
  return { slotAssocWithRecordSingle };
}

function buildClassifyContext(deps: BuildContextDeps): ClassifyContext | null {
  const lookup = lookupCandidate(deps);
  if (!lookup) return null;
  const { record, draft } = lookup;
  const catId = resolveCatId(record, draft);
  const slot = catId ? deps.index.slotByCatId.get(catId) : undefined;
  const trackerOwnerMatches = !!(slot && catId && deps.getTrackerUserId(deps.threadId, catId) === deps.userId);
  const sameCatRecordCount = catId ? (deps.index.runningRecordsByCat.get(catId)?.length ?? 0) : 0;
  const slotClaimingDraft = catId ? deps.index.slotClaimedByDraft.get(catId) : undefined;
  const slotClaimedByThisDraft = !!(slotClaimingDraft && slotClaimingDraft.invocationId === deps.invocationId);
  const slotClaimedByOtherDraft = !!(slotClaimingDraft && slotClaimingDraft.invocationId !== deps.invocationId);
  const { slotAssocWithRecordSingle } = computeAssociations({
    slot,
    record,
    sameCatRecordCount,
    slotClaimedByOtherDraft,
  });

  return {
    invocationId: deps.invocationId,
    record,
    draft,
    slot,
    trackerOwnerMatches,
    slotClaimedByThisDraft,
    slotClaimedByOtherDraft,
    slotAssocWithRecordSingle,
    catId,
    now: deps.now,
    freshDraftWindowMs: deps.freshDraftWindowMs,
    zombieGraceMs: deps.zombieGraceMs,
  };
}

export async function getThreadLiveInvocations(
  threadId: string,
  userId: string,
  deps: LivenessReadDeps,
  opts: LivenessReadOptions = {},
): Promise<LivenessReadResult> {
  const now = opts.now ?? Date.now();
  const freshDraftWindowMs = opts.freshDraftWindowMs ?? DEFAULT_FRESH_DRAFT_WINDOW_MS;
  const zombieGraceMs = opts.zombieGraceMs ?? DEFAULT_ZOMBIE_GRACE_MS;

  const [records, drafts] = await Promise.all([
    Promise.resolve(deps.listRunningRecords(threadId, userId)),
    Promise.resolve(deps.getDrafts(userId, threadId)),
  ]);
  const slots = deps.getActiveSlots(threadId);

  const index = buildIndexes(records, drafts, slots, threadId, userId, now, freshDraftWindowMs);

  const candidateIds = new Set<string>();
  for (const r of records) candidateIds.add(r.id);
  for (const d of drafts) candidateIds.add(d.invocationId);

  const active: LiveInvocation[] = [];
  const zombies: ZombieRecord[] = [];

  for (const invocationId of candidateIds) {
    const ctx = buildClassifyContext({
      threadId,
      userId,
      invocationId,
      index,
      getTrackerUserId: deps.getTrackerUserId,
      now,
      freshDraftWindowMs,
      zombieGraceMs,
    });
    if (!ctx) continue;
    const result = classifyCandidate(ctx);
    emitLivenessEvent(deps.onLog, threadId, userId, ctx, result);
    if (result.kind === 'live') active.push(result.live);
    else if (result.kind === 'zombie') zombies.push(result.zombie);
  }

  return { active, zombies };
}
