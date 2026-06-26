// check-sync-public-delta-gate-cli-fixtures.mjs — F251 Task 4a CLI test fixture helpers.
//
// Extracted from check-sync-public-delta-gate-cli.test.mjs per AGENTS.md root code-quality
// redline (`文件 200 警告/350 硬上限`). Owns: tiny git wrappers, temp repo setup, the
// scenario builder (`setupBaselineRepos`) the integration tests share, and cleanup.
//
// Test-only module; no production code path imports from here.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CLI_PATH = join(HERE, 'check-sync-public-delta-gate-cli.mjs');
export const FIXED_TIMESTAMP = '2026-06-26T05:00:00.000Z';

export function git(repo, args) {
  execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
}

export function gitOut(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' }).trim();
}

export function makeRepo(rootName) {
  const root = mkdtempSync(join(tmpdir(), `${rootName}-`));
  execFileSync('git', ['init', '-q', '-b', 'main', root], { stdio: 'pipe' });
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}

export function writeFile(repo, relPath, content) {
  const full = join(repo, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

export function commit(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--allow-empty', '-m', message]);
  return gitOut(repo, ['rev-parse', 'HEAD']);
}

export function runCli(args) {
  return spawnSync('node', [CLI_PATH, ...args], { encoding: 'utf-8' });
}

// Standard CLI args used by ~every test: prepends mandatory --target-dir / --filtered-dir /
// --source-dir / --sync-module + flags that disable network (--no-fetch) and pin output to
// per-test temp dirs. `extra` appends scenario-specific flags (--head-ref, --target-owned-root,
// --dry-run, --baseline).
export function runCliDefault({ target, source, filtered, outputDir, extra = [] }) {
  return runCli([
    '--target-dir',
    target,
    '--filtered-dir',
    filtered,
    '--source-dir',
    source,
    '--sync-module',
    'full-outbound',
    '--no-fetch',
    '--output-dir',
    outputDir,
    '--timestamp',
    FIXED_TIMESTAMP,
    ...extra,
  ]);
}

export function parseReportFromStdout(stdout) {
  const jsonLine = stdout.split('\n').find((l) => l.startsWith('json: '));
  return JSON.parse(readFileSync(jsonLine.slice('json: '.length), 'utf-8'));
}

// Three-way scenario builder: stages a synthetic clowder-ai (target) + cat-cafe (source) +
// export (filtered) trio. Each scenario name encodes a distinct delta shape so tests can
// document the BLOB_STATE_RULES branch they're exercising.
export function setupBaselineRepos(scenario) {
  const target = makeRepo('cli-target');
  const source = makeRepo('cli-source');
  const filtered = mkdtempSync(join(tmpdir(), 'cli-filtered-'));

  // Baseline state: target has packages/api/example.ts = "v1"
  writeFile(target, 'packages/api/example.ts', 'export const x = 1;\n');
  writeFile(target, 'README.md', '# baseline\n');
  const baselineCommit = commit(target, 'baseline');

  // Tag the baseline so resolver can find it
  git(target, ['tag', 'sync/2026-06-01-000000', baselineCommit]);
  // Mirror to refs/sync/* so resolver sees a "reachable mirrored ref"
  git(target, ['update-ref', 'refs/sync/2026-06-01-000000', baselineCommit]);

  // Source repo (cat-cafe): has same file initially
  writeFile(source, 'packages/api/example.ts', 'export const x = 1;\n');
  commit(source, 'source baseline');

  if (scenario === 'source-only-change') {
    // Source changes the file; target doesn't change since baseline; filtered=source
    writeFile(filtered, 'packages/api/example.ts', 'export const x = 2;\n');
    writeFile(filtered, 'README.md', '# baseline\n');
    return { target, source, filtered, baselineCommit };
  }

  if (scenario === 'target-revert') {
    // Target moves forward (community fix), filtered reverts to baseline.
    // This is the THE classic clowder-ai#723/#720 pattern.
    writeFile(target, 'packages/api/example.ts', 'export const x = 99; // community fix\n');
    commit(target, 'community fix on target');
    // Filtered tree = baseline (revert)
    writeFile(filtered, 'packages/api/example.ts', 'export const x = 1;\n');
    writeFile(filtered, 'README.md', '# baseline\n');
    return { target, source, filtered, baselineCommit };
  }

  if (scenario === 'target-only-equivalent-preserved') {
    // Target changed; filtered absorbs the change (matches target)
    writeFile(target, 'packages/api/example.ts', 'export const x = 7;\n');
    commit(target, 'target changed');
    writeFile(filtered, 'packages/api/example.ts', 'export const x = 7;\n');
    writeFile(filtered, 'README.md', '# baseline\n');
    return { target, source, filtered, baselineCommit };
  }

  if (scenario === 'no-delta') {
    // Nothing changed on any side; gate should report 0 items
    writeFile(filtered, 'packages/api/example.ts', 'export const x = 1;\n');
    writeFile(filtered, 'README.md', '# baseline\n');
    return { target, source, filtered, baselineCommit };
  }

  if (scenario === 'provenance-only-churn') {
    // Reproduces R6 砚砚 P1: every real sync writes a fresh .sync-provenance.json into
    // FILTERED_DIR, so baseline/target/ours blobs ALL diverge legitimately. Without
    // isGeneratedOrProvenance the gate fails closed on the provenance file alone.
    writeFile(target, '.sync-provenance.json', '{"syncedAt":"2026-06-01","sha":"abc"}\n');
    const provBase = commit(target, 'baseline provenance');
    git(target, ['tag', '-d', 'sync/2026-06-01-000000']);
    git(target, ['tag', 'sync/2026-06-01-000000', provBase]);
    git(target, ['update-ref', 'refs/sync/2026-06-01-000000', provBase]);
    writeFile(target, '.sync-provenance.json', '{"syncedAt":"2026-06-15","sha":"def"}\n');
    commit(target, 'intermediate provenance');
    writeFile(filtered, '.sync-provenance.json', '{"syncedAt":"2026-06-26","sha":"ghi"}\n');
    writeFile(filtered, 'packages/api/example.ts', 'export const x = 1;\n');
    writeFile(filtered, 'README.md', '# baseline\n');
    return { target, source, filtered, baselineCommit: provBase };
  }

  throw new Error(`unknown scenario: ${scenario}`);
}

export function cleanup(...dirs) {
  for (const d of dirs) {
    if (d && existsSync(d)) {
      rmSync(d, { recursive: true, force: true });
    }
  }
}
