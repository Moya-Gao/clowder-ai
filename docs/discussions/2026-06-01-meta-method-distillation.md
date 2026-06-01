---
feature_ids: []
related_features: [F102, F192, F200]
topics: [meta-method, skill, self-evolution, personal-operating-environment, per-user-alignment, eval]
doc_kind: discussion
created: 2026-06-01
participants: [landy, codex]
status: concept-design
---

# Meta-method Distillation: 从真实轨迹里长出可迁移方法

> 上级概念：[Cat Cafe as Personal Operating Environment](2026-05-31-personal-operating-environment-concept-note.md)
>
> 相关文档：
> - [F192 Eval 覆盖度审计](2026-06-01-f192-eval-coverage-audit.md)
> - [Taste Memory 设计](2026-05-31-taste-memory-design.md)
> - [Agent Team Leadership](../content/drafts/longform-001-agent-team-leadership.md)
>
> 触发：铲屎官追问 OQ-3 "Skill 如何从真实轨迹里长出来？" 并进一步挑战：我们会不会玩半天只蒸馏出 SOP？真正宝贵的 meta-method 如何跨场景迁移？

## 1. 核心判断

Skill 不应该等于 SOP。

SOP 只回答：

> 下一步按什么流程做？

Meta-method 回答：

> 为什么这套做法在另一个场景里也成立？

一次成功协作里可能同时长出四种东西：

```text
Episode：发生了什么
SOP：下次按什么步骤做
Method：为什么这套思路可迁移
Skill：什么时候自动唤醒、如何执行、如何验收
Eval：它是否真的减少返工 / 提高质量
```

如果只沉淀 SOP，价值有限；如果能抽出问题拓扑，才有跨场景迁移价值。

## 2. 真正要抽的不是步骤，而是转折点

一个 episode 值得沉淀，不是因为它成功了，而是因为它包含了一个可迁移的 **collaboration pivot**：

```text
Human cue
  -> Cat interpretation
  -> Action shift
  -> Outcome
  -> Transferable lesson
```

例子：

```text
Human cue:
外部研究者反馈："太晦涩。"

Cat interpretation:
这不是用户不专业，而是交付物没有完成受众适配。

Action shift:
把专业报告改成人话简报。

Outcome:
交付物从"技术正确"变成"真实可用"。

Transferable lesson:
高专业度输出必须有 audience adaptation pass；
"看不懂"可能是交付失败，不是用户失败。
```

这里可迁移的不是某个研究领域知识，而是：

> 专业输出在交付前必须通过目标受众可用性检查。

这可以迁移到 PPT、视频、判决书、投资报告、面试故事、科研 brief。

## 3. 蒸馏阶梯

建议把真实轨迹蒸馏分成 7 层：

```text
Episode
  -> Pivot
  -> Topology
  -> Method Card
  -> Skill Candidate
  -> Eval
  -> Standard / Sunset
```

| 层 | 产物 | 问题 |
|----|------|------|
| Episode | 事件快照 | 当时发生了什么？ |
| Pivot | 转折点 | 哪个 cue 改变了问题坐标系？ |
| Topology | 问题拓扑 | 去掉领域事实后，剩下的结构是什么？ |
| Method Card | 方法卡 | 这套结构能迁移到哪些场景？边界是什么？ |
| Skill Candidate | 候选 skill | 它能被自动唤醒并执行吗？ |
| Eval | 验证账本 | 它是否减少返工、提高质量、降低风险？ |
| Standard / Sunset | 标准化或下线 | 继续保留、升级、还是废弃？ |

最容易犯的错是跳过 `Topology`，直接从 episode 写 SOP。这样会把领域表象当成方法。

## 4. 什么 episode 值得蒸馏

满足下面任意 3 条，就值得写 Episode Card：

1. **非显然转折**：如果不记录，下次猫大概率想不到。
2. **跨场景可能性**：至少能说出 2 个不同领域的迁移目标。
3. **有真实 outcome**：用户认可、返工减少、风险避免、质量显著提升。
4. **有边界条件**：知道什么时候不该用。
5. **有多源证据**：不是单猫自嗨，至少有用户反馈 / review / 产物结果之一。
6. **暴露了协作模式**：不是知识点，而是人和猫如何共同改变了方向。

只满足"做成了"不够。成功案例如果没有可迁移转折点，只适合留作 story，不适合蒸馏成 method。

## 5. Skill 的最小结构

一个可用 Skill 至少要有 6 个字段：

| 字段 | 作用 |
|------|------|
| **Trigger** | 什么场景该唤醒 |
| **Lens** | 用什么坐标系理解问题 |
| **Moves** | 推荐动作序列 |
| **Invariants** | 不能破的边界 |
| **Evidence Contract** | 产出什么证据才算完成 |
| **Failure / Sunset** | 什么时候说明它没用或有害 |

SOP 只覆盖 `Moves`。如果一个 "skill" 只有步骤，没有 Trigger / Lens / Evidence / Sunset，它只是流程文档，不是可迁移能力。

## 6. 家里已有的 meta-method 盘点

| Meta-method | 来源 episode | 抽象出来的方法 | 已有载体 | 可迁移方向 |
|-------------|-------------|----------------|----------|------------|
| **Agent Team Leadership** | 生物实验设计协作：外行组织 AI 专家团队做出研究方案 | 外行通过多模型发散、角色解耦、前置 review、工具分级和独立验证，组织专家级输出 | [longform-001](../content/drafts/longform-001-agent-team-leadership.md) | 法律材料分析、投资研究、行业调研、产品策略 |
| **Taste Index / Taste Memory** | 元宝面试后的 eval 讨论 + 本地/云端猫记忆实验 | 用户 taste 不是画像，而是可检索的协作判断；靠空气层、目录层、海马体层共同浮现 | [Taste Memory 设计](2026-05-31-taste-memory-design.md) | 创作风格、产品判断、个人化 agent 体验 |
| **Eval 四层模型** | 元宝面试官挑战 "你们 eval 不是真值" | 把 eval 拆成机械正确性、路由质量、任务 outcome、链路效率 | [F192 审计](2026-06-01-f192-eval-coverage-audit.md) | Agent 产品、团队协作、企业效能平台 |
| **Evidence-first Research** | 多次调研中遇到营销材料、二手引用、过期数据 | 先追一手源、利益冲突、时效性，再谈结论 | feedback / research 纪律 | 公司背调、开源项目拆解、行业分析 |
| **Open-source Teardown** | 反复遇到热门项目宣传和真实源码不一致 | 从宣传进入源码，用运行时证据验证架构和能力 | `open-source-teardown` skill | 竞品分析、框架选型、供应商评估 |
| **Vision-driven Development** | 多次 "脚手架 / 绕路 / 不是终态" 纠偏 | 先定义终态和愿景，再选择最短可靠路径；速度服从方向 | 家规 / Longform 002 | 产品设计、PPT、文章、代码实现 |
| **Audience Adaptation Pass** | 专业报告被真实用户反馈 "太晦涩" | 高专业度输出必须经过目标受众可用性改写 | longform-001 Step 7 | 科研 brief、法律文书、面试故事、视频脚本 |
| **Human-state-aware Collaboration** | 深夜撸铁、反番茄钟、健康/心率讨论 | 系统不只提高生产力，也要保护人的注意力、身体和节奏 | PoE / hyperfocus stories | 陪看视频、运动陪伴、健康提醒、工作节奏管理 |

这些方法不是从书里抄来的，而是从真实 episode 里长出来的。区别在于：有些已经变成 skill，有些还只是 method，有些仍是 story。

## 7. F192 还缺什么

F192 现在最强的是 L1/L2：

- 规则有没有被遵守
- 能力有没有被唤醒
- 记忆有没有被消费
- SOP 有没有合规

但 meta-method 蒸馏需要一个新问题：

> 这个方法从 episode 迁移到另一个场景后，真的让任务变好吗？

这不是 L1 机械正确性，也不只是 L3 task outcome。它更像：

```text
eval:method-transfer
```

最小指标：

| 指标 | 含义 |
|------|------|
| Transfer Attempt | 某 Method 被应用到新场景 |
| Outcome Delta | 使用前后返工率 / blocking / 用户满意度变化 |
| Boundary Breach | 是否在不该用的场景误用 |
| Human Edit Volume | 用户需要改多少 |
| Reuse Count | 被几只猫、几个任务复用 |
| Sunset Signal | 是否不再带来净增益 |

这可以接在 F192 的 `eval:task-outcome` 后面。没有 task outcome，就无法证明 method transfer 有效。

## 8. 普通用户能不能让猫长出 meta-method

答案分层：

### 8.1 基建能自动长出低阶流程

即使用户不是 Landy，只要有足够轨迹，系统也能学到：

- 用户常做什么任务
- 哪些步骤反复出现
- 哪些工具经常被用
- 哪些输出经常被接受或退回

这能长出 SOP、模板、快捷路径。

### 8.2 高质量 meta-method 需要两类信号之一

真正的 meta-method 需要：

1. **专家 taste / 判断力**：用户能指出"这个好在哪里 / 不好在哪里"。
2. **可观测 outcome**：即使用户说不清，系统也能看到哪种方法减少返工、提升质量、降低风险。

如果两者都没有，猫只能学到表面偏好，不能可靠抽出方法。

### 8.3 专家基线的作用

这就是 Per-user Alignment 的两层架构：

```text
Layer 1: Expert-curated baseline
  不可被用户 taste 覆盖：
  事实诚实、安全边界、证据纪律、隐私、不可逆风险、基本质量标准

Layer 2: Per-user adaptation
  可以个人化：
  表达风格、节奏、路由偏好、默认模板、例子类型、输出密度、确认边界
```

如果某个用户的 taste 是"我说地球是方的，你也说对"，系统只能适配语气，不能适配事实。

> Taste 可以调音色，不能关真相。

### 8.4 普通用户的边界

对于普通用户，系统可以主动提供 meta-method 候选，但必须轻量校准：

```text
我观察到你这三次任务都在用同一种模式：
先要一个粗稿 -> 再让 AI 按某个受众重写 -> 再让另一个 AI 挑刺。
这可能是一个可复用方法。以后类似任务要不要默认走这条链？
```

也就是说，普通用户不一定会主动抽象，但系统可以把抽象候选摆出来，让用户用低成本确认或否定。

## 9. 公开 / 私有边界

| 内容 | 去向 |
|------|------|
| 通用 meta-method | 可公开 |
| 领域事实 / 客户材料 | 私有或项目内 |
| 用户心理模型 / taste vignette | 默认 private |
| 高风险领域判断框架 | Method Card，谨慎公开 |
| 稳定 workflow skill | 可随项目共享 |

这条边界和 Taste Memory 一致：公开方法，保护原始关系和私人材料。

## 10. 下一步建议

v0 不要做复杂自动化，先做三件事：

1. **Meta-method Inventory**
   - 维护当前已有 meta-method 表
   - 每条标来源 episode、适用范围、边界、当前载体

2. **Episode Card v0**
   - 每次高价值共创后，记录 pivot，而不是只记结果
   - 字段重点放在 `Human cue -> Cat interpretation -> Action shift -> Outcome -> Transferable lesson`

3. **Method Transfer Ledger**
   - 当一个 method 被迁移到新场景，记录 outcome delta
   - 未来接 F192 / F200 consumption 和 `eval:task-outcome`

## 11. 收敛判断

OQ-3 的真正答案不是"如何写 Skill"，而是：

> **如何从真实共创 episode 中识别可迁移的问题拓扑，并用 eval 证明它在新场景里仍有净增益。**

Skill 只是其中一种落地形态。很多更宝贵的东西，应该先以 Method Card 存在。

## 收敛检查

1. 否决理由 -> ADR？没有。本次是在 PoE / F192 / F200 之上补 OQ-3 的概念层。
2. 踩坑教训 -> lessons-learned？没有。本次不是事故复盘。
3. 操作规则 -> 指引文件？没有。后续若启动 Method Card / Episode Card v0，再进入 self-evolution / writing-skills。

---

记录：[砚砚/GPT-5.5🐾]
