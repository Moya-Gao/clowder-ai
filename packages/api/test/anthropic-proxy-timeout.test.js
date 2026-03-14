/**
 * AC-C4: upstream fetch timeout tests
 * - hung upstream → proxy returns 504
 * - slow but streaming upstream → proxy does NOT truncate
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const PROXY_SCRIPT = resolve(import.meta.dirname, '../../../scripts/anthropic-proxy.mjs');

/** Start proxy pointing to given upstreams config, with given timeout. */
async function startProxy(upstreamsPath, timeoutMs) {
  const port = 19870 + Math.floor(Math.random() * 100);
  const proc = spawn('node', [PROXY_SCRIPT, '--port', String(port), '--upstreams', upstreamsPath], {
    env: {
      ...process.env,
      ANTHROPIC_PROXY_UPSTREAM_TIMEOUT_MS: String(timeoutMs),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('proxy start timeout')), 5000);
    proc.stdout.on('data', (data) => {
      if (data.toString().includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return { port, proc };
}

describe('anthropic-proxy upstream timeout (AC-C4)', () => {
  let hungServer;
  let hungPort;
  let proxyProcess;
  let proxyPort;
  let tmpDir;

  before(async () => {
    // Server that accepts connections but never responds
    hungServer = createHttpServer((_req, _res) => {
      // Intentionally never respond
    });
    await new Promise((r) => hungServer.listen(0, '127.0.0.1', r));
    hungPort = hungServer.address().port;

    tmpDir = mkdtempSync(join(tmpdir(), 'proxy-timeout-'));
    const catCafeDir = join(tmpDir, '.cat-cafe');
    mkdirSync(catCafeDir, { recursive: true });
    const upstreamsPath = join(catCafeDir, 'proxy-upstreams.json');
    writeFileSync(upstreamsPath, JSON.stringify({ 'hung-upstream': `http://127.0.0.1:${hungPort}` }));

    const proxy = await startProxy(upstreamsPath, 1000);
    proxyPort = proxy.port;
    proxyProcess = proxy.proc;
  });

  after(async () => {
    if (proxyProcess) {
      proxyProcess.kill('SIGTERM');
      await new Promise((r) => proxyProcess.on('close', r));
    }
    if (hungServer) hungServer.close();
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 504 when upstream does not respond within timeout', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/hung-upstream/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [] }),
      signal: AbortSignal.timeout(3000),
    });

    assert.equal(res.status, 504, `expected 504 but got ${res.status}`);
    const body = await res.json();
    assert.equal(body.error.type, 'proxy_timeout');
  });
});

describe('anthropic-proxy does NOT truncate slow streaming (P1 review fix)', () => {
  let slowServer;
  let slowPort;
  let proxyProcess;
  let proxyPort;
  let tmpDir;

  before(async () => {
    // Server that sends headers immediately, then streams data slowly
    // Total stream time: ~1.5s (exceeds the 1s connect timeout)
    slowServer = createHttpServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: ping\ndata: {}\n\n');
      // Send second chunk after 1.5s — must NOT be truncated
      setTimeout(() => {
        res.write('event: message_stop\ndata: {}\n\n');
        res.end();
      }, 1500);
    });
    await new Promise((r) => slowServer.listen(0, '127.0.0.1', r));
    slowPort = slowServer.address().port;

    tmpDir = mkdtempSync(join(tmpdir(), 'proxy-slow-'));
    const catCafeDir = join(tmpDir, '.cat-cafe');
    mkdirSync(catCafeDir, { recursive: true });
    const upstreamsPath = join(catCafeDir, 'proxy-upstreams.json');
    writeFileSync(upstreamsPath, JSON.stringify({ 'slow-upstream': `http://127.0.0.1:${slowPort}` }));

    // Connect timeout = 1s, but stream should NOT be cut at 1s
    const proxy = await startProxy(upstreamsPath, 1000);
    proxyPort = proxy.port;
    proxyProcess = proxy.proc;
  });

  after(async () => {
    if (proxyProcess) {
      proxyProcess.kill('SIGTERM');
      await new Promise((r) => proxyProcess.on('close', r));
    }
    if (slowServer) slowServer.close();
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('receives complete stream even when it takes longer than connect timeout', async () => {
    const res = await fetch(`http://127.0.0.1:${proxyPort}/slow-upstream/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [], stream: true }),
      signal: AbortSignal.timeout(5000),
    });

    assert.equal(res.status, 200);
    const body = await res.text();
    // Must contain BOTH events — stream was not truncated
    assert.ok(body.includes('event: ping'), 'should contain first event');
    assert.ok(body.includes('event: message_stop'), 'should contain final event (not truncated)');
  });
});
