import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findStaleDevProcesses, parsePsOutput, terminateFindings } from './cleanup-stale-dev-processes.mjs';

test('stale dev process detector catches only old orphaned Cat Cafe tool processes', () => {
  const ps = `
17924     1 17878     0 19:19:05 400064 /opt/homebrew/Cellar/node@24/bin/node --test-timeout=0 test/cli-spawn-busy-silent-stall.test.js
12672     1 12672     0 07-08:22:24 4928 /opt/homebrew/lib/node_modules/agent-browser/bin/agent-browser-darwin-arm64
25067     1 25067     0 03-12:37:14 1184 /opt/homebrew/bin/tmux -L catcafe-test-agent-spawn-1779447349782 new-session -d -x 80 -y 24 -c /tmp /bin/zsh
4531      1 4531      0 02-13:27:10 36432 node /opt/homebrew/bin/pnpm alpha:start
53929 39510 53929     0 00:11:14 166016 npm exec agent-browser-mcp
70293     1 70293     0 02-00:00:00 50736 node /opt/homebrew/bin/codex exec --prompt "agent-browser-darwin-arm64 in prompt"
90000     1 90000     0 00:30:00 36432 node /opt/homebrew/bin/pnpm alpha:start
`;

  const findings = findStaleDevProcesses(parsePsOutput(ps), { ownPid: 99999 });
  assert.deepEqual(
    findings.map((item) => [item.pid, item.ruleId]),
    [
      [17924, 'cat-cafe-node-test-watch'],
      [12672, 'agent-browser-cli'],
      [25067, 'catcafe-test-tmux'],
      [4531, 'orphan-alpha-start'],
    ],
  );
});

test('stale dev process detector catches old orphaned non-sanctuary Redis listeners', () => {
  const ps = `
13851     1 13851      0       10:01   3984 redis-server 127.0.0.1:52506
64933     1 64933      0       55:17   4048 redis-server 127.0.0.1:65093
72593 72400 72593      0       55:17   4048 redis-server 127.0.0.1:57389
`;

  const findings = findStaleDevProcesses(parsePsOutput(ps), { ownPid: 99999 });
  assert.deepEqual(
    findings.map((item) => [item.pid, item.ruleId]),
    [
      [13851, 'orphan-isolated-redis'],
      [64933, 'orphan-isolated-redis'],
    ],
  );
});

test('stale dev process detector never treats protected Redis ports as orphans', () => {
  const ps = `
10001     1 10001      0       55:17   4048 redis-server 127.0.0.1:6379
10002     1 10002      0       55:17   4048 redis-server 127.0.0.1:6398
10003     1 10003      0       55:17   4048 redis-server 127.0.0.1:6399
10004     1 10004      0       55:17   4048 redis-server 127.0.0.1:6401
10005     1 10005      0       09:59   4048 redis-server 127.0.0.1:65093
`;

  const findings = findStaleDevProcesses(parsePsOutput(ps), { ownPid: 99999 });
  assert.deepEqual(findings, []);
});

test('cleanup escalates from SIGTERM to SIGKILL for stubborn stale processes', async () => {
  const alive = new Set([101, 102]);
  const calls = [];

  const result = await terminateFindings([{ pid: 101 }, { pid: 102 }], {
    graceMs: 1,
    killFn(pid, signal) {
      calls.push([pid, signal]);
      if (signal === 'SIGTERM' && pid === 101) alive.delete(pid);
      if (signal === 'SIGKILL' && pid === 102) alive.delete(pid);
    },
    existsFn(pid) {
      return alive.has(pid);
    },
    async sleepFn() {},
  });

  assert.deepEqual(calls, [
    [101, 'SIGTERM'],
    [102, 'SIGTERM'],
    [102, 'SIGKILL'],
  ]);
  assert.equal(result.sigtermSent, 2);
  assert.equal(result.sigkillSent, 1);
  assert.equal(result.alreadyGone, 1);
  assert.deepEqual(result.failed, []);
});
