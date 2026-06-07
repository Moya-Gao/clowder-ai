import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';

import { EventMemoryStore } from '../dist/domains/memory/EventMemoryStore.js';
import { eventsRoutes } from '../dist/routes/events.js';

/**
 * F227 PR-1 Task 3 — GET /api/memory/events route.
 * End-to-end: fastify inject → real EventMemoryStore(:memory:) → JSON.
 */

function baseRecord(overrides = {}) {
  return {
    type: 'scaffold',
    trigger: 'human_brake',
    cat: 'cat-opus',
    threadId: 'thread_a',
    messageId: 'msg_1',
    timestamp: 1000,
    summary: '脚手架',
    cognitiveTransition: 'user_brake',
    relatedHarness: null,
    confidence: 'high',
    ...overrides,
  };
}

describe('GET /api/memory/events (F227 PR-1)', () => {
  let app;
  let store;

  beforeEach(async () => {
    store = new EventMemoryStore(':memory:');
    await store.initialize();
    app = Fastify();
    app.addHook('onRequest', async (req) => {
      req.sessionUserId = 'test-user'; // F227: simulate an authenticated Hub session
    });
    await app.register(eventsRoutes, { eventMemoryStore: store });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns all events newest-first with meta', async () => {
    store.markEvent(baseRecord({ timestamp: 100, messageId: 'm1' }));
    store.markEvent(baseRecord({ timestamp: 200, messageId: 'm2' }));

    const res = await app.inject({ method: 'GET', url: '/api/memory/events' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.events.length, 2);
    assert.equal(body.events[0].timestamp, 200);
    assert.equal(body.meta.count, 2);
    assert.equal(body.meta.limit, null);
    assert.equal(body.meta.offset, 0);
  });

  it('filters by trigger query param', async () => {
    store.markEvent(baseRecord({ trigger: 'human_brake', messageId: 'm1' }));
    store.markEvent(baseRecord({ trigger: 'cat_brake', messageId: 'm2' }));

    const res = await app.inject({ method: 'GET', url: '/api/memory/events?trigger=human_brake' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].trigger, 'human_brake');
  });

  it('filters by threadId + cat (AND)', async () => {
    store.markEvent(baseRecord({ cat: 'cat-opus', threadId: 'thread_a', messageId: 'm1' }));
    store.markEvent(baseRecord({ cat: 'cat-codex', threadId: 'thread_a', messageId: 'm2' }));
    store.markEvent(baseRecord({ cat: 'cat-opus', threadId: 'thread_b', messageId: 'm3' }));

    const res = await app.inject({ method: 'GET', url: '/api/memory/events?cat=cat-opus&threadId=thread_a' });
    const body = res.json();
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].messageId, 'm1');
  });

  it('coerces limit/offset from query strings (paging)', async () => {
    for (let i = 1; i <= 5; i++) {
      store.markEvent(baseRecord({ timestamp: i * 100, messageId: `m${i}` }));
    }

    const res = await app.inject({ method: 'GET', url: '/api/memory/events?limit=2&offset=2' });
    const body = res.json();
    assert.equal(body.events.length, 2);
    assert.equal(body.events[0].timestamp, 300);
    assert.equal(body.meta.limit, 2);
    assert.equal(body.meta.offset, 2);
  });

  it('filters by time window since/until', async () => {
    store.markEvent(baseRecord({ timestamp: 100, messageId: 'm1' }));
    store.markEvent(baseRecord({ timestamp: 200, messageId: 'm2' }));
    store.markEvent(baseRecord({ timestamp: 300, messageId: 'm3' }));

    const res = await app.inject({ method: 'GET', url: '/api/memory/events?since=150&until=250' });
    const body = res.json();
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].timestamp, 200);
  });

  it('rejects an invalid trigger enum with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/events?trigger=bogus' });
    assert.equal(res.statusCode, 400);
  });

  it('rejects limit over the 200 cap with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/events?limit=999' });
    assert.equal(res.statusCode, 400);
  });

  it('returns empty list (not error) when no events match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/events?threadId=thread_none' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.events, []);
    assert.equal(body.meta.count, 0);
  });
});

describe('POST /api/memory/teleport (F227 PR-1)', () => {
  let app;
  /** @type {Array<{ event: string; data: { threadId: string; messageId: string; eventId: string }; room: string }>} */
  let emitted;

  beforeEach(async () => {
    emitted = [];
    const store = new EventMemoryStore(':memory:');
    await store.initialize();
    app = Fastify();
    app.addHook('onRequest', async (req) => {
      req.sessionUserId = 'test-user'; // F227: simulate an authenticated Hub session
    });
    await app.register(eventsRoutes, {
      eventMemoryStore: store,
      socketEmit: (event, data, room) => {
        emitted.push({ event, data, room });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('emits thread:teleport on workspace:global with threadId+messageId+eventId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory/teleport',
      payload: { threadId: 'thread_a', messageId: 'm1' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].event, 'thread:teleport');
    assert.equal(emitted[0].room, 'workspace:global');
    assert.equal(emitted[0].data.threadId, 'thread_a');
    assert.equal(emitted[0].data.messageId, 'm1');
    assert.ok(emitted[0].data.eventId, 'dedup eventId present');
  });

  it('rejects missing messageId with 400 and emits nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory/teleport',
      payload: { threadId: 'thread_a' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(emitted.length, 0);
  });

  it('rejects missing threadId with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory/teleport',
      payload: { messageId: 'm1' },
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('Event Memory routes — auth gate (F227 砚砚 P1)', () => {
  let app;
  let emitted;

  beforeEach(async () => {
    emitted = [];
    const store = new EventMemoryStore(':memory:');
    await store.initialize();
    // No onRequest hook → no sessionUserId, no callbackPrincipal → unauthenticated.
    app = Fastify();
    await app.register(eventsRoutes, {
      eventMemoryStore: store,
      socketEmit: (event, data, room) => emitted.push({ event, data, room }),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated GET /api/memory/events with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memory/events' });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'auth required');
  });

  it('rejects unauthenticated POST /api/memory/teleport with 401 and does NOT broadcast', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory/teleport',
      payload: { threadId: 'thread_a', messageId: 'm1' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(emitted.length, 0); // must not broadcast thread:teleport when unauthenticated
  });

  // 砚砚 R2 P1: exercise the REAL MCP callback path (registerCallbackAuthHook
  // verifies headers), not a manually-stubbed request.callbackPrincipal.
  const fakeCallbackRegistry = {
    verify: async (invocationId, token) =>
      token === 'good-token'
        ? { ok: true, record: { invocationId, threadId: 't', userId: 'u', catId: 'opus' } }
        : { ok: false, reason: 'invalid_token' },
  };

  it('allows GET via the real MCP callback path (verified X-Invocation-Id/X-Callback-Token)', async () => {
    const store = new EventMemoryStore(':memory:');
    await store.initialize();
    const cbApp = Fastify();
    await cbApp.register(eventsRoutes, {
      eventMemoryStore: store,
      socketEmit: () => {},
      callbackRegistry: fakeCallbackRegistry,
    });
    await cbApp.ready();
    const res = await cbApp.inject({
      method: 'GET',
      url: '/api/memory/events',
      headers: { 'x-invocation-id': 'inv-1', 'x-callback-token': 'good-token' },
    });
    assert.equal(res.statusCode, 200);
    await cbApp.close();
  });

  it('rejects GET with an invalid callback token (real registry.verify path)', async () => {
    const store = new EventMemoryStore(':memory:');
    await store.initialize();
    const cbApp = Fastify();
    await cbApp.register(eventsRoutes, {
      eventMemoryStore: store,
      socketEmit: () => {},
      callbackRegistry: fakeCallbackRegistry,
    });
    await cbApp.ready();
    const res = await cbApp.inject({
      method: 'GET',
      url: '/api/memory/events',
      headers: { 'x-invocation-id': 'inv-1', 'x-callback-token': 'bad-token' },
    });
    assert.equal(res.statusCode, 401); // registerCallbackAuthHook rejects before the route runs
    await cbApp.close();
  });

  it('allows POST teleport via the real MCP callback path and broadcasts', async () => {
    const store = new EventMemoryStore(':memory:');
    await store.initialize();
    let emittedCount = 0;
    const cbApp = Fastify();
    await cbApp.register(eventsRoutes, {
      eventMemoryStore: store,
      socketEmit: () => {
        emittedCount += 1;
      },
      callbackRegistry: fakeCallbackRegistry,
    });
    await cbApp.ready();
    const res = await cbApp.inject({
      method: 'POST',
      url: '/api/memory/teleport',
      headers: { 'x-invocation-id': 'inv-1', 'x-callback-token': 'good-token' },
      payload: { threadId: 'thread_a', messageId: 'm1' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(emittedCount, 1);
    await cbApp.close();
  });
});
