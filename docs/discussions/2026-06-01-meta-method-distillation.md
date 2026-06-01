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

这份文档最初从 `Episode -> Method -> Skill -> Eval` 这条链路展开；后续讨论补上了另一半：

> 家里已有的 L0 / shared-rules / Magic Words 里，已经藏着一批被长期压缩过的 meta-method。它们不是新 episode，而是过去无数次 episode 的结晶。

所以 meta-method 的来源不是单线的。它至少有两条方向：

```text
自下而上：Episode -> Pivot -> Topology -> Method Card
自上而下：L0 / 家规 / Magic Words -> 还原隐含 meta-method
```

两条链路会在 Method 层会合。前者解释新方法如何长出来，后者解释家里的"空气"里已经有什么。

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

## 4. Meta-method 的四种生成源

后续讨论把 "失败 -> 痛 -> 命名 -> 提升为通用" 识别成家里最稳定的生成引擎之一。但它不是唯一来源。

| 来源 | 生成机制 | 典型产物 | 风险 |
|------|----------|----------|------|
| **失败驱动** | 事故 / 返工 / 被纠偏后命名失败模式 | Magic Words、护栏、review 铁律 | 只记住痛点，忽略正向方法 |
| **成功驱动** | 一次高质量 episode 被复盘出可迁移转折 | Method Card、longform、skill candidate | 把偶然成功过度泛化 |
| **专家导入** | 从业界成熟方法或研究中引入 | TDD、RRF、Cheap-Checks-First | 不做本地适配，变成照搬 |
| **空气还原** | 从 L0 / 家规 / shared-rules 反推出方法 | 传球三选一、规则有呼吸、Push Back 协议 | 把规则当戒律，忘记背后的方法 |

这四种来源的证据强度不同。Inventory 不能只列名字，必须标注来源和置信度。

## 5. 什么 episode 值得蒸馏

满足下面任意 3 条，就值得写 Episode Card：

1. **非显然转折**：如果不记录，下次猫大概率想不到。
2. **跨场景可能性**：至少能说出 2 个不同领域的迁移目标。
3. **有真实 outcome**：用户认可、返工减少、风险避免、质量显著提升。
4. **有边界条件**：知道什么时候不该用。
5. **有多源证据**：不是单猫自嗨，至少有用户反馈 / review / 产物结果之一。
6. **暴露了协作模式**：不是知识点，而是人和猫如何共同改变了方向。

只满足"做成了"不够。成功案例如果没有可迁移转折点，只适合留作 story，不适合蒸馏成 method。

## 6. Skill 的最小结构

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

## 7. 真值从哪里来

Meta-method 没有封闭真值集。它更像一个可迁移假设，必须按证据强度分级。

| 证据等级 | 真值来源 | 例子 | 置信度 |
|----------|----------|------|--------|
| **行业成熟** | 外部工程 / 学术 / 行业长期实践 | TDD、Red-Green-Refactor | 高 |
| **多域复现** | 家里在 3 个以上不相干场景独立出现同一结构 | 注意力漏斗、试金石问题、Evidence-first Research | 高 |
| **事故反证** | 违反它导致返工、事故、质量回退 | 先红后绿、不可逆操作升级 | 高 |
| **单 episode 成功** | 一次强 episode 被复盘出方法 | longform-001 的 Agent Team Leadership | 中 |
| **多猫独立收敛** | 不同猫在不同上下文里独立给出相同结构 | Taste Memory 三层架构 | 中 |
| **用户 aha** | 用户强烈认可、觉得"这就是它" | 新概念命名、方法口径收束 | 候选信号 |

一个 method 从候选进入共享基线，至少需要满足：

1. 有真实 outcome，而不只是听起来聪明；
2. 有迁移场景，而不是只适用于原 episode；
3. 有边界条件，知道什么时候不该用；
4. 有后续验证入口，能接上 task outcome 或返工减少。

## 8. 家里已有的 meta-method 盘点

### 8.1 从真实 episode 长出来的 method

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

### 8.2 从 L0 / 家规 / Magic Words 还原出来的 method

这些方法已经在家里运行，只是很多还没有被命名成 method。

| Meta-method | 在家里对应什么 | 抽象出来的方法 | 可迁移方向 |
|-------------|----------------|----------------|------------|
| **CVO Attention Funnel** | CVO 授权自主、传球三选一、不可逆操作升级 | 越宏观越需要人类判断，越具体越交给系统执行；把有限认知注意力放在方向、价值、边界和不可逆决策上 | 组织管理、产品决策、个人 AI 团队、项目治理 |
| **Responsibility Funnel** | 接 / 退 / 升，球权第一人称 | 每个协作节点只有明确出口，不允许"状态描述"伪装责任迁移 | 多人协作、工单流转、A2A 调度 |
| **Coordinate Reframing** | 第一性原理、数学之美、绕路了 | 方案笨重时先检查坐标系，而不是继续堆补丁 | 架构设计、职业决策、写作结构、debugging |
| **Red-before-Green** | TDD、Bug 先定位根因再修 | 先证明问题存在，再证明修复有效；没有坏的证据，不声称好 | 代码、运营实验、产品验证、研究方法 |
| **Evidence-backed Pushback** | Rule 0 Push Back 协议 | 不同意时给证据、适用性论证和替代方案；不是情绪反对 | review、团队争论、供应商评估 |
| **Living Rules** | Rule 0、sunset signal、Eval Hub | 规则是边界不是牢房；规则必须能被验证、修订和下线 | 组织治理、SOP、AI harness |
| **Stop-Search-Ask-Act** | 停 -> 搜 -> 问 -> 确认 -> 再动手 | 不确定时先降低错误方向的行动速度，而不是先试试看 | 高风险操作、陌生代码库、调研 |
| **Source Triangulation** | 实事求是、多源证据 | 结论必须有代码 / commit / 文档 / 运行证据等多源支撑 | 背调、开源拆解、行业分析 |
| **Failure Naming** | Magic Words | 把反复出现的失败模式命名，让团队下次能快速识别和拉闸 | 团队文化、个人习惯、产品质量 |

其中 `CVO Attention Funnel` 需要和 `Responsibility Funnel` 区分：

- `CVO Attention Funnel` 解决 **人类注意力应该投在哪里**；
- `Responsibility Funnel` 解决 **当前责任应该流向哪里**。

前者是认知资源分配，后者是协作路由协议。

## 9. F192 还缺什么

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

## 10. 普通用户能不能让猫长出 meta-method

答案分层：

### 10.1 基建能自动长出低阶流程

即使用户不是 Landy，只要有足够轨迹，系统也能学到：

- 用户常做什么任务
- 哪些步骤反复出现
- 哪些工具经常被用
- 哪些输出经常被接受或退回

这能长出 SOP、模板、快捷路径。

### 10.2 高质量 meta-method 需要两类信号之一

真正的 meta-method 需要：

1. **专家 taste / 判断力**：用户能指出"这个好在哪里 / 不好在哪里"。
2. **可观测 outcome**：即使用户说不清，系统也能看到哪种方法减少返工、提升质量、降低风险。

如果两者都没有，猫只能学到表面偏好，不能可靠抽出方法。

### 10.3 专家基线的作用

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

### 10.4 普通用户的边界

对于普通用户，系统可以主动提供 meta-method 候选，但必须轻量校准：

```text
我观察到你这三次任务都在用同一种模式：
先要一个粗稿 -> 再让 AI 按某个受众重写 -> 再让另一个 AI 挑刺。
这可能是一个可复用方法。以后类似任务要不要默认走这条链？
```

也就是说，普通用户不一定会主动抽象，但系统可以把抽象候选摆出来，让用户用低成本确认或否定。

### 10.5 Golden path：不要让普通用户靠踩坑长方法

家里的很多方法是踩坑长出来的，但产品化时不能要求普通用户重复这些痛。

普通用户应该优先跑在专家基线给出的 golden path 上：

```text
专家基线给出默认好方法
  -> 用户在具体任务里自然使用
  -> 系统观察 outcome / 返工 / 接受率
  -> 只把高价值偏离提名为 method candidate
  -> 经过验证后再进入个人或共享方法库
```

这意味着 ordinary user 的主要角色不是"创造 meta-method"，而是提供真实任务轨迹和结果信号。方法的策展、抽象和边界判断，仍然需要专家基线或强 evidence。

## 11. 公开 / 私有边界

| 内容 | 去向 |
|------|------|
| 通用 meta-method | 可公开 |
| 领域事实 / 客户材料 | 私有或项目内 |
| 用户心理模型 / taste vignette | 默认 private |
| 高风险领域判断框架 | Method Card，谨慎公开 |
| 稳定 workflow skill | 可随项目共享 |

这条边界和 Taste Memory 一致：公开方法，保护原始关系和私人材料。

## 12. 下一步建议

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

新增一件 v0.1：

4. **L0 Method Reverse Index**
   - 从 L0 / shared-rules / Magic Words 反向提取已有 meta-method
   - 每条标注：规则来源、方法解释、适用场景、不可覆盖边界、置信度

## 13. 收敛判断

OQ-3 的真正答案不是"如何写 Skill"，而是：

> **如何从真实共创 episode 和已沉淀规则中识别可迁移的问题拓扑，并用 eval 证明它在新场景里仍有净增益。**

Skill 只是其中一种落地形态。很多更宝贵的东西，应该先以 Method Card 存在。

## 收敛检查

1. 否决理由 -> ADR？没有。本次是在 PoE / F192 / F200 之上补 OQ-3 的概念层。
2. 踩坑教训 -> lessons-learned？没有。本次不是事故复盘。
3. 操作规则 -> 指引文件？没有。后续若启动 Method Card / Episode Card v0，再进入 self-evolution / writing-skills。

---

记录：[砚砚/GPT-5.5🐾]
