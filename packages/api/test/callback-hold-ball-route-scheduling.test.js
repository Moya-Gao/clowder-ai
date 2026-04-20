/**
 * F167 C1 — hold-ball callback route scheduling + error-path tests
 *
 * Sibling to `callback-hold-ball-route.test.js` (auth + 400 body validation).
 * Split per PR #1290 cloud review P2 (file-size guidance: ≤200 lines per file).
 *
 * Scope: the side-effect half of /api/callbacks/hold-ball contract —
 *   - 200 on valid request → scheduler + dynamicTaskStore side effects fired
 *   - 429 on maxHoldsPerWindow exhaustion (counter guard)
 *   - 500 when reminder template is missing
 *
 * Counter state lives in a module-local Map, so each test uses a distinct
 * (threadId, catId) pair to avoid cross-test contamination.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';

describe('F167 C1: /api/callbacks/hold-ball scheduling + errors', () => {
  let registry;
  let threadStore;

  function makeStubDeps(overrides = {}) {
    const insertedTasks = [];
    const registeredDynamic = [];
    const defaultTemplate = {
      createSpec(taskId, taskParams) {
        return { taskId, taskParams };
      },
    };
    const deps = {
      registry,
      taskRunner: {
        registerDynamic(spec, taskId) {
          registeredDynamic.push({ spec, taskId });
        },
      },
      templateRegistry: {
        get(id) {
          return id === 'reminder' ? defaultTemplate : undefined;
        },
      },
      dynamicTaskStore: {
        insert(record) {
          insertedTasks.push(record);
        },
      },
      _insertedTasks: insertedTasks,
      _registeredDynamic: registeredDynamic,
    };
    return { ...deps, ...overrides };
  }

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    registry = new InvocationRegistry();
    threadStore = new ThreadStore();
  });

  async function createApp(holdBallDeps) {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore: {
        async getMessagesForThread() {
          return [];
        },
      },
      socketManager: {
        broadcastAgentMessage() {},
        getMessages() {
          return [];
        },
      },
      threadStore,
      evidenceStore: {
        async store() {},
        async search() {
          return [];
        },
      },
      markerQueue: { enqueue() {} },
      reflectionService: { async run() {} },
      holdBallDeps,
    });
    return app;
  }

  test('200 on valid request — schedules task + increments counter', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-200', 'hb200');
    const { invocationId, callbackToken } = registry.create('user-hb-200', 'codex', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'CI still running', nextStep: 'check build status', wakeAfterMs: 60_000 },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.held, true);
    assert.ok(typeof body.taskId === 'string' && body.taskId.startsWith('hold-ball-'));
    assert.equal(body.holdsInWindow, 1);
    assert.equal(body.maxHoldsPerWindow, 3);
    assert.equal(body.windowMs, 3_600_000);
    assert.ok(typeof body.wakeAt === 'string' && !Number.isNaN(Date.parse(body.wakeAt)));

    assert.equal(deps._insertedTasks.length, 1, 'dynamicTaskStore.insert called once');
    assert.equal(deps._registeredDynamic.length, 1, 'taskRunner.registerDynamic called once');
    const [task] = deps._insertedTasks;
    assert.equal(task.templateId, 'reminder');
    assert.equal(task.trigger.type, 'once');
    assert.equal(task.deliveryThreadId, thread.id);
    assert.equal(task.params.targetCatId, 'codex');
    assert.equal(task.params.triggerUserId, 'user-hb-200');
    assert.match(task.params.message, /持球唤醒/);
    assert.match(task.params.message, /CI still running/);
    assert.match(task.params.message, /check build status/);
    assert.equal(task.createdBy, 'hold-ball:codex');
  });

  test('429 after maxHoldsPerWindow (3) exhaustion — counter guard', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-429', 'hb429');
    const { invocationId, callbackToken } = registry.create('user-hb-429', 'codex', thread.id);
    const headers = { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken };
    const payload = { reason: 'waiting', nextStep: 'continue', wakeAfterMs: 10_000 };

    for (let i = 1; i <= 3; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/callbacks/hold-ball', headers, payload });
      assert.equal(r.statusCode, 200, `hold #${i} should succeed`);
      assert.equal(JSON.parse(r.body).holdsInWindow, i);
    }

    const r4 = await app.inject({ method: 'POST', url: '/api/callbacks/hold-ball', headers, payload });
    assert.equal(r4.statusCode, 429);
    const body = JSON.parse(r4.body);
    assert.match(body.error, /maxHoldsPerWindow/);
    assert.match(body.error, /pass the ball now/);
    assert.equal(body.maxHoldsPerWindow, 3);
    assert.equal(body.holdsInWindow, 3);
    assert.equal(body.windowMs, 3_600_000);
    assert.equal(deps._insertedTasks.length, 3, 'blocked hold must NOT schedule a new task');
  });

  test('500 when reminder template is missing', async () => {
    const deps = makeStubDeps({
      templateRegistry: { get: () => undefined },
    });
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-500', 'hb500');
    const { invocationId, callbackToken } = registry.create('user-hb-500', 'codex', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'x', nextStep: 'y', wakeAfterMs: 10_000 },
    });

    assert.equal(response.statusCode, 500);
    assert.match(JSON.parse(response.body).error, /reminder template/);
    assert.equal(deps._insertedTasks.length, 0);
  });
});
