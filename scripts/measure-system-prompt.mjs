#!/usr/bin/env node
/**
 * F203 Spike S1: Measure current system prompt token cost.
 *
 * Output a markdown table for F203 Spike Log AC-A1:
 *   - per catId × mode total token count
 *   - static vs dynamic split
 *   - segment breakdown (identity / collab / roster / workflow / cvo /
 *     governance L0 digest / MCP tools)
 *
 * Baseline serves as:
 *   - Reference for L0 token target (AC-B3, current draft ≤ 4,500)
 *   - Pre/post comparison after Phase C runtime switch
 *
 * Reuses estimateTokens (js-tiktoken cl100k_base, ~85-90% accurate for
 * Claude per packages/api/src/utils/token-counter.ts).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodingForModel } from 'js-tiktoken';
import { catRegistry } from '@cat-cafe/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const TEMPLATE_PATH = resolve(REPO_ROOT, 'cat-template.json');

// Bootstrap catRegistry from cat-template.json (same as test helpers do).
// SystemPromptBuilder consults catRegistry.tryGet(catId); empty registry → empty prompt.
const { loadCatConfig, toAllCatConfigs } = await import(
  '../packages/api/dist/config/cat-config-loader.js'
);
const allConfigs = toAllCatConfigs(loadCatConfig(TEMPLATE_PATH));
for (const [id, config] of Object.entries(allConfigs)) {
  if (!catRegistry.has(id)) {
    catRegistry.register(id, config);
  }
}

const {
  buildSystemPrompt,
  buildStaticIdentity,
  buildInvocationContext,
  initGovernanceOverlay,
} = await import('../packages/api/dist/domains/cats/services/context/SystemPromptBuilder.js');

const enc = encodingForModel('gpt-4o');
function tok(s) {
  if (!s) return 0;
  return enc.encode(s, [], []).length;
}

const CATS = ['opus', 'opus-47', 'sonnet', 'codex', 'gpt52', 'gemini25'];
const MODES = ['independent', 'serial', 'parallel'];

await initGovernanceOverlay();

// Marker-based segmentation of static identity output.
// Marker lines themselves stay in their following segment.
const MARKERS = [
  { name: 'identity', regex: /^你是\s/ },
  { name: 'restrictions', regex: /^你的硬限制：/ },
  { name: 'collab', regex: /^## 协作$/ },
  { name: 'roster', regex: /^## 队友名册$/ },
  { name: 'workflow', regex: /^## 工作流（主动 @ 触发点）$/ },
  { name: 'cvo', regex: /（铲屎官\/CVO）/ },
  { name: 'governance', regex: /^## 家规（shared-rules\.md）$/ },
  { name: 'mcp', regex: /^MCP 工具（异步汇报/ },
];

function segmentize(text) {
  const lines = text.split('\n');
  const segs = { preamble: [] };
  let current = 'preamble';
  for (const line of lines) {
    let matched = null;
    for (const { name, regex } of MARKERS) {
      if (regex.test(line)) {
        matched = name;
        break;
      }
    }
    if (matched && !(matched in segs)) {
      current = matched;
      segs[current] = [];
    } else if (matched) {
      current = matched;
    }
    segs[current].push(line);
  }
  const result = {};
  for (const [k, v] of Object.entries(segs)) {
    result[k] = { tokens: tok(v.join('\n')), lines: v.length };
  }
  return result;
}

function pickTeammates(catId) {
  return CATS.filter((c) => c !== catId).slice(0, 3);
}

console.log('# F203 S1 — System Prompt Baseline');
console.log();
console.log(`Measured: ${new Date().toISOString()}`);
console.log(`Tokenizer: js-tiktoken cl100k_base (gpt-4o), ~85-90% accurate for Claude`);
console.log();

console.log('## Total per catId × mode');
console.log();
console.log('| catId | mode | total | static | dynamic | dynamic/total% |');
console.log('|-------|------|-------|--------|---------|----------------|');

const totalByMode = {};
for (const catId of CATS) {
  for (const mode of MODES) {
    const ctx = {
      catId,
      mode,
      teammates: pickTeammates(catId),
      mcpAvailable: catId.startsWith('opus') || catId === 'sonnet',
      a2aEnabled: mode === 'serial',
    };
    const fullTok = tok(buildSystemPrompt(ctx));
    const statTok = tok(buildStaticIdentity(catId, { mcpAvailable: ctx.mcpAvailable }));
    const dynTok = tok(buildInvocationContext(ctx));
    const pct = fullTok > 0 ? ((dynTok / fullTok) * 100).toFixed(1) : '0.0';
    console.log(`| ${catId} | ${mode} | ${fullTok} | ${statTok} | ${dynTok} | ${pct}% |`);
    totalByMode[`${catId}/${mode}`] = { full: fullTok, static: statTok, dynamic: dynTok };
  }
}

console.log();
console.log('## Static identity segment breakdown');
console.log();
console.log('| catId | identity+preamble | collab | roster | workflow | cvo | governance | mcp | static total |');
console.log('|-------|-------------------|--------|--------|----------|-----|------------|-----|--------------|');

for (const catId of CATS) {
  const mcp = catId.startsWith('opus') || catId === 'sonnet';
  const stat = buildStaticIdentity(catId, { mcpAvailable: mcp });
  const segs = segmentize(stat);
  const get = (k) => segs[k]?.tokens ?? 0;
  const idAndPre = get('preamble') + get('identity') + get('restrictions');
  const total = Object.values(segs).reduce((a, s) => a + s.tokens, 0);
  console.log(
    `| ${catId} | ${idAndPre} | ${get('collab')} | ${get('roster')} | ${get('workflow')} | ${get('cvo')} | ${get('governance')} | ${get('mcp')} | ${total} |`,
  );
}

console.log();
console.log('## Notes');
console.log();
console.log(
  '- `dynamic` portion is per-invocation (teammates / mode / ping-pong / cross-thread hint / SOP stage). Not eligible for L0 (must stay in user message).',
);
console.log(
  '- `static` portion is what Phase B compiles into `system-prompt-l0.md` + per-cat WORKFLOW_TRIGGERS overlay.',
);
console.log(
  "- `governance` segment = `GOVERNANCE_L0_DIGEST` — current 'family rules' content. F203 Phase B will rewrite + expand with 14-item L0 + 'objective carry-over' segments.",
);
console.log(
  "- `mcp` segment present only when `mcpAvailable=true` (claude family). Phase B compresses original MCP_TOOLS_SECTION (~700 tokens) into quick index (~150 tokens, ADR-030 §10.2 KD-7).",
);
console.log();
console.log('## Summary');
console.log();
const totals = Object.values(totalByMode).map((t) => t.full);
const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(0);
const max = Math.max(...totals);
const min = Math.min(...totals);
console.log(`- Average full system prompt: ${avg} tokens`);
console.log(`- Range: ${min} - ${max} tokens (across ${CATS.length} cats × ${MODES.length} modes = ${CATS.length * MODES.length} samples)`);
