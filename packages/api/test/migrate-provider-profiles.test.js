import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('migrateProviderProfilesToAccounts', () => {
  let globalRoot;
  let projectRoot;
  let previousGlobalRoot;

  beforeEach(async () => {
    globalRoot = await mkdtemp(join(tmpdir(), 'migrate-pp-global-'));
    projectRoot = await mkdtemp(join(tmpdir(), 'migrate-pp-project-'));
    previousGlobalRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = globalRoot;
    await mkdir(join(globalRoot, '.cat-cafe'), { recursive: true });
    await mkdir(join(projectRoot, '.cat-cafe'), { recursive: true });
  });

  afterEach(async () => {
    if (previousGlobalRoot === undefined) delete process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    else process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = previousGlobalRoot;
    await rm(globalRoot, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  });

  function writeV3Meta(profiles, bootstrapBindings) {
    const meta = {
      version: 3,
      activeProfileId: null,
      providers: profiles,
      bootstrapBindings: bootstrapBindings ?? {},
    };
    return writeFile(join(globalRoot, '.cat-cafe', 'provider-profiles.json'), JSON.stringify(meta, null, 2), 'utf-8');
  }

  function writeV3Secrets(profileSecrets) {
    const secrets = { version: 3, profiles: profileSecrets };
    return writeFile(
      join(globalRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      JSON.stringify(secrets, null, 2),
      'utf-8',
    );
  }

  function writeCatalog(catalog) {
    return writeFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
  }

  function makeCatalog(overrides) {
    return {
      version: 2,
      breeds: [],
      roster: {},
      reviewPolicy: {
        requireDifferentFamily: true,
        preferActiveInThread: true,
        preferLead: true,
        excludeUnavailable: true,
      },
      ...overrides,
    };
  }

  it('migrates api_key profile to accounts + credentials', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}`
    );

    await writeV3Meta([
      {
        id: 'my-glm',
        displayName: 'My GLM',
        kind: 'api_key',
        authType: 'api_key',
        builtin: false,
        protocol: 'openai',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-5'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    await writeV3Secrets({ 'my-glm': { apiKey: 'glm-key-xxx' } });
    await writeCatalog(makeCatalog());

    const result = migrateProviderProfilesToAccounts(projectRoot);
    assert.equal(result.migrated, true);
    assert.equal(result.accountsMigrated, 1);

    // Check accounts were written to catalog
    const catalog = JSON.parse(await readFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), 'utf-8'));
    assert.ok(catalog.accounts?.['my-glm']);
    assert.equal(catalog.accounts['my-glm'].protocol, 'openai');
    assert.equal(catalog.accounts['my-glm'].authType, 'api_key');
    assert.equal(catalog.accounts['my-glm'].baseUrl, 'https://open.bigmodel.cn/api/paas/v4');
    assert.deepEqual(catalog.accounts['my-glm'].models, ['glm-5']);

    // Check credentials were written
    const creds = JSON.parse(await readFile(join(globalRoot, '.cat-cafe', 'credentials.json'), 'utf-8'));
    assert.equal(creds['my-glm']?.apiKey, 'glm-key-xxx');
  });

  it('migrates builtin profiles to accounts', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}-1`
    );

    await writeV3Meta([
      {
        id: 'claude',
        displayName: 'Claude (OAuth)',
        kind: 'builtin',
        authType: 'oauth',
        builtin: true,
        client: 'anthropic',
        protocol: 'anthropic',
        models: ['claude-opus-4-6', 'claude-sonnet-4-6'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    await writeV3Secrets({});
    await writeCatalog(makeCatalog());

    const result = migrateProviderProfilesToAccounts(projectRoot);
    assert.equal(result.migrated, true);

    const catalog = JSON.parse(await readFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), 'utf-8'));
    assert.ok(catalog.accounts?.claude);
    assert.equal(catalog.accounts.claude.authType, 'oauth');
    assert.equal(catalog.accounts.claude.protocol, 'anthropic');
  });

  it('skips migration when marker file exists', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}-2`
    );

    await writeV3Meta([
      {
        id: 'test',
        displayName: 'Test',
        kind: 'api_key',
        authType: 'api_key',
        builtin: false,
        protocol: 'openai',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    await writeV3Secrets({});
    await writeCatalog(makeCatalog());

    // Write migration marker
    await writeFile(
      join(globalRoot, '.cat-cafe', 'accounts-migration-done.json'),
      JSON.stringify({ migratedAt: new Date().toISOString() }),
      'utf-8',
    );

    const result = migrateProviderProfilesToAccounts(projectRoot);
    assert.equal(result.migrated, false);
    assert.equal(result.reason, 'already-migrated');
  });

  it('skips when no provider-profiles.json exists', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}-3`
    );

    await writeCatalog(makeCatalog());

    const result = migrateProviderProfilesToAccounts(projectRoot);
    assert.equal(result.migrated, false);
    assert.equal(result.reason, 'no-source');
  });

  it('does not delete old files after migration (HC-3)', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}-4`
    );

    await writeV3Meta([
      {
        id: 'test',
        displayName: 'Test',
        kind: 'api_key',
        authType: 'api_key',
        builtin: false,
        protocol: 'openai',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    await writeV3Secrets({ test: { apiKey: 'sk-test' } });
    await writeCatalog(makeCatalog());

    migrateProviderProfilesToAccounts(projectRoot);

    // Old files should still exist
    const metaExists = await readFile(join(globalRoot, '.cat-cafe', 'provider-profiles.json'), 'utf-8').then(
      () => true,
      () => false,
    );
    const secretsExists = await readFile(
      join(globalRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      'utf-8',
    ).then(
      () => true,
      () => false,
    );
    assert.equal(metaExists, true, 'old meta file should be preserved');
    assert.equal(secretsExists, true, 'old secrets file should be preserved');
  });

  it('preserves bootstrapBindings semantics in accountRef', async () => {
    const { migrateProviderProfilesToAccounts } = await import(
      `../dist/config/migrate-provider-profiles.js?t=${Date.now()}-5`
    );

    await writeV3Meta(
      [
        {
          id: 'claude',
          displayName: 'Claude (OAuth)',
          kind: 'builtin',
          authType: 'oauth',
          builtin: true,
          client: 'anthropic',
          protocol: 'anthropic',
          models: ['claude-opus-4-6'],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'my-custom',
          displayName: 'Custom API',
          kind: 'api_key',
          authType: 'api_key',
          builtin: false,
          protocol: 'anthropic',
          baseUrl: 'https://custom.api.com/v1',
          models: [],
          createdAt: '',
          updatedAt: '',
        },
      ],
      {
        anthropic: { enabled: true, mode: 'api_key', accountRef: 'my-custom' },
      },
    );
    await writeV3Secrets({ 'my-custom': { apiKey: 'sk-custom' } });
    await writeCatalog(makeCatalog());

    const result = migrateProviderProfilesToAccounts(projectRoot);
    assert.equal(result.migrated, true);

    const catalog = JSON.parse(await readFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), 'utf-8'));
    assert.ok(catalog.accounts?.['my-custom']);
    assert.equal(catalog.accounts['my-custom'].protocol, 'anthropic');
  });
});
