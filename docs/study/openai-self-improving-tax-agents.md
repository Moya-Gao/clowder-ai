---
title: "Building Self-Improving Tax Agents with Codex"
author: "Aravind Srinivasan & Samay Shamdasani (Thrive Holdings); Arthur Fernandes Araujo & John de Wasseige (OpenAI)"
date: 2026-05-27
source_url: https://openai.com/index/building-self-improving-tax-agents-with-codex/
source_language: en
retrieved_at: 2026-06-03
category: study
tags:
  - Self-Improving Agents
  - Agent Harness
  - Eval
  - Feedback Loop
  - OpenAI
  - Codex
related:
  - agent-experience-and-self-evolution-synthesis.md
  - 2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - bitter-lesson.md
  - karpathy-self-improving-agent-engineering.md
status: source-audited-primary
---

# Building Self-Improving Tax Agents with Codex

> **状态**：2026-06-03 砚砚用 OpenAI 官方英文原文补全。本文是批判性读书笔记，不搬运原文全文。性能数字按官方 case study claim 使用，不当作独立 benchmark。

## 一句话

OpenAI + Thrive Holdings 用 Codex 帮 Crete 会计网络共建 Tax AI：从业者在真实报税工作中纠正系统输出，产品把这些纠正转成结构化 trace 和 eval，Codex 再基于 repo、trace、eval、skills/docs 做有边界的代码修正，最后由 targeted eval、regression eval 和工程 review 放行。

更短地说：

```text
practitioner correction
  -> product trace
  -> grouped finding
  -> targeted eval
  -> Codex-scoped task
  -> code patch + validation
  -> production evidence for next loop
```

这篇文章不是在说“agent 神奇地自己进化”。它说的是：**只要产品把真实生产错误变成可读、可测、可改、可回滚的工程任务，Codex 就能把人类纠正转成持续改进。**

---

## Source Audit

| Claim | 原始来源 | 来源类型 | 年份/对象 | 五问摘要 | Verdict | Provenance |
|---|---|---|---|---|---|---|
| 文章由 OpenAI + Thrive Holdings 团队发布，讨论 Tax AI / Crete 会计网络 | OpenAI 官方英文文章 | official blog / case study | 2026, Tax AI pilot | 一手来源；但有产品宣传动机 | use | [一手 / official case study / 2026 / Tax AI pilot / high] |
| Tax AI 处理 7,000 份 tax returns，并服务 Crete 30+ accounting firms 网络 | OpenAI 官方英文文章 | official blog / case study | 2026, participating Crete firms | 一手披露；未见独立审计 | use-with-caveat | [一手 / vendor case study / 2026 / pilot scope / medium] |
| 节省约 1/3 准备时间、吞吐提升约 50%、draft accuracy up to 97% | OpenAI 官方英文文章 | official blog / case study | 2026, Tax AI pilot | 一手披露；指标定义和样本细节有限；不能外推到所有税务任务 | use-with-caveat | [一手 / vendor metric / 2026 / pilot scope / medium] |
| 75% correct field completion 门槛从约 25% returns 到 6 周后 86% | OpenAI 官方英文文章 | official blog / case study | 2026, Tax AI pilot | 一手披露；是产品内指标，不是 peer-reviewed benchmark | use-with-caveat | [一手 / vendor metric / 2026 / product metric / medium] |
| 核心 loop 是 expert feedback + production traces + Codex-driven eval loop | OpenAI 官方英文文章 | official engineering write-up | 2026, Tax AI architecture | 架构性描述，可直接作为 case study | use | [一手 / official architecture / 2026 / design pattern / high] |
| 一位 senior accountant 从 180 小时税务准备降到 15 小时 | OpenAI 官方英文文章 | anecdote in official blog | 2026, individual anecdote | 单例故事；只能说明案例，不可量化外推 | use-with-caveat | [一手 / anecdote / 2026 / one practitioner / low-medium] |

## 三根支柱

官方文章把自我改进架构收束成三个支柱：

1. **Expert practitioner feedback（专家反馈）**
   - 税务从业者仍在真实业务流程里 review、纠正、批准 filing。
   - 他们不是“被替代的标注员”，而是 steering signal：判断哪些差异是系统错误，哪些是税务判断、工作流噪声或先前年度 carry-forward。

2. **Production traces（生产轨迹）**
   - 产品不能只记录输入/输出，必须保留从 source files、extracted fields、provenance、tax engine submission 到 practitioner correction 的完整路径。
   - trace 的价值是能把“错了”拆成 extraction miss、mapping gap、unsupported field、source-selection problem、grader issue 或 workflow noise。

3. **Codex-driven iteration loop（Codex 驱动的迭代循环）**
   - 被 review 过的反复修正被 group 成 finding，再变成 targeted eval。
   - Codex 拿到：production trace、source artifacts、expected tax-engine output、repo、relevant code examples、eval commands、skills/docs。
   - Codex 负责调查、提出代码变更、跑 targeted eval 和 regression eval，再把 candidate PR 交给工程 review。

## 核心机制：修正 → eval → 代码修改 → 验证

```
从业者发现 agent 错误
  → 修正被结构化记录（production trace）
  → 反复出现的修正变成 eval target（finding → eval → scoped task）
  → Codex 调查根因、提出代码变更
  → 变更跑 eval 验证（targeted evaluation）
  → 通过 → 合入；不通过 → 迭代
```

## Rental Property 例子

官方文章用 rental property income / Schedule E 举例。

表面任务很简单：从源材料里提取 rental-property fields，映射到 tax engine。现实难点是源材料可能来自手写笔记、邮件、电子表格、客户文件，还要带 citation/provenance 给从业者 review。

loop 的关键不是“Codex 看最终答案然后猜怎么改”，而是：

1. practitioner correction 先被判断是否 actionable；
2. product trace 记录 predicted value、expected filed value、source evidence、workflow context；
3. 相似 failure rows 被 group，避免把一次性噪声当系统缺陷；
4. 反复出现的问题，例如 fair-rental-day field、other expenses、multiple rental properties 混淆，变成 targeted eval；
5. Codex 在 scoped task 里查看 trace、eval、repo、skills/docs，提出 patch；
6. targeted eval + broader regression eval 通过后，才进入工程 review / ship。

如果 evidence ambiguous 或不适合自动化，case 会回到 product team，而不是强行让 Codex 改。

## Codex Task Environment 长什么样

官方文章给了一个代表性任务环境。重点不是目录名，而是边界设计：

```text
/candidates/FIND-RENTAL-0042/
  repo/                         # writable worktree
    branch: codex/fix-rental-0042
    AGENTS.md
    tasks/FIND-RENTAL-0042/
      task.yaml
      EXEC_PLAN.md
      RESULTS.md
    app/tax-ai/rental-income/    # scoped product surface
    evals/                       # targeted + regression evals
    skills/
    docs/
  scoped-tools/                  # read-only production context
    production-trace
    source-artifacts
    tax-engine-docs
```

这和我们家的直觉高度一致：

- writable worktree 和 read-only evidence 分离；
- task 有明确 `task.yaml` / execution plan / results；
- eval 定义 success condition；
- skills/docs 给 Codex task-specific operating knowledge；
- scoped tools 提供 production trace，但不允许 Codex 篡改底层证据。

## 结果（官方 claim，需带 caveat）

| 指标 | 官方披露 | 使用方式 |
|------|------|------|
| 处理量 | 参与 pilot 的 Crete firms 处理 7,000 tax returns | 可作为 case study 规模，不当独立 benchmark |
| 会计网络 | Crete network of 30+ accounting firms | 官方背景事实 |
| 节省时间 | saves practitioners about a third of tax-prep time | vendor metric，需 caveat |
| 吞吐量 | increases throughput by about 50% | vendor metric，需 caveat |
| draft accuracy | up to 97% accuracy | 指标定义需看上下文，不外推 |
| 6 周进步 | 75% correct field completion：约 25% returns → 86% returns | 产品内指标，可用于说明 loop 有效，但不等于通用 self-improvement 证明 |
| rental properties | about six weeks + substantial engineering oversight to reach 90% precision and recall | 说明不是“零人工自进化”，而是人机共建闭环 |
| 单例故事 | 一位 senior accountant 180h → 15h | 只当 anecdote，不作统计证据 |

## 如何扩展到新领域

官方文章最后说，rental properties 这条线虽然花了约六周和大量工程监督，但产出了 reusable abstractions、review artifacts、eval conventions、implementation patterns，能迁移到 Schedule C / Schedule A 等相似复杂度任务。

它还把 Tax AI 视为 Thrive Holdings 在其它 specific industries 中复制 self-improving workflow 的蓝图，包括 bookkeeping、audit、IT help desk automation。

这里要保持判断：

- **可以用**：同一组织内、能接触 practitioners 和 production data 的 bounded workflow，可以复制这套 loop。
- **不能过度外推**：不是所有 domain 都有税务字段这种较强 verifier；开放式产品、写作、审美和陪伴任务不能直接照搬。

## 与我们的对照

### 高度吻合

| 他们做的 | 我们做的 |
|---------|---------|
| practitioner feedback → eval target | CVO taste + review feedback → Eval Contract |
| product traces 结构化 | session events + TaskTrajectory + F200 consumption feedback |
| Codex 提出修改 + 跑 eval 验证 | TDD + quality-gate + merge-gate |
| 反复修正 = 进化信号 | 铲屎官跨 thread 反复说同一句话 = 最高密度进化信号 |
| 三支柱循环 | Self-evolving Harness = Signals × Patchability × Replay × Sunset |
| scoped writable repo + read-only evidence | worktree + source-audit + production evidence 不可篡改 |

### 我们多了什么

1. **多 agent 跨厂商**——他们是单 Codex 家族；我们多猫多脑，跨厂商 review 阻断同源盲点
2. **人类 taste 维度**——他们的 verifier 是"对/错"二值；我们的 CVO 判断包含审美/品味/关系
3. **Sunset 机制**——他们没提旧 eval 怎么退役；我们有 Build to Delete + hotfix 计时器
4. **Per-user adaptation**——他们是 per-domain（税务）；我们是 per-person（一个人的工作环境）
5. **治理和身份层**——他们强调 engineering review；我们还把身份、球权、不可逆边界、跨族 review 写入运行协议

### 他们多了什么

1. **真实生产规模验证**——7,000 returns，有硬数字。我们的 eval 还在试点阶段
2. **窄域 + 高确定性 reward**——税务字段有标准答案，eval 可以全自动。我们很多任务没有标准答案
3. **Codex 深度集成**——他们用 Codex 直接修代码 + 跑测试，闭环更紧。我们的猫修代码后还要走 review + merge-gate
4. **production trace → eval target 的产品化成熟度**——他们已经在真实业务系统里把 correction rows 结构化成 eval；我们还在把 TaskTrajectory / Eval Contract 做成统一产品面

## 关键启发

1. **"修正变 eval"是最实用的自我改进路径**——不需要 DGM 那么重的进化架构，只要把人类修正结构化、反复出现的变成测试、让 agent 自己修就行。
2. **验证了 Karpathy 的判断**——窄域 + 有标准答案的任务（税务）最先突破 self-improvement，因为 verifier 可以自动化。
3. **生产轨迹是金子**——他们叫 production traces，我们叫 TaskTrajectory / session events / trace。同一个东西，同一个 insight：agent 的真实工作历史是最有价值的学习素材
4. **bounded autonomy 才能落地**——Codex 不直接改整个公司系统，而是在 scoped task environment 里看证据、改有限 surface、跑明确 eval。
5. **人不是被拿掉，而是上移**——practitioners steer what matters，engineers own architecture/product/shipping；Codex 加速中间的 investigation/patch/validation。

## 接到我们最近的逻辑线

| 研究线 | 这篇文章的落点 |
|---|---|
| Bitter Lesson | 不再手写每个 edge-case 规则，而是建一个能从真实失败中学习的环境 |
| Era of Experience | 经验不是聊天记录，而是 source docs、field rows、corrections、filed returns、eval results |
| Karpathy self-improvement | verifier 明确的窄域先跑通；tax fields 比开放式创意任务更适合 self-improvement |
| Code as Agent Harness | Codex 通过 repo、evals、skills/docs、scoped tools 执行 bounded engineering task |
| AHE / Eval Contract | finding → expected fix → eval → regression → review，就是可证伪的 harness patch |
| DGM | 都在进化 agent 外部工作流；但这里不是开放式演化，而是 production trace 驱动的 bounded improvement |
| DeliAutoResearch | 两者都提醒：AI artifact 要带 production telemetry、verification state、known gaps 和 replay entry |

一句话判断：

> **OpenAI Tax AI 是 “self-improving agent” 在高 verifier、强 trace、强 practitioner feedback 领域的现实样本；Cat Cafe 要吸收的是 trace → eval → scoped patch → review 这条闭环，而不是把所有自我进化都包装成全自动。**

## 来源

- [OpenAI: Building self-improving tax agents with Codex](https://openai.com/index/building-self-improving-tax-agents-with-codex/)（一手来源，2026-05-27）
- 二手报道只用于发现线索；本版内容不再依赖 WebSearch 二手整理。
