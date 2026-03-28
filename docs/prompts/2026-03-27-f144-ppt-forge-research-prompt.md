---
feature_ids: [F144]
topics: [pptxgenjs, presentation, design-tokens, blueprint]
doc_kind: note
created: 2026-03-27
---

# F144 PPT Forge — 技术调研 Prompt

> 委托人：宪宪 (Opus-46)  日期：2026-03-27
> 执行顺序：砚砚 (GPT-5.4) 指定

## 背景

Cat Cafe 团队正在开发 F144 PPT Forge — AI 演示文稿生成引擎。
头脑风暴已收敛为五层架构（Research → Narrative → Blueprint → Style → Export），
导出引擎选定 pptxgenjs，需要产出三份技术文档来支撑 Phase A 实施。

## 三份必交产物（砚砚指定顺序）

### 产物 1: blueprint-schema.md（最先做）

**目的**：定义 Narrative → Blueprint → Export 的 contract，没有这个后面的库对比都会飘。

需要定义的最小 schema：
- `intent`：每页的存在目的（Cover/SectionBreak/KeyStatement/Data/Evidence/Summary/Closing）
- `layout slots`：每种 intent 对应的可用 layout（标题+正文/双栏/图表+洞察/全图等）
- `evidence refs`：引用 research.md 的具体行号/结论编号
- `chart data contract`：图表的数据结构（类型/数据/标签/颜色映射）
- `speaker notes`：演讲者备注
- `asset refs`：图片/图标等资产引用

输出要求：
- 完整的 TypeScript interface 定义
- 一个真实示例（nvidia GTC 具身智能 demo）
- **不推荐路线**：为什么不用 JSON-LD / Markdown / 自由文本

### 产物 2: engine-options.md（第二做）

**核心验证（优先级 #1）**：pptxgenjs 生成的图表在 PowerPoint 里是不是**原生可编辑 chart object**？

需要调研：
1. pptxgenjs chart API 的实际输出格式（OOXML chart part 还是光栅化图片？）
2. 生成的 .pptx 用 PowerPoint 打开后，图表能否双击编辑数据？
3. 支持哪些图表类型？（Bar/Line/Pie/Area/Scatter/Combo？）
4. Slide Master / Layout 的创建和复用机制
5. 文本排版精细度：行间距/字间距/对齐/上下标/项目符号
6. 多媒体：SVG 嵌入 / 图片裁剪 / 形状

输出要求：
- 每个功能标注信息来源（GitHub issue / 官方文档 / npm README）
- 区分"已确认"和"需要 POC 验证"
- 给出推荐方向 + 风险
- **不推荐路线**：为什么不用 python-pptx / Slidev / reveal.js / HTML 截图

### 产物 3: theme-token-spec.md（最后做）

**核心命题**：区分"设计语法"（可 token 化）和"品牌资产"（不可直接复用）。

需要调研：
1. nvidia-like 企业风格的设计语法拆解：配色系统/字体层级/间距系统/图表调色盘
2. **合法替代字体栈**：NVIDIA Sans → 什么开源字体接近？（Inter? DM Sans?）
3. IBM Carbon Design System 的 token 体系作为参考
4. Apple Human Interface Guidelines 的 token 结构
5. Design Token 三层体系的具体映射规则（品牌基础 → 幻灯片语义 → Slide Master）
6. pptxgenjs 自定义字体嵌入的实际支持情况

输出要求：
- 完整的 theme.tokens.json 示例（nvidia-like 风格）
- 合法替代字体栈（每个品牌风格的 heading/body/mono）
- token 到 pptxgenjs Slide Master 的映射代码示例
- **不推荐路线**：为什么不直接复制品牌 VI / 不用 CSS 变量 / 不用 Figma token

## 参考资料

- F144 Spec: `docs/features/F144-ppt-forge.md`
- deep-research skill: `cat-cafe-skills/deep-research/SKILL.md`
- 对方 pptx-craft 归档: WeChat 归档 `pptx-craft/`（用 pptxgenjs 3.12.0 + Playwright）
- Pencil MCP slides guidelines: 20 种 layout，1920x1080
- pptxgenjs GitHub: https://github.com/gitbrent/PptxGenJS
- pptxgenjs Docs: https://gitbrent.github.io/PptxGenJS/
