/**
 * Commands API route tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { commandsRoutes } from '../dist/routes/commands.js';
import { MessageStore } from '../dist/domains/cats/services/MessageStore.js';
import { TaskStore } from '../dist/domains/cats/services/TaskStore.js';

// Mock opus service
const mockOpusService = {
  async *invoke() {
    yield { type: 'text', content: '[{"title": "Extracted task", "why": "From test", "sourceIndex": 0}]' };
    yield { type: 'done', catId: 'opus' };
  },
};

// Mock socket manager
const mockSocketManager = {
  broadcastToRoom: () => {},
};

describe('Commands Routes', () => {
  let app;
  let messageStore;
  let taskStore;

  beforeEach(async () => {
    app = Fastify();
    messageStore = new MessageStore();
    taskStore = new TaskStore();

    await app.register(commandsRoutes, {
      messageStore,
      taskStore,
      socketManager: mockSocketManager,
      opusService: mockOpusService,
    });
    await app.ready();
  });

  it('POST /api/commands/extract-tasks creates tasks', async () => {
    // Add some messages first
    await messageStore.append({
      content: 'TODO: write tests',
      userId: 'test-user',
      threadId: 'thread-1',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/commands/extract-tasks',
      payload: {
        threadId: 'thread-1',
        userId: 'test-user',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.count, 1);
    assert.equal(body.tasks[0].title, 'Extracted task');
  });

  it('POST /api/commands/extract-tasks returns 400 for missing threadId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands/extract-tasks',
      payload: { userId: 'test-user' },
    });

    assert.equal(res.statusCode, 400);
  });

  it('POST /api/commands/extract-tasks returns empty for no messages', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands/extract-tasks',
      payload: {
        threadId: 'empty-thread',
        userId: 'test-user',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.count, 0);
    assert.equal(body.degraded, false);
  });
});
