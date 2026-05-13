import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import { readAuditLog } from '../../../dist/config/capabilities/capability-audit.js';
import {
  readCapabilitiesConfig,
  writeCapabilitiesConfig,
} from '../../../dist/config/capabilities/capability-orchestrator.js';
import { capabilitiesMcpWriteRoutes } from '../../../dist/routes/capabilities-mcp-write.js';

const OWNER_HEADERS = { 'x-cat-cafe-user': 'lysander' };
const NON_OWNER_HEADERS = { 'x-cat-cafe-user': 'codex' };

const savedEnv = new Map();

function setEnv(key, value) {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv() {
  for (const [key, value] of savedEnv.entries()) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
}

function getCliConfigPaths(projectRoot) {
  return {
    anthropic: join(projectRoot, '.mcp.json'),
    openai: join(projectRoot, '.codex', 'config.toml'),
    google: join(projectRoot, '.gemini', 'settings.json'),
    kimi: join(projectRoot, '.kimi', 'mcp.json'),
  };
}

async function buildApp(projectRoot) {
  const app = Fastify({ logger: false });
  await app.register(capabilitiesMcpWriteRoutes, {
    getProjectRoot: () => projectRoot,
    getCliConfigPaths,
  });
  await app.ready();
  return app;
}

describe('capabilities MCP write routes', () => {
  let projectRoot;
  let app;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'cap-mcp-write-'));
    await mkdir(join(projectRoot, '.cat-cafe'), { recursive: true });
    await writeCapabilitiesConfig(projectRoot, { version: 1, capabilities: [] });
    setEnv('DEFAULT_OWNER_USER_ID', undefined);
    app = await buildApp(projectRoot);
  });

  afterEach(async () => {
    await app?.close();
    await rm(projectRoot, { recursive: true, force: true });
    restoreEnv();
  });

  it('rejects non-owner install writes when DEFAULT_OWNER_USER_ID is configured', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');

    const res = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: NON_OWNER_HEADERS,
      payload: {
        id: 'external-mcp',
        resolver: 'chrome-extension',
      },
    });

    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.payload).error, /owner/);
    const config = await readCapabilitiesConfig(projectRoot);
    assert.deepEqual(config?.capabilities, []);
  });

  it('rejects non-owner MCP deletes when DEFAULT_OWNER_USER_ID is configured', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');
    await writeCapabilitiesConfig(projectRoot, {
      version: 1,
      capabilities: [
        {
          id: 'external-mcp',
          type: 'mcp',
          enabled: true,
          source: 'external',
          mcpServer: { resolver: 'chrome-extension' },
        },
      ],
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/capabilities/mcp/external-mcp?hard=true',
      headers: NON_OWNER_HEADERS,
    });

    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.payload).error, /owner/);
    const config = await readCapabilitiesConfig(projectRoot);
    assert.equal(config?.capabilities[0]?.enabled, true);
  });

  it('rejects redacted placeholder values before writing MCP secrets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: OWNER_HEADERS,
      payload: {
        id: 'secret-mcp',
        resolver: 'chrome-extension',
        env: { API_KEY: '••••••' },
      },
    });

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.payload).error, /redacted/i);
    const config = await readCapabilitiesConfig(projectRoot);
    assert.deepEqual(config?.capabilities, []);
  });

  it('rejects redacted placeholder values in non-env install fields', async () => {
    const cases = [
      {
        id: 'redacted-command',
        command: `node-${'••••••'}`,
        args: ['server.js'],
      },
      {
        id: 'redacted-header',
        transport: 'streamableHttp',
        url: 'https://mcp.example.test',
        headers: { Authorization: 'Bearer ••••••' },
      },
    ];

    for (const payload of cases) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/capabilities/mcp/install',
        headers: OWNER_HEADERS,
        payload,
      });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.payload).error, /redacted/i);
    }

    const config = await readCapabilitiesConfig(projectRoot);
    assert.deepEqual(config?.capabilities, []);
  });

  it('preserves existing env and headers when updating an external MCP with omitted secret fields', async () => {
    await writeCapabilitiesConfig(projectRoot, {
      version: 1,
      capabilities: [
        {
          id: 'secret-mcp',
          type: 'mcp',
          enabled: true,
          source: 'external',
          mcpServer: {
            command: 'node',
            args: ['old.js'],
            env: { API_KEY: 'real-secret', KEEP: 'yes' },
            headers: { Authorization: 'Bearer real-secret' },
          },
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: OWNER_HEADERS,
      payload: {
        id: 'secret-mcp',
        command: 'node',
        args: ['new.js'],
      },
    });

    assert.equal(res.statusCode, 200, res.payload);
    const config = await readCapabilitiesConfig(projectRoot);
    const cap = config?.capabilities.find((entry) => entry.id === 'secret-mcp');
    assert.deepEqual(cap?.mcpServer?.env, { API_KEY: 'real-secret', KEEP: 'yes' });
    assert.deepEqual(cap?.mcpServer?.headers, { Authorization: 'Bearer real-secret' });
    assert.deepEqual(cap?.mcpServer?.args, ['new.js']);

    const audit = await readAuditLog(projectRoot);
    assert.equal(audit[0]?.action, 'update');
    assert.deepEqual(audit[0]?.after?.mcpServer?.env, { API_KEY: 'real-secret', KEEP: 'yes' });
  });

  it('fails closed for env patch when DEFAULT_OWNER_USER_ID is not configured', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/secret-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { API_KEY: 'new-secret' } },
    });

    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.payload).error, /DEFAULT_OWNER_USER_ID/);
  });

  it('rejects malformed env patch payloads before touching config', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');

    for (const payload of [{}, { env: ['API_KEY=value'] }]) {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/capabilities/mcp/secret-mcp/env',
        headers: OWNER_HEADERS,
        payload,
      });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.payload).error, /Required: env/);
    }

    const config = await readCapabilitiesConfig(projectRoot);
    assert.deepEqual(config?.capabilities, []);
  });

  it('returns 404 when patching env for an unknown MCP id', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/missing-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { API_KEY: 'new-secret' } },
    });

    assert.equal(res.statusCode, 404);
    assert.match(JSON.parse(res.payload).error, /missing-mcp/);
  });

  it('rejects env patch for managed MCP entries', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');
    await writeCapabilitiesConfig(projectRoot, {
      version: 1,
      capabilities: [
        {
          id: 'managed-mcp',
          type: 'mcp',
          enabled: true,
          source: 'cat-cafe',
          mcpServer: {
            command: 'node',
            args: ['managed-server.js'],
            env: { API_KEY: 'managed-secret' },
          },
        },
      ],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/managed-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { API_KEY: 'new-secret' } },
    });

    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.payload).error, /managed MCP/);
    const config = await readCapabilitiesConfig(projectRoot);
    assert.deepEqual(config?.capabilities[0]?.mcpServer?.env, { API_KEY: 'managed-secret' });
  });

  it('lets only the configured owner patch MCP env and records an update audit', async () => {
    setEnv('DEFAULT_OWNER_USER_ID', 'lysander');
    await writeCapabilitiesConfig(projectRoot, {
      version: 1,
      capabilities: [
        {
          id: 'secret-mcp',
          type: 'mcp',
          enabled: true,
          source: 'external',
          mcpServer: {
            command: 'node',
            args: ['server.js'],
            env: { API_KEY: 'old-secret', KEEP: 'yes' },
          },
        },
      ],
    });

    const nonOwner = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/secret-mcp/env',
      headers: NON_OWNER_HEADERS,
      payload: { env: { API_KEY: 'attacker-secret' } },
    });
    assert.equal(nonOwner.statusCode, 403);

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/secret-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { 'BAD-KEY': 'value' } },
    });
    assert.equal(invalid.statusCode, 400);
    assert.match(JSON.parse(invalid.payload).error, /Invalid env key/);

    const redacted = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/secret-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { API_KEY: '••••••' } },
    });
    assert.equal(redacted.statusCode, 400);
    assert.match(JSON.parse(redacted.payload).error, /redacted/i);

    const owner = await app.inject({
      method: 'PATCH',
      url: '/api/capabilities/mcp/secret-mcp/env',
      headers: OWNER_HEADERS,
      payload: { env: { API_KEY: 'new-secret', NEW_TOKEN: 'token' } },
    });
    assert.equal(owner.statusCode, 200, owner.payload);

    const config = await readCapabilitiesConfig(projectRoot);
    const cap = config?.capabilities.find((entry) => entry.id === 'secret-mcp');
    assert.deepEqual(cap?.mcpServer?.env, {
      API_KEY: 'new-secret',
      KEEP: 'yes',
      NEW_TOKEN: 'token',
    });

    const audit = await readAuditLog(projectRoot);
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.action, 'update');
    assert.equal(audit[0]?.capabilityId, 'secret-mcp');
    assert.deepEqual(audit[0]?.before?.mcpServer?.env, { API_KEY: 'old-secret', KEEP: 'yes' });
    assert.deepEqual(audit[0]?.after?.mcpServer?.env, {
      API_KEY: 'new-secret',
      KEEP: 'yes',
      NEW_TOKEN: 'token',
    });
  });
});
