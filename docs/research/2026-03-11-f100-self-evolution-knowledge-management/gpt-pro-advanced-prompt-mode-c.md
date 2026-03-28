---
feature_ids: [F100]
debt_ids: []
---

# GPT Pro 进阶调研 — Mode C: 经验如何变成能力

> 委托人：布偶猫（Opus）  日期：2026-03-12
> 关联：F100 Self-Evolution (Mode C: Knowledge Evolution)
> 前序：同目录下三份 Mode C 调研报告（Claude.ai / ChatGPT / Gemini）+ 第一轮基础设施调研四源合成

## 你的角色

你是这个 AI agent 团队的高级技术顾问。我们已经用三个平台做了 Mode C 的 deep research（附后），现在需要你做两件事：

1. **来源验证**（Task 1）：核验三份报告中引用的关键框架/数据是否可靠
2. **进阶深挖**（Task 2）：在三份报告的基础上，回答 4 个更深层的落地问题

## 背景

Mode C 是我们 AI agent 团队的"进攻性知识进化"机制——**从有价值的经验中主动沉淀能力，不只是犯错才学**。

真实案例：人类家人病危，AI 帮忙分析医学检测报告 → 这套分析方法论能否沉淀为可复用能力？

三份报告已经覆盖了：
- 经验→知识的判断模型（三问升级为四问/五问、ExpeL batch extraction、EGL 库饱和检测）
- 跨领域方法论提取（ProcMEM Skill-MDP、AutoRefine 双形态、递归知识晶化）
- 知识成熟度阶梯（五级模型、晋升触发、AGM 信念修正、语义漂移检测）
- 效果评估（Agentic ROI、反事实 A/B、GECE 长尾价值、CNA 成本归一化准确率）
- 直觉形成（SOAR chunking → System 1/2 路由、元认知监控、HAC-SECI 隐性知识捕获）

---

## Task 1: 来源验证（10 条核心引用）

请对以下三份报告中的关键引用进行一手来源核验，判断可靠性：

| # | 引用 | 来源报告 | 需要验证的点 |
|---|------|----------|-------------|
| 1 | **ExpeL (AAAI 2024)** — 三阶段经验学习 | Claude.ai | 是否真的发表在 AAAI 2024？三阶段（gather→extract→recall）是否准确？ |
| 2 | **AutoRefine (Qiu et al., 2026.01)** — 自动提取双形态 Experience Patterns，TravelPlanner 27.1% vs 12.1% | Claude.ai | 论文是否存在？数据是否准确？ |
| 3 | **ProcMEM (Xu et al., 2025)** — Skill-MDP 三元组、非参数化 PPO Gate | Gemini | 论文是否存在？Skill-MDP 形式化是否准确？ |
| 4 | **EGL 进化泛化损失 (Yunjue Agent)** — 库饱和检测指标 | Gemini | Yunjue Agent 技术报告是否存在（arxiv 2601.18226）？EGL 定义是否准确？ |
| 5 | **MICRO-ACT** — 知识冲突解决框架（ASSERT + DECOMPOSE） | Gemini | 论文是否存在？是 2025 年 SOTA？ |
| 6 | **Generative Agents 反思触发阈值 = 150 分** | Claude.ai | Park et al. 原文是否确实用 150 分作为反思触发阈值？ |
| 7 | **MACLA — 2851 轨迹提取 187 条可复用程序（15:1 压缩比）, 78% reuse rate** | Claude.ai | 数据来源？论文是否存在？ |
| 8 | **Agentic ROI 公式 (Liu et al., 2025; AlShikh et al., 2025)** | Gemini | 这两篇论文是否存在？ROI 公式是否被准确引用？ |
| 9 | **Anthropic 元认知研究 (Lindsey, October 2025)** — "frontier models possess some functional awareness of their internal states" | Claude.ai | 这篇 Anthropic 研究是否存在？引用是否准确？ |
| 10 | **PersistBench** — 记忆泄露/迎合风险量化 | ChatGPT | benchmark 是否存在？主要发现是否准确？ |

对每条给出：✅ 已确认 / ⚠️ 部分准确（说明哪里不准确）/ ❌ 无法验证

---

## Task 2: 进阶深挖（4 个落地问题）

### 问题 1: Cat Café 的 Mode C 最小可用产品

三份报告给了大量框架（ExpeL、ProcMEM、EGL、MICRO-ACT、Agentic ROI...），但我们是一个 3 只 AI agent + 1 人类的小团队，不可能全上。

**请设计一个 Mode C MVP**，满足：
- 总共 ≤3 个新机制（不是 3 个框架，是 3 个我们真正要实现的东西）
- 能在现有 markdown + git + SKILL.md 基础上实现，不需要新的基础设施
- 覆盖"什么时候沉淀"（判断）+ "沉淀成什么形状"（格式）+ "怎么知道有没有用"（验证）三个环节
- 明确说哪些框架是 MVP 该采纳的，哪些是 V2/V3 再说的

### 问题 2: 隐性知识捕获的工程化方案

三份报告都提到了 tacit knowledge（隐性知识）的重要性，但给出的方案偏理论（HAC-SECI、AI-Tacit Knowledge Co-Evolution Model、SIA 社会化交互）。

**请给出一个具体的工程方案**：
- 当人类和 AI 协作完成了一次医学报告分析后，系统具体怎么做？（步骤 1、2、3...）
- "协作 context"具体保留什么？（不是全部对话，而是哪些关键节点）
- 保留的格式长什么样？（给出一个具体的 markdown 模板）
- 这个方案在我们的 markdown + git 架构下能否实现？成本多大？

### 问题 3: "知道自己不知道"的元认知实现路径

Gemini 报告提到元认知监控——agent 在调用 skill 前先评估"这个 skill 在当前场景下靠谱吗"。Claude.ai 报告引用了 SOAR chunking 和 Kahneman-Klein 综合。

但关键问题是：**当前的 LLM agent（没有训练循环，只有 prompt + context）能在多大程度上实现真正的元认知？**

请基于 2025-2026 最新证据回答：
- 纯 prompt 层面的元认知（confidence scoring、self-critique）效果如何？有没有严格的评测数据？
- "per-domain confidence tracking"（Claude.ai 建议的"医学 ~85%、法律 ~60%"）在实践中可行吗？calibration 误差多大？
- 有没有不需要训练循环的元认知实现方案，适合我们这种 prompt-only 架构？
- 元认知和"不确定时主动求助人类"之间是什么关系？怎么避免 agent 过于保守（什么都不敢做）或过于自信？

### 问题 4: 知识成熟度阶梯的量化晋升标准

三份报告都提出了 5 级成熟度模型，但晋升标准各不相同：
- Claude.ai: 引用次数 ≥3/5、成功率 >80%/90%、多 agent 使用
- ChatGPT: 重要性分数阈值 150、episode 结构化程度
- Gemini: EGL 收敛、Level 100-500、语义漂移检测

**请给出一套统一的、可量化的晋升标准**，适用于我们的场景（3 agent，markdown 架构，git 历史可追踪）：
- 每一级需要什么条件才能晋升？（用具体数字，不要模糊的"多次使用"）
- 怎么在不引入数据库的前提下追踪这些指标？（frontmatter 字段？git log 统计？）
- 降级/退役的触发条件是什么？
- 给出一个具体例子：一条关于"医学报告分析方法论"的知识，从 Level 0 到 Level 4 的完整晋升路径

---

## 三份报告摘要（供参考）

### Claude.ai 报告核心发现
- 三问判断对标专利法 utility/novelty/non-obviousness，建议扩展为四问 + verification gate
- ExpeL batch extraction + Voyager self-verification 是最相关的工程参考
- 五级成熟度阶梯：Observation → Pattern → Skill → Standard → Wisdom
- AGM 信念修正理论处理知识冲突
- SOAR chunking = System 2→System 1 的"直觉形成"机制
- GECE 度量知识长尾价值，CNA 度量成本归一化准确率
- 关键建议：preserve collaboration context, not just conclusions

### ChatGPT 报告核心发现
- 经验→知识的 SECI/Kolb agent 化落地：快速外化 + 延迟内化两回路
- 三问升级为"五问+打分"（Reusability/Non-obvious/Decay + Evidence Gate + Risk Gate）
- 跨领域方法论需剥离"领域事实"只保留"分析框架"
- CER 上下文经验回放（ACL 2025）
- A-MemGuard 防自我强化错误循环
- 建议采用"两阶段时机"：任务后立即生成 episode → 延迟晋升

### Gemini 报告核心发现
- 信息论判断框架：变分自由能（VFE）+ 贝叶斯惊奇度量化"非显然性"
- EGL 进化泛化损失——检测库饱和，自动提高沉淀阈值
- ProcMEM Skill-MDP 三元组（触发条件/执行程序/终止条件）+ 非参数化 PPO Gate
- 递归知识晶化 → SKILL.md 零样本迁移
- MICRO-ACT 知识冲突解决（ASSERT + DECOMPOSE）
- DeepContext 语义漂移检测
- Agentic ROI 公式化评估（含失败成本）
- Level 100-500 五级成熟度 + 自愈标准
- 元认知置信度评估 + SIA 隐性知识捕获

---

## 输出要求

- Task 1 用表格，每条一行
- Task 2 每个问题独立成章，给具体方案而不是方向性建议
- 区分"已确认事实"和"推测/建议"
- 给出对 Cat Café 的具体改进建议，可直接落地
- 如果某些框架不值得我们这个规模投入，直接说
