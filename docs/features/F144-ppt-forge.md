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

### 五层架构（头脑风暴收敛版）

```
铲屎官输入: "英伟达 GTC 2026 具身智能分析，英伟达风格"
  ↓
Layer 1: Research        → deep-research skill（三路 DR + Pro 审阅）
  ↓  产物: research.md（带来源引用）
  ↓  ── Research Gate ──
Layer 2: Narrative       → 结构化叙事引擎（金字塔/SCQ/问题-方案）
  ↓  产物: storyline.md（每页有"存在目的"）
  ↓  ── Narrative Gate（铲屎官审批叙事方向）──
Layer 3: Blueprint       → 页面蓝图生成器（layout + 元素规划）
  ↓  产物: deck.blueprint.json（每页 layout/元素/图表位/引用位）
  ↓  ── Blueprint Gate ──
Layer 4: Style           → Design Token 三层体系 + 风格模板
  ↓  产物: theme.tokens.json（品牌→语义→Slide Master）
Layer 5: Export          → pptxgenjs 原生 OOXML 生成
  ↓  产物: deck.pptx（文字可编辑、可搜索、布局无溢出）
  ↓  ── Export Gate + Vision Gate ──
```

**五份中间产物 = contract chain**（砚砚提出，全员共识）：
`research.md → storyline.md → deck.blueprint.json → theme.tokens.json → deck.pptx`

每份产物都是可审计、可 review、可回溯的独立 artifact。

### Phase A: 核心管线 MVP

串通五层管线，跑通一个端到端 demo：

1. **Research Layer** — 调用 `deep-research` skill 做主题研究
2. **Narrative Layer** — 结构化叙事引擎（金字塔原理 + SCQ 两个框架）
3. **Blueprint Layer** — 页面蓝图生成（layout 选择 + 元素规划 + contract 输出）
4. **Style Layer** — 1 个企业风格模板（nvidia-like，含 Design Token 三层体系）
5. **Export Layer** — pptxgenjs 原生 OOXML 导出 .pptx

**Phase A 关键决策**：
- 首个风格选**企业风格（nvidia-like）**，不选 Cat Cafe — 目标是"现场对比打脸"，必须证明能做严肃企业汇报（砚砚 pushback，采纳）
- **Pencil MCP 降级为可选审批器**，不进主路径硬依赖 — 避免被集成卡住（砚砚 pushback，采纳）
- SlideBuilder 抽象层处理 pptxgenjs 的 x/y/w/h 绝对定位计算

### Phase B: 风格模板库 + 引擎化

1. 企业风格模板库（华为/IBM/Apple/Cat Cafe）
2. Pencil MCP 集成：设计预览 + 风格定义 + 铲屎官审批
3. Skill 化：铲屎官一句话触发全流程
4. 第三个叙事框架（问题-方案）+ 自定义框架支持
5. 质量守护集成（信息密度/视觉一致性/叙事连贯性检查）

### Phase C: 进阶能力（可选）

1. 数据可视化自动生成（pptxgenjs 内置图表：Bar/Line/Pie/Combo）
2. 演讲者备注自动生成
3. HTML 预览模式（可选，双轨：HTML 预览 + pptxgenjs 最终导出）
4. 多语言支持

## Acceptance Criteria

### Phase A（核心管线 MVP）
- [ ] AC-A1: 给定主题 + 风格，能端到端生成一份 ≥10 页的 .pptx 文件
- [ ] AC-A2: Research 层产出 `research.md`，每个关键结论带来源引用，数据区分事实/推断/建议
- [ ] AC-A3: Narrative 层产出 `storyline.md`，每页有明确"存在目的"
- [ ] AC-A4: Blueprint 层产出 `deck.blueprint.json`，包含页数预算/layout/元素位/引用位
- [ ] AC-A5: Style 层产出 `theme.tokens.json`，Design Token 三层体系（品牌→语义→Slide Master）
- [ ] AC-A6: Export 层产出原生 .pptx，文字可编辑、可搜索、布局无溢出
- [ ] AC-A7: 企业风格模板（nvidia-like）可用
- [ ] AC-A8: 五道门禁全部嵌入管线（Research/Narrative/Blueprint/Export/Vision Gate）

### Phase B（风格模板库 + 引擎化）
- [ ] AC-B1: ≥3 种企业风格模板可用（华为/IBM/Apple）
- [ ] AC-B2: Pencil MCP 集成为设计预览 + 审批工具
- [ ] AC-B3: Skill 化，支持一句话触发
- [ ] AC-B4: 质量守护自动检查通过

## Dependencies

- **Related**: F138（Video Studio — 同属内容生成管线家族）
- **Related**: `deep-research` skill（Research 层依赖）
- **Related**: Pencil MCP（Visual Design 层依赖）

## Risk

| 风险 | 缓解 |
|------|------|
| Research 退化为"调研报告切 10 页"（砚砚警告） | Narrative Gate 强制每页有观点/目的，不是摘要 |
| 导出偷懒走光栅化（截图嵌入） | Export Gate 硬门禁：文字可编辑+可搜索+无溢出 |
| 风格模板变成"品牌模仿"而非 token 化 | Design Token 三层体系，不依赖外部品牌资产 |
| 审批点太晚导致级联浪费 | 五道门禁嵌入管线内部（Research→Narrative→Blueprint→Export→Vision） |
| 产物不能回答"数据哪来的"（砚砚警告） | research.md 每个结论带来源，blueprint 引用 research 行号 |
| pptxgenjs 绝对定位复杂度 | SlideBuilder 抽象层封装 x/y/w/h 计算 |
| Pencil 集成卡住 Phase A | Phase A 主路径不依赖 Pencil，降级为可选审批器 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | ~~导出引擎选型~~ → **pptxgenjs**（金渐层七方案对比 + 对方也在用） | ✅ 已定 |
| OQ-2 | ~~Pencil MCP 能否直接导出 PPTX~~ → **不能**（只支持 PNG/JPEG/PDF），降级为可选审批器 | ✅ 已定 |
| OQ-3 | ~~风格模板设计规范~~ → **Design Token 三层体系**（品牌基础→幻灯片语义→Slide Master） | ✅ 已定 |
| OQ-4 | ~~叙事框架引擎~~ → **结构化模板 + prompt 增强**，Phase A 做金字塔+SCQ | ✅ 已定 |
| OQ-5 | 数据可视化：pptxgenjs 内置图表（Bar/Line/Pie/Combo）够用吗？复杂场景需要额外库？ | ⬜ 未定 |
| OQ-6 | SlideBuilder 抽象层的 layout 定义：是否复用 Pencil slides guidelines 的 20 种 layout？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | ~~四层~~ → **五层架构**（Research → Narrative → Blueprint → Style → Export） | 头脑风暴收敛：金渐层+砚砚一致认为 Narrative→Visual 之间缺 Blueprint 契约层 | 2026-03-27 |
| KD-2 | ~~Pencil MCP 主力~~ → **Pencil 降级为可选审批器**，Phase A 主路径不依赖 | 砚砚 pushback：Pencil 不支持 PPTX 导出，Phase A 核心胜负手是稳定产出，不能被集成卡住 | 2026-03-27 |
| KD-3 | **pptxgenjs 作为导出引擎** | 金渐层七方案对比 + 对方 pptx-craft 也用它（业界共识），原生 OOXML 可编辑可搜索 | 2026-03-27 |
| KD-4 | Phase A 首个风格选 **nvidia-like 企业风格**，不选 Cat Cafe | 砚砚 pushback：目标是"现场对比打脸"，Cat Cafe 适合 smoke test 不适合证明能力 | 2026-03-27 |
| KD-5 | **五份中间产物作为 contract chain** | 砚砚提出：research.md → storyline.md → deck.blueprint.json → theme.tokens.json → deck.pptx，每份可审计可回溯 | 2026-03-27 |
| KD-6 | **五道门禁嵌入管线** | 砚砚提出：Research/Narrative/Blueprint/Export/Vision Gate，审批点前置防止级联浪费 | 2026-03-27 |
| KD-7 | **叙事引擎 = 结构化模板 + prompt 增强** | 金渐层+砚砚共识：纯 prompt 不稳定，纯模板僵硬，混合方案最优 | 2026-03-27 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-27 | 立项。起因：侦查对方团队 pptx-craft "SOTA" 后，铲屎官拍板要做一个真正的 PPT 引擎 |
| 2026-03-27 | 头脑风暴收敛。金渐层+砚砚独立分析后收敛：五层架构 + 五道门禁 + pptxgenjs + 企业风格优先（烁烁 API 故障缺席） |

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
| **头脑风暴** | 金渐层分析（thread 内卡片） | 五层架构 + 技术选型 + 猫猫分工 |
| **头脑风暴** | 砚砚分析（thread 内消息） | 五道门禁 + 失败模式 + Phase A 收口 |
