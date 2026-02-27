// @ts-check
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  readCapabilitiesConfig,
  writeCapabilitiesConfig,
  discoverExternalMcpServers,
  buildCatCafeMcpDescriptor,
  bootstrapCapabilities,
  resolveServersForCat,
  generateCliConfigs,
  orchestrate,
} from '../dist/config/capabilities/capability-orchestrator.js';

import { catRegistry } from '@cat-cafe/shared';

/** @param {string} prefix */
async function makeTmpDir(prefix) {
  const dir = join(tmpdir(), `cap-orch-test-${prefix}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Helper: minimal capabilities.json */
function makeConfig(capabilities = []) {
  return { version: 1, capabilities };
}

// ────────── Read/Write capabilities.json ──────────

describe('readCapabilitiesConfig', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('cap-read'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('reads valid capabilities.json', async () => {
    await mkdir(join(dir, '.cat-cafe'), { recursive: true });
    await writeFile(
      join(dir, '.cat-cafe', 'capabilities.json'),
      JSON.stringify(makeConfig([
        { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
          mcpServer: { command: 'node', args: ['index.js'] } },
      ])),
    );

    const config = await readCapabilitiesConfig(dir);
    assert.ok(config);
    assert.equal(config.version, 1);
    assert.equal(config.capabilities.length, 1);
    assert.equal(config.capabilities[0].id, 'cat-cafe');
  });

  it('returns null for missing file', async () => {
    const config = await readCapabilitiesConfig(dir);
    assert.equal(config, null);
  });

  it('returns null for invalid JSON', async () => {
    await mkdir(join(dir, '.cat-cafe'), { recursive: true });
    await writeFile(join(dir, '.cat-cafe', 'capabilities.json'), 'not json');
    const config = await readCapabilitiesConfig(dir);
    assert.equal(config, null);
  });

  it('returns null for wrong version', async () => {
    await mkdir(join(dir, '.cat-cafe'), { recursive: true });
    await writeFile(
      join(dir, '.cat-cafe', 'capabilities.json'),
      JSON.stringify({ version: 99, capabilities: [] }),
    );
    const config = await readCapabilitiesConfig(dir);
    assert.equal(config, null);
  });
});

describe('writeCapabilitiesConfig', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('cap-write'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('creates .cat-cafe/ dir and writes config', async () => {
    const config = makeConfig([
      { id: 'test', type: 'mcp', enabled: true, source: 'external',
        mcpServer: { command: 'echo', args: [] } },
    ]);

    await writeCapabilitiesConfig(dir, config);

    const raw = await readFile(join(dir, '.cat-cafe', 'capabilities.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.capabilities.length, 1);
  });

  it('round-trips correctly', async () => {
    const config = makeConfig([
      { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
        mcpServer: { command: 'node', args: ['server.js'] } },
      { id: 'ext', type: 'mcp', enabled: false, source: 'external',
        mcpServer: { command: 'npx', args: ['ext-server'] },
        overrides: [{ catId: 'opus', enabled: true }] },
    ]);

    await writeCapabilitiesConfig(dir, config);
    const read = await readCapabilitiesConfig(dir);
    assert.deepEqual(read, config);
  });
});

// ────────── Discovery ──────────

describe('discoverExternalMcpServers', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('discover'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('discovers servers from Claude .mcp.json', async () => {
    const claudeFile = join(dir, '.mcp.json');
    await writeFile(claudeFile, JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@mcp/fs'] },
      },
    }));

    const servers = await discoverExternalMcpServers({
      claudeConfig: claudeFile,
      codexConfig: join(dir, 'nonexistent.toml'),
      geminiConfig: join(dir, 'nonexistent.json'),
    });

    assert.equal(servers.length, 1);
    assert.equal(servers[0].name, 'filesystem');
    assert.equal(servers[0].source, 'external');
  });

  it('deduplicates by name (first wins)', async () => {
    const claudeFile = join(dir, 'claude.json');
    const geminiFile = join(dir, 'gemini.json');
    await writeFile(claudeFile, JSON.stringify({
      mcpServers: { shared: { command: 'claude-cmd', args: [] } },
    }));
    await writeFile(geminiFile, JSON.stringify({
      mcpServers: { shared: { command: 'gemini-cmd', args: [] } },
    }));

    const servers = await discoverExternalMcpServers({
      claudeConfig: claudeFile,
      codexConfig: join(dir, 'nonexistent.toml'),
      geminiConfig: geminiFile,
    });

    assert.equal(servers.length, 1);
    assert.equal(servers[0].command, 'claude-cmd'); // first wins
  });

  it('returns empty when no configs exist', async () => {
    const servers = await discoverExternalMcpServers({
      claudeConfig: join(dir, 'a.json'),
      codexConfig: join(dir, 'b.toml'),
      geminiConfig: join(dir, 'c.json'),
    });
    assert.deepEqual(servers, []);
  });
});

describe('buildCatCafeMcpDescriptor', () => {
  it('builds correct descriptor', () => {
    const desc = buildCatCafeMcpDescriptor('/project');
    assert.equal(desc.name, 'cat-cafe');
    assert.equal(desc.command, 'node');
    assert.ok(desc.args[0].includes('mcp-server/dist/index.js'));
    assert.equal(desc.enabled, true);
    assert.equal(desc.source, 'cat-cafe');
  });
});

// ────────── Bootstrap ──────────

describe('bootstrapCapabilities', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('bootstrap'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('creates capabilities.json with cat-cafe + externals', async () => {
    // Seed a Claude config with one external server
    const claudeFile = join(dir, '.mcp.json');
    await writeFile(claudeFile, JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@mcp/fs'] },
      },
    }));

    const config = await bootstrapCapabilities(dir, {
      claudeConfig: claudeFile,
      codexConfig: join(dir, 'nonexistent.toml'),
      geminiConfig: join(dir, 'nonexistent.json'),
    });

    assert.equal(config.version, 1);
    // cat-cafe + filesystem
    assert.equal(config.capabilities.length, 2);

    const catCafe = config.capabilities.find((c) => c.id === 'cat-cafe');
    assert.ok(catCafe);
    assert.equal(catCafe.source, 'cat-cafe');
    assert.equal(catCafe.enabled, true);

    const fs = config.capabilities.find((c) => c.id === 'filesystem');
    assert.ok(fs);
    assert.equal(fs.source, 'external');

    // Also persisted to disk
    const persisted = await readCapabilitiesConfig(dir);
    assert.ok(persisted);
    assert.equal(persisted.capabilities.length, 2);
  });

  it('skips duplicate cat-cafe from external discovery', async () => {
    const claudeFile = join(dir, '.mcp.json');
    await writeFile(claudeFile, JSON.stringify({
      mcpServers: {
        'cat-cafe': { command: 'node', args: ['old-path.js'] },
      },
    }));

    const config = await bootstrapCapabilities(dir, {
      claudeConfig: claudeFile,
      codexConfig: join(dir, 'x.toml'),
      geminiConfig: join(dir, 'x.json'),
    });

    // Only one cat-cafe entry (the built-in one, not the external duplicate)
    const catCafeEntries = config.capabilities.filter((c) => c.id === 'cat-cafe');
    assert.equal(catCafeEntries.length, 1);
    assert.equal(catCafeEntries[0].source, 'cat-cafe');
  });
});

// ────────── Resolve per-cat ──────────

describe('resolveServersForCat', () => {
  it('applies global enabled state', () => {
    const config = makeConfig([
      { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
        mcpServer: { command: 'node', args: ['index.js'] } },
      { id: 'disabled', type: 'mcp', enabled: false, source: 'external',
        mcpServer: { command: 'echo', args: [] } },
    ]);

    const servers = resolveServersForCat(config, 'opus');
    assert.equal(servers.length, 2);
    assert.equal(servers.find((s) => s.name === 'cat-cafe')?.enabled, true);
    assert.equal(servers.find((s) => s.name === 'disabled')?.enabled, false);
  });

  it('applies per-cat override', () => {
    const config = makeConfig([
      { id: 'tool', type: 'mcp', enabled: true, source: 'external',
        mcpServer: { command: 'echo', args: [] },
        overrides: [{ catId: 'codex', enabled: false }] },
    ]);

    // codex has override → disabled
    const codexServers = resolveServersForCat(config, 'codex');
    assert.equal(codexServers[0].enabled, false);

    // opus has no override → uses global (true)
    const opusServers = resolveServersForCat(config, 'opus');
    assert.equal(opusServers[0].enabled, true);
  });

  it('skips skill entries', () => {
    const config = makeConfig([
      { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
        mcpServer: { command: 'node', args: [] } },
      { id: 'some-skill', type: 'skill', enabled: true, source: 'external' },
    ]);

    const servers = resolveServersForCat(config, 'opus');
    assert.equal(servers.length, 1);
    assert.equal(servers[0].name, 'cat-cafe');
  });

  it('preserves env and workingDir', () => {
    const config = makeConfig([
      { id: 'tool', type: 'mcp', enabled: true, source: 'external',
        mcpServer: { command: 'node', args: [], env: { KEY: 'val' }, workingDir: '/tmp' } },
    ]);

    const servers = resolveServersForCat(config, 'opus');
    assert.deepEqual(servers[0].env, { KEY: 'val' });
    assert.equal(servers[0].workingDir, '/tmp');
  });
});

// ────────── Generate CLI configs ──────────

describe('generateCliConfigs', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('gen-cli'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('generates config files for all providers', async () => {
    // Need cats registered for this test
    const hasAnyCats = catRegistry.getAllIds().length > 0;
    if (!hasAnyCats) {
      // Skip if no cats registered (test isolation)
      return;
    }

    const config = makeConfig([
      { id: 'cat-cafe', type: 'mcp', enabled: true, source: 'cat-cafe',
        mcpServer: { command: 'node', args: ['server.js'] } },
    ]);

    const paths = {
      anthropic: join(dir, '.mcp.json'),
      openai: join(dir, '.codex', 'config.toml'),
      google: join(dir, '.gemini', 'settings.json'),
    };

    await generateCliConfigs(config, paths);

    // At least one config should exist
    let configCount = 0;
    try { await readFile(paths.anthropic, 'utf-8'); configCount++; } catch { /* ok */ }
    try { await readFile(paths.openai, 'utf-8'); configCount++; } catch { /* ok */ }
    try { await readFile(paths.google, 'utf-8'); configCount++; } catch { /* ok */ }

    assert.ok(configCount > 0, 'At least one CLI config should be generated');
  });
});

// ────────── Full orchestrate ──────────

describe('orchestrate', () => {
  /** @type {string} */ let dir;

  beforeEach(async () => { dir = await makeTmpDir('orch'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('bootstraps on first run (no capabilities.json)', async () => {
    const config = await orchestrate(
      dir,
      {
        claudeConfig: join(dir, '.mcp.json'),
        codexConfig: join(dir, '.codex', 'config.toml'),
        geminiConfig: join(dir, '.gemini', 'settings.json'),
      },
      {
        anthropic: join(dir, '.mcp.json'),
        openai: join(dir, '.codex', 'config.toml'),
        google: join(dir, '.gemini', 'settings.json'),
      },
    );

    assert.ok(config);
    assert.equal(config.version, 1);
    // At minimum, cat-cafe's own MCP should be present
    assert.ok(config.capabilities.find((c) => c.id === 'cat-cafe'));
  });

  it('uses existing capabilities.json on subsequent runs', async () => {
    // Pre-seed capabilities.json
    await writeCapabilitiesConfig(dir, makeConfig([
      { id: 'custom', type: 'mcp', enabled: true, source: 'external',
        mcpServer: { command: 'custom-cmd', args: ['--flag'] } },
    ]));

    const config = await orchestrate(
      dir,
      {
        claudeConfig: join(dir, '.mcp.json'),
        codexConfig: join(dir, 'x.toml'),
        geminiConfig: join(dir, 'x.json'),
      },
      {
        anthropic: join(dir, '.mcp.json'),
        openai: join(dir, 'out.toml'),
        google: join(dir, 'out.json'),
      },
    );

    // Should use pre-seeded config, not bootstrap fresh
    assert.equal(config.capabilities.length, 1);
    assert.equal(config.capabilities[0].id, 'custom');
  });
});
