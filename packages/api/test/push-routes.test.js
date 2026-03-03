// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { pushRoutes } from '../dist/routes/push.js';
import { PushSubscriptionStore } from '../dist/domains/cats/services/stores/ports/PushSubscriptionStore.js';

describe('push routes', () => {
  /** @type {import('fastify').FastifyInstance} */
  let app;
  /** @type {import('../src/domains/cats/services/stores/ports/PushSubscriptionStore.js').PushSubscriptionStore} */
  let store;
  /** @type {Array<{type:string,data:Record<string, unknown>}>} */
  let auditEvents;

  beforeEach(async () => {
    store = new PushSubscriptionStore();
    auditEvents = [];
    const auditLog = {
      append: async (input) => {
        auditEvents.push({ type: input.type, data: input.data });
        return { id: 'audit-test-id' };
      },
    };
    app = Fastify();
    await app.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: null,
      vapidPublicKey: 'test-vapid-key-123',
      auditLog,
    });
    await app.ready();
  });

  it('GET /api/push/vapid-public-key returns key when pushService is configured', async () => {
    const appWithPush = Fastify();
    await appWithPush.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: /** @type {any} */ ({ notifyUser: () => {} }), // mock
      vapidPublicKey: 'test-vapid-key-123',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await appWithPush.ready();

    const res = await appWithPush.inject({
      method: 'GET',
      url: '/api/push/vapid-public-key',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.key, 'test-vapid-key-123');
    assert.equal(body.enabled, true);
  });

  it('GET /api/push/vapid-public-key returns null when no key', async () => {
    const app2 = Fastify();
    await app2.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: null,
      vapidPublicKey: '',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await app2.ready();

    const res = await app2.inject({
      method: 'GET',
      url: '/api/push/vapid-public-key',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.key, null);
    assert.equal(body.enabled, false);
  });

  it('GET /api/push/vapid-public-key returns disabled when pushService is null (partial config)', async () => {
    // Simulates: VAPID_PUBLIC_KEY set but VAPID_PRIVATE_KEY missing → pushService=null
    const app2 = Fastify();
    await app2.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: null,
      vapidPublicKey: 'partial-key-only',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await app2.ready();

    const res = await app2.inject({
      method: 'GET',
      url: '/api/push/vapid-public-key',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.key, null, 'should not expose key when push is not fully configured');
    assert.equal(body.enabled, false);
  });

  it('POST /api/push/subscribe requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: {
        subscription: {
          endpoint: 'https://push.example.com/sub/1',
          keys: { p256dh: 'key1', auth: 'auth1' },
        },
      },
    });
    assert.equal(res.statusCode, 401);
  });

  it('POST /api/push/subscribe stores subscription', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: { 'x-cat-cafe-user': 'owner' },
      payload: {
        subscription: {
          endpoint: 'https://push.example.com/sub/1',
          keys: { p256dh: 'key1', auth: 'auth1' },
        },
        userAgent: 'TestAgent',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
    assert.equal(store.listAll().length, 1);
    assert.equal(store.listAll()[0].userAgent, 'TestAgent');
  });

  it('POST /api/push/subscribe validates endpoint URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: { 'x-cat-cafe-user': 'owner' },
      payload: {
        subscription: {
          endpoint: 'not-a-url',
          keys: { p256dh: 'key1', auth: 'auth1' },
        },
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it('DELETE /api/push/subscribe removes own subscription', async () => {
    store.upsert({
      endpoint: 'https://push.example.com/sub/1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'owner',
      createdAt: Date.now(),
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/push/subscribe',
      headers: { 'x-cat-cafe-user': 'owner' },
      payload: { endpoint: 'https://push.example.com/sub/1' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.removed, true);
    assert.equal(store.listAll().length, 0);
  });

  it('DELETE /api/push/subscribe rejects when user does not own subscription', async () => {
    store.upsert({
      endpoint: 'https://push.example.com/sub/1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'owner',
      createdAt: Date.now(),
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/push/subscribe',
      headers: { 'x-cat-cafe-user': 'intruder' },
      payload: { endpoint: 'https://push.example.com/sub/1' },
    });
    assert.equal(res.statusCode, 404);
    assert.equal(store.listAll().length, 1, 'subscription should remain intact');
  });

  it('POST /api/push/test returns 503 when push not configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/test',
      headers: { 'x-cat-cafe-user': 'owner' },
    });
    assert.equal(res.statusCode, 503);
  });

  it('POST /api/push/test returns 409 when user has no active subscriptions', async () => {
    const notifyUser = () => {};
    const appWithPush = Fastify();
    await appWithPush.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: /** @type {any} */ ({ notifyUser }),
      vapidPublicKey: 'test-vapid-key-123',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await appWithPush.ready();

    const res = await appWithPush.inject({
      method: 'POST',
      url: '/api/push/test',
      headers: { 'x-cat-cafe-user': 'owner' },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.match(body.error, /No active push subscription/i);
    assert.equal(
      auditEvents.some((event) => event.type === 'push_test_result' && event.data.error === 'no_active_subscription'),
      true,
    );
  });

  it('POST /api/push/test sends when user has active subscriptions', async () => {
    store.upsert({
      endpoint: 'https://push.example.com/sub/1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'owner',
      createdAt: Date.now(),
    });

    let called = false;
    const notifyUser = async (userId, payload) => {
      called = true;
      assert.equal(userId, 'owner');
      assert.equal(payload.tag, 'push-test');
      assert.equal(payload.data?.forceSystemNotification, true);
      return { attempted: 1, delivered: 1, failed: 0, removed: 0 };
    };

    const appWithPush = Fastify();
    await appWithPush.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: /** @type {any} */ ({ notifyUser }),
      vapidPublicKey: 'test-vapid-key-123',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await appWithPush.ready();

    const res = await appWithPush.inject({
      method: 'POST',
      url: '/api/push/test',
      headers: { 'x-cat-cafe-user': 'owner' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(called, true);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /系统通知已请求发送/);
    assert.equal(body.delivery.delivered, 1);
    assert.equal(
      auditEvents.some((event) => event.type === 'push_test_result' && event.data.ok === true),
      true,
    );
  });

  it('POST /api/push/test returns 502 when push delivery fails', async () => {
    store.upsert({
      endpoint: 'https://push.example.com/sub/1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'owner',
      createdAt: Date.now(),
    });

    const notifyUser = async () => ({ attempted: 1, delivered: 0, failed: 1, removed: 0 });

    const appWithPush = Fastify();
    await appWithPush.register(pushRoutes, {
      pushSubscriptionStore: store,
      pushService: /** @type {any} */ ({ notifyUser }),
      vapidPublicKey: 'test-vapid-key-123',
      auditLog: {
        append: async (input) => {
          auditEvents.push({ type: input.type, data: input.data });
          return { id: 'audit-test-id' };
        },
      },
    });
    await appWithPush.ready();

    const res = await appWithPush.inject({
      method: 'POST',
      url: '/api/push/test',
      headers: { 'x-cat-cafe-user': 'owner' },
    });

    assert.equal(res.statusCode, 502);
    const body = JSON.parse(res.payload);
    assert.match(body.error, /投递失败|proxy|网络/i);
    assert.equal(body.delivery.delivered, 0);
    assert.equal(
      auditEvents.some((event) => event.type === 'push_test_result' && event.data.error === 'push_delivery_failed'),
      true,
    );
  });
});
