// clean-root-debris.test.mjs — F214 Phase A
// Tests the triple-safety model of scripts/clean-root-debris.sh:
// a file is deleted ONLY IF (untracked) AND (matches whitelist) AND (not hard-protected).
// Critical regression: dump.rdb.backup-<ts> must NOT be deletable
// (the `*.rdb` glob does NOT match it — that gap would leak a sanctuary backup).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/clean-root-debris.sh');

// Untracked + whitelisted + not protected -> deletable
const WHITELIST_DEBRIS = ['foo.log', 'debug.log', 'forzadata-network.txt', 'cookies.json'];
// Untracked stateful storage -> hard-protected, NEVER deletable
const HARD_PROTECTED = [
  'dump.rdb',
  'dump.rdb.backup-20260209-180218', // glob trap: not matched by *.rdb
  'evidence.sqlite',
  'evidence.sqlite-wal',
  'world.sqlite',
];
// Git-tracked -> protected by rule #1, NEVER deletable
const TRACKED = ['cat-config.json', 'package.json'];
// Untracked but not on whitelist -> not a removal candidate
const NON_WHITELIST = ['random.xyz', 'notes.md'];

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r;
}

function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'root-debris-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@cat.cafe');
  git(dir, 'config', 'user.name', 'test');
  for (const f of TRACKED) writeFileSync(join(dir, f), '{}');
  git(dir, 'add', ...TRACKED);
  git(dir, 'commit', '-q', '-m', 'init');
  for (const f of [...WHITELIST_DEBRIS, ...HARD_PROTECTED, ...NON_WHITELIST]) {
    writeFileSync(join(dir, f), 'x');
  }
  return dir;
}

function run(dir, ...args) {
  return spawnSync('bash', [SCRIPT, '--root', dir, ...args], { encoding: 'utf8' });
}

describe('clean-root-debris: dry-run is the default and never deletes', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('exits 0', () => {
    assert.equal(run(dir).status, 0, run(dir).stderr);
  });

  it('lists every whitelist debris file as a removal candidate', () => {
    const out = run(dir).stdout;
    for (const f of WHITELIST_DEBRIS) assert.ok(out.includes(f), `dry-run should list ${f}`);
  });

  it('does NOT list protected / tracked / non-whitelist files', () => {
    const out = run(dir).stdout;
    for (const f of [...HARD_PROTECTED, ...TRACKED, ...NON_WHITELIST]) {
      assert.ok(!out.includes(f), `dry-run must NOT list ${f}`);
    }
  });

  it('deletes nothing on dry-run', () => {
    run(dir);
    for (const f of [...WHITELIST_DEBRIS, ...HARD_PROTECTED, ...TRACKED, ...NON_WHITELIST]) {
      assert.ok(existsSync(join(dir, f)), `${f} must still exist after dry-run`);
    }
  });
});

describe('clean-root-debris: --execute enforces triple safety', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('deletes untracked whitelist debris', () => {
    run(dir, '--execute');
    for (const f of WHITELIST_DEBRIS) {
      assert.ok(!existsSync(join(dir, f)), `${f} should be deleted`);
    }
  });

  it('NEVER deletes hard-protected stateful storage (incl. dump.rdb.backup-* glob trap)', () => {
    run(dir, '--execute');
    for (const f of HARD_PROTECTED) {
      assert.ok(existsSync(join(dir, f)), `sanctuary: ${f} must survive --execute`);
    }
  });

  it('NEVER deletes git-tracked files (cat-config.json included)', () => {
    run(dir, '--execute');
    for (const f of TRACKED) {
      assert.ok(existsSync(join(dir, f)), `tracked ${f} must survive --execute`);
    }
  });

  it('NEVER deletes untracked non-whitelist files', () => {
    run(dir, '--execute');
    for (const f of NON_WHITELIST) {
      assert.ok(existsSync(join(dir, f)), `non-whitelist ${f} must survive --execute`);
    }
  });
});

// Cloud codex P1: fail-closed when git tracking cannot be read.
// If --root is not a git worktree, `git ls-files` fails and (previously) was
// suppressed, leaving TRACKED_TOPLEVEL empty → the "NOT git-tracked" safety
// check silently passes for everything → debris in an ARBITRARY directory could
// be deleted. The script must abort instead of deleting on an unverifiable root.
describe('clean-root-debris: fail-closed when root is NOT a git worktree', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'root-debris-nogit-'));
    writeFileSync(join(dir, 'foo.log'), 'x');
    writeFileSync(join(dir, 'cookies.json'), 'x');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('aborts with nonzero exit on --execute when root is not a git worktree', () => {
    const r = spawnSync('bash', [SCRIPT, '--root', dir, '--execute'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, `expected abort on non-git root; stdout=${r.stdout}`);
  });

  it('deletes nothing when root is not a git worktree (fail-closed)', () => {
    spawnSync('bash', [SCRIPT, '--root', dir, '--execute'], { encoding: 'utf8' });
    assert.ok(existsSync(join(dir, 'foo.log')), 'foo.log must survive on non-git root');
    assert.ok(existsSync(join(dir, 'cookies.json')), 'cookies.json must survive on non-git root');
  });
});
