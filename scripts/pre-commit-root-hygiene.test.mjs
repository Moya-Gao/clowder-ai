// pre-commit-root-hygiene.test.mjs — F214 Phase C
// Verifies the Root Hygiene Guard in .githooks/pre-commit:
//   - blocks NEW root-level debris (logs, scratch, forzadata, cookies)
//   - blocks NEW root-level stateful storage (*.rdb*, *.sqlite*) incl. the
//     dump.rdb.backup-<ts> glob trap
//   - allows legit root files and never touches nested (sub-dir) paths

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const HOOK = resolve(process.cwd(), '.githooks/pre-commit');

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r;
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'pre-commit-hygiene-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@cat.cafe');
  git(dir, 'config', 'user.name', 'test');
  writeFileSync(join(dir, 'README.md'), '# fixture');
  // .gitignore marks secret/local files (cloud P1 round-2): the hook must block
  // force-added (-f) ignored files like .env / .mcp.json, not let a catch-all
  // dotfile / *.json whitelist pass them through.
  writeFileSync(join(dir, '.gitignore'), '.env\n.env.local\n.mcp.json\n*.local\n');
  git(dir, 'add', 'README.md', '.gitignore');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

// Stage a NEW file, then run the hook in the repo. Returns spawnSync result.
function stageAndHook(dir, relpath, content = 'x') {
  const abs = join(dir, relpath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  git(dir, 'add', '-f', relpath); // -f: the guard must catch force-added debris
  return spawnSync('bash', [HOOK], { cwd: dir, encoding: 'utf8' });
}

describe('pre-commit Root Hygiene Guard: blocks new root debris', () => {
  let dir;
  beforeEach(() => {
    dir = setupRepo();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const blocked = [
    ['root .log', 'foo.log'],
    ['root .tmp', 'scratch.tmp'],
    ['root forzadata-*.txt', 'forzadata-network.txt'],
    ['root cookies.json', 'cookies.json'],
    ['root dump.rdb', 'dump.rdb'],
    ['root dump.rdb.backup-<ts> (glob trap)', 'dump.rdb.backup-20260209-180218'],
    ['root dump.rdb-backup (P2: hook regex was narrower than script *.rdb*)', 'dump.rdb-backup'],
    ['root evidence.sqlite', 'evidence.sqlite'],
    ['root evidence.sqlite-wal', 'evidence.sqlite-wal'],
    // P1: spec + Eval Contract Fixture 2 require whitelist semantics —
    // unanticipated, non-ignored, non-whitelist debris must be blocked.
    ['root unanticipated non-whitelist file (P1)', 'random-debris.xyz'],
    // P1 round-2 (cloud codex): force-added .gitignore-marked secret/local files
    // must be blocked — the catch-all .* / *.json whitelist must not pass them.
    ['root force-added .env secret (P1 round-2)', '.env'],
    ['root force-added .mcp.json secret (P1 round-2)', '.mcp.json'],
  ];
  for (const [name, file] of blocked) {
    it(`blocks: ${name}`, () => {
      const r = stageAndHook(dir, file);
      assert.equal(r.status, 1, `expected exit 1 (block) for ${file}; stdout=${r.stdout}`);
    });
  }
});

describe('pre-commit Root Hygiene Guard: allows legit + nested', () => {
  let dir;
  beforeEach(() => {
    dir = setupRepo();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const allowed = [
    ['legit markdown', 'NOTES.md'],
    ['legit config json', 'vitest.config.json'],
    ['legit yaml', 'renovate.yaml'],
    ['legit known-safe dotfile', '.npmrc'],
    ['legit env example (not ignored)', '.env.example'],
    ['nested log (not root)', 'packages/foo.log'],
    ['nested sqlite (not root)', 'data/world.sqlite'],
  ];
  for (const [name, file] of allowed) {
    it(`allows: ${name}`, () => {
      const r = stageAndHook(dir, file);
      assert.equal(r.status, 0, `expected exit 0 (allow) for ${file}; stderr=${r.stderr}`);
    });
  }
});
