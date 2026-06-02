import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const HOOK = resolve(process.cwd(), '.claude/hooks/runtime-sanctuary-guard.sh');

function decide(command, toolName = 'Bash', cwd = undefined) {
  const tool_input = toolName === 'Bash'
    ? { command }
    : { file_path: command, old_string: 'x', new_string: 'y' };
  const payload = { tool_name: toolName, tool_input };
  if (cwd !== undefined) {
    payload.cwd = cwd;
  }
  const input = JSON.stringify(payload);
  const result = spawnSync('bash', [HOOK], { input, encoding: 'utf8' });
  assert.equal(result.status, 0, `hook exited non-zero: ${result.stderr}`);
  if (!result.stdout.trim()) {
    return 'allow';
  }
  const parsed = JSON.parse(result.stdout);
  return parsed.hookSpecificOutput?.permissionDecision ?? 'allow';
}

describe('runtime-sanctuary-guard: redis sanctuary kill protection (CAFE-INCIDENT-20260527)', () => {
  const denyCases = [
    [
      'lsof port-range + kill -9 (the exact incident weapon)',
      'for p in $(lsof -ti tcp:50000-65535); do kill -9 "$p"; done',
    ],
    ['lsof sanctuary port 6399 + xargs kill', 'lsof -ti tcp:6399 | xargs kill'],
    ['lsof sanctuary port 6398 + kill', 'lsof -ti tcp:6398 | xargs kill -9'],
    ['lsof user-redis port 6401 + kill', 'lsof -ti tcp:6401 | xargs kill'],
    ['pkill redis by name', 'pkill -f redis-server'],
    ['killall redis-server', 'killall redis-server'],
    ['kill $(pgrep redis-server)', 'kill $(pgrep redis-server)'],
    ['redis-cli shutdown sanctuary port', 'redis-cli -p 6399 shutdown nosave'],
    ['redis-cli shutdown without explicit port (ambiguous default)', 'redis-cli shutdown'],
    ['lsof bare-colon port-range + kill (no tcp: prefix bypass)', 'lsof -ti :50000-65535 | xargs kill -9'],
    ['lsof single non-sanctuary port + kill (lsof+kill never a cleanup path)', 'lsof -ti tcp:65093 | xargs kill'],
  ];

  for (const [name, command] of denyCases) {
    it(`denies: ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }

  const allowCases = [
    ['read-only redis-cli ping', 'redis-cli -p 6399 ping'],
    ['read-only lsof listing without kill', 'lsof -nP -iTCP -sTCP:LISTEN | grep redis'],
    ['safe registry-backed redis test runner', 'pnpm --filter @cat-cafe/api test:redis'],
    ['safe orphan cleanup', 'pnpm process:cleanup'],
    ['single non-redis pid kill', 'kill -9 12345'],
    ['kill orphan redis by direct pid', 'kill 65093'],
    ['redis-cli shutdown explicit non-sanctuary port', 'redis-cli -p 65093 shutdown nosave'],
    ['plain git status', 'git status'],
  ];

  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }
});

describe('runtime-sanctuary-guard: existing runtime worktree protection (regression)', () => {
  it('denies deleting runtime/main-sync branch', () => {
    assert.equal(decide('git branch -D runtime/main-sync'), 'deny');
  });
  it('denies rm -rf cat-cafe-runtime', () => {
    assert.equal(decide('rm -rf /Users/x/cat-cafe-runtime'), 'deny');
  });
  it('denies git switch runtime (modern checkout equivalent)', () => {
    assert.equal(decide('git switch runtime/main-sync'), 'deny');
  });
  it('denies git -C runtime switch -c (modern checkout -b via -C)', () => {
    assert.equal(decide('git -C /path/cat-cafe-runtime switch -c feat/bad'), 'deny');
  });
});

describe('runtime-sanctuary-guard: Edit/Write file path protection (CAFE-INCIDENT-20260601)', () => {
  const RUNTIME = '/Users/lysander/projects/relay-station/cat-cafe-runtime';

  it('denies Edit to file inside runtime worktree', () => {
    assert.equal(
      decide(`${RUNTIME}/packages/web/src/components/SessionChainPanel.tsx`, 'Edit'),
      'deny',
    );
  });
  it('denies Write to file inside runtime worktree', () => {
    assert.equal(
      decide(`${RUNTIME}/packages/api/src/index.ts`, 'Write'),
      'deny',
    );
  });
  it('allows Edit to file in main repo', () => {
    assert.equal(
      decide('/Users/lysander/projects/relay-station/cat-cafe/packages/web/src/App.tsx', 'Edit'),
      'allow',
    );
  });
  it('allows Edit to file in a regular worktree', () => {
    assert.equal(
      decide('/tmp/worktree-feat-xyz/packages/web/src/App.tsx', 'Edit'),
      'allow',
    );
  });
});

describe('runtime-sanctuary-guard: real cwd detection — Bash tool CWD in runtime (CAFE-INCIDENT-20260601)', () => {
  const RUNTIME = '/Users/lysander/projects/relay-station/cat-cafe-runtime';

  const denyCases = [
    ['cwd=runtime + git checkout -b (the exact incident)', 'git checkout -b feat/oops', RUNTIME],
    ['cwd=runtime + git commit', 'git commit -m "oops"', RUNTIME],
    ['cwd=runtime + git push', 'git push origin feat/oops', RUNTIME],
    ['cwd=runtime + git add', 'git add -A', RUNTIME],
    ['cwd=runtime subdir + git commit', 'git commit -m "deep"', `${RUNTIME}/packages/web`],
    ['cwd=runtime + git switch -c (modern checkout -b)', 'git switch -c feat/oops', RUNTIME],
  ];

  for (const [name, command, cwd] of denyCases) {
    it(`denies: ${name}`, () => {
      assert.equal(decide(command, 'Bash', cwd), 'deny', `expected deny for: ${command} (cwd=${cwd})`);
    });
  }

  const allowCases = [
    ['cwd=runtime + git status (read-only)', 'git status', RUNTIME],
    ['cwd=runtime + git log (read-only)', 'git log --oneline -5', RUNTIME],
    ['cwd=runtime + git diff (read-only)', 'git diff', RUNTIME],
    ['cwd=non-runtime + git checkout -b (safe)', 'git checkout -b feat/ok', '/tmp/worktree-feat-xyz'],
    ['no cwd field + plain git commit (no cd, no cwd = allow)', 'git commit -m "fine"'],
  ];

  for (const [name, command, cwd] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command, 'Bash', cwd), 'allow', `expected allow for: ${command}`);
    });
  }
});

describe('runtime-sanctuary-guard: cd to runtime + git write protection (CAFE-INCIDENT-20260601, defense-in-depth)', () => {
  const RUNTIME = '/Users/lysander/projects/relay-station/cat-cafe-runtime';

  const denyCases = [
    ['cd + git checkout -b (the exact incident)', `cd ${RUNTIME} && git checkout -b feat/my-feature`],
    ['cd + git commit', `cd ${RUNTIME} && git commit -m "oops"`],
    ['cd + git push', `cd ${RUNTIME} && git push origin main`],
    ['cd + git add', `cd ${RUNTIME} && git add -A`],
    ['cd + git cherry-pick', `cd ${RUNTIME} && git cherry-pick abc123`],
    ['chained cd + git checkout', `pwd && cd ${RUNTIME} && git checkout -b bad-idea`],
    ['cd + git switch -c (modern checkout -b)', `cd ${RUNTIME} && git switch -c feat/bad`],
  ];

  for (const [name, command] of denyCases) {
    it(`denies: ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }

  const allowCases = [
    ['cd + git status (read-only)', `cd ${RUNTIME} && git status`],
    ['cd + git log (read-only)', `cd ${RUNTIME} && git log --oneline -5`],
    ['cd + git diff (read-only)', `cd ${RUNTIME} && git diff`],
    ['cd + git branch --show-current (read-only)', `cd ${RUNTIME} && git branch --show-current`],
    ['cd to non-runtime + git commit', 'cd /tmp/worktree && git commit -m "fine"'],
  ];

  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }
});
