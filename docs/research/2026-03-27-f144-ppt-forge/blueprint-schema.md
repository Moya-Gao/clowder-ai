---
feature_ids: [F144]
topics: [blueprint, schema, contract, pptxgenjs]
doc_kind: note
created: 2026-03-27
---

# F144 PPT Forge — Blueprint Schema（层间 Contract）

> 作者：宪宪 (Opus-46) | 日期：2026-03-27
> 砚砚要求：先定 contract 再调研库，否则后面都会飘

## 结论

Blueprint 是五层管线的**中枢 contract** — Narrative 层的叙事意图经过它转化为 Export 层的可执行指令。
没有 Blueprint，叙事猫和导出猫会在"这一页到底放什么"上互相覆盖。

## 1. 最小 Schema（TypeScript Interface）

```typescript
/**
 * deck.blueprint.json 的顶层结构
 * 一个 Blueprint = 一份完整的 Deck 规划
 */
interface DeckBlueprint {
  /** Schema 版本，用于未来兼容 */
  version: '1.0';

  /** 元信息 */
  meta: {
    title: string;                    // Deck 标题
    subtitle?: string;                // 副标题
    author: string;                   // 生成者（猫猫签名）
    createdAt: string;                // ISO 8601
    researchRef: string;              // 指向 research.md 的相对路径
    storylineRef: string;             // 指向 storyline.md 的相对路径
    themeRef: string;                 // 指向 theme.tokens.json 的相对路径
    framework: NarrativeFramework;    // 使用的叙事框架
    targetAudience: AudienceType;
  };

  /** 页面序列 — Blueprint 的核心 */
  slides: SlideSpec[];

  /** 全局资产清单（图片/图标/Logo） */
  assets: AssetRef[];
}

/** 叙事框架类型 */
type NarrativeFramework = 'pyramid' | 'scq' | 'problem-solution';

/** 受众类型（影响信息密度和用语） */
type AudienceType = 'corporate-executive' | 'technical-deep-dive' | 'keynote-public' | 'internal-team';

/**
 * 单页 Slide 规格 — Blueprint 的原子单位
 */
interface SlideSpec {
  /** 页码（1-based） */
  pageNum: number;

  /** 🔴 页面意图 — 砚砚铁律：没有目的的页不能进 Blueprint */
  intent: SlideIntent;

  /** 这页存在的目的（一句话，Narrative Gate 检查项） */
  purpose: string;

  /** Layout 选择 */
  layout: LayoutSpec;

  /** 页面元素 */
  elements: SlideElement[];

  /** 演讲者备注 */
  speakerNotes?: string;

  /** 证据引用 — 指向 research.md 的具体结论 */
  evidenceRefs?: EvidenceRef[];

  /** 过渡说明（和上一页的逻辑关系） */
  transition?: string;
}

/**
 * 页面意图枚举
 * 每种意图有默认 layout 推荐，但可以覆盖
 */
type SlideIntent =
  | 'cover'              // 封面
  | 'agenda'             // 目录/议程
  | 'section-break'      // 章节分隔
  | 'key-statement'      // 核心观点/金句
  | 'content'            // 标准内容（文字+图）
  | 'data-insight'       // 数据+洞察（图表为主）
  | 'comparison'         // 对比（表格/双栏）
  | 'timeline'           // 时间线/流程
  | 'evidence'           // 证据/引用
  | 'summary'            // 总结/回顾
  | 'closing'            // 结尾/CTA
  | 'appendix';          // 附录

/**
 * Layout 规格
 */
interface LayoutSpec {
  /** Layout ID（对应 Slide Master 中定义的 layout） */
  layoutId: string;

  /** Layout 描述（供人类阅读） */
  description: string;

  /** Slot 定义 — 每个 slot 是 layout 中的一个区域 */
  slots: LayoutSlot[];
}

/**
 * Layout Slot — layout 中的一个可填充区域
 */
interface LayoutSlot {
  /** Slot 名称（对应 Slide Master placeholder name） */
  name: string;

  /** Slot 类型 */
  type: 'title' | 'subtitle' | 'body' | 'chart' | 'image' | 'table' | 'icon' | 'kpi-number' | 'kpi-label' | 'caption';

  /** 位置和尺寸（inches，pptxgenjs 格式） */
  position: { x: number; y: number; w: number; h: number };
}

/**
 * 页面元素 — 填充到 Layout Slot 中的具体内容
 */
type SlideElement =
  | TextElement
  | ChartElement
  | ImageElement
  | TableElement
  | KPIElement;

interface TextElement {
  type: 'text';
  slotName: string;           // 对应 LayoutSlot.name
  content: string;            // 文本内容（支持 Markdown 子集：**bold** / *italic*）
  fontSize?: number;          // 覆盖 theme 默认值
  fontWeight?: 'regular' | 'bold';
  align?: 'left' | 'center' | 'right';
}

/**
 * 🔴 Chart Data Contract — 砚砚优先级 #1
 * 图表必须是原生 OOXML chart object，不能退化为图片
 */
interface ChartElement {
  type: 'chart';
  slotName: string;

  /** pptxgenjs chart type */
  chartType: 'area' | 'bar' | 'bar3d' | 'bubble' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter' | 'combo';

  /** 图表数据（pptxgenjs 原生格式） */
  series: ChartSeries[];

  /** 图表配置 */
  options?: {
    barDir?: 'col' | 'bar';                       // 柱状图方向
    barGrouping?: 'clustered' | 'stacked' | 'percentStacked';
    showTitle?: boolean;
    title?: string;
    showLegend?: boolean;
    legendPos?: 'b' | 't' | 'l' | 'r' | 'tr';
    showValue?: boolean;
    showPercent?: boolean;
    dataLabelPosition?: 'bestFit' | 'b' | 'ctr' | 'inEnd' | 'outEnd' | 'l' | 'r' | 't';
    catAxisTitle?: string;
    valAxisTitle?: string;
    valAxisMaxVal?: number;
    valAxisMinVal?: number;
    /** 图表调色盘（从 theme.tokens.json 派生，可覆盖） */
    chartColors?: string[];
  };
}

/** 图表数据系列 */
interface ChartSeries {
  name: string;             // 系列名（图例中显示）
  labels: string[];         // 分类标签
  values: number[];         // 数据值
}

interface ImageElement {
  type: 'image';
  slotName: string;
  /** 资产引用（指向 assets 数组中的 assetId） */
  assetId: string;
  /** 图片描述（alt text，无障碍） */
  alt: string;
  sizing?: { type: 'contain' | 'cover' | 'crop'; w: number; h: number };
}

interface TableElement {
  type: 'table';
  slotName: string;
  headers: string[];
  rows: string[][];
  /** 高亮行（0-based index） */
  highlightRows?: number[];
}

interface KPIElement {
  type: 'kpi';
  slotName: string;
  number: string;           // "42%"、"$1.2B"、"3x" 等
  label: string;            // KPI 说明
  trend?: 'up' | 'down' | 'flat';
  trendColor?: string;      // 覆盖 theme 默认值
}

/**
 * 证据引用 — 追溯到 research.md
 * 砚砚要求：产物必须能回答"这页数据哪来的"
 */
interface EvidenceRef {
  /** research.md 中的结论编号或行号 */
  conclusionId: string;
  /** 原始来源（URL 或文档名） */
  source: string;
  /** 引用类型 */
  type: 'fact' | 'inference' | 'recommendation';
  /** 引用摘要 */
  summary: string;
}

/**
 * 全局资产引用
 */
interface AssetRef {
  assetId: string;          // 唯一标识
  type: 'image' | 'icon' | 'logo' | 'svg';
  /** 文件路径（相对于 blueprint 目录） */
  path: string;
  /** base64 编码（Slide Master 背景图需要） */
  base64?: string;
  license?: string;         // 资产许可证
}
```

## 2. 预定义 Layout 库（Phase A 最小集）

```typescript
/**
 * Phase A 先做 8 个核心 layout，覆盖所有 SlideIntent
 * 基于 16:9（10" × 5.625"）
 */
const LAYOUTS: Record<string, LayoutSpec> = {
  /** 封面：大标题 + 副标题 + Logo */
  'layout-cover': {
    layoutId: 'layout-cover',
    description: '封面页：居中大标题 + 副标题 + 底部 Logo',
    slots: [
      { name: 'title',    type: 'title',    position: { x: 1, y: 1.5, w: 8, h: 1.5 } },
      { name: 'subtitle', type: 'subtitle', position: { x: 1, y: 3.2, w: 8, h: 0.8 } },
      { name: 'logo',     type: 'image',    position: { x: 4, y: 4.5, w: 2, h: 0.8 } },
    ],
  },

  /** 章节分隔：大标题 + 章节编号 */
  'layout-section': {
    layoutId: 'layout-section',
    description: '章节分隔页：居中大标题 + 章节标签',
    slots: [
      { name: 'label', type: 'caption', position: { x: 1, y: 1.8, w: 8, h: 0.5 } },
      { name: 'title', type: 'title',   position: { x: 1, y: 2.4, w: 8, h: 1.5 } },
    ],
  },

  /** 标题+正文：经典的标题在上、正文在下 */
  'layout-title-body': {
    layoutId: 'layout-title-body',
    description: '标准内容页：顶部标题 + 主体正文区',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.6, y: 0.4, w: 8.8, h: 0.6 } },
      { name: 'body',  type: 'body',  position: { x: 0.6, y: 1.2, w: 8.8, h: 4.0 } },
    ],
  },

  /** 双栏：左文右文 或 左文右图 */
  'layout-two-col': {
    layoutId: 'layout-two-col',
    description: '双栏页：左右两个等宽区域',
    slots: [
      { name: 'title',    type: 'title', position: { x: 0.6, y: 0.4, w: 8.8, h: 0.6 } },
      { name: 'col-left', type: 'body',  position: { x: 0.6, y: 1.2, w: 4.1, h: 4.0 } },
      { name: 'col-right',type: 'body',  position: { x: 5.3, y: 1.2, w: 4.1, h: 4.0 } },
    ],
  },

  /** 数据+洞察：左侧图表 + 右侧洞察文本 */
  'layout-chart-insight': {
    layoutId: 'layout-chart-insight',
    description: '数据洞察页：左侧图表（60%）+ 右侧洞察文字（40%）',
    slots: [
      { name: 'title',   type: 'title', position: { x: 0.6, y: 0.4, w: 8.8, h: 0.6 } },
      { name: 'chart',   type: 'chart', position: { x: 0.6, y: 1.2, w: 5.5, h: 4.0 } },
      { name: 'insight', type: 'body',  position: { x: 6.5, y: 1.2, w: 3.0, h: 4.0 } },
    ],
  },

  /** 全幅图表：标题 + 大图表 */
  'layout-full-chart': {
    layoutId: 'layout-full-chart',
    description: '全幅图表页：顶部标题 + 全宽图表',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.6, y: 0.4, w: 8.8, h: 0.6 } },
      { name: 'chart', type: 'chart', position: { x: 0.6, y: 1.2, w: 8.8, h: 4.0 } },
    ],
  },

  /** KPI 仪表板：3-4 个 KPI 数字 */
  'layout-kpi': {
    layoutId: 'layout-kpi',
    description: 'KPI 仪表板：标题 + 3 个 KPI 卡片',
    slots: [
      { name: 'title',  type: 'title',      position: { x: 0.6, y: 0.4, w: 8.8, h: 0.6 } },
      { name: 'kpi-1',  type: 'kpi-number',  position: { x: 0.6, y: 1.5, w: 2.7, h: 1.5 } },
      { name: 'kpi-2',  type: 'kpi-number',  position: { x: 3.7, y: 1.5, w: 2.7, h: 1.5 } },
      { name: 'kpi-3',  type: 'kpi-number',  position: { x: 6.7, y: 1.5, w: 2.7, h: 1.5 } },
      { name: 'detail', type: 'body',        position: { x: 0.6, y: 3.5, w: 8.8, h: 1.7 } },
    ],
  },

  /** 结尾：居中 CTA + 联系信息 */
  'layout-closing': {
    layoutId: 'layout-closing',
    description: '结尾页：居中 CTA 标题 + 联系信息',
    slots: [
      { name: 'title',   type: 'title',    position: { x: 1, y: 1.5, w: 8, h: 1.5 } },
      { name: 'contact', type: 'body',     position: { x: 1, y: 3.5, w: 8, h: 1.5 } },
    ],
  },
};
```

## 3. 真实示例（NVIDIA GTC 具身智能 Demo）

```json
{
  "version": "1.0",
  "meta": {
    "title": "Embodied Intelligence at NVIDIA GTC 2026",
    "subtitle": "From Simulation to Physical AI — A Technical Deep Dive",
    "author": "[宪宪/Opus-46🐾]",
    "createdAt": "2026-03-27T18:00:00+08:00",
    "researchRef": "../research.md",
    "storylineRef": "../storyline.md",
    "themeRef": "../theme.tokens.json",
    "framework": "pyramid",
    "targetAudience": "technical-deep-dive"
  },
  "slides": [
    {
      "pageNum": 1,
      "intent": "cover",
      "purpose": "建立主题身份：NVIDIA 在具身智能领域的 GTC 2026 布局",
      "layout": { "layoutId": "layout-cover", "description": "封面", "slots": [] },
      "elements": [
        { "type": "text", "slotName": "title", "content": "Embodied Intelligence at GTC 2026", "align": "center" },
        { "type": "text", "slotName": "subtitle", "content": "From Isaac Sim to Physical AI Deployment", "align": "center" }
      ]
    },
    {
      "pageNum": 2,
      "intent": "key-statement",
      "purpose": "金字塔顶层结论：具身智能从仿真走向物理部署的拐点已到",
      "layout": { "layoutId": "layout-title-body", "description": "核心观点", "slots": [] },
      "elements": [
        { "type": "text", "slotName": "title", "content": "The Inflection Point Is Here" },
        { "type": "text", "slotName": "body", "content": "GTC 2026 marked the transition from **simulation-only** embodied AI to **physical deployment at scale**. Three signals: Isaac Sim 4.0 GA, Project GR00T partnership expansion, and Jetson Thor production timeline." }
      ],
      "evidenceRefs": [
        { "conclusionId": "C-01", "source": "https://nvidia.com/gtc/keynote/", "type": "fact", "summary": "Jensen Huang 宣布 Isaac Sim 4.0 GA 和 GR00T 合作伙伴扩展" }
      ],
      "speakerNotes": "开场直接给结论，不铺垫。这是金字塔原理的核心——结论先行。"
    },
    {
      "pageNum": 3,
      "intent": "data-insight",
      "purpose": "用数据支撑拐点判断：具身智能投资增长趋势",
      "layout": { "layoutId": "layout-chart-insight", "description": "图表+洞察", "slots": [] },
      "elements": [
        { "type": "text", "slotName": "title", "content": "Embodied AI Investment Trajectory" },
        {
          "type": "chart",
          "slotName": "chart",
          "chartType": "bar",
          "series": [
            { "name": "Investment ($B)", "labels": ["2022", "2023", "2024", "2025", "2026E"], "values": [2.1, 4.3, 8.7, 15.2, 28.5] }
          ],
          "options": { "barDir": "col", "showValue": true, "dataLabelPosition": "outEnd", "valAxisTitle": "USD Billions" }
        },
        { "type": "text", "slotName": "insight", "content": "**13.6x growth** in 4 years.\n\nThe 2025→2026 jump (87%) is driven by:\n- GR00T humanoid partnerships\n- Isaac Sim enterprise adoption\n- Jetson Thor pre-orders" }
      ],
      "evidenceRefs": [
        { "conclusionId": "C-05", "source": "PitchBook 2026 Robotics Report", "type": "fact", "summary": "具身智能赛道 2022-2026 投资数据" },
        { "conclusionId": "C-06", "source": "NVIDIA Investor Day 2026", "type": "inference", "summary": "2026E 数据为分析师共识预测" }
      ]
    }
  ],
  "assets": []
}
```

## 4. 不推荐路线

| 方案 | 为什么不用 |
|------|----------|
| **JSON-LD / Schema.org** | 语义 Web 标准，过度抽象，和 PPT 生成无关；增加解析复杂度，无收益 |
| **Markdown 作为 Blueprint** | 无法精确描述 layout slot 位置、图表数据结构、元素类型；解析歧义大 |
| **自由文本描述** | "第 3 页放一个柱状图"→ Export 层需要 NLP 理解意图 → 不确定性爆炸 → 违反 contract 精神 |
| **直接用 pptxgenjs API 对象** | 耦合太紧，Blueprint 应该是导出无关的；换导出引擎就要重写全部 Blueprint |
| **HTML 作为中间格式** | 对方 pptx-craft 的路线，导致文字不可编辑；而且 HTML layout 和 PPT layout 语义不同 |

## 5. 层间数据流总览

```
research.md                    → 事实/数据/来源
    ↓ (Narrative Layer)
storyline.md                   → 叙事结构（哪些结论、什么顺序、什么框架）
    ↓ (Blueprint Layer)
deck.blueprint.json            → 每页的 intent/layout/elements/evidenceRefs
    ↓ (Style Layer)
theme.tokens.json              → 品牌色/字体/间距 → Slide Master 配置
    ↓ (Export Layer)
deck.pptx                      → 原生 OOXML（pptxgenjs 生成）
```

**每层只读上一层的产物，不跨层依赖。** Blueprint 不知道最终用什么颜色（Style 的事），Style 不知道每页放什么（Blueprint 的事）。
