---
feature_ids: [F144]
related_features: [F138]
topics: [ppt-forge, rendering-engine, html-layout, playwright, pptxgenjs, architecture-pivot]
doc_kind: decision
created: 2026-03-28
decision_id: ADR-024
---

# ADR-024: F144 PPT Forge — HTML Layout Compiler 终态渲染引擎

> **Status**: accepted
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(codex)
> **Date**: 2026-03-28
> **Supersedes**: engine-options.md 中"HTML 路线 = 截图 = 不可编辑"的错误判断

## Context

### Phase A 暴露的问题

Phase A 用 pptxgenjs 原生 shapes 手算 x/y/w/h 坐标。在简单布局（title-body、KPI、chart）上可行，但华为级复杂嵌套布局（50+ boxes、4+ 层）时：

1. **视觉效果差** — 手算坐标的递归算法在深层嵌套时产出"窄条状"盒子，无法达到华为参考图水平
2. **算法复杂度爆炸** — 每种新布局都需要写一套坐标计算（padding、gap、proportional width、alternating direction），代码量大且难以维护
3. **与 HTML/CSS 布局能力的鸿沟** — flexbox/grid 在浏览器中免费提供的布局能力（自动换行、响应式对齐、嵌套 margin collapse），用手算坐标需要重新发明

### 原始决策错误

`engine-options.md` 将 HTML 路线等价于"截图 = 光栅化 = 文字不可编辑"（第 130 行），这是一个 **false dichotomy**。实际存在第三条路：

- **HTML 做布局计算**（Playwright headless 确定性求值）
- **DOM 语义编译器**提取坐标和内容
- **pptxgenjs 做原生对象输出**（文字可编辑、图表可编辑）

这正是对手 pptx-craft 内部 dom-to-pptx 库的核心思路，也与我们 F138 Video Studio 的 Remotion 架构（HTML+CSS → 视频帧）同源。

### 铲屎官原话

> "你就别做脚手架啦！你想要比别人更厉害的话，你就直接按照最终状态去做呀。"
> "我当时说的难道不是要和我们视频生产线那样嘛？这不就是要 HTML+CSS？"

## Decision

**采用 HTML Layout Compiler 作为 Phase B 终态渲染引擎。**

### 终态架构

```
Blueprint JSON (语义)
    ↓
HTML Template Engine (HTML+Tailwind 生成 slide DOM)
    ↓
Playwright headless (固定 viewport 1280×720 / 字体 / 样式 → 确定性布局求值)
    ↓ data-ppt-role 语义标注
DOM Semantic Compiler (编译为 text/table/chart/shape/group + 坐标)
    ↓
pptxgenjs 原生对象输出 (文字可编辑、图表可编辑、字体嵌入)
    ↓
deck.pptx
```

### 五条硬边界（砚砚定义）

| # | 边界 | 含义 |
|---|------|------|
| 1 | `layout-engine` | Playwright 做确定性布局求值（固定 viewport 1280×720 / 字体 / 样式） |
| 2 | `semantic-compiler` | 按 `data-ppt-role` 编译为原生 pptxgenjs 对象，不做像素级截图 |
| 3 | `editable-first` | 任何页面元素默认原生对象，禁止截图回退 |
| 4 | `font-embed` | 字体嵌入能力并入导出链（opentype.js + fonteditor-core） |
| 5 | `browser-backend` | 生产链只用 Playwright（可重复、可测试），其他浏览器能力用于调研/采样 |

### 与对手 pptx-craft 的区别

| 维度 | pptx-craft | 我们 |
|------|-----------|------|
| HTML 模板 | React/Next.js + Tailwind | 轻量 HTML+Tailwind（无框架） |
| 布局引擎 | Playwright | Playwright |
| DOM → PPTX | dom-to-pptx（闭源） | 自研 DOM Semantic Compiler |
| 图表 | 截图（不可编辑） | pptxgenjs 原生 OOXML chart（可编辑）✅ |
| 字体嵌入 | ✅ opentype.js | ✅ 同方案 |
| Blueprint 语义层 | 无（直接 HTML） | 五层架构，Blueprint 与渲染解耦 |

**我们的核心优势**：Blueprint 语义层 + 原生可编辑图表。对手截图图表不可编辑，我们用 pptxgenjs 原生 OOXML chart。

## Consequences

### 正面

- 布局能力提升一个量级（CSS flexbox/grid 免费提供）
- HTML+Tailwind 模板比 JSON token 表达力强 10 倍，风格模板库开发速度大幅加快
- 与 F138 Video Studio 共享思路，团队心智模型统一
- 字体嵌入解决跨平台字体缺失问题

### 负面

- 新增 Playwright 依赖（~200MB），CI 构建时间增加
- 需要设计 `data-ppt-role` 语义标注规范
- Phase A 的手算坐标 renderer 代码将被废弃（沉没成本，但 Phase A 验证了 pptxgenjs output layer 的可行性）

### 风险

| 风险 | 缓解 |
|------|------|
| Playwright 布局与 PPT 布局差异 | 固定 viewport + 字体 + 样式，确定性环境 |
| DOM Semantic Compiler 复杂度 | 分步交付：先 text/shape，再 table，最后 chart |
| 字体嵌入 OOXML 兼容性 | POC 先行，参考对手方案 |
