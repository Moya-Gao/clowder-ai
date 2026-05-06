import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

const C = {
  ink: '#263238',
  muted: '#667085',
  paper: '#fffaf0',
  paper2: '#f8efe0',
  purple: '#7c3aed',
  purpleSoft: '#ede7ff',
  blue: '#2563eb',
  blueSoft: '#dbeafe',
  green: '#16a34a',
  greenSoft: '#dcfce7',
  orange: '#f97316',
  orangeSoft: '#ffedd5',
  red: '#dc2626',
  redSoft: '#fee2e2',
  teal: '#0f766e',
  tealSoft: '#ccfbf1',
  line: '#344054',
  white: '#ffffff',
};

const font = `"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Arial Unicode MS", sans-serif`;

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svgShell(width, height, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#8a6f45" flood-opacity="0.14"/>
    </filter>
    <filter id="soft">
      <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="12" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="multiply"/>
    </filter>
    <marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11 z" fill="${C.line}"/>
    </marker>
    <marker id="arrowRed" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11 z" fill="${C.red}"/>
    </marker>
    <style><![CDATA[
      text { font-family: ${font}; letter-spacing: 0; }
      .title { font-weight: 800; fill: ${C.ink}; }
      .subtitle { fill: ${C.muted}; }
      .label { font-weight: 700; fill: ${C.ink}; }
      .small { fill: ${C.muted}; }
      .mono { font-family: "SFMono-Regular", "Menlo", "Consolas", monospace; }
    ]]></style>
  </defs>
  <rect width="100%" height="100%" fill="${C.paper}"/>
  <path d="M0,70 C420,10 760,95 1120,42 C1440,-4 1660,42 2100,16 L2100,0 L0,0 Z" fill="${C.paper2}" opacity="0.8"/>
  ${body}
</svg>`;
}

function lines(items, x, y, opts = {}) {
  const { size = 28, weight = 500, fill = C.ink, leading = 1.34, anchor = 'start', cls = '', opacity = 1 } = opts;
  const spans = items
    .map((item, idx) => {
      const text = typeof item === 'string' ? item : item.text;
      const tFill = typeof item === 'string' ? fill : item.fill || fill;
      const tWeight = typeof item === 'string' ? weight : item.weight || weight;
      const tSize = typeof item === 'string' ? size : item.size || size;
      return `<tspan x="${x}" dy="${idx === 0 ? 0 : tSize * leading}" fill="${tFill}" font-weight="${tWeight}" font-size="${tSize}">${esc(text)}</tspan>`;
    })
    .join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" opacity="${opacity}" class="${cls}">${spans}</text>`;
}

function box(x, y, w, h, opts = {}) {
  const {
    fill = C.white,
    stroke = C.line,
    sw = 3,
    r = 26,
    dash = '',
    opacity = 1,
    shadow = true,
    label,
    labelColor = stroke,
  } = opts;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-dasharray="${dash}" opacity="${opacity}" filter="${shadow ? 'url(#shadow)' : ''}"/>
    ${label ? `<rect x="${x + 24}" y="${y - 22}" width="${Math.max(140, label.length * 28)}" height="44" rx="22" fill="${labelColor}" opacity="0.96"/><text x="${x + 42}" y="${y + 8}" font-size="25" font-weight="800" fill="white">${esc(label)}</text>` : ''}
  `;
}

function pill(x, y, text, fill, stroke = fill, opts = {}) {
  const w = opts.w || Math.max(120, text.length * (opts.size || 24) + 34);
  const h = opts.h || 44;
  const size = opts.size || 24;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <text x="${x + w / 2}" y="${y + h / 2 + size * 0.34}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${opts.textFill || C.ink}">${esc(text)}</text>`;
}

function arrow(x1, y1, x2, y2, opts = {}) {
  const color = opts.color || C.line;
  const dash = opts.dash ? `stroke-dasharray="${opts.dash}"` : '';
  const marker = opts.red ? 'arrowRed' : 'arrow';
  return `<path d="M ${x1} ${y1} C ${opts.cx1 ?? (x1 + x2) / 2} ${opts.cy1 ?? y1}, ${opts.cx2 ?? (x1 + x2) / 2} ${opts.cy2 ?? y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${opts.sw || 5}" ${dash} stroke-linecap="round" marker-end="url(#${marker})"/>`;
}

function simpleArrow(x1, y1, x2, y2, opts = {}) {
  const color = opts.color || C.line;
  const marker = opts.red ? 'arrowRed' : 'arrow';
  const dash = opts.dash ? `stroke-dasharray="${opts.dash}"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${opts.sw || 5}" ${dash} stroke-linecap="round" marker-end="url(#${marker})"/>`;
}

function cat(x, y, scale, color, name, role, opts = {}) {
  const s = scale;
  const face = opts.face || '#fff7ed';
  const eye = opts.eye || C.ink;
  const mane = opts.mane
    ? `<path d="M ${x - 60 * s} ${y + 10 * s} C ${x - 95 * s} ${y + 60 * s}, ${x - 38 * s} ${y + 95 * s}, ${x} ${y + 78 * s} C ${x + 38 * s} ${y + 96 * s}, ${x + 95 * s} ${y + 60 * s}, ${x + 60 * s} ${y + 10 * s}" fill="${opts.mane}" stroke="${C.line}" stroke-width="${3 * s}"/>`
    : '';
  return `
  <g>
    ${mane}
    <path d="M ${x - 54 * s} ${y - 36 * s} L ${x - 22 * s} ${y - 74 * s} L ${x - 6 * s} ${y - 32 * s}" fill="${face}" stroke="${C.line}" stroke-width="${3 * s}"/>
    <path d="M ${x + 54 * s} ${y - 36 * s} L ${x + 22 * s} ${y - 74 * s} L ${x + 6 * s} ${y - 32 * s}" fill="${face}" stroke="${C.line}" stroke-width="${3 * s}"/>
    <ellipse cx="${x}" cy="${y}" rx="${64 * s}" ry="${55 * s}" fill="${face}" stroke="${C.line}" stroke-width="${3 * s}"/>
    <circle cx="${x - 22 * s}" cy="${y - 8 * s}" r="${6 * s}" fill="${eye}"/>
    <circle cx="${x + 22 * s}" cy="${y - 8 * s}" r="${6 * s}" fill="${eye}"/>
    <path d="M ${x - 8 * s} ${y + 10 * s} Q ${x} ${y + 18 * s} ${x + 8 * s} ${y + 10 * s}" fill="none" stroke="${C.line}" stroke-width="${3 * s}" stroke-linecap="round"/>
    <path d="M ${x - 13 * s} ${y + 18 * s} Q ${x} ${y + 28 * s} ${x + 13 * s} ${y + 18 * s}" fill="none" stroke="${C.line}" stroke-width="${2.5 * s}" stroke-linecap="round"/>
    <path d="M ${x - 48 * s} ${y + 8 * s} L ${x - 85 * s} ${y}" stroke="${C.line}" stroke-width="${2 * s}" stroke-linecap="round"/>
    <path d="M ${x - 48 * s} ${y + 18 * s} L ${x - 84 * s} ${y + 24 * s}" stroke="${C.line}" stroke-width="${2 * s}" stroke-linecap="round"/>
    <path d="M ${x + 48 * s} ${y + 8 * s} L ${x + 85 * s} ${y}" stroke="${C.line}" stroke-width="${2 * s}" stroke-linecap="round"/>
    <path d="M ${x + 48 * s} ${y + 18 * s} L ${x + 84 * s} ${y + 24 * s}" stroke="${C.line}" stroke-width="${2 * s}" stroke-linecap="round"/>
    <rect x="${x - 78 * s}" y="${y + 70 * s}" width="${156 * s}" height="${58 * s}" rx="${22 * s}" fill="${color}" opacity="0.96"/>
    <text x="${x}" y="${y + 98 * s}" text-anchor="middle" font-size="${24 * s}" font-weight="800" fill="white">${esc(name)}</text>
    <text x="${x}" y="${y + 124 * s}" text-anchor="middle" font-size="${18 * s}" font-weight="600" fill="white" opacity="0.92">${esc(role)}</text>
  </g>`;
}

function human(x, y, scale) {
  const s = scale;
  return `
  <g>
    <circle cx="${x}" cy="${y - 48 * s}" r="${30 * s}" fill="#f3d7bd" stroke="${C.line}" stroke-width="${3 * s}"/>
    <path d="M ${x - 50 * s} ${y + 26 * s} Q ${x} ${y - 20 * s} ${x + 50 * s} ${y + 26 * s} L ${x + 34 * s} ${y + 94 * s} L ${x - 34 * s} ${y + 94 * s} Z" fill="#334155" stroke="${C.line}" stroke-width="${3 * s}"/>
    <path d="M ${x + 42 * s} ${y + 2 * s} C ${x + 84 * s} ${y - 18 * s}, ${x + 110 * s} ${y - 26 * s}, ${x + 142 * s} ${y - 35 * s}" fill="none" stroke="${C.line}" stroke-width="${6 * s}" stroke-linecap="round"/>
    <circle cx="${x + 150 * s}" cy="${y - 37 * s}" r="${8 * s}" fill="${C.line}"/>
    <text x="${x}" y="${y + 140 * s}" text-anchor="middle" font-size="${26 * s}" font-weight="800" fill="${C.ink}">铲屎官 / CVO</text>
  </g>`;
}

function yarn(x, y, r, color = C.purple) {
  return `
  <g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.88" stroke="${C.line}" stroke-width="3"/>
    <path d="M ${x - r * 0.7} ${y - r * 0.3} C ${x - r * 0.15} ${y - r * 0.9}, ${x + r * 0.45} ${y - r * 0.7}, ${x + r * 0.76} ${y - r * 0.1}" fill="none" stroke="white" stroke-width="${r * 0.12}" opacity="0.86"/>
    <path d="M ${x - r * 0.8} ${y + r * 0.25} C ${x - r * 0.1} ${y - r * 0.1}, ${x + r * 0.3} ${y + r * 0.4}, ${x + r * 0.85} ${y + r * 0.1}" fill="none" stroke="white" stroke-width="${r * 0.11}" opacity="0.86"/>
    <path d="M ${x - r * 0.15} ${y - r * 0.85} C ${x - r * 0.35} ${y - r * 0.05}, ${x + r * 0.15} ${y + r * 0.35}, ${x - r * 0.15} ${y + r * 0.86}" fill="none" stroke="white" stroke-width="${r * 0.1}" opacity="0.86"/>
  </g>`;
}

function bookStack(x, y, scale = 1) {
  const s = scale;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${120 * s}" height="${28 * s}" rx="${6 * s}" fill="${C.greenSoft}" stroke="${C.green}" stroke-width="${3 * s}"/>
    <rect x="${x + 18 * s}" y="${y - 32 * s}" width="${126 * s}" height="${28 * s}" rx="${6 * s}" fill="${C.blueSoft}" stroke="${C.blue}" stroke-width="${3 * s}"/>
    <rect x="${x - 8 * s}" y="${y - 64 * s}" width="${116 * s}" height="${28 * s}" rx="${6 * s}" fill="${C.orangeSoft}" stroke="${C.orange}" stroke-width="${3 * s}"/>
    <text x="${x + 72 * s}" y="${y + 58 * s}" text-anchor="middle" font-size="${22 * s}" font-weight="700" fill="${C.ink}">docs / evidence</text>
  </g>`;
}

function sectionTitle(title, subtitle, width) {
  return `
  ${lines([title], width / 2, 70, { size: 48, weight: 850, anchor: 'middle', cls: 'title' })}
  ${subtitle ? lines([subtitle], width / 2, 112, { size: 24, weight: 600, fill: C.muted, anchor: 'middle' }) : ''}`;
}

function heroDiagram() {
  const w = 1800;
  const h = 1200;
  const body = `
  ${sectionTitle('Cat Cafe 产品全景：不同引擎看同一件事', 'AI 团队不是岗位分工表；跨厂商多样性是结构性质量来源', w)}

  ${box(78, 145, 1644, 285, { fill: '#fff7ed', stroke: C.orange, label: '方向层 / CVO 共创', labelColor: C.orange })}
  <rect x="155" y="260" width="420" height="90" rx="42" fill="#fed7aa" stroke="${C.line}" stroke-width="4"/>
  <rect x="125" y="316" width="485" height="45" rx="22" fill="#fdba74" stroke="${C.line}" stroke-width="3"/>
  ${human(360, 270, 0.82)}
  ${box(720, 205, 700, 170, { fill: C.white, stroke: C.orange, r: 20, shadow: false })}
  ${lines(['愿景', 'SOP', '教训'], 830, 265, { size: 34, weight: 850, fill: C.orange })}
  ${lines(['铲屎官定义方向与边界', '猫猫自治执行，必要时 push back'], 1015, 252, { size: 26, weight: 650, fill: C.ink })}
  <circle cx="1538" cy="270" r="62" fill="${C.redSoft}" stroke="${C.red}" stroke-width="6"/>
  <circle cx="1538" cy="270" r="36" fill="${C.red}" opacity="0.9"/>
  ${lines(['Magic Words', '紧急拉闸'], 1538, 365, { size: 24, weight: 800, fill: C.red, anchor: 'middle' })}
  ${lines(['↕ 深度贴贴：共创，不是逐步审批'], 900, 465, { size: 30, weight: 800, fill: C.purple, anchor: 'middle' })}

  ${box(78, 505, 1644, 335, { fill: '#f5f3ff', stroke: C.purple, label: '执行层 / 三个引擎', labelColor: C.purple })}
  ${box(155, 575, 395, 200, { fill: C.white, stroke: C.purple, r: 24 })}
  ${box(702, 575, 395, 200, { fill: C.white, stroke: C.purple, r: 24 })}
  ${box(1249, 575, 395, 200, { fill: C.white, stroke: C.purple, r: 24 })}
  ${cat(355, 615, 0.9, C.purple, '宪宪', '布偶/Claude', { face: '#f8fafc', eye: '#334155' })}
  ${cat(900, 615, 0.9, C.blue, '砚砚', '缅因/GPT', { face: '#fef3c7', mane: '#d6a45f' })}
  ${cat(1445, 615, 0.9, C.teal, '烁烁', '暹罗/Gemini', { face: '#e0f2fe', eye: '#0f172a' })}
  ${lines(['IDE + 蓝图'], 355, 808, { size: 25, weight: 800, anchor: 'middle', fill: C.muted })}
  ${lines(['放大镜 + checklist'], 900, 808, { size: 25, weight: 800, anchor: 'middle', fill: C.muted })}
  ${lines(['画板 + 调色盘'], 1445, 808, { size: 25, weight: 800, anchor: 'middle', fill: C.muted })}
  ${simpleArrow(540, 695, 705, 695, { color: C.purple, sw: 6 })}
  ${simpleArrow(1095, 695, 1250, 695, { color: C.purple, sw: 6 })}
  ${yarn(626, 695, 34)}
  ${yarn(1175, 695, 34)}
  ${lines(['毛线球 = 球权，任何猫都能接'], 900, 560, { size: 24, weight: 800, anchor: 'middle', fill: C.purple })}
  ${lines(['工位物品只暗示观察习惯，不是岗位边界'], 900, 834, { size: 24, weight: 850, anchor: 'middle', fill: C.purple })}

  ${box(78, 895, 1644, 235, { fill: '#ecfdf5', stroke: C.green, label: '共享基础设施', labelColor: C.green })}
  ${bookStack(205, 1020, 1.15)}
  ${box(520, 955, 340, 120, { fill: C.white, stroke: C.green, r: 22, shadow: false })}
  ${lines(['SOP 轨道', 'feat → review → merge'], 690, 1008, { size: 26, weight: 800, anchor: 'middle', fill: C.green })}
  ${box(930, 955, 340, 120, { fill: C.white, stroke: C.blue, r: 22, shadow: false })}
  ${lines(['监控仪表盘', '谁在跑 / 谁在等'], 1100, 1008, { size: 26, weight: 800, anchor: 'middle', fill: C.blue })}
  ${box(1335, 955, 290, 120, { fill: C.white, stroke: C.orange, r: 22, shadow: false })}
  ${lines(['外部触达', '飞书 · 企微 · TG'], 1480, 1008, { size: 26, weight: 800, anchor: 'middle', fill: C.orange })}
  ${lines(['valid_as_of: 2026-05-05 / CN first'], 1688, 1160, { size: 20, weight: 700, fill: C.muted, anchor: 'end' })}
  `;
  return svgShell(w, h, body);
}

function sourceRows(rows, x, y) {
  return rows
    .map((row, idx) => {
      const cy = y + idx * 28;
      return `
      <rect x="${x}" y="${cy - 18}" width="52" height="24" rx="12" fill="${row.fill}" stroke="${row.stroke}" stroke-width="2"/>
      <text x="${x + 26}" y="${cy}" text-anchor="middle" font-size="14" font-weight="900" fill="${row.stroke}">${esc(row.tag)}</text>
      <text x="${x + 66}" y="${cy}" font-size="16" font-weight="650" fill="${C.ink}">${esc(row.text)}</text>
    `;
    })
    .join('');
}

function componentBox(x, y, w, h, index, title, items, color, anchorText, sources = []) {
  return `
  ${box(x, y, w, h, { fill: C.white, stroke: color, r: 24 })}
  ${pill(x + 22, y + 20, `${index}. ${title}`, `${color}22`, color, { size: 24, textFill: color, w: w - 44 })}
  ${lines(items, x + 34, y + 92, { size: 23, weight: 650, fill: C.ink, leading: 1.25 })}
  ${sources.length ? `<line x1="${x + 30}" y1="${y + h - 126}" x2="${x + w - 30}" y2="${y + h - 126}" stroke="${color}" stroke-width="2" opacity="0.24"/>` : ''}
  ${sources.length ? lines(['外部概念锚点'], x + 34, y + h - 96, { size: 17, weight: 850, fill: color }) : ''}
  ${sources.length ? sourceRows(sources, x + 34, y + h - 64) : ''}
  ${anchorText ? lines([anchorText], x + w - 34, y + h - 24, { size: 17, weight: 700, fill: C.muted, anchor: 'end' }) : ''}
  `;
}

function harnessMapDiagram() {
  const w = 2200;
  const h = 1650;
  const OAI = { tag: 'OAI', fill: '#e0f2fe', stroke: C.blue };
  const ANT = { tag: 'ANT', fill: '#f5f3ff', stroke: C.purple };
  const FOW = { tag: 'FOW', fill: '#ffedd5', stroke: C.orange };
  const body = `
  ${sectionTitle('Cat Cafe Harness Engineering：六大件 + 第七类', '行业六大构件我们全有落地；多猫协作还需要协作语义与球权治理', w)}
  ${pill(720, 132, 'Agent Quality = Model Capability × Environment Fit', C.purpleSoft, C.purple, { w: 760, size: 26, textFill: C.purple })}

  ${componentBox(
    80,
    220,
    630,
    345,
    1,
    'Durable State',
    ['docs/ 真相源', 'evidence.sqlite 编译层', 'Session Chain / Thread', 'Task / Workflow / InvocationQueue'],
    C.green,
    '→ 图5 Shared State',
    [
      { ...OAI, text: 'docs / plans / worktree SOR' },
      { ...ANT, text: 'structured handoff / session log' },
      { ...FOW, text: 'context engineering / harnessability' },
    ],
  )}
  ${componentBox(
    785,
    220,
    630,
    345,
    2,
    'Plans & Decomposition',
    [
      'feat-lifecycle → Design Gate',
      'writing-plans → Phase 拆分',
      'AC 对 evidence · Close Gate 三选一',
      '不许留 follow-up 尾巴',
    ],
    C.orange,
    '→ SOP / Gates',
    [
      { ...OAI, text: 'execution plans as artifacts' },
      { ...ANT, text: 'planner / feature decomposition' },
      { ...FOW, text: 'guides: specs / plans / rules' },
    ],
  )}
  ${componentBox(
    1490,
    220,
    630,
    345,
    3,
    'Feedback Loops',
    [
      'Computational: lint / test / gate / CI',
      'Inferential: 跨族 review / 愿景守护',
      'Human Runtime: Magic Words 拉闸',
      'CVO 漏斗决策',
    ],
    C.red,
    '→ 图3 verdict',
    [
      { ...OAI, text: 'agent reviews / CI / traces' },
      { ...ANT, text: 'evaluator / QA loop / trace reading' },
      { ...FOW, text: 'sensors: computational + inferential' },
    ],
  )}

  ${componentBox(
    80,
    630,
    630,
    365,
    4,
    'Legibility',
    [
      'search_evidence（增强 grep）',
      'Hub 明厨亮灶',
      'InvocationTracker：谁在跑 / 谁在等',
      'confidence / authority / sourceType',
      '看不见等于不存在',
    ],
    C.blue,
    '→ 图5 API / Hub',
    [
      { ...OAI, text: 'UI / logs / metrics / repo visible' },
      { ...ANT, text: 'structured artifacts for next agent' },
      { ...FOW, text: 'ambient affordances / harnessability' },
    ],
  )}
  ${componentBox(
    785,
    630,
    630,
    365,
    5,
    'Tool Mediation',
    [
      'MCP + Skill 认知路标',
      'SystemPromptBuilder',
      '入口硬 gate (F086)',
      'Dynamic Injection',
      '猫砂盆放在猫已经去的地方',
    ],
    C.purple,
    '→ L1/L3 Tooling',
    [
      { ...OAI, text: 'dev tools / gh / scripts / skills' },
      { ...ANT, text: 'harness routes tools; sandbox hands' },
      { ...FOW, text: 'computational controls / codemods' },
    ],
  )}
  ${componentBox(
    1490,
    630,
    630,
    365,
    6,
    'Entropy Control',
    [
      'F163 知识生命周期',
      'Build to Delete 判别式',
      'skeleton / explanation / probe',
      'ADR-031（Sunset 纪律）',
      '代码熵 + harness 自身熵',
    ],
    C.teal,
    '→ 图4 双飞轮',
    [
      { ...OAI, text: 'doc gardening / cleanup tasks' },
      { ...ANT, text: 're-review scaffold after upgrades' },
      { ...FOW, text: 'steering loop / keep quality left' },
    ],
  )}

  ${box(180, 1090, 1840, 370, { fill: '#fff7ed', stroke: C.orange, r: 30, label: '7. Collaboration Semantics', labelColor: C.orange })}
  ${lines(['六大件之外，Cat Cafe 独有'], 1100, 1150, { size: 35, weight: 900, fill: C.orange, anchor: 'middle' })}
  ${lines(
    [
      '@ 路由 · targetCats · hold_ball · 接 / 退 / 升三选一',
      '统一执行平面：InvocationQueue 接住所有 handoff',
      '跨厂商多样性：Claude × GPT × Gemini = 结构性纠错',
      'CVO 终裁：愿景层拍板，执行层自治',
      '核心定律：状态迁移必须由现实动作产生',
    ],
    280,
    1225,
    { size: 32, weight: 760, fill: C.ink, leading: 1.25 },
  )}
  ${cat(1690, 1238, 0.78, C.purple, '多猫', '协作协议', { face: '#fef3c7', mane: '#e7b76b' })}
  ${yarn(1565, 1310, 42, C.orange)}
  ${simpleArrow(1470, 1310, 1525, 1310, { color: C.orange })}
  ${simpleArrow(1605, 1310, 1662, 1310, { color: C.orange })}

  ${box(300, 1520, 1600, 82, { fill: '#fffbeb', stroke: '#d97706', r: 24, shadow: false })}
  ${lines(['六大件 = 中文社区综合归纳；OAI / ANT / FOW 是外部概念锚点，不是官方一一对应分类。详见 concept-map-2026-05-05.md。'], 1100, 1572, { size: 24, weight: 750, fill: '#92400e', anchor: 'middle' })}
  `;
  return svgShell(w, h, body);
}

function timelineLane(y, label, color) {
  return `
    ${pill(74, y - 32, label, `${color}22`, color, { w: 150, size: 24, textFill: color })}
    <line x1="260" y1="${y}" x2="1680" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
  `;
}

function eventDot(x, y, color, title, detail, opts = {}) {
  return `
    <circle cx="${x}" cy="${y}" r="20" fill="${color}" stroke="${C.line}" stroke-width="3"/>
    ${yarn(x, y - 48, opts.yarn ? 24 : 0, color)}
    ${lines([title], x, y + 54, { size: 24, weight: 850, fill: color, anchor: 'middle' })}
    ${detail ? lines(Array.isArray(detail) ? detail : [detail], x, y + 86, { size: 19, weight: 650, fill: C.muted, anchor: 'middle', leading: 1.18 }) : ''}
  `;
}

function a2aDiagram() {
  const w = 2000;
  const h = 1350;
  const body = `
  ${sectionTitle('A2A 协作球权流转：状态迁移必须由现实动作产生', '正常流看现实动作；反例看没有 tool call 的纯文本乒乓', w)}

  ${box(70, 160, 1810, 610, { fill: '#f8fafc', stroke: C.blue, r: 30, label: '正常流：接球 → 执行 → 交棒', labelColor: C.blue })}
  ${timelineLane(260, '铲屎官', C.orange)}
  ${timelineLane(390, '宪宪', C.purple)}
  ${timelineLane(520, '砚砚', C.blue)}
  ${timelineLane(650, 'Shared', C.green)}
  ${eventDot(330, 260, C.orange, '愿景输入', ['做 F183', 'Magic Words 可拉闸'])}
  ${simpleArrow(330, 285, 420, 360, { color: C.orange, sw: 4 })}
  ${eventDot(470, 390, C.purple, '接球', ['开始执行', '现实动作 ✓'], { yarn: true })}
  ${eventDot(760, 390, C.purple, '写完', ['git commit', '现实动作 ✓'])}
  ${eventDot(1060, 390, C.purple, '交棒', ['targetCats', '结构化路由 ✓'], { yarn: true })}
  ${simpleArrow(1060, 416, 1160, 492, { color: C.purple, sw: 4 })}
  ${eventDot(1210, 520, C.blue, 'review', ['读代码 / 跑测试', '现实动作 ✓'], { yarn: true })}
  ${eventDot(1490, 520, C.blue, 'verdict', ['pass + 交回', '现实动作 ✓'])}
  ${simpleArrow(1490, 545, 1600, 405, { color: C.blue, sw: 4 })}
  ${eventDot(1630, 390, C.purple, 'merge', ['合入 / 归档', '现实动作 ✓'])}
  <line x1="280" y1="650" x2="1720" y2="650" stroke="${C.green}" stroke-width="12" opacity="0.18"/>
  ${lines(['thread · task · docs · evidence · InvocationQueue：所有猫读写同一份，不靠消息口口相传'], 1000, 690, { size: 25, weight: 800, fill: C.green, anchor: 'middle' })}

  ${box(1410, 206, 400, 170, { fill: C.redSoft, stroke: C.red, r: 22, shadow: false, dash: '10 8' })}
  ${lines(['旁路：hold_ball', '仅用于 CLI 退出 / 等外部条件', 'wake 后续接；不是正常接球动作'], 1610, 255, { size: 22, weight: 800, fill: C.red, anchor: 'middle', leading: 1.2 })}

  ${box(70, 830, 1810, 390, { fill: '#fff7ed', stroke: C.red, r: 30, label: '反例：乒乓球死循环', labelColor: C.red })}
  ${pill(150, 920, '猫 A', C.purpleSoft, C.purple, { w: 130, textFill: C.purple })}
  ${pill(150, 1038, '猫 B', C.blueSoft, C.blue, { w: 130, textFill: C.blue })}
  <line x1="320" y1="940" x2="1200" y2="940" stroke="${C.purple}" stroke-width="4" opacity="0.35"/>
  <line x1="320" y1="1058" x2="1200" y2="1058" stroke="${C.blue}" stroke-width="4" opacity="0.35"/>
  ${simpleArrow(370, 940, 565, 1058, { color: C.red, dash: '10 8', red: true })}
  ${simpleArrow(600, 1058, 795, 940, { color: C.red, dash: '10 8', red: true })}
  ${simpleArrow(830, 940, 1025, 1058, { color: C.red, dash: '10 8', red: true })}
  ${simpleArrow(1060, 1058, 1215, 940, { color: C.red, dash: '10 8', red: true })}
  ${lines(['@猫B'], 485, 902, { size: 23, weight: 850, fill: C.red, anchor: 'middle' })}
  ${lines(['@猫A'], 700, 1120, { size: 23, weight: 850, fill: C.red, anchor: 'middle' })}
  ${lines(['@猫B'], 945, 902, { size: 23, weight: 850, fill: C.red, anchor: 'middle' })}
  ${lines(['@猫A'], 1140, 1120, { size: 23, weight: 850, fill: C.red, anchor: 'middle' })}
  ${lines(['纯文字声明', '没有 tool call', '没有 commit / verdict', '不产生状态迁移'], 1375, 925, { size: 28, weight: 850, fill: C.red, leading: 1.24 })}
  <circle cx="1665" cy="1015" r="82" fill="${C.red}" opacity="0.92"/>
  <path d="M 1620 970 L 1710 1060 M 1710 970 L 1620 1060" stroke="white" stroke-width="18" stroke-linecap="round"/>
  ${lines(['ping-pong', 'breaker 熔断'], 1665, 1124, { size: 24, weight: 900, fill: C.red, anchor: 'middle' })}

  ${box(360, 1245, 1280, 70, { fill: C.redSoft, stroke: C.red, r: 22, shadow: false })}
  ${lines(['红色虚线 = 纯文本，不算状态迁移；✓ = tool call / git commit / review verdict / MCP call'], 1000, 1290, { size: 24, weight: 800, fill: C.red, anchor: 'middle' })}
  `;
  return svgShell(w, h, body);
}

function node(cx, cy, text, color, w = 190) {
  const label = Array.isArray(text) ? text : [text];
  return `
    <rect x="${cx - w / 2}" y="${cy - 34}" width="${w}" height="68" rx="24" fill="white" stroke="${color}" stroke-width="3" filter="url(#shadow)"/>
    ${lines(label, cx, cy - (label.length > 1 ? 6 : -8), { size: 19, weight: 800, fill: color, anchor: 'middle', leading: 1.05 })}
  `;
}

function flywheel(cx, cy, r, color, title, steps) {
  const nodes = steps.map((step, i) => {
    const a = -Math.PI / 2 + (i / steps.length) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, text: step };
  });
  const arrows = nodes
    .map((n, i) => {
      const m = nodes[(i + 1) % nodes.length];
      return simpleArrow(n.x + (m.x > n.x ? 70 : -70), n.y, m.x + (m.x > n.x ? -70 : 70), m.y, { color, sw: 3 });
    })
    .join('');
  return `
    <circle cx="${cx}" cy="${cy}" r="${r + 78}" fill="${color}12" stroke="${color}" stroke-width="5" stroke-dasharray="14 10"/>
    ${arrows}
    ${nodes.map((n) => node(n.x, n.y, n.text, color)).join('')}
    <circle cx="${cx}" cy="${cy}" r="118" fill="white" stroke="${color}" stroke-width="5" filter="url(#shadow)"/>
    ${lines(Array.isArray(title) ? title : [title], cx, cy - 12, { size: 27, weight: 900, fill: color, anchor: 'middle', leading: 1.12 })}
  `;
}

function numberedStep(x, y, w, n, title, impl, color) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="88" rx="22" fill="white" stroke="${color}" stroke-width="3" filter="url(#shadow)"/>
    <circle cx="${x + 44}" cy="${y + 44}" r="25" fill="${color}" opacity="0.95"/>
    <text x="${x + 44}" y="${y + 53}" text-anchor="middle" font-size="24" font-weight="900" fill="white">${n}</text>
    ${lines([title], x + 86, y + 36, { size: 24, weight: 880, fill: C.ink })}
    ${lines([impl], x + 86, y + 66, { size: 18, weight: 700, fill: C.muted })}
  `;
}

function downArrow(x, y, color) {
  return simpleArrow(x, y, x, y + 28, { color, sw: 4 });
}

function stepPanel(x, y, w, color, title, subtitle, problem, steps, effect) {
  const stepY = y + 190;
  const gap = 104;
  return `
    ${box(x, y, w, 1080, { fill: `${color}12`, stroke: color, r: 34, label: title, labelColor: color })}
    ${lines([subtitle], x + w / 2, y + 72, { size: 31, weight: 900, fill: color, anchor: "middle" })}
    ${box(x + 34, y + 104, w - 68, 62, { fill: "white", stroke: color, r: 20, shadow: false })}
    ${lines([problem], x + w / 2, y + 145, { size: 21, weight: 780, fill: C.ink, anchor: "middle" })}
    ${steps.map((step, idx) => numberedStep(x + 44, stepY + idx * gap, w - 88, idx + 1, step.title, step.impl, color)).join("")}
    ${steps.slice(0, -1).map((_, idx) => downArrow(x + w / 2, stepY + 88 + idx * gap + 7, color)).join("")}
    ${box(x + 34, y + 870, w - 68, 160, { fill: "white", stroke: color, r: 24, shadow: false })}
    ${pill(x + 58, y + 852, "飞轮效应", `${color}22`, color, { w: 150, size: 22, textFill: color })}
    ${lines(effect, x + 64, y + 925, { size: 23, weight: 820, fill: color, leading: 1.25 })}
  `;
}

function dualFlywheelDiagram() {
  const w = 2200;
  const h = 1500;
  const body = `
  ${sectionTitle('记忆 × Harness 双飞轮：知识活过上下文，规则会删除自己', '给外部读者的人话版：左轮管理知识，右轮管理规则，中间闭环让两轮互相供数', w)}

  ${stepPanel(
    70,
    170,
    760,
    C.green,
    '左轮：知识飞轮',
    '让知识活过上下文重置',
    '问题：agent 每次开新上下文，过去决策和教训会丢',
    [
      { title: '工作产出文档和讨论', impl: '(docs / discussions)' },
      { title: '系统自动扫描建索引', impl: '(scan → evidence.sqlite)' },
      { title: 'Agent 开工前先搜', impl: '(search_evidence)' },
      { title: '搜到就用，用完反馈', impl: '(recall → feedback)' },
      { title: '人工审核，沉淀正式知识', impl: '(review → materialize)' },
      { title: '重新索引，检测过时/矛盾', impl: '(reindex + stale / contradiction)' },
    ],
    ['知识越多 → 搜索越准', '搜索越准 → 决策越好', '决策越好 → 产出更好的知识'],
  )}

  ${stepPanel(
    1370,
    170,
    760,
    C.orange,
    '右轮：Harness 飞轮',
    '让规则会删除自己',
    '问题：事故后只加规则不删规则，harness 会越来越重',
    [
      { title: '规则被触发', impl: '(rule fire)' },
      { title: '记录触发信号', impl: '(trace: 违规 / 绕行 / 拉闸)' },
      { title: '区分永久协议和临时脚手架', impl: '(skeleton / explanation)' },
      { title: '临时规则写入删除条件', impl: '(sunset condition)' },
      { title: '连续 N 次不触发，降级', impl: '(default → dynamic)' },
      { title: '确认无用后删除并归档', impl: '(sunset removal + lesson)' },
    ],
    ['删掉不需要的规则 → 系统更轻', '系统更轻 → agent 更快更准', '触发数据更干净 → 删除判断更准'],
  )}

  ${box(880, 430, 440, 560, { fill: '#f8fafc', stroke: C.blue, r: 34, label: '中间齿轮', labelColor: C.blue })}
  ${lines(['现实闭环', '连接两个飞轮的桥'], 1100, 505, { size: 32, weight: 900, fill: C.blue, anchor: 'middle', leading: 1.15 })}
  ${lines(['1. 看现实状态', '2. 建计算模型', '3. 执行动作', '4. 改变现实', '5. 验证结果', '6. 做治理决策'], 965, 585, { size: 25, weight: 800, fill: C.ink, leading: 1.25 })}
  ${box(915, 805, 370, 132, { fill: 'white', stroke: C.blue, r: 22, shadow: false })}
  ${lines(['左轮提供：知识是否还被引用', '右轮提供：规则是否还在触发', '闭环让两轮同步转'], 1100, 850, { size: 21, weight: 800, fill: C.blue, anchor: 'middle', leading: 1.25 })}
  ${arrow(830, 445, 900, 505, { color: C.green, sw: 5, cx1: 855, cy1: 440, cx2: 875, cy2: 480 })}
  ${arrow(1320, 505, 1370, 445, { color: C.orange, sw: 5, cx1: 1345, cy1: 480, cx2: 1350, cy2: 440 })}
  ${arrow(900, 950, 830, 1040, { color: C.green, sw: 5, cx1: 860, cy1: 985, cx2: 850, cy2: 1025 })}
  ${arrow(1370, 1040, 1320, 950, { color: C.orange, sw: 5, cx1: 1350, cy1: 1025, cx2: 1345, cy2: 985 })}
  ${yarn(1100, 1018, 40, C.teal)}
  ${lines(['现实证据在中间回流'], 1100, 1086, { size: 24, weight: 900, fill: C.teal, anchor: 'middle' })}

  ${box(180, 1310, 1840, 92, { fill: '#fffbeb', stroke: '#d97706', r: 26, shadow: false })}
  ${lines(['常见六大件主要覆盖左轮的知识/产物熵控；Cat Cafe 额外把 harness 自身熵控画成右轮：规则要能产出删除自己的证据。'], 1100, 1366, { size: 25, weight: 820, fill: '#92400e', anchor: 'middle' })}
  `;
  return svgShell(w, h, body);
}

function runtimeStackDiagram() {
  const w = 1800;
  const h = 1200;
  const body = `
  ${sectionTitle('Cat Cafe 运行时技术栈：代码在哪，改什么影响什么', 'Hub → Fastify API → Provider / MCP / Storage；6399 是 runtime 用户数据圣域', w)}

  ${box(110, 165, 1580, 245, { fill: C.purpleSoft, stroke: C.purple, r: 28, label: '用户交互', labelColor: C.purple })}
  ${lines(['Hub (React + Zustand)', 'Workspace：对话 / 监控 / 知识 / 导航', 'Rich Block / Preview / Audio', 'WebSocket：实时 bubble stream'], 190, 245, { size: 30, weight: 820, fill: C.ink, leading: 1.28 })}
  ${box(1120, 230, 460, 120, { fill: C.white, stroke: C.orange, r: 24, shadow: false })}
  ${lines(['外部 IM', '飞书 · 企微 · Telegram · Email'], 1350, 282, { size: 27, weight: 850, fill: C.orange, anchor: 'middle', leading: 1.22 })}
  ${simpleArrow(900, 432, 900, 505, { color: C.line, sw: 5 })}
  ${lines(['HTTP / WS'], 955, 475, { size: 23, weight: 800, fill: C.muted })}

  ${box(110, 510, 1580, 285, { fill: C.blueSoft, stroke: C.blue, r: 28, label: 'API (Fastify)', labelColor: C.blue })}
  ${lines(['InvocationQueue → QueueProcessor', 'AgentRouter → Provider Adapters (Claude / GPT / Gemini)', 'SessionBootstrap（窄口注入）', 'A2A Callback → 统一执行平面', 'Transport Gateway（外部触达）'], 190, 590, { size: 29, weight: 820, fill: C.ink, leading: 1.22 })}
  ${cat(1285, 595, 0.48, C.purple, 'Claude', 'adapter', { face: '#f8fafc' })}
  ${cat(1435, 595, 0.48, C.blue, 'GPT', 'adapter', { face: '#fef3c7', mane: '#d6a45f' })}
  ${cat(1585, 595, 0.48, C.teal, 'Gemini', 'adapter', { face: '#e0f2fe' })}

  ${simpleArrow(640, 814, 520, 900, { color: C.line, sw: 5 })}
  ${simpleArrow(1160, 814, 1280, 900, { color: C.line, sw: 5 })}

  ${box(110, 910, 745, 215, { fill: '#f5f3ff', stroke: C.purple, r: 28, label: 'MCP Servers', labelColor: C.purple })}
  ${lines(['cat-cafe (core)', 'cat-cafe-collab', 'cat-cafe-memory', 'cat-cafe-signals', 'external MCPs'], 190, 972, { size: 27, weight: 820, fill: C.ink, leading: 1.15 })}

  ${box(945, 910, 745, 215, { fill: C.greenSoft, stroke: C.green, r: 28, label: 'Storage', labelColor: C.green })}
  <rect x="1015" y="968" width="560" height="44" rx="18" fill="${C.redSoft}" opacity="0.45"/>
  ${lines(['Redis 6399：runtime / 用户数据圣域', 'Redis 6398：worktree / alpha / test 隔离', 'SQLite：evidence.sqlite', 'docs/：真相源', 'git：版本控制 / 审计'], 1025, 988, { size: 27, weight: 820, fill: C.ink, leading: 1.18 })}
  ${lines(['6399 圣域'], 1570, 1000, { size: 22, weight: 900, fill: C.red })}
  `;
  return svgShell(w, h, body);
}

const diagrams = [
  ['01-hero-overview', heroDiagram()],
  ['02-harness-engineering-map', harnessMapDiagram()],
  ['03-a2a-ball-ownership-flow', a2aDiagram()],
  ['04-dual-flywheel', dualFlywheelDiagram()],
  ['05-runtime-stack', runtimeStackDiagram()],
];

await fs.mkdir(OUT_DIR, { recursive: true });

for (const [name, svg] of diagrams) {
  const svgPath = path.join(OUT_DIR, `${name}.svg`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  await fs.writeFile(svgPath, svg, 'utf8');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, quality: 94 }).toFile(pngPath);
  const meta = await sharp(pngPath).metadata();
  console.log(`${name}.png ${meta.width}x${meta.height}`);
}
