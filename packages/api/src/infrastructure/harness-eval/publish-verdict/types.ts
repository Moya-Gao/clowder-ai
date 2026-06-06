import type { Redis } from 'ioredis';
import type { CapabilityWakeupSourceSelector } from '../capability-wakeup/capability-wakeup-trial-provider.js';
import type { VerdictHandoffPacket } from '../verdict-handoff.js';

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
 * a2a evidence refs — basenames of pre-sanitized YAML files. `kind` is OPTIONAL
 * for backward compat (existing cats publish without specifying kind, default
 * interpretation is a2a snapshot/attribution refs).
 *
 * 砚砚 R2 P2 cloud: must be basename (NOT path) — handler resolves under allowlist.
 */
export interface A2aSnapshotAttributionRefs {
  kind?: 'a2a-snapshot-attribution';
  /** Basename of sanitized eval snapshot YAML inside `<harnessFeedbackRoot>/snapshots/`. */
  snapshotName?: string;
  /** Basename of sanitized attribution YAML inside `<harnessFeedbackRoot>/attributions/`. */
  attributionName?: string;
}

/**
 * F192 Phase H 收尾 PR-2 — `VerdictSourceRefs` is a discriminated union (砚砚 R1 Q3).
 * - a2a branch: `{snapshotName, attributionName}` (kind optional, default a2a)
 * - capability-wakeup branch: `CapabilityWakeupSourceSelector` (kind required)
 *
 * 砚砚 R1 P1 #2: generator MUST receive explicit `sources` (sanitized
 * evidence refs / replayable selector); tool NEVER fabricates evidence.
 */
export type VerdictSourceRefs = A2aSnapshotAttributionRefs | CapabilityWakeupSourceSelector;

/**
 * Resolved evidence source paths (a2a only — for backward-compat helpers in validation.ts).
 * 砚砚 R7 cloud: resolved INSIDE isolated worktree so paths live in-repo for provenance.
 *
 * cw adapter does NOT use this — it resolves selector → trials via provider port.
 */
export interface ResolvedSourceRefs {
  snapshotPath: string;
  attributionPath: string;
}

/**
 * Generator contract — produces verdict.md + bundle/ for the packet's domain.
 *
 * F192 Phase H 收尾 PR-2 (砚砚 R1 Q1): adapter is self-contained — receives RAW
 * `sourceRefs` (not pre-resolved) and both roots (live + isolated). Each adapter:
 * - a2a: validate basenames, resolve in live root, copy to isolated root, call generateA2aLiveVerdict
 * - capability-wakeup: validate selector, provider.resolve(selector) → trials, call generateCapabilityWakeupLiveVerdict
 *
 * Handler stays domain-agnostic (砚砚 R1 P1: route layer dispatches single generator
 * via eval-hub.ts opts.verdictGenerators[domainId]).
 */
export type VerdictGenerator = (
  packet: VerdictHandoffPacket,
  sourceRefs: VerdictSourceRefs,
  deps: GeneratorDeps,
) => Promise<{
  verdictPath: string;
  bundleDir: string;
  /**
   * F192 Phase H 收尾 PR-2 R3 P1 (cloud): extra paths the generator wrote that the
   * publisher MUST also `git add` (e.g. cw's `generated/capability-wakeup/<verdictId>/`
   * raw input dir, referenced by provenance.json). Omit/empty when generator writes
   * everything under `bundleDir`.
   */
  extraStagedPaths?: string[];
}>;

export interface GeneratorDeps {
  /** ISOLATED worktree's docs/harness-feedback — where generator writes verdict.md + bundle. */
  harnessFeedbackRoot: string;
  /** LIVE checkout's docs/harness-feedback — a2a needs this to read raw snapshot/attribution YAML
   *  that are gitignored from origin/main (砚砚 R17 P1 cloud). cw doesn't use it. */
  liveHarnessFeedbackRoot: string;
}

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
  /** 砚砚 R1 P1 #2: explicit evidence refs (sanitized YAML basenames OR replayable selector). Tool NEVER fabricates. */
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
