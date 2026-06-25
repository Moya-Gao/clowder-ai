/**
 * F236 Phase E — AnchorEvalBridgeConsumer
 *
 * Transform + lifecycle helpers for F236 PostToolUse hook eval jsonl entries.
 *
 * - **Pure transform**: `evalEntriesToPreviewEvents()` — no I/O, no state
 * - **Lifecycle helpers**: `ingestEvalEntries()` / `cleanupEvalJsonl()` — wrap
 *   the TranscriptTailer → transform → recordAnchorPreviewEvent pattern so the
 *   carrier doesn't inline the try/catch/loop boilerplate (cloud R4 P1: file-size)
 *
 * The hook subprocess (`f236-anchor-posttool.mjs`) writes eval events to
 * `/tmp/cat-cafe-anchor-eval-{invocationId}.jsonl` with Track-2 compatible
 * fields. This consumer transforms them so the carrier can feed them into
 * `recordAnchorPreviewEvent()` from the anchor event log.
 *
 * Data flow:
 *   hook subprocess → eval jsonl → TranscriptTailer → THIS CONSUMER → recordAnchorPreviewEvent()
 */

import { rmSync } from 'node:fs';
import { type AnchorPreviewEventInput, recordAnchorPreviewEvent } from '../../../../../routes/anchor-event-log.js';
import type { AnchorPreviewTool } from '../../../../../routes/anchor-telemetry.js';
import type { TranscriptTailer } from './TranscriptTailer.js';

/** Bounded set of valid AnchorPreviewTool values — runtime validation for untrusted jsonl input. */
const VALID_PREVIEW_TOOLS: ReadonlySet<string> = new Set<AnchorPreviewTool>([
  'pending-mentions',
  'thread-context',
  'list-tasks',
  'cc-read',
  'cc-grep',
  'cc-glob',
]);

/**
 * Transform F236 hook eval jsonl entries to AnchorPreviewEventInput[].
 *
 * Pure function — no I/O, no state. Safe for incremental tailing.
 * Entries that fail validation are silently skipped (best-effort, same
 * contract as HookSidechannelConsumer).
 *
 * Required fields: `tool` (string, must be a valid AnchorPreviewTool), `itemIds` (array).
 * Optional fields: `originalChars`, `returnedChars`, `modeResolved`, `modeSource`, `catId`.
 * The `ts` field from the hook is NOT carried over — recordAnchorPreviewEvent()
 * uses Date.now() for its own timestamp (or _testTimestamp for tests).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validate-and-transform loop over unknown[] entries — same pattern as hookEntriesToAgentMessages
export function evalEntriesToPreviewEvents(entries: unknown[]): AnchorPreviewEventInput[] {
  const out: AnchorPreviewEventInput[] = [];

  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;

    // Required: tool must be a valid AnchorPreviewTool (defense-in-depth for untrusted /tmp input)
    if (typeof entry.tool !== 'string' || !VALID_PREVIEW_TOOLS.has(entry.tool)) continue;

    // Required: itemIds must be array
    if (!Array.isArray(entry.itemIds)) continue;

    const input: AnchorPreviewEventInput = {
      tool: entry.tool as AnchorPreviewEventInput['tool'],
      itemIds: entry.itemIds.filter((id): id is string => typeof id === 'string'),
      returnedChars: typeof entry.returnedChars === 'number' ? entry.returnedChars : 0,
      originalChars: typeof entry.originalChars === 'number' ? entry.originalChars : 0,
    };

    // Optional Track-2 adoption eval fields
    if (entry.modeResolved === 'anchor' || entry.modeResolved === 'full') {
      input.modeResolved = entry.modeResolved;
    }
    if (entry.modeSource === 'explicit' || entry.modeSource === 'default') {
      input.modeSource = entry.modeSource;
    }
    if (typeof entry.catId === 'string') {
      input.catId = entry.catId;
    }

    out.push(input);
  }

  return out;
}

/**
 * Compute the eval jsonl file path for a given invocation ID.
 * Returns null if no invocation ID is provided.
 *
 * Must match the path convention in f236-anchor-posttool.mjs:resolveEvalFilePath().
 */
export function resolveEvalJsonlPath(invocationId: string | undefined): string | null {
  if (!invocationId) return null;
  return `/tmp/cat-cafe-anchor-eval-${invocationId}.jsonl`;
}

// ─── Lifecycle helpers (carrier file-size extraction, cloud R4 P1) ──────────

/**
 * Read new eval entries from the tailer, transform, and record as preview events.
 * Non-fatal: swallows errors so the carrier output loop is never interrupted.
 *
 * @param tailer  The TranscriptTailer polling the eval jsonl file
 * @param opts    Pass `{ includeTrailingPartial: true }` for final drain
 */
export async function ingestEvalEntries(
  tailer: TranscriptTailer,
  opts?: { includeTrailingPartial?: boolean },
): Promise<void> {
  try {
    const entries = await tailer.readNew(opts);
    if (entries.length > 0) {
      const inputs = evalEntriesToPreviewEvents(entries);
      for (const input of inputs) {
        recordAnchorPreviewEvent(input);
      }
    }
  } catch {
    // Eval bridge failure is non-fatal — never break the carrier output loop
  }
}

/**
 * Best-effort cleanup of the eval jsonl file.
 * No-op if path is null. Swallows errors.
 */
export function cleanupEvalJsonl(path: string | null): void {
  if (!path) return;
  try {
    rmSync(path, { force: true });
  } catch {
    /* best-effort eval cleanup */
  }
}
