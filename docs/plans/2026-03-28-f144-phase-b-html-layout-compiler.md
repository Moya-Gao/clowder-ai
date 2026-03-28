---
feature_ids: [F144]
related_features: [F138]
topics: [ppt-forge, html-layout-compiler, playwright, dom-semantic-compiler, phase-b]
doc_kind: plan
created: 2026-03-28
decision_ref: ADR-024
---

# F144 PPT Forge Phase B: HTML Layout Compiler — 终态渲染引擎

**Feature:** F144 — `docs/features/F144-ppt-forge.md`
**Goal:** 用 HTML+CSS 做布局真相源 → DOM 语义编译 → pptxgenjs 原生对象输出，取代 Phase A 的手算坐标渲染
**Acceptance Criteria:**
- AC-B1: `html-layout-compiler` 子模块可用 — Blueprint → HTML+Tailwind → Playwright 布局求值 → DOM 坐标提取
- AC-B2: DOM Semantic Compiler — `data-ppt-role` 标注 → pptxgenjs 原生对象（text/table/chart/shape/group），零截图
- AC-B3: 5 个 renderer 全部迁移为吃 compiler output，手算坐标代码清零
- AC-B4: 字体嵌入 — opentype.js 解析 + fonteditor-core 子集化，嵌入 .pptx 的 `ppt/fonts/`
- AC-B5: 华为级复杂布局视觉验收 — Phase B 视觉品质 ≥ 对手 pptx-craft
- AC-B6: Skill 化 — 一句话触发全流程
- AC-B7: ≥3 种企业风格 HTML+Tailwind 模板可用
**Architecture:** Blueprint → HTML Template Engine → Playwright headless (1280×720) → DOM Semantic Compiler (data-ppt-role) → pptxgenjs native objects → .pptx
**Tech Stack:** TypeScript, Playwright, Tailwind CSS (CDN), pptxgenjs, opentype.js, fonteditor-core
**前端验证:** No — 纯后端管线 + .pptx 产物

---

## Straight-Line Check

**Finish line (B):** 同一 Blueprint JSON，Phase B 管线输出的 .pptx 在复杂嵌套布局上视觉品质达到华为参考图水平，所有文字可编辑、图表原生可编辑，字体嵌入后跨平台保真。

**NOT building:**
- 前端预览 UI（Phase C 可选）
- Narrative 编辑部（reference-retriever / deck-critic — Phase C）
- Combo chart 双轴（Phase C，pptxgenjs combo API 稳定后再做）
- 动画/转场效果
- 图片/SVG 资产嵌入（Phase A 已 defer，继续 defer）

**Terminal Schema（Phase B 新增）:**

```typescript
// ── DOM Semantic Compiler 输出 ──

/** Compiler 从 DOM 提取的一个 PPTX 元素 */
interface CompiledElement {
  role: PptRole;
  rect: { x: number; y: number; w: number; h: number }; // inches
  content: CompiledContent;
  children?: CompiledElement[];
  style: CompiledStyle;
}

type PptRole = 'text' | 'shape' | 'group' | 'table' | 'chart' | 'image';

type CompiledContent =
  | { type: 'text'; runs: TextRun[] }
  | { type: 'table'; headers: string[]; rows: CompiledTableRow[] }
  | { type: 'chart'; chartType: string; data: unknown }
  | { type: 'shape'; shapeType: string; fill: string; line?: { color: string; width: number } }
  | { type: 'group' };

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize: number;     // pt
  fontFamily: string;
  color: string;        // 6-char hex, no #
}

interface CompiledTableRow {
  cells: { text: string; bgColor?: string; fontColor?: string; bold?: boolean }[];
}

interface CompiledStyle {
  fill?: string;        // 6-char hex
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
}

/** 一张 slide 的完整编译结果 */
interface CompiledSlide {
  slideId: string;
  intent: string;
  masterName: string;
  elements: CompiledElement[];
  speakerNotes?: string;
  fontsUsed: string[];  // 用于字体嵌入
}

/** 整个 deck 的编译结果 */
interface CompiledDeck {
  slides: CompiledSlide[];
  fontsUsed: string[];  // 去重后的全局字体列表
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase A (保留)                                                  │
│  Blueprint JSON + ThemeTokens + layouts.ts                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  NEW: HTML Template Engine                                       │
│  html-template.ts                                                │
│  Blueprint → HTML string (per slide)                             │
│  • Theme tokens → CSS custom properties                          │
│  • Layout slots → positioned divs with data-ppt-role             │
│  • Elements → semantic HTML (table/ul/h1/div.chart-placeholder)  │
│  • Tailwind CDN for utility classes                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  NEW: Playwright Layout Evaluator                                │
│  layout-evaluator.ts                                             │
│  HTML → getBoundingClientRect() for each data-ppt-role node      │
│  • Fixed viewport: 1280×720 px (maps to 10" × 5.625")           │
│  • Font loading: local fonts or CDN web fonts                    │
│  • Returns: DOM tree with computed rects + computed styles        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  NEW: DOM Semantic Compiler                                      │
│  dom-compiler.ts                                                 │
│  Evaluated DOM → CompiledDeck                                    │
│  • data-ppt-role="text" → CompiledElement { role: 'text' }       │
│  • data-ppt-role="table" → parse <table> → CompiledTableRow[]    │
│  • data-ppt-role="chart" → pass-through chart data (native)      │
│  • data-ppt-role="shape" → extract fill/border/radius            │
│  • data-ppt-role="group" → recurse children                      │
│  • px → inches conversion (128 px/inch)                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  MODIFIED: pptxgenjs Output Layer                                │
│  compiled-builder.ts (replaces slide-builder.ts for Phase B)     │
│  CompiledDeck → pptxgenjs Presentation                           │
│  • No layout calculation — rects come from CompiledElement       │
│  • chart elements still use pptxgenjs native chart API           │
│  • All pptxgenjs 铁律守护 preserved                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                  deck.pptx
```

**px → inch 映射**：viewport 1280×720 px = slide 10" × 5.625" → **128 px = 1 inch**。

---

## Task Breakdown

### Task 1: Scaffold `html-layout-compiler` sub-module + CompiledElement types

**Files:**
- Create: `packages/ppt-forge/src/compiler/types.ts`
- Create: `packages/ppt-forge/src/compiler/index.ts`
- Modify: `packages/ppt-forge/src/index.ts` (re-export)

**Step 1: Write CompiledElement types**

```typescript
// packages/ppt-forge/src/compiler/types.ts
// Terminal schema as defined above — CompiledElement, CompiledSlide, CompiledDeck
```

**Step 2: Write barrel index**

```typescript
// packages/ppt-forge/src/compiler/index.ts
export * from './types.js';
```

**Step 3: Re-export from package index**

Add `export * from './compiler/index.js'` to `src/index.ts`.

**Step 4: Build passes**

Run: `cd packages/ppt-forge && pnpm build`
Expected: Clean build, no errors.

**Step 5: Commit**

```
feat(F144): scaffold compiler/ sub-module with CompiledElement terminal types
```

---

### Task 2: HTML Template Engine — Blueprint → HTML string

**Files:**
- Create: `packages/ppt-forge/src/compiler/html-template.ts`
- Create: `packages/ppt-forge/test/compiler/html-template.test.ts`

**Step 1: Write failing test**

```typescript
// Test: given a simple Blueprint with 1 cover slide + 1 content slide,
// renderSlidesToHtml() returns an HTML string containing:
// - <div class="ppt-slide" data-slide-id="...">
// - data-ppt-role attributes on elements
// - CSS custom properties from theme tokens
// - Tailwind classes for layout
```

**Step 2: Run test to verify it fails**

Run: `cd packages/ppt-forge && pnpm test -- test/compiler/html-template.test.ts`
Expected: FAIL

**Step 3: Implement `renderSlidesToHtml()`**

Key decisions:
- **One HTML document per slide** (not one big page) — simpler Playwright evaluation
- Theme tokens → CSS custom properties (`--brand-primary: CF0A2C`)
- Layout slots from `layouts.ts` → positioned divs with `data-ppt-role` + `data-slot-name`
- Text elements → `<div data-ppt-role="text">` with actual text content
- Table elements → `<table data-ppt-role="table">` with real `<tr>/<td>`
- Chart elements → `<div data-ppt-role="chart" data-chart-type="bar" data-chart-json='...'>` (placeholder — chart stays native pptxgenjs)
- KPI elements → `<div data-ppt-role="group" class="kpi-card">` with number + label
- Diagram elements → nested `<div data-ppt-role="shape">` + `<div data-ppt-role="group">` using CSS flexbox for layout (the whole point!)
- Tailwind CDN via `<script src="https://cdn.tailwindcss.com">` (or inline subset for offline)

```typescript
export function renderSlideToHtml(
  slide: SlideSpec,
  theme: ThemeTokens,
  layoutCatalog: Record<string, LayoutCatalogEntry>,
): string
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```
feat(F144): HTML template engine — Blueprint → slide HTML with data-ppt-role
```

---

### Task 3: Diagram HTML template — CSS flexbox nested boxes

**Files:**
- Modify: `packages/ppt-forge/src/compiler/html-template.ts` (add diagram rendering)
- Create: `packages/ppt-forge/test/compiler/html-template-diagram.test.ts`

**Step 1: Write failing test**

```typescript
// Test: given a DiagramElement with 3-level nesting (50+ boxes),
// the HTML output contains:
// - Nested <div data-ppt-role="group"> for parent boxes
// - <div data-ppt-role="shape"> for leaf boxes
// - CSS flex-wrap for automatic row/column distribution
// - Colored header bars via CSS (border-top or ::before)
// - depth-based background colors from nestedBg
```

**Step 2: Implement diagram → HTML**

This is where we win vs Phase A. CSS flexbox handles:
- Automatic child distribution (no leafWeight calculation)
- Wrapping when too many siblings (no adaptiveGap hacks)
- Proportional sizing via `flex-grow`
- Nested margin/padding that just works

```html
<!-- Parent box with header bar -->
<div data-ppt-role="group" data-box-id="backend"
     class="flex flex-col rounded border"
     style="background: #FAFAFA; border-color: #CF0A2C; flex: 3">
  <div class="px-2 py-1 text-white text-xs font-bold"
       style="background: #CF0A2C">Backend</div>
  <div class="flex flex-wrap gap-1 p-1 flex-1">
    <!-- Children -->
    <div data-ppt-role="shape" data-box-id="fastify"
         class="flex items-center justify-center rounded border text-xs"
         style="background: #F5F5F5; flex: 1; min-width: 60px">
      Fastify
    </div>
  </div>
</div>
```

**Step 3: Run tests**

**Step 4: Commit**

```
feat(F144): diagram HTML template with CSS flexbox nested layout
```

---

### Task 4: Playwright Layout Evaluator — HTML → computed rects

**Files:**
- Create: `packages/ppt-forge/src/compiler/layout-evaluator.ts`
- Create: `packages/ppt-forge/test/compiler/layout-evaluator.test.ts`
- Modify: `packages/ppt-forge/package.json` (add playwright dependency)

**Step 1: Add playwright dependency**

```bash
cd packages/ppt-forge && pnpm add playwright
```

**Step 2: Write failing test**

```typescript
// Test: given a simple HTML string with two data-ppt-role="text" divs,
// evaluateLayout() returns an array of EvaluatedNode with:
// - rect.x, rect.y, rect.w, rect.h (in px)
// - computed font size, font family, color
// - children (recursive)
// Verify: rects are non-zero and within viewport bounds (1280×720)
```

**Step 3: Implement `evaluateLayout()`**

```typescript
export interface EvaluatedNode {
  role: string;
  slotName?: string;
  boxId?: string;
  rect: { x: number; y: number; w: number; h: number }; // px
  computedStyle: {
    fontSize: number;       // px
    fontFamily: string;
    color: string;          // rgb(...)
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
  };
  textContent?: string;
  children: EvaluatedNode[];
  // For tables: parsed rows
  tableData?: { headers: string[]; rows: { cells: string[] }[] };
  // For charts: pass-through
  chartData?: unknown;
}

export async function evaluateLayout(html: string): Promise<EvaluatedNode[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(html, { waitUntil: 'networkidle' });

  const nodes = await page.evaluate(() => {
    function extract(el: Element): EvaluatedNode { /* recursive */ }
    return Array.from(document.querySelectorAll('[data-ppt-role]'))
      .filter(el => !el.closest('[data-ppt-role]')) // top-level only
      .map(extract);
  });

  await browser.close();
  return nodes;
}
```

Key: **browser instance reuse** — for multi-slide decks, keep browser open, create new page per slide.

```typescript
export async function evaluateDeck(slideHtmls: string[]): Promise<EvaluatedNode[][]> {
  const browser = await chromium.launch({ headless: true });
  const results: EvaluatedNode[][] = [];
  for (const html of slideHtmls) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const nodes = await page.evaluate(/* ... */);
    results.push(nodes);
    await page.close();
  }
  await browser.close();
  return results;
}
```

**Step 4: Run test (needs Playwright browsers installed)**

Run: `cd packages/ppt-forge && npx playwright install chromium && pnpm test -- test/compiler/layout-evaluator.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(F144): Playwright layout evaluator — HTML → computed rects
```

---

### Task 5: DOM Semantic Compiler — EvaluatedNode → CompiledElement

**Files:**
- Create: `packages/ppt-forge/src/compiler/dom-compiler.ts`
- Create: `packages/ppt-forge/test/compiler/dom-compiler.test.ts`

**Step 1: Write failing test**

```typescript
// Test: given EvaluatedNode[] from a slide with text + table + shape,
// compileDom() returns CompiledElement[] with:
// - px → inches conversion (÷128)
// - text runs extracted from textContent + computedStyle
// - table rows extracted from tableData
// - hex colors normalized (no #, 6 chars)
// - chart elements passed through (no DOM extraction)
```

**Step 2: Implement `compileDom()`**

```typescript
const PX_PER_INCH = 128; // 1280px / 10"

export function compileDom(nodes: EvaluatedNode[], slideSpec: SlideSpec): CompiledSlide {
  const elements = nodes.map(n => compileNode(n));
  const fontsUsed = collectFonts(elements);
  return {
    slideId: slideSpec.slideId,
    intent: slideSpec.intent,
    masterName: intentToMaster(slideSpec.intent),
    elements,
    speakerNotes: slideSpec.speakerNotes,
    fontsUsed,
  };
}

function compileNode(node: EvaluatedNode): CompiledElement {
  const rect = {
    x: node.rect.x / PX_PER_INCH,
    y: node.rect.y / PX_PER_INCH,
    w: node.rect.w / PX_PER_INCH,
    h: node.rect.h / PX_PER_INCH,
  };
  // dispatch by node.role → build CompiledContent
}
```

**Step 3: Run test**

**Step 4: Commit**

```
feat(F144): DOM semantic compiler — EvaluatedNode → CompiledElement (px→inches)
```

---

### Task 6: Compiled Builder — CompiledDeck → pptxgenjs Presentation

**Files:**
- Create: `packages/ppt-forge/src/compiler/compiled-builder.ts`
- Create: `packages/ppt-forge/test/compiler/compiled-builder.test.ts`

**Step 1: Write failing test**

```typescript
// Test: given a CompiledDeck with 2 slides (1 cover + 1 content with text + shape),
// buildCompiledDeck() returns a pptxgenjs Presentation with:
// - 2 slides
// - correct master assignments
// - text elements at compiled rects (no re-calculation)
// - shape elements with compiled fill/border
// - all pptxgenjs 铁律: no # in hex, no 8-char hex, no negative shadow offset
```

**Step 2: Implement `buildCompiledDeck()`**

This is structurally similar to current `buildDeck()` but much simpler — no layout lookup, no slot calculation. Just iterate CompiledElements and call pptxgenjs API with the pre-computed rects.

```typescript
export function buildCompiledDeck(compiled: CompiledDeck, theme: ThemeTokens): PptxPresentation {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  buildSlideMasters(pres, theme);

  for (const cSlide of compiled.slides) {
    const slide = pres.addSlide({ masterName: cSlide.masterName });
    for (const el of cSlide.elements) {
      renderCompiledElement(slide, pres, el, theme);
    }
    if (cSlide.speakerNotes) slide.addNotes(cSlide.speakerNotes);
  }
  return pres;
}

function renderCompiledElement(slide, pres, el: CompiledElement, theme: ThemeTokens): void {
  switch (el.role) {
    case 'text':    renderCompiledText(slide, el); break;
    case 'shape':   renderCompiledShape(slide, el); break;
    case 'group':   el.children?.forEach(c => renderCompiledElement(slide, pres, c, theme)); break;
    case 'table':   renderCompiledTable(slide, el); break;
    case 'chart':   renderCompiledChart(slide, pres, el, theme); break;
  }
}
```

**Step 3: Run test**

**Step 4: Commit**

```
feat(F144): compiled builder — CompiledDeck → pptxgenjs (pre-computed rects)
```

---

### Task 7: End-to-end pipeline integration — `buildDeckV2()`

**Files:**
- Create: `packages/ppt-forge/src/compiler/pipeline.ts`
- Create: `packages/ppt-forge/test/compiler/pipeline.test.ts`
- Modify: `packages/ppt-forge/src/pipeline.ts` (add V2 path)
- Modify: `packages/ppt-forge/src/cli.ts` (add `--engine v2` flag)

**Step 1: Write failing test**

```typescript
// Test: given a Blueprint + Theme,
// compileAndBuild() orchestrates: HTML template → Playwright eval → DOM compile → pptxgenjs build
// Returns a PptxPresentation with slides matching the Blueprint
```

**Step 2: Implement `compileAndBuild()`**

```typescript
export async function compileAndBuild(
  blueprint: DeckBlueprint,
  theme: ThemeTokens,
): Promise<PptxPresentation> {
  // 1. Render each slide to HTML
  const slideHtmls = blueprint.slides.map(s =>
    renderSlideToHtml(s, theme, LAYOUT_CATALOG)
  );

  // 2. Evaluate layouts via Playwright (batched, single browser)
  const evaluatedSlides = await evaluateDeck(slideHtmls);

  // 3. Compile DOM → CompiledDeck
  const compiledSlides = evaluatedSlides.map((nodes, i) =>
    compileDom(nodes, blueprint.slides[i])
  );
  const allFonts = [...new Set(compiledSlides.flatMap(s => s.fontsUsed))];
  const compiledDeck: CompiledDeck = { slides: compiledSlides, fontsUsed: allFonts };

  // 4. Build pptxgenjs presentation
  return buildCompiledDeck(compiledDeck, theme);
}
```

**Step 3: Run test with real Playwright**

Run: `cd packages/ppt-forge && pnpm test -- test/compiler/pipeline.test.ts`

**Step 4: Visual comparison — generate same Blueprint with V1 and V2**

```bash
# V1 (Phase A)
ppt-forge build --input examples/ch3-storyline.json --theme huawei-like -o /tmp/v1.pptx

# V2 (Phase B)
ppt-forge build --input examples/ch3-storyline.json --theme huawei-like --engine v2 -o /tmp/v2.pptx
```

**Step 5: Commit**

```
feat(F144): end-to-end V2 pipeline — HTML template → Playwright → compiler → pptxgenjs
```

---

### Task 8: Huawei-like HTML+Tailwind template

**Files:**
- Create: `packages/ppt-forge/src/compiler/templates/huawei-like.ts`
- Create: `packages/ppt-forge/test/compiler/templates/huawei-like.test.ts`

**Step 1: Write failing test**

```typescript
// Test: given the huawei-like theme + a content slide with diagram element,
// the HTML template produces:
// - Red (#CF0A2C) header bars on parent boxes
// - White text on header bars
// - Depth-based gray backgrounds
// - 12-column grid layout
// - PingFang SC / Noto Sans SC font stacks
```

**Step 2: Implement华为-specific Tailwind template**

This template defines the slide's HTML structure with华为-specific visual patterns:
- Red accent header bars
- High information density (tight padding, small fonts)
- Strict alignment grid
- Data-heavy table styling

**Step 3: Run test + visual verification**

Generate a 50+ box diagram slide, open in PowerPoint, compare to华为参考图.

**Step 4: Commit**

```
feat(F144): huawei-like HTML+Tailwind template — red header bars, dense layout
```

---

### Task 9: Font embedding (Spike → Implementation)

**Files:**
- Create: `packages/ppt-forge/src/compiler/font-embed.ts`
- Create: `packages/ppt-forge/test/compiler/font-embed.test.ts`
- Modify: `packages/ppt-forge/package.json` (add opentype.js, fonteditor-core)

**Step 1: Spike — verify opentype.js + fonteditor-core can subset and embed**

Time-boxed: 30 minutes. Output: decision on whether to use the competitor's approach (inject into OOXML zip) or a simpler font-reference approach.

**Step 2: Add dependencies**

```bash
cd packages/ppt-forge && pnpm add opentype.js fonteditor-core
```

**Step 3: Write failing test**

```typescript
// Test: given a CompiledDeck with fontsUsed: ['PingFang SC'],
// embedFonts() modifies the .pptx buffer to include:
// - ppt/fonts/font1.fntdata (subset of PingFang SC)
// - [Content_Types].xml updated with font part
// - ppt/presentation.xml references the embedded font
```

**Step 4: Implement `embedFonts()`**

```typescript
export async function embedFonts(
  pptxBuffer: Buffer,
  fontsUsed: string[],
  fontPaths: Record<string, string>, // fontFamily → .ttf/.otf path
): Promise<Buffer> {
  // 1. Parse .pptx zip with JSZip
  // 2. For each font:
  //    a. Parse with opentype.js
  //    b. Subset with fonteditor-core (only glyphs used in deck)
  //    c. Write to ppt/fonts/fontN.fntdata
  //    d. Update [Content_Types].xml
  //    e. Update ppt/presentation.xml embeddedFont references
  // 3. Return modified buffer
}
```

**Step 5: Run test**

**Step 6: Commit**

```
feat(F144): font embedding — opentype.js subset + OOXML embed
```

---

### Task 10: Migrate existing renderers + deprecate Phase A path

**Files:**
- Modify: `packages/ppt-forge/src/slide-builder.ts` (add deprecation notice + V2 check)
- Modify: `packages/ppt-forge/src/pipeline.ts` (default to V2 engine)
- Modify: `packages/ppt-forge/src/cli.ts` (default `--engine v2`)

**Step 1: Make V2 the default engine**

Phase A `buildDeck()` remains as `--engine v1` fallback. V2 `compileAndBuild()` becomes default.

**Step 2: Run full test suite**

Run: `cd packages/ppt-forge && pnpm test`
Expected: All tests pass (V1 tests still pass, V2 tests pass).

**Step 3: Generate benchmark comparison**

Generate the Ch3 architecture PPT with both engines. Document visual comparison.

**Step 4: Commit**

```
feat(F144): default to V2 engine, deprecate V1 hand-calculated renderers
```

---

### Task 11: Visual acceptance — 华为级复杂布局验收

**Files:**
- None (verification task)

**Step 1: Generate 50+ box diagram with V2 engine**

Use the existing `examples/generate-cat-cafe-ppt.ts` blueprint with `--engine v2`.

**Step 2: Open in PowerPoint, verify:**
- [ ] All text editable (double-click → cursor)
- [ ] Diagram boxes properly nested (flexbox → accurate rects)
- [ ] Header bars visible on parent boxes
- [ ] Depth-based background colors correct
- [ ] No overlap, no overflow, no tiny-strip boxes
- [ ] Font rendering correct (PingFang SC or fallback)

**Step 3: Compare to competitor pptx-craft output**

Phase B visual quality ≥ pptx-craft for equivalent content.

**Step 4: Update AC-B5 in feat doc**

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Playwright viewport → PPT inch mapping drift | Fixed viewport 1280×720 = 10"×5.625". Unit test: known div at (128, 128, 256, 256) → (1", 1", 2", 2") |
| Tailwind CDN not available offline | Bundle a minimal Tailwind subset inline; or use `@tailwind/standalone` |
| Font embedding breaks OOXML validation | POC first (Task 9 spike). Fallback: font reference without embed (Phase A behavior) |
| Chart elements can't be extracted from DOM | Charts bypass HTML entirely — pass through as native pptxgenjs chart data |
| Playwright adds ~200MB to install | Document as optional peer dependency; CI caches browser binaries |

## Dependency Graph

```
Task 1 (types) ──┬──→ Task 2 (html-template) ──→ Task 3 (diagram template)
                  │                                      │
                  │                                      ▼
                  ├──→ Task 4 (layout-evaluator) ────────┤
                  │                                      │
                  │                                      ▼
                  ├──→ Task 5 (dom-compiler) ────────────┤
                  │                                      │
                  │                                      ▼
                  └──→ Task 6 (compiled-builder) ───→ Task 7 (pipeline) ──→ Task 8 (template)
                                                                                    │
                                                         Task 9 (fonts) ◄───────────┘
                                                              │
                                                              ▼
                                                         Task 10 (migrate) ──→ Task 11 (验收)
```

Tasks 2, 4, 5, 6 can be developed in parallel after Task 1 (types). Task 7 integrates them. Tasks 8-9 are independent features on top. Task 10-11 are final integration + verification.
