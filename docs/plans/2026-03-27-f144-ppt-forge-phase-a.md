---
feature_ids: [F144]
topics: [ppt-forge, implementation-plan, phase-a]
doc_kind: plan
created: 2026-03-27
---

# F144 PPT Forge — Phase A Implementation Plan

**Feature:** F144 — `docs/features/F144-ppt-forge.md`
**Goal:** 给定主题+风格，端到端生成可编辑华为风格高密 .pptx（Level 1 vertical slice）
**Acceptance Criteria:**
- AC-A1: 端到端生成 ≥10 页 .pptx
- AC-A4: Blueprint 层产出 deck.blueprint.json
- AC-A5: Style 层产出 theme.tokens.json
- AC-A6: 原生 .pptx，文字可编辑、可搜索、布局无溢出
- AC-A7: huawei-like 风格模板可用
- AC-A9: 密排状态矩阵表格，单元格颜色编码
- AC-A11: CJK 图表字体 POC
- AC-A12: PPT 365 打开无 repair 弹窗
**Architecture:** 新建 `packages/ppt-forge` 独立包。SlideBuilder 读 blueprint JSON + theme JSON → 调用 pptxgenjs API → 输出 .pptx。每种元素有独立 renderer。CLI 入口供猫直接调用。
**Tech Stack:** pptxgenjs, TypeScript, Node.js test runner
**前端验证:** No（纯后端包，验证靠 PowerPoint 打开 .pptx）

---

## Straight-Line Check

**Finish line (B):** `node packages/ppt-forge/dist/cli.js blueprint.json theme.json output.pptx` 产出可编辑华为风格 PPT。
**NOT building:** Research/Narrative/Blueprint AI 生成层（那些是猫的 AI 工作），DiagramElement（Level 2 stretch），Connector，combo chart，speaker notes auto-gen，多 theme。
**Terminal schema:** 见 Task 1 types.ts — 这就是 Blueprint V2 的最终接口。

---

## Task 0: Package Scaffold

**Files:**
- Create: `packages/ppt-forge/package.json`
- Create: `packages/ppt-forge/tsconfig.json`

**Step 0.1:** Create package.json with pptxgenjs dependency

```json
{
  "name": "@cat-cafe/ppt-forge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": { "ppt-forge": "./dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "test": "node --test --experimental-strip-types 'test/**/*.test.ts'",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "pptxgenjs": "^4.0.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.0.0"
  }
}
```

**Step 0.2:** Create tsconfig.json

**Step 0.3:** `pnpm install` from root

**Step 0.4:** Commit scaffold

---

## Task 1: Blueprint Types (Terminal Schema)

**Files:**
- Create: `packages/ppt-forge/src/types.ts`

Defines the V2 contract (absorbing GPT Pro + 砚砚 review):

```typescript
// Core interfaces — this IS the terminal schema
export interface DeckBlueprint { version: '1.0'; meta: DeckMeta; sections: SectionSpec[]; slides: SlideSpec[]; assets: AssetRef[]; }
export interface DeckMeta { title: string; subtitle?: string; author: string; createdAt: string; researchRef: string; storylineRef: string; themeRef: string; framework: NarrativeFramework; targetAudience: AudienceType; }
export type NarrativeFramework = 'pyramid' | 'scq' | 'problem-solution';
export type AudienceType = 'corporate-executive' | 'technical-deep-dive' | 'keynote-public' | 'internal-team';
export interface SectionSpec { sectionId: string; title: string; slideIds: string[]; }
export interface SlideSpec { slideId: string; sectionId?: string; intent: SlideIntent; purpose: string; layoutId: string; elements: SlideElement[]; speakerNotes?: string; evidenceRefs?: EvidenceRef[]; transition?: { type: TransitionType; fromSlideId?: string; }; renderBudget: RenderBudget; }
export type SlideIntent = 'cover' | 'agenda' | 'section-break' | 'key-statement' | 'content' | 'data-insight' | 'comparison' | 'timeline' | 'evidence' | 'summary' | 'closing' | 'appendix';
export type TransitionType = 'supports' | 'contrasts' | 'zooms-in' | 'answers' | 'summarizes';
export interface RenderBudget { maxWords: number; minFontPt: number; overflowPolicy: 'split-slide' | 'shrink' | 'truncate'; }

// Elements
export type SlideElement = TextElement | ChartElement | ImageElement | TableElement | KPIElement;
export interface TextElement { type: 'text'; slotName: string; content: string; fontSize?: number; fontWeight?: 'regular' | 'bold'; align?: 'left' | 'center' | 'right'; }
export interface ChartElement { type: 'chart'; slotName: string; chartType: ChartType; data: ChartData; hints?: Record<string, unknown>; }
export type ChartType = 'area' | 'bar' | 'bar3d' | 'doughnut' | 'line' | 'pie' | 'radar' | 'scatter';
export type ChartData = CategoricalChartData | XYChartData | BubbleChartData;
export interface CategoricalChartData { chartProfile: 'categorical'; categories: string[]; series: { name: string; values: (number | null)[] }[]; }
export interface XYChartData { chartProfile: 'xy'; series: { name: string; points: { x: number; y: number; label?: string }[] }[]; }
export interface BubbleChartData { chartProfile: 'bubble'; series: { name: string; points: { x: number; y: number; size: number; label?: string }[] }[]; }
export interface ImageElement { type: 'image'; slotName: string; assetId: string; alt: string; sizing?: { type: 'contain' | 'cover' | 'crop'; w: number; h: number }; }
export interface TableElement { type: 'table'; slotName: string; headers: string[]; rows: TableRow[]; }
export interface TableRow { cells: TableCell[]; }
export interface TableCell { text: string; bgColor?: string; fontColor?: string; fontBold?: boolean; }
export interface KPIElement { type: 'kpi'; slotName: string; number: string; label: string; trend?: 'up' | 'down' | 'flat'; trendColor?: string; }
export interface EvidenceRef { conclusionId: string; source: string; type: 'fact' | 'inference' | 'recommendation'; summary: string; }
export interface AssetRef { assetId: string; type: 'image' | 'icon' | 'logo' | 'svg'; path: string; base64?: string; license?: string; }

// Theme
export interface ThemeTokens { version: '1.0'; name: string; description: string; brand: BrandTokens; slide: SlideSemanticTokens; slideNumber: { color: string; fontSize: number; position: { x: string; y: string } }; }
export interface BrandTokens { colors: { primary: string; secondary: string; accent: string; background: string; surface: string; surfaceAlt: string; white: string; text: { primary: string; secondary: string; muted: string; onPrimary: string } }; typography: { headingFont: string; bodyFont: string; monoFont: string; cjkFont: string; headingWeight: string; bodyWeight: string; fallback: { headingFont: string; bodyFont: string; monoFont: string; cjkFont: string } }; spacing: { unit: number; xs: number; sm: number; md: number; lg: number; xl: number }; }
// SlideSemanticTokens, LayoutSlot, LayoutCatalogEntry — same structure as research docs

// Layout
export interface LayoutCatalogEntry { layoutId: string; description: string; slots: LayoutSlot[]; }
export interface LayoutSlot { name: string; type: 'title' | 'subtitle' | 'body' | 'chart' | 'image' | 'table' | 'icon' | 'kpi-number' | 'kpi-label' | 'caption'; position: { x: number; y: number; w: number; h: number }; }
```

**Step 1.1:** Write types.ts (full interfaces above)
**Step 1.2:** `pnpm --filter @cat-cafe/ppt-forge lint` — confirm compiles
**Step 1.3:** Commit

---

## Task 2: Huawei-like Theme Tokens

**Files:**
- Create: `packages/ppt-forge/src/themes/huawei-like.json`

```json
{
  "version": "1.0",
  "name": "huawei-like",
  "description": "华为风格：红+白+灰，高信息密度，Noto Sans SC 统一 CJK",
  "brand": {
    "colors": {
      "primary": "CF0A2C",
      "secondary": "333333",
      "accent": "E60012",
      "background": "FFFFFF",
      "surface": "F5F5F5",
      "surfaceAlt": "EEEEEE",
      "white": "FFFFFF",
      "text": { "primary": "333333", "secondary": "666666", "muted": "999999", "onPrimary": "FFFFFF" }
    },
    "typography": {
      "headingFont": "Noto Sans SC",
      "bodyFont": "Noto Sans SC",
      "monoFont": "IBM Plex Mono",
      "cjkFont": "Noto Sans SC",
      "headingWeight": "700",
      "bodyWeight": "400",
      "fallback": { "headingFont": "Microsoft YaHei", "bodyFont": "Microsoft YaHei", "monoFont": "Consolas", "cjkFont": "PingFang SC" }
    },
    "spacing": { "unit": 0.15, "xs": 0.08, "sm": 0.15, "md": 0.3, "lg": 0.5, "xl": 0.8 }
  },
  "slide": { ... }
}
```

华为特色：间距更紧（unit=0.15 vs nvidia 的 0.2），字号偏小（body 12pt），红色 header bars。

**Step 2.1:** Write complete huawei-like.json (含 slide semantic tokens for cover/section/content/kpi/chart/table/closing)
**Step 2.2:** Commit

---

## Task 3: Layout Catalog

**Files:**
- Create: `packages/ppt-forge/src/layouts.ts`

8 基础 layout + 2 个华为 dense variant：

| layoutId | 用途 | 华为场景 |
|----------|------|---------|
| layout-cover | 封面 | 红色顶栏 + 大标题 |
| layout-section | 章节分隔 | 红底白字 |
| layout-title-body | 标题+正文 | 标准内容 |
| layout-two-col | 双栏 | 左右对比 |
| layout-chart-insight | 图表+洞察 | 数据分析 |
| layout-full-chart | 全幅图表 | 大图表 |
| layout-kpi | KPI 仪表板 | 3 KPI |
| layout-closing | 结尾 | CTA |
| **layout-kpi-4col** | **4列 KPI** | **华为高密 KPI** |
| **layout-dense-table** | **密排表格** | **华为状态矩阵** |

**Step 3.1:** Write layouts.ts — export `LAYOUT_CATALOG: Record<string, LayoutCatalogEntry>`
**Step 3.2:** `pnpm --filter @cat-cafe/ppt-forge lint`
**Step 3.3:** Commit

---

## Task 4: Export Gate Validators

**Files:**
- Create: `packages/ppt-forge/src/validators.ts`
- Create: `packages/ppt-forge/test/validators.test.ts`

验证规则（pptxgenjs 铁律）：
- hex 无 `#` 前缀
- hex 不是 8 字符
- shadow offset 非负
- renderBudget 未溢出（word count）
- layoutId 在 catalog 中存在
- element slotName 在 layout 的 slots 中存在

**Step 4.1:** Write failing test — `validateHexColor("FF0000")` passes, `validateHexColor("#FF0000")` throws
**Step 4.2:** Run test → FAIL
**Step 4.3:** Implement validators.ts
**Step 4.4:** Run test → PASS
**Step 4.5:** Commit

---

## Task 5: Text Renderer (TDD)

**Files:**
- Create: `packages/ppt-forge/src/renderers/text.ts`
- Create: `packages/ppt-forge/test/renderers/text.test.ts`

**Step 5.1:** Write failing test — renderText(mockSlide, textElement, slot, theme) 调用了 slide.addText
**Step 5.2:** Run → FAIL
**Step 5.3:** Implement — 解析 **bold** markdown 子集，设置 fontFace/fontSize/color/align
**Step 5.4:** Run → PASS
**Step 5.5:** Commit

---

## Task 6: Table Renderer (TDD) — 华为密排状态矩阵关键

**Files:**
- Create: `packages/ppt-forge/src/renderers/table.ts`
- Create: `packages/ppt-forge/test/renderers/table.test.ts`

这是华为对比的**核心杀招** — 单元格级颜色编码。

**Step 6.1:** Write failing test — renderTable 生成 pptxgenjs table rows with per-cell fill colors
**Step 6.2:** Run → FAIL
**Step 6.3:** Implement — headers + rows, 每个 cell 可独立设 bgColor/fontColor/bold
**Step 6.4:** Run → PASS
**Step 6.5:** 补测试：headerBg 从 theme 读取（华为红色表头）
**Step 6.6:** Commit

---

## Task 7: Chart Renderer (TDD)

**Files:**
- Create: `packages/ppt-forge/src/renderers/chart.ts`
- Create: `packages/ppt-forge/test/renderers/chart.test.ts`

**Step 7.1:** Write failing test — categorical bar chart: renderChart 调用 slide.addChart(pres.charts.BAR, series, options)
**Step 7.2:** Run → FAIL
**Step 7.3:** Implement — 支持 categorical/xy/bubble 三种 chartProfile 分发
**Step 7.4:** Run → PASS
**Step 7.5:** 补 CJK 测试：中文 chart title/legend/category labels 使用 cjkFont
**Step 7.6:** Commit

---

## Task 8: KPI Renderer (TDD)

**Files:**
- Create: `packages/ppt-forge/src/renderers/kpi.ts`
- Create: `packages/ppt-forge/test/renderers/kpi.test.ts`

**Step 8.1:** Write failing test — renderKPI 渲染大数字 + 标签 + trend 箭头颜色
**Step 8.2:** Run → FAIL
**Step 8.3:** Implement — 大号数字（theme.slide.kpi.numberFontSize） + 小标签 + trend 颜色
**Step 8.4:** Run → PASS
**Step 8.5:** Commit

---

## Task 9: Slide Master Builder

**Files:**
- Create: `packages/ppt-forge/src/master-builder.ts`
- Create: `packages/ppt-forge/test/master-builder.test.ts`

从 theme tokens → pptxgenjs `defineSlideMaster()`。

**Step 9.1:** Write failing test — buildSlideMasters(pres, theme) 注册 MASTER_COVER / MASTER_CONTENT / MASTER_SECTION
**Step 9.2:** Run → FAIL
**Step 9.3:** Implement — 从 theme.slide.cover/content/section 读颜色和字号
**Step 9.4:** Run → PASS
**Step 9.5:** Commit

---

## Task 10: SlideBuilder Orchestrator

**Files:**
- Create: `packages/ppt-forge/src/slide-builder.ts`
- Create: `packages/ppt-forge/test/slide-builder.test.ts`

核心编排：blueprint + theme → 遍历 slides → 查 layout → 分发 renderer → 输出 pptx。

**Step 10.1:** Write failing test — build(blueprint, theme) 返回 PptxGenJS instance，slide count = blueprint.slides.length
**Step 10.2:** Run → FAIL
**Step 10.3:** Implement：
1. `new PptxGenJS()` + 设置 16:9
2. `buildSlideMasters(pres, theme)`
3. 遍历 slides：`addSlide({ masterName })` + 遍历 elements → 分发到对应 renderer
4. 每个 element：查 layout catalog → 取 slot position → 调 renderer
**Step 10.4:** Run → PASS
**Step 10.5:** 补测试：renderBudget overflow 检查
**Step 10.6:** Commit

---

## Task 11: CLI Entry Point

**Files:**
- Create: `packages/ppt-forge/src/cli.ts`

```
Usage: ppt-forge <blueprint.json> <theme.json> <output.pptx>
```

**Step 11.1:** Implement CLI — 读 JSON 文件 → 调 build() → pres.writeFile(output)
**Step 11.2:** Build: `pnpm --filter @cat-cafe/ppt-forge build`
**Step 11.3:** Commit

---

## Task 12: Integration Test — Huawei Demo Blueprint

**Files:**
- Create: `packages/ppt-forge/test/fixtures/huawei-demo-blueprint.json`
- Create: `packages/ppt-forge/test/integration.test.ts`

手写一个 10 页华为风格 blueprint：
1. Cover — "华为企业 ICT 解决方案" 红底白字
2. Agenda — 4 项目录
3. Section break — "桌面现状及发展趋势"
4. Key statement — 核心观点（大字）
5. Data insight — bar chart（中文标签）+ 洞察文字
6. Comparison — 双栏对比
7. **Dense table** — 组件×软件×版本×状态颜色矩阵（华为杀招）
8. KPI dashboard — 4 个 KPI 指标
9. Full chart — line chart（趋势图）
10. Closing — CTA

**Step 12.1:** Write fixture blueprint JSON
**Step 12.2:** Write integration test — build + writeFile → 确认文件存在 + 大小 > 10KB
**Step 12.3:** Run → verify .pptx 生成
**Step 12.4:** 手动在 PowerPoint 打开验证（AC-A12 repair dialog 检查）
**Step 12.5:** Commit

---

## Task 13: CJK Chart Font POC (AC-A11 release-gate P1)

**Files:**
- Create: `packages/ppt-forge/test/cjk-chart-poc.test.ts`

**Step 13.1:** 生成含中文 chart title/legend/category 的 .pptx
**Step 13.2:** 在 PowerPoint 中打开验证字体是否正确渲染
**Step 13.3:** 如果不过 → 记录问题 → 收紧支持矩阵（砚砚预案）
**Step 13.4:** Commit POC 结果

---

## 执行节奏

| 任务 | 预估 | 累计 |
|------|------|------|
| Task 0-1: Scaffold + Types | 10 min | 10 min |
| Task 2-3: Theme + Layouts | 10 min | 20 min |
| Task 4: Validators TDD | 10 min | 30 min |
| Task 5-8: 4 个 Renderer TDD | 40 min | 70 min |
| Task 9-10: Master + Orchestrator | 20 min | 90 min |
| Task 11: CLI | 5 min | 95 min |
| Task 12: Integration test | 15 min | 110 min |
| Task 13: CJK POC | 10 min | 120 min |

**Total: ~2 小时。** Level 1 今天交付无压力。

---

> [宪宪/Opus-46🐾] Plan created 2026-03-27
