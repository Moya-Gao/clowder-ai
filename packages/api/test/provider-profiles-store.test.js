// @ts-check
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  readProviderProfiles,
  createProviderProfile,
  activateProviderProfile,
  deleteProviderProfile,
  getProviderProfile,
  resolveAnthropicRuntimeProfile,
} = await import('../dist/config/provider-profiles.js');

/** @param {string} prefix */
async function makeTmpDir(prefix) {
  const dir = join(tmpdir(), `provider-profile-store-${prefix}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe('provider profile store', () => {
  /** @type {string} */ let projectRoot;

  beforeEach(async () => {
    projectRoot = await makeTmpDir('case');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('bootstraps with a default subscription profile', async () => {
    const data = await readProviderProfiles(projectRoot);
    assert.ok(data.anthropic.activeProfileId, 'should have active profile');
    assert.equal(data.anthropic.profiles.length, 1);
    assert.equal(data.anthropic.profiles[0]?.mode, 'subscription');
  });

  it('stores api_key secret in secrets file but not in meta file', async () => {
    const created = await createProviderProfile(projectRoot, {
      provider: 'anthropic',
      name: 'sponsor',
      mode: 'api_key',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-secret-test',
      setActive: true,
    });
    assert.equal(created.mode, 'api_key');

    const metaPath = join(projectRoot, '.cat-cafe', 'provider-profiles.json');
    const secretsPath = join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json');
    const [metaRaw, secretsRaw] = await Promise.all([
      readFile(metaPath, 'utf-8'),
      readFile(secretsPath, 'utf-8'),
    ]);

    assert.ok(!metaRaw.includes('sk-secret-test'), 'meta should not contain api key');
    assert.ok(secretsRaw.includes('sk-secret-test'), 'secrets should contain api key');
  });

  it('activate + resolve returns active api_key runtime payload', async () => {
    const created = await createProviderProfile(projectRoot, {
      provider: 'anthropic',
      name: 'sponsor2',
      mode: 'api_key',
      baseUrl: 'https://api.sponsor.dev',
      apiKey: 'sk-sponsor-2',
      setActive: false,
    });

    await activateProviderProfile(projectRoot, 'anthropic', created.id);
    const runtime = await resolveAnthropicRuntimeProfile(projectRoot);
    assert.equal(runtime.mode, 'api_key');
    assert.equal(runtime.baseUrl, 'https://api.sponsor.dev');
    assert.equal(runtime.apiKey, 'sk-sponsor-2');
  });

  it('deleting active profile falls back to subscription profile', async () => {
    const sponsor = await createProviderProfile(projectRoot, {
      provider: 'anthropic',
      name: 'to-delete',
      mode: 'api_key',
      baseUrl: 'https://api.sponsor.dev',
      apiKey: 'sk-delete',
      setActive: true,
    });
    await deleteProviderProfile(projectRoot, 'anthropic', sponsor.id);

    const runtime = await resolveAnthropicRuntimeProfile(projectRoot);
    assert.equal(runtime.mode, 'subscription');
    assert.equal(runtime.apiKey, undefined);
  });

  it('readProviderProfiles does not rewrite files when state is already normalized', async () => {
    await readProviderProfiles(projectRoot);
    const metaPath = join(projectRoot, '.cat-cafe', 'provider-profiles.json');
    const secretsPath = join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json');
    const [metaBefore, secretsBefore] = await Promise.all([stat(metaPath), stat(secretsPath)]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await readProviderProfiles(projectRoot);

    const [metaAfter, secretsAfter] = await Promise.all([stat(metaPath), stat(secretsPath)]);
    assert.equal(metaAfter.mtimeMs, metaBefore.mtimeMs);
    assert.equal(secretsAfter.mtimeMs, secretsBefore.mtimeMs);
  });

  it('getProviderProfile does not rewrite files when state is already normalized', async () => {
    const created = await createProviderProfile(projectRoot, {
      provider: 'anthropic',
      name: 'readonly-check',
      mode: 'subscription',
    });
    const metaPath = join(projectRoot, '.cat-cafe', 'provider-profiles.json');
    const secretsPath = join(projectRoot, '.cat-cafe', 'provider-profiles.secrets.local.json');
    const [metaBefore, secretsBefore] = await Promise.all([stat(metaPath), stat(secretsPath)]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const profile = await getProviderProfile(projectRoot, 'anthropic', created.id);

    assert.ok(profile);
    const [metaAfter, secretsAfter] = await Promise.all([stat(metaPath), stat(secretsPath)]);
    assert.equal(metaAfter.mtimeMs, metaBefore.mtimeMs);
    assert.equal(secretsAfter.mtimeMs, secretsBefore.mtimeMs);
  });

  it('rejects blank profile name', async () => {
    await assert.rejects(
      createProviderProfile(projectRoot, {
        provider: 'anthropic',
        name: '   ',
        mode: 'subscription',
      }),
      /name is required/,
    );
  });
});
