#!/usr/bin/env node
/**
 * F203 Phase C — Task 0 spike: 语义覆盖对比（plan 内置安全网，防盲删）。
 *
 * 验证 compileL0(catId) 是否**语义覆盖** buildStaticIdentity(catId) 非 pack
 * 部分的每个规则锚点。重点 plan 标的 A4(A2A格式)/A8(CVO handles)/A9(governance
 * 14项)。字面措辞不同正常（L0 是重写版）——查的是规则完整性，不是 diff。
 *
 * 输出：每个锚点 covered / GAP。GAP → 必须补 L0 或修，不能盲删 user message。
 */

import { catRegistry } from '@cat-cafe/shared';
import { compileL0 } from './compile-system-prompt-l0.mjs';

// catRegistry bootstrap（与 compile-system-prompt-l0 同源 no-arg loadCatConfig）
const { loadCatConfig, toAllCatConfigs } = await import('../packages/api/dist/config/cat-config-loader.js');
const allConfigs = toAllCatConfigs(loadCatConfig());
for (const [id, config] of Object.entries(allConfigs)) {
  if (!catRegistry.has(id)) catRegistry.register(id, config);
}

const { buildStaticIdentity } = await import(
  '../packages/api/dist/domains/cats/services/context/SystemPromptBuilder.js'
);

const CAT = 'opus-47';
// options 不传 packBlocks → buildStaticIdentity 输出 = 纯非 pack 部分（A1/2/4/5/6/8/9/11）
const staticId = buildStaticIdentity(CAT, { mcpAvailable: true });
const l0 = await compileL0({ catId: CAT });

// 规则锚点：buildStaticIdentity 非 pack 各段的核心语义点 → 必须在 L0 找到
const ANCHORS = [
  // A1 identity
  { id: 'A1', name: 'identity displayName', probe: () => l0.includes('布偶猫') },
  { id: 'A1', name: 'identity 性格/角色', probe: () => /性格|角色/.test(l0) },
  // A2 restrictions（opus-47 可能无 restrictions，软检查）
  {
    id: 'A2',
    name: 'restrictions（若有）',
    probe: () => !/你的硬限制/.test(staticId) || /硬限制/.test(l0),
    soft: true,
  },
  // A4 A2A 协作格式
  { id: 'A4', name: 'A2A @ 路由格式（行首/句中无效）', probe: () => /行首/.test(l0) && /句中.*无效|非行首/.test(l0) },
  { id: 'A4', name: 'A2A 球权掉地上', probe: () => l0.includes('球权掉地上') },
  { id: 'A4', name: 'A2A 可@队友 handles', probe: () => /@codex|@gpt52|@gemini|@sonnet/.test(l0) },
  // A5 roster
  { id: 'A5', name: '队友名册（缅因猫/暹罗猫）', probe: () => l0.includes('缅因猫') && l0.includes('暹罗猫') },
  // A6 WORKFLOW
  {
    id: 'A6',
    name: 'per-breed workflow（ragdoll @缅因猫 review）',
    probe: () => /@缅因猫.*review|完成开发\/修复/.test(l0),
  },
  // A8 CVO ref — 已知 gap：L0 §4 硬编码 @landy vs co-creator config patterns
  { id: 'A8', name: 'CVO 称呼（铲屎官/CVO）', probe: () => /铲屎官|CVO/.test(l0) },
  {
    id: 'A8',
    name: 'CVO handles 对齐 co-creator config（gap 检测）',
    probe: () => {
      const m = staticId.match(/需要关注时行首写 (.+?)。/);
      if (!m) return true;
      const handles = m[1]
        .replace(/`/g, '')
        .split(/ \/ /)
        .map((s) => s.trim());
      return handles.every((h) => l0.includes(h));
    },
  },
  // A9 governance digest 14 项
  { id: 'A9', name: 'Rule 0', probe: () => /Rule 0/.test(l0) },
  { id: 'A9', name: 'P1-P5', probe: () => ['P1', 'P2', 'P3', 'P4', 'P5'].every((p) => l0.includes(p)) },
  { id: 'A9', name: 'W1-W8', probe: () => ['W1', 'W8'].every((w) => l0.includes(w)) },
  {
    id: 'A9',
    name: 'Magic Words 9（脚手架/星星罐子/碎片够了）',
    probe: () => ['脚手架', '星星罐子', '碎片够了'].every((w) => l0.includes(w)),
  },
  { id: 'A9', name: '传球三选一 + 球权第一人称', probe: () => l0.includes('球权只有第一人称') && /三选一/.test(l0) },
  { id: 'A9', name: '五条铁律（Redis 6399 圣域）', probe: () => l0.includes('Redis 6399 圣域') },
  // A11 MCP
  { id: 'A11', name: 'MCP search_evidence', probe: () => l0.includes('cat_cafe_search_evidence') },
  { id: 'A11', name: 'MCP post_message', probe: () => l0.includes('cat_cafe_post_message') },
];

console.log('# F203 Phase C Task 0 — L0 Coverage Diff (opus-47)');
console.log();
console.log(`buildStaticIdentity (非 pack) chars: ${staticId.length}`);
console.log(`compileL0 chars: ${l0.length}`);
console.log();
console.log('| Anchor | 规则点 | covered? |');
console.log('|--------|--------|----------|');
let gaps = 0;
for (const a of ANCHORS) {
  let ok;
  try {
    ok = a.probe();
  } catch (e) {
    ok = false;
  }
  const mark = ok ? '✅' : a.soft ? '⚠️ soft-miss' : '❌ GAP';
  if (!ok && !a.soft) gaps += 1;
  console.log(`| ${a.id} | ${a.name} | ${mark} |`);
}
console.log();
console.log(
  gaps === 0
    ? '✅ 0 hard GAP — L0 语义覆盖 buildStaticIdentity 非 pack，可安全删 user message'
    : `❌ ${gaps} hard GAP — 必须先补 L0/修，不可盲删`,
);
process.exitCode = gaps === 0 ? 0 : 1;
