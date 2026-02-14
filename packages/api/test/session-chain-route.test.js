/**
 * Session Chain Route Tests
 * F24: GET /api/threads/:threadId/sessions, GET /api/sessions/:sessionId
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

describe('Session Chain Routes', () => {
  let app;
  let SessionChainStore;
  let sessionChainRoutes;

  async function setup() {
    const storeMod = await import('../dist/domains/cats/services/SessionChainStore.js');
    const routeMod = await import('../dist/routes/session-chain.js');
    SessionChainStore = storeMod.SessionChainStore;
    sessionChainRoutes = routeMod.sessionChainRoutes;

    const store = new SessionChainStore();
    app = Fastify();
    await app.register(sessionChainRoutes, { sessionChainStore: store });
    await app.ready();
    return store;
  }

  it('GET /api/threads/:threadId/sessions returns empty array for unknown thread', async () => {
    await setup();
    const res = await app.inject({
      method: 'GET',
      url: '/api/threads/unknown-thread/sessions',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.deepEqual(body.sessions, []);
  });

  it('GET /api/threads/:threadId/sessions returns all sessions', async () => {
    const store = await setup();
    store.create({ cliSessionId: 'cli-1', threadId: 'thread-1', catId: 'opus', userId: 'user-1' });
    store.create({ cliSessionId: 'cli-2', threadId: 'thread-1', catId: 'codex', userId: 'user-1' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/sessions',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.sessions.length, 2);
  });

  it('GET /api/threads/:threadId/sessions?catId=opus filters by cat', async () => {
    const store = await setup();
    store.create({ cliSessionId: 'cli-1', threadId: 'thread-1', catId: 'opus', userId: 'user-1' });
    store.create({ cliSessionId: 'cli-2', threadId: 'thread-1', catId: 'codex', userId: 'user-1' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/sessions?catId=opus',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.sessions.length, 1);
    assert.equal(body.sessions[0].catId, 'opus');
  });

  it('GET /api/sessions/:sessionId returns session record', async () => {
    const store = await setup();
    const record = store.create({ cliSessionId: 'cli-1', threadId: 'thread-1', catId: 'opus', userId: 'user-1' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${record.id}`,
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.id, record.id);
    assert.equal(body.catId, 'opus');
    assert.equal(body.status, 'active');
  });

  it('GET /api/sessions/:sessionId returns 404 for unknown session', async () => {
    await setup();
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/non-existent-id',
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.payload);
    assert.ok(body.error);
  });

  it('sessions include contextHealth when set', async () => {
    const store = await setup();
    const record = store.create({ cliSessionId: 'cli-1', threadId: 'thread-1', catId: 'opus', userId: 'user-1' });
    store.update(record.id, {
      contextHealth: {
        usedTokens: 50000,
        windowTokens: 200000,
        fillRatio: 0.25,
        source: 'exact',
        measuredAt: Date.now(),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${record.id}`,
    });
    const body = JSON.parse(res.payload);
    assert.ok(body.contextHealth);
    assert.equal(body.contextHealth.fillRatio, 0.25);
    assert.equal(body.contextHealth.source, 'exact');
  });
});
