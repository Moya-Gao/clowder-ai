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
    delete process.env.CAT_OPUS_MAX_PROMPT_TOKENS;
    delete process.env.CAT_CODEX_MAX_PROMPT_TOKENS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_TOKENS;
    delete process.env.MAX_PROMPT_TOKENS;
  });

  afterEach(() => {
    // Cleanup
    delete process.env.CAT_OPUS_MAX_PROMPT_TOKENS;
    delete process.env.CAT_CODEX_MAX_PROMPT_TOKENS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_TOKENS;
    delete process.env.MAX_PROMPT_TOKENS;
    clearBudgetCache();
  });

  it('opus default budget from cat-config.json', () => {
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptTokens, 150000);
    assert.strictEqual(budget.maxContextTokens, 100000);
    assert.strictEqual(budget.maxMessages, 200);
    assert.strictEqual(budget.maxContentLengthPerMsg, 10000);
  });

  it('codex default budget from cat-config.json', () => {
    const budget = getCatContextBudget('codex');
    assert.strictEqual(budget.maxPromptTokens, 100000);
    assert.strictEqual(budget.maxContextTokens, 60000);
    assert.strictEqual(budget.maxMessages, 200);
    assert.strictEqual(budget.maxContentLengthPerMsg, 10000);
  });

  it('gemini default budget from cat-config.json', () => {
    const budget = getCatContextBudget('gemini');
    assert.strictEqual(budget.maxPromptTokens, 200000);
    assert.strictEqual(budget.maxContextTokens, 150000);
    assert.strictEqual(budget.maxMessages, 300);
    assert.strictEqual(budget.maxContentLengthPerMsg, 15000);
  });

  it('per-cat env var overrides maxPromptTokens', () => {
    process.env.CAT_OPUS_MAX_PROMPT_TOKENS = '200000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptTokens, 200000);
    // Other fields remain from JSON
    assert.strictEqual(budget.maxContextTokens, 100000);
  });

  it('global MAX_PROMPT_TOKENS fallback when no per-cat env', () => {
    process.env.MAX_PROMPT_TOKENS = '100000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptTokens, 100000);
  });

  it('per-cat env var takes priority over global MAX_PROMPT_TOKENS', () => {
    process.env.CAT_OPUS_MAX_PROMPT_TOKENS = '180000';
    process.env.MAX_PROMPT_TOKENS = '100000';
    clearBudgetCache();
    const budget = getCatContextBudget('opus');
    assert.strictEqual(budget.maxPromptTokens, 180000);
  });

  it('all budget fields are positive numbers', () => {
    const cats = ['opus', 'codex', 'gemini'];
    for (const cat of cats) {
      const budget = getCatContextBudget(cat);
      assert.ok(budget.maxPromptTokens > 0, `${cat} maxPromptTokens > 0`);
      assert.ok(budget.maxContextTokens > 0, `${cat} maxContextTokens > 0`);
      assert.ok(budget.maxMessages > 0, `${cat} maxMessages > 0`);
      assert.ok(budget.maxContentLengthPerMsg > 0, `${cat} maxContentLengthPerMsg > 0`);
    }
  });
});

describe('getAllCatBudgets', () => {
  beforeEach(() => {
    clearBudgetCache();
    delete process.env.CAT_OPUS_MAX_PROMPT_TOKENS;
    delete process.env.CAT_CODEX_MAX_PROMPT_TOKENS;
    delete process.env.CAT_GEMINI_MAX_PROMPT_TOKENS;
    delete process.env.MAX_PROMPT_TOKENS;
  });

  it('returns budgets for all three cats', () => {
    const budgets = getAllCatBudgets();
    assert.ok(budgets.opus, 'has opus');
    assert.ok(budgets.codex, 'has codex');
    assert.ok(budgets.gemini, 'has gemini');
    assert.strictEqual(Object.keys(budgets).length, 3);
  });
});
