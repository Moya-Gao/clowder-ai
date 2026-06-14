/**
 * ConciergeReplyValidator (F229 KD-17)
 *
 * Post-processes duty cat reply text:
 * - Scans for [跳过去 R{n}] and [原地看 R{n}] markers
 * - Looks up HandleMap → validates anchor exists
 * - Returns CardBlock actions to inject before message storage
 *
 * Fail-closed: unknown handle → no action (no error).
 * Deduplicates: same (action, label) pair → single action.
 */

import type { IConciergeHandleMapStore } from './ConciergeHandleMapStore.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConciergeAction {
  action: 'concierge_teleport' | 'concierge_peek';
  label: string;
  payload: {
    threadId: string;
    messageId?: string;
  };
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/** Matches [跳过去 R1], [原地看 R2], etc. */
const MARKER_PATTERN = /\[(跳过去|原地看)\s+(R\d+)\]/g;

const ACTION_MAP: Record<string, 'concierge_teleport' | 'concierge_peek'> = {
  跳过去: 'concierge_teleport',
  原地看: 'concierge_peek',
};

const LABEL_PREFIX: Record<string, string> = {
  跳过去: '跳过去',
  原地看: '原地看',
};

// ---------------------------------------------------------------------------
// Fail-closed guards
// ---------------------------------------------------------------------------

/**
 * Determine if an action should be skipped (fail-closed).
 *
 * - peek without messageId → no-op button (CardBlock.tsx:189 returns early)
 * - teleport for non-thread anchors → frontend can't navigate (only real threadIds)
 */
function shouldSkipAction(
  actionType: 'concierge_teleport' | 'concierge_peek',
  anchor: { messageId?: string; type: string },
): boolean {
  if (actionType === 'concierge_peek' && !anchor.messageId) return true;
  if (actionType === 'concierge_teleport' && anchor.type !== 'thread') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Extract concierge CardBlock actions from duty cat reply text.
 *
 * @param replyText - raw reply text from the duty cat
 * @param threadId - concierge thread ID (HandleMap scope)
 * @param store - HandleMap store for anchor lookups
 * @returns actions array ready to inject into CardBlock (may be empty)
 */
export async function extractConciergeActions(
  replyText: string,
  threadId: string,
  store: IConciergeHandleMapStore,
): Promise<ConciergeAction[]> {
  // 1. Extract all marker matches via matchAll (avoids biome assignment-in-expression warning)
  const matches: Array<{ verb: string; handle: string }> = [];
  for (const m of replyText.matchAll(MARKER_PATTERN)) {
    matches.push({ verb: m[1], handle: m[2] });
  }

  if (matches.length === 0) return [];

  // 2. Deduplicate (verb + handle)
  const seen = new Set<string>();
  const unique: Array<{ verb: string; handle: string }> = [];
  for (const match of matches) {
    const key = `${match.verb}:${match.handle}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(match);
    }
  }

  // 3. Look up each handle and build actions (fail-closed)
  const actions: ConciergeAction[] = [];
  for (const { verb, handle } of unique) {
    const anchor = await store.getHandle(threadId, handle);
    if (!anchor) continue; // fail-closed: unknown handle → skip

    const actionType = ACTION_MAP[verb];
    if (!actionType) continue; // safety guard
    if (shouldSkipAction(actionType, anchor)) continue;

    actions.push({
      action: actionType,
      label: `${LABEL_PREFIX[verb]}：${anchor.title}`,
      payload: {
        threadId: anchor.threadId,
        ...(anchor.messageId != null ? { messageId: anchor.messageId } : {}),
      },
    });
  }

  return actions;
}

/** Cap on fallback action count — avoid flooding the card with buttons when HandleMap is full. */
const FALLBACK_MAX_ACTIONS = 8;

/**
 * Build concierge CardBlock actions with KD-19 fallback (AC-A3 robustness).
 *
 * Marker-first: if the duty cat used [跳过去/原地看 Rn] markers, honor its curation
 * (sonnet-class compliance) and return only those actions.
 *
 * Fallback: if the duty cat produced NO usable marker actions (gemini-class
 * non-compliance — knows the protocol but ignores it, per KD-19 alpha comparison),
 * surface ALL thread-type handles from the HandleMap as a "related records"
 * clickable list. AC-A3 (the goldfish-memory use case) must not depend on duty
 * cat marker compliance.
 *
 * Non-thread handles (feature/doc) are skipped — only real threads are navigable.
 * Markers remain a bonus (in-body precise highlight is a Phase B enhancement).
 */
export async function buildConciergeActions(
  replyText: string,
  threadId: string,
  store: IConciergeHandleMapStore,
): Promise<ConciergeAction[]> {
  const markerActions = await extractConciergeActions(replyText, threadId, store);
  if (markerActions.length > 0) return markerActions;

  const handles = await store.getAllHandles(threadId);
  const actions: ConciergeAction[] = [];
  for (const { anchor } of handles) {
    if (anchor.type !== 'thread') continue; // only real threads are navigable
    actions.push({
      action: 'concierge_teleport',
      label: `跳过去：${anchor.title}`,
      payload: {
        threadId: anchor.threadId,
        ...(anchor.messageId != null ? { messageId: anchor.messageId } : {}),
      },
    });
    if (anchor.messageId) {
      actions.push({
        action: 'concierge_peek',
        label: `原地看：${anchor.title}`,
        payload: { threadId: anchor.threadId, messageId: anchor.messageId },
      });
    }
  }
  return actions.slice(0, FALLBACK_MAX_ACTIONS);
}
