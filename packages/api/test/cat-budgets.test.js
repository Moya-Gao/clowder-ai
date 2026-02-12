/**
 * cat-budgets.ts tests
 * Per-cat context budget configuration
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getCatContextBudget, getAllCatBudgets, clearBudgetCache } from '../dist/config/cat-budgets.js';

describe('getCatContextBudget', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearBudgetCache();
    // Clear relevant env vars
    delete process.env.CAT_OPUS_MAX_PROMPT_CHARS;
    delete process.env.CAT_CODEX_MAX_PROMPT_CHARS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_CHARS;
    delete process.env.MAX_PROMPT_CHARS;
  });

  afterEach(() => {
    // Cleanup
    delete process.env.CAT_OPUS_MAX_PROMPT_CHARS;
    delete process.env.CAT_CODEX_MAX_PROMPT_CHARS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_CHARS;
    delete process.env.MAX_PROMPT_CHARS;
    clearBudgetCache();
  });

  it('opus default budget from cat-config.json', () => {
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptChars, 500000);
    assert.strictEqual(budget.maxContextChars, 300000);
    assert.strictEqual(budget.maxMessages, 200);
    assert.strictEqual(budget.maxContentLengthPerMsg, 10000);
  });

  it('codex default budget from cat-config.json', () => {
    const budget = getCatContextBudget('codex');
    assert.strictEqual(budget.maxPromptChars, 650000);
    assert.strictEqual(budget.maxContextChars, 400000);
    assert.strictEqual(budget.maxMessages, 200);
    assert.strictEqual(budget.maxContentLengthPerMsg, 10000);
  });

  it('gemini default budget from cat-config.json', () => {
    const budget = getCatContextBudget('gemini');
    assert.strictEqual(budget.maxPromptChars, 800000);
    assert.strictEqual(budget.maxContextChars, 500000);
    assert.strictEqual(budget.maxMessages, 300);
    assert.strictEqual(budget.maxContentLengthPerMsg, 15000);
  });

  it('per-cat env var overrides maxPromptChars', () => {
    process.env.CAT_OPUS_MAX_PROMPT_CHARS = '200000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptChars, 200000);
    // Other fields remain from JSON
    assert.strictEqual(budget.maxContextChars, 300000);
  });

  it('global MAX_PROMPT_CHARS fallback when no per-cat env', () => {
    process.env.MAX_PROMPT_CHARS = '100000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptChars, 100000);
  });

  it('per-cat env var takes priority over global MAX_PROMPT_CHARS', () => {
    process.env.CAT_OPUS_MAX_PROMPT_CHARS = '180000';
    process.env.MAX_PROMPT_CHARS = '100000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptChars, 180000);
  });

  it('all budget fields are positive numbers', () => {
    const cats = ['opus', 'codex', 'gemini'];
    for (const cat of cats) {
      const budget = getCatContextBudget(cat);
      assert.ok(budget.maxPromptChars > 0, `${cat} maxPromptChars > 0`);
      assert.ok(budget.maxContextChars > 0, `${cat} maxContextChars > 0`);
      assert.ok(budget.maxMessages > 0, `${cat} maxMessages > 0`);
      assert.ok(budget.maxContentLengthPerMsg > 0, `${cat} maxContentLengthPerMsg > 0`);
    }
  });
});

describe('getAllCatBudgets', () => {
  beforeEach(() => {
    clearBudgetCache();
    delete process.env.CAT_OPUS_MAX_PROMPT_CHARS;
    delete process.env.CAT_CODEX_MAX_PROMPT_CHARS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_CHARS;
    delete process.env.MAX_PROMPT_CHARS;
  });

  it('returns budgets for all three cats', () => {
    const budgets = getAllCatBudgets();
    assert.ok(budgets.opus, 'has opus');
    assert.ok(budgets.codex, 'has codex');
    assert.ok(budgets.gemini, 'has gemini');
    assert.strictEqual(Object.keys(budgets).length, 3);
  });
});
