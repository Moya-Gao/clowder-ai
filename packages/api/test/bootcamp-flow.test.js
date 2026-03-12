/**
 * Bootcamp Flow Integration Test
 * Full happy path: create thread → advance through phases → complete
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import './helpers/setup-cat-registry.js';

describe('Bootcamp Flow Integration', () => {
  let registry;
  let threadStore;
  let messageStore;
  let socketManager;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/stores/ports/ThreadStore.js'
    );
    const { MessageStore } = await import(
      '../dist/domains/cats/services/stores/ports/MessageStore.js'
    );

    registry = new InvocationRegistry();
    threadStore = new ThreadStore();
    messageStore = new MessageStore();
    socketManager = {
      broadcastAgentMessage() {},
      getMessages() { return []; },
    };
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const { bootcampRoutes } = await import('../dist/routes/bootcamp.js');
    const { threadsRoutes } = await import('../dist/routes/threads.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      threadStore,
      sharedBank: 'cat-cafe-shared',
    });
    await app.register(bootcampRoutes);
    await app.register(threadsRoutes, { threadStore });
    return app;
  }

  test('full bootcamp lifecycle: create → select cat → env check → task → complete', async () => {
    const app = await createApp();

    // Step 1: Create thread with bootcamp state via threads API
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/threads',
      headers: { 'x-cat-cafe-user': 'user-1' },
      payload: {
        title: '🎓 猫猫训练营',
        bootcampState: {
          v: 1,
          phase: 'phase-0-select-cat',
          startedAt: 1000,
        },
      },
    });

    assert.equal(createRes.statusCode, 201);
    const thread = JSON.parse(createRes.body);
    assert.ok(thread.id);
    assert.equal(thread.bootcampState.phase, 'phase-0-select-cat');

    // Create invocation bound to the bootcamp thread
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', thread.id);

    // Step 2: Cat selects lead cat → advance to phase-1-intro
    const step2 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-1-intro',
        leadCat: 'opus',
      },
    });

    assert.equal(step2.statusCode, 200);
    const s2 = JSON.parse(step2.body);
    assert.equal(s2.bootcampState.phase, 'phase-1-intro');
    assert.equal(s2.bootcampState.leadCat, 'opus');

    // Step 3: Run env check → auto-stores results
    const step3 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/bootcamp-env-check',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
      },
    });

    assert.equal(step3.statusCode, 200);
    const envResults = JSON.parse(step3.body);
    assert.ok('node' in envResults);

    // Verify env check stored in bootcampState
    const afterEnv = await threadStore.get(thread.id);
    assert.ok(afterEnv.bootcampState.envCheck);

    // Step 4: Advance to task selection with advanced features
    const step4 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-4-task-select',
        advancedFeatures: { tts: 'skipped', asr: 'skipped', pencil: 'unavailable' },
      },
    });

    assert.equal(step4.statusCode, 200);
    const s4 = JSON.parse(step4.body);
    assert.equal(s4.bootcampState.phase, 'phase-4-task-select');
    assert.equal(s4.bootcampState.leadCat, 'opus'); // preserved from step 2
    assert.equal(s4.bootcampState.advancedFeatures.tts, 'skipped');

    // Step 5: Select task → advance to kickoff
    const step5 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-5-kickoff',
        selectedTaskId: 'Q3',
      },
    });

    assert.equal(step5.statusCode, 200);
    const s5 = JSON.parse(step5.body);
    assert.equal(s5.bootcampState.selectedTaskId, 'Q3');

    // Step 6: Complete bootcamp
    const completedAt = Date.now();
    const step6 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-11-farewell',
        completedAt,
      },
    });

    assert.equal(step6.statusCode, 200);
    const s6 = JSON.parse(step6.body);
    assert.equal(s6.bootcampState.phase, 'phase-11-farewell');
    assert.equal(s6.bootcampState.completedAt, completedAt);
    // All accumulated state should be present
    assert.equal(s6.bootcampState.leadCat, 'opus');
    assert.equal(s6.bootcampState.selectedTaskId, 'Q3');
    assert.equal(s6.bootcampState.startedAt, 1000);
    assert.ok(s6.bootcampState.envCheck);
    assert.equal(s6.bootcampState.advancedFeatures.tts, 'skipped');

    // Verify thread was auto-pinned on farewell
    const finalThread = await threadStore.get(thread.id);
    assert.equal(finalThread.pinned, true, 'Thread should be auto-pinned after farewell');
  });
});
