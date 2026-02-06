import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

function once(emitter, event) {
  return new Promise((resolve) => emitter.once(event, resolve));
}

async function waitForMatch(child, regex, { timeoutMs }) {
  let output = '';
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, timeoutMs);

  const onData = (chunk) => {
    output += chunk.toString();
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  try {
    while (!timedOut) {
      const match = output.match(regex);
      if (match) {
        return { match, output };
      }
      // avoid busy loop
      await delay(25);
    }
    throw new Error(`Timed out waiting for output matching ${regex}`);
  } finally {
    clearTimeout(timeout);
    child.stdout?.off('data', onData);
    child.stderr?.off('data', onData);
  }
}

test('API binds to 127.0.0.1 by default', async () => {
  const apiDir = path.resolve(process.cwd());
  const childEnv = { ...process.env, API_SERVER_PORT: '0' };
  delete childEnv.API_SERVER_HOST;

  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: apiDir,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.once('error', (err) => {
    throw err;
  });

  try {
    const { match } = await waitForMatch(
      child,
      /Server listening at http:\/\/([^:]+):(\d+)/,
      { timeoutMs: 5000 }
    );

    const host = match[1];
    const port = Number(match[2]);

    assert.equal(host, '127.0.0.1');
    assert.ok(Number.isInteger(port) && port > 0);

    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), delay(2000)]);
  }
});

test('ClaudeAgentService does not bypass permissions or allow Bash', async () => {
  const srcPath = path.join(
    process.cwd(),
    'src/domains/cats/services/ClaudeAgentService.ts'
  );
  const src = await fs.readFile(srcPath, 'utf8');

  // Must NOT use any dangerous flags
  assert.ok(!src.includes('dangerously'), 'must not use any dangerous flags');

  // Must use acceptEdits permission mode (CLI flag value)
  assert.match(src, /const PERMISSION_MODE = 'acceptEdits';/, 'must define PERMISSION_MODE as acceptEdits');
  assert.match(src, /const ALLOWED_TOOLS = 'Read,Edit,Glob,Grep';/, 'must define exact allowed tools');

  // Must bind flags to secure constants (not just contain string literals)
  assert.match(src, /'--permission-mode',\s*PERMISSION_MODE/, 'must bind --permission-mode to PERMISSION_MODE');
  assert.match(src, /'--allowedTools',\s*ALLOWED_TOOLS/, 'must bind --allowedTools to ALLOWED_TOOLS');

  // Must not allow Bash tool
  assert.ok(!src.includes('Bash'), 'must not allow Bash tool');
});
