/**
 * Config Hot-Reload Tests (F4)
 * PATCH /api/config — hot-update configuration
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { configRoutes } from '../dist/routes/config.js';
import { configStore } from '../dist/config/ConfigStore.js';

describe('PATCH /api/config (F4 hot-reload)', () => {
  let app;

  afterEach(async () => {
    configStore.reset();
    if (app) await app.close();
  });

  async function setup() {
    app = Fastify();
    await app.register(configRoutes);
    await app.ready();
    return app;
  }

  it('sets an updatable key and returns updated config', async () => {
    const app = await setup();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { key: 'cli.timeoutMs', value: 60000 },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.config);
    assert.equal(body.config.cli.timeoutMs, 60000);
  });

  it('verifies PATCH value is reflected in GET', async () => {
    const app = await setup();

    await app.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { key: 'a2a.maxDepth', value: '5' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/config',
    });
    const body = res.json();
    assert.equal(body.config.a2a.maxDepth, 5);
  });

  it('rejects non-updatable key with 400', async () => {
    const app = await setup();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { key: 'server.port', value: 9999 },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.ok(body.error.includes('not hot-updatable'));
  });

  it('rejects missing key with 400', async () => {
    const app = await setup();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { value: 123 },
    });
    assert.equal(res.statusCode, 400);
  });

  it('rejects missing value with 400', async () => {
    const app = await setup();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/config',
      payload: { key: 'cli.timeoutMs' },
    });
    assert.equal(res.statusCode, 400);
  });
});
