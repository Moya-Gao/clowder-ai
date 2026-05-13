---
title: "安波教授 — Multi-Agent Scaling Law & Taxonomy"
date: 2026-05-13
event: 华为云 Agent 闭门研讨会（Day 2 下午场）
speaker: 安波教授
topic: 智能体研究进展与展望 / Multi-Agent Systems Scaling Law
author: "[宪宪/Opus-46🐾]"
source: 现场 PPT 截图 + 铲屎官实时转述
---

# 安波教授 — Multi-Agent Scaling Law & Taxonomy

## 核心观点

### 1. 四维分类框架（Paradigms of Multi-Agent LLM Systems）

安波用四个维度对 multi-agent 系统做分类：

| 维度 | 分类项 | 说明 |
|------|--------|------|
| **Agent Composition** | Homogeneous / Heterogeneous | 同构 vs 异构 agent |
| **Communication Topology** | Centralized / Decentralized / Hybrid | 通信拓扑 |
| **Control Flow** | Sequential / Parallel / Hybrid | 执行控制流 |
| **Interaction Protocol** | Cooperative / Competitive / Mixed | 交互协议 |

### 2. Scaling Law 三层结论

| 层级 | Agent 数量 | 特征 | 典型案例 |
|------|-----------|------|---------|
| Single Agent | 1 | 能力天花板明确 | 单模型对话 |
| **Sweet Spot** | **3-5** | **异构协作、边际收益最大** | OpenClaw, Claude Code 等 |
| Large Scale | 100+ | 大概率同构 ensemble | 并行投票/搜索 |

**核心结论**：There is NO universal scaling law — the marginal benefits of scaling are on a case-by-case basis.

安波原话要点：
- "大量领域 multi-agent 不会超过 10 个 agent"
- "超过 10 个大概率是同构"
- 这与他之前 Topic 1 说的"没有银弹"一脉相承

### 3. Lessons Learned from Traditional MAS

五个经典理论都指向同一个结论——协调成本随 agent 数指数增长：

| 理论 | 核心教训 |
|------|---------|
| **Stackelberg Games** | 领导-跟随博弈中，信息不对称导致次优均衡 |
| **Price of Anarchy** | 去中心化系统的效率损失随参与者增加而增大 |
| **Multi-Agent RL** | 多 agent 环境下 reward shaping 极其困难 |
| **Distributed Problem-solving** | 任务分解的通信开销随 agent 数超线性增长 |
| **Social Choice Theory** | 多数投票不保证正确性（Arrow 不可能定理） |

## Cat Cafe 对号入座

Cat Cafe 在安波的分类框架中占据了一个**罕见组合**——多个维度的交叉空白格：

| 维度 | Cat Cafe 定位 | 罕见之处 |
|------|-------------|---------|
| Composition | **Hetero by capability**（跨厂商异构） | 不是同一家模型的大小号，是 Claude + GPT + Gemini |
| Topology | **Decentralized + human CVO** | 铲屎官是最终决策者但不参与日常执行 |
| Control Flow | **Hybrid** | SOP 是 centralized script，Skill 是 decentralized capability |
| Interaction | **Mixed** | cooperative 开发 + competitive review |

### 安波框架验证了我们的经验

- **3-5 agent sweet spot** = 我们的 4 猫（3 家族）正好在这个区间
- **Price of Anarchy** = 我们已经感受到：@ 路由、持球声明、review 串行等协调开销
- **Social Choice** = 我们不投票，用指定 reviewer + 结构化 checklist + 愿景守护
- **>10 agents = 同构** = 我们的异构设计天然限制了规模，这是 feature 不是 bug

### 安波没覆盖的

- 跨厂商异构的信任与一致性问题（不同模型的"价值观"差异）
- CVO-in-the-loop 作为方向校准锚点的系统意义
- 经验沉淀/知识治理层（他聚焦 runtime，我们聚焦 lifecycle）
