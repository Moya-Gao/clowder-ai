---
feature_ids: [F144]
topics: [ppt-forge, architecture-review, gpt-pro]
doc_kind: note
created: 2026-03-27
---

# F144 PPT Forge — GPT Pro 架构审阅（Mode B 咨询）

> 委托人：宪宪 (Opus-46) | 日期：2026-03-27
> 模式：Deep Research Mode B（云端模型咨询）

---

## Part 1: 发给 GPT Pro 的提示词

> 直接复制以下内容发送给 GPT Pro

---

你好，我们是一个 AI 多智能体协作团队（3 个 AI 模型家族协作开发），正在设计一个 **AI 驱动的演示文稿（PPT）自动生成引擎**。我们完成了初步架构设计和技术选型，请你作为审阅者帮我们找出架构盲区和逻辑漏洞。

### 背景

我们的目标：给定一个主题（如"英伟达 GTC 2026 具身智能分析"）+ 一个企业风格（如 nvidia-like），自动生成一份 ≥10 页的专业级 .pptx 演示文稿。

**核心约束**：
- 生成的 PPT 中文字必须可编辑、可搜索（不是截图嵌入）
- 图表必须是原生 OOXML chart object（双击可编辑数据）
- 技术栈是 TypeScript/Node.js（不能引入 Python 依赖）
- 风格是 "nvidia-like"（设计语法还原），不是 "nvidia"（不使用品牌资产/商标）

### 我们的架构：五层管线 + 五道门禁

```
用户输入: "英伟达 GTC 2026 具身智能分析，英伟达风格"
  ↓
Layer 1: Research        → 多源深度调研
  ↓  产物: research.md（每个结论带来源引用，区分事实/推断/建议）
  ↓  ── Research Gate ──
Layer 2: Narrative       → 结构化叙事引擎（金字塔原理/SCQ 框架）
  ↓  产物: storyline.md（每页有"存在目的"）
  ↓  ── Narrative Gate（可选人工审批叙事方向）──
Layer 3: Blueprint       → 页面蓝图生成器
  ↓  产物: deck.blueprint.json（每页 layout/元素/图表数据/引用位）
  ↓  ── Blueprint Gate ──
Layer 4: Style           → Design Token 三层体系
  ↓  产物: theme.tokens.json（品牌→语义→Slide Master 配置）
Layer 5: Export          → pptxgenjs 原生 OOXML 生成
  ↓  产物: deck.pptx
  ↓  ── Export Gate + Vision Gate ──
```

**五份中间产物 = contract chain**：`research.md → storyline.md → deck.blueprint.json → theme.tokens.json → deck.pptx`。每层只读上一层的产物，不跨层依赖。

### 核心技术决策

#### 1. Blueprint 作为中枢 Contract

Blueprint（`deck.blueprint.json`）是管线的中枢——Narrative 层的叙事意图经过它转化为 Export 层的可执行指令。核心接口：

```typescript
interface DeckBlueprint {
  version: '1.0';
  meta: {
    title: string;
    subtitle?: string;
    author: string;
    createdAt: string;           // ISO 8601
    researchRef: string;         // 指向 research.md
    storylineRef: string;        // 指向 storyline.md
    themeRef: string;            // 指向 theme.tokens.json
    framework: 'pyramid' | 'scq' | 'problem-solution';
    targetAudience: 'corporate-executive' | 'technical-deep-dive' | 'keynote-public' | 'internal-team';
  };
  slides: SlideSpec[];
  assets: AssetRef[];
}

interface SlideSpec {
  pageNum: number;
  intent: SlideIntent;          // cover | agenda | section-break | key-statement | content | data-insight | comparison | timeline | evidence | summary | closing | appendix
  purpose: string;              // 这页存在的目的（一句话）
  layoutId: string;             // 引用 Layout Catalog（单一真相源，不内嵌 layout 定义）
  elements: SlideElement[];     // TextElement | ChartElement | ImageElement | TableElement | KPIElement
  speakerNotes?: string;
  evidenceRefs?: EvidenceRef[]; // 追溯到 research.md 的具体结论
  transition?: string;          // 和上一页的逻辑关系
}

// 图表数据 = pptxgenjs 原生格式
interface ChartElement {
  type: 'chart';
  slotName: string;
  chartType: 'area' | 'bar' | 'bar3d' | 'bubble' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter'; // combo 延后到 Phase B
  series: { name: string; labels: string[]; values: number[] }[];
  options?: { barDir?: 'col' | 'bar'; showValue?: boolean; /* ...其他 pptxgenjs chart options */ };
}

// 证据引用 — 可追溯到 research.md
interface EvidenceRef {
  conclusionId: string;         // research.md 中的结论编号
  source: string;               // 原始来源 URL
  type: 'fact' | 'inference' | 'recommendation';
  summary: string;
}
```

**Layout Catalog**：8 个预定义 layout（cover / section / title-body / two-col / chart-insight / full-chart / kpi / closing），每个定义了 slot 的 name、type、position（x/y/w/h inches）。SlideSpec 通过 `layoutId` 引用，不内嵌 layout 定义（避免双真相源）。

#### 2. 导出引擎：pptxgenjs

7 方案对比后选定 pptxgenjs（TypeScript 原生，生成 OOXML `<c:chartSpace>` chart parts）。关键特性：
- 图表双击可编辑（Edit Data in Excel）
- 10 种原生图表类型（area/bar/bar3d/bubble/doughnut/line/pie/radar/scatter + combo）
- Slide Master / Placeholder / 绝对定位
- 支持 base64/URL 图片、100+ 形状、SVG

已知坑（来自 Anthropic 官方 pptxgenjs skill + 社区）：
1. hex 颜色不能带 `#` → 文件损坏
2. 不能用 8 位 hex 编码透明度 → 文件损坏
3. 对象会被突变（in-place to EMU）→ 不能复用 options 对象
4. shadow offset 必须非负 → 否则文件损坏
5. `charSpacing` not `letterSpacing`（后者被静默忽略）
6. Pie/Doughnut 不支持 data table
7. pptxgenjs 不支持字体栈（不能写 `"Inter, Calibri"`）
8. 不自动嵌入字体到 .pptx

**SlideBuilder 抽象层**封装这些坑：`build(blueprint, theme) → PptxGenJS`，工厂模式生成 options，Export Gate 内建校验。

#### 3. Design Token 三层体系

```
Layer 1: Brand Foundation（品牌基础）— 颜色/字体/间距原始值
    ↓
Layer 2: Slide Semantic（幻灯片语义）— 按页面角色分配（cover/section/content/kpi/chart/table/closing）
    ↓
Layer 3: Slide Master Config — 直接驱动 pptxgenjs defineSlideMaster()
```

nvidia-like 示例 token（摘要）：
- 主色 `76B900`（NVIDIA 绿），背景 `121212`（深灰近黑）
- Inter 700 (heading) / Inter 400 (body) / IBM Plex Mono (code)
- 图表调色盘：6 色渐变绿系

**品牌边界**：`nvidia-like ≠ nvidia`。我们 token 化的是设计语法（配色系统、字体层级、间距韵律），不使用品牌资产（Logo、专属字体 NVIDIA Sans、商标图形）。

#### 4. 字体双轨策略

- Primary：品牌近似字体（Inter/IBM Plex/DM Sans），开源许可
- Fallback：token 中记录推荐保底字体（Calibri/Helvetica Neue），仅供参考
- pptxgenjs 始终写入 primary 字体名，实际替换由 PowerPoint 控制
- 我们无法控制 PowerPoint 的字体替换行为，Export Gate 只做观测记录

#### 5. 叙事引擎

Phase A 支持两种叙事框架：
- **金字塔原理**：结论先行 → 支撑论据 → 数据证据
- **SCQ（Situation-Complication-Question）**：现状 → 挑战 → 解答

实现方式：**结构化模板 + prompt 增强**（混合方案）。纯 prompt 不稳定，纯模板僵硬。

### 请求

**请帮我们审阅这个架构，重点关注：**

1. **架构盲区**：五层管线 + 五道门禁的设计中，有没有我们遗漏的关键环节或层间耦合风险？
2. **Blueprint schema 健壮性**：SlideSpec/ChartElement/EvidenceRef 的接口设计，有没有在实际使用中会遇到的问题？比如边界情况、扩展性不足、过度设计？
3. **pptxgenjs 的额外风险**：除了我们列出的 8 个已知坑，还有没有在生产中容易踩的问题？特别是大 deck（30-50 页）、复杂图表、CJK 文字排版方面。
4. **Design Token 体系的实用性**：三层 token 在实际开发中是否过度抽象？token → Slide Master 的映射有没有常见的 gap？
5. **叙事引擎的有效性**：金字塔/SCQ 模板 + AI prompt 增强的方案，业界有没有更成熟的做法？AI 生成的叙事结构容易出现哪些失败模式？
6. **竞品视角**：如果你知道其他类似的 AI PPT 生成项目/产品（如 Gamma、Beautiful.ai、Tome 等），我们的架构相比它们有什么优劣势？

**输出期望**：
- 每个发现标注严重程度（Critical / Major / Minor / Suggestion）
- 区分"已确认的问题"和"值得验证的假设"
- 如果有替代方案建议，给出 tradeoff 分析

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官粘贴 GPT Pro 的回答到这里

[待回填]

---

## Part 3: 综合后的最终版本（待撰写）

> 宪宪读 Part 2 后对照 codebase 验证，综合撰写

[待撰写]
