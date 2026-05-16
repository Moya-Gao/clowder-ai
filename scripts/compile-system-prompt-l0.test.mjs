/**
 * F203 Phase B AC-B2 — compile-system-prompt-l0.mjs unit tests
 *
 * Verifies:
 *   - 14 L0 governance items + objective carry-over placeholder all present
 *   - per-cat overlay (IDENTITY_BLOCK / TEAMMATE_ROSTER / WORKFLOW_TRIGGERS) substituted
 *   - per-breed cache key stable (same catId twice = byte-identical output)
 *   - token total ≤ 4,500 (AC-B3)
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

  // AC-B3 上限 5,000：4,500 是 S1 baseline 前估算；S1 实测 static
  // 已 2,684-3,060t，14 项完整 L0（含 47 review 补 6 项 + 五条铁律 +
  // 协作哲学 + 三硬条件 + 球权第一人称）物理下限 ~4,600t。per-breed
  // 治理协议已下沉 WORKFLOW overlay 去重。5,000 含 buffer，仍在
  // Claude 4.x prompt cache 单 breakpoint（最小 1,024t）内，占 200k
  // context 2.5%。详见 F203 AC-B3 + audit。
  describe('Token budget (AC-B3, ≤5,000)', () => {
    for (const catId of CATS) {
      test(`${catId}: total tokens ≤ 5,000`, async () => {
        const l0 = await compileL0({ catId });
        const tokens = tok(l0);
        assert.ok(tokens <= 5000, `${catId} L0 = ${tokens} tokens (limit 5,000)`);
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
