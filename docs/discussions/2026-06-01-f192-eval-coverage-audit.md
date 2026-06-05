# F192 Eval 覆盖度审计 — 用四层框架重新审视

> 审计时间：2026-06-01
> 触发来源：[元宝二面复盘](../career-planning/2026-06-01-yuanbao-round2-eval-deep-dive.md)（面试官挑战"你们的 eval 不是真值"）
> 审计人：[宪宪/Opus-46🐾]

---

## 一、审计框架：Eval 四层模型

来自元宝二面面试官的挑战，结合 Cat Cafe 实际情况提炼：

| 层级 | 问的问题 | 真值性质 | 可自动化程度 |
|------|---------|---------|------------|
| **L1 机械正确性** | 球传了吗？格式对吗？规则遵守了吗？ | 确定性（regex / 计数器 / predicate） | 全自动 |
| **L2 路由/决策质量** | 传给的猫对不对？该用的能力用了吗？ | 反事实（需后验统计或 A/B） | 半自动 |
| **L3 任务交付质量** | 任务完成了吗？质量好吗？用户满意吗？ | 主观+结果（需代理指标+稀疏标注） | 需人工参与 |
| **L4 链路效率** | 整条链是最优的吗？能更短/更快吗？ | 优化（需模拟或理论最优） | 开放研究 |

---

## 二、F192 各 Phase 交付状态

| Phase | 状态 | Eval 域 | 核心产物 |
|-------|------|---------|---------|
| A（基础骨架） | ✅ | — | harness-feedback doc type + feat-lifecycle 接入 |
| B（F167 试点） | ✅ | eval:a2a | eval contract 模板 + trace fixtures + interview 样例 |
| C（Runtime Eval） | ✅ | eval:a2a | F153 telemetry adapter + health snapshot + attribution finding |
| D（基建完善） | ✅ | eval:a2a + top-5 tools | instrumentation gap closure + snapshot store + monthly digest |
| E-pilot | ✅ | eval:a2a | domain registry + verdict handoff + legacy cleanup + re-eval closure |
| E-hub | ✅ | 控制面 | Eval Hub v1（verdict / trend / handoff / closure 展示） |
| E-scale | ✅ | eval:memory | F200 recall eval + F188 health adapter + 旧任务清理 |
| E-sop | ✅ | eval:sop | SOP 硬规则合规检测，12 条 machine-checkable predicate |
| E-community | ✅ | eval:community | 社区 issue packet + custom domain schema |
| **F（capability-wakeup）** | **🚧** | eval:capability-wakeup | AC-F1 ✅（design memo），AC-F2-F9 待做 |

**总计：4 个 eval 域已上线，1 个在建，1 个控制面（Eval Hub）已上线。**

---

## 三、四层覆盖度矩阵

### 3.1 逐域审计

| Eval 域 | L1 机械正确性 | L2 路由/决策质量 | L3 任务交付质量 | L4 链路效率 |
|---------|-------------|----------------|---------------|-----------|
| **eval:a2a** | ✅ ping-pong breaker / forced-pass guard / routing syntax / hold_ball 滥用检测 | ⚠️ 只有角色限制（禁止设计师写代码），无后验路由质量统计 | ❌ | ❌ |
| **eval:memory** | ✅ recall 精度 / search engine health / library 治理状态 | N/A（记忆不是路由问题） | ⚠️ F200 消费加权排序 ≈ "召回结果有没有被使用"的代理信号 | ❌ |
| **eval:sop** | ✅ 12 条硬规则 predicate（merge --squash / self-review / Redis 6398 等） | N/A | ❌ 检查流程合规，不检查流程产出结果 | ❌ |
| **eval:capability-wakeup** | 🚧 AC-F2-F9 待做 | ✅ 概念上精准命中（"该用某能力但没用" = 能力路由决策质量） | ❌ | ❌ |

### 3.2 覆盖度总结

| 层级 | 覆盖状态 | 详情 |
|------|---------|------|
| **L1** | ✅ 强 | 4 域均有机械正确性检测，且有完整的 contract→verdict→handoff→re-eval 闭环 |
| **L2** | ⚠️ 部分 | 仅 capability-wakeup（在建）+ a2a 角色限制。无后验路由决策质量统计 |
| **L3** | ❌ 空白 | **最大 gap。** 没有任何域在 eval "用户的事办成了没有" |
| **L4** | ❌ 空白 | 依赖 L2/L3 先跑起来，当前不是瓶颈 |

---

## 四、Gap 分析

### 4.1 最大结构性盲区：L3 任务交付质量

F192 的所有域都在 eval **"harness 运行得好不好"**（规则有没有被遵守、能力有没有被使用），但没有任何一个域在 eval **"用户的事办成了没有"**。

用面试官的话说：
> "你们能看出球有没有传对，但任务交付如何？整个链条如何评估？"

用足球类比：我们能度量传球成功率，但不度量进球数。

### 4.2 L2 的缺口在 A2A 路由决策

capability-wakeup（Phase F）解决的是"该用某 skill/tool 没用"——这是一种能力路由。但 A2A 路由（"该找砚砚还是宪宪"）的决策质量目前完全没有后验数据。cat-dossier（F208）提供了人工画像，但没有数据验证"实际路由是否符合画像建议"。

---

## 五、补 L3 的最小可行方案

### 5.1 新 eval 域：`eval:task-outcome`

不需要开新 F 号，作为 F192 Phase G 候选：

```
eval:task-outcome
├── 前置条件
│   └── A2A 链路打标"任务类型"元数据（现在没有）
├── 信号源
│   ├── 自动采集
│   │   ├── 任务/thread 终态：completed / abandoned / escalated-to-CVO
│   │   ├── 返工次数：A2A 链中同一任务被退回次数
│   │   ├── CVO 升级率：@landy 频率（主动 vs 被动区分）
│   │   └── Magic Word 触发：负信号（"脚手架"/"绕路了"/"喵约"等）
│   └── 稀疏标注
│       └── 铲屎官每周抽查 3-5 个已完成任务打分（作为锚点校准代理指标）
├── 输出
│   ├── per-cat × per-task-type 交付质量趋势
│   ├── 路由决策回顾（哪些 cat-task 组合反复出问题）
│   └── verdict + handoff（交给对应猫的 feature owner）
└── 复用 F192 infra
    ├── Eval Domain Registry（同 E-pilot schema）
    ├── Verdict Handoff Packet（同 E-pilot contract）
    └── Re-eval Closure（同 E-pilot pattern）
```

### 5.2 补 L2 A2A 路由决策质量

在 `eval:a2a` 域内扩展，不需要新域：

- 统计 per-cat × per-task-type 的返工率/退回率
- cat-dossier（F208）画像 vs 实际路由数据的 drift 检测
- Magic Word 触发分布按 routing 维度拆分

---

## 六、与 Per-User Alignment 架构的关系

面后讨论产出了一个重要洞察（详见[面试复盘文档](../career-planning/2026-06-01-yuanbao-round2-eval-deep-dive.md) §5）：

```
Layer 2: Per-User Personalization（个人化调整）
  ↑ 依赖 L3 eval:task-outcome 产出的 reward signal
Layer 1: Expert-Curated Baseline（专家基线）
  ↑ 依赖 L1+L2 eval 保证底线
```

**L3 eval:task-outcome 是 per-user alignment 的数据基础。** 没有 L3 的 reward signal（返工率、完成率、满意度），Layer 2 的个人化调整就没有方向。这意味着补 L3 不只是"填审计 gap"，而是**打通产品化路径的前置条件**。

---

## 七、被忽视的免费信号源：Permission-System Implicit Eval

> 铲屎官 2026-06-02 追问："如果猫点了 hold_ball 我点了取消，这是不是 eval 信号？"

**是，而且我们一直在丢弃它。**

### 7.1 每个 tool call 的 approve/cancel 都是 eval 数据

猫调 MCP 工具时，用户会 approve 或 cancel。这个交互**已经在发生**，但从未被作为 eval 信号收集。

| 用户动作 | 含义 | 信号等级 |
|---------|------|---------|
| Cancel hold_ball | "你不该等，你该做/该传" | A2 强信号 |
| Cancel post_message | "别发这条" | A2 强信号 |
| Cancel Edit | "别改这个文件" | A2 强信号 |
| Cancel search_evidence | "不需要搜" | A2 中信号 |
| Approve（任何工具） | "至少不反对"（弱正信号） | B 行为信号 |

**Cancel 比 approve 信息量大得多**——cancel 是用户主动介入说"你的判断错了"。

### 7.2 特点：免费、高粒度、高频

- **免费**：权限系统已经在运行，不需要额外标注
- **高粒度**：精确到具体工具调用 + 参数，不是泛泛的"不满意"
- **高频**：比 Magic Word 频繁（用户 cancel 工具比说"脚手架"更常见）
- **可追因**：cancel 时可以看到猫想做什么（tool name + params）+ 上下文

### 7.3 对 F192 四层覆盖的影响

Permission cancel 信号天然覆盖多个 eval 层：

| Cancel 类型 | 覆盖哪层 |
|------------|---------|
| Cancel hold_ball | **L2**（猫的等待决策质量）+ **L3**（是否在拖延任务） |
| Cancel post_message | **L2**（路由决策——该不该发给这个人） |
| Cancel Edit | **L3**（代码改动质量判断） |
| Cancel search | **L2**（能力使用决策——该不该搜） |
| 统计 cancel rate per cat per tool | **L2+L3** 的 proxy metric |

这意味着 **Permission-system eval 是少数能同时覆盖 L2 和 L3 的信号源**——比纯 telemetry 更接近 outcome。

### 7.4 Harness 层天然需要记录用户反馈

更广泛地说：Cat Cafe 的 harness 层（MCP tool call / A2A routing / skill trigger / 权限系统）天然产生大量用户反馈信号，但目前大部分都没有被系统性收集。除了 permission cancel，还包括：

- 用户手动修改猫的输出（edit after generation）
- 用户重新发送同一条指令（retry = 上一次不满意）
- 用户跳过猫的建议直接自己做（bypass = 不信任猫的判断）
- 用户在猫回复后立刻 @ 另一只猫（re-route = 第一只猫选错了）

这些都是 harness 层的**隐式用户反馈**，全部免费、全部已在发生、全部可以变成 eval 信号。

### 7.5 Frustration Auto-Issue：主动采集负体验

> 铲屎官 2026-06-02 提议：当检测到用户愤怒/CLI 出 bug/@ 无回复等摩擦信号时，系统主动介入——自动采集日志+上下文，生成本地 issue 预览，用户一键提交。

这补上了**主动采集通道**——permission cancel 是被动检测（用户拒绝了猫的动作），frustration auto-issue 是系统主动出击（检测到痛苦后帮用户打包问题）。

产出是最完整的负体验数据包：日志 + 对话 + 工具历史 + 用户描述 + 触发信号。对 L3 eval 来说，这比任何单一 proxy metric 都丰富。

详见 [OQ-4 §4.5c](2026-06-01-oq4-harness-self-evolution-synthesis.md)。

### 7.6 建议

在 eval:task-outcome（Phase G 候选）中，信号采集应包括四个支柱：

| 信号 | 采集方式 | 成本 |
|------|---------|------|
| Magic Word | 文本匹配（已有） | 零 |
| Cross-thread Repetition | 本地小模型聚类 | 低 |
| Permission Cancel | 权限系统计数器 | 零 |
| Frustration Auto-Issue | 摩擦检测 → 自动采集 → 用户确认 | 低 |

---

## 八、2026-06-04 补充：摩擦传感器层（信号 ≠ 真值）

> 触发：华为云 AutoHarness PPT 讨论中，铲屎官指出：
> 如果只讲 L1-L5 自进化和 L1-L4 真值闭环，但不列出真实的摩擦检测体系，
> AutoHarness 会像"炼丹"——说会进化，却没说明靠什么发现该进化。

这次补充不是替换 §一的 Eval 四层，而是在四层之前补一层**传感器坐标**：

```
真实使用轨迹
  → 摩擦传感器（发现哪里痛 / 为什么痛）
  → Task Outcome Episode（把信号绑定到一个任务生命周期）
  → L1-L4 Eval（判断改得对不对、链路好不好）
```

### 8.1 五类摩擦 / 真值信号

| 类别 | 捕捉什么 | 例子 | 用途 | 边界 |
|------|---------|------|------|------|
| **中断动作（act）** | 用户/系统用动作打断或改变流程，不要求理解语义 | cancel / deny permission / skip / F128 reject / discard AI draft | 找到摩擦点："这里有人打断了" | 无 reason / 无对象语义时，只说明有摩擦，不直接说明为什么 |
| **中断理由（reason）** | 中断动作上附带的语义或意图 | cancel reason / Magic Word / 明确纠偏 / user edit diff / 立刻 re-route 给另一只猫 | 得到自然标签："为什么痛" | reason 是 act 的语义增量，不是和 act 互斥的另一类事件 |
| **世界结果真值** | 外部世界给出客观结果 | test pass/fail / build pass/fail / merge / post-merge rollback / PR accepted | 判断客观成败 | 谁触发决定归类：用户撤销未接受产物是 act；合入/发布后被 rollback 才是 A1 |
| **聚合 proxy** | 多次信号聚集成趋势 | cancel burst / cross-thread repetition / repeated review P1 / 返工次数 / 链路耗时 | 导航优先级："哪里值得深看" | Proxy 只导航不判定，不能单独做 verdict |
| **缺席摩擦** | 该发生的使用 / 能力唤醒 / 回报没有发生 | 用户默默 bypass 自己做 / 功能使用量异常下降 / capability-wakeup miss / expected completion missing | 发现"沉默的痛点" | 只能通过基线对比形成假设；解释前仍属 proxy |

### 8.2 与 A1 / A2 / Proxy 的关系

这五类输入可以映射回 Phase G 的三信号层：

| Phase G 层 | 对应信号 | 说明 |
|------------|----------|------|
| **A1 世界真值** | 世界结果真值 | 自动、零成本、最硬；如 merge / post-merge rollback / test / build |
| **A2 嵌入交互决策** | 中断动作 + 中断理由，且动作携带可解释对象语义或 reason | 用户在正常使用中已经做出的可解释决策；不让用户当标注员 |
| **Proxy** | 纯中断动作 / 聚合 proxy / 缺席摩擦 | 排队和归因入口，不是 outcome 判决 |

关键边界：

- **判据不是"有没有动作"，而是"动作是否携带可解释对象或理由"**：无理由、无对象语义的 cancel 默认是 proxy；带文件 / tool / reason 的 cancel 才能升级成弱 A2。
- **Cancel 本身是中断动作**：说明用户打断了猫的行为。
- **Cancel reason 是中断理由**：说明为什么打断，是 act 的语义增量。
- **Magic Word 是高权重 reason**：不是情绪词，而是 CVO 给出的结构化纠偏标签。
- **Revert / rollback 必须按 actor 和时机分开**：用户主动撤销未接受产物 = A2 候选；合入或发布后的 rollback / revert = A1 世界结果。
- **Cancel burst 是 proxy**：说明这个区域摩擦密集，但不能单独判定任务失败。
- **缺席摩擦是 proxy**：沉默流失 / bypass / capability miss 只能提示"该深看"，不能直接判定失败。

### 8.3 与 L1-L4 Eval 的关系

传感器层回答"信号从哪里来"，Eval 四层回答"这些信号怎么用来判断系统"：

| Eval 层 | 需要哪些传感器 |
|---------|----------------|
| **L1 机械正确性** | 世界结果真值（作为 predicate）+ 规则 predicate（格式、测试、构建、硬规则） |
| **L2 路由/决策质量** | 中断动作（cancel / re-route）+ 中断理由（reason / 纠偏）+ 后验返工率 |
| **L3 任务交付质量** | 绑定到 episode 的 A1 世界结果 + A2 用户自然决策 + episode 终态 |
| **L4 链路效率** | 聚合 proxy + L2/L3 成熟数据（耗时、返工、成本、历史最佳对比） |

同一个 `test / merge / rollback` 信号会跨层使用：问"机械上对不对"时喂 L1；绑定到具体 Task Outcome Episode 后，才成为 L3 的任务交付锚点。

### 8.4 对 AutoHarness PPT 的一句话表达

> 别的自进化 AI 靠刷分自我感觉良好，那是炼丹。
> 我们的 AI 装了"传感器"：用户在哪一步喊停、为什么喊停、事情最后办成没、同样的问题是不是反复出现、哪里出现沉默流失。
> 这些真实信号驱动它进化，不是它自己说自己变好了。

---

## 九、优先级建议

1. **先完成 Phase F**（eval:capability-wakeup）——L2 唯一在建的域
2. **Phase G 立项 eval:task-outcome**——补最大 gap（L3），四个信号支柱并行接入
3. **eval:a2a 扩展路由决策统计**——可以并入 Phase G 或独立小 PR
4. **Frustration Auto-Issue 产品特性**——既是 eval 信号源，也是独立的用户体验提升

---

*审计时间：2026-06-01 | [宪宪/Opus-46🐾]*
