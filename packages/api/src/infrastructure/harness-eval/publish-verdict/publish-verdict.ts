import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEvalCatOverride } from '../domain/eval-domain-override.js';
import { loadDomains } from '../hub/eval-hub-read-model.js';
import {
  assertCanCrossThreadHandoff,
  parseVerdictHandoffPacket,
  type VerdictHandoffPacket,
} from '../verdict-handoff.js';
import type {
  GitPublisher,
  HandlerError,
  PublishVerdictDeps,
  PublishVerdictInput,
  PublishVerdictSuccess,
  VerdictGenerator,
} from './types.js';
import { assertNoNewlineInBulletFields, resolveSourceRefsInRoot, validateSourceRefsFormat } from './validation.js';

export type {
  GitPublisher,
  HandlerError,
  PublishOnIsolatedWorktreeOpts,
  PublishVerdictDeps,
  PublishVerdictInput,
  PublishVerdictSuccess,
  ResolvedSourceRefs,
  StageResult,
  VerdictGenerator,
  VerdictSourceRefs,
} from './types.js';

// AC-H8: length + slug + idempotency (复用 generate-now 模式)
const MAX_VERDICT_ID_LEN = 128;
const MAX_PHENOMENON_LEN = 2048;
const SAFE_VERDICT_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * F192 Phase H — Verdict Publishing Pipeline (砚砚 R0 Path B narrowed).
 * Eval cat calls cat_cafe_publish_verdict MCP → handler validates → generator
 * runs INSIDE isolated worktree (砚砚 R1 P1 #1 + R7 cloud: live tree NEVER touched)
 * → GitPublisher commits + pushes + opens auto-PR. Replaces PR #2091.
 */

const defaultGitPublisher: GitPublisher = {
  async publishOnIsolatedWorktree() {
    throw new Error('GitPublisher not injected (must wire real isolated-worktree impl at route layer)');
  },
};

const defaultGenerator: VerdictGenerator = async (_packet, _sources, _deps) => {
  throw new Error('generator not injected (must wire per-domain generator at route layer)');
};

// validateSourceRefsFormat / assertNoNewlineInBulletFields / resolveSourceRefsInRoot
// extracted to ./validation.ts (350-line limit).

/**
 * AC-H1: Validate VerdictHandoffPacket schema (server NEVER 造 evidence).
 * AC-H7 partial: input.domain must match packet.domainId; only eval:a2a wired in v1.
 * AC-H2: call generator → branch + commit + push + auto-PR → return SHA + URL.
 */
export async function handlePublishVerdict(
  deps: PublishVerdictDeps,
  input: PublishVerdictInput,
): Promise<PublishVerdictSuccess | HandlerError> {
  // AC-H1: validate full packet schema
  let packet: VerdictHandoffPacket;
  try {
    packet = parseVerdictHandoffPacket(input.packet);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 400, error: 'invalid_packet', detail: message };
  }

  // AC-H7 partial: cross-check input.domain ↔ packet.domainId (consistency guard)
  if (input.domain !== packet.domainId) {
    return {
      status: 400,
      error: 'domain_mismatch',
      detail: `input.domain '${input.domain}' does not match packet.domainId '${packet.domainId}'`,
    };
  }

  // 砚砚 R11 P1 + AC-H1: completeness — schema validates "array", guard checks
  // "non-empty". Cat owns metric/trace refs (NOT bundle-overridden); reject early
  // before invoking generator if cat omitted them. snapshot/attribution placeholders
  // also checked here (will be overridden by bundle but cat must still send shape).
  const handoffDecision = assertCanCrossThreadHandoff(packet);
  if (!handoffDecision.ok) {
    return { status: 400, error: 'handoff_incomplete', detail: `handoff_incomplete: ${handoffDecision.reason}` };
  }

  // 砚砚 R18 P2 + cloud R18 P2: reject \r\n in fields renderer writes as single-line
  // bullets (read-model regex parses first line — newline truncates + enables injection).
  const newlineError = assertNoNewlineInBulletFields(packet);
  if (newlineError) return newlineError;

  // AC-H7 partial: v1 supports eval:a2a only. AC-H6 later adds capability-wakeup.
  if (packet.domainId !== 'eval:a2a') {
    return {
      status: 501,
      error: 'unsupported_generator',
      detail: `Domain '${packet.domainId}' has no live-verdict generator wired in Phase H v1. Only eval:a2a supported.`,
    };
  }

  // AC-H3 + 砚砚 R6 P1: catId from callback auth (MCP layer). Domain allowlist
  // respects OQ-20 Redis override (symmetric with trigger-now), else static registry.
  if (!input.catId) {
    return {
      status: 401,
      error: 'unauthenticated',
      detail: 'catId not provided — MCP layer must derive from callback',
    };
  }
  const domains = loadDomains(deps.harnessFeedbackRoot);
  const domainEntry = domains.get(packet.domainId as Parameters<typeof domains.get>[0]);
  if (!domainEntry) {
    return {
      status: 400,
      error: 'domain_not_registered',
      detail: `Domain '${packet.domainId}' not found in eval-domains/ registry`,
    };
  }
  // 砚砚 R6 P1: prefer Redis override if set, fallback to static registry cat
  let allowedCatId = domainEntry.evalCat.catId as string;
  let overrideApplied = false;
  if (deps.redis) {
    try {
      const override = await getEvalCatOverride(deps.redis, packet.domainId);
      if (override) {
        allowedCatId = override.catId;
        overrideApplied = true;
      }
    } catch {
      // Redis read failure: fall back to static cat (safer than open-fail)
    }
  }
  if (input.catId !== allowedCatId) {
    return {
      status: 403,
      error: 'not_allowed',
      detail: `catId '${input.catId}' is not the eval cat for domain '${packet.domainId}' (expected '${allowedCatId}'${overrideApplied ? ' via OQ-20 Redis override' : ' from registry'})`,
    };
  }

  // AC-H8: length + slug + idempotency (复用 generate-now 模式)
  if (packet.id.length > MAX_VERDICT_ID_LEN) {
    return {
      status: 400,
      error: 'invalid_packet_id',
      detail: `packet.id must be <= ${MAX_VERDICT_ID_LEN} chars (got ${packet.id.length})`,
    };
  }
  if (!SAFE_VERDICT_ID.test(packet.id)) {
    return {
      status: 400,
      error: 'invalid_packet_id',
      detail: `packet.id must match safe slug pattern /^[a-z0-9][a-z0-9-]*$/ (lowercase alphanumeric + hyphens, no leading hyphen). Got: '${packet.id}'`,
    };
  }
  if (packet.phenomenon.length > MAX_PHENOMENON_LEN) {
    return {
      status: 400,
      error: 'invalid_packet',
      detail: `packet.phenomenon must be <= ${MAX_PHENOMENON_LEN} chars (got ${packet.phenomenon.length})`,
    };
  }
  // Idempotency fast-fail: live-tree existsSync catches common dup quickly.
  // 砚砚 R3 P1 #2 cloud: NOT authoritative — if API checkout is stale vs origin/main,
  // dup-on-main slips through. Authoritative re-check inside isolated worktree below.
  const liveVerdictPath = resolve(deps.harnessFeedbackRoot, 'verdicts', `${packet.id}.md`);
  const liveBundleDir = resolve(deps.harnessFeedbackRoot, 'bundles', packet.id);
  if (existsSync(liveVerdictPath) || existsSync(liveBundleDir)) {
    return {
      status: 409,
      error: 'verdict_already_exists',
      detail: `packet.id '${packet.id}' already has a verdict file or bundle directory in the live worktree. Pick a different id — overwriting existing Eval Hub evidence is forbidden (data integrity).`,
    };
  }

  // 砚砚 R1 P1 #2 + R2/R3/R7 cloud: format-only check at handler level (presence,
  // type, basename — no live-tree resolve). Actual path resolution happens INSIDE
  // stage callback against the ISOLATED worktree (generator needs in-repo paths
  // so provenance.relative() doesn't reject outside-repo paths).
  if (packet.domainId === 'eval:a2a') {
    const refsCheck = validateSourceRefsFormat(input.sourceRefs);
    if (!refsCheck.ok) return refsCheck.error;
  }

  // AC-H2 + 砚砚 R1 P1 #1: delegate isolated-worktree lifecycle to GitPublisher.
  // Generator runs INSIDE the isolated worktree (passed via stage callback's
  // `worktreeRoot`), so artifacts are produced where they'll be committed.
  // Live `harnessFeedbackRoot` worktree is NEVER mutated.
  //
  // 砚砚 R1 P2 #2: branch name `verdict/auto/{domainSlug}/{verdictId}` is
  // unique per packet.id; `git worktree add -b {branch}` fails atomically if
  // branch already exists → race protection via git's own locking.
  const gitPublisher = deps.gitPublisher ?? defaultGitPublisher;
  const generator = deps.generator ?? defaultGenerator;
  const domainSlug = packet.domainId.replace(/:/g, '-');
  const branchName = `verdict/auto/${domainSlug}/${packet.id}`;

  let artifact: { verdictPath: string; bundleDir: string } | null = null;
  try {
    const { commitSha, prUrl } = await gitPublisher.publishOnIsolatedWorktree({
      branchName,
      sourceBase: 'origin/main',
      async stage(worktreeRoot) {
        // 砚砚 R7 + cloud R7: resolve sourceRefs INSIDE isolated worktree so the
        // resulting absolute paths are inside the isolated repo. The real
        // generateA2aLiveVerdict requires raw paths to live under harnessFeedbackRoot
        // (relative() rejects outside-repo paths for provenance correctness).
        const isolatedHarnessFeedback = `${worktreeRoot}/docs/harness-feedback`;
        // 砚砚 R3 P1 #2 cloud: AUTHORITATIVE dup check (origin/main truth).
        const isoVerdictPath = resolve(isolatedHarnessFeedback, 'verdicts', `${packet.id}.md`);
        const isoBundleDir = resolve(isolatedHarnessFeedback, 'bundles', packet.id);
        if (existsSync(isoVerdictPath) || existsSync(isoBundleDir)) {
          throw new Error(
            `verdict_already_exists_on_main: packet.id '${packet.id}' already exists on origin/main. Pick a different id.`,
          );
        }
        // 砚砚 R17 P1 cloud: snapshots/ + attributions/ are GITIGNORED (.gitignore:205-206) —
        // raw evidence ONLY exists in the live checkout where harness wrote it, NEVER on
        // origin/main. R7's "resolve in isolated" failed because isolated worktree (from main)
        // doesn't have these files. Fix: resolve in LIVE, COPY into isolated for in-repo paths
        // (preserves R7 spirit — generator reads in-repo paths so provenance.relative() works).
        const snap = input.sourceRefs?.snapshotName as string;
        const attr = input.sourceRefs?.attributionName as string;
        const liveRefs = resolveSourceRefsInRoot(deps.harnessFeedbackRoot, snap, attr);
        if (!liveRefs.ok) throw new Error(`invalid_source_ref: ${liveRefs.reason}`);
        if (!existsSync(liveRefs.refs.snapshotPath) || !existsSync(liveRefs.refs.attributionPath)) {
          throw new Error('evidence_not_found: sourceRefs not found in live harness-feedback');
        }
        // Copy raw evidence into isolated worktree so generator's in-repo path invariant holds
        const isoSnapDir = resolve(isolatedHarnessFeedback, 'snapshots');
        const isoAttrDir = resolve(isolatedHarnessFeedback, 'attributions');
        mkdirSync(isoSnapDir, { recursive: true });
        mkdirSync(isoAttrDir, { recursive: true });
        const isoSnapPath = resolve(isoSnapDir, snap);
        const isoAttrPath = resolve(isoAttrDir, attr);
        copyFileSync(liveRefs.refs.snapshotPath, isoSnapPath);
        copyFileSync(liveRefs.refs.attributionPath, isoAttrPath);
        artifact = await generator(
          packet,
          { snapshotPath: isoSnapPath, attributionPath: isoAttrPath },
          { harnessFeedbackRoot: isolatedHarnessFeedback },
        );
        return {
          paths: [artifact.verdictPath, artifact.bundleDir],
          commitMessage: `verdict(${packet.domainId}): ${packet.id} — ${packet.verdict}\n\n${packet.phenomenon}\n\n[published via cat_cafe_publish_verdict MCP]`,
          prTitle: `verdict(${packet.domainId}): ${packet.id}`,
          prBody: `Verdict published via cat_cafe_publish_verdict MCP tool.\n\nVerdict: ${packet.verdict}\nDomain: ${packet.domainId}\nPhenomenon: ${packet.phenomenon}\n\nReviewed by: ${packet.ownerAsk.targetOwnerCatId}\nAction: ${packet.ownerAsk.requestedAction}`,
        };
      },
    });

    // Stage must have produced artifact (proves generator ran in isolated worktree)
    if (!artifact) {
      return { status: 500, error: 'internal', detail: 'stage callback did not produce artifact' };
    }
    // 砚砚 R12 P2 cloud: returned paths are REPO-RELATIVE (resolve under origin/main
    // post-merge), NOT the generator's absolute paths inside the temp worktree which
    // is removed in finally — those would be dangling references at response time.
    return {
      ok: true,
      verdictPath: `docs/harness-feedback/verdicts/${packet.id}.md`,
      bundleDir: `docs/harness-feedback/bundles/${packet.id}`,
      commitSha,
      prUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('verdict_already_exists_on_main')) {
      return { status: 409, error: 'verdict_already_exists', detail: message };
    }
    if (message.startsWith('invalid_source_ref')) return { status: 400, error: 'invalid_source_ref', detail: message };
    if (message.startsWith('evidence_not_found')) return { status: 404, error: 'evidence_not_found', detail: message };
    // 砚砚 R11 P1: AC-H1 completeness — generator throws if any ref type empty
    if (message.startsWith('handoff_incomplete')) return { status: 400, error: 'handoff_incomplete', detail: message };
    if (!artifact) return { status: 500, error: 'generator_failed', detail: message };
    return { status: 500, error: 'git_or_gh_failed', detail: message };
  }
}
