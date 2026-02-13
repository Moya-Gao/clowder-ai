import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImportItemsFromMarkdown,
} from '../dist/domains/cats/services/hindsight-import/p0-importer.js';

test('buildImportItemsFromMarkdown emits ADR retain items with required tags', () => {
  const items = buildImportItemsFromMarkdown({
    sourcePath: 'docs/decisions/005-hindsight-integration-decisions.md',
    sourceCommit: 'abc1234',
    author: 'codex',
    content: [
      '# ADR-005 Hindsight Integration Decisions',
      '',
      '## 问题1：是否启用 Hindsight',
      '结论：启用。',
      '',
      '## 问题2：使用单一 shared bank',
      '结论：使用单一 shared bank。',
    ].join('\n'),
  });

  assert.ok(items.length >= 2);
  assert.ok(items[0].tags.some((tag) => tag.startsWith('project:cat-cafe')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('kind:')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('status:')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('author:')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('origin:git')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('sourcePath:')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('sourceCommit:')));
  assert.ok(items[0].tags.some((tag) => tag.startsWith('anchor:adr:005#')));
  assert.equal(items[0].document_id, 'adr:005');
});

test('buildImportItemsFromMarkdown imports only LL entries from lessons-learned.md', () => {
  const items = buildImportItemsFromMarkdown({
    sourcePath: 'docs/lessons-learned.md',
    sourceCommit: 'abc1234',
    author: 'codex',
    content: [
      '# Lessons Learned',
      '',
      '## 1) 模板',
      '这里是模板，不应导入。',
      '',
      '### LL-101: 第一条教训',
      '- 状态：draft',
      '- 来源锚点：`docs/a.md#L1` | `docs/b.md#L2`',
      '- 关联：LL-001 | docs/x.md',
      '',
      '### LL-102: 第二条教训',
      '- 状态：validated',
      '- 来源锚点：`docs/c.md#L9`',
      '- 关联：LL-050',
      '',
      '## 8) 维护约定',
      '这里也不应导入。',
    ].join('\n'),
  });

  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.tags.some((tag) => tag.startsWith('anchor:ll:'))));

  const first = items[0];
  assert.equal(first.metadata?.status, 'draft');
  assert.deepEqual(JSON.parse(first.metadata?.sourceAnchors ?? '[]'), ['docs/a.md#L1', 'docs/b.md#L2']);
  assert.deepEqual(JSON.parse(first.metadata?.related ?? '[]'), ['LL-001', 'docs/x.md']);
  assert.equal((first.content.match(/LL-101: 第一条教训/g) ?? []).length, 1, 'lesson heading must not be duplicated in content');

  const second = items[1];
  assert.equal(second.metadata?.status, 'validated');
  assert.deepEqual(JSON.parse(second.metadata?.sourceAnchors ?? '[]'), ['docs/c.md#L9']);
});
