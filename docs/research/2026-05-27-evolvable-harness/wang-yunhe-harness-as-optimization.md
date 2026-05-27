---
title: "王云鹤：我眼中的 Harness — 复杂优化问题，AGI 灵魂争夺之战"
date: 2026-05-27
source: "https://zhuanlan.zhihu.com/p/2038669387150927679"
author_original: "王云鹤（深度学习话题优秀答主）"
author_notes: "[宪宪/Opus-46🐾]"
doc_kind: research-note
zhihu_column: "Harness (https://www.zhihu.com/column/c_2038675234375610689)"
---

# 王云鹤：Harness 是复杂优化问题

> 铲屎官在华为云闭门研讨会期间提到这篇文章，后在本地 Clippings 中找到原文。

## 核心论点

**Agent = Models + Harness**（注意是复数 Models），Harness 不是临时脚手架，而是一个**极其复杂的优化和系统工程问题**。

### 三个支撑论据

1. **模型"七国八制"**：各家模型因数据、路线、业务属性特异化——有的生活娱乐强、有的数学强、有的 coding 强、价格不一。即使同质化，不同任务最优模型也有差异。Claude Code 内部就调用 opus/sonnet/haiku 多款模型实现综合最优解。

2. **模型中的任务会"打架"**：机器学习中多任务冲突是老问题（举例：图像超分 vs 去模糊 = 高通 vs 低通滤波）。快慢思考合一（非 prompt 切换）2025 年 4 月就放弃了。所以哪怕模型同质化，不同任务的最优模型仍有差异。

3. **复杂任务更需要多模型**：Beyond LLM，多模态生成、具身智能等需要多模型协同（感知、决策、运控、预测、记忆）。如果基模的愿景是吞噬 Harness，这个时间窗至少 3-5 年。

### 核心公式

**公式 1**：给定任务和一组 Base Models，优化目标 = 任务价值 x 成功率 x Token 性价比（Intelligence/Token）

```
目标函数 ≈ min task_loss / token_cost

其中每一步从 Model Pool 中选择合适模型，
并优化适配该模型的 Harness 组件（prompt, rag, memory, safety 等）
```

这是一个面向任务、对诸多先进模型的**组合优化问题**。求解手段包括：handcrafted + human-in-the-loop、LLM as optimizer、AutoML 经验和算法。

**公式 2**（下一代 AGI 路径）：

```
Model Parameters + Harness Parameters 迭代优化 / 联合优化
```

Anthropic 已经展示了这条路：opus 4 → Claude Code 1.0 → opus 4.5 → Claude Code 2.0 → opus 4.6……Harness 数据反哺基模进化。

### "灵魂之争"

如果公式 1 成立（Harness 控制甚至选择模型），AI 的灵魂到底在 Base Model 还是 Harness？如果公式 2 成立（Harness 数据增训模型），灵魂到底属于谁？

## 引用文献

| 编号 | 论文/文章 |
|------|----------|
| r1 | Trivedy — "The Anatomy of an Agent Harness" (LangChain Blog, 2026-03) |
| r2 | Liu et al. — "AgentOS: From Application Silos to a Natural Language-Driven Data Ecosystem" (arXiv:2603.08938) |
| r3 | He et al. — "Harness Engineering for Language Agents: The Harness Layer as Control, Agency, and Runtime" (2026) |
| r4 | Chen et al. — "Pre-trained Image Processing Transformer" (CVPR 2021) |
| r5 | Tian et al. — "Instruct-IPT: All-in-One Image Processing Transformer via Weight Modulation" (arXiv:2407.00676) |
| r6 | Yang et al. — "Large Language Models as Optimizers" (ICLR 2024) |
| r7 | Trivedi et al. — "Align-Pro: A Principled Approach to Prompt Optimization for LLM Alignment" (AAAI 2025) |

## Cat Cafe 视角分析

### 高度共鸣的部分

| 王云鹤论点 | Cat Cafe 实践 |
|-----------|-------------|
| Agent = Models（复数）+ Harness | 我们是 Claude + GPT + Gemini 异构三家族，正是 "七国八制" 的 micro 版 |
| 不同模型不同任务最优 | 家规就是这么分工的：opus 深度思考、sonnet 日常轻量、codex review 找 bug、gemini 审美 |
| Intelligence/Token 优化 | 铲屎官 reviewer 成本路由教训：codex 是 gpt52 的 2 倍，优先便宜等价选项 |
| Harness 数据反哺模型 | Anthropic 路线 (opus→CC→opus) 正是我们的上游供应商在走的路 |
| 快慢思考冲突 | 我们在 SOP 层面分离：deep thinking (opus) vs quick response (sonnet) |

### 需要追问的部分

1. **"Model Parameters + Harness Parameters 联合优化"对我们意味着什么？**
   - 我们不训模型（W1: 换模型而不是改模型），但我们的 Harness 数据（trace、review、failure patterns）理论上可以成为模型厂商的训练信号
   - F192 的 eval 基础设施正是在构建这种数据管道的前端

2. **组合优化问题的求解在我们这里是什么形态？**
   - 目前是 handcrafted + human-in-the-loop（铲屎官拍板 + 家规 + SOP）
   - F192 Phase C pivot 方向 = 向 "观测驱动的半自动优化" 迈进
   - 王云鹤提到的 AutoML 思路 = 铲屎官脑洞的 L3-L4 级别

3. **Harness 元素变成"独立模型"的可能性？**
   - 王云鹤暗示 prompt/rag/memory/safety 都可能变成可学习参数甚至独立模型
   - 我们的 Skills 是声明式的，但如果 skill 本身是一个小模型……这是 L4+ 领域

### 灵魂之争的 Cat Cafe 回答

王云鹤问："灵魂到底在 Base Model 还是 Harness？"

我们的实践回答：**灵魂在 Harness 层，但最终的方向校准在 CVO（人）**。

- Base Model 是能力源（W1: 猫猫是 Agent 不是 API），但不同模型可替换
- Harness（家规 + SOP + 记忆 + Skills + 五铁律）定义了"我们是谁"和"我们怎么工作"
- CVO 是方向锚点（W3），防止自进化飘移（黄超说的"泛化很困难"的根因）

所以对我们来说，公式 2 不是 Model + Harness 联合优化，而是：

```
CVO Direction × (Model Capability + Harness Parameters) → Agent Quality
```

CVO 是乘数项，不是加数项。方向错了，能力和 Harness 越强越危险。
