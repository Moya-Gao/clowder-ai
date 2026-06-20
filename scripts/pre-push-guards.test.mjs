import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { CHECK_SCRIPT, commitCode, commitDocs, createTestRepo, headSha, runHook } from './pre-push-test-utils.mjs';

// ═══════════════════════════════════════════════════════════════
// Layer 1: Direct Push to Main Block
// ═══════════════════════════════════════════════════════════════
describe('Layer 1: Direct push to main block', () => {
  let ctx;
  before(() => {
    ctx = createTestRepo();
  });
  after(() => {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('blocks code push to main', () => {
    const remoteSha = headSha(ctx.repoDir);
    commitCode(ctx.repoDir);
    const localSha = headSha(ctx.repoDir);

    const r = runHook(ctx.repoDir, `refs/heads/main ${localSha} refs/heads/main ${remoteSha}\n`);

    assert.equal(r.status, 1, 'should block');
    assert.match(r.stderr, /BLOCKED/i);
  });

  it('allows docs-only push to main', () => {
    // Reset to clean state
    execSync('git reset --hard origin/main', { cwd: ctx.repoDir });
    commitDocs(ctx.repoDir);
    const remoteSha = execSync('git rev-parse origin/main', { cwd: ctx.repoDir, encoding: 'utf8' }).trim();
    const localSha = headSha(ctx.repoDir);

    const r = runHook(ctx.repoDir, `refs/heads/main ${localSha} refs/heads/main ${remoteSha}\n`);

    assert.equal(r.status, 0, 'should allow docs-only');
  });

  it('skips delete pushes (all-zero local_sha)', () => {
    const zeros = '0000000000000000000000000000000000000000';
    const remoteSha = headSha(ctx.repoDir);

    const r = runHook(ctx.repoDir, `refs/heads/main ${zeros} refs/heads/main ${remoteSha}\n`);

    assert.equal(r.status, 0);
  });

  it('skips tag pushes', () => {
    const sha = headSha(ctx.repoDir);
    const r = runHook(ctx.repoDir, `refs/tags/v1.0 ${sha} refs/tags/v1.0 ${sha}\n`);

    assert.equal(r.status, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Layer 2 (A'): Cross-branch Push Guard
// ═══════════════════════════════════════════════════════════════
describe("Layer 2 (A'): Cross-branch push guard", () => {
  let ctx;
  before(() => {
    ctx = createTestRepo();
    // Create a feature branch
    execSync('git checkout -b feat/my-feature', { cwd: ctx.repoDir });
    commitCode(ctx.repoDir, 'src/feature.js', 'export const x = 1;');
  });
  after(() => {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('blocks push to different remote branch', () => {
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    // On feat/my-feature, pushing to feat/someone-elses-branch
    const r = runHook(ctx.repoDir, `refs/heads/feat/my-feature ${sha} refs/heads/feat/someone-elses-branch ${zeros}\n`);

    assert.equal(r.status, 1, 'should block cross-branch push');
    assert.match(r.stderr, /Cross-branch push/i);
    assert.match(r.stderr, /someone-elses-branch/);
  });

  it('allows push to same remote branch', () => {
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    // On feat/my-feature, pushing to feat/my-feature — correct
    const r = runHook(ctx.repoDir, `refs/heads/feat/my-feature ${sha} refs/heads/feat/my-feature ${zeros}\n`);

    assert.equal(r.status, 0, 'should allow same-branch push');
  });

  it('allows push feat/b:feat/b from feat/a checkout (P1 regression)', () => {
    // Scenario: you're checked out on feat/a but push feat/b to origin/feat/b.
    // The old code used HEAD (=feat/a) and would false-positive block this.
    // Fix: use local_ref from stdin (=refs/heads/feat/b), not HEAD.
    execSync('git checkout -B feat/branch-a', { cwd: ctx.repoDir });
    execSync('git checkout -B feat/branch-b', { cwd: ctx.repoDir });
    commitCode(ctx.repoDir, 'src/b.js', 'export const b = 1;');
    const bSha = headSha(ctx.repoDir);

    // Switch back to feat/branch-a (HEAD is now feat/branch-a)
    execSync('git checkout feat/branch-a', { cwd: ctx.repoDir });

    const zeros = '0000000000000000000000000000000000000000';
    // stdin says we're pushing refs/heads/feat/branch-b to refs/heads/feat/branch-b
    const r = runHook(ctx.repoDir, `refs/heads/feat/branch-b ${bSha} refs/heads/feat/branch-b ${zeros}\n`);

    assert.equal(r.status, 0, 'should allow — local_ref matches remote_ref');
    assert.ok(!r.stderr.includes('BLOCKED'), 'must not false-positive block');
  });

  it('blocks detached HEAD push to named branch (P2 regression)', () => {
    // Scenario: detached HEAD, `git push origin HEAD:feat/other`.
    // local_ref = HEAD (not refs/heads/*), remote_ref = refs/heads/feat/other.
    // Old code skipped Layer 2 entirely. Fix: block non-branch refs.
    execSync('git checkout --detach HEAD', { cwd: ctx.repoDir });
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `HEAD ${sha} refs/heads/feat/other ${zeros}\n`);

    assert.equal(r.status, 1, 'should block non-branch ref push');
    assert.match(r.stderr, /Non-branch ref/i);

    // Restore
    execSync('git checkout feat/my-feature 2>/dev/null || git checkout -B feat/my-feature', { cwd: ctx.repoDir });
  });

  it('allows detached HEAD push with override (P2 override)', () => {
    execSync('git checkout --detach HEAD', { cwd: ctx.repoDir });
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `HEAD ${sha} refs/heads/feat/other ${zeros}\n`, {
      GIT_GUARDS_ALLOW_CROSS_BRANCH: '1',
    });

    assert.equal(r.status, 0, 'should allow with override');
    assert.match(r.stderr, /override/i);

    // Restore
    execSync('git checkout feat/my-feature 2>/dev/null || git checkout -B feat/my-feature', { cwd: ctx.repoDir });
  });

  it('allows git push origin HEAD from attached branch (cloud P1 regression)', () => {
    // Scenario: `git push origin HEAD` sends literal local_ref=HEAD even when
    // the branch is attached. Must resolve HEAD→branch ref, not block.
    execSync('git checkout feat/my-feature', { cwd: ctx.repoDir });
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    // git push origin HEAD sends: "HEAD <sha> refs/heads/feat/my-feature <remote_sha>"
    const r = runHook(ctx.repoDir, `HEAD ${sha} refs/heads/feat/my-feature ${zeros}\n`);

    assert.equal(r.status, 0, 'should resolve HEAD to branch and allow same-branch push');
    assert.ok(!r.stderr.includes('BLOCKED'), 'must not block attached HEAD push to same branch');
  });

  it('allows cross-branch with override env var', () => {
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `refs/heads/feat/my-feature ${sha} refs/heads/feat/other ${zeros}\n`, {
      GIT_GUARDS_ALLOW_CROSS_BRANCH: '1',
    });

    assert.equal(r.status, 0, 'should allow with override');
    assert.match(r.stderr, /override/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// Layer 3 (B-track): Squash-merge Injection Detection
// ═══════════════════════════════════════════════════════════════
describe('Layer 3 (B-track): Squash-merge injection detection', () => {
  let ctx;
  before(() => {
    ctx = createTestRepo();
    // Simulate a squash-merge commit on main
    commitCode(ctx.repoDir, 'src/merged.js', 'export const merged = true;');
    execSync('git push origin main', { cwd: ctx.repoDir });

    // Create feature branch from before the squash-merge
    execSync('git checkout -b feat/detect-test', { cwd: ctx.repoDir });
  });
  after(() => {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('warns when upstream tracks origin/main', () => {
    // Set upstream to origin/main (misconfigured)
    execSync('git branch --set-upstream-to=origin/main', { cwd: ctx.repoDir });
    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `refs/heads/feat/detect-test ${sha} refs/heads/feat/detect-test ${zeros}\n`);

    // Should warn but NOT block
    assert.equal(r.status, 0, 'B-track should not block');
    assert.match(r.stderr, /B-TRACK/);
    assert.match(r.stderr, /tracks.*origin\/main/);

    // Clean up upstream
    execSync('git branch --unset-upstream 2>/dev/null || true', { cwd: ctx.repoDir });
  });

  it('warns when branch commits match main subjects', () => {
    // Create a feature branch from BEFORE the main squash-merge
    const initSha = execSync('git log --oneline --reverse | head -1 | cut -d" " -f1', {
      cwd: ctx.repoDir,
      encoding: 'utf8',
    }).trim();
    execSync(`git checkout -B feat/inject-test ${initSha}`, { cwd: ctx.repoDir });

    // Make a unique feature commit first (so the branch diverges from main)
    commitCode(ctx.repoDir, 'src/mine.js', 'export const mine = true;');

    // Now simulate injection: create a commit with the SAME subject as one on main
    const mainSubject = execSync('git log --oneline -1 origin/main | cut -d" " -f2-', {
      cwd: ctx.repoDir,
      encoding: 'utf8',
    }).trim();
    writeFileSync(path.join(ctx.repoDir, 'src', 'injected.js'), 'injected');
    execSync(`git add src/injected.js && git commit -m "${mainSubject}"`, { cwd: ctx.repoDir });

    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `refs/heads/feat/inject-test ${sha} refs/heads/feat/inject-test ${zeros}\n`);

    assert.equal(r.status, 0, 'B-track should not block');
    assert.match(r.stderr, /B-TRACK.*commit.*match/i);
  });

  it('does NOT false-warn when pushing feat/b from feat/a that tracks main (cloud P2-a regression)', () => {
    // Scenario: feat/a tracks origin/main (misconfigured), feat/b does NOT.
    // Push feat/b while checked out on feat/a.
    // Old code: @{upstream} resolves for HEAD (=feat/a) → incorrectly warns about feat/b.
    // Fix: use LOCAL_PUSH_BRANCH's upstream, not HEAD's.
    const mainSha = execSync('git rev-parse origin/main', { cwd: ctx.repoDir, encoding: 'utf8' }).trim();
    execSync(`git checkout -B feat/upstream-a ${mainSha}`, { cwd: ctx.repoDir });
    execSync('git branch --set-upstream-to=origin/main', { cwd: ctx.repoDir });

    execSync(`git checkout -B feat/upstream-b ${mainSha}`, { cwd: ctx.repoDir });
    execSync('git branch --unset-upstream 2>/dev/null || true', { cwd: ctx.repoDir });
    commitCode(ctx.repoDir, 'src/upstream-b.js', 'export const b = true;');
    const bSha = headSha(ctx.repoDir);

    // Switch to feat/upstream-a (HEAD tracks origin/main)
    execSync('git checkout feat/upstream-a', { cwd: ctx.repoDir });

    const zeros = '0000000000000000000000000000000000000000';
    // Push feat/upstream-b (which does NOT track origin/main)
    const r = runHook(ctx.repoDir, `refs/heads/feat/upstream-b ${bSha} refs/heads/feat/upstream-b ${zeros}\n`);

    assert.equal(r.status, 0);
    // Should NOT warn about upstream tracking — feat/upstream-b doesn't track origin/main
    assert.ok(
      !r.stderr.includes("B-TRACK: Branch 'feat/upstream-b' tracks"),
      'must not false-warn about feat/upstream-b upstream when only feat/upstream-a tracks main',
    );

    // Cleanup
    execSync('git checkout feat/detect-test 2>/dev/null || true', { cwd: ctx.repoDir });
    execSync('git branch --unset-upstream 2>/dev/null || true', { cwd: ctx.repoDir });
  });

  it('is silent when branch is clean (no injection)', () => {
    // Reset to a clean state — use SHA to avoid auto-setting upstream to origin/main
    const mainSha = execSync('git rev-parse origin/main', { cwd: ctx.repoDir, encoding: 'utf8' }).trim();
    execSync(`git checkout -B feat/clean-branch ${mainSha}`, { cwd: ctx.repoDir });
    execSync('git branch --unset-upstream 2>/dev/null || true', { cwd: ctx.repoDir });
    commitCode(ctx.repoDir, 'src/clean.js', 'export const clean = true;');

    const sha = headSha(ctx.repoDir);
    const zeros = '0000000000000000000000000000000000000000';

    const r = runHook(ctx.repoDir, `refs/heads/feat/clean-branch ${sha} refs/heads/feat/clean-branch ${zeros}\n`);

    assert.equal(r.status, 0);
    assert.ok(!r.stderr.includes('B-TRACK'), 'should not fire B-track on clean branch');
  });

  it('never blocks even if B-track detection errors', () => {
    // Ensure we're on a branch matching the push target so A' doesn't fire
    execSync('git checkout -B feat/broken 2>/dev/null || true', { cwd: ctx.repoDir });
    // Feed invalid SHA to trigger internal errors in B-track
    const r = runHook(
      ctx.repoDir,
      `refs/heads/feat/broken deadbeefdeadbeefdeadbeefdeadbeefdeadbeef refs/heads/feat/broken 0000000000000000000000000000000000000000\n`,
    );

    // Should still exit 0 (fail-open for B-track)
    assert.equal(r.status, 0, 'B-track must be fail-open');
  });
});

// ═══════════════════════════════════════════════════════════════
// guards:check (C-light)
// ═══════════════════════════════════════════════════════════════
describe('guards:check (C-light)', () => {
  it('passes in a properly configured repo', () => {
    const r = spawnSync('bash', [CHECK_SCRIPT], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(r.status, 0, `Expected pass, got: ${r.stdout}`);
    assert.match(r.stdout, /healthy/i);
  });

  it('fails when hooksPath is wrong', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'guards-check-'));
    execSync(`git init "${tmpDir}"`, { encoding: 'utf8' });
    // Don't set hooksPath — should fail

    const r = spawnSync('bash', [CHECK_SCRIPT], {
      cwd: tmpDir,
      encoding: 'utf8',
    });

    assert.equal(r.status, 1, 'should fail without hooksPath');
    assert.match(r.stdout, /issue/i);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
