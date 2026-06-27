#!/usr/bin/env node
// extract-historical-sync-fixture.mjs — F251 Task 4b one-shot fixture extractor.
//
// Reads real clowder-ai git history at the `clowder-ai#723` anchor incident
// (sync merge 89cc0f220, 2026-05-19 08:18 UTC, PR #720) and freezes the 3-way
// byte-state (base / theirs / ours) for the 6 affected path globs into a
// hermetic test fixture under `scripts/_fixtures/f251-replay-clowder-ai-720/`.
//
// NOT run by tests. Run manually when:
//   - First-time fixture creation
//   - Re-extraction (verify provenance match) after sanity check
//
// Usage:
//   node scripts/extract-historical-sync-fixture.mjs \
//     --clowder-ai-dir /path/to/clowder-ai \
//     [--out scripts/_fixtures/f251-replay-clowder-ai-720]
//
// Provenance anchors (KD-8 / KD-9):
//   theirs   = 89cc0f220^1 = clowder-ai main pre-sync (has the 17 F190 items)
//   ours     = 89cc0f220   = post-bad-sync state (lacks the items)
//   baseline = sync/2026-05-06-183113 (previous landed sync tag)
//
// Note: `89cc0f220` is a squash-merge with one parent (not a 3-way merge), so
// `ours` is read from the squash commit itself (= the bytes that landed on main
// = what the sync would write).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MERGE_SHA = '89cc0f220936d863cbb571bd51ff94e6d7efe583';
const BASELINE_TAG = 'sync/2026-05-06-183113';

// Affected paths from `docs/ops/community-sync-incident-ledger.json` issueId 723.
// Concrete files (no glob) — `voice/**`, `settings/**`, `skills/**` are expanded by
// reading the actual tree at the `theirs` commit (so we capture exactly what was on
// clowder-ai pre-sync, not what we'd have to glob-match later).
const CONCRETE_PATHS = [
  'packages/web/src/components/AppShell.tsx',
  'packages/web/src/components/ChatContainer.tsx',
  'packages/web/src/components/HubListModal.tsx',
];

const GLOB_PREFIXES = [
  'packages/web/src/components/voice/',
  'packages/web/src/components/settings/',
  'packages/web/src/components/skills/',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      throw new Error(`unexpected positional: ${flag}`);
    }
    args[flag.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024, // 32 MB for large tree listings
    }).trim();
  } catch (error) {
    throw new Error(`git ${args.join(' ')} (cwd=${repo}) failed: ${error.message}`);
  }
}

function gitOptional(repo, args) {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
}

function expandGlobPaths(repo, ref, prefix) {
  // ls-tree -r --name-only <ref> lists all files reachable from ref's tree.
  // Filter to those starting with the prefix.
  const out = git(repo, ['ls-tree', '-r', '--name-only', ref]);
  return out.split('\n').filter((line) => line.startsWith(prefix));
}

function readBlob(repo, ref, path) {
  try {
    return execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], {
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function blobSha(repo, ref, path) {
  return gitOptional(repo, ['rev-parse', `${ref}:${path}`]);
}

function resolveAnchorRefs(clowderDir) {
  return {
    theirsSha: git(clowderDir, ['rev-parse', `${MERGE_SHA}^1`]),
    oursSha: git(clowderDir, ['rev-parse', MERGE_SHA]),
    baselineSha: git(clowderDir, ['rev-parse', BASELINE_TAG]),
    extractedAt: git(clowderDir, ['log', '-1', '--format=%cI', MERGE_SHA]),
  };
}

function collectAffectedPaths(clowderDir, theirsSha) {
  // Read the theirs commit (clowder-ai pre-sync) because that's the state that *contained*
  // the F190 items the bad sync would erase.
  const paths = [...CONCRETE_PATHS];
  for (const prefix of GLOB_PREFIXES) {
    paths.push(...expandGlobPaths(clowderDir, theirsSha, prefix));
  }
  return [...new Set(paths)].sort();
}

function writePathBytes(clowderDir, outDir, path, refs) {
  for (const [side, ref] of [
    ['base', refs.baselineSha],
    ['theirs', refs.theirsSha],
    ['ours', refs.oursSha],
  ]) {
    const content = readBlob(clowderDir, ref, path);
    if (content === null) continue; // absence encodes "file not present at this ref"
    const out = join(outDir, side, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
  }
}

function buildPathEntries(clowderDir, outDir, paths, refs) {
  const entries = [];
  for (const path of paths) {
    entries.push({
      path,
      baseBlobSha: blobSha(clowderDir, refs.baselineSha, path),
      theirsBlobSha: blobSha(clowderDir, refs.theirsSha, path),
      oursBlobSha: blobSha(clowderDir, refs.oursSha, path),
    });
    writePathBytes(clowderDir, outDir, path, refs);
  }
  return entries;
}

function countReplayShapes(pathEntries) {
  let revertCandidates = 0;
  let targetAddedCandidates = 0;
  for (const p of pathEntries) {
    if (p.oursBlobSha === p.baseBlobSha && p.theirsBlobSha !== p.baseBlobSha) {
      revertCandidates += 1;
    }
    if (
      p.baseBlobSha === null &&
      p.theirsBlobSha !== null &&
      p.oursBlobSha !== null &&
      p.theirsBlobSha !== p.oursBlobSha
    ) {
      targetAddedCandidates += 1;
    }
  }
  return { revertCandidates, targetAddedCandidates, totalPaths: pathEntries.length };
}

function buildManifest(refs, pathEntries) {
  return {
    schemaVersion: 'v0',
    feature: 'F251',
    task: '4b',
    anchorIncident: {
      issueId: 723,
      title: 'Console 视觉审计：#720 同步覆盖了 F190 设计实现（17 项回退）',
      reporter: 'mindfn',
      class: 'C1a + C3 (compound)',
    },
    provenance: {
      sourceRepo: 'clowder-ai',
      mergeSha: MERGE_SHA,
      mergeTitle: 'sync: full outbound cat-cafe → clowder-ai (2026-05-19) (#720)',
      mergeCommittedAt: refs.extractedAt,
      baselineSha: refs.baselineSha,
      baselineTag: BASELINE_TAG,
      theirsSha: refs.theirsSha,
      oursSha: refs.oursSha,
    },
    paths: pathEntries,
    replayShapeCounts: countReplayShapes(pathEntries),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const clowderDir = args['clowder-ai-dir'];
  if (!clowderDir) throw new Error('--clowder-ai-dir is required');
  const outDir = resolve(args.out ?? 'scripts/_fixtures/f251-replay-clowder-ai-720');
  if (!existsSync(clowderDir)) throw new Error(`clowder-ai dir not found: ${clowderDir}`);

  const refs = resolveAnchorRefs(clowderDir);
  console.log(`baseline (${BASELINE_TAG}) = ${refs.baselineSha}`);
  console.log(`theirs   (${MERGE_SHA}^1) = ${refs.theirsSha}`);
  console.log(`ours     (${MERGE_SHA})   = ${refs.oursSha}`);

  const paths = collectAffectedPaths(clowderDir, refs.theirsSha);
  console.log(`Total affected paths: ${paths.length}`);

  // Clear stale fixture bytes before re-extraction (R1 cloud P2 #3485003587).
  // The fixture dir keeps committed README + manifest.json; only the {base,theirs,ours}/ side
  // trees are regenerated. Without this, files removed from the affected-path list in a later
  // extraction would silently linger as stale bytes and skew the replay against a mix of old
  // and new state.
  for (const side of ['base', 'theirs', 'ours']) {
    rmSync(join(outDir, side), { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });
  const pathEntries = buildPathEntries(clowderDir, outDir, paths, refs);
  const manifest = buildManifest(refs, pathEntries);

  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nFixture written to: ${outDir}`);
  console.log(`Revert candidates (ours==base != theirs): ${manifest.replayShapeCounts.revertCandidates}`);
  console.log(
    `Target-added conflict (base=null, theirs/ours differ): ${manifest.replayShapeCounts.targetAddedCandidates}`,
  );
}

main();
