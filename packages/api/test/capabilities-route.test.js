// @ts-check
/**
 * Capabilities Route Tests — F041 统一能力看板 API
 *
 * Tests the GET and PATCH /api/capabilities endpoints.
 * Uses Fastify injection + tmp directories for isolation.
 */
import './helpers/setup-cat-registry.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  writeCapabilitiesConfig,
  readCapabilitiesConfig,
} from '../dist/config/capabilities/capability-orchestrator.js';

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

/** @param {string} prefix */
async function makeTmpDir(prefix) {
  const dir = join(tmpdir(), `cap-route-test-${prefix}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

// ────────── PATCH logic (unit-level, no Fastify needed) ──────────

describe('PATCH capabilities logic', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('patch'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('toggles global enabled and persists', async () => {
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
          mcpServer: { command: 'node', args: ['server.js'] } },
        { id: 'external-tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] } },
      ],
    });

    // Read, mutate, write (simulating PATCH scope=global)
    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);
    const cap = config.capabilities.find((c) => c.id === 'external-tool');
    assert.ok(cap);
    cap.enabled = false;
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    assert.equal(updated.capabilities.find((c) => c.id === 'external-tool')?.enabled, false);
  });

  it('adds per-cat override', async () => {
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] } },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);
    const cap = config.capabilities[0];
    assert.ok(cap);
    cap.overrides = [{ catId: 'codex', enabled: false }];
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    assert.equal(updated.capabilities[0]?.overrides?.[0]?.catId, 'codex');
    assert.equal(updated.capabilities[0]?.overrides?.[0]?.enabled, false);
  });

  it('removes no-op override that matches global', async () => {
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] },
          overrides: [{ catId: 'opus', enabled: false }] },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);
    const cap = config.capabilities[0];
    assert.ok(cap);

    // Set override to match global (true) — should be cleaned up
    if (cap.overrides) {
      const ov = cap.overrides.find((o) => o.catId === 'opus');
      if (ov) ov.enabled = true;
      // Cleanup: remove override if matches global
      cap.overrides = cap.overrides.filter((o) => o.enabled !== cap.enabled);
      if (cap.overrides.length === 0) delete cap.overrides;
    }
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    assert.equal(updated.capabilities[0]?.overrides, undefined);
  });
});

// ────────── Resolve per-cat with overrides ──────────

describe('resolveServersForCat with overrides', () => {
  it('override disabled wins over global enabled', async () => {
    const { resolveServersForCat } = await import(
      '../dist/config/capabilities/capability-orchestrator.js'
    );

    /** @type {any} */
    const config = {
      version: 1,
      capabilities: [
        { id: 'tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] },
          overrides: [{ catId: 'codex', enabled: false }] },
      ],
    };

    const codex = resolveServersForCat(config, 'codex');
    assert.equal(codex[0].enabled, false);

    const opus = resolveServersForCat(config, 'opus');
    assert.equal(opus[0].enabled, true);
  });

  it('override enabled wins over global disabled', async () => {
    const { resolveServersForCat } = await import(
      '../dist/config/capabilities/capability-orchestrator.js'
    );

    /** @type {any} */
    const config = {
      version: 1,
      capabilities: [
        { id: 'tool', type: 'mcp', enabled: false, source: 'external',
          mcpServer: { command: 'echo', args: [] },
          overrides: [{ catId: 'opus', enabled: true }] },
      ],
    };

    const opus = resolveServersForCat(config, 'opus');
    assert.equal(opus[0].enabled, true);

    const codex = resolveServersForCat(config, 'codex');
    assert.equal(codex[0].enabled, false);
  });
});

// ────────── Fastify route-level tests ──────────

describe('GET /api/capabilities (Fastify)', () => {
  it('returns 401 when no identity header', async () => {
    const Fastify = (await import('fastify')).default;
    const { capabilitiesRoutes } = await import('../dist/routes/capabilities.js');

    const app = Fastify();
    await app.register(capabilitiesRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/capabilities' });
    assert.equal(res.statusCode, 401);
    assert.ok(res.json().error.includes('Identity required'));

    await app.close();
  });

  it('returns array of CapabilityBoardItem', async () => {
    const Fastify = (await import('fastify')).default;
    const { capabilitiesRoutes } = await import('../dist/routes/capabilities.js');

    const app = Fastify();
    await app.register(capabilitiesRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/capabilities',
      headers: AUTH_HEADERS,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();

    // New format: array of CapabilityBoardItem
    assert.ok(Array.isArray(body), 'response should be an array');

    // Each item should have required fields
    for (const item of body) {
      assert.ok(item.id, 'item should have id');
      assert.ok(['mcp', 'skill'].includes(item.type), 'type should be mcp or skill');
      assert.ok(['cat-cafe', 'external'].includes(item.source), 'source should be cat-cafe or external');
      assert.equal(typeof item.enabled, 'boolean', 'enabled should be boolean');
      assert.ok(typeof item.cats === 'object', 'cats should be an object');
    }

    await app.close();
  });
});
