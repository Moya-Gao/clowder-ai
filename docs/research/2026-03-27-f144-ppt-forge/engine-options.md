---
feature_ids: [F144]
topics: [pptxgenjs, export, chart, ooxml]
doc_kind: note
created: 2026-03-27
---

# F144 PPT Forge — Engine Options（导出引擎选型报告）

> 作者：宪宪 (Opus-46) | 日期：2026-03-27
> 砚砚优先级 #1：pptxgenjs 图表在 PowerPoint 里是不是原生可编辑 chart object？

## 结论

**✅ 是。pptxgenjs 生成的图表是原生 OOXML `<c:chartSpace>` chart parts，在 PowerPoint 中双击可编辑数据。Export Gate 通过。**

**推荐方案：pptxgenjs + SlideBuilder 抽象层。**

**不推荐方案：python-pptx（生态不匹配）、Slidev/reveal.js（无 PPTX 导出）、HTML 截图（文字不可编辑）。**

## 1. pptxgenjs 图表可编辑性验证（优先级 #1）

### 结论：原生 OOXML chart ✅

| 验证项 | 结果 | 来源 |
|--------|------|------|
| 图表输出格式 | 原生 `<c:chartSpace>` XML part（OOXML 标准） | [PptxGenJS Charts API](https://gitbrent.github.io/PptxGenJS/docs/api-charts/) |
| PowerPoint 双击编辑 | ✅ 双击可编辑数据（Edit Data in Excel） | [GitHub CHANGELOG](https://github.com/gitbrent/PptxGenJS/blob/master/CHANGELOG.md) — 修复了"embedded Excel sheets that prevented Edit Data in Excel" |
| 图表数据可搜索 | ✅ 图表标签和数据在 PPT 中可搜索 | OOXML 标准保证 |
| Keynote/LibreOffice 兼容 | ✅ OOXML 标准兼容 | [PptxGenJS Introduction](https://gitbrent.github.io/PptxGenJS/docs/introduction/) |

### 支持的图表类型（10 种 + Combo）

| 图表类型 | pptxgenjs 枚举 | 可编辑 | 备注 |
|----------|---------------|--------|------|
| 面积图 | `pres.charts.AREA` | ✅ | 推荐 |
| 柱状/条形图 | `pres.charts.BAR` | ✅ | `barDir: 'col'/'bar'` 控制方向，推荐 |
| 3D 柱状图 | `pres.charts.BAR3D` | ✅ | 支持 box/cylinder/cone/pyramid 形状 |
| 气泡图 | `pres.charts.BUBBLE` | ✅ | |
| 3D 气泡图 | `pres.charts.BUBBLE3D` | ✅ | |
| 环形图 | `pres.charts.DOUGHNUT` | ✅ | ⚠️ 不支持 data table |
| 折线图 | `pres.charts.LINE` | ✅ | 推荐 |
| 饼图 | `pres.charts.PIE` | ✅ | ⚠️ 不支持 data table |
| 雷达图 | `pres.charts.RADAR` | ✅ | |
| 散点图 | `pres.charts.SCATTER` | ✅ | |
| **组合图** | `slide.addChart(chartTypes)` | ✅ | 多类型叠加，需双轴 |

### 图表数据格式

```typescript
// 每个系列 = 一个对象
interface ChartSeries {
  name: string;       // "Q1 Revenue"
  labels: string[];   // ["Jan", "Feb", "Mar"]
  values: number[];   // [100, 200, 150]
}

// 用法
slide.addChart(pres.charts.BAR, seriesArray, chartOptions);
```

## 2. pptxgenjs 完整能力矩阵

### ✅ 已确认（可直接使用）

| 能力 | 详情 | 来源 |
|------|------|------|
| **Slide Master** | `defineSlideMaster()` 创建可复用 layout | [Masters API](https://gitbrent.github.io/PptxGenJS/docs/masters/) |
| **Placeholder** | title/body/image/chart/table/media 6 种类型 | Masters API |
| **文本排版** | fontSize/fontFace/bold/italic/underline/align/lineSpacing/paraSpaceAfter/charSpacing/subscript/superscript | Charts & Text API |
| **项目符号** | `bullet: true`（⚠️ 不要用 unicode 符号） | [Anthropic Skill Ref](https://github.com/anthropics/skills/blob/main/skills/pptx/pptxgenjs.md) |
| **表格** | 行列数据 + 边框 + 合并单元格 + 交替行色 | Tables API |
| **图片** | base64/URL/Buffer + sizing（contain/cover/crop） | Images API |
| **形状** | 100+ 预定义形状 | Shapes API |
| **SVG** | ✅ 直接嵌入 | Introduction |
| **布局尺寸** | 16:9 / 16:10 / 4:3 / WIDE | Quick Start |
| **输出格式** | 文件 / Buffer / Base64 / Stream | Quick Start |
| **图表调色盘** | `chartColors: ["hex1", "hex2"]` 自定义 | Charts API |
| **图表数据标签** | position/color/font/format 全可控 | Charts API |
| **图表坐标轴** | 标题/颜色/字体/范围/刻度/网格线 | Charts API |
| **Data Table** | 图表下方数据表格 | Charts API（Pie/Doughnut 除外） |
| **组合图双轴** | 主轴+副轴，多图表类型叠加 | Charts API |

### ⚠️ 需注意的限制

| 限制 | 影响 | 缓解 |
|------|------|------|
| **绝对定位**（x/y/w/h inches） | 每个元素都要手动算位置 | SlideBuilder 抽象层封装计算 |
| **对象突变**（mutates in-place to EMU） | 共享 options 对象会损坏第二个元素 | 工厂函数生成 options，不复用 |
| **Hex 无 `#`** | `"#FF0000"` → 文件损坏 | Theme token 层统一去 `#` |
| **8 位 hex 损坏** | `"00000020"` → 文件损坏 | 用 `opacity` 属性，不编码到 hex |
| **负 shadow offset** | 损坏文件 | Schema 校验层拦截 |
| **Pie/Doughnut 无 data table** | 不能显示数据表格 | 改用 bar 或单独放数据表 |
| **Combo 水平 bar + line** | PowerPoint 限制 | 改用 vertical column + line |
| **字体嵌入** | pptxgenjs 不自动嵌入字体到 .pptx | 用户机器需安装字体，或用 Web 安全字体 |

### 🔴 Anthropic 官方 pptxgenjs Skill 的 10 条铁律

来自 [anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/pptx/pptxgenjs.md)：

1. **NEVER** use `#` in hex colors → 文件损坏
2. **NEVER** encode opacity in 8-char hex → 文件损坏
3. **NEVER** use unicode bullets → 双重符号；用 `bullet: true`
4. **Use** `breakLine: true` between text array items
5. **Avoid** `lineSpacing` with bullets → 间距爆炸；用 `paraSpaceAfter`
6. **Each** presentation needs a fresh `pptxgen()` instance
7. **NEVER** reuse option objects → 对象突变损坏第二个元素
8. **Don't** use `ROUNDED_RECTANGLE` with accent borders
9. **Shadow** `offset` must be non-negative → 负值损坏文件
10. **Use** `charSpacing` not `letterSpacing` → 后者被静默忽略

## 3. 方案对比

| 方案 | 原生可编辑文本 | 原生可编辑图表 | TypeScript | 维护状态 | 我们用吗 |
|------|:---:|:---:|:---:|:---:|:---:|
| **pptxgenjs** | ✅ | ✅ | ✅ 原生 | 活跃（2025-05） | **✅ 首选** |
| python-pptx | ✅ | ✅ | ❌ Python | 活跃 | ❌ |
| pptx-automizer | ✅ | ✅（模板注入） | ✅ | 活跃 | ⚠️ 备选 |
| Slidev | ❌ 截图 | ❌ | ✅ Vue | 活跃 | ❌ |
| reveal.js | ❌ 无 PPTX | ❌ | ✅ | 活跃 | ❌ |
| HTML→截图→PPTX | ❌ 光栅化 | ❌ | - | - | ❌ |
| Marp | ❌ 截图 | ❌ | - | 活跃 | ❌ |

### 不推荐路线详解

| 方案 | 为什么不用 |
|------|----------|
| **python-pptx** | 生态不匹配（我们是 TypeScript 全栈），需要额外 Python runtime，依赖链管理复杂 |
| **Slidev / reveal.js** | HTML 演示框架，不产出 .pptx；导出 PDF 可以但**文字不可编辑**，图表是截图 |
| **HTML→Playwright→PPTX** | **对方 pptx-craft 的路线**。文字光栅化为图片 → 不可编辑不可搜索。这正是我们要碾压的点 |
| **Marp** | Markdown → 静态 HTML → PDF/PPTX，图表不可编辑，排版灵活性差 |
| **pptx-automizer** | 基于模板注入（需预制 .pptx 模板），灵活性受限于模板；但作为 Phase B 补充手段可考虑 |

## 4. SlideBuilder 抽象层设计建议

pptxgenjs 最大痛点是绝对定位。SlideBuilder 层的职责：

```typescript
/**
 * SlideBuilder 的核心职责：
 * 1. Blueprint → pptxgenjs API 调用的转译
 * 2. Layout slot 位置计算（从 Layout 定义读取）
 * 3. Theme token → pptxgenjs options 映射
 * 4. 铁律守护（hex 无 #、options 不复用、shadow 非负）
 */
interface SlideBuilder {
  /** 从 Blueprint + Theme 构建完整 Presentation */
  build(blueprint: DeckBlueprint, theme: ThemeTokens): PptxGenJS;

  /** 单页构建 */
  buildSlide(pres: PptxGenJS, slide: SlideSpec, theme: ThemeTokens): void;

  /** 元素渲染分发 */
  renderElement(slide: PptxGenJSSlide, element: SlideElement, slot: LayoutSlot, theme: ThemeTokens): void;
}
```

**关键设计原则：**
- Blueprint 是输入，pptxgenjs 是输出 — Blueprint 不感知 pptxgenjs API
- Theme tokens 在 build 时注入，不在 Blueprint 中硬编码颜色
- 工厂模式生成 options 对象（因为 pptxgenjs 会突变对象）
- Export Gate 校验内建（hex 无 #、shadow 非负、布局无溢出）

## 5. 需 POC 验证的项（Phase A 前必须确认）

| 项目 | 风险等级 | 验证方式 |
|------|---------|---------|
| pptxgenjs 图表在 PowerPoint 2021+ 中双击编辑的实际体验 | 中 | 生成测试 .pptx，在 PowerPoint 中手动验证 |
| 自定义字体（Inter/DM Sans）在未安装机器上的 fallback 行为 | 中 | 生成含自定义字体的 .pptx，在干净机器上打开 |
| 50+ 页大 deck 的生成性能 | 低 | 压测脚本 |
| Combo chart 双轴在不同 PPT 版本的兼容性 | 低 | 多版本测试 |
