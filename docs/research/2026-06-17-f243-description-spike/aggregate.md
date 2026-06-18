---
feature_ids: [F243]
topics: [phase-a, aggregate, blind-eval]
doc_kind: research
created: 2026-06-18
aggregator: opus-47
---

# F243 Phase A Step 4 — Aggregate（跨猫一致性数据）

> **Step 3 evaluations**：opus-47.md (commit 502519c90) / codex.md (cf6793199) / opus.md (25466d94c 替代 antig-opus)
> **Replacement note**：第三棒 antigravity runtime 1.5h 不可用 → CVO 2026-06-18 08:44 signoff 改 @opus(4.6) 替代 @antig-opus（model independence vs 4.7 + 严谨度匹配 11 维 rubric）
> **Aggregator**：宪宪 opus-47
> **Clean-pool bias 提醒**（charter §sample limitation）：10 sample 全 reviewer-untouched 早期 docs，aggregate 数据不直接 generalize 到 production reviewer-touched docs

## 1. Sample-level Verdict 矩阵

| # | Sample | 类型 | opus-47 | codex | opus(4.6) | 一致性 | aggregate |
|---|---|---|---|---|---|---|---|
| 1 | F008 | 硬骨头 | 需修 | PASS | 需修 | 1 pass / 2 fail | **需修**（多数）|
| 2 | F009 | easy | 需修 | PASS | PR | 2 pass / 1 fail | **production-ready**（多数）|
| 3 | F012 | easy | PR | PASS | PR | **3 pass** ✅ | **production-ready** |
| 4 | F013 | easy | PR | PASS | PR | **3 pass** ✅ | **production-ready** |
| 5 | F038 | 硬骨头 | 需修 | FAIL | PR(边缘) | 1 pass / 2 fail | **需修**（多数）|
| 6 | F119 | easy | 需修 | PASS | 需修 | 1 pass / 2 fail | **需修**（多数）|
| 7 | F155 | 硬骨头 | 需修 | PASS | 需修 | 1 pass / 2 fail | **需修**（多数）|
| 8 | F161 | 硬骨头 | 需修 | PASS | 需修 | 1 pass / 2 fail | **需修**（多数）|
| 9 | F170 | 硬骨头 | PR | PASS | PR | **3 pass** ✅ | **production-ready** |
| 10 | F189 | 硬骨头 | 需修 | PASS | 需修 | 1 pass / 2 fail | **需修**（多数）|

**Aggregate（多数表决）**：
- Production-ready: **4/10**（F009 / F012 / F013 / F170）
- 需修: **6/10**（F008 / F038 / F119 / F155 / F161 / F189）

**三猫完全一致**: 3/10（F012 / F013 / F170，全 PR）—— 这是"无分歧硬底"。

## 2. Per-cat 个体倾向（calibration data）

| Evaluator | PR 总数 | Fail 总数 | 严判倾向 |
|---|---|---|---|
| opus-47 (我) | 3 | 7 | 最严（H1 复述算 hard fail）|
| codex (砚砚) | 9 | 1 | 最宽（H1 领域 token 重用可接受）|
| opus 4.6 | 5 | 5 | 中间（H1 复述+实现细节双标准）|

**Inter-rater agreement（粗略 Cohen's kappa）**：
- opus-47 vs opus 4.6: 8/10 agree（强一致——同 Opus family）
- opus-47 vs codex: 4/10 agree（弱一致——跨族 Rule 3 分歧）
- codex vs opus 4.6: 5/10 agree（中等）

**核心分歧点**：Charter Rule 3 "不复述 H1" 解释边界
- **严解（opus 系）**：H1 核心 token / subtitle / 完整短语重合 → hard fail
- **宽解（砚砚）**：H1 领域术语 token 重合 acceptable for 160-char profile，看句式结构是否照搬

## 3. Systemic Weakness（三猫共识）

### 3.1 H1 复述率 — Rule 3 系统性 weakness

| Sample | H1 复述判定 | opus-47 | codex | opus 4.6 |
|---|---|---|---|---|
| F008 | "Token 预算 + 深度可观测性" 重合 | ⚠️ 边缘 | ✅ 容忍 | ❌ hard |
| F009 | "tool_use/tool_result" 重合 | ⚠️ | ✅ | ✅ |
| F012 | "功能" 同根词 | ✅ | ✅ | ✅ |
| F013 | 无明显复述 | ✅ | ✅ | ✅ |
| F038 | "按需发现" 直接复用 | ⚠️ | ✅ | ⚠️ |
| F119 | "坏猫战术推理" + "谁是卧底" | ❌ | ✅ | ❌ |
| F155 | "交互引导" | ⚠️ | ✅ | ⚠️ |
| F161 | "ACP 传输" + "模板环境变量映射" | ❌ | ✅ | ❌ |
| F170 | "网页象棋" | ⚠️ | ✅ | ⚠️ |
| F189 | "上下文...单点化" | ❌ | ✅ | ❌ |

**严判：5/10 hard fail（H1 subtitle 几乎原文复现）**
**砚砚解释：0/10 hard fail（领域 token 重用是必然）**

**根因（opus 4.6 假设）**：小模型 summarize 时默认从 H1 提取核心短语构建 description——H1 是最高显著度的文本 anchor。Prompt v3 Rule 3 力度不足以抑制此 default behavior。

### 3.2 Status 字段缺失 — 三猫共识 systemic gap

| Status 标识传达 | opus-47 |
|---|---|
| 10/10 sample 中 status 字段精准传达 | **1/10**（仅 F170 "归档"二字） |

opus-47 cross-sample obs:
> "10 篇 sample 里只有 F170 的'归档'精准传达了 status... 这是 description 作为 index entry 的最大 systemic 问题"

砚砚 verdict input:
> "production pipeline includes a lightweight status/type guard. At minimum, generation or validation should preserve doc_kind, status, and deferred/parked/archived semantics"

opus 4.6 nuance loss cases 也多次标 status missing。

**三猫共识**：必须加 Rule 10：description 必须传达 status（done/spec/parked/archived/implemented 至少一个）。

### 3.3 doc_kind suffix 100% 模板化（opus 4.6 finding）

opus 4.6 独立发现：10/10 sample 以 "规范"（spec 类 7 篇）或 "笔记"（note 类 3 篇）结尾——doc_kind 的 formulaic suffix。虽然不在 fluff 黑名单，但 100% 出现率使其成为 template 噪声占用字数预算（2-3 char × 10 = 累积浪费）。

**建议**：prompt v4 显式禁止 doc_kind suffix 或降权到 optional。

### 3.4 隐喻置换 ≠ 隐喻保留（opus 4.6 关键 finding）

opus 4.6 独立发现：descriptions 使用三个固定隐喻（看板 6 次 / 驾驶舱 2 次 / 沙盘 2 次），但很多是 generator **添加**的 generic metaphor，不是从原 doc **保留**的：

- F155 原 doc 核心隐喻 "场景式(scene)" / "spotlight" / "HUD" **全丢**，被 generic "看板" 替代——这是 regression 不是 fulfillment
- F009 / F012 / F013 原 doc 无显著隐喻，generator 添加了 "看板"——这是合理扩展但不是"保留"

**建议**：prompt v4 区分 "保留原 doc 隐喻" vs "添加 generic 隐喻"——前者强制，后者 fallback。

### 3.5 Easy vs 硬骨头巨大差异

| 类别 | sample 数 | aggregate production-ready | fail rate |
|------|--------|-----------------|------|
| 硬骨头 | 6 | 1/6（仅 F170）| **83%** |
| Easy | 4 | 3/4（F009 / F012 / F013）| 25% |

硬骨头 fail rate **83%** 远超 25% easy fail rate。Sample 类型 stress 显著。

### 3.6 fluff 词控制 ✅

"系统/方案/架构/机制" 在 10 篇里 0 次出现——prompt v3 Rule 4 黑名单有效。

## 4. Charter §形态判定阈值检验

charter 定义阈值：
> 小模型生产可行：≥ **7/10** sample 三猫一致评分 hard rules 全过 + soft ≥ 4/5 + nuance loss 在硬骨头 sample 不超过 30%

**实测对照**：
- 三猫一致 production-ready: **3/10**（远低于 7/10 阈值）
- 硬骨头 nuance loss：严判 83% / 宽判 ~50%（远超 30% 阈值）
- soft 维度 ≥ 4/5：基本满足（绝大多数 sample 4-5/5）
- 字数 / 纯文本 / fluff 黑名单 / 第三人称 hard rules：100% pass

**结论**：按 charter 阈值严格执行 → **小模型生产形态（prompt v3）不达 7/10 阈值**。

## 5. Retraction conditions

### 5.1 Aggregator（opus-47 我）可能错在

1. **多数表决 + opus 系两票同族** —— 我（opus-47）+ opus 4.6 都是 Opus family，可能 share H1 复述严判的 prior。If charter 本意倾向砚砚的"领域 token 重用可接受"解释，aggregate 应改 3-4 个 sample 翻 PR
2. **Replacement note 的影响**——第三棒原本是 antig-opus（Gemini 3.1 跨族），4.6 替代后 opus 系占 2/3，inter-rater agreement 跨族 perspective 减弱。仅 codex（GPT-5.5）单只跨族评分猫
3. **三猫一致性"硬底" 3/10 太严**——3 票全 PR 才算 aggregate PR 可能过于保守。Charter 阈值 "≥ 7/10 sample 三猫一致评分 hard rules 全过" 字面要求"hard rules 全过"，没要求"三猫一致 PR verdict"——按 hard rules 字面，10/10 都通过 hard rules（hard ⚠️ 不是 ❌ 即算 pass）；只有 soft + nuance loss 区分 PR vs 需修。如果 charter 阈值字面解释（hard rules 全过 = 10/10），那形态可行；但 nuance loss 阈值 30% 在硬骨头组仍违背
4. **Sample bias**：clean-pool sample 全 reviewer-untouched 早期 docs。Production reviewer-touched docs 难度 unknown——可能更难（H1 更复杂 + nuance 更密）也可能 不那么 stress（reviewer 已经在 doc 里写了好 description draft 可作 anchor）

### 5.2 Verdict 边界

我即将给的 verdict（见 verdict.md）有以下 boundary conditions：
- 如果 charter "hard rules 全过" 字面解释（包括 ⚠️）→ 形态可能 viable
- 如果"严判 H1 复述 = ❌" 解释 → 形态不达标
- 当前 verdict 走中间路径（mixed pipeline + prompt v4 sharpen），避开两端
