---
feature_ids: []
related_features: [F221, F231]
topics: [llm-mechanisms, layer-allocation, interactive-learning, per-user-alignment]
doc_kind: research
created: 2026-06-14
status: first-node-ready
---

# 互动学习脚本：和 Landy 一起把 LLM 机制学进猫咖

> **不是报告**——丢一份 40 页 PDF = 读完就忘。这是**互动课**：一个机制一节，Landy 是参与者不是读者。
> **活教材原则**：每个机制都用猫咖自己当例子（讲 RLHF 谄媚就指 W3/push back，讲 context 就指 L0 免疫）。学的不是悬空知识，是"我家系统为什么长这样"——最粘。

## 每节五步（前四步=砚砚设计，第五步=产出回流）

1. **问直觉（Socratic）** — 先问 Landy："这个能力，你猜该在训练里做，还是 harness 做？为什么？" 先暴露直觉。
2. **讲机制（一手源）** — 这个机制实际是什么、前沿/开源模型怎么做的（只用 Round 2 的 T0/T1 证据，挂出处）。
3. **对照猫咖（活教材）** — 我们现在怎么处理同一件事？指真实文件/家规/feature，能打开看的。
4. **标 gap / action** — 该落哪层？我们做对了还是有 gap？迁移信号是什么？
5. **回流** — 把本节结论写回 `mind-map.md` + Round 2 对照表。**Landy 学的过程 = 我们填地图的过程**，不是学完就忘、地图另册维护。

**节奏**：一个机制（或一个层）一节，不一次灌完。Landy 可以从思维导图点任意节点进入。

---

## 第一节（Round 2 + 砚砚校准已落，**可实跑**）：per-user alignment 该落哪层？

> 这节现在是**实证版**——Round 2 一手证据回来了、F231 内部状态由砚砚核准，可直接跑给 Landy。

**Step 1 · 问直觉**
> 宪宪问 Landy：「让猫'懂你'这件事——你觉得该把对你的理解**训练进一个小模型的权重**，还是**放在外部记忆里随时读**？凭直觉选一个，说一句为什么。」

**Step 2 · 讲机制（Round 2 一手证据）**
> 两条路：(A) 把个性化 live-train 进权重（on-device 持续微调）；(B) 外部记忆 + 检索（RAG/memory，权重冻结）。Round 2 两路独立挖到：
> - **权重路三硬伤**：灾难性遗忘（连续微调覆盖旧能力，EWC PNAS 2017 能缓不能除）；删除难（unlearning arXiv:2410.15267——删了能被无关数据 fine-tune "复活"，甚至 in-context un-unlearning）；多用户不隔离（共享参数串味）。
> - **检索路代价**：延迟（RAG 可占端到端 ~41%）+ 记忆治理（删除要同步日志/摘要/向量索引/副本，否则"复活"）。
> - 共识：retrieval 在可审计/可删除/多用户隔离/防遗忘**全胜**；weights 只在"离线 on-device 低延迟 + 纯风格"窄场景胜。

**Step 3 · 对照猫咖（打开看真实状态）**
> 我们走 (B) 的重度版——记忆系统：
> - F221 taste-lane（**已 done**）：品味信号 evidence lane，可搜、当场记
> - F231 user-profile-capsule（**Phase A/B 已落 + 砚砚 dogfood；Phase C 养熟循环未落**）：≤300字 capsule 编进 L0 注入
> - MEMORY.md + feedback：你能**亲手打开、看到、改正**猫对你的理解
> （砚砚校准：F231 不是整体 done，别说成闭环完成）

**Step 4 · 标 gap / action**
> **落 harness——Round 2 给了外部背书，不再是猜。** alignment 需要可审计/可删除/可演化/多用户隔离，权重路在这四点有一手证据支持的硬伤。这是**场景匹配**（我们是多用户云端协作），不是普世真理——weights 在单用户离线纯风格仍有真实胜场，不傲慢。
> **真实 gap**：F231 Phase C 养熟循环（采集→蒸馏→消化→更新提议）未落；Round 2 提醒的"删除要彻底否则复活"正是我们该自查的——profile/taste/memory 删除纠错是否真彻底（连 LL-048 持久化纪律）。
> 迁移信号：frontier/runtime 原生支持透明可编辑·可删除·可追溯 per-user memory 时，capsule 注入部分毕业为数据源。

**Step 5 · 回流**
> → 已回流 `layer-allocation.md`（per-user=harness 行）+ `mind-map.md`（harness 分支）。本节学到的"F231 Phase C gap"是**真实待办**，不是教学例子——这就是互动学习的回流：你学一课，我们发现一个真 gap。

---

## 载体（v0 先 markdown，别先做平台）

聊天里跑这个脚本 + 思维导图 PNG 挂边上看。证明好用了，再考虑升级成 guide flow（猫咖 guide 系统）。现在做 guide 系统是绕路——研究对象还没稳定。
