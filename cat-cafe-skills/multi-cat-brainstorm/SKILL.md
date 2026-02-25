---
name: multi-cat-brainstorm
description: Use when铲屎官 wants multiple cats to independently think about a directional question before converging. Keywords: 多猫讨论, 独立思考, 头脑风暴, swarm thinking, 多视角, agent swarm brainstorm. Differs from brainstorming skill which is 1:1 iterative design.
---

# Multi-Cat Brainstorm

## Overview

**多猫独立思考 → 观点保护 → 收敛综合**。与 1:1 `brainstorming` skill 的区别：这里关注的是多视角的观点独立性和收敛质量，而非单点的方案迭代。

## When to Use

- 铲屎官说"你们几个都想想"、"独立思考"、"各自发表观点"
- 方向性决策需要多个不同视角（技术选型、架构方向、流程设计）
- 需要跨模型/跨能力的观点互补（Opus 深度 + Codex 严谨 + Gemini 创意）

**When NOT to use:**
- 1:1 功能需求讨论（用 `feat-discussion`）
- 1:1 从想法到设计的迭代（用 `brainstorming`）
- 需要快速决策的小问题（直接讨论即可）

## 流程

```
铲屎官发起议题
    ↓
Phase 1: 独立思考（并行，禁止互看）
    ↓
Phase 2: 串行讨论（可选，铲屎官决定是否需要）
    ↓
Phase 3: 铲屎官选扇入者
    ↓
Phase 4: 扇入综合（会议纪要 + 行动项）
    ↓
Phase 5: 其他猫审阅补充
    ↓
Phase 6: 铲屎官反馈 + 最终确认
    ↓
收敛（使用 discussion-convergence skill）
```

## Phase 1: 独立思考（最重要）

**观点独立性保护规则**：

1. **禁止互看**：每只猫独立思考，不要预测其他猫会怎么想
2. **防锚定**：如果铲屎官给了背景材料，先形成自己的想法再参考
3. **展示推理链**：不只给结论，展示"我为什么这么想"
4. **标注不确定性**：明确哪些是确信的、哪些是猜测

**为什么这么严格**：串行讨论会让后面的猫被前面的猫锚定，丢失观点多样性。独立思考阶段的价值在于获得真正不同的视角。

**实现方式**：
- Cat Café 中用 `routeParallel()`（BrainstormMode Round 1 已支持）
- 或铲屎官分别 @ 各猫，强调"先独立思考"

## Phase 3: 扇入者选择

**谁来做综合？按阶段默认指定**：

| 讨论类型 | 默认扇入者 | 理由 |
|---------|-----------|------|
| Research 综合 | 布偶猫初步 → 铲屎官审阅 | 布偶猫了解项目 |
| Brainstorm | **铲屎官** | 方向性决策必须铲屎官拍板 |
| 技术讨论 | 布偶猫综合 + 砚砚把关 | 技术细节猫猫自治 |

铲屎官可随时覆盖默认指定。

## Phase 4: 综合产出

扇入者需要产出结构化文档，至少包含：

1. **各方观点摘要**：忠实还原每只猫的核心观点
2. **共识区**：所有猫都同意的结论
3. **分歧区**：不同意见 + 各自理由（**不要抹平分歧**）
4. **待决事项**：需要铲屎官拍板的
5. **行动项**：具体下一步（谁做什么）

**模板**：参见 `discussion-convergence` skill 的会议纪要模板。

## Phase 5: 审阅补充

其他猫（非扇入者）审阅综合文档：
- 补充遗漏的观点
- 纠正对自己观点的误读
- 提出新的 feat 或风险

## 收敛

讨论结束后，**必须使用 `discussion-convergence` skill** 完成沉淀。

## 与现有 Mode 系统的关系

Cat Café 的 `BrainstormMode` 提供了 Phase 1（routeParallel）和 Phase 2（routeSerial）的技术能力。但铲屎官反馈 Mode 系统"太机械"——实际上通过 skills + SOP + @ mention 已能自然驱动流程，不需要显式激活 Mode。

本 skill 是流程指引，不依赖 Mode 系统是否激活。

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Phase 1 让猫猫看到彼此的回答 | 严格用 routeParallel 或分别 @ 并强调独立思考 |
| 扇入时抹平分歧、只保留共识 | 分歧是最有价值的信号——保留并标注理由 |
| 跳过 Phase 5 审阅直接定稿 | 综合可能误读某只猫的观点，必须让原作者确认 |
| 所有讨论都开 swarm | Swarm 有成本（多猫 token），简单问题直接讨论 |
| 忘记 discussion-convergence 收尾 | 讨论完不收敛 = 结论散落在对话里 |

## 实际案例

2026-02-24 Agent Swarm 协同模式讨论：
- 4 猫独立思考 multi-agent 协同方式借鉴
- 铲屎官选 opus 4.5 做扇入综合
- 产出：[会议纪要](../../docs/discussions/2026-02-24-multi-agent-swarm-meeting-notes.md) + [Feat 拆解](../../docs/discussions/agent-swarm-feats.md)
- opus 4.6 审阅补充 3 个新 feat + 优先级重排
- 铲屎官反馈后更新文档
