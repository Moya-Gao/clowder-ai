import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve(
  'docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/assets/cat-cafe-memory-adaptation-flywheel-v2.png',
);

const W = 1800;
const H = 1120;

const escapeXml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function textLines(lines, x, y, size = 30, color = '#172033', weight = 500, gap = 1.25) {
  return lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : size * gap * i;
      return `<text x="${x}" y="${y + dy}" class="font" fill="${color}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`;
    })
    .join('\n');
}

function box({ x, y, w, h, fill, stroke = '#172033', title, lines, accent = '#172033' }) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
    <path d="M ${x + 18} ${y + 18} Q ${x + w / 2} ${y - 4} ${x + w - 18} ${y + 18}" fill="none" stroke="${stroke}" stroke-width="2" opacity=".28"/>
    ${textLines([title], x + 30, y + 46, 30, accent, 800)}
    ${textLines(lines, x + 30, y + 92, 24, '#263248', 500, 1.32)}
  `;
}

function node({ cx, cy, r, fill, stroke, num, title, lines }) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
    <circle cx="${cx - r + 24}" cy="${cy - r + 24}" r="20" fill="#fffaf0" stroke="${stroke}" stroke-width="3"/>
    <text x="${cx - r + 17}" y="${cy - r + 33}" class="font" fill="${stroke}" font-size="24" font-weight="900">${num}</text>
    <text x="${cx}" y="${cy - 14}" class="font" text-anchor="middle" fill="#172033" font-size="27" font-weight="900">${escapeXml(title)}</text>
    ${lines
      .map(
        (line, i) =>
          `<text x="${cx}" y="${cy + 26 + i * 30}" class="font" text-anchor="middle" fill="#334155" font-size="22" font-weight="520">${escapeXml(line)}</text>`,
      )
      .join('\n')}
  `;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .font {
        font-family: "PingFang SC", "Hiragino Sans GB", "STKaiti", "Comic Sans MS", sans-serif;
        letter-spacing: 0;
      }
      .small { font-family: "PingFang SC", sans-serif; }
    </style>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .045"/>
      </feComponentTransfer>
      <feBlend mode="multiply" in2="SourceGraphic"/>
    </filter>
    <marker id="arrow" markerWidth="13" markerHeight="13" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,6 L2,10" fill="none" stroke="#172033" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#fff8ee"/>
  <rect x="30" y="28" width="${W - 60}" height="${H - 56}" rx="36" fill="#fffdf7" stroke="#172033" stroke-width="4" filter="url(#paper)"/>

  ${textLines(['Cat Cafe 记忆系统 v2：项目适配飞轮'], 90, 88, 45, '#111827', 900)}
  ${textLines(['不是接一个外部 memory 插件，而是让项目长出自己的记忆器官'], 94, 138, 28, '#475569', 600)}

  <path d="M 500 680 C 390 410, 570 225, 870 225 C 1180 230, 1385 410, 1280 700 C 1175 990, 790 1010, 555 810" fill="none" stroke="#7c3aed" stroke-width="9" stroke-linecap="round" stroke-dasharray="18 17" opacity=".38" marker-end="url(#arrow)"/>

  ${node({
    cx: 540,
    cy: 380,
    r: 112,
    fill: '#fde2e2',
    stroke: '#dc2626',
    num: '1',
    title: '真实摩擦',
    lines: ['搜不到 / 搜错', '搜完还 grep', '接球慢'],
  })}
  ${node({
    cx: 900,
    cy: 285,
    r: 112,
    fill: '#dbeafe',
    stroke: '#2563eb',
    num: '2',
    title: 'F153 Tracking',
    lines: ['tool call / trace', 'prompt x-ray', 'runtime metrics'],
  })}
  ${node({
    cx: 1238,
    cy: 410,
    r: 112,
    fill: '#ffedd5',
    stroke: '#ea580c',
    num: '3',
    title: 'F192 Eval',
    lines: ['预期 vs 实际', '归因到层级', '形成 action'],
  })}
  ${node({
    cx: 1254,
    cy: 740,
    r: 112,
    fill: '#dcfce7',
    stroke: '#16a34a',
    num: '4',
    title: '记忆升级',
    lines: ['F102 / F163', 'F169 / F188', '能力+配套同 PR'],
  })}
  ${node({
    cx: 900,
    cy: 890,
    r: 112,
    fill: '#fef3c7',
    stroke: '#ca8a04',
    num: '5',
    title: 'Re-eval',
    lines: ['turns-to-baton', 'grep_after_search', 'adoption rate'],
  })}
  ${node({
    cx: 540,
    cy: 765,
    r: 112,
    fill: '#e0e7ff',
    stroke: '#4f46e5',
    num: '6',
    title: '决策',
    lines: ['继续 / 精简', 'sunset / 下一轮', '不是凭感觉'],
  })}

  <rect x="662" y="438" width="476" height="310" rx="36" fill="#ffffff" stroke="#172033" stroke-width="5"/>
  <text x="900" y="492" class="font" text-anchor="middle" fill="#111827" font-size="36" font-weight="900">Project-Fit Memory</text>
  <text x="900" y="532" class="font" text-anchor="middle" fill="#475569" font-size="25" font-weight="650">项目适配型记忆</text>
  <line x1="725" y1="558" x2="1075" y2="558" stroke="#172033" stroke-width="2" opacity=".35"/>
  ${textLines(['通用底座：FTS / vector / graph / files', '项目适配：docs / ADR / skill / thread', '权限边界：truth source / owner / review', '进化层：真实摩擦 → eval → 下一轮升级'], 712, 596, 22, '#1f2937', 620, 1.38)}

  ${box({
    x: 92,
    y: 226,
    w: 335,
    h: 300,
    fill: '#f8fafc',
    stroke: '#334155',
    title: '触发器从哪里来？',
    accent: '#0f172a',
    lines: [
      '猫猫真实工作摩擦',
      'CVO 反馈和愿景纠偏',
      '外部理念 / 论文 / teardown',
      'review 发现与事故教训',
      'dashboard 指标触发阈值',
    ],
  })}

  ${box({
    x: 92,
    y: 582,
    w: 335,
    h: 286,
    fill: '#f0fdf4',
    stroke: '#15803d',
    title: '不是 sunset',
    accent: '#166534',
    lines: [
      'sunset：删掉或退役旧规则',
      '适配飞轮：决定系统',
      '该怎么长',
      '新增工具 / 改入口 / 调权重',
      '也可精简或撤回能力',
    ],
  })}

  ${box({
    x: 1382,
    y: 226,
    w: 330,
    h: 300,
    fill: '#fff7ed',
    stroke: '#c2410c',
    title: '外部 memory 做不到',
    accent: '#9a3412',
    lines: [
      '不知道本项目真相源层级',
      '不知道旧决策是否已失效',
      '不知道猫为什么又去 grep',
      '不知道新猫接球慢在哪里',
      '不知道哪条 lesson 该进 skill',
    ],
  })}

  ${box({
    x: 1382,
    y: 582,
    w: 330,
    h: 286,
    fill: '#f5f3ff',
    stroke: '#7c3aed',
    title: '最终卖点',
    accent: '#5b21b6',
    lines: ['通用底座可买', '项目适配必须长出来', 'eval 让升级不是拍脑袋', '这就是企业级 agent', '记忆壁垒'],
  })}

  <rect x="355" y="1000" width="1090" height="58" rx="18" fill="#172033" opacity=".92"/>
  <text x="900" y="1037" class="font" text-anchor="middle" fill="#fffaf0" font-size="26" font-weight="750">一句话：记忆不是安装出来的，是在真实工作中被 tracking 和 eval 训练出来的。</text>
</svg>`;

await fs.mkdir(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(out);
