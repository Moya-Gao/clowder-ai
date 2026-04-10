/**
 * F156: WebSocket Origin Security Tests
 *
 * Verifies that Socket.IO rejects WebSocket connections from unauthorized origins.
 * This is the "钉住核心修复" test — Socket.IO's `cors` config does NOT protect
 * WebSocket upgrades (only HTTP polling). The real guard is `allowRequest`.
 *
 * Ref: OpenClaw ClawJacked (2026-02-26), CVE-2026-25253
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import { isOriginAllowed } from '../../dist/config/frontend-origin.js';
import { SocketManager } from '../../dist/infrastructure/websocket/SocketManager.js';

/**
 * Helper: attempt a Socket.IO connection with a specific Origin header and transport.
 * Returns a promise that resolves with { connected, error }.
 */
function attemptConnection(port, { origin, transports = ['websocket'], auth } = {}) {
  return new Promise((resolve) => {
    const extraHeaders = origin ? { origin } : {};
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports,
      autoConnect: true,
      reconnection: false,
      timeout: 2000,
      extraHeaders,
      auth: auth ?? { userId: 'attacker' },
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      resolve({ connected: false, error: 'timeout' });
    }, 3000);

    socket.on('connect', () => {
      clearTimeout(timer);
      const result = { connected: true, error: null, socket };
      resolve(result);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      resolve({ connected: false, error: err.message, socket: null });
    });
  });
}

describe('F156: WebSocket Origin Security (integration)', () => {
  let httpServer;
  let socketManager;
  let port;

  before(async () => {
    // Save and override env for deterministic CORS behavior
    delete process.env.CORS_ALLOW_PRIVATE_NETWORK;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_PORT;

    httpServer = createServer();
    socketManager = new SocketManager(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    socketManager?.close();
    await new Promise((resolve) => httpServer?.close(resolve));
  });

  it('AC-A1: rejects WebSocket-only connection from evil origin', async () => {
    const result = await attemptConnection(port, {
      origin: 'https://evil.example',
      transports: ['websocket'],
    });
    assert.strictEqual(result.connected, false, 'WebSocket connection from evil origin must be rejected');
  });

  it('AC-A1: rejects polling connection from evil origin', async () => {
    const result = await attemptConnection(port, {
      origin: 'https://evil.example',
      transports: ['polling'],
    });
    assert.strictEqual(result.connected, false, 'Polling connection from evil origin must be rejected');
  });

  it('AC-A2: allows connection from legitimate origin (localhost:3001)', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://localhost:3001',
      transports: ['websocket'],
    });
    assert.strictEqual(result.connected, true, 'WebSocket connection from localhost:3001 should succeed');
    result.socket?.disconnect();
  });

  it('AC-A2: allows connection from legitimate origin (localhost:3000)', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://localhost:3000',
      transports: ['websocket'],
    });
    assert.strictEqual(result.connected, true, 'WebSocket connection from localhost:3000 should succeed');
    result.socket?.disconnect();
  });

  it('AC-A4: rejects private network origin by default', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://192.168.1.200:8080',
      transports: ['websocket'],
    });
    assert.strictEqual(
      result.connected,
      false,
      'Private network origin should be rejected when CORS_ALLOW_PRIVATE_NETWORK is not set',
    );
  });

  it('AC-A3: server ignores client-supplied userId (verifies server-side rooms)', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://localhost:3001',
      transports: ['websocket'],
      auth: { userId: 'admin-impersonator' },
    });
    assert.strictEqual(result.connected, true, 'Connection should succeed from legitimate origin');

    // P2-fix: Actually verify server-side identity via fetchSockets()
    const io = socketManager.getIO();
    const sockets = await io.fetchSockets();
    const targetSocket = sockets.find((s) => s.id === result.socket.id);
    assert.ok(targetSocket, 'Should find the connected socket on server');
    assert.ok(targetSocket.rooms.has('user:default-user'), 'Socket must be in user:default-user room');
    assert.ok(!targetSocket.rooms.has('user:admin-impersonator'), 'Socket must NOT be in user:admin-impersonator room');

    result.socket?.disconnect();
  });

  it('P1-fix: allows connection from 127.0.0.1 (loopback is always local)', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://127.0.0.1:3001',
      transports: ['websocket'],
    });
    assert.strictEqual(result.connected, true, '127.0.0.1 loopback origin should always be allowed');
    result.socket?.disconnect();
  });

  it('P1-fix: allows connection from 127.0.0.1 on custom port', async () => {
    const result = await attemptConnection(port, {
      origin: 'http://127.0.0.1:5173',
      transports: ['websocket'],
    });
    assert.strictEqual(result.connected, true, '127.0.0.1 on any port should be allowed (loopback)');
    result.socket?.disconnect();
  });

  it('allows connection with no Origin header (non-browser client)', async () => {
    const result = await attemptConnection(port, {
      transports: ['websocket'],
    });
    assert.strictEqual(
      result.connected,
      true,
      'No-origin connections (curl, MCP) should be allowed in single-user mode',
    );
    result.socket?.disconnect();
  });
});

describe('F156: isOriginAllowed (unit)', () => {
  it('rejects unknown origins', () => {
    const origins = ['http://localhost:3001', 'https://cafe.clowder-ai.com'];
    assert.strictEqual(isOriginAllowed('https://evil.example', origins), false);
    assert.strictEqual(isOriginAllowed('http://attacker.com', origins), false);
  });

  it('accepts known string origins', () => {
    const origins = ['http://localhost:3001', 'https://cafe.clowder-ai.com'];
    assert.strictEqual(isOriginAllowed('http://localhost:3001', origins), true);
    assert.strictEqual(isOriginAllowed('https://cafe.clowder-ai.com', origins), true);
  });

  it('rejects private network origins when no regex in list', () => {
    const origins = ['http://localhost:3001'];
    assert.strictEqual(isOriginAllowed('http://192.168.1.100:3001', origins), false);
    assert.strictEqual(isOriginAllowed('http://10.0.0.1:8080', origins), false);
  });

  it('accepts private network origins when regex is present', () => {
    const privateRegex = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;
    const origins = ['http://localhost:3001', privateRegex];
    assert.strictEqual(isOriginAllowed('http://192.168.1.100:3001', origins), true);
    assert.strictEqual(isOriginAllowed('http://10.0.0.1:8080', origins), true);
  });

  it('rejects empty origin', () => {
    const origins = ['http://localhost:3001'];
    assert.strictEqual(isOriginAllowed('', origins), false);
  });
});
