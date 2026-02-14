import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasHindsightIncludeDirective,
  stripMarkdownFrontmatter,
} from '../../dist/domains/cats/services/hindsight-import/p0-markdown-parser.js';

test('hasHindsightIncludeDirective returns true when frontmatter sets hindsight: include', () => {
  const content = [
    '---',
    'title: discussion sample',
    'hindsight: include',
    '---',
    '',
    '# Discussion',
  ].join('\n');

  assert.equal(hasHindsightIncludeDirective(content), true);
});

test('hasHindsightIncludeDirective returns false without include marker', () => {
  const noFrontmatter = '# Discussion\nBody';
  assert.equal(hasHindsightIncludeDirective(noFrontmatter), false);

  const otherMarker = [
    '---',
    'title: discussion sample',
    'hindsight: skip',
    '---',
    '',
    '# Discussion',
  ].join('\n');
  assert.equal(hasHindsightIncludeDirective(otherMarker), false);
});

test('stripMarkdownFrontmatter removes YAML header from markdown body', () => {
  const content = [
    '---',
    'title: discussion sample',
    'hindsight: include',
    '---',
    '',
    '# Discussion',
    'Body line',
  ].join('\n');

  const stripped = stripMarkdownFrontmatter(content);
  assert.equal(stripped.startsWith('---'), false);
  assert.ok(stripped.includes('# Discussion'));
  assert.ok(stripped.includes('Body line'));
});
