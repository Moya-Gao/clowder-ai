import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('accountStartupHook (F340 — simplified)', () => {
  let globalRoot;
  let projectRoot;
  let previousGlobalRoot;

  beforeEach(async () => {
    globalRoot = await mkdtemp(join(tmpdir(), 'acct-startup-'));
    projectRoot = await mkdtemp(join(tmpdir(), 'acct-startup-proj-'));
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

  it('returns zero accountCount when no accounts exist', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}`);
    const { resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();

    const result = accountStartupHook(projectRoot);
    assert.ok(result, 'hook should return a result');
    assert.equal(result.accountCount, 0);
  });

  it('returns correct accountCount when global accounts exist', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}-1`);
    const { writeCatalogAccount, resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();

    writeCatalogAccount(projectRoot, 'claude', { authType: 'oauth', protocol: 'anthropic' });
    writeCatalogAccount(projectRoot, 'codex', { authType: 'oauth', protocol: 'openai' });

    const result = accountStartupHook(projectRoot);
    assert.equal(result.accountCount, 2);
  });

  it('includes migrated project-level accounts in count', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}-2`);
    const { resetMigrationState } = await import('../dist/config/catalog-accounts.js');
    resetMigrationState();

    // Write a project catalog with accounts section (triggers migration)
    const catalog = {
      version: 2,
      breeds: [],
      roster: {},
      reviewPolicy: {},
      accounts: {
        'custom-ant': { authType: 'api_key', protocol: 'anthropic' },
      },
    };
    await writeFile(join(projectRoot, '.cat-cafe', 'cat-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

    const result = accountStartupHook(projectRoot);
    assert.equal(result.accountCount, 1, 'migrated project accounts should be counted');
  });
});
