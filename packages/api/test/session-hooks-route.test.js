/**
 * Session Hooks Route Tests
 * F24 Session Blindness Fix: POST /api/sessions/seal, GET /api/sessions/latest-digest
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

/** Minimal mock TranscriptReader */
function mockTranscriptReader(digests = {}) {
  return {
    readDigest: async (sessionId) => digests[sessionId] ?? null,
    readEvents: async () => ({ events: [], hasMore: false }),
    search: async () => [],
  };
}

describe('Session Hooks Routes', () => {
  let SessionChainStore;
  let SessionSealer;
  let sessionHooksRoutes;

  const DEFAULT_HOOK_TOKEN = 'test-hook-token';

  async function setup({ digestMap, hookToken = DEFAULT_HOOK_TOKEN, noToken = false } = {}) {
    const storeMod = await import('../dist/domains/cats/services/SessionChainStore.js');
    const sealerMod = await import('../dist/domains/cats/services/SessionSealer.js');
    const routeMod = await import('../dist/routes/session-hooks.js');
    SessionChainStore = storeMod.SessionChainStore;
    SessionSealer = sealerMod.SessionSealer;
    sessionHooksRoutes = routeMod.sessionHooksRoutes;

    const sessionChainStore = new SessionChainStore();
    const sessionSealer = new SessionSealer(sessionChainStore);
    const transcriptReader = mockTranscriptReader(digestMap ?? {});

    const app = Fastify();
    await app.register(sessionHooksRoutes, {
      sessionChainStore,
      sessionSealer,
      transcriptReader,
      ...(noToken ? {} : { hookToken }),
    });
    await app.ready();
    return { app, sessionChainStore, sessionSealer, hookToken };
  }

  /** Helper: default auth headers for hook requests */
  function authHeaders(token = DEFAULT_HOOK_TOKEN) {
    return { 'x-cat-cafe-hook-token': token };
  }

  // --- POST /api/sessions/seal ---

  describe('POST /api/sessions/seal', () => {
    it('seals active session found by cliSessionId', async () => {
      const { app, sessionChainStore } = await setup();
      sessionChainStore.create({
        cliSessionId: 'cli-abc',
        threadId: 'thread-1',
        catId: 'opus',
        userId: 'user-1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: authHeaders(),
        payload: { cliSessionId: 'cli-abc', reason: 'claude-code-compact-auto' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.status, 'sealing');
      assert.equal(body.threadId, 'thread-1');
      assert.equal(body.catId, 'opus');
      assert.ok(body.sessionId);
    });

    it('returns 404 for unknown cliSessionId', async () => {
      const { app } = await setup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: authHeaders(),
        payload: { cliSessionId: 'unknown-cli', reason: 'test' },
      });

      assert.equal(res.statusCode, 404);
    });

    it('returns 409 for already sealed session', async () => {
      const { app, sessionChainStore } = await setup();
      const record = sessionChainStore.create({
        cliSessionId: 'cli-sealed',
        threadId: 'thread-1',
        catId: 'opus',
        userId: 'user-1',
      });
      // Manually seal it
      sessionChainStore.update(record.id, { status: 'sealed', sealedAt: Date.now() });

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: authHeaders(),
        payload: { cliSessionId: 'cli-sealed', reason: 'test' },
      });

      assert.equal(res.statusCode, 409);
    });

    it('returns 400 for missing cliSessionId', async () => {
      const { app } = await setup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: authHeaders(),
        payload: { reason: 'test' },
      });

      assert.equal(res.statusCode, 400);
    });

    it('returns 400 for missing reason', async () => {
      const { app } = await setup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: authHeaders(),
        payload: { cliSessionId: 'cli-abc' },
      });

      assert.equal(res.statusCode, 400);
    });
  });

  // --- GET /api/sessions/latest-digest ---

  describe('GET /api/sessions/latest-digest', () => {
    it('returns digest for latest sealed session', async () => {
      // We need to know the sessionId to set up the digest mock,
      // but sessionId is generated internally. So we create, seal, then
      // grab the id to set up a fresh app with the right mock.
      const storeMod = await import('../dist/domains/cats/services/SessionChainStore.js');
      const sealerMod = await import('../dist/domains/cats/services/SessionSealer.js');
      const routeMod = await import('../dist/routes/session-hooks.js');

      const sessionChainStore = new storeMod.SessionChainStore();
      const record = sessionChainStore.create({
        cliSessionId: 'cli-digest',
        threadId: 'thread-1',
        catId: 'opus',
        userId: 'user-1',
      });
      // Seal it
      sessionChainStore.update(record.id, {
        status: 'sealed',
        sealedAt: Date.now(),
      });

      const digestData = {
        timeRange: { createdAt: 1000, sealedAt: 2000, durationMs: 1000 },
        toolsUsed: ['Read', 'Bash'],
        filesTouched: [],
        errors: [],
      };

      const transcriptReader = mockTranscriptReader({ [record.id]: digestData });
      const sessionSealer = new sealerMod.SessionSealer(sessionChainStore);

      const app = Fastify();
      await app.register(routeMod.sessionHooksRoutes, {
        sessionChainStore,
        sessionSealer,
        transcriptReader,
        hookToken: DEFAULT_HOOK_TOKEN,
      });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/latest-digest?cliSessionId=cli-digest',
        headers: authHeaders(),
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.sessionId, record.id);
      assert.deepEqual(body.digest.toolsUsed, ['Read', 'Bash']);
    });

    it('returns 400 when cliSessionId is missing', async () => {
      const { app } = await setup();

      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/latest-digest',
        headers: authHeaders(),
      });

      assert.equal(res.statusCode, 400);
    });

    it('returns 404 for unknown cliSessionId', async () => {
      const { app } = await setup();

      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/latest-digest?cliSessionId=unknown',
        headers: authHeaders(),
      });

      assert.equal(res.statusCode, 404);
    });

    it('returns 404 when no sealed sessions exist', async () => {
      const { app, sessionChainStore } = await setup();
      // Create an active session (not sealed)
      sessionChainStore.create({
        cliSessionId: 'cli-active',
        threadId: 'thread-1',
        catId: 'opus',
        userId: 'user-1',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/latest-digest?cliSessionId=cli-active',
        headers: authHeaders(),
      });

      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.ok(body.error.includes('No sealed sessions'));
    });
  });

  // --- Hook Token Authentication ---

  describe('Hook token authentication', () => {
    it('returns 401 when hookToken is configured but request has no token', async () => {
      const { app } = await setup({ hookToken: 'secret-token-123' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        payload: { cliSessionId: 'cli-abc', reason: 'test' },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.ok(body.error.includes('hook token'));
    });

    it('returns 401 when hookToken is configured but request has wrong token', async () => {
      const { app } = await setup({ hookToken: 'secret-token-123' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: { 'x-cat-cafe-hook-token': 'wrong-token' },
        payload: { cliSessionId: 'cli-abc', reason: 'test' },
      });

      assert.equal(res.statusCode, 401);
    });

    it('allows request when hookToken matches', async () => {
      const { app, sessionChainStore } = await setup({ hookToken: 'secret-token-123' });
      sessionChainStore.create({
        cliSessionId: 'cli-auth',
        threadId: 'thread-1',
        catId: 'opus',
        userId: 'user-1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        headers: { 'x-cat-cafe-hook-token': 'secret-token-123' },
        payload: { cliSessionId: 'cli-auth', reason: 'test-auth' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.status, 'sealing');
    });

    it('returns 503 when hookToken is not configured (fail-closed)', async () => {
      const { app } = await setup({ noToken: true }); // explicitly no hookToken

      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/seal',
        payload: { cliSessionId: 'cli-noauth', reason: 'test' },
      });

      assert.equal(res.statusCode, 503);
      const body = JSON.parse(res.payload);
      assert.ok(body.error.includes('CAT_CAFE_HOOK_TOKEN'));
    });

    it('returns 401 for GET endpoint when token is missing', async () => {
      const { app } = await setup({ hookToken: 'secret-token-123' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/latest-digest?cliSessionId=cli-abc',
      });

      assert.equal(res.statusCode, 401);
    });
  });
});
