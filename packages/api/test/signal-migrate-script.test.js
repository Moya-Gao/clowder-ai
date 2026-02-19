import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const { parseMigrateSignalsArgs, runMigrateSignalsCli } = await import('../dist/scripts/migrate-signals.js');

function createIo() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    io: {
      log(message) {
        logs.push(String(message));
      },
      error(message) {
        errors.push(String(message));
      },
    },
  };
}

async function createLegacyFixture() {
  const root = await mkdtemp(join(tmpdir(), 'signal-hunter-legacy-'));

  await mkdir(join(root, 'config'), { recursive: true });
  await mkdir(join(root, 'library', 'anthropic'), { recursive: true });

  await writeFile(
    join(root, 'config', 'sources.yaml'),
    [
      'tier_1_primary:',
      '  anthropic:',
      '    name: "Anthropic"',
      '    type: "company_blog"',
      '    feeds:',
      '      - name: "Engineering Blog"',
      '        url: "https://www.anthropic.com/engineering"',
      '        type: "web"',
      '        check_frequency: "daily"',
      '',
    ].join('\n'),
    'utf-8',
  );

  await writeFile(
    join(root, 'library', 'anthropic', '20260123-building-multi-agent-systems.md'),
    [
      '---',
      'id: "anthropic-20260123-building-multi-agent-systems"',
      'title: "Building multi-agent systems: when and how to use them"',
      'url: "https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them"',
      'source: "Anthropic"',
      'tier: 1',
      'published: "2026-01-23"',
      'captured: "2026-02-03"',
      'status: "studying"',
      'tags: ["multi-agent", "architecture"]',
      '---',
      '',
      '# Legacy article',
      '',
      'Legacy body content.',
      '',
    ].join('\n'),
    'utf-8',
  );

  return root;
}

describe('migrate-signals script args', () => {
  it('parses --from/--to/--dry-run/--redis-url', () => {
    const args = parseMigrateSignalsArgs([
      '--from',
      '/tmp/legacy',
      '--to',
      '/tmp/signals',
      '--dry-run',
      '--redis-url',
      'redis://127.0.0.1:6398/15',
    ]);

    assert.equal(args.fromDir, '/tmp/legacy');
    assert.equal(args.toDir, '/tmp/signals');
    assert.equal(args.dryRun, true);
    assert.equal(args.redisUrl, 'redis://127.0.0.1:6398/15');
    assert.equal(args.help, false);
  });

  it('parses --help without requiring other flags', () => {
    const args = parseMigrateSignalsArgs(['--help']);

    assert.equal(args.help, true);
    assert.equal(args.dryRun, false);
    assert.equal(args.fromDir, undefined);
  });

  it('throws on unknown argument', () => {
    assert.throws(() => parseMigrateSignalsArgs(['--wat']), /unknown argument: --wat/);
  });

  it('throws when --from has no value', () => {
    assert.throws(() => parseMigrateSignalsArgs(['--from']), /--from requires a value/);
  });
});

describe('runMigrateSignalsCli', () => {
  it('dry-run does not write target signals workspace', async () => {
    const legacyRoot = await createLegacyFixture();
    const targetRoot = await mkdtemp(join(tmpdir(), 'cat-cafe-signals-'));
    const { io, logs, errors } = createIo();

    const code = await runMigrateSignalsCli(['--from', legacyRoot, '--to', targetRoot, '--dry-run'], io);

    assert.equal(code, 0);
    assert.equal(errors.length, 0);
    assert.match(logs.join('\n'), /dryRun=true/);
    assert.equal(existsSync(join(targetRoot, 'config', 'sources.yaml')), false);
    assert.equal(existsSync(join(targetRoot, 'inbox')), false);
  });

  it('writes migrated sources and articles when not dry-run', async () => {
    const legacyRoot = await createLegacyFixture();
    const targetRoot = await mkdtemp(join(tmpdir(), 'cat-cafe-signals-'));
    const { io, logs, errors } = createIo();

    const code = await runMigrateSignalsCli(['--from', legacyRoot, '--to', targetRoot], io);

    assert.equal(code, 0);
    assert.equal(errors.length, 0);

    const sourcesText = await readFile(join(targetRoot, 'config', 'sources.yaml'), 'utf-8');
    assert.match(sourcesText, /version:\s*1/);
    assert.match(sourcesText, /https:\/\/www\.anthropic\.com\/engineering/);

    const inboxFiles = await readFile(join(targetRoot, 'inbox', '2026-02-03.json'), 'utf-8');
    assert.match(inboxFiles, /anthropic-20260123-building-multi-agent-systems/);

    assert.match(logs.join('\n'), /migratedArticles=1/);
    assert.match(logs.join('\n'), /mergedSources=/);
  });
});
