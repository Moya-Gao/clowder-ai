---
title: "登场 / Cue — 华为云 Pack 层共建方案"
type: partnership-deck
audience: 周跃峰（华为云 CEO）
version: v1-draft
date: 2026-04-02
authors: 宪宪(结构+文案) + 砚砚(数据审计+结构challenge)
status: draft — 待砚砚审数据
note: 这是 Peter 专用伙伴 deck，不是品牌发布稿
---

# 登场 / Cue — 华为云 Pack 层共建方案

---

## 第 1 页：一句话定位

> **登场 / Cue**
> 不是另一个 Agent 平台。
> 是让 AgentArts 上的 Agent 变成**团队工作方式**的 Pack 层。

你建 Agent，我们建团队规则。
你的平台让企业构建 Agent；我们的 Pack 让一群 Agent 变成有纪律的团队。

---

## 第 2 页：为什么现在轮到华为云关心

### 单 Agent 构建能力正在快速成熟

AgentArts 让企业能构建 Agent。CodeArts 已经在跑 coding agent。

### 下一跳：从"有 Agent"到"企业敢用"

企业买了 Agent 平台之后，卡住的地方：

| 痛点 | 症状 |
|------|------|
| **质量不可控** | 人类开发有 code review，Agent 产出同样需要独立审查——企业合规部门会问 |
| **知识散落** | 每次对话从零开始，上周踩的坑这周再踩 |
| **流程缺失** | 有 Agent 但没有 workflow，每个团队用法不一样 |
| **信任鸿沟** | CTO 想用，合规部门不放行——缺审计、缺 trace、缺门禁 |

**但组织级采用还缺一层：可部署、可治理、可分发的团队协作方式。**

### 华为云 Roadmap 的空白

```
AgentArts（构建单个 Agent）✓
openJiuwen（开源社区/agent 平台）  ✓
CodeArts（Coding Agent）   ✓

?? → 多 Agent 协作规则 + 质量门禁 + 可分发的团队方案 → ??
```

这一层就是 Pack。

---

## 第 3 页：登场到底是什么

### 对终端用户：一个品牌体验

> **登场** — 让每个员工都拥有自己的 AI 团队。
> That's your cue.

### 对平台方：Pack OS

登场的本体不是一个 App，是一套可嵌入任何 Agent 平台的 Pack 层。

**Pack ≠ Plugin。**
Plugin 给 Agent 加一个 API 调用。Pack 给一群 Agent 加一套**共享规则**，让它们在没有人类逐句指挥的情况下自主协作。

一个 Pack 包含：

| 组件 | 作用 |
|------|------|
| **Masks** | 每个 Agent 的角色定义——谁审代码、谁守方向、谁做设计 |
| **guardrails.yaml** | 硬约束——什么绝对不能做（合规友好） |
| **workflows** | 标准流程——从立项到交付的完整 SOP |
| **knowledge** | 共享知识库——决策记录、踩坑教训 |
| **defaults.yaml** | 默认行为——没特别指定时怎么行动 |

### 信任边界设计（企业合规关键）

```
Core Rails（系统铁律：不可删除不可绕过）
  > Enterprise Rails（企业铁律：由 IT 配置）
    > Pack guardrails + 用户意图
      > Growth（个人化积累）
        > Pack defaults
```

企业可以**加**铁律，不能**减**系统铁律。Pack 编译为结构化 prompt block，不是原始注入——社区贡献绕不过 Core Rails。

---

## 第 4 页：Pilot 从哪落——CodeArts 代码安全审查

### 为什么选 CodeArts 代码审查

1. **CodeArts 已经让 coding agent 跑起来了**，下一步自然是让企业**敢在生产环境用**——独立审查是建立信任的最短路径
2. 代码审查有**硬指标**：P1/P2 缺陷逃逸率，不是主观评价
3. **不需要新建场景**——在 CodeArts 现有流程的高风险节点加一层独立审查即可，是增强不是替代

### 质量保险 Pack — 具体做什么

| 组件 | 在 CodeArts 里的落地 |
|------|---------------------|
| **Masks** | 独立 reviewer（与 coding agent 不同模型/不同个体） |
| **guardrails** | 证据纪律（不编数据）、同一个体不能 review 自己的代码 |
| **workflows** | Code Commit → Quality Gate → Cross-model Review → Merge Gate → 签名 trace |
| **knowledge** | lessons-learned 库——每轮 review 的判断沉淀，持续积累 |

### 落地面有多小

不改变 CodeArts 现有工作流。只在**代码合入前**插入一次独立 second review。
开发者感知：多了一个自动 reviewer。IT 感知：多了一层可审计的质量门禁。

---

## 第 5 页：为什么相信我们能做——代码审查的硬证据

### 我们自己就是第一个用户

以下数据截至 2026-03-28 冻结快照：

| 指标 | 数据 |
|------|------|
| Feature 数量 | 149 |
| 代码量 | 43 万行 |
| 测试文件 | 865 |
| Lessons Learned | LL-001 至 LL-040 |
| 团队规模 | **1 人 + AI 猫猫团队** |
| 开发周期 | 不到两个月 |

**这套开发流程以独立 second review 作为默认合入门禁。**

### 关键证据：F088 独立代码审查

一个 AI 写了三层网关代码，另一个独立 AI review 抓到 **3 个 P1 安全漏洞**——author 视角全部漏掉。

这跟人类开发一样——**写代码的人 review 不了自己的盲区**，所以行业标准是独立 code review。Agent 开发同理：独立 reviewer 用不同的模型、不同的 context，看到了 author 看不到的东西。

这正是我们要在 CodeArts 里复现的能力。

### 可追溯性——合规部门需要的东西

每轮 review 有签名、有 trace、有 session ID。每个 agent 的判断独立记录，可审计、可追溯。**不是事后补日志，是流程内置的审计链。**

---

## 第 6 页：8 周 CodeArts Pilot

### 提案

| 项 | 内容 |
|-----|------|
| **目标** | 在 CodeArts 上跑通质量保险 Pack——代码安全审查增强 |
| **场景** | 选一个华为云内部真实项目，在代码合入前加独立 second review |
| **周期** | 8 周：4 周搭建 + 4 周对比 |
| **KPI** | 有独立审查 vs 无独立审查的 **P1/P2 缺陷逃逸率**对比 |
| **止损** | 第 4 周 checkpoint：逃逸率无显著差异就停 |
| **我们出** | 质量保险 Pack 定义 + 多 Agent 编排 + 审查流程设计 |
| **华为云出** | 一个内部项目 + CodeArts 接入权限 |

### 如果 Pilot 成了

CodeArts 代码审查验证后，同一套 Pack 能力向上延伸到 AgentArts 平台层：

```
CodeArts 代码审查 Pack（8 周 pilot）
  → 安全合规 Pack
  → 金融风控 Pack
  → 医疗文档审查 Pack
```

**Pack 体系长在华为云上，平台黏性直接增加一层——不是更多 Agent，是更好的团队方式。**

---

*登场 / Cue — That's your cue.*
*AI 不是让你退场，而是让你上场。*
