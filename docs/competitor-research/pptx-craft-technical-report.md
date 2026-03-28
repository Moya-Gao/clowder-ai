---
topics: [competitor, research, pptx]
doc_kind: research
created: 2026-03-27
---

# PPTX-Craft Competitor Analysis Report

## Executive Summary

The competitor team's **pptx-craft** system is a sophisticated **multi-agent PPT generation pipeline** that orchestrates three specialized agents (Research → Planning → Design) to create professional presentations. Their technical approach emphasizes **clear separation of concerns, explicit workflow stages, and rigorous HTML→PPTX conversion**.

---

## 1. PIPELINE ARCHITECTURE: Main → Alice → Bob → Charlie

### 1.1 Three-Agent Orchestration Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN AGENT (pptx-craft)                       │
│  • Request classification & intent validation                    │
│  • Multi-stage workflow orchestration                            │
│  • User interaction & approval gates                             │
│  • SubAgent creation & output validation                         │
└─────────────────────────────────────────────────────────────────┘
  │
  ├─→ [STAGE 1] Need collection + Research judgment
  │
  ├─→ [STAGE 2a] ALICE (Research Agent)
  │    Uses: deepresearch skill
  │    Output: research.md + research_data.json
  │    Prompt style: Simulates user input for seamless execution
  │
  ├─→ [STAGE 2b] BOB (Planning Agent)
  │    Uses: planner skill
  │    Input: research.md (optional), user requirements
  │    Output: ppt_plan.md (with 大纲总览 + 页面详细描述)
  │    Key: Prompt contains COMPLETE info → skill skips asking
  │
  ├─→ [STAGE 3] APPROVAL GATE
  │    User MUST explicitly approve outline before generation
  │    Prevents wasted resources on wrong content
  │
  ├─→ [STAGE 4] CHARLIE (Design Agent)
  │    Uses: pptx designer skill
  │    Input: ppt_plan.md, research.md
  │    Two-phase output:
  │      Phase 4.1: Draft HTML (640×360) - content validation
  │      Phase 4.2: Final HTML (1280×720) - visual polish
  │    Output: page-N.pptx.html files
  │
  └─→ [STAGE 5] HTML→PPTX Conversion
       Auto-convert: page-N.pptx.html → pages.pptx
```

### 1.2 Key Design Principles

**1. Simulated User Input**
- SubAgent prompts are crafted as if a user were requesting the service
- Provides COMPLETE information → skill's existing logic naturally runs
- Avoids special branching or "subagent awareness"
- Example: Bob receives full {topic}, {page_count}, {style_id} → skips asking

**2. Strict Workflow Gates**
- Stage 3 (outline approval) is MANDATORY
- User must explicitly approve before Charlie generates anything
- Prevents cascading failures and resource waste

**3. Path Centralization**
- Main agent manages all output paths via variables
- Timestamp-based directory isolation (YYYYMMDD_HHMMSS_XXX)
- SubAgents output to paths specified in prompts, not defaults

---

## 2. DEPENDENCIES & TECHNICAL STACK

### 2.1 Root Package.json (pptx-craft)

```json
{
  "dependencies": {
    "playwright": "^1.40.0",      // Headless browser for rendering
    "pngjs": "^7.0.0"              // PNG image processing
  },
  "engines": { "node": ">=18.0.0" }
}
```

### 2.2 Designer/HTML-to-PPTX Dependencies

**Core conversion toolkit:**
```json
{
  "dependencies": {
    "pptxgenjs": "^3.12.0",           // ⭐ Primary PPTX generation
    "html2canvas": "^1.4.1",          // HTML→Canvas rendering
    "jszip": "^3.10.1",                // PPTX zip manipulation
    "esbuild": "^0.20.0",              // JS bundling
    
    // Font handling
    "opentype.js": "^1.3.4",           // Font file parsing
    "fonteditor-core": "^2.6.3",       // Font embedding
    "pako": "^2.1.0",                  // Compression (for fonts)
    
    // Icon support
    "@fortawesome/fontawesome-svg-core": "^6.5.0",
    "@fortawesome/free-solid-svg-icons": "^6.5.0",
    "@fortawesome/free-regular-svg-icons": "^6.5.0",
    "@fortawesome/free-brands-svg-icons": "^6.5.0"
  },
  "optionalDependencies": {
    "playwright": "^1.40.0"
  }
}
```

**Key insight:** They use **PptxGenJS** (not python-pptx or similar) for PPTX generation, paired with **html2canvas** for rendering HTML → raster images that embed in slides.

---

## 3. HTML→PPTX CONVERSION PIPELINE

### 3.1 Convert.js Architecture

**File:** `designer/lib/html-to-pptx/node/convert.js` (491 lines)

**Key features:**
1. **Browser-based rendering** via Playwright
2. **Shared browser instance** for efficiency (reuseBrowser: true)
3. **Dual mode operation**: single file OR directory batch
4. **DOM selector extraction**: finds all `.ppt-slide` elements

**Conversion flow:**
```javascript
// 1. Read HTML file
const html = await readFile(htmlPath, 'utf-8');

// 2. Launch/reuse browser
const { browser } = await getBrowser(reuseBrowser);
const page = await browser.newPage();

// 3. Load HTML content
await page.setContent(html, { waitUntil: 'load' });

// 4. Inject dependencies (dom-to-pptx library)
await injectDependencies(page);

// 5. Execute conversion in browser context
const pptxArray = await page.evaluate(async ({ sel, opts }) => {
  const { exportToPptx } = window.domToPptx;
  const elements = Array.from(document.querySelectorAll(sel));
  const blob = await exportToPptx(elements, opts);
  const arrayBuffer = await blob.arrayBuffer();
  return Array.from(new Uint8Array(arrayBuffer));
});

// 6. Save PPTX
await writeFile(outputPath, Buffer.from(pptxArray));
```

### 3.2 Slide Processing (ExportToPptx)

**File:** `src/index.js` (205 lines)

**Key features:**
```javascript
export async function exportToPptx(target, options = {}) {
  // Default enable font embedding
  options = { autoEmbedFonts: true, ...options };
  
  // Enhanced PptxGenJS with font embedding
  const EnhancedPptx = await withPPTXEmbedFonts(PptxConstructor);
  
  // Process each slide
  for (const element of elements) {
    await processSlide(element, prs, options);
  }
  
  // Return PPTX blob
  return prs.writeFile({ fileName: options.fileName });
}
```

**Critical: Font Embedding**
- Auto-detects fonts used in HTML
- Embeds fonts directly in PPTX
- Ensures font fidelity across environments

---

## 4. TWO-PHASE DESIGN GENERATION

### 4.1 Phase 1: Draft HTML (640×360)

**Purpose:** Content validation at low resolution
**Container:**
```html
<div class="ppt-slide" type="content" 
     style="width: 640px; height: 360px; padding: 20px;">
```

**Requirements:**
- ✅ All text real (no placeholders)
- ✅ All ppt_plan.md info points included
- ✅ Proper layout (title, body, conclusion areas)
- ✅ Font sizes: 18-24px (titles), 12-14px (subtitles), 8-10px (body)
- ✅ Full information even without Phase 2

**Output:** `page-N-draft.pptx.html`

### 4.2 Phase 2: Final HTML (1280×720)

**Purpose:** Visual polish based on Draft

**Container:**
```html
<div class="ppt-slide" type="content" 
     style="width: 1280px; height: 720px; padding: 40px;">
```

**Execution approach:**
- Uses independent SubAgent per page
- Reads Draft HTML (do NOT memorize)
- Applies 2× coordinate scaling as baseline
- **Allowed enhancements:**
  - 3-level typography (36-48px, 24-28px, 16-20px)
  - Fine lines (0.5-1px)
  - Decorative elements
  - Enhanced charts/visualizations
  - Content deep-dive (annotations, highlights)

- **Forbidden actions:**
  - Redesign layout
  - Remove modules
  - Reduce information density
  - Create large blank areas

**Output:** `page-N.pptx.html`

---

## 5. STYLE SYSTEM

### 5.1 Styles.json Structure

```json
{
  "styles": [
    {
      "id": "huawei",
      "name": "华为风格",
      "keywords": ["华为", "huawei", "企业汇报", "技术方案"],
      "description": "红色主题、严谨专业、高信息密度"
    }
  ]
}
```

**Design pattern:** Extensible style registry with metadata

### 5.2 Visual Design Specs (From designer/SKILL.md)

**Color system:**
- Primary: `#4A6C8C` (professional blue)
- Accent: `#D4A373` (warm highlight)
- Dark bg: `#1A1D21`
- Light bg: `#F8F7F5`

**Typography:**
- **Western:** Liter, HedvigLettersSans, Oranienbaum, Coda
- **Chinese:** MiSans, Noto Sans SC, 思源宋体, 阿里妈妈系列, 站酷系列

**Combinations:**
- Business: MiSans + Liter
- Premium: 思源宋体 + Oranienbaum
- Tech: 得意黑 + HedvigLettersSans
- Creative: ZCOOL KuaiLe + Coda

### 5.3 Content Density Rules

**Space constraints (成品 HTML):**
- Content pages: < 30% whitespace
- 3-5 core points per slide
- Images + text balance
- 20-30% breathing room

**Layout system:**
- 12-column grid
- Flexbox for responsive allocation
- NO inline styles (Tailwind only)
- Z-index hierarchy: bg(0) → decorative(5) → content(10) → overlay(20) → text(50)

---

## 6. WORKFLOW STAGES & VALIDATION

### 6.1 Complete 6-Stage Pipeline

| Stage | Name | Validation | Success Criteria |
|-------|------|-----------|-----------------|
| 0 | Request Classification | Intent check (PPT vs. other) | Classified correctly |
| 1 | Need Collection | Topic + page count + style | 3 parameters collected |
| 2a | Research (optional) | research.md exists & non-empty | Report generated |
| 2b | Planning | ppt_plan.md contains sections | Outline complete |
| 3 | **Approval Gate** | User explicitly approves | "批准" button selected |
| 4 | Design Generation | page-N.pptx.html files exist | Count = page_count |
| 5 | PPTX Delivery | pages.pptx exists & > 0 bytes | File ready |

### 6.2 Timestamp Directory Management

**Script:** `scripts/generate_timestamp_dir.js`

```javascript
// Format: YYYYMMDD_HHMMSS_XXX
// Example: 20260317_143052_000 (3-digit sequence for same-second collisions)

const timestampPrefix = formatTimestamp(); // YYYYMMDD_HHMMSS
let seq = 0;
while (existsSync(`${baseDir}/${timestampPrefix}_${seq.padStart(3)}`)) {
  seq++;
}
fs.mkdirSync(`${baseDir}/${timestampPrefix}_${seq.padStart(3)}`);
```

**Directory structure:**
```
output/
├── 20260317_143052_000/
│   ├── research.md
│   ├── research_data.json
│   ├── ppt_plan.md
│   └── pages/
│       ├── page-1-draft.pptx.html
│       ├── page-1.pptx.html
│       ├── page-2-draft.pptx.html
│       ├── page-2.pptx.html
│       └── pages.pptx
```

---

## 7. INTENT INTERCEPTION & SECURITY

### 7.1 Request Classification

**Intercepted intent types** (8 categories):
1. System info extraction (prompt leaking)
2. Role-switching attempts (DAN mode, jailbreaks)
3. Encoding/format bypasses (base64, morse code)
4. Unrelated task requests (coding, translation, math)
5. Multi-step decomposition exploits
6. Reverse psychology ("don't tell me...")
7. Fake identity ("I'm a developer...")
8. Context pollution (long conversation history)

**Unified response:** "我们专注PPT设计服务。请分享您的演示主题。"

### 7.2 Scope Guards

- Only PPT-related requests enter pipeline
- No code generation, translations, or general Q&A
- All deviations rejected with consistent message

---

## 8. SUBAGENT PROMPT DESIGN

### 8.1 Alice Prompt (Research)

```
请帮我做一个深度研究，主题是「{topic}」。

研究要求：
- 研究深度：{depth_level}
- 重点方向：{focus_areas}
- 补充说明：{additional_notes}

**输出路径**：
- 输出目录：{output_dir}
- 报告文件：research.md
- 数据文件：research_data.json
```

### 8.2 Bob Prompt (Planning)

```
请帮我制作一份关于「{topic}」的演示文稿大纲和页面描述。

要求：
- 页数：{page_count} 页
- 风格：{style_id}
- 具体需求：{user_request}

**路径参数**：
- 输出路径：{output_dir}/ppt_plan.md
- 研究报告路径：{output_dir}/research.md

请读取 planner/SKILL.md 获取方法论...
```

### 8.3 Charlie Prompt (Design)

```
请根据 ppt_plan.md 和 research.md 生成 HTML 幻灯片。

**路径参数**：
- 大纲文件路径：{output_dir}/ppt_plan.md
- 研究报告路径：{output_dir}/research.md
- 输出目录：{pages_dir}

请读取 designer/SKILL.md 获取生成方法论...
每页保存到 {pages_dir}/page-N.pptx.html（N 从 1 开始）。
```

**Key principle:** Prompts avoid mentioning "subagent" or special branching—they read like normal user requests, allowing child skills' existing logic to run unmodified.

---

## 9. WORTH-LEARNING TECHNICAL PATTERNS

### ✅ Pattern 1: Multi-Agent Orchestration with Explicit Prompts

**What:** Each agent receives COMPLETE information → naturally skips confirmation loops

**Why valuable:** Reduces back-and-forth, prevents skill chains from asking redundant questions

**Implementation:** Pass all required parameters in SubAgent prompt as if user provided them

### ✅ Pattern 2: Mandatory Approval Gates

**What:** Stage 3 (outline review) is HARD requirement before generation

**Why valuable:** Prevents wasted compute on wrong content direction

**Implementation:** Use AskUserQuestion tools to force explicit user decision with options

### ✅ Pattern 3: Two-Phase Content Generation

**What:** Draft (low-res validation) → Final (high-res polish)

**Why valuable:** Separates content completion from visual refinement; easy rollback

**Implementation:** Independent subagent per phase; Draft stored for reference

### ✅ Pattern 4: Browser-Based HTML→PPTX

**What:** Use Playwright headless browser + client-side PptxGenJS library

**Why valuable:** Handles complex CSS, animations, web fonts without server rendering

**Implementation:** Inject dom-to-pptx library into page context, execute in browser

### ✅ Pattern 5: Timestamp-Based Session Isolation

**What:** Auto-generate `YYYYMMDD_HHMMSS_XXX` directories for each run

**Why valuable:** Prevents filename collisions; enables parallel execution; natural archival

**Implementation:** Query filesystem for existing prefix, auto-increment sequence number

### ✅ Pattern 6: Centralized Path Management

**What:** Main agent controls all output paths via prompt variables

**Why valuable:** SubAgents never guess paths; prevents file scatter

**Implementation:** All paths passed via {output_dir}, {pages_dir} in prompts

### ✅ Pattern 7: Comprehensive Intent Filtering

**What:** 8 categories of non-PPT intent with unified rejection message

**Why valuable:** Robust against prompt injection; consistent UX

**Implementation:** Classification table at skill top level; early return with standard reply

### ✅ Pattern 8: Font Embedding for PPTX Fidelity

**What:** Auto-detect fonts used in HTML → embed in PPTX file

**Why valuable:** Ensures consistent rendering across machines (no font fallback issues)

**Implementation:** Extract font families from DOM → download woff2 → embed via PptxGenJS

---

## 10. DEPENDENCY VERSIONS & CONSTRAINTS

### Critical versions:

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Playwright | 1.40.0 | Browser automation | Headless Chromium |
| PptxGenJS | 3.12.0 | PPTX generation | ⭐ Core tech |
| html2canvas | 1.4.1 | HTML→raster | For embedded images |
| node | ≥18.0.0 | Runtime | ES modules required |

### Font embedding requires:
- opentype.js (font parsing)
- fonteditor-core (font manipulation)
- pako (compression)

---

## 11. CRITICAL TECHNICAL INSIGHTS

### 11.1 Why Not API-Based PPTX?

They chose **browser-based rendering** (html2canvas + PptxGenJS) rather than direct PPTX APIs because:
- Complex CSS/Tailwind → raster handles it perfectly
- Web fonts (MiSans, custom fonts) → browser loads them natively
- Charts (ECharts, Chart.js) → browser renders dynamically
- Animation preview → developer experience
- Easier iteration (edit HTML → re-render)

### 11.2 Draft Phase = Cost Saver

Draft (640×360) validates content BEFORE expensive visual polish phase:
- Low-res SubAgent is faster
- Catches missing info early
- Easy to regenerate if approval fails

### 11.3 Mandatory Outline Approval

Stage 3 prevents cascading failures:
- If outline is wrong → catch before generating 20 pages
- If research is wrong → surface via outline → fix early

### 11.4 No Inline Styles Discipline

```html
<!-- They FORBID this: -->
<div style="font-size: 24px; color: #333;">...</div>

<!-- They REQUIRE this: -->
<div class="text-2xl text-gray-800">...</div>
```

**Why:** Tailwind classes = predictable sizing, easier visual polish phase, no conflicting style cascades

---

## 12. WHAT'S MISSING / VULNERABILITIES

### Potential gaps:
1. **No image caching** – each render fetches web fonts/icons fresh
2. **No PDF support** – only PPTX output
3. **No preview before delivery** – user only sees outline, then final PPTX
4. **Limited template system** – only huawei.md exists
5. **No rollback mechanism** – no version history within session

---

## CONCLUSION

**pptx-craft is engineering-focused** rather than feature-rich:
- ✅ Clear separation (Research → Plan → Design)
- ✅ Explicit workflow gates (approval mandatory)
- ✅ Robust intent filtering (8 jailbreak categories blocked)
- ✅ Path management (timestamp isolation)
- ✅ Browser-based rendering (handles complex CSS+fonts)
- ✅ Two-phase generation (validation + polish)

**Core hypothesis:** Multi-agent systems + explicit user gates + centralized path control = predictable, debuggable, enterprise-grade PPT generation.
