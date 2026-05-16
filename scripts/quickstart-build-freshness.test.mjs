// Regression test for the runtime quick-start build-freshness gate.
//
// Bug (实证根因): scripts/runtime-worktree.sh ensure_quick_start_artifacts()
// gated rebuilds on artifact EXISTENCE ([ ! -f dist/index.js ]). Once dist
// existed it was never rebuilt again, so source changes (e.g. 4a67897c5
// rewriting evidence-tools.ts) never reached the running MCP server even
// across many restarts. Fix: gate on source FRESHNESS via a git-HEAD stamp.
//
// needs_rebuild <product> <stamp> <current_head>
//   exit 0 → rebuild required, exit 1 → skip (quick path)

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const ROOT = resolve(process.cwd());
const LIB = resolve(ROOT, 'scripts/lib/quickstart-freshness.sh');

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'cc-qs-freshness-'));
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** Run `needs_rebuild` and return its exit code (0 = rebuild, 1 = skip). */
function needsRebuild(product, stamp, head) {
  const r = spawnSync('bash', ['-c', `source "${LIB}"; needs_rebuild "${product}" "${stamp}" "${head}"`], {
    cwd: sandbox,
  });
  return r.status;
}

describe('quickstart needs_rebuild freshness gate', () => {
  it('rebuilds when the build product is missing', () => {
    const product = join(sandbox, 'dist/index.js'); // not created
    const stamp = join(sandbox, 'dist/.build-commit');
    assert.equal(needsRebuild(product, stamp, 'abc123'), 0);
  });

  it('rebuilds when product exists but stamp is missing (legacy deploy — THE BUG)', () => {
    const product = join(sandbox, 'index.js');
    writeFileSync(product, '// built long ago, no stamp');
    const stamp = join(sandbox, '.build-commit'); // not created
    assert.equal(needsRebuild(product, stamp, 'abc123'), 0);
  });

  it('rebuilds when stamp commit differs from current HEAD (source synced — 4a67897c5 case)', () => {
    const product = join(sandbox, 'index.js');
    const stamp = join(sandbox, '.build-commit');
    writeFileSync(product, '// stale build');
    writeFileSync(stamp, 'OLDCOMMIT0000000000000000000000000000000');
    assert.equal(needsRebuild(product, stamp, 'NEWCOMMIT1111111111111111111111111111111'), 0);
  });

  it('skips when product exists and stamp matches current HEAD (quick fast-path)', () => {
    const product = join(sandbox, 'index.js');
    const stamp = join(sandbox, '.build-commit');
    writeFileSync(product, '// fresh build');
    writeFileSync(stamp, 'SAMECOMMIT22222222222222222222222222222222');
    assert.equal(needsRebuild(product, stamp, 'SAMECOMMIT22222222222222222222222222222222'), 1);
  });

  it('skips conservatively when HEAD is unavailable (do not block startup on git failure)', () => {
    const product = join(sandbox, 'index.js');
    const stamp = join(sandbox, '.build-commit');
    writeFileSync(product, '// build present');
    writeFileSync(stamp, 'SOMECOMMIT33333333333333333333333333333333');
    assert.equal(needsRebuild(product, stamp, ''), 1);
  });

  it('skips on non-git in-place runtime (HEAD unavailable + stamp missing — cloud P1 PR #1706)', () => {
    // start_runtime_worktree sets RUNTIME_DIR=PROJECT_DIR when !is_git_repo.
    // head_commit is then always empty; record_build_stamp refuses to write
    // an empty HEAD, so the stamp NEVER materializes. If we checked stamp
    // before HEAD, every quick-start restart would rebuild all 3 packages —
    // worse than the original bug (web build is slow). HEAD check must come
    // FIRST to short-circuit non-git deployment.
    const product = join(sandbox, 'index.js');
    const stamp = join(sandbox, '.build-commit'); // NEVER written (empty HEAD)
    writeFileSync(product, '// in-place runtime artifact');
    assert.equal(needsRebuild(product, stamp, ''), 1);
  });
});

/** Run `record_build_stamp` against the sandbox. */
function recordStamp(stamp, head) {
  return spawnSync('bash', ['-c', `source "${LIB}"; record_build_stamp "${stamp}" "${head}"`], { cwd: sandbox });
}

describe('quickstart record_build_stamp', () => {
  it('writes the commit so the next start can detect a source move', () => {
    const stamp = join(sandbox, 'dist/.build-commit');
    recordStamp(stamp, 'COMMITAAAA0000000000000000000000000000000');
    assert.equal(readFileSync(stamp, 'utf8').trim(), 'COMMITAAAA0000000000000000000000000000000');
  });

  it('creates the parent dir if missing (first build into fresh dist)', () => {
    const stamp = join(sandbox, 'nested/deep/.build-commit');
    recordStamp(stamp, 'COMMITBBBB1111111111111111111111111111111');
    assert.ok(existsSync(stamp));
  });

  it('writes nothing when HEAD is unavailable (no false-fresh stamp)', () => {
    const stamp = join(sandbox, 'dist/.build-commit');
    recordStamp(stamp, '');
    assert.equal(existsSync(stamp), false);
  });

  it('paired with needs_rebuild: stamp written after build makes next start skip', () => {
    const product = join(sandbox, 'index.js');
    const stamp = join(sandbox, '.build-commit');
    writeFileSync(product, '// just built');
    recordStamp(stamp, 'HEADNOW999999999999999999999999999999999');
    assert.equal(needsRebuild(product, stamp, 'HEADNOW999999999999999999999999999999999'), 1);
  });
});

// Closure guard (砚砚 P1): runtime-worktree.sh now `source`s a lib file.
// sync-manifest.yaml only exports files listed in managed_scripts, so any
// fixed-path source dependency MUST be exported too — otherwise the opensource
// mirror's `set -e` runtime-worktree.sh dies sourcing a missing file. This
// guards the whole closure, not just this one fix.
describe('runtime-worktree.sh source closure ⊆ sync-manifest managed_scripts', () => {
  it('every fixed-path `source "$SCRIPT_DIR/..."` is in managed_scripts', () => {
    const script = readFileSync(resolve(ROOT, 'scripts/runtime-worktree.sh'), 'utf8');
    // Closure members live in scripts/lib/ by convention (mcp-health.mjs,
    // platform-status.mjs, quickstart-freshness.sh). Match the `/lib/<file>`
    // tail so it works regardless of how the prefix is resolved ($SCRIPT_DIR
    // or the BASH_SOURCE wrapper). `source "$1"` (dynamic arg) has no /lib/
    // and is correctly excluded.
    const sourced = [...script.matchAll(/source\b[^\n]*?\/(lib\/[\w.-]+\.(?:sh|mjs|js))"/g)].map(
      (m) => `scripts/${m[1]}`,
    );
    assert.ok(sourced.length > 0, 'expected at least one fixed-path source');

    const manifest = readFileSync(resolve(ROOT, 'sync-manifest.yaml'), 'utf8');
    const block = manifest.slice(manifest.indexOf('managed_scripts:'));
    const end = block.search(/\n[A-Za-z_]+:/);
    const managed = new Set(
      (end === -1 ? block : block.slice(0, end))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- '))
        // strip YAML inline comments (`- path  # why`) — comments are valid YAML
        .map((l) => l.slice(2).split('#')[0].trim()),
    );

    const missing = sourced.filter((p) => !managed.has(p));
    assert.deepEqual(missing, [], `sourced but not in managed_scripts: ${missing.join(', ')}`);
  });
});
