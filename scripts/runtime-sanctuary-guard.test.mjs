import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const HOOK = resolve(process.cwd(), '.claude/hooks/runtime-sanctuary-guard.sh');

function decide(command, toolName = 'Bash', cwd = undefined) {
  const tool_input = toolName === 'Bash' ? { command } : { file_path: command, old_string: 'x', new_string: 'y' };
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
    assert.equal(decide(`${RUNTIME}/packages/web/src/components/SessionChainPanel.tsx`, 'Edit'), 'deny');
  });
  it('denies Write to file inside runtime worktree', () => {
    assert.equal(decide(`${RUNTIME}/packages/api/src/index.ts`, 'Write'), 'deny');
  });
  it('allows Edit to file in main repo', () => {
    assert.equal(decide('/Users/lysander/projects/relay-station/cat-cafe/packages/web/src/App.tsx', 'Edit'), 'allow');
  });
  it('allows Edit to file in a regular worktree', () => {
    assert.equal(decide('/tmp/worktree-feat-xyz/packages/web/src/App.tsx', 'Edit'), 'allow');
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

// 铲屎官 2026-06-06: "你好像至少是第五只踩到这个 取名带了runtime被误杀的大猫猫了"
// The guard substring-matched bare "runtime", so feature branches/worktrees that merely
// contain "runtime" in their name (e.g. fix/cat-cwd-runtime-fallback) got false-positive denied.
// The REAL protected objects are precise: branch `runtime/main-sync` (the runtime/ namespace)
// and worktree dir `cat-cafe-runtime` (exact path component). Match THOSE, not any "runtime".
describe('runtime-sanctuary-guard: name precision — no "runtime" substring false-positives', () => {
  const allowCases = [
    // The exact recurring friction: deleting a merged feature branch whose name has "runtime".
    ['delete feature branch with runtime in name', 'git branch -D fix/cat-cwd-runtime-fallback'],
    ['delete feature branch -d with runtime in name', 'git branch -d feat/runtime-config-ui'],
    ['delete branch where runtime is mid-token', 'git branch --delete fix/my-runtime-thing'],
    // worktree-remove of a feature worktree whose dir name extends past cat-cafe-runtime.
    [
      'remove feature worktree (cat-cafe-runtime- prefix, longer name)',
      'git worktree remove /Users/lysander/projects/relay-station/cat-cafe-runtime-cwd-debug',
    ],
    ['remove feature worktree with runtime mid-name', 'git worktree remove ../cat-cafe-fix-runtime-fallback'],
    // rm of a feature dir whose name extends past cat-cafe-runtime.
    ['rm feature dir (cat-cafe-runtime- prefix, longer name)', 'rm -rf /Users/x/cat-cafe-runtime-fallback-fix'],
  ];
  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }

  // Regression — the REAL runtime objects must STILL be denied after the precision fix.
  const denyCases = [
    ['delete the real runtime/main-sync branch', 'git branch -D runtime/main-sync'],
    ['delete a runtime/ namespace branch', 'git branch -d runtime/experimental'],
    [
      'remove the real runtime worktree (exact path)',
      'git worktree remove /Users/lysander/projects/relay-station/cat-cafe-runtime',
    ],
    [
      'remove the real runtime worktree (trailing slash)',
      'git worktree remove /Users/lysander/projects/relay-station/cat-cafe-runtime/',
    ],
    ['rm -rf the real runtime worktree (exact)', 'rm -rf /Users/lysander/projects/relay-station/cat-cafe-runtime'],
  ];
  for (const [name, command] of denyCases) {
    it(`denies (regression): ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }
});

// 砚砚/gpt-5.4 review P1 (2026-06-06): the precision fix must cover ALL detection layers, not
// just delete (branch/worktree/rm). Edit / cwd / cd / git -C / git switch matched runtime by
// prefix/substring too, so a feature worktree like cat-cafe-runtime-cwd-debug was STILL
// false-positive denied on enter/write. This sweeps every layer to the same precision.
describe('runtime-sanctuary-guard: enter/write layer precision — sweep all layers', () => {
  const FEAT = '/Users/lysander/projects/relay-station/cat-cafe-runtime-cwd-debug'; // feature worktree, NOT runtime
  const RUNTIME = '/Users/lysander/projects/relay-station/cat-cafe-runtime';

  // false-positives that must now be ALLOWED (feature worktree/branch whose name contains runtime)
  it('allows: Edit a file in a cat-cafe-runtime-* feature worktree (mode 0)', () => {
    assert.equal(decide(`${FEAT}/packages/api/src/index.ts`, 'Edit'), 'allow');
  });
  it('allows: Bash cwd in a cat-cafe-runtime-* feature worktree + git commit (mode 0b)', () => {
    assert.equal(decide('git commit -m "x"', 'Bash', FEAT), 'allow');
  });
  it('allows: cd into a cat-cafe-runtime-* feature worktree + git commit (mode 0c)', () => {
    assert.equal(decide(`cd ${FEAT} && git commit -m "x"`), 'allow');
  });
  it('allows: git -C a cat-cafe-runtime-* feature worktree + switch (mode 4)', () => {
    assert.equal(decide(`git -C ${FEAT} switch -c feat/test`), 'allow');
  });
  it('allows: git switch to a runtime-prefixed feature branch (mode 5)', () => {
    assert.equal(decide('git switch runtime-fix'), 'allow');
  });

  // regression — the REAL runtime enter/write must STILL be denied on every layer
  it('denies (regression): Edit a file inside the real runtime worktree (mode 0)', () => {
    assert.equal(decide(`${RUNTIME}/packages/api/src/index.ts`, 'Edit'), 'deny');
  });
  it('denies (regression): Bash cwd in the real runtime worktree + git commit (mode 0b)', () => {
    assert.equal(decide('git commit -m "x"', 'Bash', RUNTIME), 'deny');
  });
  it('denies (regression): cd into the real runtime worktree + git commit (mode 0c)', () => {
    assert.equal(decide(`cd ${RUNTIME} && git commit -m "x"`), 'deny');
  });
  it('denies (regression): git -C the real runtime worktree + switch (mode 4)', () => {
    assert.equal(decide(`git -C ${RUNTIME} switch -c feat/bad`), 'deny');
  });
  it('denies (regression): git switch to the real runtime/main-sync branch (mode 5)', () => {
    assert.equal(decide('git switch runtime/main-sync'), 'deny');
  });
});

// gpt52 re-review round 3 (2026-06-06): (P1) branch runtime/ must be a TOP-LEVEL token, not any
// runtime/ substring; (P2) the path boundary must be REAL shell/path separators, not a
// filename-char whitelist (which keeps leaking .v2 / ~bak / +debug); (bypass) checkout/switch
// must still catch runtime/main-sync behind flags (--detach) or as a -c/-b start-point.
describe('runtime-sanctuary-guard: edge cases — namespace anchor, real separators, flag bypass', () => {
  const allowCases = [
    ['delete feat/runtime/foo (runtime/ not top-level)', 'git branch -D feat/runtime/foo'],
    ['switch to feat/runtime/foo (a feature branch)', 'git switch feat/runtime/foo'],
    [
      'cd cat-cafe-runtime.v2 + git commit (mode 0c, dotted suffix)',
      'cd /Users/x/cat-cafe-runtime.v2 && git commit -m "x"',
    ],
    ['rm cat-cafe-runtime.v2 (mode 3, dotted suffix)', 'rm -rf /Users/x/cat-cafe-runtime.v2'],
    ['pkill cat-cafe-runtime.v2 (mode 6, dotted suffix)', 'pkill -f /Users/x/cat-cafe-runtime.v2'],
    [
      'worktree remove cat-cafe-runtime~bak (mode 2, tilde suffix)',
      'git worktree remove /Users/x/cat-cafe-runtime~bak',
    ],
    [
      'rm cat-cafe-runtime+debug (mode 3, plus suffix — separator boundary handles it)',
      'rm -rf /Users/x/cat-cafe-runtime+debug',
    ],
  ];
  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }

  const denyCases = [
    ['delete runtime/foo (top-level namespace)', 'git branch -D runtime/foo'],
    ['delete "runtime/main-sync" (quoted)', 'git branch -D "runtime/main-sync"'],
    [
      'rm the exact runtime worktree, single-quoted',
      "rm -rf '/Users/lysander/projects/relay-station/cat-cafe-runtime'",
    ],
    [
      'cd the exact runtime worktree (trailing slash) + commit',
      'cd /Users/lysander/projects/relay-station/cat-cafe-runtime/ && git commit -m "x"',
    ],
    ['switch --detach to runtime/main-sync (flag before branch)', 'git switch --detach runtime/main-sync'],
    ['checkout --detach runtime/main-sync', 'git checkout --detach runtime/main-sync'],
    ['switch -c newbranch FROM runtime/main-sync (start-point)', 'git switch -c feat/test runtime/main-sync'],
    ['checkout -b newbranch FROM runtime/main-sync (start-point)', 'git checkout -b feat/test runtime/main-sync'],
  ];
  for (const [name, command] of denyCases) {
    it(`denies (regression): ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }
});

// Cloud codex review (2026-06-06): anchoring runtime/ / cat-cafe-runtime too tightly REOPENED two
// real bypasses (under-protection I introduced): a quoted `git -C` path, and `git branch -D --`
// before the branch. Fix uses token-based matching (eat flags/--/args/quotes, then the runtime
// token), which also closes the sibling multi-branch-arg case.
describe('runtime-sanctuary-guard: bypass closure — quotes, --, multi-arg (cloud review P1)', () => {
  const denyCases = [
    ['branch delete after -- (end-of-options)', 'git branch -D -- runtime/main-sync'],
    ['branch delete with runtime as a non-first arg', 'git branch -D feat/x runtime/main-sync'],
    [
      'git -C single-quoted runtime path + switch',
      "git -C '/Users/lysander/projects/relay-station/cat-cafe-runtime' switch -c bad",
    ],
    [
      'git -C double-quoted runtime path + reset',
      'git -C "/Users/lysander/projects/relay-station/cat-cafe-runtime" reset --hard HEAD~1',
    ],
    [
      'git -C quoted runtime subpath + push',
      'git -C "/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api" push',
    ],
  ];
  for (const [name, command] of denyCases) {
    it(`denies (regression): ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }

  const allowCases = [
    ['branch delete after -- of a runtime-named feature branch', 'git branch -D -- feat/cat-cwd-runtime-fallback'],
    [
      'git -C quoted FEATURE worktree (cat-cafe-runtime- prefix) + switch',
      'git -C "/Users/x/cat-cafe-runtime-cwd-debug" switch -c feat/test',
    ],
    ['branch delete of two non-runtime feature branches', 'git branch -D feat/x feat/y'],
  ];
  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }
});
