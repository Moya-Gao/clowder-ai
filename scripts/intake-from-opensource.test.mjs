import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SOURCE_SCRIPT = resolve(process.cwd(), 'scripts/intake-from-opensource.sh');

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Cat Cafe Test',
      GIT_AUTHOR_EMAIL: 'cat-cafe@example.com',
      GIT_COMMITTER_NAME: 'Cat Cafe Test',
      GIT_COMMITTER_EMAIL: 'cat-cafe@example.com',
    },
  });
}

function git(cwd, ...args) {
  return run('git', args, cwd).trim();
}

function makeFixture() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-intake-ledger-'));
  const repoRoot = join(sandboxRoot, 'cat-cafe');
  const targetRoot = join(sandboxRoot, 'clowder-ai');

  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  mkdirSync(join(repoRoot, 'docs', 'ops'), { recursive: true });
  cpSync(SOURCE_SCRIPT, join(repoRoot, 'scripts', 'intake-from-opensource.sh'));
  chmodSync(join(repoRoot, 'scripts', 'intake-from-opensource.sh'), 0o755);

  git(sandboxRoot, 'init', '-b', 'main', 'clowder-ai');
  git(targetRoot, 'config', 'user.name', 'Cat Cafe Test');
  git(targetRoot, 'config', 'user.email', 'cat-cafe@example.com');

  return {
    sandboxRoot,
    repoRoot,
    targetRoot,
    ledgerPath: join(repoRoot, 'docs', 'ops', 'opensource-intake-ledger.json'),
  };
}

function writeLedger(ledgerPath, lastReviewedHead, entries) {
  writeFileSync(
    ledgerPath,
    `${JSON.stringify({ last_reviewed_target_head: lastReviewedHead, entries }, null, 2)}\n`,
    'utf-8',
  );
}

function runAdvance(repoRoot) {
  return run('bash', ['scripts/intake-from-opensource.sh', '--advance-ledger'], repoRoot);
}

function captureAdvanceFailure(repoRoot) {
  try {
    runAdvance(repoRoot);
    assert.fail('expected advance-ledger to fail');
  } catch (error) {
    return error;
  }
}

function commitFile(repoRoot, filePath, content, message) {
  writeFileSync(join(repoRoot, filePath), content, 'utf-8');
  git(repoRoot, 'add', filePath);
  git(repoRoot, 'commit', '-m', message);
  return git(repoRoot, 'rev-parse', 'HEAD');
}

describe('intake-from-opensource.sh --advance-ledger', () => {
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });

  it('treats a recorded merge commit as covering the merged branch history', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const oldHead = commitFile(fixture.targetRoot, 'README.md', 'base\n', 'chore: base');

    git(fixture.targetRoot, 'checkout', '-b', 'feature/windows');
    commitFile(fixture.targetRoot, 'feature-a.txt', 'a\n', 'feat: part 1');
    commitFile(fixture.targetRoot, 'feature-b.txt', 'b\n', 'feat: part 2');
    git(fixture.targetRoot, 'checkout', 'main');
    git(fixture.targetRoot, 'merge', '--no-ff', 'feature/windows', '-m', 'feat: merge windows fixes');
    const mergeHead = git(fixture.targetRoot, 'rev-parse', 'HEAD');

    writeLedger(fixture.ledgerPath, oldHead, [
      {
        pr_number: 113,
        target_merge_commit: mergeHead,
        decision: 'absorbed',
        timestamp: '2026-03-19T00:00:00.000Z',
      },
    ]);

    const output = runAdvance(fixture.repoRoot);
    assert.match(output, /Ledger advanced to:/);
    const updatedLedger = JSON.parse(readFileSync(fixture.ledgerPath, 'utf-8'));
    assert.equal(updatedLedger.last_reviewed_target_head, mergeHead);
  });

  it('still blocks when a landed mainline commit has not been recorded', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const oldHead = commitFile(fixture.targetRoot, 'README.md', 'base\n', 'chore: base');
    const currentHead = commitFile(fixture.targetRoot, 'hotfix.txt', 'hotfix\n', 'fix: direct mainline change');

    writeLedger(fixture.ledgerPath, oldHead, []);

    const error = captureAdvanceFailure(fixture.repoRoot);
    assert.match(error.stdout, /Cannot advance: 1 unrecorded non-sync commit/);

    const updatedLedger = JSON.parse(readFileSync(fixture.ledgerPath, 'utf-8'));
    assert.equal(updatedLedger.last_reviewed_target_head, oldHead);
    assert.notEqual(updatedLedger.last_reviewed_target_head, currentHead);
  });
});
