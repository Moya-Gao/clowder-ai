import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const HOOK = resolve(process.cwd(), '.claude/hooks/runtime-sanctuary-guard.sh');

function decide(command) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
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
});
