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
