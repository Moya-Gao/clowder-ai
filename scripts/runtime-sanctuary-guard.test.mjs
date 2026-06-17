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

// ═══════════════════════════════════════════════════════════════════════════
// 主仓 + relay-station 根删除保护 — trash 事故 2026-06-16（宪宪/opus-47 的 `trash "$TMP"`
// 把整个主仓 cat-cafe move 到 .Trash）。现有 guard 只护 cat-cafe-runtime（生产 worktree），
// 主仓 cat-cafe 本身 + relay-station 顶层零保护。补字面 path 删除拦截（rm/trash/mv）。
// 这只防"字面写出全路径"的删除；$VAR 展开类根因 hook 看不到展开值 → 见下一个 describe 的 ask nudge。
// ═══════════════════════════════════════════════════════════════════════════
describe('runtime-sanctuary-guard: main repo + relay-station root deletion (trash incident 2026-06-16)', () => {
  const MAIN = '/Users/lysander/projects/relay-station/cat-cafe';
  const RELAY = '/Users/lysander/projects/relay-station';

  const denyCases = [
    ['trash the main repo root (the incident)', `trash ${MAIN}`],
    ['rm -rf the main repo root', `rm -rf ${MAIN}`],
    ['trash main repo root (trailing slash)', `trash ${MAIN}/`],
    ['trash main repo root (single-quoted)', `trash '${MAIN}'`],
    ['mv the main repo root away', `mv ${MAIN} /tmp/elsewhere`],
    ['rm the main repo .git (repo destruction)', `rm -rf ${MAIN}/.git`],
    ['trash the relay-station top dir', `trash ${RELAY}`],
    ['rm -rf relay-station top dir', `rm -rf ${RELAY}`],
    ['trash relay-station top (trailing slash)', `trash ${RELAY}/`],
    // failure-mode sweep (46/Opus-4.6 review 2026-06-17): bypass 变体 — flags/多路径/分隔符
    ['multi-path rm, main repo as non-first arg (P1-1)', `rm -rf /tmp/junk ${MAIN}`],
    ['split short flags rm -r -f (P1-2)', `rm -r -f ${MAIN}`],
    ['long-form flags rm --recursive --force (P1-2)', `rm --recursive --force ${MAIN}`],
    ['multi-path, relay-station as non-first arg', `rm -rf /tmp/a ${RELAY}`],
    ['trash with -v flag before main repo', `trash -v ${MAIN}`],
    ['mv with -f flag before main repo', `mv -f ${MAIN} /tmp/x`],
    // 47 review round 2 (2026-06-17, CVO option A best-effort): $HOME/~ 展开（命中事故根因 $VAR）+ glob 株连
    ['rm $HOME-prefixed main repo (P1-1, 命中事故根因)', 'rm -rf $HOME/projects/relay-station/cat-cafe'],
    ['rm ~-prefixed main repo (P1-2 shorthand)', 'rm -rf ~/projects/relay-station/cat-cafe'],
    ['trash $HOME-prefixed relay-station top', 'trash $HOME/projects/relay-station'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: bash ${HOME} 展开语法（非 JS 模板占位符）
    ['rm braced-HOME main repo', 'rm -rf ${HOME}/projects/relay-station/cat-cafe'],
    ['glob cat-c* (P1-5 最灾难 — 株连 runtime 圣域 + alpha)', 'rm -rf /Users/lysander/projects/relay-station/cat-c*'],
    ['glob cat-?afe single-char (P2)', 'rm -rf /Users/lysander/projects/relay-station/cat-?afe'],
    ['glob relay-station/* (删所有兄弟 worktree)', 'rm -rf /Users/lysander/projects/relay-station/*'],
    ['glob with $HOME prefix', 'rm -rf $HOME/projects/relay-station/cat-c*'],
  ];
  for (const [name, command] of denyCases) {
    it(`denies: ${name}`, () => {
      assert.equal(decide(command), 'deny', `expected deny for: ${command}`);
    });
  }

  const allowCases = [
    // 子目录删除是高频合法操作——误报会把 guard 训练成狼来了
    ['rm node_modules inside main repo', `rm -rf ${MAIN}/node_modules`],
    ['rm dist in a deep subdir', `rm -rf ${MAIN}/packages/api/dist`],
    ['trash a scratch file in main repo', `trash ${MAIN}/tmp-scratch.txt`],
    // 兄弟 worktree / 同前缀更长名放行（同 cat-cafe-runtime vs -cwd-debug 边界精度）
    ['rm a sibling feature worktree (longer name)', `rm -rf ${MAIN}-some-feature`],
    ['git worktree remove a sibling worktree', `git worktree remove ${MAIN}-f239-phase-a`],
    ['rm a relay-station-suffixed sibling dir', `rm -rf ${RELAY}-backup-2026`],
    // 误报防线（sweep 关键）：[^&;|]* 不跨命令分隔符 —— rm tmp 后 cd 主仓必须放行（cd 不是删除）
    ['rm tmp then cd main repo (cd is not delete)', `rm -rf /tmp/x && cd ${MAIN}`],
    ['rm tmp then cd main repo subdir', `cd /tmp && rm -rf junk; cd ${MAIN}/packages`],
    // 多路径但目标全是子目录/tmp — 合法清理
    ['multi-path delete of only subdir + tmp', `rm -rf ${MAIN}/node_modules /tmp/y`],
    ['echo main repo path (no delete verb)', `echo ${MAIN}`],
    // A best-effort 边界（round 2）：$HOME/~ 子目录 + 深层 glob 是合法删除，必须放行
    ['$HOME main repo node_modules subdir', 'rm -rf $HOME/projects/relay-station/cat-cafe/node_modules'],
    ['~ main repo dist subdir', 'rm -rf ~/projects/relay-station/cat-cafe/dist'],
    ['deep glob inside main repo packages', 'rm -rf /Users/lysander/projects/relay-station/cat-cafe/packages/*'],
  ];
  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// $VAR 危险删除在长 chain 里 → ask nudge（trash 事故根因：$TMP 在 12+ 步 chain 里意外展开）。
// hook 拿到的是未展开命令文本，看不到 $VAR 真值 → 无法字面拦截，只能启发式 nudge。
// 触发：危险删除接裸变量 + 长 chain（≥3 命令）+ 无 /tmp|/var/folders 白名单守护 → ask（不阻断）。
// 把 feedback 脚本纪律「危险操作别塞长 chain、先 echo/白名单」hook 化。单条 trash "$VAR" 放行。
// ═══════════════════════════════════════════════════════════════════════════
describe('runtime-sanctuary-guard: $VAR dangerous-delete in long chain → ask nudge', () => {
  const askCases = [
    ['trash $VAR in a 4-step chain (the incident shape)', 'cd /tmp/work && mktemp -d && echo done && trash "$TMP"'],
    ['rm -rf $VAR in a 3-step chain', 'cd build && pnpm compile && rm -rf $OUT_DIR'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: bash ${VAR} 语法（非 JS 模板占位符），测试故意覆盖大括号变量形态
    ['trash braced-var form in a long chain', 'echo a && echo b && trash "${SCRATCH}"'],
    // failure-mode sweep (46 review 2026-06-17): -- 断链 / 长形式 flags / || 分隔符
    ['rm -rf -- $VAR in chain (-- end-of-options, P1-3)', 'cd a && echo b && rm -rf -- $TMP'],
    ['rm --recursive $VAR long-form flag in chain', 'cd a && echo b && rm --recursive $OUT'],
    ['trash $VAR in || chain (|| also counts as separator)', 'echo a || echo b || trash $X'],
  ];
  for (const [name, command] of askCases) {
    it(`asks (nudge): ${name}`, () => {
      assert.equal(decide(command), 'ask', `expected ask for: ${command}`);
    });
  }

  const allowCases = [
    ['single trash "$WORKTREE" (no chain — cleanup norm)', 'trash "$WORKTREE"'],
    ['single rm -rf "$TMPDIR" (no chain)', 'rm -rf "$TMPDIR"'],
    ['2-command chain with $VAR delete (below long-chain threshold)', 'pnpm build && rm -rf $BUILD_DIR'],
    ['literal /tmp path delete in long chain (not a variable)', 'cd x && echo y && trash /tmp/foo-scratch'],
    ['$VAR delete with case /tmp whitelist guard', 'echo a && echo b && case "$X" in /tmp/*) trash "$X";; esac'],
    [
      '$VAR delete guarded by [[ == /var/folders ]] check',
      'echo a && echo b && [[ "$X" == /var/folders/* ]] && trash "$X"',
    ],
    // 非 recursive rm $VAR 放行 — 无 -r/-R 时 rm 删目录会报错、删空变量也报错，风险远低于 trash/rm -rf；保留 recursive 精确避免无谓误报
    ['non-recursive rm $VAR in chain (no -r/-R, lower risk)', 'cd a && echo b && rm $LOGFILE'],
  ];
  for (const [name, command] of allowCases) {
    it(`allows: ${name}`, () => {
      assert.equal(decide(command), 'allow', `expected allow for: ${command}`);
    });
  }
});
