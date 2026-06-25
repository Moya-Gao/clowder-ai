import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findStaleDevProcesses } from './cleanup-stale-dev-processes.mjs';

describe('cleanup-stale-dev-processes Redis sanctuary guard', () => {
  it('does not mark production Redis port 6099 as stale cleanup target', () => {
    const findings = findStaleDevProcesses([
      {
        pid: 100,
        ppid: 1,
        pgid: 100,
        sess: 100,
        elapsed: '01:00:00',
        elapsedSeconds: 3600,
        rssKb: 4096,
        command: 'redis-server 127.0.0.1:6099',
      },
    ]);

    assert.deepEqual(findings, []);
  });

  it('still marks non-sanctuary orphan Redis as stale cleanup target', () => {
    const findings = findStaleDevProcesses([
      {
        pid: 101,
        ppid: 1,
        pgid: 101,
        sess: 101,
        elapsed: '01:00:00',
        elapsedSeconds: 3600,
        rssKb: 4096,
        command: 'redis-server 127.0.0.1:63552',
      },
    ]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].pid, 101);
  });
});

// F247 KD-19: MCP wrapper lifecycle hygiene gate tests.
// Verifies stale MCP server wrappers (>8h) get cleaned, while protecting:
//   - long-lived non-MCP daemons (pinchtab server/bridge)
//   - active fresh wrappers (<8h)
//   - unrelated processes (node/npm/playwright generic) — must never match

const NINE_HOURS_SECONDS = 9 * 3600;
const SEVEN_HOURS_SECONDS = 7 * 3600;

function buildProcess(overrides) {
  return {
    pid: 1000,
    ppid: 999,
    pgid: 1000,
    sess: 1000,
    elapsed: '09:00:00',
    elapsedSeconds: NINE_HOURS_SECONDS,
    rssKb: 50000,
    ...overrides,
  };
}

describe('cleanup-stale-dev-processes F247 KD-19 MCP wrapper rules', () => {
  // ─── Positive matches (stale wrappers > 8h get cleaned) ────────────

  it('matches stale agent-browser-mcp wrapper > 8h (node form)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 2001,
        command: 'node /Users/lysander/.npm/_npx/c037763d8621e426/node_modules/.bin/agent-browser-mcp',
      }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-agent-browser-mcp-wrapper');
  });

  it('matches stale agent-browser-mcp wrapper > 8h (npm exec form)', () => {
    const findings = findStaleDevProcesses([buildProcess({ pid: 2002, command: 'npm exec agent-browser-mcp' })]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-agent-browser-mcp-wrapper');
  });

  it('matches stale @playwright/mcp wrapper > 8h (npm exec form)', () => {
    const findings = findStaleDevProcesses([buildProcess({ pid: 2003, command: 'npm exec @playwright/mcp@latest' })]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-playwright-mcp-wrapper');
  });

  it('matches stale playwright-mcp wrapper > 8h (node form)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 2004,
        command: 'node /Users/lysander/.npm/_npx/9833c18b2d85bc59/node_modules/.bin/playwright-mcp',
      }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-playwright-mcp-wrapper');
  });

  it('matches stale pinchtab-mcp wrapper > 8h (npx form)', () => {
    const findings = findStaleDevProcesses([buildProcess({ pid: 2005, command: 'npx pinchtab-mcp --port 9090' })]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-pinchtab-mcp-wrapper');
  });

  // R2 P2: direct `pinchtab-mcp` binary forms must match (codex R2 P2 claim/impl alignment).

  it('matches stale pinchtab-mcp wrapper > 8h (direct binary, unqualified)', () => {
    const findings = findStaleDevProcesses([buildProcess({ pid: 2006, command: 'pinchtab-mcp --port 9090' })]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-pinchtab-mcp-wrapper');
  });

  it('matches stale pinchtab-mcp wrapper > 8h (direct binary, absolute path)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 2007, command: '/usr/local/bin/pinchtab-mcp --port 9090' }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-pinchtab-mcp-wrapper');
  });

  it('matches stale pinchtab-mcp wrapper > 8h (npm exec form)', () => {
    const findings = findStaleDevProcesses([buildProcess({ pid: 2008, command: 'npm exec pinchtab-mcp' })]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-pinchtab-mcp-wrapper');
  });

  // ─── Negative matches (must NEVER kill these) ─────────────────────

  it('does NOT kill pinchtab server (long-lived daemon, not MCP wrapper)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3001, elapsedSeconds: 30 * 3600, command: 'pinchtab server --port 8080' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill pinchtab bridge (long-lived daemon, not MCP wrapper)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3002, elapsedSeconds: 30 * 3600, command: '/usr/local/bin/pinchtab bridge' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill agent-browser-mcp wrapper younger than 8h (active session)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3003, elapsedSeconds: SEVEN_HOURS_SECONDS, command: 'npm exec agent-browser-mcp' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill @playwright/mcp wrapper younger than 8h (active session)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3004, elapsedSeconds: SEVEN_HOURS_SECONDS, command: 'npm exec @playwright/mcp@latest' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill generic node process (no MCP marker)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3005, elapsedSeconds: 30 * 3600, command: 'node server.js' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill generic npm exec (without specific MCP target)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3006, elapsedSeconds: 30 * 3600, command: 'npm exec eslint --fix .' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill standalone playwright test runner (different binary)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3007, elapsedSeconds: 30 * 3600, command: 'node node_modules/.bin/playwright test' }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT match pinchtab command containing "mcp" but as server/bridge', () => {
    const findings = findStaleDevProcesses([
      buildProcess({ pid: 3008, elapsedSeconds: 30 * 3600, command: 'pinchtab server --upstream-mcp-config /tmp/x' }),
    ]);
    assert.deepEqual(findings, []);
  });

  // ─── R1 P1: platform-tagged binary forms must NOT be mis-killed ────

  it('does NOT kill pinchtab-darwin-arm64 server even when args mention mcp (R1 P1)', () => {
    // Real binary form codex/砚砚 caught in R1: substring search would mis-flag this.
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 3101,
        elapsedSeconds: 30 * 3600,
        command: '/Users/lysander/.pinchtab/bin/pinchtab-darwin-arm64 server --upstream-mcp-config /tmp/x',
      }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill pinchtab-darwin-arm64 bridge with --mcp-config arg (R1 P1)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 3102,
        elapsedSeconds: 30 * 3600,
        command: '/Users/lysander/.pinchtab/bin/pinchtab-darwin-arm64 bridge --mcp-config /tmp/y.json',
      }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does kill pinchtab-darwin-arm64 mcp (real binary form, mcp subcommand)', () => {
    // Sanity sibling to the bug above — confirm the positive form still matches.
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 2106,
        command: '/Users/lysander/.pinchtab/bin/pinchtab-darwin-arm64 mcp',
      }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'stale-pinchtab-mcp-wrapper');
  });

  // ─── R1 P2: marker substring in unrelated args must NOT be mis-killed ─

  it('does NOT kill node process where agent-browser-mcp appears in unrelated arg (R1 P2)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 3103,
        elapsedSeconds: 30 * 3600,
        command: 'node print-stats.js --include agent-browser-mcp.config.json',
      }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill node process where @playwright/mcp appears in unrelated arg (R1 P2)', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 3104,
        elapsedSeconds: 30 * 3600,
        command: 'node parse-logs.js @playwright/mcp@latest-warnings.log',
      }),
    ]);
    assert.deepEqual(findings, []);
  });

  it('does NOT kill npm exec that targets neither agent-browser-mcp nor @playwright/mcp', () => {
    const findings = findStaleDevProcesses([
      buildProcess({
        pid: 3105,
        elapsedSeconds: 30 * 3600,
        command: 'npm exec some-other-tool --foo agent-browser-mcp',
      }),
    ]);
    assert.deepEqual(findings, []);
  });
});
