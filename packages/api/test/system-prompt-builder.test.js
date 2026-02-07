/**
 * SystemPromptBuilder Tests
 * 测试身份注入 prompt 生成
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('SystemPromptBuilder', () => {
  // Dynamic import after build
  async function getBuilder() {
    const { buildSystemPrompt } = await import(
      '../dist/domains/cats/services/SystemPromptBuilder.js'
    );
    return buildSystemPrompt;
  }

  test('contains display name for opus', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('布偶猫'));
    assert.ok(prompt.includes('opus'));
  });

  test('contains display name for codex', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'codex',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('缅因猫'));
    assert.ok(prompt.includes('codex'));
  });

  test('contains display name for gemini', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'gemini',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('暹罗猫'));
    assert.ok(prompt.includes('gemini'));
  });

  test('contains teammate info', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: ['codex', 'gemini'],
      mcpAvailable: false,
    });
    // Should list all other cats as teammates (including codex and gemini)
    assert.ok(prompt.includes('缅因猫'));
    assert.ok(prompt.includes('暹罗猫'));
    assert.ok(prompt.includes('队友'));
  });

  test('contains 铲屎官 reference', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('铲屎官'));
  });

  test('contains serial chain context when mode is serial', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'codex',
      mode: 'serial',
      chainIndex: 2,
      chainTotal: 3,
      teammates: ['opus', 'gemini'],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('2/3'));
    assert.ok(prompt.includes('被召唤'));
  });

  test('contains independent mode when mode is independent', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('独立回答'));
  });

  test('contains MCP tools when mcpAvailable is true', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: true,
    });
    assert.ok(prompt.includes('cat_cafe_post_message'));
    assert.ok(prompt.includes('cat_cafe_get_pending_mentions'));
    assert.ok(prompt.includes('cat_cafe_get_thread_context'));
  });

  test('omits MCP tools when mcpAvailable is false', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'codex',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(!prompt.includes('cat_cafe_post_message'));
  });

  test('contains anti-impersonation rule', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('不要冒充'));
  });

  test('is deterministic (identical inputs produce identical output)', async () => {
    const build = await getBuilder();
    const ctx = {
      catId: 'opus',
      mode: 'serial',
      chainIndex: 1,
      chainTotal: 2,
      teammates: ['codex'],
      mcpAvailable: true,
    };
    const a = build(ctx);
    const b = build(ctx);
    assert.equal(a, b);
  });

  test('output size is under 1500 chars', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'serial',
      chainIndex: 1,
      chainTotal: 3,
      teammates: ['codex', 'gemini'],
      mcpAvailable: true,
    });
    assert.ok(
      prompt.length < 1500,
      `Prompt is ${prompt.length} chars, expected < 1500`
    );
  });

  test('returns empty string for unknown catId', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'unknown-cat',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.equal(prompt, '');
  });

  test('contains provider label (Anthropic for opus)', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('Anthropic'));
  });
});
