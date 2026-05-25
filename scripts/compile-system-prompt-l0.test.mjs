/**
 * F203 Phase B AC-B2 — compile-system-prompt-l0.mjs unit tests
 *
 * Verifies:
 *   - 14 L0 governance items + objective carry-over placeholder all present
 *   - per-cat overlay (IDENTITY_BLOCK / TEAMMATE_ROSTER / WORKFLOW_TRIGGERS) substituted
 *   - per-breed cache key stable (same catId twice = byte-identical output)
 *   - token total ≤ 5,500 (AC-B3, KD-14)
 *   - 5 catIds × 3 modes minimum coverage (AC-B2)
 */

import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encodingForModel } from 'js-tiktoken';
import { compileL0, filterAvailableTeammates, isCliEntrypoint, writeL0File } from './compile-system-prompt-l0.mjs';

const enc = encodingForModel('gpt-4o');
const tok = (s) => (s ? enc.encode(s, [], []).length : 0);

const CATS = ['opus', 'opus-47', 'sonnet', 'codex', 'gpt52', 'gemini25'];

describe('F203 Phase B — compile-system-prompt-l0.mjs', () => {
  describe('14 L0 governance items coverage', () => {
    test('template delegates governance block to shared-rules compiler (#747)', () => {
      const template = readFileSync(new URL('../assets/system-prompts/system-prompt-l0.md', import.meta.url), 'utf8');
      assert.ok(template.includes('{{GOVERNANCE_L0}}'));
      assert.ok(!template.includes('### Rule 0 — 规则是边界不是全部'));
      assert.ok(!template.includes('### 第一性原理 P1-P5'));
    });

    test('身份 + 伙伴声明 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.match(l0, /你是.+(布偶猫|缅因猫|暹罗猫)/);
      assert.ok(l0.includes('协作团队的一员'));
    });

    test('Magic Words 9 items all present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      const words = [
        '脚手架',
        '绕路了',
        '喵约',
        '星星罐子',
        '第一性原理',
        '数学之美',
        '下次一定',
        '我能猜出来',
        '碎片够了',
      ];
      for (const w of words) {
        assert.ok(l0.includes(w), `missing magic word: ${w}`);
      }
    });

    test('Rule 0 + Push Back 协议 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.match(l0, /Rule 0/);
      assert.ok(l0.includes('Push Back 协议'));
      assert.ok(l0.includes('证据'));
      assert.ok(l0.includes('适用性论证'));
      assert.ok(l0.includes('替代方案'));
    });

    test('P1-P5 第一性原理 all present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      for (const p of ['**P1**', '**P2**', '**P3**', '**P4**', '**P5**']) {
        assert.ok(l0.includes(p), `missing principle: ${p}`);
      }
    });

    test('W1-W8 世界观 all present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      for (const w of ['**W1**', '**W2**', '**W3**', '**W4**', '**W5**', '**W6**', '**W7**', '**W8**']) {
        assert.ok(l0.includes(w), `missing worldview: ${w}`);
      }
    });

    test('传球三选一 + 球权第一人称 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('球权只有第一人称'));
      assert.match(l0, /三选一/);
      assert.ok(l0.includes('hold_ball'));
    });

    test('@ 路由格式 + 行首独立一行 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('行首独立一行'));
      assert.match(l0, /球权掉地上/);
    });

    test('五条铁律 all 5 numbered present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('Redis 6399 圣域'));
      assert.ok(l0.includes('Review 必须跨个体'));
      assert.ok(l0.includes('用自己的身份'));
      assert.ok(l0.includes('Alpha 验收通道'));
      assert.ok(l0.includes('用户状态默认持久化'));
    });

    test('commit 签名格式 + 模型型号 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.match(l0, /\[昵称\/模型🐾\]/);
      assert.ok(l0.includes('含模型型号'));
    });

    test('共享状态文件 main only + commit push present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('共享状态文件'));
      assert.ok(l0.includes('只在 main 改'));
      assert.match(l0, /git commit \+ git push/);
    });

    test('铲屎官三硬条件 present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('不可逆操作'));
      assert.ok(l0.includes('愿景级决策'));
      assert.ok(l0.includes('跨猫僵局'));
    });

    test('WORKFLOW_TRIGGERS substituted per breed', async () => {
      const ragdoll = await compileL0({ catId: 'opus-47' });
      assert.ok(ragdoll.includes('完成开发/修复 → @缅因猫'));
      const maine = await compileL0({ catId: 'codex' });
      assert.ok(maine.includes('完成 review → @布偶猫'));
      assert.ok(maine.includes('### 执行纪律'));
      const siamese = await compileL0({ catId: 'gemini25' });
      assert.ok(siamese.includes('完成设计/视觉资产'));
    });

    // F203 codex user-layer strip: 长任务纪律是 Codex CLI harness 专属知识
    // （exec_command session_id / 伪后台陷阱 / detached spawn / fire-and-forget
    // 探针），原本只在退役的 ~/.codex/AGENTS.md user-layer。剥离 user-layer 前
    // 必须先进 maine-coon native L0 overlay，否则砚砚丢这条 harness 教训。
    // 砚砚 plan-review 要求：codex/gpt52/spark 全 maine-coon variant 都覆盖，
    // 非 maine-coon（ragdoll/siamese）不泄漏。spark 不在 CATS 但同 breedId。
    test('maine-coon overlay carries Codex-CLI 长任务纪律 (codex + gpt52)', async () => {
      for (const catId of ['codex', 'gpt52']) {
        const maine = await compileL0({ catId });
        assert.ok(maine.includes('长任务纪律'), `${catId}: missing 长任务纪律 heading`);
        assert.ok(maine.includes('exec_command'), `${catId}: missing exec_command session_id guidance`);
        assert.ok(maine.includes('detached'), `${catId}: missing detached spawn guidance`);
        assert.ok(maine.includes('fire-and-forget') || maine.includes('探针'), `${catId}: missing probe guidance`);
      }
      // 长任务纪律是 maine-coon 专属——不应泄漏到布偶猫 / 暹罗猫 overlay
      const ragdoll = await compileL0({ catId: 'opus-47' });
      assert.ok(!ragdoll.includes('长任务纪律'), '长任务纪律 leaked into ragdoll overlay');
      const siamese = await compileL0({ catId: 'gemini25' });
      assert.ok(!siamese.includes('长任务纪律'), '长任务纪律 leaked into siamese overlay');
    });

    test('MCP quick index present (≤200t goal)', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('cat_cafe_search_evidence'));
      assert.ok(l0.includes('cat_cafe_post_message'));
      assert.ok(l0.includes('cat_cafe_create_rich_block'));
      assert.match(l0, /字段名 `kind`/);
    });

    test('协作哲学 (伙伴猫不是工具猫) present', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes('伙伴猫不是工具猫'));
      assert.ok(l0.includes('愿景驱动'));
    });
  });

  describe('Objective carry-over placeholder', () => {
    test('placeholder section labeled, ≤100t', async () => {
      const l0 = await compileL0({ catId: 'opus-47' });
      const carryOverMatch = l0.match(/## 2\. 客观性 carry-over 段[\s\S]*?(?=\n## 3\.)/);
      assert.ok(carryOverMatch, 'carry-over section not found');
      const carryOver = carryOverMatch[0];
      assert.ok(carryOver.includes('placeholder'));
      assert.ok(carryOver.includes('0 项功能性能力退化'));
    });
  });

  describe('Per-cat overlay substitution', () => {
    for (const catId of CATS) {
      test(`${catId}: no template placeholder leaks`, async () => {
        const l0 = await compileL0({ catId });
        assert.doesNotMatch(l0, /\{\{IDENTITY_BLOCK\}\}/);
        assert.doesNotMatch(l0, /\{\{TEAMMATE_ROSTER\}\}/);
        assert.doesNotMatch(l0, /\{\{WORKFLOW_TRIGGERS\}\}/);
      });

      test(`${catId}: identity block contains its own catId or displayName`, async () => {
        const l0 = await compileL0({ catId });
        const breedMap = {
          opus: '布偶猫',
          'opus-47': '布偶猫',
          sonnet: '布偶猫',
          codex: '缅因猫',
          gpt52: '缅因猫',
          gemini25: '暹罗猫',
        };
        assert.ok(l0.includes(breedMap[catId]), `${catId}: missing breed displayName ${breedMap[catId]}`);
      });
    }
  });

  describe('Per-cat cache stability (AC-B4)', () => {
    test('same catId twice produces byte-identical output', async () => {
      const a = await compileL0({ catId: 'opus-47' });
      const b = await compileL0({ catId: 'opus-47' });
      assert.equal(a, b);
    });

    test('different catId produces different output', async () => {
      const a = await compileL0({ catId: 'opus-47' });
      const b = await compileL0({ catId: 'codex' });
      assert.notEqual(a, b);
    });
  });

  // AC-B3 上限 5,500（KD-14）：4,500→5,000（KD-9，S1 实测 static 物理
  // 下限 ~4,600t）→5,500。第二次上移因 codex user-layer strip 把 Codex
  // CLI 专属「长任务纪律」从退役的 ~/.codex/AGENTS.md 迁入 maine-coon
  // native overlay——maine-coon 实测 5,154-5,155t，5,000 buffer 已耗尽。
  // 5,500 仍在 Claude 4.x prompt cache 单 breakpoint（最小 1,024t）内，
  // 占 200k context 2.75%。详见 F203 AC-B3 + KD-14。
  describe('Token budget (AC-B3, ≤5,500)', () => {
    for (const catId of CATS) {
      test(`${catId}: total tokens ≤ 5,500`, async () => {
        const l0 = await compileL0({ catId });
        const tokens = tok(l0);
        assert.ok(tokens <= 5500, `${catId} L0 = ${tokens} tokens (limit 5,500)`);
      });
    }
  });

  describe('Unknown catId throws', () => {
    test('throws clear error', async () => {
      await assert.rejects(async () => compileL0({ catId: 'no-such-cat' }), /unknown catId/);
    });
  });

  // 云端 review P1: CLI entrypoint detection 必须跨平台（fileURLToPath，
  // 不能 string 比 `file://${argv1}`——Windows argv1=C:\... 不匹配）。
  describe('isCliEntrypoint (cloud review P1 — cross-platform)', () => {
    test('true when argv1 path-resolves to this module', () => {
      const self = fileURLToPath(import.meta.url);
      assert.equal(isCliEntrypoint(import.meta.url, self), true);
    });

    test('false when argv1 empty/undefined', () => {
      assert.equal(isCliEntrypoint(import.meta.url, ''), false);
      assert.equal(isCliEntrypoint(import.meta.url, undefined), false);
    });

    test('false when argv1 points elsewhere', () => {
      assert.equal(isCliEntrypoint(import.meta.url, '/some/other/file.mjs'), false);
    });

    test('resolves relative argv1 to absolute before compare', () => {
      // Old bug: `import.meta.url === file://${argv1}` POSIX-only.
      // 注：POSIX 下旧 string 拼接碰巧正确（这正是 bug 难发现的原因——
      // 只有 Windows 挂），所以无法在 POSIX 用 assert 证明旧实现错；
      // 这里只正向验证 fileURLToPath+resolve 路径比较对相对 argv1 也成立。
      const self = fileURLToPath(import.meta.url);
      assert.equal(isCliEntrypoint(import.meta.url, self), true);
    });
  });

  // 云端 review P2: 队友名册必须只列 available 猫——disabled 猫进
  // roster 会导致 dead-end @ routing（@ 已下线的猫）。
  describe('filterAvailableTeammates (cloud review P2)', () => {
    const mockConfigs = {
      opus: { displayName: '布偶猫' },
      codex: { displayName: '缅因猫' },
      gemini: { displayName: '暹罗猫' },
    };

    test('excludes current cat', () => {
      const r = filterAvailableTeammates(mockConfigs, 'opus', () => true);
      assert.deepEqual(r.map(([id]) => id).sort(), ['codex', 'gemini']);
    });

    test('excludes unavailable cats', () => {
      const isAvail = (id) => id !== 'gemini'; // gemini disabled
      const r = filterAvailableTeammates(mockConfigs, 'opus', isAvail);
      assert.deepEqual(r.map(([id]) => id).sort(), ['codex']);
    });

    test('all available → all teammates except self', () => {
      const r = filterAvailableTeammates(mockConfigs, 'codex', () => true);
      assert.deepEqual(r.map(([id]) => id).sort(), ['gemini', 'opus']);
    });
  });

  // 云端 review round-2 P2: roster 列标"当前模型"必须 runtime resolve。
  // 旧实现 `cfg.defaultModel` 忽略 CAT_{CATID}_MODEL env override →
  // 这个测试在旧实现下必红（roster 不含 override model）；
  // 新实现 resolveModel→getCatModel 读 env → 绿。
  describe('runtime model resolve (cloud review round-2 P2)', () => {
    test('roster reflects CAT_{ID}_MODEL env override, not static defaultModel', async () => {
      const envKey = 'CAT_CODEX_MODEL';
      const orig = process.env[envKey];
      process.env[envKey] = 'gpt-test-override-9.9';
      try {
        // opus-47 的队友名册应列 codex，且模型为 env override 值
        const l0 = await compileL0({ catId: 'opus-47' });
        assert.match(l0, /gpt-test-override-9\.9/);
      } finally {
        if (orig === undefined) delete process.env[envKey];
        else process.env[envKey] = orig;
      }
    });
  });

  // Self identity must also respect env override (砚砚 review P1 on eba9b9099):
  // `Identity constant` line should reflect CAT_{ID}_MODEL override, not just
  // static defaultModel. Roster already uses resolveModel; self identity must too.
  describe('self identity respects CAT_{ID}_MODEL env override', () => {
    test('Identity constant reflects env override model, not static defaultModel', async () => {
      const envKey = 'CAT_OPUS_MODEL';
      const orig = process.env[envKey];
      process.env[envKey] = 'claude-opus-env-override-test';
      try {
        const l0 = await compileL0({ catId: 'opus' });
        assert.match(l0, /Identity constant:.*model=claude-opus-env-override-test/,
          'self identity should use env override model');
        assert.doesNotMatch(l0, /model=claude-opus-4-6/,
          'static defaultModel should NOT appear when env override is set');
      } finally {
        if (orig === undefined) delete process.env[envKey];
        else process.env[envKey] = orig;
      }
    });

    test('Identity constant falls back to defaultModel when no env override', async () => {
      const l0 = await compileL0({ catId: 'opus' });
      assert.match(l0, /Identity constant:.*model=claude-opus-4-6/,
        'without env override, should use defaultModel');
    });
  });

  // Phase C Task 1: A8 gap fix — CVO ref handles 来自 co-creator config
  // 渲染（非 L0 硬编码 @landy）。Task 0 spike 发现：buildStaticIdentity
  // L568-571 用 getCoCreatorConfig().mentionPatterns（动态），L0 §4 硬编码
  // @landy → 删 user message 后 co-creator 多 handle 丢失。修：compile
  // 注入 {{CVO_REF}} 模板变量。旧 L0 无 {{CVO_REF}} 渲染 → 此测试必红。
  describe('CVO ref from co-creator config (Phase C Task 1, A8 gap)', () => {
    test('compileL0 renders co-creator config mentionPatterns, not hardcoded', async () => {
      const { getCoCreatorConfig } = await import('../packages/api/dist/config/cat-config-loader.js');
      const cc = getCoCreatorConfig();
      const l0 = await compileL0({ catId: 'opus-47' });
      assert.ok(l0.includes(`${cc.name}（铲屎官/CVO）`), `CVO_REF name "${cc.name}" missing`);
      assert.match(l0, /需要关注时行首写/);
      for (const p of cc.mentionPatterns) {
        assert.ok(l0.includes(p), `CVO handle ${p} missing from compiled L0`);
      }
    });
  });

  // CVO directive 2026-05-15: 完全替换不硬编码 ts/js，Phase C 用
  // --system-prompt-file 从文件读。writeL0File 是文件输出接口。
  describe('writeL0File (--system-prompt-file support)', () => {
    test('writes compiled L0 to file, returns same content', async () => {
      const tmp = `${process.env.TMPDIR ?? '/tmp'}/f203-l0-write-test-${process.pid}.md`;
      try {
        const returned = await writeL0File({ catId: 'opus-47' }, tmp);
        const onDisk = readFileSync(tmp, 'utf8');
        assert.equal(returned, onDisk);
        assert.ok(onDisk.includes('布偶猫'));
        assert.doesNotMatch(onDisk, /\{\{IDENTITY_BLOCK\}\}/);
      } finally {
        rmSync(tmp, { force: true });
      }
    });
  });
});
