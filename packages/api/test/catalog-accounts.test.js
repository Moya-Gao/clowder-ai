import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('global accounts (F340)', () => {
  let globalRoot;
  let projectRoot;
  let previousGlobalRoot;

  beforeEach(async () => {
    globalRoot = await mkdtemp(join(tmpdir(), 'global-accounts-'));
    projectRoot = await mkdtemp(join(tmpdir(), 'project-accounts-'));
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

  it('readCatalogAccounts returns empty object when no accounts file exists', async () => {
    const { readCatalogAccounts, resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();
    const result = readCatalogAccounts(projectRoot);
    assert.deepEqual(result, {});
  });

  it('writeCatalogAccount creates global accounts.json', async () => {
    const { writeCatalogAccount, readCatalogAccounts, resetMigrationState } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();
    writeCatalogAccount(projectRoot, 'claude', {
      authType: 'oauth',
      protocol: 'anthropic',
    });

    const result = readCatalogAccounts(projectRoot);
    assert.deepEqual(result.claude, { authType: 'oauth', protocol: 'anthropic' });

    // Verify it's in global path
    const raw = await readFile(join(globalRoot, '.cat-cafe', 'accounts.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.claude.protocol, 'anthropic');
  });

  it('deleteCatalogAccount removes account from global', async () => {
    const { writeCatalogAccount, deleteCatalogAccount, readCatalogAccounts, resetMigrationState } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();
    writeCatalogAccount(projectRoot, 'a', { authType: 'api_key', protocol: 'openai' });
    writeCatalogAccount(projectRoot, 'b', { authType: 'api_key', protocol: 'anthropic' });

    deleteCatalogAccount(projectRoot, 'a');

    const result = readCatalogAccounts(projectRoot);
    assert.equal(result.a, undefined);
    assert.ok(result.b);
  });

  it('migrates project-level accounts to global on first read', async () => {
    const { readCatalogAccounts, resetMigrationState, resolveAccountsPath } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();

    // Write a catalog with accounts section in project
    const catalog = {
      version: 2,
      breeds: [],
      roster: {},
      reviewPolicy: {},
      accounts: {
        claude: { authType: 'oauth', protocol: 'anthropic' },
        'my-glm': { authType: 'api_key', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      },
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

    // First read triggers migration
    const result = readCatalogAccounts(projectRoot);
    assert.equal(result.claude.protocol, 'anthropic');
    assert.equal(result['my-glm'].baseUrl, 'https://open.bigmodel.cn/api/paas/v4');

    // Global file should now contain accounts
    const globalRaw = await readFile(resolveAccountsPath(), 'utf-8');
    const globalAccounts = JSON.parse(globalRaw);
    assert.ok(globalAccounts.claude);
    assert.ok(globalAccounts['my-glm']);

    // Project catalog keeps accounts section untouched (rollback compat)
    const catalogRaw = await readFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), 'utf-8');
    const updatedCatalog = JSON.parse(catalogRaw);
    assert.ok(updatedCatalog.accounts?.claude, 'project accounts preserved for rollback compat');
    assert.ok(updatedCatalog.accounts?.['my-glm'], 'project accounts preserved for rollback compat');
    assert.equal(updatedCatalog.version, 2);
  });

  it('merges project accounts into global without overwriting; keeps skipped keys in project', async () => {
    const { writeCatalogAccount, readCatalogAccounts, resetMigrationState } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();

    // Pre-populate global with 'existing' account
    writeCatalogAccount(projectRoot, 'existing', { authType: 'oauth', protocol: 'anthropic' });
    resetMigrationState();

    // Write project catalog with a conflicting key + a new key
    const catalog = {
      version: 2,
      breeds: [],
      roster: {},
      reviewPolicy: {},
      accounts: {
        existing: { authType: 'api_key', protocol: 'openai' },
        'new-from-project': { authType: 'api_key', protocol: 'openai' },
      },
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

    const result = readCatalogAccounts(projectRoot);
    assert.equal(result.existing.authType, 'oauth', 'existing global key must not be overwritten');
    assert.ok(result['new-from-project'], 'new key from project should be merged');

    // Skipped key must still be in project catalog (not silently deleted)
    const catalogRaw = await readFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), 'utf-8');
    const updatedCatalog = JSON.parse(catalogRaw);
    assert.ok(updatedCatalog.accounts?.existing, 'skipped key must remain in project catalog');
    assert.ok(
      updatedCatalog.accounts['new-from-project'],
      'merged key must also remain in project catalog (rollback compat)',
    );
  });

  it('migrates project-level legacy provider-profiles.json into global accounts', async () => {
    const { readCatalogAccounts, resetMigrationState, resolveAccountsPath } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();

    // Write legacy provider-profiles.json at project level (old installer output)
    const legacyMeta = {
      version: 2,
      providers: [{ id: 'my-custom', authType: 'api_key', protocol: 'openai', baseUrl: 'https://custom.api/v1' }],
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'provider-profiles.json'), JSON.stringify(legacyMeta), 'utf-8');

    // Write secrets file too
    const legacySecrets = { profiles: { 'my-custom': { apiKey: 'sk-secret-123' } } };
    await writeFile(
      join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      JSON.stringify(legacySecrets),
      'utf-8',
    );

    // Reading accounts should trigger project-level legacy migration
    const result = readCatalogAccounts(projectRoot);
    // F340: protocol not migrated — derived at runtime from well-known account IDs.
    assert.equal(result['my-custom'].protocol, undefined);
    assert.equal(result['my-custom'].baseUrl, 'https://custom.api/v1');

    // Credentials should also be migrated to global
    const credRaw = await readFile(join(globalRoot, '.cat-cafe', 'credentials.json'), 'utf-8');
    const creds = JSON.parse(credRaw);
    assert.equal(creds['my-custom'].apiKey, 'sk-secret-123');
  });

  it('migrates multiple projects without losing accounts', async () => {
    const { readCatalogAccounts, resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();

    // Project A has account 'a'
    const projectA = await mkdtemp(join(tmpdir(), 'project-a-'));
    await mkdir(join(projectA, '.cat-cafe'), { recursive: true });
    await writeFile(
      join(projectA, '.cat-cafe', 'cat-catalog.json'),
      JSON.stringify({
        version: 2,
        breeds: [],
        roster: {},
        reviewPolicy: {},
        accounts: { a: { authType: 'oauth', protocol: 'anthropic' } },
      }),
      'utf-8',
    );

    // Project B has account 'b'
    const projectB = await mkdtemp(join(tmpdir(), 'project-b-'));
    await mkdir(join(projectB, '.cat-cafe'), { recursive: true });
    await writeFile(
      join(projectB, '.cat-cafe', 'cat-catalog.json'),
      JSON.stringify({
        version: 2,
        breeds: [],
        roster: {},
        reviewPolicy: {},
        accounts: { b: { authType: 'api_key', protocol: 'openai' } },
      }),
      'utf-8',
    );

    // Read A first, then B — both should migrate
    readCatalogAccounts(projectA);
    const result = readCatalogAccounts(projectB);
    assert.ok(result.a, 'account from project A should exist');
    assert.ok(result.b, 'account from project B should exist');

    const { rm: rmAsync } = await import('node:fs/promises');
    await rmAsync(projectA, { recursive: true, force: true });
    await rmAsync(projectB, { recursive: true, force: true });
  });

  it('migrates v1 nested providers.<client>.profiles[] into flat accounts', async () => {
    const { readCatalogAccounts, resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();

    // v1 format: providers keyed by client, each with a profiles array
    const v1Meta = {
      version: 1,
      providers: {
        anthropic: {
          activeProfileId: 'my-proxy',
          profiles: [
            { id: 'my-proxy', displayName: 'My Proxy', authType: 'api_key', baseUrl: 'https://proxy.example/v1' },
            { id: 'team-key', displayName: 'Team Key', authType: 'api_key' },
          ],
        },
      },
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'provider-profiles.json'), JSON.stringify(v1Meta), 'utf-8');

    // v1 secrets: also nested under providers.<client>
    const v1Secrets = {
      version: 1,
      providers: {
        anthropic: {
          'my-proxy': { apiKey: 'sk-proxy-key' },
          'team-key': { apiKey: 'sk-team-key' },
        },
      },
    };
    await writeFile(
      join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      JSON.stringify(v1Secrets),
      'utf-8',
    );

    const result = readCatalogAccounts(projectRoot);
    // Both profiles should be migrated as individual accounts (not "anthropic" shell)
    assert.ok(result['my-proxy'], 'my-proxy account should exist');
    assert.equal(result['my-proxy'].authType, 'api_key');
    assert.equal(result['my-proxy'].displayName, 'My Proxy');
    assert.equal(result['my-proxy'].baseUrl, 'https://proxy.example/v1');
    assert.ok(result['team-key'], 'team-key account should exist');
    assert.equal(result['team-key'].authType, 'api_key');
    // Must NOT create an "anthropic" shell account from the parent key
    assert.equal(result.anthropic, undefined, 'should not create shell account from client key');

    // Credentials should also be migrated
    const credRaw = await readFile(join(globalRoot, '.cat-cafe', 'credentials.json'), 'utf-8');
    const creds = JSON.parse(credRaw);
    assert.equal(creds['my-proxy'].apiKey, 'sk-proxy-key');
    assert.equal(creds['team-key'].apiKey, 'sk-team-key');
  });

  it('retries secret import when accounts already exist from previous migration', async () => {
    const { readCatalogAccounts, resetMigrationState, writeCatalogAccount } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();

    // Simulate previous successful account merge: account exists in global but no credential
    writeCatalogAccount(projectRoot, 'my-custom', { authType: 'api_key' });
    resetMigrationState(); // reset so next read re-runs migration

    // Legacy source still has the profile + secret
    const legacyMeta = {
      version: 2,
      providers: [{ id: 'my-custom', authType: 'api_key', baseUrl: 'https://custom.api/v1' }],
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'provider-profiles.json'), JSON.stringify(legacyMeta), 'utf-8');

    const legacySecrets = { profiles: { 'my-custom': { apiKey: 'sk-retry-key' } } };
    await writeFile(
      join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      JSON.stringify(legacySecrets),
      'utf-8',
    );

    // On retry: accounts already exist (mergedIds empty), but credentials must still import
    const result = readCatalogAccounts(projectRoot);
    assert.ok(result['my-custom'], 'account should exist');

    const credRaw = await readFile(join(globalRoot, '.cat-cafe', 'credentials.json'), 'utf-8');
    const creds = JSON.parse(credRaw);
    assert.equal(creds['my-custom'].apiKey, 'sk-retry-key', 'credential must be imported on retry');
  });

  it('does NOT attach legacy secret to a pre-existing global account with colliding ID', async () => {
    const { readCatalogAccounts, resetMigrationState, writeCatalogAccount } = await import(
      '../dist/config/catalog-accounts.js'
    );
    resetMigrationState();

    // Pre-existing OAuth account in global — NOT from this legacy source
    writeCatalogAccount(projectRoot, 'shared', { authType: 'oauth' });
    resetMigrationState();

    // Legacy source happens to use the same "shared" ID but as api_key
    const legacyMeta = {
      version: 2,
      providers: [{ id: 'shared', authType: 'api_key', baseUrl: 'https://legacy.api/v1' }],
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'provider-profiles.json'), JSON.stringify(legacyMeta), 'utf-8');

    const legacySecrets = { profiles: { shared: { apiKey: 'sk-collision' } } };
    await writeFile(
      join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json'),
      JSON.stringify(legacySecrets),
      'utf-8',
    );

    readCatalogAccounts(projectRoot);

    // The OAuth account must remain untouched (merge skips it)
    const accounts = readCatalogAccounts(projectRoot);
    assert.equal(accounts.shared.authType, 'oauth', 'pre-existing OAuth account must not be overwritten');

    // The legacy secret must NOT be imported for the colliding ID
    const credPath = join(globalRoot, '.cat-cafe', 'credentials.json');
    if (existsSync(credPath)) {
      const creds = JSON.parse(await readFile(credPath, 'utf-8'));
      assert.equal(creds.shared, undefined, 'legacy secret must NOT be attached to pre-existing OAuth account');
    }
    // If credentials.json doesn't exist at all, that's also correct
  });
});
