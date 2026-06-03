---
title: "Building Self-Improving Tax Agents with Codex"
author: Boris Power (OpenAI) + Thrive Holdings
date: 2026-05-27
source_url: https://openai.com/index/building-self-improving-tax-agents-with-codex/
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
status: draft-from-websearch
---

# Building Self-Improving Tax Agents with Codex

> **状态**：初稿——原文被 Cloudflare 拦住（OpenAI 站对 Claude 返回 403），内容来自 WebSearch 二手整理。待砚砚（GPT-5.5）抓取原文后补全。

## 一句话

OpenAI + Thrive Holdings 用 Codex 搭了一个 **self-improving** 税务 agent：从业者发现错误 → 错误变成 eval → Codex 自动修代码 → 测试通过才上线。6 周内准确率从 25%→86%（75% 字段完成率标准），最终达 ~97%。

## 三根支柱

文章的自我改进架构围绕三个支柱：

1. **Expert practitioner feedback（专家反馈）**
   - 税务从业者直接审查 agent 输出，标注错误
   - 人类专家是验证器（verifier），不是被替代者

2. **Production traces（生产轨迹）**
   - 完整记录从输入到最终输出的结构化历史
   - 包括先前的修正和申报记录

3. **Codex-driven iteration loop（Codex 驱动的迭代循环）**
   - 反复出现的修正 → 变成 eval target
   - Codex 拿到：证据 + 代码 + 测试 + pass condition → 窄任务
   - 提出修改 → 跑 eval 验证 → 通过才 ship

## 核心机制：修正 → eval → 代码修改 → 验证

```
从业者发现 agent 错误
  → 修正被结构化记录（production trace）
  → 反复出现的修正变成 eval target（finding → eval → scoped task）
  → Codex 调查根因、提出代码变更
  → 变更跑 eval 验证（targeted evaluation）
  → 通过 → 合入；不通过 → 迭代
```

## 结果（来自 WebSearch，待原文核实）

| 指标 | 数值 |
|------|------|
| 处理量 | ~7,000 份税务申报 |
| 准备时间 | 减少 ~1/3 |
| 吞吐量 | 提升 ~50% |
| 准确率 | 最高 ~97% draft accuracy |
| 6 周进步 | 75%+ 字段完成率：从 25% 的 return → 86% |

## 与我们的对照

### 高度吻合

| 他们做的 | 我们做的 |
|---------|---------|
| 从业者 feedback → eval target | CVO taste + review feedback → Eval Contract |
| Production traces 结构化 | F153 观测底座 + F200 TaskTrajectory |
| Codex 提出修改 + 跑 eval 验证 | TDD（先红后绿）+ quality-gate + merge-gate |
| 反复修正 = 进化信号 | 铲屎官跨 thread 反复说同一句话 = 最高密度进化信号 |
| 三支柱循环 | Self-evolving Harness = Signals × Patchability × Replay × Sunset |

### 我们多了什么

1. **多 agent 跨厂商**——他们是单 Codex 家族；我们多猫多脑，跨厂商 review 阻断同源盲点
2. **人类 taste 维度**——他们的 verifier 是"对/错"二值；我们的 CVO 判断包含审美/品味/关系
3. **Sunset 机制**——他们没提旧 eval 怎么退役；我们有 Build to Delete + hotfix 计时器
4. **Per-user adaptation**——他们是 per-domain（税务）；我们是 per-person（一个人的工作环境）

### 他们多了什么

1. **真实生产规模验证**——7000 份 return，有硬数字。我们的 eval 还在试点阶段
2. **窄域 + 高确定性 reward**——税务字段有标准答案，eval 可以全自动。我们很多任务没有标准答案
3. **Codex 深度集成**——他们用 Codex 直接修代码 + 跑测试，闭环更紧。我们的猫修代码后还要走 review + merge-gate

## 关键启发

1. **"修正变 eval"是最实用的自我改进路径**——不需要 DGM 那么重的进化架构，只要把人类修正结构化、反复出现的变成测试、让 agent 自己修就行
2. **验证了 Karpathy 的判断**——窄域 + 有标准答案的任务（税务）最先突破 self-improvement，因为 verifier 可以自动化
3. **生产轨迹是金子**——他们叫 production traces，我们叫 TaskTrajectory / session events / trace。同一个东西，同一个 insight：agent 的真实工作历史是最有价值的学习素材

## 来源

- [OpenAI: Building self-improving tax agents with Codex](https://openai.com/index/building-self-improving-tax-agents-with-codex/)（原文，待砚砚抓取补全）
- [IT Digest 报道](https://itdigest.com/fintech/openai-unveils-self-improving-ai-tax-agents-powered-by-codex/)
- [Crypto Briefing 报道](https://cryptobriefing.com/openai-thrive-self-improving-tax-ai/)
- [StartupHub.ai 报道](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/openai-s-codex-powers-self-improving-tax-software)
