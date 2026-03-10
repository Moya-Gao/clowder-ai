#!/usr/bin/env node

/**
 * Anthropic API Reverse Proxy
 *
 * 用于代理第三方 Anthropic API 网关（如 felix-2），修复已知兼容性问题：
 * - 透传所有请求/响应，不改写内容
 * - 记录请求元数据用于调试
 * - 未来可在此层修复 thinking signature 等问题
 *
 * 用法: node scripts/anthropic-proxy.mjs --target https://chat.nuoda.vip/claudecode --port 9877
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const TARGET_BASE = (getArg('target') || process.env.ANTHROPIC_PROXY_TARGET || '').replace(/\/+$/, '');
const PORT = parseInt(getArg('port') || process.env.ANTHROPIC_PROXY_PORT || '9877', 10);
const DEBUG = args.includes('--debug') || process.env.ANTHROPIC_PROXY_DEBUG === '1';

if (!TARGET_BASE) {
  console.error('Usage: anthropic-proxy.mjs --target <base-url> [--port 9877] [--debug]');
  process.exit(1);
}

let requestCounter = 0;

const server = createServer(async (req, res) => {
  const reqId = ++requestCounter;
  const targetUrl = new URL(req.url || '/', TARGET_BASE);

  if (DEBUG) {
    console.log(`[proxy #${reqId}] ${req.method} ${req.url} → ${targetUrl.href}`);
  }

  // Collect request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  // Parse request body for logging
  let parsedBody;
  try {
    parsedBody = JSON.parse(body.toString('utf-8'));
  } catch {
    parsedBody = null;
  }

  if (DEBUG && parsedBody) {
    console.log(`[proxy #${reqId}] model=${parsedBody.model}, stream=${parsedBody.stream}, thinking=${JSON.stringify(parsedBody.thinking)}`);
  }

  // Forward headers (strip host, add proxy marker)
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

    // Forward response status + headers
    const responseHeaders = {};
    for (const [key, value] of upstream.headers.entries()) {
      // Skip hop-by-hop headers
      if (['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) continue;
      responseHeaders[key] = value;
    }

    // SSE detection — Anthropic streaming uses text/event-stream
    const isSSE = (upstream.headers.get('content-type') || '').includes('text/event-stream');

    res.writeHead(upstream.status, responseHeaders);

    if (!upstream.body) {
      const text = await upstream.text();
      res.end(text);
      if (DEBUG) console.log(`[proxy #${reqId}] done (no body), status=${upstream.status}`);
      return;
    }

    // Stream the response through
    // For SSE: flush after each chunk so CLI receives events immediately
    const reader = upstream.body.getReader();
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;

        // res.write returns false when the kernel buffer is full;
        // for SSE we still want to push immediately — Node http will
        // flush on the next tick. No explicit cork/uncork needed.
        res.write(value);

        if (DEBUG && isSSE) {
          // Log SSE event types for debugging (lightweight parse)
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
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: err.message } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[anthropic-proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[anthropic-proxy] → target: ${TARGET_BASE}`);
  console.log(`[anthropic-proxy] debug: ${DEBUG ? 'ON' : 'OFF'}`);
});
