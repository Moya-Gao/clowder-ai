#!/usr/bin/env node

// Unit tests for hotfix keyword detection (F177 Phase E).
// Tests the HOTFIX_KEYWORDS patterns in isolation without git dependency.

import assert from 'node:assert';
import { describe, it } from 'node:test';

const HOTFIX_KEYWORDS = [
  /\bfix:/i,
  /\bhotfix:/i,
  /\bquick\s*fix\b/i,
  /\bminimal\s*fix\b/i,
  /\bband[- ]?aid\b/i,
  /\btemp(orary)?\s*(fix|patch|workaround|solution|hack)\b/i,
  /\bworkaround\b/i,
];

function matchesHotfix(text) {
  return HOTFIX_KEYWORDS.some((re) => re.test(text));
}

describe('hotfix keyword detection', () => {
  const shouldMatch = [
    'fix: redis connection timeout',
    'hotfix: urgent auth bypass',
    'quick fix for login crash',
    'minimal fix for null pointer',
    'band-aid for memory leak',
    'bandaid solution',
    'band aid patch',
    'workaround for flaky test',
    'temp fix for deployment',
    'temporary fix for CI',
    'temporary hack to unblock deploy',
    'temp workaround for upstream bug',
    'temp patch for regression',
    'temporary solution pending redesign',
    'Fix: uppercase prefix',
    'HOTFIX: critical security patch',
  ];

  for (const text of shouldMatch) {
    it(`matches: "${text}"`, () => {
      assert.ok(matchesHotfix(text), `Expected match for: ${text}`);
    });
  }

  const shouldNotMatch = [
    'feat: add temp file cleanup',
    'refactor: rename template variable',
    'docs: update README temp section',
    'fix(redis): improve connection pool',
    'chore: clean temp directory',
    'feat: temporary storage migration',
    'test: add template rendering test',
    'style: fix formatting in template.ts',
    'perf: optimize temperature calculation',
  ];

  for (const text of shouldNotMatch) {
    it(`does NOT match: "${text}"`, () => {
      assert.ok(!matchesHotfix(text), `Unexpected match for: ${text}`);
    });
  }

  it('fix(redis) with scope does NOT match (conventional commit scope, not hotfix)', () => {
    assert.ok(!matchesHotfix('fix(redis): improve connection pool'));
  });
});

describe('autoLabel eligibility logic', () => {
  const MAX_SINGLE_FILE_LINES = 50;

  function computeAutoLabel(isHotfix, codeFileCount, totalAdditions) {
    const isSingleFile = codeFileCount === 1;
    const isSmallChange = totalAdditions <= MAX_SINGLE_FILE_LINES;
    return isHotfix && isSingleFile && isSmallChange;
  }

  it('single file ≤50 lines + hotfix = auto-label', () => {
    assert.strictEqual(computeAutoLabel(true, 1, 30), true);
  });

  it('single file exactly 50 lines + hotfix = auto-label', () => {
    assert.strictEqual(computeAutoLabel(true, 1, 50), true);
  });

  it('single file >50 lines + hotfix = NO auto-label', () => {
    assert.strictEqual(computeAutoLabel(true, 1, 51), false);
  });

  it('multi-file + hotfix = NO auto-label', () => {
    assert.strictEqual(computeAutoLabel(true, 3, 20), false);
  });

  it('single file ≤50 lines but NOT hotfix = NO auto-label', () => {
    assert.strictEqual(computeAutoLabel(false, 1, 10), false);
  });
});
