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

  it('toggles skill global enabled and persists', async () => {
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
          mcpServer: { command: 'node', args: ['server.js'] } },
        { id: 'cross-cat-handoff', type: 'skill', enabled: true, source: 'external' },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);
    const skill = config.capabilities.find((c) => c.type === 'skill' && c.id === 'cross-cat-handoff');
    assert.ok(skill);
    skill.enabled = false;
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    const updatedSkill = updated.capabilities.find((c) => c.id === 'cross-cat-handoff');
    assert.equal(updatedSkill?.enabled, false);
    assert.equal(updatedSkill?.type, 'skill');
  });

  it('adds per-cat override for skill', async () => {
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'spec-compliance-check', type: 'skill', enabled: true, source: 'external' },
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

  it('skill sync allows same-name MCP and skill to coexist', async () => {
    // Cloud P1→P2: same name, different types must coexist.
    // Sync checks type-scoped: c.type === 'skill' && c.id === skillName
    // PATCH disambiguates via id + type compound lookup.
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'filesystem', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'npx', args: ['@mcp/fs'] } },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);

    // Simulate the GET handler's skill sync logic (type-scoped check)
    const skillName = 'filesystem';
    const existsAsSkill = config.capabilities.some(
      (c) => c.type === 'skill' && c.id === skillName,
    );

    if (!existsAsSkill) {
      config.capabilities.push({
        id: skillName, type: 'skill', enabled: true, source: 'external',
      });
    }
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    // Both entries should exist: 1 MCP + 1 skill
    const mcpCount = updated.capabilities.filter((c) => c.id === 'filesystem' && c.type === 'mcp').length;
    const skillCount = updated.capabilities.filter((c) => c.id === 'filesystem' && c.type === 'skill').length;
    assert.equal(mcpCount, 1, 'Should have exactly one MCP entry');
    assert.equal(skillCount, 1, 'Should have exactly one skill entry');
  });

  it('PATCH targets correct entry when MCP and skill share a name', async () => {
    // Cloud P2 regression: PATCH by id-only hits the MCP entry when toggling skill
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'filesystem', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'npx', args: ['@mcp/fs'] } },
        { id: 'filesystem', type: 'skill', enabled: true, source: 'external' },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);

    // Simulate PATCH with compound lookup (id + type)
    const targetId = 'filesystem';
    const targetType = 'skill';
    const capIndex = config.capabilities.findIndex(
      (c) => c.id === targetId && c.type === targetType,
    );
    assert.ok(capIndex !== -1, 'Should find the skill entry');

    const cap = config.capabilities[capIndex];
    assert.equal(cap.type, 'skill', 'Compound lookup should target the skill, not the MCP');

    cap.enabled = false;
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    const mcp = updated.capabilities.find((c) => c.id === 'filesystem' && c.type === 'mcp');
    const skill = updated.capabilities.find((c) => c.id === 'filesystem' && c.type === 'skill');
    assert.equal(mcp?.enabled, true, 'MCP should remain enabled');
    assert.equal(skill?.enabled, false, 'Skill should be disabled by PATCH');
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

  it('skill cats are sparse — only includes cats whose provider has the skill', () => {
    // Cloud R4 P2: skill cats object must omit cats whose provider lacks the skill,
    // so the frontend cat filter (filterCat in item.cats) can narrow rows.
    const providerSkills = {
      claude: ['review-code', 'debug'],
      openai: ['review-code'],
      google: [],
    };
    const catProviderMap = {
      opus: 'claude',
      codex: 'openai',
      gemini: 'google',
    };
    const skillName = 'review-code';

    // Simulate the sparse cats logic from GET handler
    const cats = {};
    for (const [catId, provider] of Object.entries(catProviderMap)) {
      const present = (providerSkills[provider] ?? []).includes(skillName);
      if (!present) continue; // Sparse: omit irrelevant cats
      cats[catId] = true; // enabled state
    }

    // opus (claude) and codex (openai) have 'review-code', gemini (google) does not
    assert.equal('opus' in cats, true, 'opus should be in cats (claude has review-code)');
    assert.equal('codex' in cats, true, 'codex should be in cats (openai has review-code)');
    assert.equal('gemini' in cats, false, 'gemini should NOT be in cats (google lacks review-code)');

    // Frontend filter check: filterCat='gemini' → !(gemini in cats) → row hidden
    const filterCat = 'gemini';
    const filtered = !(filterCat in cats);
    assert.equal(filtered, true, 'Cat filter should hide skill for irrelevant cat');
  });

  it('prunes stale skills removed from filesystem', async () => {
    // Cloud R6 P2: skills deleted from disk must be removed from capabilities.json
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'mcp-tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] } },
        { id: 'old-skill', type: 'skill', enabled: true, source: 'external' },
        { id: 'current-skill', type: 'skill', enabled: true, source: 'external' },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);

    // Simulate: only 'current-skill' is discovered on filesystem
    const allSkillNames = new Set(['current-skill']);

    // Prune stale skills (same logic as GET handler)
    config.capabilities = config.capabilities.filter(
      (c) => c.type !== 'skill' || allSkillNames.has(c.id),
    );
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    assert.equal(updated.capabilities.length, 2, 'Should have MCP + current-skill only');
    assert.equal(
      updated.capabilities.some((c) => c.id === 'old-skill'),
      false,
      'Stale skill should be pruned',
    );
    assert.equal(
      updated.capabilities.some((c) => c.id === 'mcp-tool'),
      true,
      'MCP entries should not be pruned',
    );
  });

  it('skips prune when any scan failed (allScansOk=false)', async () => {
    // Cloud R8 P1: partial scan failure must block prune
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'mcp-tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] } },
        { id: 'saved-skill', type: 'skill', enabled: false, source: 'external',
          overrides: [{ catId: 'opus', enabled: true }] },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);

    // Simulate: one scan failed (null) → allScansOk = false
    const allScansOk = false;
    const allSkillNames = new Set(['other-skill']); // non-empty but incomplete

    if (allScansOk) {
      config.capabilities = config.capabilities.filter(
        (c) => c.type !== 'skill' || allSkillNames.has(c.id),
      );
    }
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    const skill = updated.capabilities.find((c) => c.id === 'saved-skill');
    assert.ok(skill, 'Skill must survive when allScansOk=false');
    assert.equal(skill.overrides?.[0]?.catId, 'opus', 'Saved overrides preserved');
  });

  it('prunes all stale skills when scans succeed and 0 skills discovered', async () => {
    // Cloud R9 P2-2: 0 skills + allScansOk = user deleted everything → prune
    await writeCapabilitiesConfig(dir, {
      version: 1,
      capabilities: [
        { id: 'mcp-tool', type: 'mcp', enabled: true, source: 'external',
          mcpServer: { command: 'echo', args: [] } },
        { id: 'stale-skill', type: 'skill', enabled: true, source: 'external' },
      ],
    });

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);

    const allScansOk = true;
    const allSkillNames = new Set(); // genuinely 0 skills

    if (allScansOk) {
      config.capabilities = config.capabilities.filter(
        (c) => c.type !== 'skill' || allSkillNames.has(c.id),
      );
    }
    await writeCapabilitiesConfig(dir, config);

    const updated = await readCapabilitiesConfig(dir);
    assert.ok(updated);
    assert.equal(updated.capabilities.length, 1, 'Only MCP should remain');
    assert.equal(updated.capabilities[0]?.id, 'mcp-tool');
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
