import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('accountStartupHook (HC-3 migration + HC-5 conflict scan at startup)', () => {
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

  function writeCatalog(root, accounts) {
    const catalog = {
      version: 2,
      breeds: [],
      roster: {},
      reviewPolicy: {
        requireDifferentFamily: true,
        preferActiveInThread: true,
        preferLead: true,
        excludeUnavailable: true,
      },
      accounts,
    };
    return writeFile(join(root, '.cat-cafe', 'cat-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
  }

  function writeV3Meta(profiles) {
    const meta = { version: 3, activeProfileId: null, providers: profiles, bootstrapBindings: {} };
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

  it('runs migration and returns migrated accounts + conflicts', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}`);

    // Setup: old provider-profiles + catalog (so migration can write)
    await writeV3Meta([
      { id: 'custom-ant', authType: 'api_key', protocol: 'anthropic', baseUrl: 'https://ant.example.com' },
    ]);
    await writeV3Secrets({ 'custom-ant': { apiKey: 'sk-test-123' } });
    await writeCatalog(projectRoot, {});

    const result = accountStartupHook(projectRoot);
    assert.ok(result, 'hook should return a result');
    assert.ok(result.migration, 'should include migration result');
    assert.equal(result.migration.migrated, true);
    assert.equal(result.migration.accountsMigrated, 1);
    assert.ok(Array.isArray(result.conflicts), 'should include conflicts array');
  });

  it('skips migration when already migrated', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}-1`);

    // Write migration marker
    await writeFile(
      join(globalRoot, '.cat-cafe', 'accounts-migration-done.json'),
      JSON.stringify({ migratedAt: new Date().toISOString() }),
      'utf-8',
    );
    await writeCatalog(projectRoot, {});

    const result = accountStartupHook(projectRoot);
    assert.equal(result.migration.migrated, false);
    assert.equal(result.migration.reason, 'already-migrated');
  });

  it('detects cross-project conflicts at startup', async () => {
    const { accountStartupHook } = await import(`../dist/config/account-startup.js?t=${Date.now()}-2`);

    // Create a second project with a conflicting account
    const otherProject = await mkdtemp(join(tmpdir(), 'acct-startup-other-'));
    await mkdir(join(otherProject, '.cat-cafe'), { recursive: true });

    // Write known-project-roots.json
    await writeFile(
      join(globalRoot, '.cat-cafe', 'known-project-roots.json'),
      JSON.stringify([projectRoot, otherProject]),
      'utf-8',
    );

    // Write conflicting accounts: same ref, different protocol
    await writeCatalog(projectRoot, {
      shared: { authType: 'api_key', protocol: 'anthropic' },
    });
    await writeCatalog(otherProject, {
      shared: { authType: 'api_key', protocol: 'openai' },
    });

    // Write migration marker to skip migration
    await writeFile(
      join(globalRoot, '.cat-cafe', 'accounts-migration-done.json'),
      JSON.stringify({ migratedAt: new Date().toISOString() }),
      'utf-8',
    );

    assert.throws(
      () => accountStartupHook(projectRoot),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('shared'), 'error should name the conflicting accountRef');
        assert.ok(err.message.includes('protocol'), 'error should describe the conflict');
        return true;
      },
      'HC-5: startup conflict must be a hard error, not warn-only',
    );

    await rm(otherProject, { recursive: true, force: true });
  });
});
