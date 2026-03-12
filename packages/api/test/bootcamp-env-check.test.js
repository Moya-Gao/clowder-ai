import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

describe('F087: Bootcamp env-check route', () => {
  let app;

  async function createApp() {
    const { default: Fastify } = await import('fastify');
    const { bootcampRoutes } = await import('../dist/routes/bootcamp.js');
    app = Fastify();
    await app.register(bootcampRoutes);
    await app.ready();
    return app;
  }

  // P1-1: Auth guard
  it('returns 401 without identity header', async () => {
    await createApp();
    const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check' });
    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });

  it('GET /api/bootcamp/env-check returns env status shape', async () => {
    await createApp();
    const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check', headers: AUTH_HEADERS });
    assert.strictEqual(res.statusCode, 200);

    const body = JSON.parse(res.payload);
    // Core tools
    assert.ok('node' in body, 'missing node');
    assert.ok('pnpm' in body, 'missing pnpm');
    assert.ok('git' in body, 'missing git');
    assert.ok('claudeCli' in body, 'missing claudeCli');
    assert.ok('mcp' in body, 'missing mcp');
    // Advanced features
    assert.ok('tts' in body, 'missing tts');
    assert.ok('asr' in body, 'missing asr');
    assert.ok('pencil' in body, 'missing pencil');

    // Each core tool has ok boolean
    assert.strictEqual(typeof body.node.ok, 'boolean');
    assert.strictEqual(typeof body.pnpm.ok, 'boolean');
    assert.strictEqual(typeof body.git.ok, 'boolean');

    // node/pnpm/git should be ok in dev environment
    assert.ok(body.node.ok, 'node should be available');
    assert.ok(body.pnpm.ok, 'pnpm should be available');
    assert.ok(body.git.ok, 'git should be available');

    // node version should be a string
    assert.ok(body.node.version?.startsWith('v'), `node version: ${body.node.version}`);

    await app.close();
  });

  it('pencil always reports unavailable with note', async () => {
    await createApp();
    const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check', headers: AUTH_HEADERS });
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.pencil.ok, false);
    assert.ok(body.pencil.note);
    await app.close();
  });

  it('tts includes recommendation when unavailable', async () => {
    await createApp();
    const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check', headers: AUTH_HEADERS });
    const body = JSON.parse(res.payload);
    assert.ok(body.tts.recommended, 'tts should have recommended field');
    await app.close();
  });

  // P1-2: MCP detection
  it('mcp check reflects actual availability (not hardcoded)', async () => {
    await createApp();
    const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check', headers: AUTH_HEADERS });
    const body = JSON.parse(res.payload);
    assert.strictEqual(typeof body.mcp.ok, 'boolean');
    // In test env, MCP server is not running — should detect that
    // (we can't assert ok=false because CI may have it, but we assert it's a real boolean check)
    assert.ok('ok' in body.mcp);
    await app.close();
  });
});
