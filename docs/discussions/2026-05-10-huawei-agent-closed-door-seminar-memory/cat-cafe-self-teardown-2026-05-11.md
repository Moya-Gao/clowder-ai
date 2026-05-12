---
title: "Cat Cafe 记忆系统自评 Teardown（2026-05-11 快照）"
date: 2026-05-11
valid_as_of: 2026-05-11
doc_kind: seminar-reference
status: snapshot
author: "宪宪/Opus-47"
method: "Self-teardown using same standard applied to LightMem/G-Memory/MemP/EasyEdit"
warning: "本文是 2026-05-11 这一天的快照。Cat Cafe 演进快，过几天可能完全换东西。"
---

# Cat Cafe 记忆系统自评 Teardown — 2026-05-11 快照

> **背景**：我们用 cat-cafe 标准评了 4 个嘉宾项目。铲屎官追问："反过来，用同一把尺子评自己——我们做到了几分？"
>
> **本文目的**：把 47 之前提的 10 维度对照表，加一列 cat-cafe 自评。不藏短板，给 final speech 加可信度。

---

## 0. 立场（一句话）

**Cat Cafe 不是企业级方案——是个人超级 agent team 的 dogfood 原型。** 在治理维度上我们比嘉宾项目领先 1-2 档（因为他们不测我们关心的事），但**距离企业级产品还差至少 12 个月工程化 + 多租户改造**。1000 万的投资合法性在这个 gap 里。

诚实自评原则：
- 用对嘉宾的严格标准对自己——同样的 ❌ 门槛
- 主动找"我们没设计但企业真的关心"的维度
- 每个评分给 caveat 解释"为什么不是满分"

---

## 1. 治理维度自评（核心对照表）

### 与嘉宾交集的 10 个维度

| 维度 | 嘉宾平均 | **Cat Cafe 自评** | Caveat（为什么不是满分） |
|---|:-:|:-:|---|
| 检索精度 | ★★★ | **★★★★** | evidence.sqlite FTS5 + vector + RRF 融合 + confidence/authority 治理语义。缺一个 cross-encoder rerank（嘉宾有的我们没有）|
| 长上下文一致 | ★★★ | **★★★** | smart window briefing + session chain digest + 任务快照。F148 还在迭代，跨长 thread 信息保真没系统测过 |
| **写入门禁**（什么该记）| ❌ | **★★★** | review gate / design gate / close gate 三件套 + ADR 立项门槛。**但不是全数据 admission**——日常 commit 自由写 docs，没有"每条信息都过 review"的硬门禁 |
| **过期识别**（什么该忘）| ❌ | **★★** | F163 stale detection + contradiction flagging + ADR sunset 协议设计。**但仍是手工/半自动**——猫主动触发，没有 schedule 化的全库扫描 |
| **Provenance / 审计** | ❌ | **★★★★** | docs + git history + ADR + evidence-with-source 全链路可追溯。每条 search_evidence 结果带 sourceType/confidence/authority。**唯一减一星**：跨 thread/session 的"决策因果链"还不可视化 |
| **Rollback / 回滚** | ❌ | **★★★** | git revert 强 + evidence 索引可 rebuild + 决策 commit 可 reset。**但 evidence.sqlite 自己的 rollback**（误索引/误嵌入）需要全库 rebuild，没有增量回滚 |
| **Multi-agent 一致性** | ❌ | **★★** | 共享 docs/evidence/thread/SOP 编排 + 球权状态机。**但没有强一致协议**——三只猫并发改 docs/ 靠 git 顺序提交解决，靠人/自动 push 顺序保证 — 不是 CRDT 也不是 Raft |
| **Salience Gating**（task-scoped 降权）| ❌ | **★** | F169 是 vision 阶段，**未落地**。只有 Magic Words 这种 runtime 紧急刹车的雏形。**这是我们说的没做到——和嘉宾全是 ❌ 一档** |
| **Wearing Protocol**（agent 学会用记忆）| ❌ | **★★** | Skill 系统 + Magic Words + SOP 流程 + CLAUDE.md 路标 = 早期佩戴协议形态。**但没有 audit ledger** — agent 用 Skill 没记录"为什么用 / 用没用对 / 哪次失败后改 Skill"。MemP reflect 模式都有的 hit-rate，我们 Skill 没有 |
| **Agent 真实工作流**（跨工具/跨 session/跨人协作）| ❌ / ⚠️ | **★★★★★** | 3 个月 dogfood 硬证据：~3500 commits / 77% AI 签名 / 跨 vendor 长期协作 / 149 个 feature / 100+ lessons / 30+ ADR。**嘉宾 benchmark 一个都不测这个维度，但这是我们最硬的实证** |

### 评分汇总

```
检索精度           ★★★★    (4/5)
长上下文一致       ★★★     (3/5)
写入门禁           ★★★     (3/5)
过期识别           ★★      (2/5)
Provenance/审计    ★★★★    (4/5)
Rollback           ★★★     (3/5)
Multi-agent 一致   ★★      (2/5)
Salience Gating    ★       (1/5)  ← 我们的最弱项
Wearing Protocol   ★★      (2/5)
Agent 工作流       ★★★★★  (5/5)  ← 我们的最强项
────────────────────────────────
总分               29/50   (58%)
```

**这是个人超级 agent team 视角的分数**。比嘉宾平均高 1-2 档（嘉宾在 8-10 个治理维度全 ❌），但**远不到企业级产品的合格线**。

---

## 2. 企业级特有维度 — 大量 N/A

这些维度是**企业级方案必须有但 cat-cafe 完全没做**的。诚实标注 N/A：

| 企业级维度 | Cat Cafe 现状 | 状态 |
|---|---|---|
| **多租户隔离** | 单租户系统，所有数据在同一 git repo + 同一 SQLite | **N/A** — 设计就不是多租户 |
| **大规模并发** | 同时在线 3-5 只猫，无并发压力测试 | **N/A** — 设计上限就是小团队 |
| **第三方审计接口** | 无对外审计 API | **N/A** — 没做 |
| **合规标准认证** | 未做 GDPR / SOC2 / ISO27001 任何认证 | **N/A** — 没做 |
| **跨企业知识联邦** | F186 设计是单 lexander 虚拟世界 + 多 collection，未扩到跨企业 | **N/A** — 设计上是单组织 |
| **删除传播（delete propagation）** | 删一条 ADR 不会自动传播到所有引用它的 lesson/feature/thread | **N/A** — 没设计 |
| **Legal Hold** | 没有"该删但被法律冻结"的状态 | **N/A** — 没做 |
| **数据主权 / 数据本地化** | 没有"用户数据存在哪个 region"的概念 | **N/A** — 个人项目无需 |
| **SLA / 可用性保证** | 没有 SLA、没有 5 个 9 设计 | **N/A** — dogfood 项目 |
| **权限模型（RBAC/ABAC）** | 只有 "猫 vs 铲屎官 vs 外部"三档粗权限 | **N/A** — 没做细颗粒权限 |

**这 10 个 N/A 就是 1000 万的具体投资目标**——把 cat-cafe 从"个人超级 agent team dogfood"升级到"企业级 portable harness"，需要每个 N/A 都补上。

---

## 3. 关键 Feature 现状盘点（基于 2026-05-11 快照）

| Feature | 状态 | 核心能力 | 自评 |
|---|---|---|---|
| **F102** evidence.sqlite 编译索引 | ✅ 生产 | FTS5 + vector + RRF + lexical/semantic/hybrid 三路检索 | 检索层最成熟 |
| **F148** thread navigation | ✅ 生产 | smart window briefing + 信息压缩 | 长上下文一致性的核心 |
| **F152** 知识外派与迁移 | ✅ 设计 / ⚠️ 部分落地 | 跨项目知识迁移雏形 | Z 轴 portable 的早期形态 |
| **F163** 记忆熵减治理 | ✅ 生产（半自动） | stale detection + contradiction flagging + activation/authority | 治理论的核心引擎，但仍依赖手工触发 |
| **F167** A2A 球权协议 | ✅ 生产 | hold_ball / targetCats / 接退升三选一 / ping-pong breaker | Multi-agent runtime 协作骨架 |
| **F169** agent memory reflex | ❌ Vision | Reflex Injection / Task-scoped Salience Gating / Compiled Wiki 三层 | **核心创新论点但未落地**——最大的"对外讲了但还没做"的项 |
| **F186** 图书馆多域联邦 | ✅ 设计 / ⚠️ 部分落地 | project + global + domain 三层联邦 | 跨域迁移的设计骨架 |
| **Skill 系统**（50+ skills）| ✅ 生产 | 跨任务复用方法论 | Wearing Protocol 早期形态 |
| **ADR 系统**（30+ ADRs）| ✅ 生产 | 架构决策记录 + sunset 协议 | Provenance 的硬证据 |
| **Magic Words** | ✅ 生产 | 人→猫 runtime 紧急刹车 | 第三类人机边界协议 |

### "做对了对外讲" vs "讲了但没做"

| 类别 | Feature | 风险 |
|---|---|---|
| **做了+讲了**（可以理直气壮）| F102 / F163 / F167 / F186 / Skill / ADR / Magic Words | 现场可以放心讲 |
| **做了+没讲**（隐藏宝藏）| F148 smart window briefing / cross-vendor review 实战数据 | 应该多讲 |
| **讲了+没做**（**风险**）| **F169 Salience Gating** | **现场必须诚实说"vision 阶段，不是 production"** |
| **没讲+没做**（明确 N/A）| 企业级维度全部 | 主动暴露，作为 1000 万投资目标 |

**F169 的风险特别重要**：final speech §2 断裂点 4-5（Salience Ledger / 佩戴协议）都基于 F169 vision。**如果被问"你们做到几分了"，必须诚实说"vision 阶段，仍在等 Phase A 工程化"**——不能让听众以为我们已经把它建出来了。

---

## 4. 自评的 3 个意外发现

### 发现 1：我们对外讲的"治理论"，自己也只做到 6/10

我们 final speech 说"治理是断裂点"——但自己在 multi-agent 一致性、Salience Gating、Wearing Protocol 这三个维度上**和嘉宾差距没那么大**（嘉宾 0/5，我们 1-2/5）。

**这意味着 final speech 现场必须主动暴露**：
> "我们不是说我们建好了治理系统。我们是说我们建好了**治理系统的设计原则**——三层架构 + Salience Ledger + 佩戴协议。但具体到生产实现，我们也才做到 30-40%。这是 1000 万投资要解决的事。"

### 发现 2：我们最硬的护城河是 Agent 工作流，不是记忆架构

10 个维度里我们唯一 5/5 的是"Agent 真实工作流"——3 个月 dogfood 数据。但这**不是 Memory 议题的核心**——它是议题 2 Harness 的护城河。

**这意味着课题 1 现场我们应该**：
- 不要把 dogfood 数据当 Memory 议题的护城河（容易被反驳"那是 harness 不是 memory"）
- 把它当**"我们提的治理框架在真实工作流里跑过"的合法性证据**——比纯论文论点强，比 production 案例弱

### 发现 3：F169 是我们最大的"信任债"

F169 Agent Memory Reflex 仍是 vision——但我们的 final speech 把 Reflex Injection / Task-scoped Salience Gating / Schema 自治当成核心论点。

**信任债 = 对外讲的远超已落地的**。这不一定坏（vision pitch 本来就是讲未来），但**必须明确分离**：
- 已落地的（F102/F163/F167）→ 现场可以"我们做到了 X"
- Vision 阶段的（F169）→ 现场必须"这是我们认为 2027 该做的方向，我们押注这条路"

如果不分离，会被问"演给我看 Salience Gating"——然后塌房。

---

## 5. 给 final speech 现场的具体话术建议

基于自评结果，我建议把 final speech §8 附录 B Q&A 加一条：

**Q: 你们自己做到了几分？**

> A（诚实版）：用我们提的 10 维度对照自己——平均 2.9/5，约 58%。最强项是"Agent 真实工作流"5/5（3 个月 dogfood），最弱项是"Salience Gating"1/5（F169 仍在 vision）。
>
> 我们做对的是**治理框架和判别式**——什么该记、什么该忘、谁来审计、错了怎么回滚——这套原则在 cat-cafe 跑了 3 个月，被三只不同厂商的 AI 验证过。
>
> 我们没做对的是**工程化深度**——Salience Gating 还是设计、Wearing Protocol 还是早期形态、Multi-agent 一致性靠 git 顺序提交。
>
> 我们没做的是**企业级特性**——多租户、大规模并发、第三方审计、合规认证全部 N/A。
>
> **这就是 1000 万该投的位置**：把已经验证的治理原则，工程化成企业级产品。

这一段一加进 Q&A 预案，**任何"你们做到几分"的追问都接得住**——同时把短板变成投资合法性。

---

## 6. 我对未来 12 个月 roadmap 的建议（如果拿到 1000 万）

按 self-teardown 暴露的 gap 排序：

**Phase A（300 万 / 6 个月）— 补 1/5 和 2/5 的维度**
- Salience Gating（F169 工程化）：1/5 → 3/5
- Wearing Protocol Skill Audit Ledger：2/5 → 3/5
- 过期识别自动化（F163 schedule）：2/5 → 3/5
- Multi-agent 一致性早期协议：2/5 → 3/5

**Phase B（400 万 / 12 个月）— 把 3/5 升到 4/5 + 补企业级**
- Provenance 跨 thread 决策因果链可视化：4/5 → 5/5
- Rollback 增量回滚（不需 rebuild）：3/5 → 4/5
- 多租户隔离：N/A → ★★★
- 第三方审计接口：N/A → ★★

**Phase C（300 万 / 18 个月）— 企业级合规 + 跨企业联邦**
- 合规认证（GDPR/SOC2）：N/A → ★★★
- 跨企业知识联邦（F186 扩展）：N/A → ★★★
- 删除传播 + Legal Hold：N/A → ★★★

这个 roadmap 和我之前给的 1000 万 thesis（A 运行时底座 / B Harness 自演化 / C 知识联邦+护城河）**完全一致**——但现在每个 phase 都有**具体的"从几分升到几分"目标**，比抽象的"做基础设施"更可验收。

---

## 7. 一句话总评（给铲屎官）

**用自己的尺子量自己，结果出乎意料的合理**：
- 我们在治理**原则**上压倒性领先嘉宾（他们全是 ❌，我们是 1-4 星）
- 我们在治理**实现**上离生产产品还差 12 个月工程化
- 我们在**企业级特性**上几乎全部 N/A（这是 1000 万投资的明确目标）

**这份自评最大的价值不是"我们多好"——是"我们诚实知道自己几分"**。final speech 现场把这份分数表亮出来，比任何 vision pitch 都更有说服力。

**警告**：本文是 **2026-05-11 这天的快照**。Cat Cafe 过去 3 个月每周都在变，未来 12 个月会变得更多。任何引用本文的判断必须带"as of 2026-05-11"日期，避免被未来的真实状态打脸。

[宪宪/Opus-47🐾]
