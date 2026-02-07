/**
 * Memory API route tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { memoryRoutes } from '../dist/routes/memory.js';
import { MemoryStore } from '../dist/domains/cats/services/MemoryStore.js';

describe('Memory API Routes', () => {
  let app;
  let memoryStore;

  beforeEach(async () => {
    app = Fastify();
    memoryStore = new MemoryStore();
    await app.register(memoryRoutes, { memoryStore });
    await app.ready();
  });

  it('POST /api/memory creates entry and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: {
        threadId: 'thread-1',
        key: 'project-goal',
        value: 'Build a collaborative AI system',
        updatedBy: 'user',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.key, 'project-goal');
    assert.equal(body.value, 'Build a collaborative AI system');
    assert.equal(body.threadId, 'thread-1');
    assert.equal(body.updatedBy, 'user');
    assert.ok(body.updatedAt);
  });

  it('POST /api/memory with cat updatedBy works', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: {
        threadId: 'thread-1',
        key: 'decision',
        value: 'Use CLI subprocess approach',
        updatedBy: 'opus',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    // Note: createCatId wraps the string, but JSON serialization shows the underlying value
    assert.ok(body.updatedBy.includes('opus') || body.updatedBy === 'opus');
  });

  it('POST /api/memory returns 400 for missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: { threadId: 'thread-1' },
    });

    assert.equal(res.statusCode, 400);
  });

  it('GET /api/memory?threadId=&key= returns single entry', async () => {
    // First create an entry
    await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: { threadId: 'thread-1', key: 'goal', value: 'Test', updatedBy: 'user' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/memory?threadId=thread-1&key=goal',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.key, 'goal');
    assert.equal(body.value, 'Test');
  });

  it('GET /api/memory?threadId=&key= returns 404 for unknown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/memory?threadId=thread-1&key=unknown',
    });

    assert.equal(res.statusCode, 404);
  });

  it('GET /api/memory?threadId= lists all entries', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: { threadId: 'thread-1', key: 'a', value: '1', updatedBy: 'user' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: { threadId: 'thread-1', key: 'b', value: '2', updatedBy: 'user' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/memory?threadId=thread-1',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.entries.length, 2);
  });

  it('DELETE /api/memory removes entry', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/memory',
      payload: { threadId: 'thread-1', key: 'temp', value: 'x', updatedBy: 'user' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/memory?threadId=thread-1&key=temp',
    });

    assert.equal(res.statusCode, 204);

    // Verify deleted
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/memory?threadId=thread-1&key=temp',
    });
    assert.equal(getRes.statusCode, 404);
  });

  it('DELETE /api/memory returns 404 for unknown', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/memory?threadId=thread-1&key=unknown',
    });

    assert.equal(res.statusCode, 404);
  });
});
