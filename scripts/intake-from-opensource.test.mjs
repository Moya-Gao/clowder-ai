import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SOURCE_SCRIPT = resolve(process.cwd(), 'scripts/intake-from-opensource.sh');
const HOOK_SCRIPT = resolve(process.cwd(), '.githooks/pre-commit');

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

// ── Brand Guard tests ──

const BRAND_GOOD = {
  'packages/web/src/app/layout.tsx': `export const metadata = {
  title: 'Cat Cafe',
  description: '三只 AI 猫猫的协作空间',
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};`,
  'packages/web/public/manifest.json': '{"name": "Cat Cafe", "short_name": "猫猫"}',
  'packages/web/src/components/SplitPaneView.tsx': '<h1>Cat Cafe</h1>',
  'packages/web/src/components/ChatContainerHeader.tsx':
    "const INTERNAL_BASENAMES = ['cat-cafe', 'cat-cafe-runtime', 'clowder-ai'];\n<h1>Cat Café</h1>",
  'packages/web/src/utils/api-client.ts':
    "/** Unified API client for Cat Cafe frontend. */\nheaders.set('X-Cat-Cafe-User', getUserId());",
  'packages/web/public/icons/favicon.svg': '<svg></svg>',
};

function makeBrandFixture(overrides = {}) {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-brand-guard-'));
  const repoRoot = join(sandboxRoot, 'cat-cafe');

  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  cpSync(SOURCE_SCRIPT, join(repoRoot, 'scripts', 'intake-from-opensource.sh'));
  chmodSync(join(repoRoot, 'scripts', 'intake-from-opensource.sh'), 0o755);

  const files = { ...BRAND_GOOD, ...overrides };
  for (const [relPath, content] of Object.entries(files)) {
    if (content === null) continue; // null = intentionally omit file
    const absPath = join(repoRoot, relPath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }

  return { sandboxRoot, repoRoot };
}

function runValidate(repoRoot) {
  return run('bash', ['scripts/intake-from-opensource.sh', '--validate-inbound'], repoRoot);
}

function captureValidateFailure(repoRoot) {
  try {
    runValidate(repoRoot);
    assert.fail('expected --validate-inbound to fail');
  } catch (error) {
    return error;
  }
}

describe('intake-from-opensource.sh --validate-inbound', () => {
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });

  it('passes when all brand-sensitive files have correct values', () => {
    const f = makeBrandFixture();
    fixtures.push(f.sandboxRoot);
    const output = runValidate(f.repoRoot);
    assert.match(output, /No brand violations detected/);
  });

  it('catches Clowder AI in layout.tsx', () => {
    const f = makeBrandFixture({
      'packages/web/src/app/layout.tsx': "title: 'Clowder AI', description: 'Your AI team collaboration space'",
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /brand violation/i);
  });

  it('catches Clowder AI in ChatContainerHeader.tsx', () => {
    const f = makeBrandFixture({
      'packages/web/src/components/ChatContainerHeader.tsx': '<h1>Clowder AI</h1>',
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /brand violation/i);
    assert.match(err.stdout, /ChatContainerHeader/);
  });

  it('catches brand contamination in api-client.ts', () => {
    const f = makeBrandFixture({
      'packages/web/src/utils/api-client.ts':
        '/** Unified API client for Clowder AI frontend. */\nexport const API_URL = "";',
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /brand violation/i);
    assert.match(err.stdout, /api-client/);
  });

  it('catches missing favicon.svg', () => {
    const f = makeBrandFixture({
      'packages/web/public/icons/favicon.svg': null, // intentionally omit
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /brand violation/i);
    assert.match(err.stdout, /favicon/i);
  });

  it('catches missing Cat Cafe brand in ChatContainerHeader.tsx', () => {
    const f = makeBrandFixture({
      'packages/web/src/components/ChatContainerHeader.tsx':
        "const INTERNAL_BASENAMES = ['some-other'];\n<h1>Some App</h1>",
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /brand violation/i);
  });

  // ── Semantic field isolation tests (title/comment correct, real field polluted) ──

  it('catches polluted INTERNAL_BASENAMES even when title text is correct', () => {
    const f = makeBrandFixture({
      'packages/web/src/components/ChatContainerHeader.tsx':
        "const INTERNAL_BASENAMES = ['clowder-ai'];\n<h1>Cat Café</h1>",
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /INTERNAL_BASENAMES must include cat-cafe/);
  });

  it('catches polluted identity header even when api-client comment is correct', () => {
    const f = makeBrandFixture({
      'packages/web/src/utils/api-client.ts':
        "/** Unified API client for Cat Cafe frontend. */\nheaders.set('X-Clowder-User', getUserId());",
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /X-Cat-Cafe-User/);
  });
});

// ── Pre-commit hook integration tests ──

function makeHookFixture() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-hook-'));
  const repoRoot = join(sandboxRoot, 'cat-cafe');

  mkdirSync(repoRoot, { recursive: true });
  git(sandboxRoot, 'init', '-b', 'main', 'cat-cafe');
  git(repoRoot, 'config', 'user.name', 'Cat Cafe Test');
  git(repoRoot, 'config', 'user.email', 'cat-cafe@example.com');

  // Install intake script
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  cpSync(SOURCE_SCRIPT, join(repoRoot, 'scripts', 'intake-from-opensource.sh'));
  chmodSync(join(repoRoot, 'scripts', 'intake-from-opensource.sh'), 0o755);

  // Install pre-commit hook
  mkdirSync(join(repoRoot, '.githooks'), { recursive: true });
  cpSync(HOOK_SCRIPT, join(repoRoot, '.githooks', 'pre-commit'));
  chmodSync(join(repoRoot, '.githooks', 'pre-commit'), 0o755);
  git(repoRoot, 'config', 'core.hooksPath', '.githooks');

  // Write all brand-good files
  for (const [relPath, content] of Object.entries(BRAND_GOOD)) {
    const absPath = join(repoRoot, relPath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }

  // Initial commit on main (hook skips main branch)
  git(repoRoot, 'add', '-A');
  git(repoRoot, 'commit', '-m', 'initial: good brand state');

  // Create feature branch (hook active on non-main)
  git(repoRoot, 'checkout', '-b', 'feature/intake-test');

  return { sandboxRoot, repoRoot };
}

describe('pre-commit hook brand guard (--from-index)', () => {
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });

  it('blocks commit when index has bad brand even if worktree is good', () => {
    const f = makeHookFixture();
    fixtures.push(f.sandboxRoot);
    const apiClient = join(f.repoRoot, 'packages/web/src/utils/api-client.ts');

    // Stage bad content
    writeFileSync(
      apiClient,
      "/** Unified API client for Cat Cafe frontend. */\nheaders.set('X-Clowder-User', getUserId());",
      'utf-8',
    );
    git(f.repoRoot, 'add', 'packages/web/src/utils/api-client.ts');

    // Restore worktree to good (but don't re-stage)
    writeFileSync(
      apiClient,
      "/** Unified API client for Cat Cafe frontend. */\nheaders.set('X-Cat-Cafe-User', getUserId());",
      'utf-8',
    );

    // Commit should fail — hook reads index, not worktree
    try {
      git(f.repoRoot, 'commit', '-m', 'should be blocked');
      assert.fail('expected commit to be blocked by pre-commit hook');
    } catch (error) {
      assert.match(error.stderr || error.stdout || '', /Brand Guard|brand violation/i);
    }
  });

  it('allows commit when index has good brand values', () => {
    const f = makeHookFixture();
    fixtures.push(f.sandboxRoot);
    const apiClient = join(f.repoRoot, 'packages/web/src/utils/api-client.ts');

    // Stage a trivial change that keeps brand intact
    writeFileSync(
      apiClient,
      "/** Unified API client for Cat Cafe frontend. */\nheaders.set('X-Cat-Cafe-User', getUserId());\n// trivial change",
      'utf-8',
    );
    git(f.repoRoot, 'add', 'packages/web/src/utils/api-client.ts');

    // Should succeed
    const output = git(f.repoRoot, 'commit', '-m', 'good brand commit');
    assert.match(output, /good brand commit/);
  });
});
