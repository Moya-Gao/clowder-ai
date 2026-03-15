import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';
import { PortDiscoveryService } from '../../../dist/domains/preview/port-discovery.js';
import { previewRoutes } from '../../../dist/routes/preview.js';

describe('preview routes', () => {
  const app = Fastify();
  const portDiscovery = new PortDiscoveryService();

  before(async () => {
    await app.register(previewRoutes, { portDiscovery, gatewayPort: 4100 });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('GET /api/preview/status returns gateway info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/preview/status' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.available, true);
    assert.equal(body.gatewayPort, 4100);
  });

  it('POST /api/preview/validate-port allows valid port', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/validate-port',
      payload: { port: 5173 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, true);
  });

  it('POST /api/preview/validate-port rejects excluded port', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/validate-port',
      payload: { port: 6399 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, false);
    assert.ok(body.reason);
  });

  it('POST /api/preview/validate-port rejects non-loopback host', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/validate-port',
      payload: { port: 5173, host: '10.0.0.1' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, false);
  });

  it('GET /api/preview/discovered returns empty initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/preview/discovered' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, []);
  });

  it('GET /api/preview/discovered filters by worktreeId', async () => {
    // Feed some data first
    await portDiscovery.feedStdout('test-wt', 'pane-1', 'http://localhost:59990');
    const res = await app.inject({
      method: 'GET',
      url: '/api/preview/discovered?worktreeId=test-wt',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.length, 1);
    assert.equal(body[0].port, 59990);
  });

  // P1-3: Audit endpoints for open/close/navigate
  it('POST /api/preview/open records audit event and returns gateway URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/open',
      payload: { port: 5173, threadId: 'test-thread' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, true);
    assert.ok(body.gatewayUrl);
  });

  it('POST /api/preview/close records audit event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/close',
      payload: { port: 5173, threadId: 'test-thread' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
  });

  it('POST /api/preview/navigate records audit event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/navigate',
      payload: { port: 5173, url: '/dashboard', threadId: 'test-thread' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
  });
});

// F120 Phase C: auto-open tests (need socketEmit)
describe('POST /api/preview/auto-open', () => {
  let app2;
  const emitted = [];

  before(async () => {
    app2 = Fastify();
    await app2.register(previewRoutes, {
      portDiscovery: new PortDiscoveryService(),
      gatewayPort: 4100,
      socketEmit: (event, data) => emitted.push({ event, data }),
    });
    await app2.ready();
  });

  after(async () => {
    await app2.close();
  });

  it('emits preview:auto-open socket event with port and path', async () => {
    emitted.length = 0;
    const res = await app2.inject({
      method: 'POST',
      url: '/api/preview/auto-open',
      payload: { port: 5173, path: '/dashboard' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, true);
    assert.equal(body.port, 5173);
    assert.equal(body.path, '/dashboard');
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].event, 'preview:auto-open');
    assert.equal(emitted[0].data.port, 5173);
    assert.equal(emitted[0].data.path, '/dashboard');
  });

  it('rejects excluded port (6399)', async () => {
    emitted.length = 0;
    const res = await app2.inject({
      method: 'POST',
      url: '/api/preview/auto-open',
      payload: { port: 6399 },
    });
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, false);
    assert.equal(emitted.length, 0); // no socket emit for rejected port
  });

  it('includes worktreeId in emitted event for scope filtering', async () => {
    emitted.length = 0;
    const res = await app2.inject({
      method: 'POST',
      url: '/api/preview/auto-open',
      payload: { port: 5173, path: '/settings', worktreeId: 'wt-abc' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(emitted[0].data.worktreeId, 'wt-abc');
    assert.equal(emitted[0].data.path, '/settings');
  });

  it('works without path (port-only)', async () => {
    emitted.length = 0;
    const res = await app2.inject({
      method: 'POST',
      url: '/api/preview/auto-open',
      payload: { port: 3847 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, true);
    assert.equal(body.port, 3847);
    assert.equal(emitted[0].data.path, undefined);
  });
});
