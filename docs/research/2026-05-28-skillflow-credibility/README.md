# SkillFlow 可信度评估 + 三篇"Skill 进化"论文扒底裤总结

> **论文**: [arXiv:2605.14089](https://arxiv.org/abs/2605.14089) — Zhang et al., "SkillFlow: Flow-Driven Recursive Skill Evolution for Agentic Orchestration", May 2026
> **GitHub**: [beita6969/SkillFlow](https://github.com/beita6969/SkillFlow) (4 stars, 22 commits)
> **项目页**: [skill-flow.org](https://skill-flow.org)
> **拉取人**: 宪宪/Opus-4.6 | 2026-05-28
> **同赛道**: [SkillOpt](../2026-05-26-microsoft-skillopt/README.md) · [MUSE-Autoskill](../2026-05-28-bytedance-muse-autoskill/README.md)

---

## Part 1: SkillFlow 可信度评估

### 它声称在做什么

"Flow-Driven Recursive Skill Evolution for Agentic Orchestration"——流驱动的递归 skill 进化。

### 它实际在做什么

**用 GFlowNet（生成式流网络）LoRA 微调一个 Supervisor 模型，让它学会选哪个 tip 来用。** "Skill evolution" 只是 tip 的增删管理。

| 声称 | 实际 |
|---|---|
| "Skill Evolution" | Tip 增删 + 模型微调 |
| "Flow-Driven" | GFlowNet 流匹配损失（Bengio 2021-2023） |
| "Recursive" | 训练到 loss 饱和时触发下一轮 |
| "Skills" | "atomic tips"——原子级小贴士 |

### 技术细节

- **核心方法**：Tempered Trajectory Balance (TTB)——GFlowNet 的轨迹平衡条件应用于 agent 编排
- **改了什么**：模型权重（LoRA 微调 forward policy πθ + backward policy Pϕ）
- **Skill 定义**（§4.1）："short, self-contained pieces of strategic guidance"
- **Executor**：frozen（工具/API 不变）
- **Skill 示例**：**论文全文没展示任何一个实际 skill 内容**

### 数字可疑点

| Benchmark | 声称 | 🚩 |
|---|---|---|
| HumanEval pass@1 | 98.44% | 超过绝大多数已发表结果 |
| WebShop SR | 32%→93.75% (+61.7pp) | 跳跃异常大 |
| OOD 提升 > IID 提升 | +53.5% vs +41.2% | 没解释机制 |

### 关键缺失

1. **没展示任何实际 skill**（Appendix Q.3 截断）
2. **Skill 创建器 Ψ 黑箱**（怎么从轨迹生成 tip 的？没讲清）
3. **没对比 SkillOpt / TextGrad / MUSE-Autoskill**
4. **消融混淆变量**（去 TTB 时同时换 GRPO，两个变量一起改）
5. **4 GitHub stars**（无外部验证）
6. **核心数学搬运**（GFlowNet 是 Bengio 等人的工作）

### 判决

**不是假论文，但概念包装最严重**。真实贡献 = "GFlowNet 应用于 agent supervisor 训练"。叫它 "Skill Evolution" 是蹭热度。

---

## Part 2: 三篇论文扒底裤——"Skill" 概念光谱

| 级别 | 论文 | "Skill" 的真面目 | 能 pytest？ | 改模型权重？ |
|---|---|---|---|---|
| **L0 原子 tips** | SkillFlow | 一句话小贴士 | N/A（模型选 tip，不测 tip） | ✅ LoRA 微调 |
| **L1 配方** | SkillOpt | 单 benchmark 的指令模板 | ✅ | ❌ Frozen |
| **L2 技术 recipe** | MUSE-Autoskill | PID 控制器 / Flink 查询 / Excel 公式 | ✅（Docker verifier） | ❌ Frozen |
| **L3 Know-how** | Anthropic / Cat Café | 经验 + 方法论 + 判断力 + 治理 | 大部分不能 | ❌ Frozen |

**三篇论文都把低层级的东西叫 "skill"，然后声称在做 "skill evolution"。但 Anthropic 和工业界说的 "skill" 是 L3 层。概念通胀从 L1 到 L0 越来越严重。**

---

## Part 3: 猫爪子扒底裤——把这三个方法用到复杂现实场景会怎样？

铲屎官要求：不说"让猫猫咖啡自动进化"这种空概念。就说在有 benchmark 的复杂场景（如 SWE-bench / Terminal-Bench / The Agent Company），**如果我们去复现，会出现什么？**

### 场景设定

| Benchmark | 复杂度 | 任务 | 自动评分？ |
|---|---|---|---|
| **SWE-bench** | ⭐⭐⭐⭐ | 修真实 GitHub issue | ✅（测试套件） |
| **Terminal-Bench** | ⭐⭐⭐⭐ | 终端复杂操作链 | ✅ |
| **The Agent Company (TAC)** | ⭐⭐⭐⭐⭐ | 模拟真实 SaaS 公司全流程 | ✅ |

### SkillOpt 用到 SWE-bench：会出现什么

**方法回顾**：Frozen model + 优化 skill 文本 → epoch/batch/LR 训练循环 → best_skill.md

**复现会遇到**：

1. **Rollout 成本爆炸**：每个 rollout = 起 Docker → clone 仓库 → agent 修代码 → 跑测试 → 收轨迹。一次 5-15 分钟 + $2-5。SkillOpt 需要 ~960 rollouts/训练 → **$3000-5000 / 一个 skill**。

2. **Skill 粒度不匹配**：SWE-bench 的任务差异极大（Python web 框架 bug vs C++ 编译器 crash vs JavaScript 前端渲染问题）。一个 skill 文档能覆盖这么多种类的任务吗？SkillOpt 在 SearchQA 上 work 是因为所有任务都是"搜索→回答"同一个 pattern。SWE-bench 没有统一 pattern。

3. **Optimizer 分析质量下降**：SWE-bench 的失败轨迹可能几千行（git diff + test output + stack trace）。Optimizer 模型要看懂"为什么这个 patch 没修好这个 bug"——这比分析"为什么搜索没找到正确答案"难 100 倍。Optimizer 的反向传播（reflection）质量会严重下降。

4. **Validation gate 不可靠**：SWE-bench 的 held-out 任务跟训练任务差异大。在 Python web 框架 bug 上优化的 skill 不一定对 C++ 编译器 bug 有帮助。Validation 可能在一个子领域提升、另一个子领域退化。

5. **预期结果**：如果按子领域拆分（只优化 "Python Django bug" 的 skill），可能有 +5-10pp 提升。全领域统一 skill 大概率无效或退化。

### MUSE-Autoskill 用到 The Agent Company：会出现什么

**方法回顾**：从任务失败中创建 skill → 存入 skill 库 → 评估 → 精炼

**复现会遇到**：

1. **任务太复杂无法提取配方**：TAC 的任务是"完成一个 SaaS 公司的工作日"——涉及邮件、日历、代码仓库、项目管理、文档协作。失败根因可能是"没理解同事邮件里的隐含意思"或"没在正确的时间点更新 Jira"。**从这种失败里提取可复用的 skill = 不可能**，因为每个失败都是独特的上下文组合。

2. **Skill 爆炸**：TAC 有几十种不同类型的子任务。MUSE-Autoskill 会为每种子任务创建 skill，skill 库迅速膨胀。Management 组件的去重和检索变成瓶颈。

3. **跨任务迁移失败**：在"处理 HR 邮件"上学到的 skill 对"做代码 review"几乎无用。MUSE-Autoskill 论文里的迁移成功（+10.51pp）是在相似技术任务间实现的（PID 控制器 → 其他控制任务），不是跨领域。

4. **测试不可写**：TAC 的很多评分是 LLM-as-Judge（"这个邮件回复合理吗？"）。给 skill 写 pytest 验证？不可能。

5. **MUSE 自己的佐证**：MUSE（MUSE-Autoskill 的前序工作）实际上在 TAC 上测了——拿了 #1 排名。但那个排名靠的是 **整个 MUSE 框架的经验记忆系统**，不是 skill 自动生成/进化。skill 只是其中一小块。

### SkillFlow 用到 Terminal-Bench：会出现什么

**方法回顾**：GFlowNet TTB 微调 Supervisor + 原子 tip 管理

**复现会遇到**：

1. **训练成本合理**（这是 SkillFlow 的优势）：因为训的是小模型 LoRA（Qwen3.5-9B），不是调 API。但需要 GPU 资源（论文没说清楚具体多少）。

2. **Tip 太浅**：Terminal-Bench 的任务需要深度的 Linux 系统知识（"修复这个 systemd service 配置" / "调试这个网络连接"）。一句话 atomic tip 能提供的信息量太少。复旦 AHE 在 Terminal-Bench 上成功（69.7%→77.0%）是因为它优化的是整个 harness 配置（几百行），不是原子 tip。

3. **Supervisor 训练数据稀缺**：SkillFlow 用 3500 条训练记录跨 7 个任务族。Terminal-Bench 的任务多样性远超这个数据量能覆盖的范围。训练数据不足 → Supervisor 泛化差。

4. **GFlowNet 的 DAG 假设可能不成立**：Terminal-Bench 的任务有循环依赖（试一个方案 → 失败 → 回滚 → 试另一个），SkillFlow 的 GFlowNet 假设 DAG（无环图），这在探索性任务上可能违反。

5. **预期结果**：在 Terminal-Bench 的简单子集（文件操作、文本处理）上可能有提升。在复杂子集（网络调试、系统配置）上大概率无效。

### 通杀表：三个方法 × 三个复杂 benchmark

| | SWE-bench (⭐⭐⭐⭐) | Terminal-Bench (⭐⭐⭐⭐) | TAC (⭐⭐⭐⭐⭐) |
|---|---|---|---|
| **SkillOpt** | 子领域拆分可能 +5-10pp；全领域无效 | 类似 AHE 但更贵更慢 | 完全不适用（无法自动评分大部分任务） |
| **MUSE-Autoskill** | 可能创建有用的技术 recipe | Skill 爆炸 + 迁移差 | Skill 库膨胀，跨领域迁移失败 |
| **SkillFlow** | GPU 友好但 tip 太浅 | DAG 假设可能违反 | Supervisor 训练数据不足 |

### 共同死因

三个方法在复杂场景下会死在**同一个地方**：

> **任务多样性 > Skill 可泛化性**

简单 benchmark（SearchQA, ALFWorld）的任务都长一个样——同一个 skill 就能覆盖。复杂场景的任务**每一个都是独特的上下文组合**。你写的 skill / tip / recipe 要么太笼统（没帮助），要么太具体（不泛化）。

这正是为什么真正在复杂场景上 work 的方法（AHE 在 Terminal-Bench，MUSE 在 TAC）靠的不是 skill 内容优化，而是：
- **整个 harness 配置的迭代**（AHE）
- **经验记忆的积累**（MUSE 的 Memory Module）
- **换更好的 harness**（SWE-bench 6.7%→68.3% 纯靠换 harness）

---

## Part 4: 一张图总结

```
论文声称的进化对象    实际进化的东西    在复杂场景的命运
─────────────────────────────────────────────────────
SkillOpt:
  "Skill Document"  →  答题指令模板   →  任务太多样，一个模板覆盖不了
  
MUSE-Autoskill:
  "Skill Library"   →  技术解题配方   →  配方爆炸，跨领域迁移失败

SkillFlow:
  "Skill Evolution" →  原子 tip 增删  →  tip 太浅，复杂任务需要的是深度知识
                       + 模型微调

真正 work 的是：
  AHE:     整个 harness 配置迭代    →  Terminal-Bench 69.7%→77.0%
  MUSE:    经验记忆积累              →  TAC 排行榜 #1
  换 harness: 不改 skill，改基础设施 →  SWE-bench 6.7%→68.3%
```

**结论**：这三篇论文在简单 benchmark 上刷出的漂亮数字，搬到复杂现实场景会遭遇"任务多样性 > Skill 可泛化性"的根本矛盾。真正推动复杂场景性能的是 harness 工程和经验积累，不是 skill 文本优化。论文的方法论有局部参考价值（negative buffer、validation gate、flow-driven credit），但核心叙事——"自动优化 skill 文档就能提升 agent 表现"——在工业复杂度下不成立。

---

## 参考文献

- **SkillFlow**: [arXiv:2605.14089](https://arxiv.org/abs/2605.14089) / [GitHub](https://github.com/beita6969/SkillFlow) / [skill-flow.org](https://skill-flow.org)
- **SkillOpt**: [arXiv:2605.23904](https://arxiv.org/abs/2605.23904) / [GitHub](https://github.com/microsoft/SkillOpt)
- **MUSE-Autoskill**: [arXiv:2605.27366](https://arxiv.org/abs/2605.27366)
- **AHE**: [arXiv:2604.25850](https://arxiv.org/abs/2604.25850)
- **MUSE**: [GitHub](https://github.com/KnowledgeXLab/MUSE) (TAC #1)
- **Anthropic Agent Skills**: [anthropics/skills](https://github.com/anthropics/skills) / [agentskills.io](https://agentskills.io/specification)

---

*[宪宪/Opus-4.6🐾]*
