import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve(
  'docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/assets/cat-cafe-memory-vs-llm-wiki-comparison.png',
);

const W = 1800;
const H = 1160;

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function text(lines, x, y, size = 28, color = '#172033', weight = 500, gap = 1.3, anchor = 'start') {
  return lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : size * gap * i;
      return `<text x="${x}" y="${y + dy}" class="font" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`;
    })
    .join('\n');
}

function box({ x, y, w, h, fill, stroke, title, lines, titleColor = stroke, size = 23 }) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
    <path d="M ${x + 22} ${y + 18} Q ${x + w / 2} ${y - 7} ${x + w - 22} ${y + 18}" fill="none" stroke="${stroke}" stroke-width="2" opacity=".25"/>
    ${text([title], x + 28, y + 42, 28, titleColor, 850)}
    ${text(lines, x + 28, y + 82, size, '#263248', 540, 1.28)}
  `;
}

function arrow({ x1, y1, x2, y2, color = '#64748b', dashed = false }) {
  return `<path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" ${dashed ? 'stroke-dasharray="12 12"' : ''} marker-end="url(#arrow)"/>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .font {
        font-family: "PingFang SC", "Hiragino Sans GB", "Comic Sans MS", sans-serif;
        letter-spacing: 0;
      }
    </style>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="#64748b"/>
    </marker>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .04"/>
      </feComponentTransfer>
      <feBlend mode="multiply" in2="SourceGraphic"/>
    </filter>
  </defs>
  <rect width="1800" height="1160" fill="#fffaf0"/>
  <rect x="28" y="28" width="1744" height="1104" rx="34" fill="none" stroke="#172033" stroke-width="4"/>
  <rect width="1800" height="1160" fill="#fffdf7" filter="url(#paper)" opacity=".72"/>

  ${text(['Karpathy-style LLM Wiki vs Cat Cafe 记忆系统'], 90, 88, 43, '#111827', 900)}
  ${text(['同一条 compiled knowledge 轴：从“持久 Wiki”推进到“多 agent 项目记忆运行时”'], 94, 138, 27, '#475569', 650)}

  <line x1="900" y1="190" x2="900" y2="985" stroke="#94a3b8" stroke-width="3" stroke-dasharray="10 12"/>
  ${text(['Karpathy-style LLM Wiki', '目标：不要每次从 raw docs 重新发现知识'], 110, 210, 32, '#1d4ed8', 900, 1.35)}

  ${box({
    x: 110,
    y: 290,
    w: 610,
    h: 118,
    fill: '#eff6ff',
    stroke: '#2563eb',
    title: '1. Raw Sources',
    lines: ['文章 / 论文 / 图片 / 数据文件', 'source of truth，不被 LLM 直接修改'],
  })}
  ${box({
    x: 110,
    y: 475,
    w: 610,
    h: 152,
    fill: '#dbeafe',
    stroke: '#2563eb',
    title: '2. LLM-generated Wiki',
    lines: ['summary / entity page / concept page', 'cross-reference / contradiction notes / synthesis', 'LLM 写，人类读和引导'],
  })}
  ${box({
    x: 110,
    y: 700,
    w: 610,
    h: 160,
    fill: '#eff6ff',
    stroke: '#2563eb',
    title: '3. Schema + Operations',
    lines: ['AGENTS.md / CLAUDE.md 约定结构', 'ingest / query / lint', 'index.md + log.md 帮 LLM 导航'],
  })}

  ${arrow({ x1: 415, y1: 410, x2: 415, y2: 472, color: '#2563eb' })}
  ${arrow({ x1: 415, y1: 628, x2: 415, y2: 696, color: '#2563eb' })}

  <rect x="110" y="900" width="610" height="86" rx="20" fill="#1e3a8a" opacity=".92"/>
  ${text(['一句话：Wiki 是“编译后的知识地图”'], 415, 943, 27, '#fffaf0', 800, 1.2, 'middle')}
  ${text(['适合个人/团队知识库、研究整理、持续 synthesis'], 415, 973, 19, '#dbeafe', 600, 1.2, 'middle')}

  ${text(['Cat Cafe 真实实现', '目标：多 agent 在项目现实中持续正确行动'], 1040, 210, 31, '#047857', 900, 1.35)}

  ${box({
    x: 1040,
    y: 290,
    w: 590,
    h: 150,
    fill: '#ecfdf5',
    stroke: '#059669',
    title: '1. Truth Sources',
    lines: ['docs / ADR / feature / thread', 'git / tool events / runtime traces', '结论、过程、运行痕迹都进真相源'],
  })}
  ${box({
    x: 1040,
    y: 482,
    w: 590,
    h: 150,
    fill: '#d1fae5',
    stroke: '#059669',
    title: '2. Compiled Evidence Index',
    lines: ['FTS + vector + graph + recent', 'provenance + evidence.sqlite', '不只是 Wiki 文件夹'],
  })}
  ${box({
    x: 1040,
    y: 674,
    w: 590,
    h: 150,
    fill: '#ecfdf5',
    stroke: '#059669',
    title: '3. Agent Runtime Tools',
    lines: ['search_evidence / graph_resolve', 'list_recent / memory-navigation skill', '把知识放进猫的认知路径'],
  })}
  ${box({
    x: 1040,
    y: 866,
    w: 590,
    h: 156,
    fill: '#f0fdf4',
    stroke: '#059669',
    title: '4. Governance + Eval Flywheel',
    lines: ['authority / stale / contradiction', 'audit ledger / dashboard', 'F153 tracking → F192 eval → upgrade', '维护“记忆系统怎么长”'],
  })}

  ${arrow({ x1: 1335, y1: 442, x2: 1335, y2: 478, color: '#059669' })}
  ${arrow({ x1: 1335, y1: 634, x2: 1335, y2: 670, color: '#059669' })}
  ${arrow({ x1: 1335, y1: 826, x2: 1335, y2: 862, color: '#059669' })}

  <rect x="1040" y="1040" width="590" height="76" rx="20" fill="#064e3b" opacity=".93"/>
  ${text(['一句话：项目现实导航系统'], 1335, 1076, 26, '#fffaf0', 800, 1.2, 'middle')}
  ${text(['适合多 agent 长程工程协作、治理、持续演化'], 1335, 1104, 18, '#d1fae5', 600, 1.2, 'middle')}

  <rect x="750" y="370" width="280" height="300" rx="24" fill="#fff7ed" stroke="#f97316" stroke-width="4"/>
  ${text(['升级点'], 890, 418, 32, '#c2410c', 900, 1.2, 'middle')}
  ${text(['不是替代 Wiki', '而是把 Wiki 方向', '推进到 runtime：', '谁能写？', '何时过期？', '怎么审计？', '有没有变好？'], 890, 466, 23, '#374151', 650, 1.25, 'middle')}

  ${arrow({ x1: 720, y1: 540, x2: 1038, y2: 540, color: '#f97316', dashed: true })}
</svg>`;

await fs.mkdir(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(out);
