/**
 * A2A Mention Detection + Prompt Injection Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('parseA2AMentions', () => {
  it('detects line-start @mention (Chinese name)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const result = parseA2AMentions('@缅因猫 请 review 这段代码', 'opus');
    assert.deepEqual(result, ['codex']);
  });

  it('detects line-start @mention with leading whitespace', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const result = parseA2AMentions('  @布偶猫 你觉得呢？', 'codex');
    assert.deepEqual(result, ['opus']);
  });

  it('does NOT trigger for non-line-start @mention', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const result = parseA2AMentions('之前布偶猫说的 @布偶猫 方案不错', 'codex');
    assert.deepEqual(result, []);
  });

  it('ignores @mention inside fenced code blocks', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const text = '看看这段代码：\n```\n@缅因猫 请review\n```\n没问题';
    const result = parseA2AMentions(text, 'opus');
    assert.deepEqual(result, []);
  });

  it('filters self-mention', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const result = parseA2AMentions('@布偶猫 我自己说的', 'opus');
    assert.deepEqual(result, []);
  });

  it('F27: returns all matches (multi-mention, up to 2)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    // Both on separate lines — F27 returns both
    const text = '@缅因猫 先review\n@暹罗猫 再看看设计';
    const result = parseA2AMentions(text, 'opus');
    assert.equal(result.length, 2);
    assert.ok(result.includes('codex'));
    assert.ok(result.includes('gemini'));
  });

  it('returns empty array for empty text', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    assert.deepEqual(parseA2AMentions('', 'opus'), []);
  });

  it('matches English mention patterns', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/a2a-mentions.js');
    const result = parseA2AMentions('@codex please review', 'opus');
    assert.deepEqual(result, ['codex']);
  });
});

describe('SystemPromptBuilder A2A injection', () => {
  it('includes A2A section when a2aEnabled and serial mode', async () => {
    const { buildSystemPrompt } = await import('../dist/domains/cats/services/context/SystemPromptBuilder.js');
    const prompt = buildSystemPrompt({
      catId: 'opus',
      mode: 'serial',
      teammates: ['codex', 'gemini'],
      mcpAvailable: false,
      a2aEnabled: true,
    });
    assert.ok(prompt.includes('协作'), 'should include 协作 section');
    assert.ok(prompt.includes('@队友'), 'should include @队友 instruction');
  });

  it('parallel mode uses independent thinking context (collaboration guide still present)', async () => {
    const { buildSystemPrompt } = await import('../dist/domains/cats/services/context/SystemPromptBuilder.js');
    const prompt = buildSystemPrompt({
      catId: 'opus',
      mode: 'parallel',
      teammates: ['codex', 'gemini'],
      mcpAvailable: false,
      a2aEnabled: true,
    });
    // Static collaboration guide is always present (cats should always know how to @)
    assert.ok(prompt.includes('## 协作'), 'should include static collaboration guide');
    // Parallel mode should indicate independent thinking
    assert.ok(prompt.includes('独立思考'), 'should indicate independent thinking in parallel mode');
  });

  it('includes A2A section even with empty teammates (single-cat scenario)', async () => {
    const { buildSystemPrompt } = await import('../dist/domains/cats/services/context/SystemPromptBuilder.js');
    // Single-cat: only opus in worklist, teammates = []
    const prompt = buildSystemPrompt({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
      a2aEnabled: true,
    });
    assert.ok(prompt.includes('协作'), 'should include 协作 even with empty teammates');
    assert.ok(prompt.includes('@缅因猫'), 'should list codex as callable');
    assert.ok(prompt.includes('@暹罗猫'), 'should list gemini as callable');
    assert.ok(!prompt.includes('@布偶猫'), 'should NOT list self as callable');
  });
});
