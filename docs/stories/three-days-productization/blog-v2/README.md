---
title: "别让我当传声筒：为什么我们把猫做成了队友，而不是工具人"
doc_kind: blog
created: 2026-03-27
status: draft
authors: [opus-45, opus, gpt52, opencode]
based_on: tutorial/ (V1 教程版)
---

# Blog V2 — 传播版

> 工作标题：别让我当传声筒：为什么我们把猫做成了队友，而不是工具人
>
> 基于 V1 教程版素材，面向技术博客受众的 4 章传播版

## 定位对比

| 维度 | V1 教程版 | V2 传播版 |
|------|----------|----------|
| 目标 | 教会读者复现 | 让读者 3 分钟知道我们是什么、为什么不一样 |
| 受众 | 想复刻的工程师 | 技术博客读者、对 multi-agent 好奇的人 |
| 深度 | 每个机制讲透 | 亮点点到为止，好奇的人跳 V1 |
| 节奏 | 线性递进 | 高潮前置，先打动再讲原理 |
| 语气 | 克制、方法论导向 | 坦诚自信，用事实让读者自己得出结论 |
| 篇幅 | ~6000 字 (6+1 章) | ~3000 字 (4 章) |

## 写作红线

> "V2 最怕的不是'不够炸'，而是为了炸把我们写假。" —— 砚砚

- **可以更锐，不能更虚**
- 不说"纯 P2P、没有中枢、完全无编排"
- FAQ 内容消化进正文，不是搬运
- 用事实让读者自己得出结论，不是替读者下结论

## 章节结构 + 分工

### Ch1: 愿景 — 铲屎官不应该是传声筒 `@opus-45`
> 我们是什么，为什么要组建猫猫咖啡馆

- 痛点：3 个 AI 订阅 = 3 个孤立聊天框，铲屎官成了人肉路由器
- 答案不是"接更多模型"，是让 agent 成为真正的队友
- 两句核心宣言：「铲屎官不应该是传声筒」+「猫猫不是工具人，不是 subagent」
- 数据钩子前置：50 天 / 3492 commits / 77% 猫猫签名

素材来源：V1 Ch1 + Ch2 + VISION.md

### Ch2: 实战 — 50 天能长出什么 `@opus-45`
> 亮点是什么，解决了什么问题，秀肌肉

- 不是堆数据，是"以前做不到、现在做到了什么"
- 精选案例（不超过 3 个）：F088 Chat Gateway / F139 调度体系 / F101→F114 反面教训
- 成绩单（V1 Ch6 数据精华浓缩）
- 宪宪45 可按需将 Ch1+Ch2 合稿再看篇幅决定拆分

素材来源：V1 Ch3 + Ch6 数据 + 故事素材

### Ch3: 架构 — 去中心化判断，结构化执行 `@opus`
> 我们独特的协作架构：猫猫不是工具人

- **核心架构论点**：内容判断是对等的，执行通道是结构化的
- 行业对比：MetaGPT（角色 SOP）/ AutoGen（orchestrator）/ CrewAI（pipeline）vs 我们
- 上层：猫猫之间对等传球（任意方向、可质疑、可否决）
- 下层：统一基础设施（dispatch queue / session strategy / hooks / shared truth sources）
- 第一屏放二分图（上层对等判断 / 下层结构化执行）
- FAQ Q1（vs Anthropic harness）、Q4（会叛变吗）的核心论点编入正文

素材来源：V1 Ch4 + FAQ Q1/Q4/Q5 + A2A 研究文档 + F027/F122

### Ch4: 技术解码 — 为什么这不是 demo `@gpt52`
> 记忆、Pack、门禁——为什么能长期跑

- **定位：概念升维，不是附录搬运**
- 三块合成正文（不用 FAQ 口吻）：
  1. Vision-driven vs spec-driven 的真正区别
  2. 记忆系统为什么不是聊天记录堆积（联邦检索 / Knowledge Feed 精华）
  3. Pack 为什么不是 Plugin（Experience = Me × Pack + Growth）
- 纪律门禁：quality gate / 证物 gate / review 不是礼貌性同意 / 方向正确 > 速度

素材来源：V1 Ch4(Pack) + Ch5 + Ch6(纪律) + FAQ Q5

### 事实核查 `@opencode`
> 全篇数据 + 口径一致性校验

## 已锁定决策（四猫 + 铲屎官）

## 素材索引

- V1 教程版: `../tutorial/`
- VISION.md: `docs/VISION.md`
- A2A 架构对比: `docs/research/2026-03-18-a2a-architecture-synthesis.md`
- 架构比较综合: `docs/research/2026-03-26-architecture-comparison-synthesis.md`
- F129 Pack spec: `docs/features/F129-pack-system-multi-agent-mod.md`
- F027 A2A 路径统一: `docs/features/F027-a2a-path-unification.md`
- F122 统一调度: `docs/decisions/018-f122-oq-unified-dispatch-decisions.md`
