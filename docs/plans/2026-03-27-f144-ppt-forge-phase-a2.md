---
feature_ids: [F144]
topics: [ppt-forge, pipeline, phase-a2]
doc_kind: plan
created: 2026-03-27
---

# F144 PPT Forge Phase A-2: 端到端管线打通

**Feature:** F144 — `docs/features/F144-ppt-forge.md`
**Goal:** 给定一个主题 + 风格，AI 自动研究→叙事→蓝图→导出 .pptx，丢到桌面
**Acceptance Criteria:**
- AC-A1: 给定主题 + 风格，端到端生成 ≥10 页 .pptx
- AC-A2: Research 层产出 research.md，每个结论带来源引用
- AC-A3: Narrative 层产出 storyline.md，每页有明确"存在目的"
- AC-A4: Blueprint 层产出 deck.blueprint.json
- AC-A7: 信息密度接近华为参考图水平
- AC-A12: PPT 365 打开无 repair 弹窗
**Architecture:** 三层管线叠加在 Phase A-1 Export 层之上。Cat（Opus）作为 LLM 直接执行 Research/Narrative/Blueprint 生成，代码提供 schema 验证 + layout 推荐 + 管线编排。
**Tech Stack:** TypeScript, pptxgenjs (Phase A-1 已有), WebSearch (Research 层)
**前端验证:** No — 纯后端 CLI + .pptx 产物

---

## Straight-Line Check

**Finish line (B):** `ppt-forge pipeline "AI Agent 发展趋势" --theme huawei-like -o ~/Desktop/demo.pptx` → 10+ 页华为风格 PPT 落到桌面，内容来自实时研究。

**NOT building:**
- LLM API 自动化调用（Phase B Skill 化再做）— Phase A-2 由猫直接执行生成
- 五道门禁的完整评分协议（Phase B）— Phase A-2 只做 schema validation gate
- 多风格模板（Phase B）— 只用 huawei-like
- DiagramElement 架构图（Level 2 stretch）

**Terminal schemas（新增）:**

```typescript
// Research Layer Output
interface ResearchOutput {
  topic: string;
  generatedAt: string; // ISO 8601
  sources: Source[];
  findings: Finding[];
  dataPoints: DataPoint[];
}
interface Source { id: string; title: string; url?: string; type: 'web' | 'paper' | 'report'; }
interface Finding { id: string; claim: string; sourceIds: string[]; confidence: 'fact' | 'inference' | 'recommendation'; }
interface DataPoint { id: string; label: string; value: number | string; unit?: string; sourceId: string; }

// Narrative Layer Output
interface StorylineOutput {
  framework: 'pyramid' | 'scq' | 'problem-solution';
  centralMessage: string;
  sections: NarrativeSection[];
}
interface NarrativeSection {
  sectionId: string;
  title: string;
  purpose: string; // 为什么这个 section 存在
  slides: NarrativeSlide[];
}
interface NarrativeSlide {
  slideId: string;
  intent: SlideIntent; // 复用 Phase A-1 的类型
  keyMessage: string; // 这页的核心信息
  supportingPoints: string[];
  suggestedDataViz?: 'chart' | 'table' | 'kpi' | 'text-only';
}
```

---

## Tasks

### Task 1: 上层 schema — ResearchOutput + StorylineOutput types

**Files:**
- Modify: `packages/ppt-forge/src/types.ts` (append)
- Modify: `packages/ppt-forge/src/index.ts` (export)

**Step 1:** Append ResearchOutput + StorylineOutput interfaces to types.ts (terminal schemas above)

**Step 2:** Export new types from index.ts

**Step 3:** `pnpm --filter @cat-cafe/ppt-forge build` — tsc clean

**Step 4:** Commit `feat(ppt-forge): add Research + Storyline layer types`

---

### Task 2: 层间验证器 — Research Gate + Narrative Gate

**Files:**
- Create: `packages/ppt-forge/src/gates.ts`
- Test: `packages/ppt-forge/test/gates.test.ts`

**Step 1: Write failing tests**

```typescript
// gates.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateResearch, validateStoryline } from '../src/gates.js';

describe('validateResearch', () => {
  it('passes valid research output', () => { ... });
  it('rejects research with no findings', () => { ... });
  it('rejects finding without sourceId reference', () => { ... });
});

describe('validateStoryline', () => {
  it('passes valid storyline', () => { ... });
  it('rejects storyline with empty sections', () => { ... });
  it('rejects slide without keyMessage', () => { ... });
});
```

**Step 2:** Run tests, verify they fail

**Step 3:** Implement `validateResearch()` + `validateStoryline()` in gates.ts:
- Research gate: ≥1 finding, every finding.sourceIds exists in sources[], ≥1 dataPoint
- Narrative gate: ≥1 section, every slide has keyMessage + intent, no empty sections

**Step 4:** Run tests, verify green

**Step 5:** Commit `feat(ppt-forge): add Research + Narrative gate validators`

---

### Task 3: Blueprint 生成器 — storyline → blueprint 转换

**Files:**
- Create: `packages/ppt-forge/src/blueprint-gen.ts`
- Test: `packages/ppt-forge/test/blueprint-gen.test.ts`

这是管线的核心：把叙事结构转化为可导出的 blueprint。

**Step 1: Write failing tests**

```typescript
describe('generateBlueprint', () => {
  it('generates cover + closing from meta', () => { ... });
  it('maps NarrativeSection to section-break slide', () => { ... });
  it('picks layout based on suggestedDataViz', () => { ... });
  it('allocates renderBudget per slide', () => { ... });
  it('generates ≥10 slides from 3-section storyline', () => { ... });
});

describe('suggestLayout', () => {
  it('returns layout-chart-insight for chart viz', () => { ... });
  it('returns layout-kpi-3col for kpi viz', () => { ... });
  it('returns layout-title-body for text-only', () => { ... });
  it('returns layout-dense-table for table viz', () => { ... });
});
```

**Step 2:** Run tests, verify they fail

**Step 3:** Implement:
- `suggestLayout(slide: NarrativeSlide)` — maps suggestedDataViz → layoutId
- `generateBlueprint(storyline: StorylineOutput, meta: Partial<DeckMeta>)` → DeckBlueprint:
  1. Auto-add cover slide (from meta.title/subtitle)
  2. For each section: add section-break slide
  3. For each slide in section: pick layout, create SlideSpec with elements
  4. Auto-add closing slide
  5. Fill renderBudget defaults (maxWords based on layout slot count)
  6. Wire sections[] and slideIds

**关键**：blueprint-gen 只做结构骨架（layout + slots + renderBudget）。实际文本/图表数据由猫在 runtime 填充到 elements[] 中。所以 generateBlueprint 输出的 elements 是**占位框架**，猫在 pipeline 中填入真实内容。

**Step 4:** Run tests, verify green

**Step 5:** Commit `feat(ppt-forge): add blueprint generator from storyline`

---

### Task 4: Pipeline 编排器

**Files:**
- Create: `packages/ppt-forge/src/pipeline.ts`
- Test: `packages/ppt-forge/test/pipeline.test.ts`

**Step 1: Write failing tests**

```typescript
describe('runPipeline', () => {
  it('validates research → storyline → blueprint → pptx buffer', () => { ... });
  it('rejects if research gate fails', () => { ... });
  it('rejects if storyline gate fails', () => { ... });
  it('rejects if blueprint has invalid hex colors', () => { ... });
  it('returns PipelineResult with all artifacts', () => { ... });
});
```

**Step 2:** Run tests, verify they fail

**Step 3:** Implement `runPipeline(input: PipelineInput): Promise<PipelineResult>`:

```typescript
interface PipelineInput {
  research: ResearchOutput;
  storyline: StorylineOutput;
  blueprint: DeckBlueprint; // 猫已填充完整内容
  themePath: string; // path to theme.tokens.json
  outputPath: string; // where to write .pptx
}
interface PipelineResult {
  slidesCount: number;
  outputPath: string;
  buffer: Buffer;
  gateResults: { research: 'pass'; narrative: 'pass'; blueprint: 'pass' };
}
```

Pipeline 流程：
1. validateResearch(input.research) → throw if fail
2. validateStoryline(input.storyline) → throw if fail
3. Load theme from themePath
4. buildDeck(input.blueprint, theme) → pptx
5. Write to outputPath
6. Return PipelineResult

**Step 4:** Run tests, verify green

**Step 5:** Commit `feat(ppt-forge): add pipeline orchestrator`

---

### Task 5: CLI `generate` 子命令

**Files:**
- Modify: `packages/ppt-forge/src/cli.ts` (add generate command)

**Step 1:** Add `generate` subcommand that reads research.json + storyline.json + blueprint.json + theme.json → runs pipeline → outputs .pptx

**Step 2:** Integration test: feed fixture files through CLI

**Step 3:** Commit `feat(ppt-forge): add CLI generate command`

---

### Task 6: 实战 demo — 真实主题端到端生成

**不是代码 task，是猫的 runtime 执行：**

1. 猫用 WebSearch 研究一个真实主题（如"AI Agent 2026 发展趋势"）
2. 猫按 ResearchOutput schema 整理研究结果
3. 猫按 StorylineOutput schema 生成叙事结构
4. 猫用 generateBlueprint() 生成骨架，再填入真实内容
5. 猫调用 runPipeline() → .pptx
6. 复制到 ~/Desktop/

**验证标准：**
- ≥10 页
- 包含真实研究数据（图表有真实数字）
- PPT 365 Online 打开正常
- 铲屎官满意度 > "好简陋" 🐾

---

## 风险

| 风险 | 应对 |
|------|------|
| 猫生成的 blueprint JSON 不符合 schema | gates.ts 验证 + buildDeck 已有的校验兜底 |
| WebSearch 结果质量不够 → 数据空洞 | 允许猫补充推断数据，标记 confidence: 'inference' |
| 生成的 PPT 内容质量 << 华为参考图 | Phase A-2 目标是"打通"，质量迭代留 Phase B |
