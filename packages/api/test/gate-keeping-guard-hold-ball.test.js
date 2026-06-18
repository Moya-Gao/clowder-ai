/**
 * F167 gate-keeping thread guard — hold_ball endpoint.
 *
 * 守门 thread default-block hold_ball——已 cross_post / propose 分发后不再
 * 替下游 hold（opensource-ops SKILL Common Mistakes #8）。
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';

describe('F167 gate-keeping guard: POST /api/callbacks/hold-ball', () => {
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
        unregister() {},
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
        remove() {},
        getAll() {
          return [];
        },
      },
      messageStore: {
        async append(msg) {
          return { id: 'msg-1', timestamp: Date.now(), ...msg };
        },
      },
      socketManager: {
        broadcastToRoom() {},
      },
      threadStore,
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

  test('INV-G4: non-gate-keeping thread → 200 (regression cover)', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-g4', 'normal-thread');
    const { invocationId, callbackToken } = await registry.create('user-hb-g4', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'waiting CI', nextStep: 'verify merge', wakeAfterMs: 60_000 },
    });

    assert.equal(response.statusCode, 200, 'normal thread hold_ball must succeed');
    assert.equal(deps._insertedTasks.length, 1, 'hold task must be scheduled');
  });

  test('INV-G2: gate-keeping thread + no override → 400 gate_keeping_thread_default_blocked', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-g2', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-g2', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'waiting external author', nextStep: 'check reply', wakeAfterMs: 60_000 },
    });

    assert.equal(response.statusCode, 400, 'gate-keeping thread must default-block hold_ball');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(body.tool, 'hold_ball');
    assert.equal(body.threadKind, 'gate-keeping');
    assert.match(body.remediation, /override|分发|下游/);

    // 关键：guard 在 task insert 之前 short-circuit
    assert.equal(deps._insertedTasks.length, 0, 'hold task must NOT be scheduled when guard blocks');
  });

  test("INV-G3': override claim ignored, guard still hard-blocks hold_ball (R1 review fix)", async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-g3', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-g3', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        reason: 'waiting CI on downstream PR I own',
        nextStep: 'verify merge',
        wakeAfterMs: 60_000,
        override: 'i-am-the-downstream-owner',
      },
    });

    assert.equal(response.statusCode, 400, 'override claim must NOT escape — gate-keeping is hard-block');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(deps._insertedTasks.length, 0, 'hold task must NOT be scheduled');
  });
});
