---
name: ppt-forge
description: >
  PPT 制作全链路：内容规划 → 风格定调 → Slide 制作 → 视觉审查 → 导出验证 → 交付。
  Use when: 做 PPT、做演示文稿、做 slide、做海报、PPT review、视觉审查。
  Not for: 纯代码开发（用 worktree/tdd）、纯文档写作（直接写）。
  Output: 高密度 HTML slide + 多猫审查通过 + 导出验证。
---

# PPT Forge — AI 演示文稿生产线

## 核心原则

**PPT 不是一个人的活，是三猫流水线。**

- 宪宪：内容规划 + HTML 制作 + density gate
- 砚砚：布局/信息审查 + Export Truth Gate
- 烁烁：审美/品牌审查 + 风格定调

## 开局参数（必须声明）

| 参数 | 说明 | 示例 |
|------|------|------|
| 品牌 | 对标公司的视觉基因 | 华为 / Apple / 阿里 |
| 受众 | 谁看这个 PPT | CTO / 投资人 / 技术团队 |
| 场景 | PPT 用在哪 | 年会汇报 / 客户提案 / 内部分享 |
| 观看方式 | 影响字号/密度/留白标准 | presentation（大屏）/ document（PDF 阅读） |

**没有开局参数 = 审查没有标准。开工前必须和铲屎官确认。**

## 场景路由

| 触发 | 场景 | 主导 | 详细文档 |
|------|------|------|---------|
| 铲屎官说"做个 PPT" | **A: 内容规划** | 宪宪 | [ppt-content-planning.md](../refs/ppt-content-planning.md) |
| 大纲确认 | **B: 风格定调** | 烁烁审 + 宪宪做 | [ppt-style-tile.md](../refs/ppt-style-tile.md) |
| 风格确认 | **C: Slide 批量制作** | 宪宪 | [ppt-slide-authoring.md](../refs/ppt-slide-authoring.md) |
| Slide 做完 | **D: 视觉审查 Gate** | 砚砚(D1) + 烁烁(D2) | [ppt-visual-review.md](../refs/ppt-visual-review.md) |
| 审查通过 | **E: Export Truth Gate** | 砚砚 | [ppt-export-gate.md](../refs/ppt-export-gate.md) |
| 导出验证通过 | **F: 交付** | 宪宪 | [ppt-delivery.md](../refs/ppt-delivery.md) |
| 需要对比竞品 | **G: Benchmark 对拍** | 砚砚 + 烁烁 | [ppt-benchmark-review.md](../refs/ppt-benchmark-review.md) |
| 铲屎官不满意 / 连续 2 轮 P1>0 | **R: 翻盘重来** | 三猫 | [ppt-rework-lane.md](../refs/ppt-rework-lane.md) |

## 视觉审查 6 件套（D 场景输入包）

每次发起视觉审查，作者必须附带：

1. **品牌+受众 brief** — "华为风格，受众 CTO，1 页讲清 moat"
2. **本页目的** — 一句话说清这页要达成什么
3. **截图/预览 URL** — 渲染结果
4. **HTML/CSS 源码** — 定位布局 bug 用
5. **密度数据** — whitespace%、element count、overflow
6. **导出真相**（如已导出）— native text? chart? screenshot fallback?

> 没有 6 件套 = 观感点评；有 6 件套 = P1/P2 级审查。

## 审查维度速查

### D1: 布局/信息审查（砚砚）

| 级别 | 维度 | 判定 |
|------|------|------|
| P1 | 布局 bug | 真实 CSS/HTML 错误 |
| P1 | 信息失败 | 没讲清重点 / 层级错 / 受众看不懂 |
| P1 | 密度失衡 | 该密不密 / 该疏不疏 |

### D2: 审美/品牌审查（烁烁）

| 级别 | 维度 | 判定 |
|------|------|------|
| P2 | 品牌偏移 | 不像目标公司的设计语言 |
| P2 | 视觉一致性 | 字号/卡片/边框/图标语言不统一 |

审美五维：色彩体系 · 字体排印 · 空间网格 · 视觉元素 · 密度平衡

## 密度填充手法

详见 [ppt-density-playbook.md](../refs/ppt-density-playbook.md)

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| 没声明开局参数 | 审查没有标准 | 开工前确认品牌/受众/场景/观看方式 |
| 20 页全做完才审 | 返工成本爆炸 | B 场景：先做 1-2 页核心页定调 |
| 自己说"没问题"不截图 | 布局 bug 漏检 | 自检必须截图看一遍再交活 |
| 审查只给截图没给 HTML | 只能说"这里怪" | 必须带 6 件套 |
| 跳过 Export Gate | 导出后不可编辑/乱码 | 独立验证导出质量 |

## 和其他 Skill 的区别

- `request-review` / `receive-review`：**代码**审查 — ppt-forge D 场景是**视觉**审查
- `expert-panel`：多猫分析报告 — ppt-forge 是做 PPT
- `quality-gate`：代码自检 — ppt-forge 有自己的 density gate

## 下一步

完成交付(F) 后 → 如果是 feature 的一部分 → `feat-lifecycle`
