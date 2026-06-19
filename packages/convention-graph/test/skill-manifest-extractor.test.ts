import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillManifestPlugin } from '../src/extractors/skill-manifest.ts';
import type { SourceFile } from '../src/plugin.ts';

const SKILL_FIXTURE: SourceFile[] = [
  {
    path: 'cat-cafe-skills/tdd/SKILL.md',
    content: `---
name: tdd
description: >
  Red-Green-Refactor 测试驱动开发纪律。
triggers:
  - "写代码"
  - "TDD"
---

# TDD
`,
  },
];

test('抽取 skill_manifest + trigger 约定边（第二类 cat-cafe convention）', () => {
  const result = skillManifestPlugin.extract({ repo: 'cat-cafe', files: SKILL_FIXTURE });
  const skill = result.nodes.find((n) => n.kind === 'skill_manifest');
  assert.equal(skill?.name, 'tdd');
  assert.equal(skill?.filePath, 'cat-cafe-skills/tdd/SKILL.md');
  assert.deepEqual(skill?.metadata?.triggers, ['写代码', 'TDD']);

  const trigger = result.nodes.find((n) => n.kind === 'skill_trigger' && n.name === '写代码');
  assert.ok(trigger);
  const edge = result.edges.find((e) => e.kind === 'triggers' && e.source === trigger.id && e.target === skill?.id);
  assert.ok(edge);
  assert.equal(edge.provenance.extractor, 'skill-manifest-extractor');
  assert.equal(edge.provenance.sourceFile, 'cat-cafe-skills/tdd/SKILL.md');
  assert.equal(edge.provenance.sourceLine, 6);
});

test('negative fixture：普通 markdown 不被误抽成 skill', () => {
  const result = skillManifestPlugin.extract({
    repo: 'cat-cafe',
    files: [{ path: 'docs/random/SKILL.md', content: '# Not a skill\n\nname: fake\n' }],
  });
  assert.equal(result.nodes.length, 0);
  assert.equal(result.edges.length, 0);
});
