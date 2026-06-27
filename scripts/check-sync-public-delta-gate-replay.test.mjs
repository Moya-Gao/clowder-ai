// F251 Task 4b — AC-A5 historical replay regression test.
//
// Asserts the Task 4a delta gate would have BLOCKED the real clowder-ai#723
// regression (sync merge 89cc0f220, 2026-05-19) when given the actual 3-way
// byte-state from that event.
//
// Hermetic: stages 3 synthetic git repos from frozen fixture under
// `scripts/_fixtures/f251-replay-clowder-ai-720/`, runs the CLI with
// --no-fetch, asserts BLOCK + path-level shape.
//
// If this test goes RED: the gate would NOT have caught the real incident.
// Either Task 4a code has a bug, or the fixture provenance drifted. See
// `scripts/_fixtures/f251-replay-clowder-ai-720/README.md` for re-extraction.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'check-sync-public-delta-gate-cli.mjs');
const FIXTURE_DIR = join(HERE, '_fixtures', 'f251-replay-clowder-ai-720');
const FIXED_TIMESTAMP = '2026-06-26T05:00:00.000Z';

function git(repo, args) {
  execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
}

function makeRepo(rootName) {
  const root = mkdtempSync(join(tmpdir(), `${rootName}-`));
  execFileSync('git', ['init', '-q', '-b', 'main', root], { stdio: 'pipe' });
  git(root, ['config', 'user.email', 'replay@example.com']);
  git(root, ['config', 'user.name', 'Replay']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}

function writeBlob(repo, relPath, content) {
  const full = join(repo, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commit(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--allow-empty', '-m', message]);
  return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}

// Walk fixture side dir (base / theirs / ours) and collect { path → content }.
// Side dir layout mirrors the affected paths: scripts/_fixtures/.../base/packages/web/...
function loadFixtureSide(side) {
  const root = join(FIXTURE_DIR, side);
  if (!existsSync(root)) return new Map();
  const map = new Map();
  function walk(dir, rel) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const childRel = rel ? `${rel}/${entry}` : entry;
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, childRel);
      } else if (st.isFile()) {
        map.set(childRel, readFileSync(full, 'utf-8'));
      }
    }
  }
  walk(root, '');
  return map;
}

// Stage the target repo with 2 commits: baseline (base bytes + sync tag) + HEAD (theirs bytes).
function stageTarget(baseFiles, theirsFiles, manifest) {
  const repo = makeRepo('replay-target');
  // Baseline commit: write all base-side files
  for (const [path, content] of baseFiles) {
    writeBlob(repo, path, content);
  }
  const baselineCommit = commit(repo, 'baseline (pre community PRs)');
  git(repo, ['tag', manifest.provenance.baselineTag, baselineCommit]);
  git(repo, ['update-ref', `refs/${manifest.provenance.baselineTag}`, baselineCommit]);

  // Theirs commit: overwrite with theirs-side files (add new, modify changed, leave deletes by recreating from theirs)
  // For paths that exist at theirs but not at base, this commit adds them.
  // For paths that exist at base but not at theirs, we delete them so the tree exactly matches theirs.
  const baselineSet = new Set(baseFiles.keys());
  const theirsSet = new Set(theirsFiles.keys());
  // Remove files present at base but absent at theirs (community deletes)
  for (const path of baselineSet) {
    if (!theirsSet.has(path)) {
      const full = join(repo, path);
      if (existsSync(full)) {
        execFileSync('rm', [full]);
      }
    }
  }
  // Write theirs-side files
  for (const [path, content] of theirsFiles) {
    writeBlob(repo, path, content);
  }
  commit(repo, 'community PRs land — theirs state pre-#720');
  return { repo, baselineCommit };
}

// Stage source repo (cat-cafe checkout) — minimal, just needs to exist for sourceHead.
function stageSource() {
  const repo = makeRepo('replay-source');
  writeBlob(repo, 'README.md', '# cat-cafe replay source\n');
  commit(repo, 'source baseline');
  return repo;
}

// Stage filtered dir (cat-cafe export tree) — written with ours-side files.
function stageFiltered(oursFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'replay-filtered-'));
  for (const [path, content] of oursFiles) {
    writeBlob(dir, path, content);
  }
  return dir;
}

function runCli(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' });
}

test('F251 AC-A5: replay clowder-ai#720 sync overwrite → gate BLOCKS', () => {
  const manifestPath = join(FIXTURE_DIR, 'manifest.json');
  assert.ok(existsSync(manifestPath), `fixture manifest missing — run extract-historical-sync-fixture.mjs`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const baseFiles = loadFixtureSide('base');
  const theirsFiles = loadFixtureSide('theirs');
  const oursFiles = loadFixtureSide('ours');

  assert.ok(theirsFiles.size > 0, 'theirs fixture must have files');
  assert.ok(oursFiles.size > 0, 'ours fixture must have files');

  const { repo: targetRepo } = stageTarget(baseFiles, theirsFiles, manifest);
  const sourceRepo = stageSource();
  const filteredDir = stageFiltered(oursFiles);
  const outputDir = mkdtempSync(join(tmpdir(), 'replay-out-'));

  const result = runCli([
    '--target-dir',
    targetRepo,
    '--filtered-dir',
    filteredDir,
    '--source-dir',
    sourceRepo,
    '--sync-module',
    'full-outbound',
    '--no-fetch',
    '--head-ref',
    'HEAD',
    '--output-dir',
    outputDir,
    '--timestamp',
    FIXED_TIMESTAMP,
  ]);

  assert.equal(
    result.status,
    1,
    `expected BLOCK on replay of clowder-ai#720; got exit ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stderr, /gate BLOCK:/);

  const jsonLine = result.stdout.split('\n').find((l) => l.startsWith('json: '));
  assert.ok(jsonLine, 'CLI must print json path');
  const report = JSON.parse(readFileSync(jsonLine.slice('json: '.length), 'utf-8'));

  // The fixture has 23 paths total. 3 are no-delta (skipped), 20 must BLOCK.
  // We assert blockCount >= 20 — the fixture's replayShapeCounts contract.
  assert.ok(
    report.summary.blockCount >= 20,
    `expected ≥ 20 BLOCK paths from the replay; got ${report.summary.blockCount}. Items:\n` +
      report.items.map((i) => `  ${i.path} → ${i.mode}`).join('\n'),
  );

  // Spot-check the 3 highest-signal P1 paths from the audit must BLOCK
  const appShell = report.items.find((i) => i.path === 'packages/web/src/components/AppShell.tsx');
  assert.ok(appShell, 'AppShell.tsx must appear in report');
  assert.match(appShell.mode, /block/, `AppShell.tsx must BLOCK, got mode=${appShell.mode}`);

  const chatContainer = report.items.find((i) => i.path === 'packages/web/src/components/ChatContainer.tsx');
  assert.ok(chatContainer, 'ChatContainer.tsx must appear in report');
  assert.match(chatContainer.mode, /block/, `ChatContainer.tsx must BLOCK, got mode=${chatContainer.mode}`);

  const hubListModal = report.items.find((i) => i.path === 'packages/web/src/components/HubListModal.tsx');
  assert.ok(hubListModal, 'HubListModal.tsx must appear in report');
  assert.match(hubListModal.mode, /block/, `HubListModal.tsx must BLOCK, got mode=${hubListModal.mode}`);
});

test('F251 AC-A5 fixture provenance: manifest matches expected anchor SHAs', () => {
  // Lock the fixture provenance so future regenerations require an explicit retarget.
  const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
  assert.equal(manifest.provenance.mergeSha, '89cc0f220936d863cbb571bd51ff94e6d7efe583');
  assert.equal(manifest.provenance.baselineSha, 'ddaca35469db900d4dbbf106250f0390b0203de5');
  assert.equal(manifest.provenance.theirsSha, '373b4bdd4910d4c8140069b0643de4e4ec64f87d');
  assert.equal(manifest.provenance.oursSha, '89cc0f220936d863cbb571bd51ff94e6d7efe583');
  assert.equal(manifest.anchorIncident.issueId, 723);
});

// Compute git's `hash-object` SHA-1 (blob header + content) without shelling out to git.
function gitBlobSha(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const header = Buffer.from(`blob ${buf.length}\0`);
  return createHash('sha1')
    .update(Buffer.concat([header, buf]))
    .digest('hex');
}

function walkFixtureSide(sideDir) {
  const found = new Map();
  if (!existsSync(sideDir)) return found;
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const rel = relative(sideDir, full).split('\\').join('/');
        found.set(rel, readFileSync(full));
      }
    }
  }
  walk(sideDir);
  return found;
}

test('F251 AC-A5 fixture bytes match manifest per-path blob SHAs (R1 cloud P2 #3485003585)', () => {
  // The provenance test only locks the top-level anchor SHAs. Without per-path validation,
  // an accidental biome reformat / stray edit to any fixture byte would silently alter the
  // replay (aggregate blockCount might stay high even if individual paths drift). Hash every
  // file under {base,theirs,ours}/ and assert against `manifest.paths[].{base,theirs,ours}BlobSha`.
  // Also reverse-check: no extra/stale file may exist that is not declared in the manifest.
  const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
  const manifestByPath = new Map(manifest.paths.map((p) => [p.path, p]));

  for (const side of ['base', 'theirs', 'ours']) {
    const found = walkFixtureSide(join(FIXTURE_DIR, side));
    const shaKey = `${side}BlobSha`;

    // Forward check: every manifest entry whose <side>BlobSha != null must match the actual file
    for (const entry of manifest.paths) {
      const expectedSha = entry[shaKey];
      const actualContent = found.get(entry.path);
      if (expectedSha === null) {
        assert.equal(actualContent, undefined, `${side}/${entry.path}: manifest says missing but a file exists`);
      } else {
        assert.ok(actualContent !== undefined, `${side}/${entry.path}: manifest expects content but file missing`);
        const actualSha = gitBlobSha(actualContent);
        assert.equal(
          actualSha,
          expectedSha,
          `${side}/${entry.path}: blob SHA mismatch — expected ${expectedSha}, got ${actualSha}`,
        );
      }
    }

    // Reverse check: every found file must be declared in the manifest
    for (const path of found.keys()) {
      const entry = manifestByPath.get(path);
      assert.ok(entry, `${side}/${path}: file exists but not declared in manifest.paths`);
      assert.notEqual(
        entry[shaKey],
        null,
        `${side}/${path}: file exists but manifest declares ${shaKey}=null — stale fixture`,
      );
    }
  }
});
