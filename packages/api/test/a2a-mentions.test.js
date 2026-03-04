/**
 * A2A Mention Detection + Prompt Injection Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { catRegistry } from '@cat-cafe/shared';

describe('parseA2AMentions', () => {
  it('detects line-start @mention (Chinese name)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@缅因猫 请 review 这段代码', 'opus');
    assert.deepEqual(result, ['codex']);
  });

  it('accepts line-start @mention without a separating space (Chinese handle)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@缅因猫请 review 这段代码', 'opus');
    assert.deepEqual(result, ['codex']);
  });

  it('detects line-start @mention with leading whitespace when action words exist', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('  @布偶猫 请确认这个修复', 'codex');
    assert.deepEqual(result, ['opus']);
  });

  it('routes when action words are in next line of same paragraph', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n请 review 这个 PR';
    const result = parseA2AMentions(text, 'codex');
    assert.deepEqual(result, ['opus']);
  });

  it('does NOT route mention-only paragraph without action words', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@布偶猫', 'codex');
    assert.deepEqual(result, []);
  });

  it('does NOT route when action words are outside mention paragraph', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n\n请 review 这个 PR';
    const result = parseA2AMentions(text, 'codex');
    assert.deepEqual(result, []);
  });

  it('relaxed mode: routes when action words are in the next paragraph with one blank line', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n\n请 review 这个 PR';
    const result = parseA2AMentions(text, 'codex', { mode: 'relaxed' });
    assert.deepEqual(result, ['opus']);
  });

  it('relaxed mode: routes all mentions in the same mention paragraph when next paragraph has action words', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n@缅因猫\n\n请 review 这个 PR';
    const result = parseA2AMentions(text, 'gpt52', { mode: 'relaxed' });
    assert.deepEqual(result, ['opus', 'codex']);
  });

  it('relaxed mode: still does NOT route when action words are too far (two blank lines)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n\n\n请 review 这个 PR';
    const result = parseA2AMentions(text, 'codex', { mode: 'relaxed' });
    assert.deepEqual(result, []);
  });

  it('records suppression reason=no_action when mention paragraph has no action keywords', async () => {
    const { analyzeA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = analyzeA2AMentions('@布偶猫', 'codex');
    assert.deepEqual(result.mentions, []);
    assert.deepEqual(result.suppressed, [{ catId: 'opus', reason: 'no_action' }]);
  });

  it('records suppression reason=cross_paragraph when action keywords are in a different paragraph', async () => {
    const { analyzeA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n\n请 review 这个 PR';
    const result = analyzeA2AMentions(text, 'codex');
    assert.deepEqual(result.mentions, []);
    assert.deepEqual(result.suppressed, [{ catId: 'opus', reason: 'cross_paragraph' }]);
  });

  it('clears stale suppression when later mention to same cat is actionable', async () => {
    const { analyzeA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '@布偶猫\n\n@布偶猫 请 review 这个 PR';
    const result = analyzeA2AMentions(text, 'codex');
    assert.deepEqual(result.mentions, ['opus']);
    assert.deepEqual(result.suppressed, []);
  });

  it('does NOT route on action keyword substring collisions (prefix should not match fix)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@布偶猫 prefix typo', 'codex');
    assert.deepEqual(result, []);
  });

  it('does NOT trigger for non-line-start @mention', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('之前布偶猫说的 @布偶猫 方案不错', 'codex');
    assert.deepEqual(result, []);
  });

  it('ignores @mention inside fenced code blocks', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const text = '看看这段代码：\n```\n@缅因猫 请review\n```\n没问题';
    const result = parseA2AMentions(text, 'opus');
    assert.deepEqual(result, []);
  });

  it('filters self-mention', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@布偶猫 我自己说的', 'opus');
    assert.deepEqual(result, []);
  });

  it('F27: returns all matches (multi-mention, up to 2)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    // Both on separate lines — F27 returns both
    const text = '@缅因猫 先review\n@暹罗猫 再看看设计';
    const result = parseA2AMentions(text, 'opus');
    assert.equal(result.length, 2);
    assert.ok(result.includes('codex'));
    assert.ok(result.includes('gemini'));
  });

  it('returns empty array for empty text', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    assert.deepEqual(parseA2AMentions('', 'opus'), []);
  });

  it('matches English mention patterns', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@codex please review', 'opus');
    assert.deepEqual(result, ['codex']);
  });

  it('accepts line-start @mention without a separating space (English handle + CJK)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions('@codex请看', 'opus');
    assert.deepEqual(result, ['codex']);
  });

  it('matches gpt52 variant alias @gpt5.2 from runtime cat-config', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const result = parseA2AMentions('@gpt5.2 帮忙看下', 'codex');
      assert.deepEqual(result, ['gpt52']);
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  it('does not prefix-match variant handles (@opus-45 should not match @opus)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const result = parseA2AMentions('@opus-45 请看', 'gpt52');
      assert.deepEqual(result, ['opus-45']);
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  it('keeps true first two targets without prefix collision side effects', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const text = '@opus-45 请看一下\n@gemini25 please review';
      const result = parseA2AMentions(text, 'gpt52');
      assert.deepEqual(result, ['opus-45', 'gemini25']);
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });
});

describe('F052: cross-thread self-reference exemption', () => {
  it('parseA2AMentions with undefined currentCatId does not filter any cat', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions(
      '@codex 请处理这个任务',
      undefined,
    );
    assert.ok(result.includes('codex'), 'should include codex when currentCatId is undefined');
  });

  it('parseA2AMentions with currentCatId still filters self', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions(
      '@codex 请处理这个任务',
      'codex',
    );
    assert.ok(!result.includes('codex'), 'should NOT include codex when it is currentCatId');
  });

  it('cross-thread: @gemini still works normally when currentCatId is undefined (no regression)', async () => {
    const { parseA2AMentions } = await import('../dist/domains/cats/services/agents/routing/a2a-mentions.js');
    const result = parseA2AMentions(
      '@gemini 请确认这个安排',
      undefined,
    );
    assert.ok(result.includes('gemini'), '@gemini should work with undefined currentCatId');
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
