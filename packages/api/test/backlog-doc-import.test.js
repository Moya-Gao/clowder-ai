import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('backlog-doc-import parser', () => {
  test('accepts markdown rows without trailing pipe', async () => {
    const { parseActiveFeaturesFromBacklog } = await import('../dist/routes/backlog-doc-import.js');
    const markdown = [
      '| ID | 名称 | Status | Owner | Link |',
      '|----|------|--------|-------|------|',
      '| F010 | A | in-progress | 三猫 | [F010](a)',
    ].join('\n');

    const rows = parseActiveFeaturesFromBacklog(markdown);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'F010');
  });

  test('skips blank lines inside table body', async () => {
    const { parseActiveFeaturesFromBacklog } = await import('../dist/routes/backlog-doc-import.js');
    const markdown = [
      '| ID | 名称 | Status | Owner | Link |',
      '|----|------|--------|-------|------|',
      '| F010 | A | in-progress | 三猫 | [F010](a) |',
      '',
      '| F011 | B | spec | 三猫 | [F011](b) |',
    ].join('\n');

    const rows = parseActiveFeaturesFromBacklog(markdown);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 'F010');
    assert.equal(rows[1].id, 'F011');
  });

  test('accepts header rows without trailing pipe', async () => {
    const { parseActiveFeaturesFromBacklog } = await import('../dist/routes/backlog-doc-import.js');
    const markdown = [
      '| ID | 名称 | Status | Owner | Link',
      '|----|------|--------|-------|------|',
      '| F010 | A | in-progress | 三猫 | [F010](a)',
    ].join('\n');

    const rows = parseActiveFeaturesFromBacklog(markdown);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'F010');
  });
});

describe('parseFeatureDocStatus', () => {
  test('returns done for Status: done in markdown', async () => {
    const { parseFeatureDocStatus } = await import('../dist/routes/backlog-doc-import.js');
    const md = '> **Status**: done\n> **Owner**: 布偶猫';
    assert.strictEqual(parseFeatureDocStatus(md), 'done');
  });

  test('returns spec for Status: spec', async () => {
    const { parseFeatureDocStatus } = await import('../dist/routes/backlog-doc-import.js');
    const md = '> **Status**: spec\n';
    assert.strictEqual(parseFeatureDocStatus(md), 'spec');
  });

  test('returns null for no Status line', async () => {
    const { parseFeatureDocStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(parseFeatureDocStatus('# Title\n\nNo status here'), null);
  });
});

describe('parseFeatureDocDependencies', () => {
  test('extracts evolvedFrom and related from frontmatter + body', async () => {
    const { parseFeatureDocDependencies } = await import('../dist/routes/backlog-doc-import.js');
    const md = [
      '---',
      'feature_ids: [F058]',
      'related_features: [F049, F037]',
      '---',
      '',
      '## Dependencies',
      '',
      '- **Evolved from**: F049（Mission Control MVP）',
      '- **Related**: F037（Agent Swarm）',
    ].join('\n');
    const deps = parseFeatureDocDependencies(md);
    assert.deepStrictEqual(deps.evolvedFrom, ['f049']);
    assert.deepStrictEqual(deps.related, ['f037']);
  });

  test('extracts blockedBy', async () => {
    const { parseFeatureDocDependencies } = await import('../dist/routes/backlog-doc-import.js');
    const md = [
      '---',
      'feature_ids: [F099]',
      '---',
      '',
      '- **Blocked by**: F052',
    ].join('\n');
    const deps = parseFeatureDocDependencies(md);
    assert.deepStrictEqual(deps.blockedBy, ['f052']);
  });

  test('returns empty object for no dependencies', async () => {
    const { parseFeatureDocDependencies } = await import('../dist/routes/backlog-doc-import.js');
    const md = '# Title\n\nNo deps here';
    const deps = parseFeatureDocDependencies(md);
    assert.deepStrictEqual(deps, {});
  });
});

describe('featureStatusToBacklogStatus', () => {
  test('maps in-progress to dispatched', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('in-progress'), 'dispatched');
  });

  test('maps in-review to dispatched', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('in-review'), 'dispatched');
  });

  test('maps done to done', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('done'), 'done');
  });

  test('maps spec to open', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('spec'), 'open');
  });

  test('maps idea to open', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('idea'), 'open');
  });

  test('maps done (Phase 1) to dispatched', async () => {
    const { featureStatusToBacklogStatus } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(featureStatusToBacklogStatus('done (Phase 1)'), 'dispatched');
  });
});

describe('buildBacklogInputFromFeature initialStatus', () => {
  test('in-progress feature gets initialStatus dispatched', async () => {
    const { buildBacklogInputFromFeature } = await import('../dist/routes/backlog-doc-import.js');
    const row = { id: 'F064', name: 'A2A Exit Check', status: 'in-progress', owner: '布偶猫', link: 'features/F064.md' };
    const input = buildBacklogInputFromFeature(row, 'user1');
    assert.strictEqual(input.initialStatus, 'dispatched');
  });

  test('spec feature gets no initialStatus (defaults to open)', async () => {
    const { buildBacklogInputFromFeature } = await import('../dist/routes/backlog-doc-import.js');
    const row = { id: 'F055', name: 'Routing', status: 'spec', owner: '布偶猫' };
    const input = buildBacklogInputFromFeature(row, 'user1');
    assert.strictEqual(input.initialStatus, undefined);
  });

  test('in-review feature gets initialStatus dispatched', async () => {
    const { buildBacklogInputFromFeature } = await import('../dist/routes/backlog-doc-import.js');
    const row = { id: 'F063', name: 'Hub Explorer', status: 'in-review', owner: '布偶猫' };
    const input = buildBacklogInputFromFeature(row, 'user1');
    assert.strictEqual(input.initialStatus, 'dispatched');
  });
});

describe('parseFeatureDocName', () => {
  test('extracts name from heading like # F049: Mission Hub — Backlog Center', async () => {
    const { parseFeatureDocName } = await import('../dist/routes/backlog-doc-import.js');
    const md = '# F049: Mission Hub — Backlog Center\n\n> **Status**: done';
    assert.strictEqual(parseFeatureDocName(md), 'Mission Hub — Backlog Center');
  });

  test('returns null for no heading', async () => {
    const { parseFeatureDocName } = await import('../dist/routes/backlog-doc-import.js');
    assert.strictEqual(parseFeatureDocName('No heading here'), null);
  });

  test('extracts from heading with extra whitespace', async () => {
    const { parseFeatureDocName } = await import('../dist/routes/backlog-doc-import.js');
    const md = '#  F058:  Mission Control 增强  \n';
    assert.strictEqual(parseFeatureDocName(md), 'Mission Control 增强');
  });
});
