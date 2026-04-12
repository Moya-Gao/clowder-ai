import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach } from 'node:test';

const SOURCE_SYNC_TAG_SCRIPT = resolve(process.cwd(), 'scripts/publish-sync-tag.sh');
const SOURCE_RELEASE_TAG_SCRIPT = resolve(process.cwd(), 'scripts/publish-release-tag.sh');
const SOURCE_VERIFY_RECONCILIATION_SCRIPT = resolve(process.cwd(), 'scripts/verify-reconciliation-report.mjs');

export function createFixtureTracker() {
  const fixtures = [];
  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });
  return fixtures;
}

export function run(cmd, args, cwd, extraEnv = {}) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...extraEnv,
      GIT_AUTHOR_NAME: 'Cat Cafe Test',
      GIT_AUTHOR_EMAIL: 'cat-cafe@example.com',
      GIT_COMMITTER_NAME: 'Cat Cafe Test',
      GIT_COMMITTER_EMAIL: 'cat-cafe@example.com',
    },
  });
}

export function git(cwd, ...args) {
  return run('git', args, cwd).trim();
}

export function gitBare(gitDir, ...args) {
  return run('git', ['--git-dir', gitDir, ...args], dirname(gitDir)).trim();
}

export function commitFile(repoRoot, filePath, content, message, extraEnv = {}) {
  const absPath = join(repoRoot, filePath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, 'utf-8');
  git(repoRoot, 'add', filePath);
  run('git', ['commit', '-m', message], repoRoot, extraEnv);
  return git(repoRoot, 'rev-parse', 'HEAD');
}

export function commitSyncProvenance(repoRoot, sourceSha, message, options = {}) {
  const payload = {
    source_commit_sha: sourceSha,
    target_head_sha: '',
    manifest_version: 3,
    synced_at: options.syncedAt ?? '2026-03-19T00:00:00Z',
    ...(options.extraFields ?? {}),
  };
  return commitFile(
    repoRoot,
    '.sync-provenance.json',
    `${JSON.stringify(payload, null, 2)}\n`,
    message,
    options.commitEnv ?? {},
  );
}

export function makeFixture() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-publish-sync-tag-'));
  const sourceOrigin = join(sandboxRoot, 'cat-cafe-origin.git');
  const targetOrigin = join(sandboxRoot, 'clowder-ai-origin.git');
  const sourceRoot = join(sandboxRoot, 'cat-cafe');
  const targetRoot = join(sandboxRoot, 'clowder-ai');

  git(sandboxRoot, 'init', '--bare', '-b', 'main', 'cat-cafe-origin.git');
  git(sandboxRoot, 'init', '--bare', '-b', 'main', 'clowder-ai-origin.git');
  git(sandboxRoot, 'init', '-b', 'main', 'cat-cafe');
  git(sandboxRoot, 'init', '-b', 'main', 'clowder-ai');

  git(sourceRoot, 'config', 'user.name', 'Cat Cafe Test');
  git(sourceRoot, 'config', 'user.email', 'cat-cafe@example.com');
  git(targetRoot, 'config', 'user.name', 'Cat Cafe Test');
  git(targetRoot, 'config', 'user.email', 'cat-cafe@example.com');
  git(sourceRoot, 'remote', 'add', 'origin', sourceOrigin);
  git(targetRoot, 'remote', 'add', 'origin', targetOrigin);

  mkdirSync(join(sourceRoot, 'scripts'), { recursive: true });
  cpSync(SOURCE_SYNC_TAG_SCRIPT, join(sourceRoot, 'scripts/publish-sync-tag.sh'));
  chmodSync(join(sourceRoot, 'scripts/publish-sync-tag.sh'), 0o755);
  cpSync(SOURCE_RELEASE_TAG_SCRIPT, join(sourceRoot, 'scripts/publish-release-tag.sh'));
  chmodSync(join(sourceRoot, 'scripts/publish-release-tag.sh'), 0o755);
  cpSync(SOURCE_VERIFY_RECONCILIATION_SCRIPT, join(sourceRoot, 'scripts/verify-reconciliation-report.mjs'));
  chmodSync(join(sourceRoot, 'scripts/verify-reconciliation-report.mjs'), 0o755);

  commitFile(sourceRoot, 'README.md', 'source base\n', 'chore: source base');
  git(sourceRoot, 'push', '-u', 'origin', 'main');
  commitFile(targetRoot, 'README.md', 'target base\n', 'chore: target base');
  git(targetRoot, 'push', '-u', 'origin', 'main');

  return { sandboxRoot, sourceOrigin, targetOrigin, sourceRoot, targetRoot };
}

export function runPublish(sourceRoot, targetRoot, ...args) {
  return run('bash', ['scripts/publish-sync-tag.sh', ...args], sourceRoot, {
    CLOWDER_AI_DIR: targetRoot,
  });
}

export function capturePublishFailure(sourceRoot, targetRoot, ...args) {
  try {
    runPublish(sourceRoot, targetRoot, ...args);
    assert.fail('expected publish-sync-tag.sh to fail');
  } catch (error) {
    return error;
  }
}

export function runReleasePublish(sourceRoot, targetRoot, ...args) {
  return run('bash', ['scripts/publish-release-tag.sh', ...args], sourceRoot, {
    CLOWDER_AI_DIR: targetRoot,
  });
}

export function captureReleasePublishFailure(sourceRoot, targetRoot, ...args) {
  try {
    runReleasePublish(sourceRoot, targetRoot, ...args);
    assert.fail('expected publish-release-tag.sh to fail');
  } catch (error) {
    return error;
  }
}
