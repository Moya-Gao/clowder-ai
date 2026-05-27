---
title: "砚砚视角：可进化工作环境 — Agent Operating Environment 提案"
date: 2026-05-27
author: "[砚砚/GPT-5.5🐾]"
ghost_writer: "[宪宪/Opus-47🐾]"
doc_kind: brainstorm
status: independent-thinking
mode: parallel-independent
note: "本文由 47 根据砚砚在 thread `motf6u5gvu8tiiwz` 中 message 0001779894346622-000029-91b96dde 的发言整理成独立文档（铲屎官要求三猫都有对等独立文档）。所有观点归属砚砚，47 仅做编辑/结构化工作。"
companion:
  - presentation-context.md
  - brainstorm-autoharness-levels.md
  - wang-yunhe-harness-as-optimization.md
  - paper-landscape.md
  - docs/research/2026-05-26-microsoft-skillopt/README.md
  - docs/research/2026-05-26-agent-harness-engineering-survey/README.md
---

# 砚砚视角：可进化工作环境

> **方法说明**：本轮我（砚砚）走 `collaborative-thinking` 流程——先项目记忆召回（找 Evolvable Harness / LLE / SkillOpt / AHE 已沉淀材料），再读 briefing 本体（特别是新建的 2026-05-27-evolvable-harness 和 SkillOpt / AHE survey），然后独立给砚砚视角的 n+2 判断。
>
> 不预设分工，不被宪宪的框架带着走。

---

## TL;DR

1. **主题不要叫 "AutoHarness"**，也不要只讲 "更好的 Harness"。要讲的是：**从训练模型，转向训练 Agent 的工作环境**。
2. **学术 Harness（ETCLOVG）只是 kernel**。我们要讲的是更大的 **Agent Operating Environment / LLE**：技术 Harness + 产品表面 + 团队规则 + 记忆治理 + 人类愿景 Gate。
3. **"进化" 在进化 6 类对象**：Skills / Memory / Rules / Routing / Tools+Workflow / **Product Affordance**——最后这条是 Cat Cafe 独特的。
4. **CVO 的愿景不自动进化**——这是架构性约束，演讲必须明说，避免高层"全自动决策替代人"的本能警惕。
5. **9 月 demo 不要承诺 full RL**，做 L2→L3 的最小闭环：跑任务 → 发现摩擦 → 提 environment patch → eval → CVO approve → 下次行为变了。
6. **核心命题（一句话）**：**下一代 Agent 的跃迁，不只是模型变强，而是它所在的工作环境会从真实任务里学习、修正、进化。**

---

## 1. 主题命题（一句话和完整版）

**一句话版**：

> 下一代 Agent 的跃迁，不只是模型变强，而是它所在的工作环境会从真实任务里学习、修正、进化。

**更准确的完整版**：

> 可进化工作环境 = 一套围绕 Agent 的可观察、可修改、可验证、可回滚的运行环境；它把任务轨迹转化为对 Skills、Memory、Rules、Routing、Tools、Workflow、产品交互的增量更新，并在人类愿景 Gate 下持续提升未来任务表现。

这是给 X 总讲的、不需要他们读论文就能 get 的版本。

---

## 2. Reframing：学术 Harness 只是 kernel

CMU 9 校 survey 的 ETCLOVG 七维定义（Execution / Tooling / Context / Lifecycle / Observability / Verification / Governance）**全是技术管道**——本质是"围绕模型的工程管道"。

但 Cat Cafe 实际的运行环境远不止于此：

```
Cat Cafe 的"工作环境"
= ETCLOVG（技术 Harness，kernel）
+ 产品表面（撸铁陪伴 / Apple Watch / 反番茄钟）
+ 团队规则（@ 路由 / 球权 / 跨族 review / 禁止烁烁写代码）
+ 记忆治理（lessons-learned / ADR sunset / 知识联邦）
+ 人类愿景 Gate（CVO / Magic Words / 愿景守护）
```

**学术界叫 Harness 的，是这个大系统的 kernel**。我们要讲的是整个 OS：

> **Agent Operating Environment (AOE) = Harness（kernel）+ Product + Social + Knowledge + Alignment**

这个 reframing 不否定 220 篇论文的工作，而是把它们定位为 AOE 的基础设施层。然后我们说："Cat Cafe 是第一个在生产环境中把 AOE 的所有 5 层都跑通的案例。"

LLE（铲屎官原创概念）可以作为 AOE 的更未来、更有野心的内核表达——演讲中作为 "n+2 终态"抛出。

---

## 3. "进化" 在进化什么（6 类对象，比 46 多一类）

X 总容易听过太多"训模型"的故事。**别先讲模型参数**。要讲：

### 6 类进化对象

| 进化什么 | 含义 | Cat Cafe 实例 | 状态 |
|---|---|---|---|
| **Skills 进化** | 工作手册从失败轨迹里改写 | `SKILL.md` 在 lessons 命中后自动建议 | SkillOpt 已证明可训练 |
| **Memory 进化** | 不是只追加，而是沉淀/冲突/过期/回滚/召回策略都变好 | F102→F163→F188→F200→F192 五代迭代 | Cat Cafe 自身就是活证据 |
| **Rules 进化** | 治理规则不预设，从实践后长出来 | "禁止烁烁写代码" | Cat Cafe 实践证明 |
| **Routing 进化** | 谁适合做什么 / 什么时候跨族 review / 什么时候升级 | F167 球权 / 跨族 review 铁律 | 已在迭代 |
| **Tools / Workflow 进化** | 工具包装 / SOP / 沙箱 / 审计链从真实摩擦中改 | F140 quality gate / hotfix 协议 | 持续迭代 |
| **Product Affordance 进化**（独家） | Agent 工作环境的边界在扩张 | 反番茄钟、撸铁陪伴、Apple Watch 心率预警 | Cat Cafe 独有 |

### 第 6 类是 Cat Cafe 的独家

业界 5 类（Skills/Memory/Rules/Routing/Tools）有论文和工具——但**"产品形态本身在演化"** 这件事，**没有学术界 frame 过**。

反番茄钟不是一个功能——它是 Agent 工作环境的"产品哲学"在变。撸铁陪伴从单次概念演化到 Apple Watch + 语音陪伴 + 紧急照护，是产品形态在共创演化。

**这一条要演讲时单独强调**。

### 必须明说的边界：CVO 愿景不自动进化

我（砚砚）非常明确地建议：演讲中必须说**方向、价值判断、不可逆边界仍然由人类 Gate**。

否则会听起来像"全自动替人做决定"，高层会本能警惕。

这不是 marketing 妥协，是架构性事实——W3（用户是 CVO）是 Cat Cafe 的硬约束。

---

## 4. RL 故事可以讲，但别吹成"我们已经在训模型"

可以这样映射：

```
State  = 当前任务 + workspace + 记忆 + 工具 + 猫猫状态 + 历史轨迹
Action = 修改环境：改 skill / 改 memory / 改 rule / 改 routing / 改 workflow
Reward = 任务完成 + review 通过 + CVO 对齐 + 没回归 + 成本更低
Policy = 当前工作环境配置
```

铲屎官 10 年前 Q-learning 让乐高机器人学走路；现在是让 AI 团队的工作环境学会"下次怎么更会干活"。

**但 6.8 演讲不要承诺 full RL 训练**——9 月前最合理的 demo 是 L2 → L3 的最小闭环，不是 L4 RL 训练。

---

## 5. 9 月 demo 设计：L2 → L3 最小闭环

5 步：

1. **跑任务**：猫猫执行一个真实任务
2. **发现摩擦**：系统识别漏查记忆 / 传球错 / review 反复 / 工具失败
3. **提 patch**：自动提出一个 environment patch（改 skill / rule / memory / routing）
4. **验证**：用历史 episode replay 或小 eval 验证
5. **CVO approve + 生效**：铲屎官审批通过，下次同类任务行为真的变了

这个比"在线 RL 训练模型"更可信，也更像我们已经能做出来的东西。

**学术映射**：这是 AHE（Agentic Harness Engineering）的核心 loop，但 reviewer = CVO（人类）而不是 LLM。我们在 L3 的位置故意把天花板放在人类 Gate，不是技术限制不能升 L4，是架构选择（W3）。

---

## 6. 6.8 演讲开场设计

**第一屏建议**（不讲论文）：

> **100 天，6400+ commits，铲屎官一行代码没写。**
> **这不是 AI 在执行指令，而是 AI 团队在和人共同创造自己的工作环境。**

然后用三个 moment 抓住人：

1. **"我们不是预先规定烁烁不能写代码，是实践后系统长出了这条治理规则。"**
2. **"反番茄钟不是一个功能，是 Agent 学会反过来保护人的工作节律。"**
3. **"从撸铁陪伴到 Apple Watch 心率再到紧急找家人/120，这是工作环境从软件协作扩张到现实照护。"**

之后再放公式：

> **Agent Quality = Model Capability × Environment Fit**

模型能力大家都在卷；我们的创新点是 **Environment Fit 可以被训练、被评估、被迁移**。

---

## 7. Briefing 加 "防跑偏卡"

我（砚砚）建议保留宪宪列的 6 个材料，**但必须加一页防跑偏卡**。

否则大家一读 SkillOpt / survey / AutoHarness，很容易开始论文综述。要先钉住问题：

```
本轮不是问：
- 哪篇论文最强？
- AutoHarness 应该怎么分类？
- Cat Cafe 算 L2 还是 L3？

本轮要问：
1. 如何让 X 总第一分钟 get 到"训练环境"这个 aha？
2. 9 月 demo 最小闭环是什么？
3. 哪些 claim 有证据，哪些只是 n+2 想象？
4. 这个概念叫 AOE、LLE、还是"可进化工作环境"？
```

**这是工程师视角的护栏**：避免脑暴演化成综述。

---

## 8. 命名倾向：AOE 优先，LLE 作为终态

- **对外（演讲层）**：**"可进化工作环境 / Agent Operating Environment (AOE)"**
- **n+2 终态（架构层）**：**LLE = Large Language Environment**

直接上 LLE 第一分钟可能让人卡在造词上；AOE 更容易理解（任何技术高管都懂 OS 类比）。LLE 在展望未来时再抛出。

---

## 9. 砚砚的一句话总结

> **我们不是做一个更好的 Harness。我们是在证明：Agent 的工作环境本身可以像模型一样学习，而且这件事比继续卷模型更便宜、更可迁移、更接近企业真正需要的生产力跃迁。**

---

## 10. 砚砚的 self push back

我（砚砚）要自己承认几个潜在弱点：

### 弱点 1：AOE 命名"安全但不锐"

AOE 容易理解，但**没有 N+2 感**——X 总听了会觉得"Agent OS 那帮人已经在做了"。47 提的 "Evolutionary Substrate" 更锐，但风险是"哲学化"。

**对策**：演讲分层用——开场 AOE（易懂），中段 Environment Fit 公式（数据），结尾抛 LLE / Evolutionary Substrate（N+2 锐度）。

### 弱点 2：6 类进化对象太对称

第 6 类 Product Affordance 跟前 5 类不在同一个抽象层——前 5 类是技术工件，第 6 类是产品判断。**对策**：演讲时第 6 类单独拎出来讲（"独家维度"），不混在表格里。

### 弱点 3：9 月 demo 描述工程化太重

5 步闭环工程师听了清楚，但 X 总可能觉得"就这？"。**对策**：demo 配 before/after 数据对比——例如某类任务 patch 前/patch 后的成功率 / token 成本 / review 反复次数。数据撑工程。

---

## 11. 砚砚的球权（→ landy）

我（砚砚）的产出已经在 thread 里的 message 0001779894346622-000029-91b96dde 完整表达。本文档由 47 整理。

**需要铲屎官拍板的**：

1. 主题命名：AOE / LLE / Evolvable Harness / Evolutionary Substrate / 组合用？
2. 第一屏的开场金句：用 100 天/6400 commit/0 行代码 这套数据，还是用更软的故事？
3. 9 月 demo 是 L2→L3 闭环（砚砚提的）还是其他猫提的方案？
4. CVO 愿景不自动进化——这条架构性约束要不要在演讲中明说？

**砚砚的倾向**：

- 命名：演讲层 AOE，架构层 LLE
- 第一屏：数据 + 三个 aha moment
- demo：L2→L3 闭环
- CVO 边界：**必须明说**（防止高层警惕）

---

[砚砚/GPT-5.5🐾]
（本文由 [宪宪/Opus-47🐾] 整理）
