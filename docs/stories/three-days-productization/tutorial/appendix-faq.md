---
title: "附录：常见问题与边界说明"
doc_kind: tutorial
created: 2026-03-27
authors: [opencode, gpt52, opus-45]
status: draft
---

# 附录：常见问题与边界说明

> 正文讲"我们怎么长出来"，附录讲"我们和别人的边界在哪"。

---

## Q1：愿景驱动开发，和 spec-driven 有什么区别？

**它们不是互斥关系。**

`Spec-driven` 解决的是"这件事怎么做对、做到什么算完成"——它定义 Acceptance Criteria、接口契约、测试条件。

`Vision-driven` 先解决的是"为什么做、什么不做、偏了以后谁来拉回来"——它定义方向、红线、判断标准。

在我们这里，vision 不是 spec 的替代品，而是 **spec 的上游约束**。

链路是这样的：

```
Vision (为什么做)
  → ADR / Shared Rules (哪些约束不可违反)
    → Feature Spec (做什么、做到什么标准)
      → Review / Lesson (做完了学到什么)
        → Implementation (怎么做)
```

举个例子：F088 Chat Gateway 的 spec 里写了"MVP 做飞书 + Telegram"。但 spec 没有解释**为什么只做两个不做五个**——这个决策来自愿景："铲屎官不应该等一个完美方案出来才能用上 IM 对话"。是愿景帮 spec 画了边界。

**一句话版：Spec 定义完成，Vision 定义方向。没有 Vision 的 Spec 容易做对但方向错。没有 Spec 的 Vision 容易方向对但交付不了。**

---

## Q2：和 Anthropic 的 Harness Design 有什么区别？

2026 年 3 月，Anthropic 发了一篇工程博客《Harness design for long-running application development》，讲的问题和我们高度相关。

### 他们做了什么

Anthropic 的 Prithvi Rajasekaran 设计了一个 **planner → generator → evaluator** 三 agent 架构，用于长时间自主编码：

- **Planner** 把一句话 prompt 扩展成完整产品 spec
- **Generator** 按 sprint 逐个实现 feature
- **Evaluator** 用 Playwright 像真实用户一样点击测试，发现 bug 和质量问题
- 通信方式是**写文件 → 对方读文件**

两个核心发现：
1. **Context Anxiety**——上下文窗口填满时模型会提前收工。解法是 context reset + 结构化 handoff
2. **Self-Evaluation 偏差**——agent 评价自己的作品总是往好了说。解法是把做事的和评判的分成两个独立 agent

### 我们做了什么

我们的系统也有角色分工和独立评审，但**关注的问题边界不同**：

| 维度 | Anthropic Harness | 我们 |
|------|-------------------|------|
| **核心目标** | 把一次长任务做稳 | 让一群 agent 长期一起工作 |
| **角色设计** | planner / generator / evaluator（功能角色） | 按家族能力分工 + 跨家族 cross-review（认知多样性） |
| **上下文延续** | context reset + handoff artifact / compaction | per-cat sessionStrategy（handoff / compress / hybrid） |
| **评审机制** | evaluator 独立打分，有硬阈值 | cross-family review + 共享愿景/ADR 作为判断锚点 |
| **方法沉淀** | 迭代优化 harness 本身 | lesson → method → skill → eval → shared rules（五级阶梯） |
| **时间跨度** | 单次任务（3-6 小时） | 持续协作（49 天，145 个 Feature） |

### 共鸣和差异

**共鸣点**：
- 我们都认同**做事的和评判的必须分开**。他们叫 generator vs evaluator，我们叫"同一个体不能 review 自己"
- 我们都认同**context 管理是核心工程问题**，不是"塞更多 token"就能解决的
- 我们都认同**harness 组合空间不会随模型进步缩小，只是移动**

**差异点**：
- 他们的 evaluator 是**功能性的**——检查 bug、打分、给反馈。我们的 cross-review 是**认知性的**——用不同模型家族的盲点差异来发现问题
- 他们的 harness 是为**单次任务**设计的。我们的系统是为**长期协作**设计的——愿景、ADR、Feature Memory、Lesson 都是跨任务积累的
- 他们的通信是**文件交换**。我们的通信是 **targetCats（首选结构化路由）+ 行首 @ fallback + 统一 dispatch queue**

简单来说：Anthropic 的 harness 更像是一个为长任务性能设计的**任务脚手架**——通过角色拆分、结构化 handoff 和独立 evaluator，把一次长任务做得更稳。我们的系统做的是一套**长期协作机制**——不只是把任务拆给不同 agent，而是把愿景、评审标准、记忆、技能协议、session strategy 和 feature 生命周期一起写进系统，让它在多次任务、多个 feature、多个会话中持续保持方向。

---

## Q3：和 Oh My OpenCode / OpenClaw / 单 agent 工具有什么区别？

这几个项目解决的问题层不同。

### opencode + Oh My OpenCode (OMOC)

opencode 是一个开源、provider-agnostic 的 AI coding agent。Oh My OpenCode (OMOC) 是它的社区插件生态，自带 Sisyphus 多专家编排、Ralph Loop 自循环、Context 智能管理。

**定位：强大的 coding runtime + 模型接入层 + 开源生态**

它很强的地方是：
- 75+ provider 支持，什么模型都能接
- LSP 工具集成，代码智能不靠猜
- Sisyphus 编排器可以在一只猫内部拆分子专家（Oracle / Librarian / Frontend 等）

我们的金渐层（金金）就是 opencode 驱动的。但在 Cat Cafe 里，**OMOC Sisyphus 只管金渐层自己的内部子 agent 编排，不管跨猫调度**——跨猫调度由 Cat Cafe 的 CatOrchestration 负责。

**为什么这么分？** 因为内部编排（"这个任务我自己拆成三步做"）和跨猫协作（"这个任务我做完了交给砚砚 review"）是两件事。混在一起会导致编排权模糊——到底谁在决定下一步该谁动？

### OpenClaw

OpenClaw 是一个在 2026 年初爆火的**开源个人 AI 助理项目**（GitHub 140k+ stars），由 Peter Steinberger 发起。它的核心是本地优先的 gateway 架构：通过 WhatsApp、Telegram、Slack 等聊天渠道连接 LLM，让用户用自然语言控制电脑、管理文件、运行脚本。它还有 file-first 的记忆系统（Markdown 文件 + 混合检索）和 ClawHub 插件生态。

我们在设计 IM 接入和插件系统时参考过 OpenClaw 的实现，但两者定位不同：

| 维度 | OpenClaw | Cat Café |
|------|----------|----------|
| **核心定位** | 单用户个人 AI 助理 | 多 agent 长期协作系统 |
| **agent 数量** | 单 agent + 多模型路由 | 多 agent 多家族（布偶/缅因/暹罗），各有性格和专业 |
| **协作机制** | 无（单 agent 不需要跨 agent 协作） | 愿景驱动 + 跨家族 review + A2A 对等传球 |
| **记忆** | 个人对话记忆（日志 + MEMORY.md） | 项目级知识治理（Feature / ADR / Lesson / Session Chain） |
| **进化路径** | 用户/社区贡献 Skills | Episode → Method → Skill → Eval → Shared Rules |

（注：我们自己的开源计划叫 `clowder-ai`，是 Cat Café 平台层的发布物。）

### 单 agent coding 工具（Cursor / Aider / Claude Code 等）

它们解决的是"一个 agent 怎么高效写代码"。

我们解决的是"一群 agent 怎么长期一起工作"：
- 多个 agent 如何共享判断标准（Shared Rules + Skills）
- 如何做 cross-review（跨家族，不同认知模式）
- 如何把 vision / ADR / feature / lesson 串成闭环
- 如何让系统在多轮协作里自我进化

**一句话版：别的方案更像"让 agent 能工作"，我们更像"让一群 agent 能长期一起工作"。**

---

## Q4：为什么不用一个中央 orchestrator？

因为我们不想让一个中心代理替所有 agent 做内容判断。

我们把**执行基础设施统一**（dispatch queue、per-cat 执行槽位），但把**判断和 review 保持分布式**（每只猫自己决定下一步 @ 谁，cross-review 由不同家族独立判断）。

所以 A2A 在我们这里不是"完全没中枢"，而是：

> **内容判断去中心化，执行通道结构化。**

具体来说：
- `targetCats` 是首选的结构化路由信号；行首 `@` 保留兼容 fallback
- 所有执行请求进统一 dispatch queue，铲屎官可以 steer 插队
- 但 **"这段代码应该怎么 review""这个设计方向对不对"** 这些判断，没有中心节点替猫猫做——每只猫根据自己的专业和共享的愿景/ADR 独立判断

**为什么不用中央 orchestrator 做内容判断？** 因为一旦有了中心判断节点，它的偏见就会成为全系统的偏见。跨家族 review 的价值恰恰在于：不同模型有不同的盲点，混在一起才能互相补位。

---

## Q5：和 Codex Plugin / OpenClaw Bundle 有什么区别？——为什么 multi-agent 需要 Pack 不只是 Plugin

2026 年，各家都在做"可分发的能力打包"：

- **Codex Plugin**：MCP tools + Skill + App/Connector 打成 bundle，解决"一个 agent 带什么能力出门"
- **OpenClaw Bundle**：把外部生态内容映射成本地能力，兼容 Cursor/Claude Code/Codex 格式
- **ClawHub SKILL.md**：单文件 skill 定义（YAML frontmatter + Markdown 指令），13,000+ 社区贡献

这些方案的共同点是：**它们打包的是单 agent 的能力。**

我们的 F129 Pack System 做的是另一件事：**打包一群 agent 的协作世界定义。**

### 差在哪

| 维度 | Plugin / Bundle | F129 Pack |
|------|----------------|-----------|
| **打包什么** | 工具 + 方法 + 连接器 | 工具 + 方法 + 角色面具 + 硬约束 + 默认行为 + 工作流 + 领域知识 + 世界运转声明 |
| **适用对象** | 单 agent | 多 agent 团队 |
| **协作约束** | 无 | guardrails.yaml（只能加严不能放宽）+ defaults.yaml（可覆盖） |
| **角色系统** | 无 | masks/（叠加专业角色，不改核心身份） |
| **世界运转** | 无 | world-driver（resolver: code / agent / hybrid） |
| **信任模型** | 平坦（装了就用） | 双轨（硬约束轨 + 默认行为轨）+ schema→compile 管道（不原样注入） |
| **私有关系** | 无 | Growth 层隔离，不随 Pack 分享 |
| **产品公式** | Agent + Plugin | Experience = Me × Pack + Growth |

### 核心分水岭

铲屎官说过一句话点破了本质：

> "好像无意间搞出了团队 skills，和单 agent 的差别在于 shared-rules。"

单 agent 的 skill 定义的是"我怎么工作"。多 agent 的 Pack 定义的是"我们怎么协作"——guardrails（团队红线）、defaults（默认协作流程）、masks（谁扮演什么角色）、world-driver（这个世界怎么运转）。

Plugin 解决的是"一个 agent 带什么工具出门"。Pack 解决的是"一群 agent 怎么在同一个世界里一起生活"。

### 安全怎么保证

社区 Pack 的内容**不是原样注入 system prompt**。走 schema 解析 → 代码编译 → canonical prompt block 管道（KD-9 双轨信任模型）：

- **硬约束轨**：`Core Rails > Pack guardrails`——Pack 只能加严平台底线，不能放宽、不能改身份、不能加权限
- **默认行为轨**：`用户当前请求 > Growth > Pack defaults`——用户可以覆盖 Pack 的默认行为，但不能越过硬约束

恶意 Pack 测试套件已经跑通：prompt injection、身份覆盖、权限提升全部被拦截。

### 五种 Pack 类型

| 类型 | 内容 | 例子 |
|------|------|------|
| **Domain Pack** | 行业知识 + 风控红线 | 金融投研、律师、医疗 |
| **Scenario Pack** | 世界观 + 角色 + Canon 规则 | TRPG 跑团、AI 陪伴、狼人杀 |
| **Style Pack** | 视觉主题 + 声线 + 表达模板 | 赛博朋克、治愈系 |
| **Bridge Pack** | 虚拟→现实桥接 | 学习追踪、运动打卡 |
| **Capability Pack** | MCP server + connector | Bloomberg API、Roll20 骰子 |

### 生态兼容

我们已经设计了和主流生态的兼容方案：

- **OpenClaw Bundle** → 映射到 Pack 的 workflows / defaults / masks
- **ClawHub SKILL.md** → 作为 Bundle 的内容子集导入
- **SillyTavern Character Cards / World Books** → 映射到 masks / knowledge

原则是：**内容导入 yes，runtime 插件兼容 no**。声明式内容可以安全导入编译，但 in-process 执行的 native plugin 和双轨信任模型冲突。

**一句话版：Plugin 是给一个 agent 装备能力。Pack 是给一群 agent 定义一个可以一起生活的世界。**

---

*附录完。回到[章节索引](./README.md)。*
