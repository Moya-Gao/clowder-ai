import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const modulePath = '../dist/domains/signals/config/sources-loader.js';

describe('signal sources loader', () => {
  let tempRoot;
  let prevSignalsRoot;

  beforeEach(() => {
    tempRoot = mkdtempSync('/tmp/cat-cafe-signals-');
    prevSignalsRoot = process.env['SIGNALS_ROOT_DIR'];
    process.env['SIGNALS_ROOT_DIR'] = tempRoot;
  });

  afterEach(() => {
    if (prevSignalsRoot === undefined) {
      delete process.env['SIGNALS_ROOT_DIR'];
    } else {
      process.env['SIGNALS_ROOT_DIR'] = prevSignalsRoot;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates expected workspace directories', async () => {
    const { ensureSignalWorkspace, resolveSignalPaths } = await import(modulePath);

    const paths = resolveSignalPaths();
    await ensureSignalWorkspace(paths);

    assert.equal(existsSync(paths.rootDir), true);
    assert.equal(existsSync(paths.configDir), true);
    assert.equal(existsSync(paths.libraryDir), true);
    assert.equal(existsSync(paths.inboxDir), true);
    assert.equal(existsSync(paths.logsDir), true);
    assert.equal(existsSync(paths.sourcesFile), true);
  });

  it('loads default sources config when sources.yaml is empty', async () => {
    const { ensureSignalWorkspace, resolveSignalPaths, loadSignalSources } = await import(modulePath);

    const paths = resolveSignalPaths();
    await ensureSignalWorkspace(paths);
    writeFileSync(paths.sourcesFile, '', 'utf-8');

    const config = await loadSignalSources(paths);

    assert.equal(config.version, 1);
    assert.ok(config.sources.length > 0);
    assert.equal(config.sources[0].enabled, true);
  });

  it('parses valid YAML config', async () => {
    const { ensureSignalWorkspace, resolveSignalPaths, loadSignalSources } = await import(modulePath);

    const paths = resolveSignalPaths();
    await ensureSignalWorkspace(paths);

    writeFileSync(
      paths.sourcesFile,
      `version: 1\nsources:\n  - id: openai-rss\n    name: OpenAI RSS\n    url: https://openai.com/news/rss.xml\n    tier: 1\n    category: official\n    enabled: true\n    fetch:\n      method: rss\n    schedule:\n      frequency: daily\n`,
      'utf-8',
    );

    const config = await loadSignalSources(paths);

    assert.equal(config.sources.length, 1);
    assert.equal(config.sources[0].id, 'openai-rss');
    assert.equal(config.sources[0].fetch.method, 'rss');
  });

  it('throws on invalid schema', async () => {
    const { ensureSignalWorkspace, resolveSignalPaths, loadSignalSources } = await import(modulePath);

    const paths = resolveSignalPaths();
    await ensureSignalWorkspace(paths);

    writeFileSync(
      paths.sourcesFile,
      `version: 1\nsources:\n  - id: invalid\n    name: Invalid\n    url: https://example.com/feed\n    tier: 9\n    category: official\n    enabled: true\n    fetch:\n      method: rss\n    schedule:\n      frequency: daily\n`,
      'utf-8',
    );

    await assert.rejects(async () => {
      await loadSignalSources(paths);
    });
  });

  it('uses overridden root directory when provided', async () => {
    const { resolveSignalPaths } = await import(modulePath);

    const custom = join(tempRoot, 'custom-signals-home');
    const paths = resolveSignalPaths(custom);

    assert.equal(paths.rootDir, custom);
    assert.equal(paths.sourcesFile, join(custom, 'config', 'sources.yaml'));
  });

  it('falls back to default root when SIGNALS_ROOT_DIR is empty', async () => {
    const { resolveSignalPaths } = await import(modulePath);

    process.env['SIGNALS_ROOT_DIR'] = '';

    const paths = resolveSignalPaths();
    const expectedRoot = join(homedir(), '.cat-cafe', 'signals');

    assert.equal(paths.rootDir, expectedRoot);
  });
});
