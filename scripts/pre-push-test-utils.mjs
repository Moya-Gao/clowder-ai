/**
 * Shared test utilities for pre-push guard tests.
 * Extracted to keep the main test file under the 350-line hard limit.
 */
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOOK_SOURCE = path.resolve(process.cwd(), '.githooks/pre-push');
export const CHECK_SCRIPT = path.resolve(process.cwd(), 'scripts/check-git-guards.sh');

/**
 * Run the pre-push hook in a git repo with given stdin input.
 * stdin format: "local_ref local_sha remote_ref remote_sha\n"
 */
export function runHook(cwd, stdin, env = {}) {
  return spawnSync('bash', [HOOK_SOURCE], {
    cwd,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

/** Create a temp git repo with an initial commit and a remote. */
export function createTestRepo() {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'pre-push-test-'));
  const repoDir = path.join(tmpDir, 'repo');
  const remoteDir = path.join(tmpDir, 'remote.git');

  execSync(`git init --bare "${remoteDir}"`, { encoding: 'utf8' });
  execSync(`git init "${repoDir}"`, { encoding: 'utf8' });
  execSync('git config user.email "test@test.com"', { cwd: repoDir });
  execSync('git config user.name "Test"', { cwd: repoDir });
  writeFileSync(path.join(repoDir, 'README.md'), '# test\n');
  execSync('git add -A && git commit -m "init"', { cwd: repoDir });

  try {
    execSync('git branch -M main', { cwd: repoDir });
  } catch {
    /* already main */
  }

  execSync(`git remote add origin "${remoteDir}"`, { cwd: repoDir });
  execSync('git push -u origin main', { cwd: repoDir });

  return { tmpDir, repoDir, remoteDir };
}

/** Get HEAD SHA in a repo. */
export function headSha(cwd) {
  return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
}

/** Make a commit with code changes (non-doc). */
export function commitCode(cwd, filename = 'src/app.js', content = 'console.log("hi")') {
  const dir = path.dirname(path.join(cwd, filename));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(cwd, filename), content);
  execSync(`git add "${filename}" && git commit -m "add ${filename}"`, { cwd });
}

/** Make a commit with docs-only changes. */
export function commitDocs(cwd, filename = 'docs/guide.md', content = '# guide') {
  const dir = path.dirname(path.join(cwd, filename));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(cwd, filename), content);
  execSync(`git add "${filename}" && git commit -m "add ${filename}"`, { cwd });
}
