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

我先给结论：这套架构骨架是对的，像一台齿轮比已经算明白的机床，不是黑箱搅拌机。对你们这个约束组合，也就是“文本可编辑/可搜索 + 图表必须是原生 OOXML + TS/Node-only”，用 Blueprint 做中枢 contract、用 PptxGenJS 做 native export，是合理路线。真正的高风险点不在“能不能吐出一个 `.pptx`”，而在“能不能稳定回改、可验证、可审计、可控扩展”。PptxGenJS 官方能力确实覆盖 charts、Slide Master、placeholders、Asian fonts 等，但截至 2025-06-26 的 4.0.1 之后，公开 issue 里仍有 combo chart、repair dialog 等新问题，所以生产化要靠支持子集和回归矩阵，而不能只靠 happy path。 ([Gitbrent][1])

## 已确认的问题

**Critical · 架构** 你们的 Gate 现在更像收费站，不像变速箱。Vision Gate 如果只有 pass/fail，没有结构化诊断和上游 patch 协议，遇到 overflow、布局挤压、证据错绑、chart label 异常时，只能整层重跑，结果通常是内容也跟着漂。PreGenie 的有效做法是 code review + page review 后只回修有问题的页，DECKBench 也把多轮编辑和 instruction following 当成一等评估对象。建议把 Gate 产物显式化为 `qa.report.json`、`blueprint.patch.json`、`narrative.patch.json`。代价是打破“层只读上一层”的纯洁性；收益是局部修复、失败归因和多轮编辑能力会陡然变强。 ([arXiv][2])

**Major · Gate** 五道 Gate 目前还是流程节点，不是评分协议。PresentBench 说明 holistic judgment 太粗，而且 Visual Design & Layout 本身就是当前 slide 系统的主要瓶颈；DECKBench 则把评估拆成 slide-level、deck-level、multi-turn interaction-level 三层。建议每个 Gate 都输出结构化 scorecard，至少包含 `fidelity`、`correctness`、`completeness`、`visual/layout`、`coherence`、`editability`、`overflow`、`brand compliance`。代价是评测工程会变厚；收益是你们终于知道坏的是事实、布局、逻辑，还是 revision 能力。 ([arXiv][3])

**Critical · 架构/排版** Style 放在 Blueprint 之后，理论上优雅，实操上是假解耦。字号、字体回退、中文 `lang`、chart title/legend 字体、table autoPage 都会直接改变“一页到底能装多少东西”。PptxGenJS 文本 API 明确有 `fit`、`fontFace`、`lang:'zh-TW'` 这类选项，表格 auto-paging 官方也直说是启发式，不是精确科学。所以 Blueprint 实际上已经被 Theme/Render profile 影响，只是现在没被承认。建议把 theme 选择前移，或者至少在 Blueprint 阶段注入 `renderProfile` / `layoutCapacity`。代价是层间耦合变多；收益是 CJK 断行、字号塌缩、临门一脚 overflow 会少很多。 ([Gitbrent][4])

**Major · Contract** `research.md` 和 `storyline.md` 适合人读，不适合 Gate 严格消费。PresentBench 的经验很直接，细粒度、可验证、instance-specific 的 rubric 比整体打分更能定位 slide 生成错误。你们如果想做可靠 Gate，最好走双轨 contract，也就是 Markdown 继续保留给人看，同时增加 `research.json` / `storyline.json`，带 stable IDs、枚举字段、hash、版本号和 diff-friendly 结构；否则一旦 research 更新，stale storyline 很容易悄悄活下来。代价是中间产物多一份；收益是回归、缓存失效、局部重算和错误定位都顺手很多。 ([arXiv][3])

**Critical · Blueprint/证据** `pageNum` 不能当稳定主键，`transition?: string` 太软，slide-level `evidenceRefs` 也太粗。PresentBench 的 Fidelity 是 page-level grounded check，DECKBench 甚至把 transition similarity 提出来单独评。你们更适合加 `sectionId / slideId / elementId / claimId / revision`，并把证据绑定到 claim 或 element，而不是整页一捆。`EvidenceRef` 还应该补 `locator`（页码/段落/时间戳）、`retrievedAt`、`snapshotHash`、`quote`、`confidence`。另外，PptxGenJS 本身支持 slide sections，你们 deck 顶层也应该有 `sections[]`，而不只是塞几个 section-break slide。代价是 schema 变胖；收益是 revision、引用核查、Vision 对账都会轻松得多。 ([arXiv][3])

**Critical · Blueprint/图表** `ChartElement` 现在两头吃亏。一头太薄，`series: {name, labels, values}[]` 只能勉强描述 category chart，天然不适配 scatter/bubble，也不利于 combo；另一头又太漏，`options` 直接承接 pptxgenjs chart options，相当于把 renderer-specific API 偷渡进 central contract。官方文档已经说明 combo chart 的函数签名和普通 chart 不同，而且 secondary axis 还有额外渲染前提。我的建议是把 Blueprint 保持在 renderer-agnostic 的“意图 + 数据 + 编码 + 展示语义”层，再由 Export adapter 降级成 pptxgenjs options。代价是 adapter 层更厚；收益是 contract 更稳定，未来升级库版本甚至换 exporter 也不会骨折。 ([Gitbrent][5])

我会把最小升级版 schema 改到这个粒度：

```ts
type ClaimSpec = {
  claimId: string;
  text: string;
  evidenceRefs: EvidenceRef[];
  priority: 'must' | 'should' | 'nice';
};

type RenderBudget = {
  maxWords: number;
  minFontPt: number;
  overflowPolicy: 'split-slide' | 'shrink' | 'truncate';
};

type SlideSpecV2 = {
  slideId: string;
  sectionId?: string;
  revision: number;
  intent: SlideIntent;
  purpose: string;
  transition?: {
    type: 'supports' | 'contrasts' | 'zooms-in' | 'answers' | 'summarizes';
    fromSlideId?: string;
  };
  renderBudget: RenderBudget;
  claims: ClaimSpec[];
  elements: SlideElement[];
};

type ChartElementV2 =
  | {
      chartProfile: 'categorical';
      categories: string[];
      series: { name: string; values: (number | null)[] }[];
    }
  | {
      chartProfile: 'xy';
      series: { name: string; points: { x: number; y: number; label?: string }[] }[];
    }
  | {
      chartProfile: 'bubble';
      series: { name: string; points: { x: number; y: number; size: number; label?: string }[] }[];
    };
```

这会让 schema 胖一点，但能把未来最贵的技术债提前关进笼子里。

**Minor · Layout Catalog** 8 个 layout 作为 Phase A 我支持，它能压住风格漂移；但如果你们目标是 30-50 页长 deck，固定 8 张模具很容易出现“内容不同，姿势相同”的模板味。更稳的做法是“8 个 layout family × 各自 2-4 个 variant + 明确容量约束”，而不是“永远只有 8 个版式”。Beautiful.ai 的核心之一是 Smart Slides，Plus AI 明说自己有 hundreds of layouts，PPTAgent 则会先分析 reference deck 的 slide-level functional types 再生成。代价是组合空间变大；收益是长 deck 不会像一支复制出来的方阵。 ([Beautiful.ai][6])

**Major · Design Token** 三层 token 不是过度抽象，但第三层不该只落到 Slide Master。PptxGenJS 的 master 确实适合承载 branding 和 placeholders，可很多真正影响结果的样式都落在 object API 上，比如 chart title/legend/cat axis 字体、text `lang` / `fit`、image sizing / altText。我的建议是把第三层从 `Slide Master Config` 重命名为 `Render Recipes`，其中一部分生成 master，另一部分生成 per-object defaults 和 validators。代价是 renderer 更厚；收益是 token 不会在最后一厘米断电。 ([Gitbrent][7])

**Major · Export/支持矩阵** 除了你们列的 8 个坑，我还会把 4 件事写进官方风险清单：一是 combo chart 不是普通 chart 的同类接口，次轴有额外前提；二是 table auto-paging 官方自己都说是启发式；三是非英文字体尤其中文最好显式设置 `lang`；四是大 deck 的图片读取/编码会吃 CPU，最好预编码 base64。基于这些文档约束，我会把 Phase A 的支持矩阵写得像法律条文一样冷酷，例如只承诺 PowerPoint 365 Win/Mac，Google Slides / Keynote 只保证可打开，不保证图表编辑 fidelity。代价是首发支持面变窄；收益是少掉一大桶“客户机器上弹 repair dialog”的工单。 ([Gitbrent][5])

**Major · 资产/合规** 你们有 theme token，但还缺一个 `asset/compliance` 账本。对 `nvidia-like ≠ nvidia`，真正要防的不只是配色，而是 logo、专属字体名、图片 license、alt text、裁切 rendition、重复资产、来源快照和 attribution。PptxGenJS 已经支持图片与图表的 altText，也支持图片 contain/cover/crop，所以这层完全可以进 contract，而不是留给最后一拍脑袋。建议单独做 `asset.manifest.json` 和 brand-policy linter。代价是素材链路更复杂；收益是品牌边界、可访问性和法律风险都更可控。 ([Gitbrent][8])

**Major · Narrative** 金字塔 / SCQ + template + prompt 增强是合理 MVP，不需要急着换成一支过度热闹的 agent 乐队。但要把 `deliveryMode` 做成一等公民。NotebookLM 官方已经把 Detailed Deck 和 Presenter Slides 分开，说明“同一内容，不同交付模式”不是细节，而是根约束。建议 Narrative 输入显式加 `deliveryMode`、`timeBudgetMinutes`、`maxWordsPerSlide`、`citationDensityTarget`，Blueprint 再加 `dropPriority`；另外 `framework` 也更适合按 section/arc 配置，而不是整个 deck 只有一个枚举。代价是输入参数更多；收益是 deck 不会一会像 handout，一会像台上讲稿。 ([Google帮助][9])

**Suggestion · Narrative** 更成熟的方向不是推翻你们当前架构，而是在 Narrative/Blueprint 之间加一个小型编辑部，也就是 `reference-retriever`、`deck-critic`、`redundancy-pruner`。PPTAgent 证明了 reference-guided、edit-based generation 比一锤子出全 deck 更贴近人类工作流；PreGenie 又证明 code review + page review + selective regenerate 能补上“代码看不出、页面一眼能看出”的错误。我预期你们最常见的失败模式会是中段重复、证据预算后继无力、transition 语义空、overflow 时删错内容，以及 presenter deck / leave-behind 模式串台。代价是系统更复杂、推理成本更高；收益是 coherence、consistency 和局部修订能力明显更强。 ([arXiv][10])

## 值得验证的假设

**Major · pptxgenjs 4.0.1** combo 我会继续冻结到 Phase B。截至 2026-03，有 open issue 直接报告 combo chart not working；而官方 docs 本来就承认 combo 的约束比普通 chart 多。你们没必要在 GA 首发时主动踩这片沼泽。代价是少掉一类常见商业图；收益是崩溃和 repair 风险显著下降。 ([GitHub][11])

**Major · OOXML 结构稳定性** 近期 open issues 形成了一个很刺眼的 repair-dialog 簇，包括 phantom slideMaster entries、notesMaster placeholder 被修复删除、solid background 缺 `effectLst`、shape 无 `txBody`、table margin 生成 `NaN`。这类问题不是审美问题，而是包结构问题，所以一定要做“打开文件无 repair 弹窗”的回归，并至少覆盖 PowerPoint 365 Win/Mac。Speaker Notes 虽然文档支持，但在这些问题没被你们环境验证前，我不会默认开。 ([GitHub][12])

**Major · 可编辑图表/CJK** `可编辑图表` 这块还要额外盯三件事：scatter/bubble 的独立格式化、编辑图表数据后的 embedded worksheet 格式漂移与 0 值空白、以及中文 chart title/legend/category font 不生效。尤其最后一个很关键，因为文本框的 CJK 处理和图表对象的 CJK 处理看起来不是同一条管道，不能共用一份测试结论。 ([GitHub][13])

## 竞品视角

**Gamma** 更像速度和分享体验型选手。它公开材料里强调 working draft 可以很快起出来，支持导出 PDF/PPTX/Google Slides，MCP/API 也已经能被 Claude/ChatGPT 一类工具调用；但同样提醒 PowerPoint 导出可能会出现 layout differences，需要 review 后再发。你们如果把 native OOXML fidelity 做稳，会在“导出后仍然是 PPT，而不是 PPT 形状的纪念品”这件事上占优势。 ([Gamma][14])

**Beautiful.ai** 的核心壁垒不是 LLM，而是 Smart Slides + brand controls。它把自动对齐、间距、层级、主题复用做得很深，也支持 editable PowerPoint，但官方承认导入/导出会有 slight differences，设备没装字体时也可能出现差异。你们最该学它的，是 layout engine 和 team governance，不是“再加一个生成按钮”。 ([Beautiful.ai][6])

**NotebookLM** 是 grounding 优先型里最值得盯的。PresentBench 里它总体领先其他被测系统；产品上又把 Detailed Deck / Presenter Slides 分开，并支持下载 `.pptx`。但它当前 revisions 还不支持 add/remove slides，且 revisions 不会把 sources 纳入考虑。你们只要把 claim-level evidence 和 patch-based editing 做实，就有机会在“可控修订”上赢它。 ([arXiv][3])

**Plus AI** 是我会优先对标的直接竞品。它直接工作在 PowerPoint / Google Slides 里，强调 hundreds of layouts、editable charts and tables、自定义模板、共享 presets/custom instructions，甚至公开说自己构建并使用 Open XML renderer 生成 native PPTX。它证明了这条赛道不是幻觉。你们要和它拉开身位，最有希望的地方不是再多几个花式 prompt，而是 research provenance、contract-chain、brand compliance 和审计可解释性。 ([PlusDocs][15])

## 我会先改的 6 件事

1. 加 `qa.report.json` + patch loop，让 Vision/Export 能回写到 Blueprint/Narrative。
2. 把 `renderProfile` 前移，让 Blueprint 知道 typography/CJK 容量。
3. 把 evidence 绑定到 `claim/element`，补 stable IDs、source locator、snapshot hash。
4. 冻结 Phase A 支持矩阵，明确 `no combo / no notes / no autoPage`。
5. 把 Layer 3 从 `Slide Master Config` 改成 `Render Recipes`。
6. 用 PresentBench / DECKBench 的思路，把五道 Gate 变成结构化 scorecards。

一句话收口：你们现在已经像一套“能导出”的系统了，下一步要把它打磨成一套“能诊断、能回改、能审计”的系统。那一步做完，护城河会比很多黑箱式 AI PPT 产品深很多。

[1]: https://gitbrent.github.io/PptxGenJS/ "https://gitbrent.github.io/PptxGenJS/"
[2]: https://arxiv.org/html/2505.21660v2 "https://arxiv.org/html/2505.21660v2"
[3]: https://arxiv.org/html/2603.07244v1 "https://arxiv.org/html/2603.07244v1"
[4]: https://gitbrent.github.io/PptxGenJS/docs/api-text/ "https://gitbrent.github.io/PptxGenJS/docs/api-text/"
[5]: https://gitbrent.github.io/PptxGenJS/docs/api-charts.html "https://gitbrent.github.io/PptxGenJS/docs/api-charts.html"
[6]: https://www.beautiful.ai/ "https://www.beautiful.ai/"
[7]: https://gitbrent.github.io/PptxGenJS/docs/masters/ "https://gitbrent.github.io/PptxGenJS/docs/masters/"
[8]: https://gitbrent.github.io/PptxGenJS/docs/api-images/ "https://gitbrent.github.io/PptxGenJS/docs/api-images/"
[9]: https://support.google.com/notebooklm/answer/16757456?hl=en "https://support.google.com/notebooklm/answer/16757456?hl=en"
[10]: https://arxiv.org/html/2501.03936v3 "https://arxiv.org/html/2501.03936v3"
[11]: https://github.com/gitbrent/pptxgenjs/issues/1448 "https://github.com/gitbrent/pptxgenjs/issues/1448"
[12]: https://github.com/gitbrent/pptxgenjs/issues/1444 "https://github.com/gitbrent/pptxgenjs/issues/1444"
[13]: https://github.com/gitbrent/pptxgenjs/issues/1436 "https://github.com/gitbrent/pptxgenjs/issues/1436"
[14]: https://gamma.app/explore/content/guides/the-easiest-way-to-create-update-and-share-presentations "https://gamma.app/explore/content/guides/the-easiest-way-to-create-update-and-share-presentations"
[15]: https://www.plusdocs.com/ "https://www.plusdocs.com/"

---

## Part 3: 本地猫综合（宪宪 Opus-46）

> 综合原则：GPT Pro 不了解我们的项目约束（多猫协作、Phase 制、猫猫做 Gate reviewer），
> 所以他的建议需要过滤——Phase A 是 MVP 跑通管线，不是做 Beautiful.ai。

### 综合结论

GPT Pro 总体判断准确：**架构骨架对，风险在"能不能回改/审计"而非"能不能导出"**。
15 个发现中 **7 个 Phase A 吸纳、8 个 defer 到 Phase B、1 个 pushback**。

### Phase A 吸纳（改进 blueprint-schema + theme-token-spec + feature spec）

#### 1. Blueprint 注入 renderBudget（来自 GPT Pro #3 Style 假解耦）

**问题**：Blueprint 不知道"一页能装多少东西"，字号/CJK 断行在 Style 层才决定。
**吸纳方案**：SlideSpec 加 `renderBudget`，不前移 theme（保持关注点分离）。

```typescript
type RenderBudget = {
  maxWords: number;            // 单页文字上限（含 speaker notes 外）
  minFontPt: number;           // 最小字号底线（防止缩到看不清）
  overflowPolicy: 'split-slide' | 'shrink' | 'truncate';
};
```

Blueprint Layer 根据 `targetAudience` 注入默认值（如 keynote-public → maxWords: 40, minFontPt: 18），Export Layer 校验。

#### 2. slideId 替代 pageNum + 顶层 sections[]（来自 GPT Pro #5）

**问题**：`pageNum` 是位置，不是身份。插入/删除页后 pageNum 全部漂移。
**吸纳方案**：

```typescript
interface DeckBlueprint {
  // ...existing fields...
  sections: SectionSpec[];     // 新增：章节结构
  slides: SlideSpec[];
}

type SectionSpec = {
  sectionId: string;           // "sec-market" / "sec-tech"
  title: string;
  slideIds: string[];          // 有序引用
};

interface SlideSpec {
  slideId: string;             // 替代 pageNum 作为稳定主键
  sectionId?: string;          // 所属章节
  // pageNum 降级为 render-time 计算值，不进 contract
  // ...rest unchanged...
}
```

#### 3. transition 结构化（来自 GPT Pro #5）

**问题**：`transition?: string` 自由文本，Gate 无法机器检查。
**吸纳方案**：

```typescript
transition?: {
  type: 'supports' | 'contrasts' | 'zooms-in' | 'answers' | 'summarizes';
  fromSlideId?: string;
};
```

#### 4. ChartElement discriminated union（来自 GPT Pro #6）

**问题**：`series: {name, labels, values}[]` 不适配 scatter/bubble。
**吸纳方案**：chartProfile 区分数据形状，options 保留为 renderer hints。

```typescript
type ChartData =
  | { chartProfile: 'categorical'; categories: string[]; series: { name: string; values: (number | null)[] }[] }
  | { chartProfile: 'xy'; series: { name: string; points: { x: number; y: number; label?: string }[] }[] }
  | { chartProfile: 'bubble'; series: { name: string; points: { x: number; y: number; size: number; label?: string }[] }[] };

interface ChartElement {
  type: 'chart';
  slotName: string;
  chartType: 'area' | 'bar' | 'bar3d' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter';
  data: ChartData;
  /** Renderer hints（可选覆盖，不是 contract 核心） */
  hints?: Record<string, unknown>;
}
```

**Pushback**：GPT Pro 建议完全 renderer-agnostic + adapter 层。我们只有 pptxgenjs 一个 exporter，
为假想的"换 exporter"建 adapter = YAGNI。保留 hints 作为可选覆盖。

#### 5. Layer 3 改名 Render Recipes（来自 GPT Pro #8）

**问题**：Layer 3 叫 "Slide Master Config" 但实际还包括 createChartOptions 工厂等 per-object 配置。
**吸纳**：文档更名，明确 Layer 3 = Slide Masters + per-object defaults + validators。

#### 6. Phase A 支持矩阵冻结（来自 GPT Pro #9）

| 平台 | Phase A 承诺 |
|------|-------------|
| PowerPoint 365 Win/Mac | **完全支持**：文字可编辑、图表可编辑、布局无 repair 弹窗 |
| PowerPoint 2021+ | **基本支持**：功能同上，未回归的版本差异标 ⚠️ |
| Keynote | **可打开**：文字可读，图表编辑不保证 |
| Google Slides | **可打开**：同上 |
| LibreOffice Impress | **不承诺** |

#### 7. POC 验证清单补充（来自 GPT Pro #14 #15）

在 engine-options.md 已有 POC 表基础上补两项：

| 项目 | 风险 | 验证方式 |
|------|------|---------|
| **OOXML repair dialog 回归** | 高 | 生成测试 .pptx → PPT 365 Win/Mac 打开 → 无 repair 弹窗 |
| **CJK 图表字体** | 中 | 生成含中文 chart title/legend/category 的 .pptx → 验证字体是否生效（图表 CJK ≠ 文本框 CJK） |

### Phase B defer（记录到 feature spec OQ/Risk，不在 Phase A 实现）

| GPT Pro 建议 | 为什么 defer | Phase B 标记 |
|---|---|---|
| Gate patch loop（qa.report.json → 回写上游） | Phase A 10-15 页，整层重跑成本不高 | OQ-7 |
| Gate scorecard 评分协议 | Phase A Gate 是猫猫 review（人工），不是自动评分器 | OQ-8 |
| research.json / storyline.json 双轨 contract | Phase A Gate 消费者是猫不是程序 | OQ-9 |
| claim-level evidence binding | 10 页 deck 证据绑到 slide 够了 | OQ-10 |
| Layout variant system（8 × 2-4 variant） | Phase A 目标是跑通管线 | Phase B AC-B5 |
| asset.manifest.json + brand-policy linter | Phase A nvidia-like 不用 logo/图片资产 | Phase B AC-B6 |
| deliveryMode 切换 | Phase A 只做 presenter mode | meta 字段预留 |
| Narrative 编辑部（retriever/critic/pruner） | Phase A 用猫做 Narrative Gate | Phase C |

### 竞品定位

GPT Pro 的竞品分析最有价值的一句话：

> "你们要和 Plus AI 拉开身位，最有希望的地方不是再多几个花式 prompt，
> 而是 **research provenance、contract-chain、brand compliance 和审计可解释性**。"

这恰好是我们五份中间产物 + evidence tracing 的核心差异化。方向完全对齐。

| 竞品 | 他们的优势 | 我们的优势 |
|------|-----------|-----------|
| **Plus AI** | 直接在 PPT/Google Slides 里工作，hundreds of layouts | Research provenance + contract chain + 可审计 |
| **Beautiful.ai** | Smart Slides 自动对齐，layout engine 深 | 原生 OOXML fidelity（他们也承认导出有 differences） |
| **NotebookLM** | Grounding 优先，PresentBench 领先 | 我们的 evidence 绑定更精细 + patch-based 修订（Phase B） |
| **Gamma** | 速度快，分享体验好 | "导出后仍然是 PPT，而不是 PPT 形状的纪念品" |

### 下一步

1. **更新 blueprint-schema.md**：吸纳 slideId、sections[]、renderBudget、transition 结构化、ChartData union
2. **更新 theme-token-spec.md**：Layer 3 改名 Render Recipes
3. **更新 F144-ppt-forge.md**：支持矩阵冻结、Phase B OQ/AC 补充、POC 清单补充
4. **@ 砚砚 review**：让他过一遍吸纳决策是否合理

> [宪宪/Opus-46🐾] 综合于 2026-03-27
