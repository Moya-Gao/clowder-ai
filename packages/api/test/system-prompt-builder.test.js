/**
 * SystemPromptBuilder Tests
 * 测试身份注入 prompt 生成
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { catRegistry } from '@cat-cafe/shared';

describe('SystemPromptBuilder', () => {
  // Dynamic import after build
  async function getBuilder() {
    const { buildSystemPrompt } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
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

  test('contains teammate info only for cats in context.teammates', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: ['codex', 'gemini'],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('缅因猫'));
    assert.ok(prompt.includes('暹罗猫'));
    assert.ok(prompt.includes('队友'));
  });

  test('omits dynamic teammate listing when teammates is empty', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    // Dynamic teammate listing absent, but static collaboration guide still present
    assert.ok(!prompt.includes('你的队友'));
    assert.ok(prompt.includes('@队友'));
    // Still mentions 铲屎官
    assert.ok(prompt.includes('铲屎官'));
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

  test('output size is under 1400 chars (F-BLOAT: tightened from 2000)', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'serial',
      chainIndex: 1,
      chainTotal: 3,
      teammates: ['codex', 'gemini'],
      mcpAvailable: true,
      promptTags: ['critique'],
    });
    assert.ok(
      prompt.length < 1400,
      `Prompt is ${prompt.length} chars, expected < 1400`
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

  test('parallel mode produces independent thinking text', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'parallel',
      teammates: ['codex'],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('独立思考'));
    assert.ok(prompt.includes('各自独立'));
    assert.ok(!prompt.includes('被召唤'));
    // Should NOT contain the standalone "独立回答。" from independent mode
    assert.ok(!prompt.includes('当前模式：独立回答。'));
  });

  test('critique promptTag adds critical analysis text', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
      promptTags: ['critique'],
    });
    assert.ok(prompt.includes('批判性分析'));
    assert.ok(prompt.includes('挑战假设'));
  });

  test('empty promptTags produces no extra text', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
      promptTags: [],
    });
    assert.ok(!prompt.includes('批判性分析'));
  });

  // --- Phase 3.6: honesty rule ---

  test('contains "不确定" honesty rule', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('不确定'), 'Prompt should tell cats to say "I\'m not sure"');
  });

  test('contains "不要编造" anti-fabrication rule', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'codex',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(prompt.includes('编造'), 'Prompt should tell cats not to fabricate');
  });

  // --- System prompt split tests (buildStaticIdentity / buildInvocationContext) ---

  test('buildStaticIdentity returns identity for known cat', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const identity = buildStaticIdentity('opus');
    assert.ok(identity.includes('布偶猫'), 'Should contain display name');
    assert.ok(identity.includes('Anthropic'), 'Should contain provider');
    assert.ok(identity.includes('## 协作'), 'Should contain collaboration guide');
    assert.ok(identity.includes('不要冒充'), 'Should contain anti-impersonation rule');
    assert.ok(identity.includes('身份契约'), 'Should contain identity contract');
  });

  test('buildStaticIdentity returns empty for unknown cat', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    assert.equal(buildStaticIdentity('unknown-cat'), '');
  });

  test('buildStaticIdentity includes workflow triggers', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const opusId = buildStaticIdentity('opus');
    assert.ok(opusId.includes('工作流'), 'Opus should have workflow triggers');
    assert.ok(opusId.includes('@缅因猫'), 'Opus workflow should mention review with 缅因猫');

    const codexId = buildStaticIdentity('codex');
    assert.ok(codexId.includes('工作流'), 'Codex should have workflow triggers');
    assert.ok(codexId.includes('@布偶猫'), 'Codex workflow should mention notifying 布偶猫');
  });

  test('buildStaticIdentity is deterministic', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    assert.equal(buildStaticIdentity('opus'), buildStaticIdentity('opus'));
  });

  test('buildStaticIdentity disambiguates duplicate display names in runtime multi-variant config', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const { loadCatConfig, toAllCatConfigs } = await import(
      '../dist/config/cat-config-loader.js'
    );

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const identity = buildStaticIdentity('opus');
      const mentionLine = identity.split('\n').find((line) => line.startsWith('你可以 @队友: '));
      assert.ok(mentionLine, 'should include teammate @mention line');

      const maineCount = (mentionLine.match(/@缅因猫/g) ?? []).length;
      assert.equal(maineCount, 1, 'default maine mention should appear only once');
      assert.ok(mentionLine.includes('@gpt52'), 'should expose non-default variant handle');
      assert.ok(identity.includes('同族多分身时'), 'should explicitly teach same-breed multi-variant rule');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('buildStaticIdentity duplicate-name hint should not suggest self handle', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const { loadCatConfig, toAllCatConfigs } = await import(
      '../dist/config/cat-config-loader.js'
    );

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const identity = buildStaticIdentity('gpt52');
      assert.ok(identity.includes('唯一句柄'), 'should include duplicate-name hint');
      assert.ok(!identity.includes('如 @gpt52'), 'hint example must not point to self handle');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('buildInvocationContext returns teammates when present', async () => {
    const { buildInvocationContext } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const ctx = buildInvocationContext({
      catId: 'opus',
      mode: 'serial',
      chainIndex: 1,
      chainTotal: 2,
      teammates: ['codex'],
      mcpAvailable: false,
    });
    assert.ok(ctx.includes('你的队友'), 'Should list teammates');
    assert.ok(ctx.includes('缅因猫'), 'Should mention codex by display name');
    assert.ok(ctx.includes('1/2'), 'Should show chain position');
  });

  test('buildInvocationContext omits teammate listing when empty', async () => {
    const { buildInvocationContext } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const ctx = buildInvocationContext({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: false,
    });
    assert.ok(!ctx.includes('你的队友'), 'Should not list teammates');
    assert.ok(ctx.includes('独立回答'), 'Should indicate independent mode');
  });

  test('buildInvocationContext does not contain static identity', async () => {
    const { buildInvocationContext } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const ctx = buildInvocationContext({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: true,
    });
    // Static identity content should NOT be in invocation context
    assert.ok(!ctx.includes('布偶猫'), 'Should not contain display name (that is in static identity)');
    assert.ok(!ctx.includes('Anthropic'), 'Should not contain provider');
    assert.ok(!ctx.includes('## 协作'), 'Should not contain collaboration guide');
    // But MCP tools should be present
    assert.ok(ctx.includes('cat_cafe_post_message'), 'Should contain MCP tools');
  });
});
