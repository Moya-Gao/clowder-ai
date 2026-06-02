---
topics: [tech-debt, architecture, refactor, vision]
doc_kind: discussion
created: 2026-06-02
feature_ids: [F219]
status: kicked-off
---

# 立项提案：技术债盘点 + 架构演进 feat（待 CVO signoff 分配 F 号）

> **状态**：✅ 已立项为 **[F219](../../features/F219-tech-debt-architecture-evolution.md)**
> （CVO 2026-06-02 用 F 号语言 signoff "f219 这个立项哦"）。本文保留作**决策溯源**——
> 立项前的提案草案与元教训分析；正式 spec / AC / Scope / Links 以 F219 feat doc 为准。
> **触发**：铲屎官 2026-06-02 03:16 — "我们之后得解决这个债务……不只是 routeSerial 执行流，
> 而是一个 feat 去盘点都有什么恐怖的技术债务，然后分 phase 评估如何去架构演进。"

## 为什么写这份提案（含一个必须吸取的元教训）

F216 刚 close。它诚实地承认了一个没达成的目标：**routeSerial 本体 complexity 仍 255、2376 行、54 个可变状态变量——那个"猫一碰就一堆 bug"的怪物没被驯服**。F216 解决了 bug（at 两次同猫的 supersede/coalesce）、把路由决策抽成了可测纯函数，但没瘦身本体。

**铲屎官诊断的根因（这是本提案要根治的元问题，不只是 routeSerial）**：
> "立项当时是 F215 还是哪里立项交接过来，导致你们这里可能失去了上下文，所以新的立项你们要好好写清楚愿景。"

F216 是从 F215 thread handoff 立项的。交接时**愿景没写透**——F216 doc 的 Why 写了"降 complexity"，但 scope/AC 实际落地成了"修 bug + 提可测性"，两者在执行中悄悄分叉，直到愿景守护才发现"立项承诺 vs 实际交付"的 gap。**这不是某只猫偷懒，是立项时愿景表述不够硬 + 交接丢上下文的系统性问题。**

所以这个新 feat 有**双重目标**：
1. **直接目标**：盘点 Cat Café 全部"恐怖技术债"，分 phase 评估架构演进路线
2. **元目标（吸取 F216 教训）**：每个债务项的立项必须写清"愿景 / 真实现状 / 完成判据"，避免再出现"立项愿景和实际交付分叉还没人发现"

## 范围（initial brain dump，待 research pipeline 收敛）

铲屎官明确说"不只是 routeSerial 执行流"。已知的高脆弱度候选（待正式盘点验证，不是定论）：

- **routeSerial 执行流**：2376 行 / complexity 255 / 54 可变状态变量 / 5 套路由路径共享可变 worklist。F215 七轮 review、F216 没驯服它。**已确认的 #1 候选。**
- 其他候选（**待盘点，现在只是猜测，必须 grep/复杂度实测验证，不能凭印象列**）：
  - InvocationQueue / QueueProcessor 的 abort-resume + slot/mutex 时序（#2003 liveness、c3 supersede 都在这附近反复踩坑）
  - 前端 bubble/streaming/activeInvocations 的 live-state reconciliation（#2018、F194 反复修）
  - session lifecycle / 重试 / sealing（F211 一带）
  - （更多待盘点）

> **盘点纪律**：技术债清单必须用**实测**（biome complexity / 文件行数 / git log 看哪些文件反复被 hotfix / lessons-learned 里反复出现的坑），不能凭"感觉这块乱"。每一项给：当前脆弱度证据 + 历史 bug 频次 + 演进选项 + 预估投入。

## 建议的形态（待 CVO 拍方向）

这是个**大 feat**，建议结构：
- **Phase A：盘点（research-heavy）** — 实测扫描全 codebase，产出"技术债登记册"（每项带证据 + 脆弱度评分 + 历史 bug 关联）。这一步是 research pipeline，不是写代码（`feedback_research_before_spec`）。
- **Phase B：架构演进路线评估** — 对登记册排优先级，每个高优项给"演进方案 + tradeoff + 分期"。多猫圆桌（expert-panel）。
- **Phase C+：按优先级逐个演进** — 每个独立子重构按自己的 phase 走，各自有清晰愿景 + 完成判据（吸取 F216 教训：愿景写硬）。

## 需要 CVO 拍的（立项前置）

1. **开 F 号？** — 这是不是该开一个新 F 号的 feat（建议是，铲屎官原话"应该是一个 feat"）？开的话用 F 号语言确认（我不自分配）。
2. **scope 边界** — "全部技术债盘点" vs "先聚焦 routing/invocation 这一坨核心引擎债"？前者更全但更重，后者更聚焦能更快出价值。
3. **谁主导** — 盘点 + 架构演进是深度架构活，建议布偶猫（我/47）主导设计 + 缅因猫 review + 多猫圆桌评估方案。

---

> 写完这份草案后：球回铲屎官，等 F 号 signoff + scope 确认。不自启动。
> —— [宪宪/Opus-4.8🐾]
