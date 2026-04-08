// @ts-check
import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const AUTH_HEADERS = { 'x-cat-cafe-user': 'test-user' };

/** @param {string} prefix */
async function makeTmpDir(prefix) {
  return mkdtemp(join(homedir(), `.cat-cafe-provider-profile-route-${prefix}-`));
}

/** @param {string} prefix */
async function makeWorkspaceDir(prefix) {
  return mkdtemp(join(process.cwd(), '..', '..', `.cat-cafe-provider-profile-route-workspace-${prefix}-`));
}

describe('accounts routes', () => {
  /** @type {string | undefined} */ let savedGlobalRoot;

  function setGlobalRoot(dir) {
    savedGlobalRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = dir;
  }

  function restoreGlobalRoot() {
    if (savedGlobalRoot === undefined) delete process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    else process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = savedGlobalRoot;
  }

  // F136 Phase 4d: legacy v1/v2 migration tests removed — old provider-profiles.js store retired.
  // Migration to accounts is tested in account-startup-hook.test.js.

  it('GET /api/accounts requires identity', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/accounts' });
    assert.equal(res.statusCode, 401);

    await app.close();
  });

  it('create + list profile flow', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('crud');
    setGlobalRoot(projectDir);
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          provider: 'anthropic',
          displayName: 'sponsor-route',
          authType: 'api_key',
          baseUrl: 'https://api.route.dev',
          apiKey: 'sk-route',
          models: ['claude-opus-4-6'],
        }),
      });
      assert.equal(createRes.statusCode, 200);
      const created = createRes.json();
      assert.equal(created.profile.authType, 'api_key');
      assert.equal(created.profile.hasApiKey, true);

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/accounts?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });
      assert.equal(listRes.statusCode, 200);
      const list = listRes.json();
      assert.ok(Array.isArray(list.providers));
      // F340: activeProfileId removed — activate concept retired
      assert.equal(list.activeProfileId, undefined);
      const listed = list.providers.find((p) => p.id === created.profile.id);
      assert.ok(listed, 'created profile should appear in list');
      assert.equal(listed.hasApiKey, true);
    } finally {
      restoreGlobalRoot();
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });

  // F340: POST /api/accounts/:id/test route removed — incomplete feature with no frontend entry.
  // Probe/heuristic protocol inference deleted alongside.

  it('rejects blank profile name in create request', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('blank-name');
    setGlobalRoot(projectDir);
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          displayName: '   ',
          authType: 'api_key',
        }),
      });
      assert.equal(createRes.statusCode, 400);
    } finally {
      restoreGlobalRoot();
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('POST /api/accounts assigns unique IDs when displayName collides', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('slug-collision');
    setGlobalRoot(projectDir);
    try {
      const first = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          displayName: 'My Sponsor',
          authType: 'api_key',
          baseUrl: 'https://api.first.example',
          apiKey: 'sk-first',
        }),
      });
      assert.equal(first.statusCode, 200, 'first create should succeed');
      const firstId = first.json().profile.id;

      const second = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          displayName: 'My Sponsor',
          authType: 'api_key',
          baseUrl: 'https://api.second.example',
          apiKey: 'sk-second',
        }),
      });
      assert.equal(second.statusCode, 200, 'second create with same name should succeed');
      const secondId = second.json().profile.id;
      assert.notEqual(firstId, secondId, 'duplicate displayName must produce different IDs');

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/accounts?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });
      const list = listRes.json();
      const ids = list.providers.map((p) => p.id);
      assert.ok(ids.includes(firstId), 'first profile must still exist');
      assert.ok(ids.includes(secondId), 'second profile must exist alongside first');
    } finally {
      restoreGlobalRoot();
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('PATCH /api/accounts/:id clears credential when apiKey is empty string', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('clear-cred');
    setGlobalRoot(projectDir);
    try {
      // Create profile with apiKey
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          displayName: 'Clearable',
          authType: 'api_key',
          apiKey: 'sk-to-clear',
        }),
      });
      assert.equal(createRes.statusCode, 200);
      const profileId = createRes.json().profile.id;
      assert.equal(createRes.json().profile.hasApiKey, true, 'should have credential after create');

      // PATCH with empty apiKey to clear credential
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/accounts/${profileId}`,
        headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectPath: projectDir,
          apiKey: '',
        }),
      });
      assert.equal(patchRes.statusCode, 200);
      assert.equal(
        patchRes.json().profile.hasApiKey,
        false,
        'credential should be cleared after PATCH with empty apiKey',
      );

      // Verify via GET
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/accounts?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });
      const profile = listRes.json().providers.find((p) => p.id === profileId);
      assert.equal(profile.hasApiKey, false, 'credential should remain cleared');
    } finally {
      restoreGlobalRoot();
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('accepts workspace projectPath even when validateProjectPath allowlist excludes it', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const workspaceDir = await makeWorkspaceDir('switch');
    setGlobalRoot(workspaceDir);
    const previousRoots = process.env.PROJECT_ALLOWED_ROOTS;
    const previousAppend = process.env.PROJECT_ALLOWED_ROOTS_APPEND;
    process.env.PROJECT_ALLOWED_ROOTS = '/tmp';
    delete process.env.PROJECT_ALLOWED_ROOTS_APPEND;

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/accounts?projectPath=${encodeURIComponent(workspaceDir)}`,
        headers: AUTH_HEADERS,
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().projectPath, await realpath(workspaceDir));
    } finally {
      restoreGlobalRoot();
      if (previousRoots === undefined) delete process.env.PROJECT_ALLOWED_ROOTS;
      else process.env.PROJECT_ALLOWED_ROOTS = previousRoots;
      if (previousAppend === undefined) delete process.env.PROJECT_ALLOWED_ROOTS_APPEND;
      else process.env.PROJECT_ALLOWED_ROOTS_APPEND = previousAppend;
      await rm(workspaceDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('defaults projectPath to CAT_TEMPLATE_PATH directory when query omits projectPath', async () => {
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('default-root');
    setGlobalRoot(projectDir);
    const templatePath = join(projectDir, 'cat-template.json');
    await writeFile(templatePath, '{}\n', 'utf-8');
    const prevTemplate = process.env.CAT_TEMPLATE_PATH;
    process.env.CAT_TEMPLATE_PATH = templatePath;

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: AUTH_HEADERS,
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().projectPath, await realpath(projectDir));
    } finally {
      restoreGlobalRoot();
      if (prevTemplate === undefined) delete process.env.CAT_TEMPLATE_PATH;
      else process.env.CAT_TEMPLATE_PATH = prevTemplate;
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('GET /api/accounts returns correct client for non-standard builtins (dare/opencode)', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { writeCatalogAccount } = await import('../dist/config/catalog-accounts.js');
    const Fastify = (await import('fastify')).default;
    const { accountsRoutes } = await import('../dist/routes/accounts.js');
    const app = Fastify();
    await app.register(accountsRoutes);
    await app.ready();

    const projectDir = await makeTmpDir('client-field');
    setGlobalRoot(projectDir);
    try {
      // Bootstrap minimal catalog
      const catCafeDir = join(projectDir, '.cat-cafe');
      mkdirSync(catCafeDir, { recursive: true });
      writeFileSync(
        join(catCafeDir, 'cat-catalog.json'),
        JSON.stringify({ version: 2, breeds: [], roster: {}, reviewPolicy: {}, accounts: {} }),
      );

      // Write builtin accounts — protocol derived at runtime, not stored
      writeCatalogAccount(projectDir, 'claude', { authType: 'oauth', models: ['m1'] });
      writeCatalogAccount(projectDir, 'dare', { authType: 'oauth', models: ['glm'] });
      writeCatalogAccount(projectDir, 'opencode', { authType: 'oauth', models: ['m2'] });

      const res = await app.inject({
        method: 'GET',
        url: `/api/accounts?projectPath=${encodeURIComponent(projectDir)}`,
        headers: AUTH_HEADERS,
      });
      assert.equal(res.statusCode, 200);
      const providers = res.json().providers;

      const claude = providers.find((p) => p.id === 'claude');
      assert.equal(claude.clientId, 'anthropic', 'claude builtin clientId should be protocol (anthropic)');

      const dare = providers.find((p) => p.id === 'dare');
      assert.equal(dare.clientId, 'dare', 'dare builtin clientId should be its own ID, not protocol');

      const opencode = providers.find((p) => p.id === 'opencode');
      assert.equal(opencode.clientId, 'opencode', 'opencode builtin clientId should be its own ID, not protocol');
    } finally {
      restoreGlobalRoot();
      await rm(projectDir, { recursive: true, force: true });
      await app.close();
    }
  });
});
