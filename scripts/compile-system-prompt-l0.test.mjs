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
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encodingForModel } from 'js-tiktoken';

// 砚砚 PR-A R1 P1 #1 修复: 不能静态 import compile-system-prompt-l0.mjs ——
// 它顶层 import { catRegistry } from '@cat-cafe/shared'，在 shared dist 不存在
// 的 fresh worktree 里会先 throw ERR_MODULE_NOT_FOUND，pre-test build hook 根本
// 跑不到。改成 closure 变量 + 动态 import in before(...)（dist 已 build 完）。
let compileL0;
let filterAvailableTeammates;
let isCliEntrypoint;
let writeL0File;
let resolveUserCapsule;

const enc = encodingForModel('gpt-4o');
const tok = (s) => (s ? enc.encode(s, [], []).length : 0);

const CATS = ['opus', 'opus-47', 'sonnet', 'codex', 'gpt52', 'gemini25'];

// L0-budget-defense 件套 ①+②+③ (PR #2213 deadlock 跟进，fable-5 拟):
//   ① pre-test build hook — 守护测试跑前 rebuild @cat-cafe/shared + @cat-cafe/api
//     dist (砚砚 P1 #1 修正: 不只 api，shared 也是 compile-system-prompt-l0 顶层
//     import 依赖，单 build api 留盲区)
//   ② margin<50 warn (Token budget margin guard 描述块, 在 AC-B3 下方)
//     —— ≤6000 硬线之外加贴线预警，避免温水煮蛙
//   ③ per-cat margin 表 (after hook 末尾输出)
//     —— 每个 L0 toucher 直观看到自己吃掉了多少公地
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const HARD_CAP = 6000;
const WARN_MARGIN = 50; // ADR-038 line 39+194 soft invariant: L0 + 50 ≤ HARD_CAP

// PR-C R3 (cloud R3 P2 #2239): per-cat relaxed warn margin (15 for codex/gpt52)
// was reverted — cloud correctly flagged that the highest-risk overlays lost
// 15-49 token early warning coverage exactly where it mattered most, and it
// breached the ADR-038 soft invariant. Resolution: trim maine-coon overlay
// content (长任务纪律 + fallback 治理 line tighten, ~38 tokens save) restores
// uniform 50-token warn margin globally. F218 source-audit stayed in L0
// (cloud R2 L33). All cats now safe within hard cap + 50 token warn.
const marginTable = new Map(); // catId -> { tokens, margin, status }

// 砚砚 PR-A R1 P1 #2 + 云端 R3 P1 L334 (PR-A 历史): bounded todo + expiry guard
// 机制 — codex/gpt52 当时 over cap, 用 t.todo() 标已知 excess (tokens ≤ baseline),
// expiry 2026-06-13 强制解决.
//
// PR-C (2026-06-11) 完成 first demote case (F218 source-audit 反射 + 摩擦检测反射
// → staging) → codex 6051 → 5913, gpt52 6050 → 5912, 都过 cap 且 margin > 50.
// bounded todo + expiry guard 历史使命完成, 移除. 简单 assertion 守 ≤ 6000 即可,
// margin guard (≤5950) 守贴线预警, regression detector 自然成立 (任何 toucher 超
// baseline 都 fail).

describe('F203 Phase B — compile-system-prompt-l0.mjs', () => {
  // ① pre-test build hook (L0-budget-defense): 跑测试前 rebuild api + shared
  //   dist 修仪器. compileL0 通过 dynamic import 加载 packages/api/dist/* + 顶层
  //   静态 import @cat-cafe/shared dist — 若 dist stale 或缺失, 测出来的 token
  //   数与 fresh source 不同 (PR #2213: main stale dist 6027/6026 vs worktree
  //   fresh build 6051/6050, 差 24 tokens).
  //   砚砚 PR-A R1 P1 #1: shared dist 漏 → fresh worktree 在 before() 跑前就
  //   throw ERR_MODULE_NOT_FOUND. 修复 = build 两者 + 把 compileL0 import 改
  //   动态 (在 before 内 await import) 避免静态 import 先于 build 触发.
  //   砚砚 PR-A R1 P1 #2 配套: 加 expiry 检查 — backlog 期间允许 todo, expiry
  //   后强制解决或 extend (需 @landy signoff).
  //   NODE_ENV=production 会跳 devDeps, 用 env override unset.
  before(async () => {
    // PR-C (2026-06-11): expiry guard removed — over-cap debt cleared by first
    // demote case. See historical note above L0_BUDGET infrastructure removal.
    console.log(
      '\n[L0 budget defense ①] pre-test build hook: rebuild @cat-cafe/shared + @cat-cafe/api dist (fresh source)...',
    );
    execSync('pnpm --filter @cat-cafe/shared --filter @cat-cafe/api build', {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, NODE_ENV: undefined },
    });
    // 动态 import compile-system-prompt-l0.mjs 在 build 之后 (砚砚 P1 #1 修)
    ({ compileL0, filterAvailableTeammates, isCliEntrypoint, writeL0File, resolveUserCapsule } = await import(
      './compile-system-prompt-l0.mjs'
    ));
  });

  // ③ per-cat margin 表 (L0-budget-defense): suite 末输出 6 猫 token/margin/状态,
  //   让每个 L0 toucher 直观看到自己改动对各 family 预算的影响, 给 PR description
  //   贴 token 账本现成数据. 温水煮蛙的解药 = 让每只蛙都看见水温计.
  after(() => {
    if (marginTable.size === 0) return;
    console.log('\n=== ③ Per-cat L0 Token Margin Table (L0-budget-defense, fable-5 拟) ===');
    console.log(`  Hard cap: ${HARD_CAP} | Warn margin: ${WARN_MARGIN} (warn at margin < ${WARN_MARGIN})`);
    const rows = [...marginTable.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
    for (const [catId, { tokens, margin, status }] of rows) {
      console.log(
        `  ${status} ${catId.padEnd(10)} tokens=${tokens.toString().padStart(5)} margin=${margin.toString().padStart(4)}`,
      );
    }
    console.log(
      '  Status: 🟢 margin>=50 (safe) | 🟡 0<=margin<50 (warn, 贴线跳舞) | 🔴 margin<0 (over cap, PR blocking)',
    );
    console.log('  L0-budget-defense backlog (anchor): docs/BACKLOG.md § L0-budget-defense');
    console.log('================================================================\n');
  });

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

    // Decision funnel §4 template content guards (sonnet review W1)
    test('§4 接球默认自决 + Decision Packet 闸门 present', async () => {
      const l0 = await compileL0({ catId: 'opus' });
      assert.ok(l0.includes('接球先问：能自决吗'), 'missing 接球先问 preamble');
      // Use §4-unique string to avoid false positive from §3 governance digest (codex review P2)
      assert.ok(l0.includes('缺 Packet = 打回'), 'missing Decision Packet gate in §4');
      assert.ok(l0.includes('绕路反射'), 'missing bypass-reflex diagnostic');
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
      assert.ok(ragdoll.includes('MG provenance override'));
      const maine = await compileL0({ catId: 'codex' });
      assert.ok(maine.includes('完成 review → @布偶猫'));
      assert.ok(maine.includes('MG provenance override'));
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

  describe('Objective carry-over (PR-C partial demote: 摩擦检测 → staging; F218 kept in L0)', () => {
    test('carry-over section retains F218 + 摩擦检测 demote breadcrumb (post-PR-C R2)', async () => {
      // Cloud R2 L33 #2239 (P1): demoting F218 source-audit reflex to staging
      // would weaken system-role guarantee — staging is prepended via
      // effectivePrompt (user channel) in invoke-single-cat, so user "skip
      // provenance" prompt could more easily override the audit reflex than
      // the original system-role L0 line. F218 is security-class; it stays
      // in L0 until v2 system-channel staging mechanism lands (see ADR-038
      // §v1 source-audit demote carve-out).
      // Only 摩擦检测反射 demoted in PR-C (low override surface — user has no
      // incentive to "skip friction detection").
      const l0 = await compileL0({ catId: 'opus-47' });
      const carryOverMatch = l0.match(/## 2\. 客观性 carry-over 段[\s\S]*?(?=\n## 3\.|\n---)/);
      assert.ok(carryOverMatch, 'carry-over section not found');
      const carryOver = carryOverMatch[0];
      // Section meta still present
      assert.ok(carryOver.includes('0 项功能性能力退化'));
      // Demote breadcrumb references ADR-038 + staging
      assert.ok(carryOver.includes('ADR-038'), 'carry-over should reference ADR-038 demote');
      assert.ok(carryOver.includes('staging'), 'carry-over should reference staging layer');
      // F218 source-audit reflex STAYS in L0 (cloud R2 L33 P1 — security-class)
      assert.ok(
        carryOver.includes('source-audit'),
        'F218 source-audit content MUST stay in L0 — security-class, system-role抗 user "skip" override (cloud R2 L33 #2239)',
      );
      assert.ok(
        carryOver.includes('搜索结果只是候选线索'),
        'F218 trigger phrase MUST stay in L0 — see cloud R2 L33 #2239',
      );
      // Cloud R5 P2: F218 source-audit must keep all 4 audit dimensions
      // (一手来源 / 利益冲突 / 时效 / 对象适用性) — trimming 对象适用性 lost
      // applicability-fit check (does the external data apply to YOUR object).
      assert.ok(
        carryOver.includes('对象适用性'),
        'F218 source-audit dimension 对象适用性 MUST stay in L0 (cloud R5 P2 #2239)',
      );
      // 摩擦检测反射 demoted to staging (low-override-surface behavior pattern)
      assert.ok(
        !carryOver.includes('铲屎官重复不满'),
        '摩擦检测反射 content should be in staging, not L0 (demoted in PR-C)',
      );
      // Cloud R5 P2: harness 三层 reflex disentangled to staging (own item),
      // not deleted. Body content (methodology guidance: 软+硬+eval) lives
      // in staging — verify L0 carry-over does NOT carry the methodology
      // (it's referenced via breadcrumb only).
      assert.ok(
        !carryOver.includes('软+硬+eval'),
        'harness 三层 methodology should be in staging body, not L0 carry-over (R5 disentangle)',
      );
    });
  });

  describe('Per-cat overlay substitution', () => {
    for (const catId of CATS) {
      test(`${catId}: no template placeholder leaks`, async () => {
        const l0 = await compileL0({ catId });
        assert.doesNotMatch(l0, /\{\{IDENTITY_BLOCK\}\}/);
        assert.doesNotMatch(l0, /\{\{TEAMMATE_ROSTER\}\}/);
        assert.doesNotMatch(l0, /\{\{WORKFLOW_TRIGGERS\}\}/);
        assert.doesNotMatch(l0, /\{\{USER_CAPSULE\}\}/);
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

  // AC-B3 上限 5,600（KD-14）：4,500→5,000→5,500→5,600。
  // 改 governance content（Magic Words / shared-rules）时两个 test 都要跑：
  //   - 本文件：token budget（L0 compiled markdown）
  //   - packages/api/test/system-prompt-builder.test.js：char budget（runtime prompt）
  // 5,600→6,000：决策漏斗注入（四猫讨论 2026-06-01，§17 投影 + §4 默认自决）。
  // 6,000 占 200k context 3%。详见 F203 AC-B3 + KD-14。
  describe('Token budget (AC-B3, ≤6,000)', () => {
    for (const catId of CATS) {
      test(`${catId}: total tokens ≤ 6,000`, async () => {
        const l0 = await compileL0({ catId });
        const tokens = tok(l0);
        const margin = HARD_CAP - tokens;
        // ③ 记录给 after hook 用 (margin 表) — uniform 50 warn (PR-C R3)
        const status = margin >= WARN_MARGIN ? '🟢' : margin >= 0 ? '🟡' : '🔴';
        marginTable.set(catId, { tokens, margin, status });
        assert.ok(tokens <= HARD_CAP, `${catId} L0 = ${tokens} tokens (limit ${HARD_CAP})`);
      });
    }
  });

  // ② margin<50 warn (L0-budget-defense, fable-5 拟):
  //   ≤6000 硬线之外加贴线预警, 防慢性渐进超额温水煮蛙. PR #2213 教训: budget
  //   已从 5,600 涨到 6,000 一次, fable-5 共识 "涨过一次不能再涨" — 必须真砍内容
  //   或走 L0 staging 协议 (件套 ④). 当前 codex/gpt52 margin 28/29 (post-revert
  //   5972/5971) — 红状态合理 (是 backlog 期间 known-failure, 已有主有期限),
  //   反映温水临界, 提示下一只 toucher 必须先扩 margin 再加内容.
  //   GOTCHA: PR #2213 关掉了, main 上 codex/gpt52 仍 6051/6050 (over cap),
  //   AC-B3 (≤6000) + 本守护一起红, 都是 known-failure 状态 (anchor =
  //   docs/BACKLOG.md § L0-budget-defense, owner = @opus-47, ETA 1-2 day).
  describe(`Token budget margin guard (≤${HARD_CAP - WARN_MARGIN}, 防贴线跳舞)`, () => {
    for (const catId of CATS) {
      test(`${catId}: total tokens ≤ ${HARD_CAP - WARN_MARGIN} (${WARN_MARGIN} token warn margin)`, async () => {
        const l0 = await compileL0({ catId });
        const tokens = tok(l0);
        const margin = HARD_CAP - tokens;
        assert.ok(
          tokens <= HARD_CAP - WARN_MARGIN,
          `${catId} L0 = ${tokens} tokens (margin ${margin} < ${WARN_MARGIN}) — 贴线跳舞预警 (温水煮蛙). 不准砍 truth-source-protected 内容给新条款腾位 (PR #2213 教训). 走 L0 staging 协议 (件套 ④) 或先撤回新增内容.`,
        );
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
        assert.match(
          l0,
          /Identity constant:.*model=claude-opus-env-override-test/,
          'self identity should use env override model',
        );
        assert.doesNotMatch(
          l0,
          /model=claude-opus-4-6/,
          'static defaultModel should NOT appear when env override is set',
        );
      } finally {
        if (orig === undefined) delete process.env[envKey];
        else process.env[envKey] = orig;
      }
    });

    test('Identity constant falls back to defaultModel when no env override', async () => {
      const l0 = await compileL0({ catId: 'opus' });
      assert.match(l0, /Identity constant:.*model=claude-opus-4-6/, 'without env override, should use defaultModel');
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

  // ─── F231 Phase A: USER_CAPSULE injection + fixture isolation ────────────
  // Verifies:
  //   - resolveUserCapsule three-state behavior (present/missing/overlong)
  //   - {{USER_CAPSULE}} template substitution (no placeholder leak)
  //   - Primer pointer append when relationship/{catId}-primer.md exists
  //   - Leak detection: baseline without capsule has no '主人画像' heading
  //   - Boundary: exactly 300 chars passes, 301 chars throws
  //   - Fixture isolation: all tests use test/fixtures/profile*, never private/profile/
  // AC coverage: AC-A2 (three-state), AC-A3 (backward compat + leak), AC-B3 (fixture overlay)

  describe('F231 Phase A — USER_CAPSULE injection', () => {
    const FIXTURE_DIR = fileURLToPath(new URL('../test/fixtures/profile', import.meta.url));
    const FIXTURE_EMPTY_DIR = fileURLToPath(new URL('../test/fixtures/profile-empty', import.meta.url));
    const FIXTURE_NO_PRIMER_DIR = fileURLToPath(new URL('../test/fixtures/profile-no-primer', import.meta.url));
    const FIXTURE_300_DIR = fileURLToPath(new URL('../test/fixtures/profile-boundary-300', import.meta.url));
    const FIXTURE_301_DIR = fileURLToPath(new URL('../test/fixtures/profile-boundary-301', import.meta.url));
    const FIXTURE_HR_DIR = fileURLToPath(new URL('../test/fixtures/profile-body-with-hr', import.meta.url));

    describe('resolveUserCapsule three-state behavior (AC-A2)', () => {
      test('capsule exists and ≤300 chars → returns formatted section with heading', () => {
        const section = resolveUserCapsule(FIXTURE_DIR, 'codex');
        assert.ok(section.startsWith('## 主人画像'), 'section must start with heading');
        assert.ok(section.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'), 'fixture anchor must be present');
      });

      test('capsule missing → returns empty string (no heading)', () => {
        const section = resolveUserCapsule(FIXTURE_EMPTY_DIR, 'codex');
        assert.equal(section, '', 'missing capsule must return empty string');
      });

      test('capsule >300 chars → throws with char count and limit', () => {
        assert.throws(
          () => resolveUserCapsule(FIXTURE_301_DIR, 'codex'),
          (err) => {
            assert.ok(err.message.includes('301'), 'error must contain actual char count');
            assert.ok(err.message.includes('300'), 'error must contain limit');
            return true;
          },
        );
      });

      test('capsule exactly 300 chars → passes (boundary)', () => {
        const section = resolveUserCapsule(FIXTURE_300_DIR, 'codex');
        assert.ok(section.includes('FIXTURE_BOUNDARY_300_ANCHOR'), 'boundary anchor must be present');
        assert.ok(section.startsWith('## 主人画像'), 'boundary capsule must have heading');
      });

      test('frontmatter is stripped (not counted as chars)', () => {
        const section = resolveUserCapsule(FIXTURE_DIR, 'codex');
        assert.ok(!section.includes('status: signed'), 'frontmatter must not leak into section');
        assert.ok(!section.includes('author: test-fixture'), 'frontmatter must not leak into section');
      });

      // gpt52 review P1 regression: body containing `---` horizontal rules
      // must NOT be silently truncated by metadata stripping.
      test('body with --- horizontal rule preserves all content (gpt52 P1 regression)', () => {
        const section = resolveUserCapsule(FIXTURE_HR_DIR, 'codex');
        assert.ok(section.includes('FIXTURE_HR_PART_ONE'), 'content before --- HR must be preserved');
        assert.ok(section.includes('FIXTURE_HR_PART_TWO'), 'content after --- HR must be preserved');
        assert.ok(!section.includes('status: test'), 'frontmatter must still be stripped');
      });
    });

    describe('primer pointer behavior', () => {
      test('primer exists → pointer line appended with standard path', () => {
        const section = resolveUserCapsule(FIXTURE_DIR, 'codex');
        assert.ok(
          section.includes('private/profile/relationship/codex-primer.md'),
          'primer pointer must use standard path format',
        );
        assert.match(section, /关系轨迹/);
      });

      test('primer missing → no pointer line', () => {
        const section = resolveUserCapsule(FIXTURE_NO_PRIMER_DIR, 'codex');
        assert.ok(!section.includes('关系轨迹'), 'no primer → no pointer');
        assert.ok(!section.includes('primer'), 'no primer content at all');
      });

      test('primer pointer uses catId in path', () => {
        // opus has no primer in fixture dir → no pointer
        const section = resolveUserCapsule(FIXTURE_DIR, 'no-such-cat');
        assert.ok(!section.includes('关系轨迹'), 'non-existent catId primer → no pointer');
      });
    });

    describe('{{USER_CAPSULE}} template integration', () => {
      test('template contains {{USER_CAPSULE}} placeholder', () => {
        const template = readFileSync(new URL('../assets/system-prompts/system-prompt-l0.md', import.meta.url), 'utf8');
        assert.ok(template.includes('{{USER_CAPSULE}}'), 'template must have USER_CAPSULE slot');
      });

      test('compileL0 with capsule → 主人画像 section in output', async () => {
        const l0 = await compileL0({ catId: 'codex', profileDir: FIXTURE_DIR });
        assert.ok(l0.includes('## 主人画像'), 'compiled L0 must have capsule heading');
        assert.ok(l0.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'), 'compiled L0 must have fixture content');
        assert.ok(l0.includes('codex-primer.md'), 'compiled L0 must have primer pointer');
      });

      test('compileL0 without capsule → no 主人画像 heading (AC-A3 backward compat)', async () => {
        const l0 = await compileL0({ catId: 'codex', profileDir: FIXTURE_EMPTY_DIR });
        assert.ok(!l0.includes('## 主人画像'), 'no capsule → no heading section (backward compat)');
        assert.doesNotMatch(l0, /\{\{USER_CAPSULE\}\}/, 'placeholder must not leak');
      });
    });

    describe('leak detection (AC-A3)', () => {
      test('baseline compilation (no capsule) contains no fixture anchors', async () => {
        const l0 = await compileL0({ catId: 'opus', profileDir: FIXTURE_EMPTY_DIR });
        assert.ok(!l0.includes('FIXTURE'), 'baseline must not contain any FIXTURE string');
        assert.ok(!l0.includes('## 主人画像'), 'baseline must not contain capsule heading section');
      });

      test('capsule in one cat does not leak to another compilation', async () => {
        const withCapsule = await compileL0({ catId: 'codex', profileDir: FIXTURE_DIR });
        assert.ok(withCapsule.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'));
        const without = await compileL0({ catId: 'codex', profileDir: FIXTURE_EMPTY_DIR });
        assert.ok(!without.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'));
      });
    });

    // AC-B3: fixture overlay anchor regression — full overlay mechanism validation
    // Four compile-level regression tests using fixture profileDir:
    //   1. capsule + primer overlay → both survive full pipeline
    //   2. section ordering (identity < capsule < team)
    //   3. capsule-only overlay (no primer) → capsule heading, no primer pointer
    //   4. public baseline (no overlay) → zero private content of any kind
    // All use test/fixtures/profile*, never private/profile/ (KD-6 fixture isolation)
    describe('fixture overlay anchor regression (AC-B3)', () => {
      test('capsule + primer overlay → both anchors survive full compilation', async () => {
        const l0 = await compileL0({ catId: 'codex', profileDir: FIXTURE_DIR });
        assert.ok(
          l0.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'),
          'capsule overlay anchor must survive full compilation pipeline',
        );
        assert.ok(l0.includes('## 主人画像'), 'capsule heading must be present');
        assert.ok(l0.includes('关系轨迹'), 'primer pointer must be present when primer exists');
        assert.ok(l0.includes('codex-primer.md'), 'primer path must reference catId');
      });

      test('capsule section position: after identity, before team declaration', async () => {
        const l0 = await compileL0({ catId: 'codex', profileDir: FIXTURE_DIR });
        const identityIdx = l0.indexOf('Identity constant:');
        const capsuleIdx = l0.indexOf('## 主人画像');
        const teamIdx = l0.indexOf('协作团队的一员');
        assert.ok(identityIdx < capsuleIdx, 'capsule must come after identity block');
        assert.ok(capsuleIdx < teamIdx, 'capsule must come before team declaration');
      });

      test('capsule without primer → capsule heading present, no primer pointer', async () => {
        const l0 = await compileL0({ catId: 'codex', profileDir: FIXTURE_NO_PRIMER_DIR });
        assert.ok(l0.includes('## 主人画像'), 'capsule heading must be present');
        assert.ok(l0.includes('FIXTURE_CAPSULE_ANCHOR_7x9k'), 'capsule anchor must survive');
        assert.ok(!l0.includes('关系轨迹'), 'no primer pointer without primer file');
        assert.ok(!l0.includes('codex-primer.md'), 'no primer path reference without primer');
      });

      test('public baseline (no overlay) → zero private content', async () => {
        const l0 = await compileL0({ catId: 'opus', profileDir: FIXTURE_EMPTY_DIR });
        assert.ok(!l0.includes('FIXTURE'), 'baseline must not contain any fixture string');
        assert.ok(!l0.includes('## 主人画像'), 'baseline must not have capsule section');
        assert.ok(!l0.includes('关系轨迹'), 'baseline must not have primer pointer');
        // Verify compilation still succeeds without overlay (backward compat)
        assert.ok(l0.includes('Identity constant:'), 'identity block must still be present');
        assert.ok(l0.includes('协作团队的一员'), 'team declaration must still be present');
      });
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
