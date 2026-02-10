/**
 * Dev-Loop Parser Tests
 *
 * parseReviewResult: APPROVED / NEEDS_FIX / mixed P levels / no VERDICT fallback
 * buildDevLoopSummary: with P3 / without P3 / multi-iteration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewResult, buildDevLoopSummary } from '../dist/domains/cats/services/modes/dev-loop-parser.js';

describe('parseReviewResult', () => {
  it('extracts APPROVED verdict', () => {
    const text = 'Looks good!\n\nVERDICT: APPROVED';
    const result = parseReviewResult(text);
    assert.equal(result.approved, true);
    assert.equal(result.p1.length, 0);
    assert.equal(result.p2.length, 0);
    assert.equal(result.p3.length, 0);
  });

  it('extracts NEEDS_FIX verdict with P1/P2 issues', () => {
    const text = [
      '[P1] Missing error handling in save()',
      '[P2] Variable naming inconsistent',
      '[P3] Consider adding JSDoc',
      '',
      'VERDICT: NEEDS_FIX',
    ].join('\n');
    const result = parseReviewResult(text);
    assert.equal(result.approved, false);
    assert.deepEqual(result.p1, ['Missing error handling in save()']);
    assert.deepEqual(result.p2, ['Variable naming inconsistent']);
    assert.deepEqual(result.p3, ['Consider adding JSDoc']);
  });

  it('handles multiple P items of same level', () => {
    const text = [
      '[P1] Bug A',
      '[P1] Bug B',
      '[P2] Issue C',
      'VERDICT: NEEDS_FIX',
    ].join('\n');
    const result = parseReviewResult(text);
    assert.equal(result.p1.length, 2);
    assert.equal(result.p2.length, 1);
    assert.equal(result.approved, false);
  });

  it('fallback: no VERDICT but has P1 → not approved', () => {
    const text = '[P1] Critical bug\nNo verdict line here.';
    const result = parseReviewResult(text);
    assert.equal(result.approved, false);
    assert.deepEqual(result.p1, ['Critical bug']);
  });

  it('fallback: no VERDICT and no P1/P2 → approved', () => {
    const text = 'Everything looks fine.\n[P3] Minor style nit';
    const result = parseReviewResult(text);
    assert.equal(result.approved, true);
    assert.deepEqual(result.p3, ['Minor style nit']);
  });

  it('case-insensitive VERDICT matching', () => {
    const text = 'verdict: approved';
    const result = parseReviewResult(text);
    assert.equal(result.approved, true);
  });

  it('empty text → approved (no issues found)', () => {
    const result = parseReviewResult('');
    assert.equal(result.approved, true);
    assert.equal(result.p1.length, 0);
  });
});

describe('buildDevLoopSummary', () => {
  it('generates summary with P3 issues', () => {
    const config = { requirement: 'Add login', leadCat: 'opus', reviewCat: 'codex' };
    const summary = buildDevLoopSummary(config, 2, ['Consider caching', 'Add docs']);
    assert.ok(summary.includes('开发自闭环完成'));
    assert.ok(summary.includes('Add login'));
    assert.ok(summary.includes('2 轮'));
    assert.ok(summary.includes('2 个 P3'));
    assert.ok(summary.includes('Consider caching'));
    assert.ok(summary.includes('Add docs'));
  });

  it('generates summary without P3 issues', () => {
    const config = { requirement: 'Fix bug', leadCat: 'opus', reviewCat: 'codex' };
    const summary = buildDevLoopSummary(config, 1, []);
    assert.ok(summary.includes('Fix bug'));
    assert.ok(summary.includes('1 轮'));
    assert.ok(summary.includes('无 P3'));
    assert.ok(!summary.includes('待铲屎官'));
  });

  it('includes cat info', () => {
    const config = { requirement: 'Test', leadCat: 'gemini', reviewCat: 'opus' };
    const summary = buildDevLoopSummary(config, 3, []);
    assert.ok(summary.includes('@gemini'));
    assert.ok(summary.includes('@opus'));
  });
});
