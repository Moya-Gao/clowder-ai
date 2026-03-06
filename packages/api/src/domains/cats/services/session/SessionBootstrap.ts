/**
 * SessionBootstrap — F24 Phase E + F065 Phase A
 * Builds bootstrap context for Session #2+ so cats know what happened
 * in the previous session.
 *
 * Injects:
 * 1. Session identity (seq, chain length)
 * 2. Previous session digest (extractive)
 * 3. Task snapshot (F065: compact task list)
 * 4. MCP tool recall instructions
 */

import type { CatId } from '@cat-cafe/shared';
import type { ISessionChainStore } from '../stores/ports/SessionChainStore.js';
import type { TranscriptReader } from './TranscriptReader.js';
import type { ExtractiveDigestV1 } from './TranscriptWriter.js';
import type { ITaskStore } from '../stores/ports/TaskStore.js';
import { formatTaskSnapshot } from './formatTaskSnapshot.js';
import { estimateTokens } from '../../../../utils/token-counter.js';

/** Hard cap for entire bootstrap output (AC-5).
 * Applies uniformly regardless of call path (serial/parallel/incremental). */
const MAX_BOOTSTRAP_TOKENS = 2000;

export interface BootstrapContext {
  /** Formatted bootstrap text to prepend to prompt */
  text: string;
  /** Session sequence number for the current session */
  sessionSeq: number;
  /** Whether a previous digest was found and included */
  hasDigest: boolean;
  /** F065: Whether a task snapshot was injected */
  hasTaskSnapshot: boolean;
}

export interface SessionBootstrapOptions {
  sessionChainStore: ISessionChainStore;
  transcriptReader: TranscriptReader;
  /** F065: Task store for task snapshot injection */
  taskStore?: ITaskStore;
}

/**
 * Build bootstrap context for a cat's current session.
 * Returns null if cat is on Session #1 (no prior context to inject).
 */
export async function buildSessionBootstrap(
  opts: SessionBootstrapOptions,
  catId: CatId,
  threadId: string,
): Promise<BootstrapContext | null> {
  const { sessionChainStore, transcriptReader } = opts;

  // Get full chain — works regardless of whether active session exists yet
  const chain = await sessionChainStore.getChain(catId, threadId);
  // Include both 'sealed' and 'sealing' — a sealing session has passed threshold
  // and its transcript is being flushed; its digest is available for bootstrap (R6 P1-2)
  const sealedSessions = chain.filter((s) => s.status === 'sealed' || s.status === 'sealing');

  // No sealed sessions → first session, no prior context to inject
  if (sealedSessions.length === 0) {
    return null;
  }

  // Find the most recent sealed session (highest seq) — guaranteed to exist after length check
  const prevSession = sealedSessions[sealedSessions.length - 1]!;

  // Determine current session seq: active session if exists, else chain.length
  const active = await sessionChainStore.getActive(catId, threadId);
  const currentSeq = active ? active.seq : chain.length;
  // Display as 1-based for human readability
  const displaySeq = currentSeq + 1;

  const parts: string[] = [];

  // 1. Session Identity
  parts.push(
    `[Session Continuity — Session #${displaySeq}]`,
    `This is session #${displaySeq} of ${chain.length + (active ? 0 : 1)} total sessions for this thread.`,
    `${sealedSessions.length} previous session(s) are sealed and searchable.`,
  );

  // Build sections separately for section-aware token cap (AC-5, R4 P1-1)
  // Priority: identity (always keep) > tools (always keep) > task snapshot > digest
  const identitySection = parts.join('\n');

  let digestSection = '';
  // 2. Previous Session Digest
  let hasDigest = false;
  try {
    const digest = await transcriptReader.readDigest(
      prevSession.id, prevSession.threadId, prevSession.catId,
    );
    if (digest) {
      digestSection = '\n[Previous Session Summary]\n' + formatDigest(digest as unknown as ExtractiveDigestV1);
      hasDigest = true;
    }
  } catch {
    // Digest read failed — still inject identity + tools
  }

  // 3. Task Snapshot (F065)
  let taskSection = '';
  let hasTaskSnapshot = false;
  if (opts.taskStore) {
    try {
      const tasks = await opts.taskStore.listByThread(threadId);
      const snapshot = formatTaskSnapshot(tasks);
      if (snapshot) {
        taskSection = '\n' + snapshot;
        hasTaskSnapshot = true;
      }
    } catch {
      // Best-effort: task snapshot failure doesn't block bootstrap
    }
  }

  // 4. MCP Tool Recall Instructions (F065: updated with read_invocation_detail + view=handoff)
  const toolLines: string[] = [];
  toolLines.push('');
  toolLines.push('[Session Recall — Available Tools]');
  toolLines.push(
    'You have access to these tools for retrieving context from previous sessions:',
  );
  toolLines.push('- cat_cafe_list_session_chain: List all sessions in this thread');
  toolLines.push('- cat_cafe_session_search: Search across session transcripts and digests');
  toolLines.push('- cat_cafe_read_session_digest: Read summary of a specific session');
  toolLines.push('- cat_cafe_read_session_events: Read detailed events (use view=handoff for per-invocation summaries)');
  toolLines.push('- cat_cafe_read_invocation_detail: Read all events for a specific invocation');
  toolLines.push('');
  toolLines.push(
    'When unsure about previous decisions, file changes, or context:',
  );
  toolLines.push('1. Use cat_cafe_session_search to find relevant prior sessions');
  toolLines.push('2. Use cat_cafe_read_session_events(view=handoff) for per-invocation summaries');
  toolLines.push('3. Use cat_cafe_read_invocation_detail to drill into a specific invocation');
  toolLines.push('Do NOT guess about what happened in previous sessions.');
  const toolsSection = toolLines.join('\n');

  // Section-aware token cap (AC-5): identity + tools are always kept.
  // Drop task snapshot first (least critical), then digest, to fit within budget.
  const baseTokens = estimateTokens(identitySection + toolsSection);
  const remainingBudget = MAX_BOOTSTRAP_TOKENS - baseTokens;

  const digestTokens = hasDigest ? estimateTokens(digestSection) : 0;
  const taskTokens = hasTaskSnapshot ? estimateTokens(taskSection) : 0;

  if (digestTokens + taskTokens > remainingBudget) {
    // Combined exceeds budget — drop task snapshot first (lower priority)
    taskSection = '';
    hasTaskSnapshot = false;

    // If digest alone still exceeds budget, drop it too
    if (digestTokens > remainingBudget) {
      digestSection = '';
      hasDigest = false;
    }
  }

  const text = identitySection + digestSection + taskSection + toolsSection;

  return {
    text,
    sessionSeq: currentSeq,
    hasDigest,
    hasTaskSnapshot,
  };
}

/**
 * Format an extractive digest into a human-readable summary.
 */
function formatDigest(digest: ExtractiveDigestV1): string {
  const lines: string[] = [];

  // Time range
  if (digest.time) {
    const start = new Date(digest.time.createdAt);
    const end = new Date(digest.time.sealedAt);
    const durationMin = Math.round((digest.time.sealedAt - digest.time.createdAt) / 60000);
    lines.push(`Duration: ${formatTimeShort(start)} → ${formatTimeShort(end)} (${durationMin}min)`);
  }

  // Tools used
  const allTools = digest.invocations
    .flatMap((inv) => inv.toolNames ?? [])
    .filter(Boolean);
  if (allTools.length > 0) {
    const unique = [...new Set(allTools)];
    lines.push(`Tools used: ${unique.join(', ')}`);
  }

  // Files touched
  if (digest.filesTouched.length > 0) {
    lines.push('Files touched:');
    for (const f of digest.filesTouched.slice(0, 15)) {
      const ops = f.ops.length > 0 ? ` (${f.ops.join(', ')})` : '';
      lines.push(`  - ${f.path}${ops}`);
    }
    if (digest.filesTouched.length > 15) {
      lines.push(`  ... and ${digest.filesTouched.length - 15} more files`);
    }
  }

  // Errors
  if (digest.errors.length > 0) {
    lines.push(`Errors encountered: ${digest.errors.length}`);
    for (const err of digest.errors.slice(0, 3)) {
      lines.push(`  - ${err.message.slice(0, 200)}`);
    }
  }

  return lines.join('\n');
}

function formatTimeShort(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
