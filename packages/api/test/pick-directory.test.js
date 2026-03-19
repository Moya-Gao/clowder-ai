import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';

let setPickDirectoryImpl;
let projectsRoutes;

// Load module once
const mod = await import('../dist/routes/projects.js');
setPickDirectoryImpl = mod.setPickDirectoryImpl;
projectsRoutes = mod.projectsRoutes;

// Restore real impl after each test
const realImpl = mod.execPickDirectory;
afterEach(() => setPickDirectoryImpl(realImpl));

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

async function buildApp() {
  const app = Fastify();
  await app.register(projectsRoutes);
  await app.ready();
  return app;
}

describe('execPickDirectory()', () => {
  it('is exported as a function', () => {
    assert.equal(typeof mod.execPickDirectory, 'function');
  });
});

describe('POST /api/projects/pick-directory', () => {
  it('returns 401 when only a spoofed userId query param is provided', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory?userId=spoofed' });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Identity required'));
  });

  it('returns 204 when user cancels', async () => {
    setPickDirectoryImpl(async () => ({ status: 'cancelled' }));
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 204);
  });

  it('returns 500 on system error', async () => {
    setPickDirectoryImpl(async () => ({ status: 'error', message: 'osascript not found' }));
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'osascript not found');
  });

  it('returns path and name when user picks valid directory', async () => {
    const home = homedir();
    setPickDirectoryImpl(async () => ({ status: 'picked', path: home }));
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.path, home);
    assert.equal(typeof body.name, 'string');
  });

  it('returns 403 for path outside allowed roots', async () => {
    setPickDirectoryImpl(async () => ({ status: 'picked', path: '/nonexistent/evil/path' }));
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
  });

  it('GET returns 404 (only POST registered)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/projects/pick-directory' });
    assert.equal(res.statusCode, 404);
  });

  it('F113: default impl returns error (osascript removed)', async () => {
    // Don't mock — test the real (deprecated) implementation
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects/pick-directory', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('browse'));
  });
});

describe('GET /api/projects/browse (F113 cross-platform)', () => {
  it('returns 401 when only a spoofed userId query param is provided', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/projects/browse?userId=spoofed' });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Identity required'));
  });

  it('returns home directory listing by default', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/projects/browse', headers: AUTH_HEADERS });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.current, homedir());
    assert.equal(typeof body.name, 'string');
    assert.ok(Array.isArray(body.entries));
    // Home directory should have subdirectories
    assert.ok(body.entries.length > 0);
    // All entries should be directories
    for (const entry of body.entries) {
      assert.equal(entry.isDirectory, true);
      assert.equal(typeof entry.name, 'string');
      assert.equal(typeof entry.path, 'string');
    }
  });

  it('returns parent path for navigation', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/browse?path=${encodeURIComponent(homedir())}`,
      headers: AUTH_HEADERS,
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    // Home should have a parent (e.g., /Users on macOS, /home on Linux)
    // parent can be null if at root of allowed roots, which is also valid
    assert.ok(body.parent === null || typeof body.parent === 'string');
  });

  it('returns 403 for path outside allowed roots', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/browse?path=/nonexistent/evil',
      headers: AUTH_HEADERS,
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
  });

  it('filters out hidden directories and node_modules', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/browse?path=${encodeURIComponent(homedir())}`,
      headers: AUTH_HEADERS,
    });
    const body = JSON.parse(res.body);
    for (const entry of body.entries) {
      assert.ok(!entry.name.startsWith('.'), `should hide: ${entry.name}`);
      assert.notEqual(entry.name, 'node_modules');
    }
  });
});
