import type { Redis } from 'ioredis';

/**
 * F192 Phase H — Verdict Publishing Pipeline types.
 * Extracted from publish-verdict.ts per AGENTS.md 350-line hard limit.
 */

export interface StageResult {
  /** Absolute paths under the isolated worktree to `git add`. */
  paths: string[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface PublishOnIsolatedWorktreeOpts {
  branchName: string;
  sourceBase: string; // e.g. 'origin/main'
  /** Generator + artifact production happens inside the isolated worktree. */
  stage: (worktreeRoot: string) => Promise<StageResult>;
}

export interface GitPublisher {
  publishOnIsolatedWorktree(opts: PublishOnIsolatedWorktreeOpts): Promise<{ commitSha: string; prUrl: string }>;
}

/**
 * Generator contract — produces verdict.md + bundle/ for the packet's domain.
 * 砚砚 R1 P1 #2: generator MUST receive explicit `sources` (sanitized
 * evidence refs); tool NEVER fabricates evidence.
 */
export interface VerdictSourceRefs {
  /**
   * Basename of sanitized eval snapshot YAML inside `<harnessFeedbackRoot>/snapshots/`.
   * 砚砚 R2 P2 cloud: must be basename (NOT path) — handler resolves under allowlist.
   */
  snapshotName?: string;
  /** Basename of sanitized attribution YAML inside `<harnessFeedbackRoot>/attributions/`. */
  attributionName?: string;
}

/**
 * Resolved evidence source paths (absolute, post-allowlist-check + post-isolated-worktree-resolve).
 * 砚砚 R7 cloud: resolved INSIDE isolated worktree so paths live in-repo for provenance.
 */
export interface ResolvedSourceRefs {
  snapshotPath: string;
  attributionPath: string;
}

import type { VerdictHandoffPacket } from '../verdict-handoff.js';

export type VerdictGenerator = (
  packet: VerdictHandoffPacket,
  sources: ResolvedSourceRefs,
  deps: { harnessFeedbackRoot: string },
) => Promise<{ verdictPath: string; bundleDir: string }>;

export interface PublishVerdictDeps {
  harnessFeedbackRoot: string;
  /** AC-H2 + 砚砚 R1 P1 #1: isolated publish worktree (default throws). */
  gitPublisher?: GitPublisher;
  /** AC-H2: domain-specific generator (default throws — route-layer must inject per-domain). */
  generator?: VerdictGenerator;
  /** 砚砚 R6 P1: Redis client for OQ-20 eval-cat overrides (symmetric with trigger-now). */
  redis?: Redis;
}

export interface PublishVerdictInput {
  packet: unknown; // user-supplied — strict validation via VerdictHandoffPacket
  domain: string; // must match packet.domainId
  /** AC-H3: catId derived from callback auth at MCP server layer. */
  catId: string;
  /** 砚砚 R1 P1 #2: explicit evidence refs (sanitized YAML basenames). Tool NEVER fabricates. */
  sourceRefs: VerdictSourceRefs;
}

export interface PublishVerdictSuccess {
  ok: true;
  verdictPath: string;
  bundleDir: string;
  commitSha: string;
  prUrl: string;
}

export interface HandlerError {
  status: number;
  error: string;
  detail?: string;
}
