import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SOURCE_SCRIPT = resolve(process.cwd(), 'scripts/intake-from-opensource.sh');
const HOOK_SCRIPT = resolve(process.cwd(), '.githooks/pre-commit');

function run(cmd, args, cwd, extraEnv = {}) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Cat Cafe Test',
      GIT_AUTHOR_EMAIL: 'cat-cafe@example.com',
      GIT_COMMITTER_NAME: 'Cat Cafe Test',
      GIT_COMMITTER_EMAIL: 'cat-cafe@example.com',
      ...extraEnv,
    },
  });
}

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*m/g, '');
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

function makeRemoteFixture() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-intake-ledger-remote-'));
  const repoRoot = join(sandboxRoot, 'cat-cafe');
  const remoteRoot = join(sandboxRoot, 'clowder-ai-remote.git');
  const targetRoot = join(sandboxRoot, 'clowder-ai');

  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  mkdirSync(join(repoRoot, 'docs', 'ops'), { recursive: true });
  cpSync(SOURCE_SCRIPT, join(repoRoot, 'scripts', 'intake-from-opensource.sh'));
  chmodSync(join(repoRoot, 'scripts', 'intake-from-opensource.sh'), 0o755);

  git(sandboxRoot, 'init', '--bare', 'clowder-ai-remote.git');
  git(sandboxRoot, 'clone', remoteRoot, 'clowder-ai');
  git(targetRoot, 'config', 'user.name', 'Cat Cafe Test');
  git(targetRoot, 'config', 'user.email', 'cat-cafe@example.com');
  git(targetRoot, 'checkout', '-b', 'main');

  return {
    sandboxRoot,
    repoRoot,
    remoteRoot,
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

function makePlanFixture(files) {
  const fixture = makeFixture();
  const mockPrJson = JSON.stringify(
    {
      title: 'test high-risk intake plan',
      state: 'MERGED',
      author: { login: 'contributor' },
      mergedAt: '2026-04-24T20:00:00Z',
      mergeCommit: { oid: '1111111111111111111111111111111111111111' },
      files: files.map((path) => ({ path })),
    },
    null,
    2,
  );

  const mockBin = join(fixture.sandboxRoot, 'mock-bin');
  mkdirSync(mockBin, { recursive: true });
  const ghPath = join(mockBin, 'gh');
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "pr" ] && [ "\${2:-}" = "view" ]; then
  cat <<'JSON'
${mockPrJson}
JSON
  exit 0
fi

exit 1
`,
    'utf-8',
  );
  chmodSync(ghPath, 0o755);

  return { ...fixture, mockBin };
}

function runPlan(repoRoot, extraEnv = {}) {
  return run('bash', ['scripts/intake-from-opensource.sh', '--pr', '777', '--mode=plan'], repoRoot, extraEnv);
}

function commitFile(repoRoot, filePath, content, message) {
  writeFileSync(join(repoRoot, filePath), content, 'utf-8');
  git(repoRoot, 'add', filePath);
  git(repoRoot, 'commit', '-m', message);
  return git(repoRoot, 'rev-parse', 'HEAD');
}

describe('intake-from-opensource.sh --mode=plan high-risk guard', () => {
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });

  it('flags high-risk files separately from safe cherry-pick files', () => {
    const fixture = makePlanFixture([
      'packages/api/src/index.ts',
      'packages/api/src/domains/cats/services/agents/routing/route-serial.ts',
      'packages/api/src/config/env-registry.ts',
      'packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts',
    ]);
    fixtures.push(fixture.sandboxRoot);

    const output = runPlan(fixture.repoRoot, { PATH: `${fixture.mockBin}:${process.env.PATH}` });
    const plainOutput = stripAnsi(output);

    assert.match(output, /HIGH-RISK GUARD \(3 files\)/);
    assert.match(output, /packages\/api\/src\/index\.ts/);
    assert.match(output, /route-serial\.ts/);
    assert.match(output, /packages\/api\/src\/config\/env-registry\.ts/);
    assert.match(plainOutput, /High-risk:\s+3/);
    assert.match(plainOutput, /Safe:\s+1/);
  });
});

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

  it('advances to target origin/main even when local target checkout is stale', () => {
    const fixture = makeRemoteFixture();
    fixtures.push(fixture.sandboxRoot);

    const oldHead = commitFile(fixture.targetRoot, 'README.md', 'base\n', 'chore: base');
    git(fixture.targetRoot, 'push', '-u', 'origin', 'main');

    const writerRoot = join(fixture.sandboxRoot, 'clowder-ai-writer');
    git(fixture.sandboxRoot, 'clone', fixture.remoteRoot, 'clowder-ai-writer');
    git(writerRoot, 'config', 'user.name', 'Cat Cafe Test');
    git(writerRoot, 'config', 'user.email', 'cat-cafe@example.com');
    git(writerRoot, 'checkout', '-b', 'main', 'origin/main');
    const remoteHead = commitFile(writerRoot, 'fix.txt', 'remote\n', 'fix: remote mainline change');
    git(writerRoot, 'push', 'origin', 'main');

    assert.equal(git(fixture.targetRoot, 'rev-parse', 'HEAD'), oldHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'origin/main'), oldHead);

    writeLedger(fixture.ledgerPath, oldHead, [
      {
        pr_number: 305,
        target_merge_commit: remoteHead,
        decision: 'absorbed',
        timestamp: '2026-04-01T00:00:00.000Z',
      },
    ]);

    const output = runAdvance(fixture.repoRoot);
    assert.match(output, /Ledger advanced to:/);
    const updatedLedger = JSON.parse(readFileSync(fixture.ledgerPath, 'utf-8'));
    assert.equal(updatedLedger.last_reviewed_target_head, remoteHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'origin/main'), remoteHead);
  });

  it('falls back to local HEAD when fetch fails and origin/main is stale', () => {
    const fixture = makeRemoteFixture();
    fixtures.push(fixture.sandboxRoot);

    const oldHead = commitFile(fixture.targetRoot, 'README.md', 'base\n', 'chore: base');
    git(fixture.targetRoot, 'push', '-u', 'origin', 'main');

    const localHead = commitFile(fixture.targetRoot, 'LOCAL.txt', 'local\n', 'fix: local-only fallback target');
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'origin/main'), oldHead);

    git(fixture.targetRoot, 'remote', 'set-url', 'origin', join(fixture.sandboxRoot, 'missing.git'));

    writeLedger(fixture.ledgerPath, oldHead, [
      {
        pr_number: 901,
        target_merge_commit: localHead,
        decision: 'absorbed',
        timestamp: '2026-04-01T00:00:00.000Z',
      },
    ]);

    const output = runAdvance(fixture.repoRoot);
    assert.match(output, /Ledger advanced to:/);
    const updatedLedger = JSON.parse(readFileSync(fixture.ledgerPath, 'utf-8'));
    assert.equal(updatedLedger.last_reviewed_target_head, localHead);
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
    '/** Unified API client for Cat Cafe frontend. */\n// Auth uses HttpOnly session cookie.',
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
        "/** Unified API client for Cat Cafe frontend. */\nexport const API_URL = '';",
    });
    fixtures.push(f.sandboxRoot);
    const err = captureValidateFailure(f.repoRoot);
    assert.match(err.stdout, /HttpOnly session cookie/);
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
      '/** Unified API client for Cat Cafe frontend. */\n// Auth uses HttpOnly session cookie.',
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
      '/** Unified API client for Cat Cafe frontend. */\n// Auth uses HttpOnly session cookie.\n// trivial change',
      'utf-8',
    );
    git(f.repoRoot, 'add', 'packages/web/src/utils/api-client.ts');

    // Should succeed
    const output = git(f.repoRoot, 'commit', '-m', 'good brand commit');
    assert.match(output, /good brand commit/);
  });
});

function makeRecordFixture(mock = {}) {
  const fixture = makeFixture();
  const baseHead = commitFile(fixture.targetRoot, 'README.md', 'base\n', 'chore: base');
  writeLedger(fixture.ledgerPath, baseHead, []);
  for (const [relPath, content] of Object.entries(BRAND_GOOD)) {
    const absPath = join(fixture.repoRoot, relPath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  const absorbPrHead = mock.absorbPrHead ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const absorbPrHeadShort = absorbPrHead.slice(0, 8);

  const mockIssueJson = JSON.stringify(
    {
      state: mock.issueState ?? 'OPEN',
      stateReason: mock.issueStateReason ?? ((mock.issueState ?? 'OPEN') === 'CLOSED' ? 'COMPLETED' : ''),
      labels: (mock.issueLabels ?? ['intake']).map((name) => ({ name })),
      body:
        mock.issueBody ??
        [
          '## 社区 PR 信息',
          '- Source: clowder-ai#495',
          '',
          '## 逐文件决策表',
          '| File | 社区改动摘要 | 决策 | 理由 |',
          '| packages/web/src/components/hub-accounts.view.ts | fix | absorb | keep truthfulness |',
          '| .env.example | generated | skip | public-only |',
        ].join('\n'),
      url: 'https://github.com/zts212653/cat-cafe/issues/1234',
      title: 'intake(clowder-ai#495): test fixture',
    },
    null,
    2,
  );
  const mockAbsorbPrJson = JSON.stringify(
    {
      state: mock.absorbPrState ?? 'OPEN',
      body: mock.absorbPrBody ?? 'Closes #1234\nSource: clowder-ai#495',
      url: 'https://github.com/zts212653/cat-cafe/pull/1236',
      title: 'intake fixture absorb PR',
      headRefOid: absorbPrHead,
    },
    null,
    2,
  );
  const mockIssueCommentJson = JSON.stringify(
    {
      body: mock.reviewIssueCommentBody ?? `Review pass extends to ${absorbPrHeadShort}`,
    },
    null,
    2,
  );
  const mockPullReviewJson = JSON.stringify(
    {
      body: mock.reviewBody ?? '',
      commit_id: mock.reviewCommitId ?? absorbPrHead,
    },
    null,
    2,
  );
  const mockDiscussionCommentJson = JSON.stringify(
    {
      body: mock.inlineReviewBody ?? '',
      commit_id: mock.inlineReviewCommitId ?? absorbPrHead,
    },
    null,
    2,
  );
  const mockTargetPrJson = JSON.stringify(
    {
      state: mock.targetPrState ?? 'MERGED',
      mergeCommit: { oid: mock.targetMergeSha ?? '1111111111111111111111111111111111111111' },
    },
    null,
    2,
  );

  const mockBin = join(fixture.sandboxRoot, 'mock-bin');
  mkdirSync(mockBin, { recursive: true });
  const ghPath = join(mockBin, 'gh');
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bash
set -euo pipefail

repo=""
for ((i=1; i<=$#; i++)); do
  if [ "\${!i}" = "--repo" ]; then
    j=$((i + 1))
    repo="\${!j}"
    break
  fi
done

if [ "\${1:-}" = "issue" ] && [ "\${2:-}" = "view" ]; then
  if [ "$repo" != "zts212653/cat-cafe" ]; then
    exit 1
  fi
  cat <<'JSON'
${mockIssueJson}
JSON
  exit 0
fi

if [ "\${1:-}" = "pr" ] && [ "\${2:-}" = "view" ]; then
  if [ "$repo" = "zts212653/cat-cafe" ]; then
    cat <<'JSON'
${mockAbsorbPrJson}
JSON
    exit 0
  fi
  if [ "$repo" = "zts212653/clowder-ai" ]; then
    cat <<'JSON'
${mockTargetPrJson}
JSON
    exit 0
  fi
fi

if [ "\${1:-}" = "api" ]; then
  path="\${2:-}"
  if [[ "$path" =~ ^repos/zts212653/cat-cafe/issues/comments/ ]]; then
    cat <<'JSON'
${mockIssueCommentJson}
JSON
    exit 0
  fi
  if [[ "$path" =~ ^repos/zts212653/cat-cafe/pulls/1236/reviews/ ]]; then
    cat <<'JSON'
${mockPullReviewJson}
JSON
    exit 0
  fi
  if [[ "$path" =~ ^repos/zts212653/cat-cafe/pulls/comments/ ]]; then
    cat <<'JSON'
${mockDiscussionCommentJson}
JSON
    exit 0
  fi
fi

exit 1
`,
    'utf-8',
  );
  chmodSync(ghPath, 0o755);

  return { ...fixture, mockBin, absorbPrHead };
}

function runRecord(repoRoot, args, extraEnv = {}) {
  return run('bash', ['scripts/intake-from-opensource.sh', '--record', ...args], repoRoot, extraEnv);
}

function captureRecordFailure(repoRoot, args, extraEnv = {}) {
  try {
    runRecord(repoRoot, args, extraEnv);
    assert.fail('expected --record to fail');
  } catch (error) {
    return error;
  }
}

describe('intake-from-opensource.sh --record strict guard (absorbed)', () => {
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      rmSync(fixtures.pop(), { recursive: true, force: true });
    }
  });

  it('requires intent issue metadata for absorbed records', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const err = captureRecordFailure(f.repoRoot, ['--pr', '495', '--decision', 'absorbed']);
    assert.match(err.stdout, /requires --intent-issue/);
  });

  it('blocks absorbed record when absorb PR body misses Closes #intent-issue', () => {
    const f = makeRecordFixture({
      absorbPrBody: 'Source: clowder-ai#495\n(no auto-close line)',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /body must contain: Closes #1234/);
  });

  it('records absorbed metadata when strict guard passes', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const output = runRecord(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );

    assert.match(output, /Absorbed intake strict guard passed/);
    assert.match(output, /Recorded PR #495 → absorbed/);

    const ledger = JSON.parse(readFileSync(f.ledgerPath, 'utf-8'));
    const record = ledger.entries.find((entry) => entry.pr_number === 495);
    assert.ok(record);
    assert.equal(record.intake_intent_issue, 1234);
    assert.equal(record.absorb_pr, 1236);
    assert.equal(record.review_proof, 'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1');
    assert.equal(record.intent_issue, undefined, 'must use intake_intent_issue (existing schema), not intent_issue');
  });

  it('allows post-merge record when intake intent issue is CLOSED and absorb PR is MERGED', () => {
    const f = makeRecordFixture({
      issueState: 'CLOSED',
      issueStateReason: 'COMPLETED',
      absorbPrState: 'MERGED',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const output = runRecord(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );

    assert.match(output, /Absorbed intake strict guard passed/);
    assert.match(output, /intent issue: #1234 \(CLOSED\)/);
    assert.match(output, /Recorded PR #495 → absorbed/);
  });

  it('blocks closed intake intent issue when absorb PR is not merged', () => {
    const f = makeRecordFixture({
      issueState: 'CLOSED',
      issueStateReason: 'COMPLETED',
      absorbPrState: 'OPEN',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /must be MERGED/);
  });

  it('blocks CLOSED intake intent issue when stateReason is NOT_PLANNED', () => {
    const f = makeRecordFixture({
      issueState: 'CLOSED',
      issueStateReason: 'NOT_PLANNED',
      absorbPrState: 'MERGED',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /NOT_PLANNED/);
  });

  it('blocks absorbed record when review-proof URL points to another PR', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/9999#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /must point to absorb PR #1236/);
  });

  it('blocks absorbed record when review-proof does not cover current absorb PR head', () => {
    const f = makeRecordFixture({
      reviewIssueCommentBody: 'LGTM, pass.',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /does not cover absorb PR current HEAD/);
  });

  it('accepts local review-proof file when it mentions current absorb PR head', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const proofPath = join(f.repoRoot, 'tmp', 'review-proof.md');
    mkdirSync(join(proofPath, '..'), { recursive: true });
    writeFileSync(proofPath, `Formal review pass extends to ${f.absorbPrHead.slice(0, 8)}.\n`, 'utf-8');

    const output = runRecord(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        proofPath,
      ],
      env,
    );

    assert.match(output, /Absorbed intake strict guard passed/);
    assert.match(output, /Recorded PR #495 → absorbed/);
  });

  it('records absorbed entry via --skip-absorbed-guard without intent/absorb/review fields', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const output = runRecord(f.repoRoot, ['--pr', '495', '--decision', 'absorbed', '--skip-absorbed-guard'], env);

    assert.match(output, /bypassing absorbed intake strict guard/);
    assert.match(output, /Recorded PR #495 → absorbed/);

    const ledger = JSON.parse(readFileSync(f.ledgerPath, 'utf-8'));
    const record = ledger.entries.find((entry) => entry.pr_number === 495);
    assert.ok(record);
    assert.equal(record.decision, 'absorbed');
    assert.ok(
      typeof record.note === 'string' && record.note.includes('--skip-absorbed-guard'),
      'skip path must leave a note explaining the bypass',
    );
    assert.equal(record.intake_intent_issue, undefined, 'skip path must not write intake_intent_issue: 0');
    assert.equal(record.absorb_pr, undefined, 'skip path must not write absorb_pr: 0');
    assert.equal(record.review_proof, undefined, 'skip path must not write review_proof: ""');
    assert.equal(record.intent_issue, undefined, 'legacy field name must not appear');
    assert.equal(record.notes, undefined, 'schema uses singular "note" not "notes"');
  });

  it('rejects intent issue that references wrong-repo /pull/<N> without clowder-ai prefix', () => {
    const f = makeRecordFixture({
      issueBody: [
        '## 社区 PR 信息',
        '- Source: https://github.com/zts212653/cat-cafe/pull/495',
        '',
        '## 逐文件决策表',
        '| File | 社区改动摘要 | 决策 | 理由 |',
        '| packages/web/src/components/hub-accounts.view.ts | fix | absorb | keep truthfulness |',
      ].join('\n'),
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /must reference source PR clowder-ai#495/);
  });

  it('rejects absorb PR body that references wrong-repo /pull/<N> without clowder-ai prefix', () => {
    const f = makeRecordFixture({
      absorbPrBody: 'Closes #1234\nSource: https://github.com/zts212653/cat-cafe/pull/495',
    });
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const err = captureRecordFailure(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );
    assert.match(err.stdout, /Absorb PR #1236 body must reference source PR clowder-ai#495/);
  });

  it('preserves caller-supplied metadata when --skip-absorbed-guard is used with --intent-issue/--absorb-pr/--review-proof', () => {
    const f = makeRecordFixture();
    fixtures.push(f.sandboxRoot);
    const env = { PATH: `${f.mockBin}:${process.env.PATH}` };
    const output = runRecord(
      f.repoRoot,
      [
        '--pr',
        '495',
        '--decision',
        'absorbed',
        '--skip-absorbed-guard',
        '--intent-issue',
        '1234',
        '--absorb-pr',
        '1236',
        '--review-proof',
        'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      ],
      env,
    );

    assert.match(output, /bypassing absorbed intake strict guard/);
    assert.match(output, /Recorded PR #495 → absorbed/);

    const ledger = JSON.parse(readFileSync(f.ledgerPath, 'utf-8'));
    const record = ledger.entries.find((entry) => entry.pr_number === 495);
    assert.ok(record);
    assert.equal(record.decision, 'absorbed');
    assert.equal(record.intake_intent_issue, 1234, 'caller-supplied intent issue must be preserved in skip mode');
    assert.equal(record.absorb_pr, 1236, 'caller-supplied absorb PR must be preserved in skip mode');
    assert.equal(
      record.review_proof,
      'https://github.com/zts212653/cat-cafe/pull/1236#issuecomment-1',
      'caller-supplied review proof must be preserved in skip mode',
    );
    assert.ok(
      typeof record.note === 'string' && record.note.includes('--skip-absorbed-guard'),
      'skip path must still leave a note explaining the bypass',
    );
  });
});
