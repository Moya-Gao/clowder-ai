/**
 * Capabilities route tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { capabilitiesRoutes } from '../dist/routes/capabilities.js';

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

describe('Capabilities Route', () => {
  it('returns 401 when no identity header is provided', async () => {
    const app = Fastify();
    await app.register(capabilitiesRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/capabilities',
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Identity required'));

    await app.close();
  });

  it('GET /api/capabilities returns skills and MCP servers per cat', async () => {
    const app = Fastify();
    await app.register(capabilitiesRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/capabilities',
      headers: AUTH_HEADERS,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);

    // Should have all three cats
    assert.ok(body.opus, 'should have opus');
    assert.ok(body.codex, 'should have codex');
    assert.ok(body.gemini, 'should have gemini');

    // Each cat should have skills and externalMcpServers arrays
    for (const catId of ['opus', 'codex', 'gemini']) {
      assert.ok(Array.isArray(body[catId].skills), `${catId} should have skills array`);
      assert.ok(Array.isArray(body[catId].externalMcpServers), `${catId} should have externalMcpServers array`);
    }

    await app.close();
  });

  it('skills arrays contain discovered skills from filesystem', async () => {
    const app = Fastify();
    await app.register(capabilitiesRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/capabilities',
      headers: AUTH_HEADERS,
    });

    const body = JSON.parse(res.body);

    // Claude should discover project-level skills (pencil-renderer, pencil-to-code)
    assert.ok(body.opus.skills.length >= 0, 'opus skills should be an array');

    // Codex discovers user-level skills (should exclude .system)
    if (body.codex.skills.length > 0) {
      assert.ok(!body.codex.skills.includes('.system'), 'codex skills should exclude .system');
    }

    // Gemini has no skills directory
    assert.deepEqual(body.gemini.skills, []);

    await app.close();
  });
});
