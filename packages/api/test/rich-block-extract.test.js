import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRichFromText, isValidRichBlock } from '../dist/domains/cats/services/agents/routing/rich-block-extract.js';

describe('extractRichFromText', () => {
  it('returns original text when no cc_rich blocks', () => {
    const result = extractRichFromText('Hello world');
    assert.equal(result.cleanText, 'Hello world');
    assert.deepEqual(result.blocks, []);
  });

  it('extracts valid cc_rich block and returns clean text', () => {
    const input = `Here is the result:
\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"Summary","tone":"info"}]}
\`\`\`
Done.`;
    const result = extractRichFromText(input);
    assert.equal(result.cleanText, 'Here is the result:\n\nDone.');
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].id, 'b1');
    assert.equal(result.blocks[0].kind, 'card');
  });

  it('extracts multiple cc_rich blocks', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"A"}]}
\`\`\`
middle text
\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b2","kind":"diff","v":1,"filePath":"a.ts","diff":"+foo"}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 2);
    assert.equal(result.blocks[0].kind, 'card');
    assert.equal(result.blocks[1].kind, 'diff');
    assert.ok(result.cleanText.includes('middle text'));
    assert.ok(!result.cleanText.includes('cc_rich'));
  });

  it('ignores invalid JSON in cc_rich blocks', () => {
    const input = `\`\`\`cc_rich
{not valid json}
\`\`\`
after`;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
    // Invalid block is silently removed
    assert.equal(result.cleanText, '\nafter');
  });

  it('ignores cc_rich block with wrong version', () => {
    const input = `\`\`\`cc_rich
{"v":2,"blocks":[{"id":"b1","kind":"card"}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('skips blocks missing id or kind', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"kind":"card"},{"id":"b2"}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('skips card without title', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('skips checklist with non-array items', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"checklist","v":1,"items":"not-array"}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('skips checklist with malformed item (missing text)', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"checklist","v":1,"items":[{"id":"i1"}]}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('skips media_gallery with malformed item (missing url)', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"media_gallery","v":1,"items":[{"alt":"no url"}]}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
  });

  it('accepts valid checklist block', () => {
    const input = `\`\`\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"checklist","v":1,"items":[{"id":"i1","text":"Task 1"}]}]}
\`\`\``;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].kind, 'checklist');
  });
});

describe('isValidRichBlock', () => {
  it('rejects null/undefined/primitives', () => {
    assert.equal(isValidRichBlock(null), false);
    assert.equal(isValidRichBlock(undefined), false);
    assert.equal(isValidRichBlock('string'), false);
    assert.equal(isValidRichBlock(42), false);
  });

  it('rejects missing id or v', () => {
    assert.equal(isValidRichBlock({ kind: 'card', v: 1, title: 'X' }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', title: 'X' }), false);
  });

  it('rejects unknown kind', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'unknown', v: 1 }), false);
  });

  it('validates card requires title', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1 }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1, title: 'OK' }), true);
  });

  it('rejects card with malformed optional fields', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1, title: 'OK', fields: 'oops' }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1, title: 'OK', fields: [{ label: 'a' }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1, title: 'OK', bodyMarkdown: 123 }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'card', v: 1, title: 'OK', tone: 'invalid' }), false);
  });

  it('accepts card with valid optional fields', () => {
    assert.equal(isValidRichBlock({
      id: 'b1', kind: 'card', v: 1, title: 'OK',
      bodyMarkdown: 'text', tone: 'warning', fields: [{ label: 'a', value: 'b' }],
    }), true);
  });

  it('validates diff requires filePath + diff', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'diff', v: 1, filePath: 'a.ts' }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'diff', v: 1, diff: '+x' }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'diff', v: 1, filePath: 'a.ts', diff: '+x' }), true);
  });

  it('rejects diff with malformed languageHint', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'diff', v: 1, filePath: 'a.ts', diff: '+x', languageHint: 42 }), false);
  });

  it('validates checklist items shape', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'checklist', v: 1, items: 'bad' }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'checklist', v: 1, items: [{ id: 'i1' }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'checklist', v: 1, items: [{ id: 'i1', text: 'OK' }] }), true);
  });

  it('validates media_gallery items shape', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'media_gallery', v: 1, items: [{ alt: 'no url' }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'media_gallery', v: 1, items: [{ url: 'http://x' }] }), true);
  });

  it('rejects media_gallery item with non-string alt/caption', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'media_gallery', v: 1, items: [{ url: 'http://x', alt: 42 }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'media_gallery', v: 1, items: [{ url: 'http://x', caption: { bad: true } }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'media_gallery', v: 1, items: [{ url: 'http://x', alt: 'ok', caption: 'ok' }] }), true);
  });

  it('rejects checklist item with non-boolean checked', () => {
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'checklist', v: 1, items: [{ id: 'i1', text: 'OK', checked: 'yes' }] }), false);
    assert.equal(isValidRichBlock({ id: 'b1', kind: 'checklist', v: 1, items: [{ id: 'i1', text: 'OK', checked: true }] }), true);
  });
});
