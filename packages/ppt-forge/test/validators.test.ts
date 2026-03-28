import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateHexColor, validateSlotExists, validateWordCount } from '../src/validators.js';

describe('validateHexColor', () => {
  it('accepts valid 6-char hex without #', () => {
    assert.doesNotThrow(() => validateHexColor('CF0A2C'));
    assert.doesNotThrow(() => validateHexColor('FFFFFF'));
    assert.doesNotThrow(() => validateHexColor('000000'));
  });

  it('rejects hex with # prefix (pptxgenjs iron rule #1)', () => {
    assert.throws(() => validateHexColor('#CF0A2C'), /must not start with #/);
  });

  it('rejects 8-char hex (pptxgenjs iron rule #2)', () => {
    assert.throws(() => validateHexColor('CF0A2C20'), /must be exactly 6 characters/);
  });

  it('rejects invalid characters', () => {
    assert.throws(() => validateHexColor('ZZZZZZ'), /invalid hex/i);
  });
});

describe('validateSlotExists', () => {
  const slots = [
    { name: 'title', type: 'title' as const, position: { x: 0, y: 0, w: 8, h: 1 } },
    { name: 'body', type: 'body' as const, position: { x: 0, y: 1, w: 8, h: 4 } },
  ];

  it('returns slot when it exists', () => {
    const slot = validateSlotExists(slots, 'title');
    assert.equal(slot.name, 'title');
  });

  it('throws when slot does not exist', () => {
    assert.throws(() => validateSlotExists(slots, 'chart'), /not found/);
  });
});

describe('validateWordCount', () => {
  it('passes when under budget', () => {
    assert.doesNotThrow(() => validateWordCount('Hello world', 10));
  });

  it('warns but does not throw when over budget', () => {
    const warnings: string[] = [];
    validateWordCount('one two three four five six', 3, warnings);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('exceeds'));
  });

  it('counts CJK characters correctly (P1-1: 中文分词)', () => {
    const warnings: string[] = [];
    // 20 CJK chars ≈ 10 words equivalent, budget is 5
    validateWordCount('全球企业桌面正加速向云化迁移传统部署模式面临挑战', 5, warnings);
    assert.equal(warnings.length, 1, 'CJK text should trigger over-budget warning');
  });
});
