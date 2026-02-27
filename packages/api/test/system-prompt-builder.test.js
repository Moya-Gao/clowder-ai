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

  test('output size is under 2000 chars (F-Ground-3: raised from 1400 for teammate roster)', async () => {
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
      prompt.length < 2000,
      `Prompt is ${prompt.length} chars, expected < 2000`
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

      // Use lookahead to only match "@缅因猫" NOT followed by " Spark" (which is a different variant displayName)
      const maineCount = (mentionLine.match(/@缅因猫(?=\s*\/)/g) ?? []).length;
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

  // --- F-Ground-3: Teammate roster tests ---

  test('buildStaticIdentity includes teammate roster with strengths', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const identity = buildStaticIdentity('opus');
    assert.ok(identity.includes('## 队友名册'), 'Should have roster section');
    assert.ok(identity.includes('擅长'), 'Should have strengths column header');
    assert.ok(identity.includes('@缅因猫') || identity.includes('@codex'), 'Should list codex mention');
    assert.ok(identity.includes('@暹罗猫') || identity.includes('@gemini'), 'Should list gemini mention');
  });

  test('buildStaticIdentity roster excludes self', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const opusRoster = buildStaticIdentity('opus');
    // Self (opus) should not appear in the roster table rows
    // The roster rows start after the header, each begins with "|"
    const rosterSection = opusRoster.split('## 队友名册')[1];
    assert.ok(rosterSection, 'Roster section should exist');
    assert.ok(!rosterSection.includes('| 布偶猫/宪宪'), 'Opus default should not list itself');
  });

  test('buildStaticIdentity roster uses teamStrengths from config', async () => {
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
      // gpt52 has teamStrengths="架构思考、Review" and caution="思考太慢"
      assert.ok(identity.includes('架构思考'), 'Should include gpt52 teamStrengths');
      assert.ok(identity.includes('思考太慢'), 'Should include gpt52 caution');
      // gemini has caution about no coding
      assert.ok(identity.includes('禁止写代码'), 'Should include gemini caution');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('buildStaticIdentity roster: Sonnet does not inherit Opus cost caution (R1 null override)', async () => {
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

      const identity = buildStaticIdentity('codex');
      const rosterSection = identity.split('## 队友名册')[1];
      assert.ok(rosterSection, 'Roster section should exist');
      // Find the Sonnet row
      const sonnetRow = rosterSection.split('\n').find((line) => line.includes('Sonnet'));
      assert.ok(sonnetRow, 'Should have a Sonnet row');
      // Sonnet has caution: null in config → should show "—", NOT "额度消耗大"
      assert.ok(!sonnetRow.includes('额度消耗大'), 'Sonnet should not inherit Opus cost caution');
      assert.ok(sonnetRow.includes('—'), 'Sonnet caution should be "—"');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('buildStaticIdentity roster size with full runtime config is under 2000', async () => {
    const { buildSystemPrompt } = await import(
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

      const prompt = buildSystemPrompt({
        catId: 'opus',
        mode: 'serial',
        chainIndex: 1,
        chainTotal: 3,
        teammates: ['codex', 'gemini'],
        mcpAvailable: true,
        promptTags: ['critique'],
      });
      assert.ok(
        prompt.length < 2000,
        `Full runtime prompt is ${prompt.length} chars, expected < 2000`
      );
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

  test('buildInvocationContext does not contain static identity or MCP tools', async () => {
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
    // MCP tools moved to static identity (session-level, not per-message)
    assert.ok(!ctx.includes('cat_cafe_post_message'), 'MCP tools should be in static identity, not invocation context');
    // 铲屎官 reference also moved to static identity
    assert.ok(!ctx.includes('铲屎官是真人用户'), '铲屎官 reference should be in static identity');
  });

  test('buildStaticIdentity includes MCP tools when mcpAvailable', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const identity = buildStaticIdentity('opus', { mcpAvailable: true });
    assert.ok(identity.includes('cat_cafe_post_message'), 'Should contain MCP tools when mcpAvailable');
    assert.ok(identity.includes('cat_cafe_get_thread_context'), 'Should contain thread context tool');
  });

  test('buildStaticIdentity omits MCP tools when mcpAvailable is false', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const identity = buildStaticIdentity('opus');
    assert.ok(!identity.includes('cat_cafe_post_message'), 'Should not contain MCP tools without mcpAvailable');
  });

  test('buildStaticIdentity does NOT include mcpCallbackInstructions (non-Claude stays per-message)', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    // Non-Claude cats use per-message injection for HTTP callback instructions
    // because their systemPrompt lives in session history and may be lost on compression.
    // Only Claude's MCP_TOOLS_SECTION goes in staticIdentity (survives compression via --append-system-prompt).
    const identity = buildStaticIdentity('codex');
    assert.ok(!identity.includes('cat_cafe_post_message'), 'Codex should not have MCP tools in static identity');
    assert.ok(!identity.includes('HTTP 回调'), 'Codex should not have callback instructions in static identity');
  });

  test('buildStaticIdentity includes 铲屎官 reference', async () => {
    const { buildStaticIdentity } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const identity = buildStaticIdentity('opus');
    assert.ok(identity.includes('铲屎官'), 'Should contain 铲屎官 reference in static identity');
  });

  // F032 Phase D2: Reviewer section tests
  test('buildReviewerSection returns reviewer list for opus (different family reviewers)', async () => {
    const { buildReviewerSection } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const section = buildReviewerSection('opus');
    assert.ok(section, 'Should return section for opus');
    assert.ok(section.includes('## 你当前的 Reviewers'), 'Should have reviewer header');
    assert.ok(section.includes('@codex'), 'Should list codex as reviewer (different family)');
    // Should NOT list same-family cats (opus-45 is ragdoll, same as opus)
    assert.ok(!section.includes('@opus-45'), 'Should not list same-family opus-45');
  });

  test('buildReviewerSection returns null for unknown cat', async () => {
    const { buildReviewerSection } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const section = buildReviewerSection('unknown-cat');
    assert.equal(section, null, 'Should return null for unknown cat');
  });

  // Cloud Codex R5 P2: Verify same-family fallback behavior is documented
  // When requireDifferentFamily is enabled but no cross-family reviewers are available,
  // same-family reviewers should be shown with a fallback note.
  // This test verifies the cross-family-available case works correctly;
  // the fallback case requires mocking roster/availability (out of scope for unit test).
  test('buildReviewerSection shows cross-family when available (R5 P2 prerequisite)', async () => {
    const { buildReviewerSection } = await import(
      '../dist/domains/cats/services/context/SystemPromptBuilder.js'
    );
    const section = buildReviewerSection('opus');
    assert.ok(section, 'Should return section');
    // Cross-family available, so should NOT show fallback note
    assert.ok(!section.includes('fallback'), 'Should not show fallback note when cross-family available');
    assert.ok(section.includes('@codex'), 'Should show cross-family reviewer');
  });

  test('buildSystemPrompt includes reviewer section', async () => {
    const build = await getBuilder();
    const prompt = build({
      catId: 'opus',
      mode: 'independent',
      teammates: [],
      mcpAvailable: true,
    });
    assert.ok(prompt.includes('## 你当前的 Reviewers'), 'System prompt should include reviewer section');
  });
});
