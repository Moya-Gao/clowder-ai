/**
 * F156 Phase D-2: Anti-Clickjacking Security Headers
 *
 * Verifies that API responses include:
 * - X-Frame-Options: DENY
 * - Content-Security-Policy with frame-ancestors 'none'
 *
 * preview-gateway is exempt (it needs iframe embedding).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';

const { securityHeadersPlugin } = await import('../../dist/infrastructure/security-headers.js');

describe('F156 D-2: Security Headers', () => {
  let app;

  before(async () => {
    app = Fastify();
    await app.register(securityHeadersPlugin);
    app.get('/api/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
  });

  it('sets X-Frame-Options: DENY on API responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    assert.equal(res.headers['x-frame-options'], 'DENY');
  });

  it('sets CSP frame-ancestors none on API responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    const csp = res.headers['content-security-policy'];
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.includes("frame-ancestors 'none'"), `CSP must include frame-ancestors 'none', got: ${csp}`);
  });

  it('sets headers on non-API routes too (health)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['content-security-policy']?.includes("frame-ancestors 'none'"));
  });

  it('does not break response body', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    assert.equal(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
  });
});
