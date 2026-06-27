#!/usr/bin/env node
// check-sync-public-delta-gate-cli.mjs — F251 Task 4 sync wire orchestration.
//
// Reads CLI args, walks paths in 3-way (base / theirs / ours), classifies each
// via the pure classifier library, builds and writes the report, then exits
// nonzero if blockCount > 0 (without override) or cvoApprovalRequired is true.
//
// Designed to be invoked by sync-to-opensource.sh after the temp target public
// gate succeeds and before the real target sync (line 2091:
// sync_filtered_into_target "$TARGET_DIR"). Exit nonzero MUST stop the bash
// caller before rsync touches the real target.
//
// CLI contract (positional via flag-style):
//   --target-dir <path>     clowder-ai checkout (theirs)
//   --filtered-dir <path>   cat-cafe export tree (ours / candidate public bytes)
//   --source-dir <path>     cat-cafe checkout (for sourceHead provenance)
//   --sync-module <name>    e.g. 'full-outbound'
//   --baseline <ref>        optional explicit baseline ref (skips sync-tag resolution)
//   --no-fetch              skip target git fetch (tests)
//   --output-dir <path>     report output dir; default docs/ops
//   --timestamp <iso>       deterministic timestamp for tests
//   --dry-run               build + write report but always exit 0 (caller decides)
//
// Exit codes:
//   0  — gate passes (no blocked items, no CVO approval needed)
//   1  — gate fails (blocked items present, or CVO approval required)
//   2  — usage / CLI parsing error
//   3  — internal error (git failure, write failure, etc.)
//
// FS/path/binary helpers extracted into check-sync-public-delta-gate-fs.mjs per
// AGENTS.md 350-line limit; this file stays focused on CLI parsing, git plumbing,
// 3-way enumeration orchestration, and exit semantics.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildPublicDeltaGateReport,
  classifyPublicDeltaGateItem,
  resolvePublicDeltaGateBaseline,
  writePublicDeltaGateReports,
} from './check-sync-public-delta-gate.mjs';
import {
  isBinaryPath,
  isGeneratedOrProvenancePath,
  isTargetOwnedPath,
  listFsPaths,
} from './check-sync-public-delta-gate-fs.mjs';

const USAGE = `usage: check-sync-public-delta-gate-cli.mjs
  --target-dir <path>          clowder-ai checkout (theirs)
  --filtered-dir <path>        cat-cafe export tree (ours) — must be pristine; install/build artifacts skipped
  --source-dir <path>          cat-cafe checkout (for sourceHead)
  --sync-module <name>         e.g. 'full-outbound'
  [--baseline <ref>]           explicit baseline ref
  [--head-ref <ref>]            compare against this ref instead of origin/main (use 'HEAD' for sync invocations)
  [--target-owned-root <path>] repeatable; path/glob excluded from gate (e.g. preserved by Step 5c backup/restore)
  [--override <path>:<reason>] repeatable; convert BLOCK at <path> to override-pass with <reason> recorded in provenance
  [--cvo-approved-public-delta-overwrite] raise > 3 override alarm ceiling (CVO sign-off required in PR body)
  [--no-fetch]                 skip target git fetch
  [--output-dir <path>]        default docs/ops
  [--timestamp <iso>]          deterministic timestamp
  [--dry-run]                  always exit 0
`;

// Multi-value flags accumulate into arrays; everything else is single-value.
const REPEATABLE_FLAGS = new Set(['target-owned-root', 'override']);

// Pure boolean flags (no value).
const BOOLEAN_FLAGS = new Set(['no-fetch', 'dry-run', 'cvo-approved-public-delta-overwrite']);

function fail(exitCode, message) {
  process.stderr.write(`check-sync-public-delta-gate-cli: ${message}\n`);
  if (exitCode === 2) {
    process.stderr.write(USAGE);
  }
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      fail(2, `unexpected positional argument: ${flag}`);
    }
    const key = flag.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      fail(2, `flag ${flag} requires a value`);
    }
    if (REPEATABLE_FLAGS.has(key)) {
      if (!Array.isArray(args[key])) {
        args[key] = [];
      }
      args[key].push(value);
    } else {
      args[key] = value;
    }
    i += 1;
  }
  return args;
}

// `--override <path>:<reason>` → { path, reason }. AC-A4 + KD-3: empty reason → exit 2
// (auditability). Only the first `:` separates path from reason — colons in reason OK.
function parseOverridePair(raw) {
  const idx = raw.indexOf(':');
  if (idx < 0) {
    fail(2, `--override expects <path>:<reason>, got: ${raw}`);
  }
  const path = raw.slice(0, idx);
  const reason = raw.slice(idx + 1).trim();
  if (path.length === 0) {
    fail(2, `--override path must be non-empty: ${raw}`);
  }
  if (reason.length === 0) {
    fail(2, `--override reason must be non-empty (AC-A4: all overrides need an auditable reason): ${raw}`);
  }
  return { path, reason };
}

function requireString(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail(2, `missing required flag --${key}`);
  }
  return value;
}

function git(repo, gitArgs) {
  try {
    return execFileSync('git', ['-C', repo, ...gitArgs], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(`git ${gitArgs.join(' ')} (cwd=${repo}) failed: ${error.message}`);
  }
}

function tryGit(repo, gitArgs) {
  try {
    return git(repo, gitArgs);
  } catch {
    return null;
  }
}

function hashObjectFile(repo, filePath) {
  return git(repo, ['hash-object', '--', filePath]);
}

function blobSha(repo, ref, path) {
  return tryGit(repo, ['rev-parse', `${ref}:${path}`]);
}

function listGitPaths(repo, ref) {
  const out = tryGit(repo, ['ls-tree', '-r', '--name-only', ref]);
  if (out === null) {
    return new Set();
  }
  return new Set(out.split('\n').filter((line) => line.length > 0));
}

function unionSets(...sets) {
  const out = new Set();
  for (const s of sets) {
    for (const v of s) {
      out.add(v);
    }
  }
  return out;
}

function detectChangeKind(baseBlob, theirsBlob) {
  // V1 doesn't yet propagate rename detection; deletes show up as theirsBlob === null
  // and the classifier's null-handling covers it.
  if (theirsBlob === null && baseBlob !== null) {
    return 'delete';
  }
  return undefined;
}

function buildItems(
  targetRepo,
  baseCommit,
  targetHeadRef,
  filteredDir,
  sourceRepo,
  targetOwnedRoots = [],
  overrideReasons = new Map(),
) {
  const filteredAbs = resolve(filteredDir);
  const baseSet = listGitPaths(targetRepo, baseCommit);
  const theirsSet = listGitPaths(targetRepo, targetHeadRef);
  const oursSet = listFsPaths(filteredAbs);
  const allPaths = unionSets(baseSet, theirsSet, oursSet);

  const items = [];
  for (const path of allPaths) {
    // Target-owned paths are preserved by sync's backup/restore logic and are NOT part of
    // the sync-managed surface. Mark them isTargetOwned=true so the classifier emits a
    // target-owned-pass instead of fail-closing on the (legitimate) "ours has no copy" shape.
    const isTargetOwned = isTargetOwnedPath(path, targetOwnedRoots);

    const baseBlob = blobSha(targetRepo, baseCommit, path);
    const theirsBlob = blobSha(targetRepo, targetHeadRef, path);
    const oursPath = join(filteredAbs, path);
    const oursBlob = existsSync(oursPath) ? hashObjectFile(sourceRepo, oursPath) : null;

    // V1 skip "no-delta" rows: all three identical AND present (or all three null)
    if (baseBlob === theirsBlob && theirsBlob === oursBlob) {
      continue;
    }

    // Binary detection: V1 INV-5 says binary deltas fail-closed. Detect by extension
    // first (cheap) and fall back to NUL-byte sniff on the candidate file.
    const isBinary = isBinaryPath(path, oursPath);

    // Plan AC matrix anchor (`docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
    // line 460): `.sync-provenance.json differs | PASS as provenance`. sync-to-opensource.sh
    // writes a fresh provenance JSON into FILTERED_DIR every run (line 1911), so absent this
    // signal the gate would BLOCK every real sync on the provenance file alone.
    const isGeneratedOrProvenance = isGeneratedOrProvenancePath(path);

    // AC-A4 / KD-3: --override <path>:<reason> flips BLOCK → override-pass via classifier's
    // maybeOverride(); >3 overrides flips cvoApprovalRequired, checked vs --cvo-approved.
    const overrideReason = overrideReasons.get(path);

    items.push(
      classifyPublicDeltaGateItem({
        path,
        baseBlob,
        theirsBlob,
        oursBlob,
        isTargetOwned,
        isBinary,
        isGeneratedOrProvenance,
        overrideReason,
        changeKind: detectChangeKind(baseBlob, theirsBlob),
      }),
    );
  }
  return items;
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const targetDir = requireString(args, 'target-dir');
  const filteredDir = requireString(args, 'filtered-dir');
  const sourceDir = requireString(args, 'source-dir');
  const syncModule = requireString(args, 'sync-module');

  let baseline;
  try {
    baseline = resolvePublicDeltaGateBaseline({
      targetRepo: targetDir,
      baseline: args.baseline,
      // Caller can override the default origin/main resolution. Sync invocations MUST pass
      // 'HEAD' because rsync overwrites the target worktree, not origin/main.
      headRef: args['head-ref'],
      noFetch: args['no-fetch'] === true,
    });
  } catch (error) {
    fail(3, `baseline resolution failed: ${error.message}`);
  }

  const targetOwnedRoots = Array.isArray(args['target-owned-root']) ? args['target-owned-root'] : [];

  // AC-A4: repeatable --override <path>:<reason> → path → reason map. Non-empty reason enforced.
  const overrideArgs = Array.isArray(args.override) ? args.override : [];
  const overrideReasons = new Map(overrideArgs.map(parseOverridePair).map(({ path, reason }) => [path, reason]));
  const cvoApproved = args['cvo-approved-public-delta-overwrite'] === true;

  let items;
  try {
    items = buildItems(
      targetDir,
      baseline.baselineCommit,
      baseline.targetHeadRef,
      filteredDir,
      sourceDir,
      targetOwnedRoots,
      overrideReasons,
    );
  } catch (error) {
    fail(3, `delta enumeration failed: ${error.message}`);
  }

  const sourceHead = tryGit(sourceDir, ['rev-parse', 'HEAD']) ?? 'unknown';
  // Resolve the ref to a SHA so report.targetHead is immutable evidence — AC-A3/A5/A6
  // reports must outlive ref movement. baseline.targetHeadRef keeps the ref name as
  // the human-readable diagnostic.
  const targetHead = tryGit(targetDir, ['rev-parse', baseline.targetHeadRef]) ?? baseline.targetHeadRef;
  const exportedHead = `filtered-dir:${resolve(filteredDir)}`;

  const report = buildPublicDeltaGateReport({
    items,
    syncModule,
    sourceHead,
    targetHead,
    exportedHead,
    baseline,
    generatedAt: args.timestamp,
  });

  let written;
  try {
    written = writePublicDeltaGateReports(report, {
      outputDir: args['output-dir'],
      timestamp: args.timestamp,
    });
  } catch (error) {
    fail(3, `report write failed: ${error.message}`);
  }

  // AC-A4 / KD-3: cvoApprovalRequired = (overrideCount > 3). --cvo-approved suppresses the
  // alarm (report still records cvoApprovalRequired=true for audit; blockCount still gates).
  const blocking = report.summary.blockCount > 0 || (report.summary.cvoApprovalRequired === true && !cvoApproved);
  process.stdout.write(
    `gate report: pass=${report.summary.passCount} block=${report.summary.blockCount} ` +
      `override=${report.summary.overrideCount} cvoApprovalRequired=${report.summary.cvoApprovalRequired} ` +
      `cvoApproved=${cvoApproved}\n`,
  );
  process.stdout.write(`json: ${written.jsonPath}\n`);
  process.stdout.write(`markdown: ${written.markdownPath}\n`);

  if (args['dry-run'] === true) {
    process.exit(0);
  }
  if (blocking) {
    process.stderr.write(
      `gate BLOCK: ${report.summary.blockCount} blocked, cvo=${report.summary.cvoApprovalRequired}\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
