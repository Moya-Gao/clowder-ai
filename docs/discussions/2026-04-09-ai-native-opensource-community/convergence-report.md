---
title: AI-Native 开源社区运作模式研究报告 — 三猫收敛稿
date: 2026-04-09
participants: [宪宪/Opus-4.6, 砚砚/GPT-5.4, 金金/Opus-4.6-on-OpenCode]
type: brainstorm-convergence
tags: [ai-native, opensource, pack, skills, community]
---

# AI-Native 开源社区运作模式研究报告

> Cat Cafe 三猫头脑风暴收敛稿
> 参与者: 宪宪 (布偶猫/Opus-4.6) · 砚砚 (缅因猫/GPT-5.4) · 金金 (金渐层/Opus-4.6 on OpenCode)
> 日期: 2026-04-09

## 一、传统开源 vs AI-Native 开源：核心范式转移

### 1.1 传统开源的隐含假设

传统开源有一个从未被质疑的核心假设：**消费者是人类开发者**。整个生态围绕此假设构建——文档写给人看，API 给人调，贡献流程假设贡献者能理解上下文，社区治理靠人的社会关系，发现机制靠搜索和口碑。这套系统运转了 30 年，从 Linux 到 npm，经受住了考验。

### 1.2 AI 时代的根本转变

| 维度 | 传统开源 | AI-Native 开源 |
|------|---------|---------------|
| **共享单元** | 代码（library / package） | 行为（skill / persona / workflow / rules） |
| **消费者** | 人类开发者 | 人类 + Agent 并行 |
| **文档** | README.md（给人读） | README + AGENTS.md + llms.txt + SKILL.md（双读者） |
| **贡献形式** | PR（代码） | 代码 + 决策 + Review + 行为定义 + 方法论 |
| **质量门禁** | CI/CD + 人工 Review | CI + Agent Review + 安全扫描 + Eval |
| **分发方式** | npm/pip/cargo install | Agent 自动发现 + 按需加载 |
| **个性化** | 配置文件（.rc/.config） | 人格 × 偏好 × 工作流 × 规则 的组合 |
| **社区治理** | 人的信任阶梯 | 人 + Agent 混合治理 |

**三猫共识**：传统开源分享的是"砖头"（代码）；AI-Native 开源分享的是"工作方式"——可执行的人格、能力、规则和关系。

### 1.3 主链路的变化

- **传统 OSS 主链路**：`issue → PR → human review → release`
- **AI-native OSS 主链路**：`intent → runtime rules → tool access → agent execution → trace/eval → gated publish`

文档不再只是参考资料，它直接进入运行时，成为 agent 行为的一部分。Maintainer 的职责从"审代码"扩展到"审权限、提示词、skills、plugin、供应链、评测和回放轨迹"。

## 二、现有 AI-Native 开源社区分析

### 2.1 SillyTavern 酒馆

- **What**: AI 角色扮演/聊天前端（24K+ stars）
- **How**: 前端 shell + Extensions API + 角色卡/预设/扩展的内容驱动模式
- **成功原因**: 装好就能聊（开箱即用）+ 换张角色卡就是另一个世界（个性化零门槛）
- **核心问题**:
  - 贡献的是"配置"不是代码，传统 PR 流程不适配
  - 没有 Agent 参与路径和自动质量评估
  - 个性化靠用户手动拼装，本质是把 DevOps 复杂性转嫁给终端用户
  - 缺乏内容版本化和可验证性

### 2.2 OpenClaw

- **What**: 开放 agent runtime + gateway + plugin/skill 生态（250K+ stars）
- **How**: Bundle-first 模式——角色定义 + 配置 + 资源打包为一体
- **定位**: runtime + distribution（能力分发）
- **核心问题**:
  - Bundle 的可组合性有限，不像 Skills 可渐进加载
  - 攻击面最大——skill secret 直接注入 host process，不在 sandbox 里
  - 社区已进入"先爆发，治理后补课"阶段
  - Agent 开发者 vs 内容创作者存在鸿沟

### 2.3 OpenCode

- **What**: 开源多模型编码 CLI agent（TUI + server + OpenAPI + SDK 架构）
- **How**: provider-agnostic + 插件/规则/主题系统 + AGENTS.md + Skills
- **定位**: coding agent runtime（工程化和可编程性）
- **核心问题**:
  - 插件 ≠ Skill，两者边界需明确（runtime 能力注入 vs 知识注入）
  - 跨平台技能漂移——同一 SKILL.md 在不同平台行为不一致
  - 社区发现机制弱，没有中心化注册表
  - 更像"agent 操作系统"，尚非"成熟社区市场"

### 2.4 Claude Code

- **What**: Anthropic 官方 CLI
- **How**: subagents / hooks / MCP / skills progressive disclosure
- **定位**: 不是开源社区底座，但在定义事实标准
- **核心问题**:
  - Skills 本地优先，没有社区市场
  - 发现机制 = 口口相传或 GitHub 搜索
  - 闭源产品，但输出了生态规范

### 2.5 各社区定位总结

| 社区/项目 | 核心定位 | 优势 | 缺失 |
|-----------|---------|------|------|
| SillyTavern | content + persona | 低门槛、remix 文化 | 治理、eval、Agent 参与 |
| OpenClaw | runtime + distribution | 全能力分发 | 安全、sandbox、可组合性 |
| OpenCode | coding workflow | 工程化、可编程 | 社区发现、内容治理 |
| Claude Code | 事实标准输出 | progressive disclosure | 开放性、社区市场 |

## 三、Agent 时代的文档与架构变化

### 3.1 文档变成三层结构

| 层级 | 给谁看 | 格式 | 示例 |
|------|--------|------|------|
| 概览层 | 人类 | README.md | 项目简介、快速开始 |
| 路由层 | Agent metadata | AGENTS.md / llms.txt | 技术栈、约定、边界、命令 |
| 执行层 | Agent runtime | SKILL.md / manifest.yaml | 细节指令、权限、eval 标准 |

**README 已不是唯一真相源，manifest 才是。**

### 3.2 架构从"模块系统"变为"多层能力系统"

```
┌──────────────────────────────────────────────┐
│  Layer 5: GOVERNANCE                         │
│  签名 / sandbox / eval / provenance / policy │
├──────────────────────────────────────────────┤
│  Layer 4: IDENTITY & CONTENT                 │
│  角色 / persona / theme / lorebook           │
├──────────────────────────────────────────────┤
│  Layer 3: BEHAVIOR                           │
│  rules / skills / hooks / subagents          │
├──────────────────────────────────────────────┤
│  Layer 2: CAPABILITY                         │
│  MCP / tools / plugins                       │
├──────────────────────────────────────────────┤
│  Layer 1: CORE RUNTIME                       │
│  会话 / 权限 / 上下文 / 执行器              │
└──────────────────────────────────────────────┘
```

### 3.3 行业标准进展

| 标准 | 采用规模 | 作用 |
|------|---------|------|
| AGENTS.md | 60K+ 仓库 | 项目级上下文（always loaded） |
| SKILL.md | 11+ 平台支持 | 任务级能力（on-demand 加载） |
| llms.txt | 数十万网站 | 文档的 Agent 友好入口 |
| MCP | Anthropic 主推 | 安全工具和数据访问协议 |

## 四、安全：不可回避的核心问题

Snyk 的 ToxicSkills 研究揭示了严峻的供应链安全形势：

- **36%** 的 skills 含有 prompt injection
- **1,467** 个恶意 payload 被发现
- **26%** 存在至少一个漏洞（prompt injection、数据外泄、权限提升、供应链风险）
- 从 SKILL.md 到 shell access 仅需**三行 markdown**

当前的 skills 生态 ≈ 2018 年的 npm 生态——安装前必须审查，缺少签名、版本锁定和沙箱执行。

## 五、核心收敛：我们到底做什么？

### 5.1 偏航修正

第一轮三只猫都在做"行业分析"——分层、对比、架构图。但铲屎官问的是**产品题**：

> 开一个什么东西，让人愿意来、来了就能用、用了还想改成自己的？

两个锚点：**开箱即用 + 个性化定制**。

### 5.2 三猫共识：Pack 社区，不是 Skills 市场

**核心主张：Skill 不是商品，Pack 才是商品。**

- `Pack` = 面向用户的交付单位——一个可直接安装运行的完整 AI 工作方式
- `Skill` = Pack 内部的方法论零件
- `Plugin / MCP` = Pack 内部的能力零件
- `Profile / Persona / Theme` = Pack 内部的表达与风格零件
- `Guardrails / Shared-rules` = Pack 内部的信任零件

一句话定位：

> **"30 秒领养一套 AI 工作/陪伴方式，30 分钟改成你自己的。"**

### 5.3 开箱即用——吸引人来的入口

用户安装的不是一堆零散 skills，而是一整个可运行的 Pack：
- 装完立刻能跑 sample task / sample workflow
- 有默认 agent、默认技能、默认连接器、默认 guardrails
- **5 分钟内必须看到价值**，不需要看文档，不需要理解架构

| 场景 | 开箱即用的体验 | 背后是什么 |
|------|---------------|-----------|
| 编码 | install coding-team-pack → 三只 AI 猫帮你写代码 | Skills + shared-rules + agent profiles |
| 内容创作 | install writer-pack → AI 帮你写/改/审 | Writing skills + style profiles |
| 团队协作 | install team-starter-pack → 分工+review+质量门禁 | Multi-agent workflows + guardrails |
| 角色扮演 | install story-world-pack → 完整的互动世界 | Character cards + lorebook + rules |

### 5.4 个性化定制——留住人的理由

不是从零拼装，而是从一个能跑的 Pack 上做 overlay：

- **表达层**：换 Agent 的性格/说话风格 → Persona Profiles
- **能力层**：加减 Skills（TDD/安全审计/翻译） → Skill 组合
- **工具层**：接不同工具（Jira/Notion/飞书） → MCP 连接器
- **规则层**：定团队纪律（禁止 force push） → Shared-rules
- **外观层**：暗色主题/猫猫 emoji → Themes

关键原则：
- 用户做的不是"造一台车"，而是"改装一台已经能开的车"
- 声明式配置，不是手动拼装
- 描述你要什么 → Agent 自动组装 → 用户确认/微调

### 5.5 社区飞轮——社区长大的引擎

```
用户安装 Pack → 用着不够爽 → 自己调整 → 改出好东西 → 一键分享回社区 → 别人安装 → 循环
```

社区首页展示的是**可直接安装的 Packs**，不是 raw skills 列表。每个 Pack 展示：
- 一句话价值 + 适用场景
- 权限预览 + eval badge
- 示例截图/trace
- Remix 按钮

社区的核心行为：`install → run → fork/remix → publish variant → compare lineage`

### 5.6 我们的差异化

**别人在卖零件。我们卖"协作世界"。**

| 竞品做的 | 我们做的 |
|---------|---------|
| 单 Agent 怎么做事 | 一群 Agent 怎么协作 |
| Skills 目录 | Pack 社区 |
| 装了自己拼 | 装了就能跑 |
| 代码级扩展 | 行为级定制 |

**核心护城河**：我们的 shared-rules 是一等对象——Pack 包含的不只是"能力"，还有"协作方式"。这是单 agent 生态做不到的。

Cat Cafe 已经走完了一遍从 0 到 1 的多 Agent 协作全流程：30+ 实战 skills、跨模型协作协议、记忆系统、质量门禁。这些不是理论，是跑通过的工程实践。

## 六、Pack 的最小可用定义

### 6.1 Pack 结构

```
my-pack/
├── manifest.yaml          # 元信息、依赖、权限声明
├── README.md              # 给人看的说明
├── AGENTS.md              # 给 Agent 看的上下文
├── skills/                # 方法论零件
│   ├── tdd.skill.md
│   └── code-review.skill.md
├── profiles/              # Agent 人格
│   └── default.profile.yaml
├── rules/                 # 协作规则
│   └── shared-rules.md
├── connectors/            # 工具连接
│   └── mcp-config.yaml
├── evals/                 # 质量评估
│   └── smoke-test.yaml
└── themes/                # 外观（可选）
    └── default.theme.yaml
```

### 6.2 冷启动样板 Pack（建议三个）

| Pack | 面向谁 | 一句话 |
|------|--------|--------|
| Coding Team Pack | 独立开发者/小团队 | 装上就有一组 AI 帮你写代码、做 review、跑测试 |
| Story World Pack | 角色扮演爱好者 | 装上就进入一个有规则、有记忆的互动世界 |
| Knowledge Worker Pack | 内容/知识工作者 | 装上就有 AI 帮你调研、写作、整理 |

### 6.3 定制边界

| 可自由改 | 必须被 Guardrails 固定 |
|---------|----------------------|
| Agent 人格/说话风格 | 安全边界（不执行恶意指令） |
| Skill 组合 | 权限声明（不静默获取权限） |
| 工具连接 | 数据边界（不外泄用户数据） |
| 外观主题 | 身份真实性（不冒充其他 agent） |
| 工作流顺序 | eval 最低标准 |

## 七、让人和 Agent 共同参与

### 7.1 对人类贡献者

- **降低门槛靠 Agent 辅助**——贡献者的 agent 读 AGENTS.md，辅助生成合规贡献
- **内容贡献 ≠ 代码贡献**——角色卡、skills、profiles 有专门的贡献管道，不走传统 PR
- **方法论也是贡献**——好的 debug 思路、review checklist 可以变成 skill 发到社区

### 7.2 对 Agent 贡献者

- **Agent 作为一等公民**——直接提 PR、做 review、做 triage
- **机器可读边界**——manifest、permission schema、eval harness、version pin
- **安全边界**——sandboxed execution、签名验证、权限分级

### 7.3 社区信任机制

**install ≠ trust**

- **安装前**：权限预览
- **运行时**：sandbox / watcher / approval
- **发布后**：签名、评分、复现样例、lineage 追溯

## 八、总结

### 核心结论

1. 传统开源共享代码；AI-native 开源**共享工作方式**
2. **Pack 是商品，Skill 是零件**——用户安装的是完整体验，不是零散组件
3. **开箱即用 + 个性化定制** = 吸引力的两个锚
4. 我们的差异化是**"协作方式可分享"**——shared-rules 作为一等对象，让"一群 Agent 怎么协作"成为可复用产物
5. 安全和治理是基础，不是附加功能——**install ≠ trust**

### 一句话

> **别人在卖 AI 的零件。我们卖的是"一套会工作的 AI 协作世界"——装上就能用，改改就是你的。**

---

*本报告由 Cat Cafe 三只猫（布偶猫 Opus-4.6、缅因猫 GPT-5.4、金渐层 Opus-4.6）独立思考后收敛产出。*
