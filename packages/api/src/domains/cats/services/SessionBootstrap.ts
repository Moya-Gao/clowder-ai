/**
 * SessionBootstrap — F24 Phase E
 * Builds bootstrap context for Session #2+ so cats know what happened
 * in the previous session.
 *
 * Injects:
 * 1. Session identity (seq, chain length)
 * 2. Previous session digest (extractive)
 * 3. MCP tool recall instructions
 */

import type { CatId } from '@cat-cafe/shared';
import type { ISessionChainStore } from './SessionChainStore.js';
import type { TranscriptReader } from './TranscriptReader.js';
import type { ExtractiveDigestV1 } from './TranscriptWriter.js';

export interface BootstrapContext {
  /** Formatted bootstrap text to prepend to prompt */
  text: string;
  /** Session sequence number for the current session */
  sessionSeq: number;
  /** Whether a previous digest was found and included */
  hasDigest: boolean;
}

export interface SessionBootstrapOptions {
  sessionChainStore: ISessionChainStore;
  transcriptReader: TranscriptReader;
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

  // Get current active session
  const active = await sessionChainStore.getActive(catId, threadId);
  if (!active || active.seq <= 1) {
    return null; // Session #1 — no prior context
  }

  // Get the full chain to find the previous sealed session
  const chain = await sessionChainStore.getChain(catId, threadId);
  const prevSession = chain.find(
    (s) => s.seq === active.seq - 1 && s.status === 'sealed',
  );

  const parts: string[] = [];

  // 1. Session Identity
  const sealedCount = chain.filter((s) => s.status === 'sealed').length;
  parts.push(
    `[Session Continuity — Session #${active.seq}]`,
    `This is session #${active.seq} of ${chain.length} total sessions for this thread.`,
    `${sealedCount} previous session(s) are sealed and searchable.`,
  );

  // 2. Previous Session Digest
  let hasDigest = false;
  if (prevSession) {
    try {
      const digest = await transcriptReader.readDigest(
        prevSession.id, prevSession.threadId, prevSession.catId,
      );
      if (digest) {
        parts.push('');
        parts.push('[Previous Session Summary]');
        parts.push(formatDigest(digest as unknown as ExtractiveDigestV1));
        hasDigest = true;
      }
    } catch {
      // Digest read failed — still inject identity + tools
    }
  }

  // 3. MCP Tool Recall Instructions (E2)
  parts.push('');
  parts.push('[Session Recall — Available Tools]');
  parts.push(
    'You have access to these tools for retrieving context from previous sessions:',
  );
  parts.push('- cat_cafe_list_session_chain: List all sessions in this thread');
  parts.push('- cat_cafe_session_search: Search across session transcripts and digests');
  parts.push('- cat_cafe_read_session_digest: Read summary of a specific session');
  parts.push('- cat_cafe_read_session_events: Read detailed events from a session');
  parts.push('');
  parts.push(
    'When unsure about previous decisions, file changes, or context:',
  );
  parts.push('1. Use cat_cafe_session_search to find relevant prior sessions');
  parts.push('2. Use cat_cafe_read_session_digest for a quick summary');
  parts.push('3. Use cat_cafe_read_session_events for detailed events');
  parts.push('Do NOT guess about what happened in previous sessions.');

  return {
    text: parts.join('\n'),
    sessionSeq: active.seq,
    hasDigest,
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
