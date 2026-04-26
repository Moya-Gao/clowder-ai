/**
 * F174 Phase D1 — `/api/debug/callback-auth` endpoint (AC-D3).
 *
 * Session-cookie-only owner gate — cloud Codex P1 (20:30Z) proved that
 * header-based paths (including Origin-gated ones) are spoofable by
 * same-origin browser GETs (which omit Origin). The only trustworthy
 * identity source for a sensitive debug endpoint is the session cookie.
 *
 * Tests use a preHandler to set `request.sessionUserId` from a test-only
 * header, mirroring what the real session plugin would do after validating
 * the signed cookie.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';
import './helpers/setup-cat-registry.js';

/**
 * Build a Fastify app with the debug route + a test session shim.
 * Send `x-test-session-user: <userId>` header to simulate an authenticated
 * session cookie. Real requests would use the `sessionAuthPlugin`; we skip
 * that to avoid pulling the whole cookie stack into unit tests.
 */
async function buildApp() {
  const { registerCallbackAuthDebugRoute } = await import('../dist/routes/callback-auth-debug.js');
  const app = Fastify();
  app.addHook('preHandler', async (request) => {
    const v = request.headers['x-test-session-user'];
    const raw = Array.isArray(v) ? v[0] : v;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      request.sessionUserId = raw.trim();
    }
  });
  registerCallbackAuthDebugRoute(app);
  await app.ready();
  return app;
}

describe('GET /api/debug/callback-auth — session-only (F174-D1)', () => {
  let app;
  let resetCallbackAuthFailureForTest;
  let recordCallbackAuthFailure;

  beforeEach(async () => {
    const mod = await import('../dist/routes/callback-auth-telemetry.js');
    resetCallbackAuthFailureForTest = mod.resetCallbackAuthFailureForTest;
    recordCallbackAuthFailure = mod.recordCallbackAuthFailure;
    resetCallbackAuthFailureForTest();
    app = await buildApp();
    // Owner gate now requires explicit DEFAULT_OWNER_USER_ID — set to match session user
    process.env.DEFAULT_OWNER_USER_ID = 'default-user';
  });

  test('returns 200 snapshot shape when session is present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/callback-auth',
      headers: { 'x-test-session-user': 'default-user' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(Object.keys(body.reasonCounts).sort(), [
      'agent_key_expired',
      'agent_key_revoked',
      'agent_key_scope_mismatch',
      'agent_key_unknown',
      'expired',
      'invalid_token',
      'missing_creds',
      'stale_invocation',
      'unknown_invocation',
    ]);
    assert.equal(typeof body.totalFailures, 'number');
    assert.equal(typeof body.uptimeMs, 'number');
    assert.ok(Array.isArray(body.recentSamples));
    assert.ok(typeof body.toolCounts === 'object' && body.toolCounts !== null);
  });

  test('reflects recorded failures live', async () => {
    recordCallbackAuthFailure({ reason: 'expired', tool: 'refresh-token', catId: 'opus' });
    recordCallbackAuthFailure({ reason: 'stale_invocation', tool: 'post-message', catId: 'codex' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/callback-auth',
      headers: { 'x-test-session-user': 'default-user' },
    });
    const body = JSON.parse(res.body);
    assert.equal(body.totalFailures, 2);
    assert.equal(body.reasonCounts.expired, 1);
    assert.equal(body.reasonCounts.stale_invocation, 1);
    assert.equal(body.toolCounts['refresh-token'], 1);
    assert.equal(body.toolCounts['post-message'], 1);
  });
});

describe('GET /api/debug/callback-auth — auth rejections (F174-D1)', () => {
  let app;

  beforeEach(async () => {
    const mod = await import('../dist/routes/callback-auth-telemetry.js');
    mod.resetCallbackAuthFailureForTest();
    app = await buildApp();
  });

  test('rejects 401 when no session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/debug/callback-auth' });
    assert.equal(res.statusCode, 401);
    assert.match(JSON.parse(res.body).error, /session/i);
  });

  // Cloud Codex P1 (PR #1377, 20:30Z): same-origin GET can omit Origin header,
  // so "no Origin = non-browser" assumption fails. Any compromised/injected
  // browser JS could then send X-Cat-Cafe-User and pass the gate. Header path
  // must be removed entirely; session cookie is the only trust anchor.
  test('rejects X-Cat-Cafe-User header even with no Origin (P1 #1377, 20:30Z)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/callback-auth',
      headers: { 'x-cat-cafe-user': 'default-user' }, // no session, spoofable
    });
    assert.equal(res.statusCode, 401, 'header-only identity must be rejected — session cookie required');
  });

  test('rejects X-Cat-Cafe-User header even with Origin set', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/callback-auth',
      headers: {
        origin: 'http://localhost:3000',
        'x-cat-cafe-user': 'default-user',
      },
    });
    assert.equal(res.statusCode, 401);
  });

  // Cloud Codex P1 (PR #1377, 21:00Z): /api/session mints sessions for
  // anonymous callers, so "has session" alone is not authorization — an
  // anonymous attacker can create a session and read telemetry. Require
  // session user to match the configured owner.
  test('rejects 403 when session user is not the configured owner (P1 #1377, 21:00Z)', async () => {
    process.env.DEFAULT_OWNER_USER_ID = 'alice';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/callback-auth',
        headers: { 'x-test-session-user': 'default-user' }, // session mints default-user
      });
      assert.equal(res.statusCode, 403, 'non-owner session must NOT bypass ownership gate');
      assert.match(JSON.parse(res.body).error, /owner/i);
    } finally {
      delete process.env.DEFAULT_OWNER_USER_ID;
    }
  });

  // Cloud Codex P1 (PR #1377, 21:13Z): defaulting expected owner to
  // 'default-user' = silent public exposure (anyone can mint /api/session
  // session as 'default-user'). Endpoint must fail-closed when env unset.
  test('rejects 403 when DEFAULT_OWNER_USER_ID not configured (fail-closed P1 21:13Z)', async () => {
    delete process.env.DEFAULT_OWNER_USER_ID;
    const res = await app.inject({
      method: 'GET',
      url: '/api/debug/callback-auth',
      headers: { 'x-test-session-user': 'default-user' },
    });
    assert.equal(res.statusCode, 403, 'must fail-closed when owner not explicitly configured');
    assert.match(JSON.parse(res.body).error, /DEFAULT_OWNER_USER_ID/);
  });

  test('accepts owner session when DEFAULT_OWNER_USER_ID explicitly set to default-user', async () => {
    process.env.DEFAULT_OWNER_USER_ID = 'default-user';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/callback-auth',
        headers: { 'x-test-session-user': 'default-user' },
      });
      assert.equal(res.statusCode, 200, 'explicit opt-in to default-user owner allows access');
    } finally {
      delete process.env.DEFAULT_OWNER_USER_ID;
    }
  });
});
