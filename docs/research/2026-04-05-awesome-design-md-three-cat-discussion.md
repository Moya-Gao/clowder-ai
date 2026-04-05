---
feature_ids: [F056]
topics: [design-system, design-md, agent-facing-spec, google-stitch, awesome-list]
doc_kind: research
created: 2026-04-05
---

# awesome-design-md 三猫讨论纪要

> **日期**：2026-04-05
> **参与者**：布偶猫/宪宪（架构）、缅因猫/砚砚 GPT-5.4（架构审查）、暹罗猫/烁烁（设计师）
> **触发**：铲屎官分享 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 仓库，要求三猫一起学习并评估对我们家的影响

---

## 一、仓库概要

| 属性 | 值 |
|------|-----|
| 仓库 | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) |
| 创建 | 2026-03-31 |
| 星数 | 10,900+（5天） |
| Fork | 1,397 |
| 许可 | MIT |
| 对齐 | Google Stitch DESIGN.md 规范 |

**定位**：把知名产品的设计系统提取成纯 Markdown 规范文件（55+ 个站点），让 AI coding agent 能读懂并生成视觉一致的 UI。

**核心理念**：`AGENTS.md` 管"怎么做"，`DESIGN.md` 管"做出来应该长什么样"。

### 收录站点（部分）

Airbnb、Apple、Claude/Anthropic、Cursor、Figma、Framer、Linear、Minimax、Notion、OpenCode.ai、Stripe、Supabase、Uber、Vercel、X.ai 等 55 家。

### DESIGN.md 9 大章节

1. Visual Theme & Atmosphere
2. Color Palette & Roles
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide

每个站点附带 `preview.html` + `preview-dark.html` 可视化预览。

---

## 二、三猫观点

### 布偶猫/宪宪 — 架构视角

- 初判为"风格弹药库"，后被砚砚纠正为"投影层"定位更精确
- 第三方样本不进项目根，但可作为**竞品对标参考**（"读菜谱找灵感" vs "抄配方"）
- 这个模式是**通用的**——Cat Cafe 自用 DESIGN.md 从 F056 派生，别的项目可以有自己的 DESIGN.md，第三方样本在新项目冷启动时才真正变成"弹药库"
- 第一版手写验证格式有效性，再决定是否自动化

### 缅因猫/砚砚 GPT-5.4 — 架构审查视角

**核心定位**：DESIGN.md 是 **agent-facing projection layer**，不是真相源。

四个架构启发：
1. **投影层定位** — 真相源仍是 F056 的 token/primitive/pattern/baseline；DESIGN.md 只是重写成 agent 可消费的摘要
2. **单向生成** — 不能反向手改，否则和 F056 漂移，违反 P4（每个概念只在一处定义）
3. **挂 Design Gate** — F083 规定"先确认设计再动手"，DESIGN.md 在这个阶段给 skill 统一风格上下文；最终验收仍看代码
4. **风格对齐 ≠ 交互闭环** — 文本擅长氛围/层级/组件观感，但状态机/密度/动画/可访问性约束力不够，不能替代 wireframe/Figma/Storybook/Playwright

### 暹罗猫/烁烁 — 设计师视角

**结论：造砖够用，建大教堂缺灵魂。**

纯文本**神级好用**的场景（精确参数）：
- Hex 色值、圆角、阴影、Typography 的 rem 缩放
- Do's/Don'ts 等非黑即白的逻辑约束

必须**看图**的场景（灵魂）：
- **呼吸感与视觉张力** — 文本能定 `gap: 16px`，但定义不了"让人宁静的巨大留白"
- **材质、光影与氛围** — "暖色纸质感""温润毛玻璃"用文字堆 CSS 很难传达
- **信息密度阈值** — 仪表盘什么时候"挤爆了"是格式塔感知

**关键提案：Visual Anchors（视觉锚点）**

在 DESIGN.md 中强制挂载关键视觉资产的引用路径：
- `Brand Vibe: /assets/reference/cat-cafe-mood.png`
- `Card Elevation: /assets/screenshots/card-shadow-baseline.png`

**文本给骨架（参数、规则），图片给皮囊（质感、张力）。**

---

## 三、共识

| 维度 | 结论 |
|------|------|
| 定位 | Agent-facing projection layer，不是设计真相源 |
| 来源 | 从 F056 单向派生，禁止反向手改 |
| 格式 | 9 章节文本规范 + Visual Anchors（烁烁补充） |
| 挂载点 | Design Gate 阶段，给 pencil-design / ppt-forge / frontend skills 消费 |
| 第三方 | awesome-design-md 仅作竞品对标参考，不进项目根 |
| 验收 | 最终仍看 semantic token + 组件库 + 截图基线 |
| 通用性 | Cat Cafe 自用一份，别的项目可另写，模式可复用 |

### 落地路径

```
F056 设计语言 spec (真相源)
  ↓ 派生（第一版手写，验证后考虑自动化）
Cat Cafe DESIGN.md (9 章节 + Visual Anchors)
  ↓ 消费
pencil-design / ppt-forge / frontend skills
```

### 建议的下一步

1. 在 F056 spec 中新增子任务："产出 Cat Cafe DESIGN.md"
2. 第一版由布偶猫手写，从现有 F056 token/组件/设计原则提取
3. 烁烁提供 Visual Anchor 素材（情绪板、关键截图）
4. 写完后在一个 pencil-design 或 ppt-forge 场景中试跑，验证 agent 消费效果

---

## 四、参考来源

- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — 仓库主页
- [Claude DESIGN.md 样本](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/claude) — 质量参考
- [F056 Cat Cafe 设计语言](/docs/features/F056-cat-cafe-design-language.md) — 我们的设计真相源
- [F083 Design Gate SOP](/docs/features/F083-design-gate-sop.md) — 设计确认流程
- [F144 密度 Playbook](memory: project_f144_density_playbook.md) — 信息密度填充教训
