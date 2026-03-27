---
feature_ids: [F144]
related_features: [F138]
topics: [content-generation, presentation, skill]
doc_kind: spec
created: 2026-03-27
---

# F144: PPT Forge — AI 演示文稿生成引擎

> **Status**: spec | **Owner**: 三猫 | **Priority**: P2

## Why

铲屎官原话（2026-03-27）：

> "如果要让你组织猫猫们来实现一个 ppt 生成的 skills 或者说引擎！比如我和你说我想要华为/IBM/xxx/yyy 风格的 ppt，然后给你们一些主题……来吧我们也来搞一个业界 sota 的 ppt skills！"
>
> "笑他们要再欺负我，下次他们汇报说什么都是他们做的完全不提我的时候，我就说我也有个 ppt 生成的能力，现场对比啊。"

**核心动机**：
1. **能力证明**：用真正的工程系统对比对方团队的"SOTA"（纯 prompt 编排 pptx-craft），证明愿景驱动开发的产出力
2. **实用价值**：铲屎官给主题+风格 → 自动产出专业级 PPT，覆盖技术分享、架构设计、行业分析等场景
3. **方法论验证**：多猫协作（研究+叙事+设计+质量守护）生成内容的端到端管线

**背景**：对方团队归档的 `deepresearch`（3 个 MD 文件，零运行时代码）+ `pptx-craft`（HTML 截图转 PPTX），被三猫侦查定性为 "Promptware"——我们要做的是 "Governanceware"。

## What

### Phase A: 核心管线 MVP

串通四层管线，跑通一个端到端 demo：

1. **Research Layer** — 调用 `deep-research` skill 做主题研究
2. **Narrative Layer** — 结构化叙事引擎（金字塔原理/SCQ 等叙事框架）
3. **Visual Design Layer** — Pencil MCP 设计 + 风格模板
4. **Export Layer** — 导出为 .pptx / PDF / HTML

先做 1 个风格（Cat Cafe 风格）验证管线可行性。

### Phase B: 风格模板库 + 引擎化

1. 企业风格模板库（华为/IBM/英伟达/Apple/自定义）
2. Pencil 组件系统（封面/内容/数据/引用/总结等页面类型）
3. Skill 化：铲屎官一句话触发全流程
4. 质量守护集成（信息密度/视觉一致性/叙事连贯性检查）

### Phase C: 进阶能力（可选）

1. 数据可视化自动生成（图表/信息图）
2. 演讲者备注自动生成
3. 多语言支持
4. 实时协作编辑

## Acceptance Criteria

### Phase A（核心管线 MVP）
- [ ] AC-A1: 给定主题 + 风格，能端到端生成一份 ≥10 页的 .pptx 文件
- [ ] AC-A2: Research 层调用 deep-research skill，产出有引用来源的研究报告
- [ ] AC-A3: Narrative 层产出结构化叙事大纲（每页有明确目的和关键信息）
- [ ] AC-A4: Visual Design 层通过 Pencil MCP 生成设计稿
- [ ] AC-A5: Export 层能导出可直接使用的 .pptx 文件
- [ ] AC-A6: Cat Cafe 风格模板可用

### Phase B（风格模板库 + 引擎化）
- [ ] AC-B1: ≥3 种企业风格模板可用（华为/IBM/英伟达）
- [ ] AC-B2: Pencil 组件系统覆盖 ≥5 种页面类型
- [ ] AC-B3: Skill 化，支持一句话触发
- [ ] AC-B4: 质量守护自动检查通过

## Dependencies

- **Related**: F138（Video Studio — 同属内容生成管线家族）
- **Related**: `deep-research` skill（Research 层依赖）
- **Related**: Pencil MCP（Visual Design 层依赖）

## Risk

| 风险 | 缓解 |
|------|------|
| Pencil MCP 组件能力边界不清 | Phase A 先验证，不够再补 HTML 降级路径 |
| 企业风格模板还原度 | 收集真实企业 PPT 作参考，烁烁审美把关 |
| 导出格式保真度（pptxgenjs 限制） | 调研 pptxgenjs vs python-pptx vs 其他方案 |
| 管线串联复杂度 | MVP 先手动串，验证后再自动化 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 导出引擎选型：pptxgenjs vs python-pptx vs Slidev vs 其他？ | ⬜ 未定 |
| OQ-2 | Pencil MCP 能否直接导出为 PPTX，还是需要中间层？ | ⬜ 未定 |
| OQ-3 | 风格模板的设计规范：颜色/字体/间距/组件约束如何定义？ | ⬜ 未定 |
| OQ-4 | 叙事框架引擎：内置几种框架？用户能否自定义？ | ⬜ 未定 |
| OQ-5 | 数据可视化：用什么库？Chart.js / D3 / Mermaid？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 四层架构（Research → Narrative → Visual → Export） | 与对方 pptx-craft 对比后的架构判断，每层专猫负责 | 2026-03-27 |
| KD-2 | Pencil MCP 作为 Visual Design 主力工具 | 我们已有 Pencil 能力，不需要从头写 HTML 模板 | 2026-03-27 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-27 | 立项。起因：侦查对方团队 pptx-craft "SOTA" 后，铲屎官拍板要做一个真正的 PPT 引擎 |

## Review Gate

- Phase A: 跨家族 Review（砚砚/GPT-5.4）
- Phase B: 烁烁视觉审核 + 砚砚代码 Review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Related Feature** | `docs/features/F138-video-studio.md` | 同属内容生成管线家族 |
| **背景故事** | `docs/stories/three-days-productization/README.md` | 三天产品化故事（含对方 SOTA 侦查） |
| **对方归档** | WeChat 归档 `deepresearch/` + `pptx-craft/` | 被侦查的"SOTA"源码 |
| **Skill 依赖** | `cat-cafe-skills/deep-research/SKILL.md` | Research 层依赖 |
