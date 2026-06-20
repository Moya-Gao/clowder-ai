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

  test('INV-G2: gate-keeping thread + long SLA → 400 gate_keeping_thread_default_blocked', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-g2', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-g2', 'opus', thread.id);

    // PR-O3: use long SLA (> 10 min) to trigger block. Short SLAs are now allowed.
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'waiting external author', nextStep: 'check reply', wakeAfterMs: 1_800_000 },
    });

    assert.equal(response.statusCode, 400, 'gate-keeping thread must block long-SLA hold_ball');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(body.tool, 'hold_ball');
    assert.equal(body.threadKind, 'gate-keeping');

    // 关键：guard 在 task insert 之前 short-circuit
    assert.equal(deps._insertedTasks.length, 0, 'hold task must NOT be scheduled when guard blocks');
  });

  test("INV-G3': override claim ignored, guard still hard-blocks long-SLA hold_ball (R1 review fix)", async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-g3', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-g3', 'opus', thread.id);

    // PR-O3: use long SLA so override is truly the variable under test.
    // With short SLA, the hold would be allowed by policy (not by override).
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        reason: 'waiting CI on downstream PR I own',
        nextStep: 'verify merge',
        wakeAfterMs: 1_800_000,
        override: 'i-am-the-downstream-owner',
      },
    });

    assert.equal(response.statusCode, 400, 'override claim must NOT escape — gate-keeping is hard-block');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(deps._insertedTasks.length, 0, 'hold task must NOT be scheduled');
  });

  // ── PR-O3: structured allow for short-SLA holds ─────────────────

  test('PR-O3: gate-keeping + short SLA (2 min) → 200 allowed', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-o3a', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-o3a', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'checking 👀 reaction', nextStep: 'verify cloud accepted', wakeAfterMs: 120_000 },
    });

    assert.equal(response.statusCode, 200, 'short-SLA hold must be allowed in gate-keeping thread');
    assert.equal(deps._insertedTasks.length, 1, 'hold task must be scheduled');
  });

  test('PR-O3: gate-keeping + long SLA (30 min) → 400 blocked', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-o3b', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-o3b', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'waiting for external author response', nextStep: 'check reply', wakeAfterMs: 1_800_000 },
    });

    assert.equal(response.statusCode, 400, 'long-SLA hold must be blocked in gate-keeping thread');
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'gate_keeping_thread_default_blocked');
    assert.equal(deps._insertedTasks.length, 0, 'hold task must NOT be scheduled');
  });

  test('PR-O3: gate-keeping + exactly 10 min SLA → 200 allowed (boundary)', async () => {
    const deps = makeStubDeps();
    const app = await createApp(deps);
    const thread = await threadStore.create('user-hb-o3c', 'repo-inbox');
    await threadStore.updateThreadKind(thread.id, 'gate-keeping');
    const { invocationId, callbackToken } = await registry.create('user-hb-o3c', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/hold-ball',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: { reason: 'operational check', nextStep: 'verify result', wakeAfterMs: 600_000 },
    });

    assert.equal(response.statusCode, 200, 'hold at exactly 10 min must be allowed');
    assert.equal(deps._insertedTasks.length, 1, 'hold task must be scheduled');
  });
});
