import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRichFromText, isValidRichBlock, normalizeRichBlock, isRichBlockCandidate } from '../dist/domains/cats/services/agents/routing/rich-block-extract.js';

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

// #85 T1-T4: normalizeRichBlock
describe('normalizeRichBlock', () => {
  it('T1: maps type → kind for valid kinds', () => {
    const obj = { id: 'b1', type: 'card', v: 1, title: 'Hi' };
    const result = normalizeRichBlock(obj);
    assert.equal(result.kind, 'card');
    assert.equal(result.type, undefined);
  });

  it('T2: auto-fills v: 1 when missing', () => {
    const obj = { id: 'b1', kind: 'card', title: 'Hi' };
    const result = normalizeRichBlock(obj);
    assert.equal(result.v, 1);
  });

  it('T3: does not convert non-rich objects', () => {
    // Object with type that is NOT a valid kind
    const obj = { id: 'x', type: 'button', label: 'Click' };
    const result = normalizeRichBlock(obj);
    assert.equal(result.type, 'button');
    assert.equal(result.kind, undefined);
  });

  it('T3b: passes through primitives unchanged', () => {
    assert.equal(normalizeRichBlock(null), null);
    assert.equal(normalizeRichBlock('hello'), 'hello');
    assert.equal(normalizeRichBlock(42), 42);
  });

  it('T4: does not overwrite existing kind', () => {
    const obj = { id: 'b1', kind: 'diff', type: 'card', v: 1, filePath: 'a.ts', diff: '+x' };
    const result = normalizeRichBlock(obj);
    assert.equal(result.kind, 'diff');
    // type is preserved when kind already exists
    assert.equal(result.type, 'card');
  });

  it('combines type→kind + auto v for full normalization', () => {
    const obj = { id: 'b1', type: 'checklist', items: [{ id: 'i1', text: 'Task' }] };
    const result = normalizeRichBlock(obj);
    assert.equal(result.kind, 'checklist');
    assert.equal(result.v, 1);
    assert.equal(result.type, undefined);
  });
});

// #85 T5-T6: bare JSON array strong-match extraction
describe('extractRichFromText bare JSON tolerance', () => {
  it('T5: extracts bare JSON array with valid rich blocks', () => {
    const input = JSON.stringify([
      { id: 'b1', type: 'card', title: 'Summary', bodyMarkdown: '**bold**' },
    ]);
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].kind, 'card');
    assert.equal(result.blocks[0].v, 1);
    assert.equal(result.cleanText, '');
  });

  it('T6a: does not extract bare JSON when elements lack id+kind/type', () => {
    const input = JSON.stringify([{ name: 'foo', value: 42 }]);
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
    assert.equal(result.cleanText, input);
  });

  it('T6b: does not extract bare JSON embedded in normal text', () => {
    const input = `Here is some JSON: [{"id":"b1","type":"card","title":"X"}] and more text`;
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 0);
    assert.ok(result.cleanText.includes('Here is some JSON'));
  });

  it('T6c: mixed array (some valid, some not) keeps original text (cloud P1)', () => {
    // Array where first element is a valid card, second has unknown type "event"
    const input = JSON.stringify([
      { id: 'b1', type: 'card', title: 'ok' },
      { id: 'x', type: 'event', payload: 1 },
    ]);
    const result = extractRichFromText(input);
    // Must NOT extract partial blocks — keep original text intact
    assert.equal(result.blocks.length, 0);
    assert.equal(result.cleanText, input);
  });

  it('T5b: bare JSON with normalize applies type→kind and auto v', () => {
    const input = JSON.stringify([
      { id: 'b1', type: 'diff', filePath: 'a.ts', diff: '+x' },
      { id: 'b2', type: 'card', title: 'Test' },
    ]);
    const result = extractRichFromText(input);
    assert.equal(result.blocks.length, 2);
    assert.equal(result.blocks[0].kind, 'diff');
    assert.equal(result.blocks[1].kind, 'card');
    // Both should have v: 1 auto-filled
    assert.equal(result.blocks[0].v, 1);
    assert.equal(result.blocks[1].v, 1);
  });
});
