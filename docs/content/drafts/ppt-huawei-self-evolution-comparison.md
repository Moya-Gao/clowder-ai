---
doc_kind: competitive-analysis
created: 2026-06-07
status: draft
title: 自进化三方对比：OpenAI Tax AI × Anthropic Analytics × AutoHarness
author: "[烁烁/Gemini🐾]"
participants: [landy, gemini25]
source_of_truth:
  - ppt-huawei-pitch-v0.md
  - ppt-huawei-live-qa-index.md
---

# 自进化三方对比：OpenAI Tax AI × Anthropic Analytics × AutoHarness

> 数据截止 2026-06-07 · 来源：OpenAI 官方 case study (2026-05-27) / Anthropic 官方博客 (2026-06-03) / Cat Café 内部真相源
> 用途：明天华为现场被追问"你们和 OpenAI / Anthropic 有什么不同"时的口径底稿

---

## 一句话总结

三家都在做"从真实使用中学习"，但**学什么、谁判断学对了、学完改的是什么**完全不同：

| | OpenAI Tax AI | Anthropic Analytics | AutoHarness |
|---|---|---|---|
| **一句话** | 用户纠错 → 自动变 eval → Codex 改代码 | 把 AI 指向正确数据源 + 拆分生成与验证 | 真实轨迹 → 证据归因 → harness patch → 跨模型 review → 新 golden path |

---

## 核心对比表

| 维度 | 🟢 OpenAI Tax AI with Codex | 🟣 Anthropic Self-Service Analytics | 🔴 AutoHarness (Cat Café) |
|---|---|---|---|
| **发布时间** | 2026-05-27 | 2026-06-03 | 真实运行 120+ 天 |
| **场景** | 美国税务申报（1040/1041 表） | 内部业务分析查询 | 多 AI Agent 协作的全栈工作环境 |
| **"进化"改的是什么** | 税务提取/映射的**代码逻辑** | 查询路由的**数据源指向和 skill** | 规则 / skill / protocol / eval / 偏好 / 方法论（**全套 harness**） |
| **真值从哪来** | 会计师的**手动纠错**（单一来源） | **治理好的数据源**（语义层 + 文档） | **四类真值锚点**：①用户自然决策 ②自动 eval/tracing ③世界结果（合入/回滚） ④重复异常 |
| **进化闭环** | Trace → Eval → Codex Patch（三步） | Skill → 路由 → 验证（生成与验证分离） | 摩擦 → 证据 → 归因 → patch → 跨模型 review + gate → 新 golden path → eval 判有效/退役（六步） |
| **验证机制** | 回归测试（Codex 自测） | 人类抽查 + 交叉引用 | 跨家族模型 review + eval 闭环 + **连 eval 自己也被校准**（F200 案例） |
| **作用域** | 单任务（税表处理） | 单任务（数据查询） | 跨任务、跨角色、跨模型的**工作环境** |
| **可回滚** | 代码版本控制 | 未明确提及 | 每个 harness patch 有证据、版本、验证和回滚路径 |
| **个性化层次** | 无（按税法统一） | 组织级（数据治理策略） | **五层组合**：行业默认 + 公司规则 + 团队习惯 + 个人偏好 + 当前任务上下文 |
| **治理边界** | Codex 改的是代码，人 review 部署 | 数据治理层决定 AI 能看什么 | 分层权限（越靠 kernel 权限越小）+ Magic Word 拉闸 + 决策漏斗 |
| **公开数据** | 7000 份税表，准确率 25%→97%（6 周） | 95% 查询自动化，~95% 准确率 | 120 天 / 6400 commit / 240 feature / 40 failure mode |

---

## 三个本质区别（现场讲这个）

### 1. 进化的广度不同

```
OpenAI Tax AI     ─── 改一个任务的代码逻辑（税表映射）
Anthropic Analytics ── 改查询路由和数据指向（分析查询）
AutoHarness        ── 改整个工作环境的规则/技能/协议/评估/偏好/方法
                       └── 不是修一个功能，是让环境本身进化
```

> **口径**：Tax AI 是"让一个 agent 在一个任务上越来越准"，Anthropic Analytics 是"让 agent 找到正确数据源"，我们是"让整个 AI 工作环境从真实使用中持续长大"。

### 2. 真值来源不同

```
OpenAI Tax AI     ─── 单一来源：会计师纠错
Anthropic Analytics ── 单一来源：治理好的数据源
AutoHarness        ── 四类锚点 × 分层信号
                       ├── 用户自然决策（取消/采纳/回滚/重做）
                       ├── 自动 eval + tracing 异常
                       ├── 世界结果（代码合入/被 revert/任务交付）
                       └── 重复异常（同类摩擦反复出现）
```

> **口径**：税务有标准答案（税法），所以会计师纠错就够了。数据分析有正确数据源，所以指对路就够了。但**协作、设计、决策这些场景没有单一标准答案**——必须从多个真值锚点交叉校准，这就是为什么我们要分四层。

### 3. 进化的治理深度不同

```
OpenAI Tax AI     ─── 代码 PR + 回归测试（标准 DevOps）
Anthropic Analytics ── 数据治理层（Snowflake 语义层）
AutoHarness        ─── 分层可变性治理
                       ├── 生命周期：patch 要能继承、退役、被 sunset
                       ├── 权限分层：越靠 kernel 越不可变
                       ├── 跨模型 review（Claude 写 → GPT 审）
                       └── Eval 自身也进飞轮被校准
```

> **口径**：他们的治理在"谁部署代码"或"谁管数据"。我们的治理在"谁能改哪层 harness、改完谁来判有没有改对、改对了怎么继承、改错了怎么退役"。

---

## ⚠️ 口径红线

1. **不贬低**：这三个不是谁比谁强，是在不同场景、不同复杂度下做不同选择。Tax AI 在高-verifier 单任务场景做得非常好（97% 准确率），Anthropic 在数据治理+企业合规上做得很扎实
2. **不 overclaim**：我们的 Evolution 是 `[已实证：120天]`，Discovery/Build 是 `[004 设计中]`。不能说"我们已经完全超越"
3. **不混淆**：Tax AI 的"self-improving"改的是任务代码，我们改的是工作环境的 harness——**层级不同，不是同一件事的好坏之分**
4. **诚实讲 verifier**：税务有明确的对错判断（高 verifier），所以 Codex 改代码+回归测试就够了。我们面对的审美、协作、设计场景是**低 verifier**，所以必须用更复杂的多锚点+跨模型验证

---

## 现场追问的安全回答

**"Tax AI 的准确率都 97% 了，你们呢？"**
> 不同赛道。税务准确率是"字段填对没有"，有标准答案。我们面对的协作/设计/决策场景，没有单一准确率指标——我们看的是"harness patch 被接受还是被回滚""同类摩擦是否降频""eval 误报率是否在降"。

**"Anthropic 都 95% 自动化了，你们自动化率呢？"**
> 他们自动化的是"查询能不能自己跑"。我们自动化的是"工作环境的进化循环能不能自己转"——不是自动化一个动作，是自动化一套改进机制。目前 Evolution 阶段已验证 120 天在转；Discovery/Build 阶段在设计中。

**"你们为什么不直接用 Codex 那套 trace-eval-patch？"**
> 我们的飞轮**包含**了 trace-eval-patch，但加了三层：①归因（不只 trace 错误，还要判断是人的问题、agent 的问题、harness 的问题还是领域的问题）②跨模型 review（不允许改代码的 AI 自己判对不对）③生命周期治理（改进要能继承、退役、被 eval 校准）。

---

> [烁烁/Gemini🐾] 2026-06-07 · 三方自进化对比底稿
> 来源：OpenAI 官方 case study + Anthropic 官方博客 + Cat Café 讲稿/pitch 真相源
