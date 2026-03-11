#!/usr/bin/env node

/**
 * Anthropic API Gateway Proxy
 *
 * All api_key profile requests are routed through this proxy automatically.
 * Target resolution: reads registered upstreams from a JSON config file.
 * Each upstream gets a slug; CLI baseUrl is set to http://localhost:PORT/SLUG
 * and the proxy strips the slug prefix, forwarding to the real upstream.
 *
 * Config file: .cat-cafe/proxy-upstreams.json (auto-managed by API)
 *   { "felix-2": "https://chat.nuoda.vip/claudecode" }
 *
 * Request flow:
 *   CLI → http://127.0.0.1:9877/felix-2/v1/messages
 *   Proxy strips "/felix-2" → forwards to https://chat.nuoda.vip/claudecode/v1/messages
 *
 * Startup: automatically started by start-dev.sh
 * Disable: ANTHROPIC_PROXY_ENABLED=0 (skip proxy, CLI connects to upstream directly)
 * Config:  ANTHROPIC_PROXY_PORT (default 9877), ANTHROPIC_PROXY_DEBUG=1
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const PORT = parseInt(getArg('port') || process.env.ANTHROPIC_PROXY_PORT || '9877', 10);
const DEBUG = args.includes('--debug') || process.env.ANTHROPIC_PROXY_DEBUG === '1';
const UPSTREAMS_PATH = resolve(PROJECT_ROOT, '.cat-cafe', 'proxy-upstreams.json');

/** Load upstream mapping from config file. Re-read on each request for hot-reload. */
function loadUpstreams() {
  try {
    const raw = readFileSync(UPSTREAMS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

let requestCounter = 0;

const server = createServer(async (req, res) => {
  const reqId = ++requestCounter;
  const path = req.url || '/';

  // Parse slug from path: /SLUG/v1/messages → slug="SLUG", rest="/v1/messages"
  const match = path.match(/^\/([a-zA-Z0-9_-]+)(\/.*)?$/);
  if (!match) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: { type: 'proxy_error', message: `Invalid path: ${path}. Expected /<upstream-slug>/...` },
    }));
    return;
  }

  const slug = match[1];
  const restPath = match[2] || '/';

  const upstreams = loadUpstreams();
  const targetBase = upstreams[slug]?.replace(/\/+$/, '');

  if (!targetBase) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: {
        type: 'proxy_error',
        message: `Unknown upstream "${slug}". Known: [${Object.keys(upstreams).join(', ')}]`,
      },
    }));
    return;
  }

  // NB: Do NOT use `new URL(restPath, targetBase)` — when restPath is absolute
  // (starts with "/"), the URL constructor discards the base URL's path component.
  // e.g. new URL("/v1/messages", "https://example.com/prefix") → "https://example.com/v1/messages"
  // We need: "https://example.com/prefix/v1/messages"
  const targetUrl = new URL(targetBase + restPath);

  if (DEBUG) {
    console.log(`[proxy #${reqId}] ${req.method} ${path} → [${slug}] ${targetUrl.href}`);
  }

  // Collect request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  if (DEBUG && body.length > 0) {
    try {
      const parsed = JSON.parse(body.toString('utf-8'));
      console.log(`[proxy #${reqId}] model=${parsed.model}, stream=${parsed.stream}, thinking=${JSON.stringify(parsed.thinking)}`);
    } catch { /* not JSON */ }
  }

  // Forward headers (strip hop-by-hop)
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key === 'host' || key === 'connection') continue;
    forwardHeaders[key] = value;
  }

  try {
    const upstream = await fetch(targetUrl.href, {
      method: req.method || 'GET',
      headers: forwardHeaders,
      ...(body.length > 0 ? { body } : {}),
    });

    const responseHeaders = {};
    for (const [key, value] of upstream.headers.entries()) {
      if (['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) continue;
      responseHeaders[key] = value;
    }

    const isSSE = (upstream.headers.get('content-type') || '').includes('text/event-stream');

    res.writeHead(upstream.status, responseHeaders);

    if (!upstream.body) {
      const text = await upstream.text();
      res.end(text);
      if (DEBUG) console.log(`[proxy #${reqId}] done (no body), status=${upstream.status}`);
      return;
    }

    const reader = upstream.body.getReader();
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        res.write(value);

        if (DEBUG && isSSE) {
          const text = Buffer.from(value).toString('utf-8');
          const events = text.match(/event:\s*(\S+)/g);
          if (events) console.log(`[proxy #${reqId}] SSE events: ${events.join(', ')}`);
        }
      }
    } catch (streamErr) {
      if (DEBUG) console.error(`[proxy #${reqId}] stream error:`, streamErr.message);
    } finally {
      res.end();
      if (DEBUG) console.log(`[proxy #${reqId}] done, ${totalBytes} bytes${isSSE ? ' (SSE)' : ''}, status=${upstream.status}`);
    }
  } catch (err) {
    console.error(`[proxy #${reqId}] upstream error:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: err.message } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const upstreams = loadUpstreams();
  const slugs = Object.keys(upstreams);
  console.log(`[anthropic-proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[anthropic-proxy] upstreams: ${slugs.length > 0 ? slugs.join(', ') : '(none — add to .cat-cafe/proxy-upstreams.json)'}`);
  console.log(`[anthropic-proxy] debug: ${DEBUG ? 'ON' : 'OFF'}`);
});
