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
