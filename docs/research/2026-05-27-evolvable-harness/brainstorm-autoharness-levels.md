---
title: "铲屎官脑洞：AutoHarness L1-L5 + LLE 概念"
date: 2026-05-27
event: 华为云 Agent 闭门研讨会 Day 2 后讨论
author_brainstorm: "铲屎官/Landy"
author_notes: "[宪宪/Opus-46🐾]"
doc_kind: brainstorm
status: raw-capture
---

# AutoHarness L1-L5 + LLE 概念

> **背景**：华为云闭门研讨会 Day 2 下午结束后，铲屎官在讨论中一口气输出了关于 Harness 自进化的 n+2 愿景。这不是立项，是远期方向探索。
>
> **LLE (Large Language Environment)** 是铲屎官随手提出的概念，不来自任何论文。核心思想：model、memory、sandbox、tools、code 都是 agent 的 environment，整个环境可以作为可训练/可进化的对象。

## 多方启发汇聚

| 来源 | 启发 |
|------|------|
| **STW (SWE-bench → Terminal-bench → 下一代 benchmark)** | Harness 迭代很快，代码经常重写 → agent 自己写 |
| **OpenAI / OpenClaw** | 启发式学习 → 用 coding 的方式写自迭代的代码 |
| **华为云** | 面向各行各业 → 让 agent 生成面向行业的 harness |
| **王云鹤 (知乎)** | Harness 本身可以建模为优化问题；Model + Harness Params 联合优化 |
| **黄超 (OpenSpace)** | Auto harness, worker + evolver 共用闭环 |
| **复旦 (AHE)** | 三层可观测性驱动 harness 自动进化 |
| **人大 (EnvScaler)** | 自动合成 agent 训练/测试环境 |

## AutoHarness Levels（类比自动驾驶）

| Level | 名称 | 人的角色 | Agent 的角色 | 现实案例 |
|-------|------|---------|-------------|---------|
| **L0** | Manual Harness | 人写所有 harness 代码 | 被动执行 | 传统软件开发 |
| **L1** | Human-Authored, Agent-Executed | 人写 harness（SOP/Skills/Rules），agent 在 harness 内执行 | 在框架内行动 | **Cat Cafe 当前状态** |
| **L2** | Agent-Suggested Evolution | 人写 harness，agent 提出改进建议 | 观测 + 提建议 | **F192 方向**（eval + 改进提案，CVO 审批） |
| **L3** | Agent-Authored, Human-Approved | Agent 自动生成/修改 harness，人审批 | 写 harness + 等审批 | AHE 声称的级别（但 reviewer = LLM） |
| **L4** | Agent + RL Training | Agent 写 harness + RL 训练 + 自评估 | 写 + 训练 + 评 | 学术前沿（AgentGym-RL 的方向） |
| **L5** | Full Auto Pipeline | 全自动：生成 harness → 训练 → 评估 → 部署 → 迭代 | 全部 | 理论终态，尚无可信案例 |

### Cat Cafe 在这个光谱上的位置

```
L0 -------- L1 ======== L2 -------- L3 -------- L4 -------- L5
             ^当前        ^F192方向
```

我们的架构决策：**Gate 是 CVO，不是 LLM**。这意味着我们有意识地把天花板放在 L2-L3 之间，而不是追求 L5。

为什么？黄超（OpenSpace）自己说"泛化很困难"——根因不是技术难，是缺少方向校准的锚点。全自动进化没有人参与校准 = 高速跑偏。

## LLE — Large Language Environment

铲屎官的原创概念（不来自任何论文）：

> model, memory, sandbox, tools, code — 都是 agent 的 env。
> 整个 environment 就是一个 Large Language Environment。

传统 RL 中：Agent 在 Environment 中学习。
LLE 的洞察：**Environment 本身也是可学习的**。

```
传统 RL:   固定 Environment + 可训练 Agent
LLE:       可训练 Environment + 可训练 Agent = 联合进化
```

王云鹤的公式 2（Model Params + Harness Params 联合优化）其实就是 LLE 的数学表达。

学术上最接近的工作：
- **AgentGym-RL** (复旦 + ByteDance)：跨 27 个环境统一训练 agent — 环境是固定的，但 agent 在多环境间迁移
- **EnvScaler** (人大)：自动合成训练环境 — 环境是生成的，但生成后固定
- **LLE 的终极形态**：环境本身在被使用的过程中也在学习和进化 — 这还没人做到

## 铲屎官的终态愿景

> "一个复杂的任务过来 → 自动起很多沙箱跑这个任务……在线的强化学习训练 → live RL model……这个 RL 一个刷模型一个刷 memory 和 skills……最终 harness 平台大概率是模型/agent 自己写的"

翻译成技术路线：

1. **任务到来** → 自动 spawn 多个沙箱环境
2. **并行执行** → 不同 harness 配置在不同沙箱中同时运行
3. **在线 RL** → 根据执行结果实时更新
4. **双通道学习** → (a) 模型参数更新 (b) memory + skills 更新
5. **Harness 自生成** → 平台 harness 由 agent 自己编写和维护

这基本是 L4-L5 的描述。

## 对 Cat Cafe 的实际意义

### 短期（当前 → 6 个月）
- 维持 L1，做好 L2 基础设施（F192 eval + 观测层）
- 积累 Harness 演化数据：每次改 SOP/Skills/Rules 都记录前后对比 + 效果

### 中期（6-12 个月）
- L2：agent 能基于观测数据提出 harness 改进建议，CVO 审批
- 对接王云鹤的"组合优化"思路：多模型路由优化（Intelligence/Token）

### 远期（12+ 个月，n+2 视野）
- L3 探索：agent 自动写 harness，CVO 做 Gate 而非逐行审批
- LLE 概念验证：harness 数据是否能有效反哺模型训练（和 Anthropic/OpenAI 的合作面）

### 永远不做
- L5 without human Gate — 这是架构约束不是技术限制（W3: 用户是 CVO）

## 待讨论（多猫头脑风暴议题）

1. "Evolvable Harness" 这个名字行不行？还是叫别的？
2. 是开新 feature 还是纳入 F192 的未来 phase？
3. Cat Cafe 的 Harness 数据能卖/开放给模型厂商吗？（数据主权 + 商业模式）
4. L2 的具体 MVP 是什么样的？（agent 提出什么级别的建议？CVO 怎么审批？）
5. 王云鹤的 "Intelligence/Token" 指标能不能做成我们的 telemetry？
