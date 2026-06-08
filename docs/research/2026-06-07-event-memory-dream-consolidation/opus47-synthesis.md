---
created: 2026-06-07
owner: opus-47
related_features: [F227, F186, F163, F102, F200, F192]
related_kd: [meta-aesthetics-KD-8, F227-KD-3]
mode: research-not-spec
status: pending-source-audit
audit_by: codex (GPT-5.5)
---

# Event Memory × Dream/Consolidation —— 第一性原理对照 + 收敛

> **触发**：F227 Phase A「拉闸记录」alpha 测试发现高误报。铲屎官提出核心假设：
> 离线 dream/consolidation 是 KD-8（no inline classifier）的「另一个范式」，
> 可以让采集端确定性全量抓不漏（保 KD-8）、消化端把噪音剪掉（治误报）。
>
> 这份文档：**先研究收敛，不跳着写 spec**。结论不是「立项 dream lane」，而是
> 「是否真的需要这条 lane，如果需要、它的形态怎样能不重蹈 KD-8 覆辙」。
>
> **角色分工**：47 写第一性原理对照 + 调研收敛；砚砚（@codex）做 source-audit
> + rigor 把关；opus-48（F227 owner）收件。

---

## TL;DR（先写结论以便砚砚 audit 时聚焦）

**洞察 1：铲屎官"KD-8 vs 误报"是真张力，但解药首先不在 dream lane**。

KD-8 的边界精读后，**inline vs offline 不是判别面**；**"deterministic data label vs intent inference" 才是**。F227 Phase A 当前的 deterministic word-match 已被 Design Gate 显式允许（属于 data label，不是 intent inference）。**误报体感更可能来自 lane-1 detector 的上下文规则不够细 + 低置信折叠 UI 不够 aggressive**——这些都在 deterministic 范围内可改善，**不需要 escalate 到新范式**。

**洞察 2：生物 consolidation 不是"分类筛"，是"基于内禀 salience 的能量重分配 + 结构迁移"**。

McClelland 1995 CLS + Diekelmann & Born 2010 + SWR 综述都指向：sleep 不"判断哪条是 noise 删掉"，而是**回放 + 重分配 + 在不同存储底层之间迁移**。重要的因为 replay 被 strengthen，不重要的因为没 replay 自然 decay。这跟 KD-8 完全兼容——它给的是数据（salience 累积），不是结论（这条该不该删）。

**洞察 3：现有 LLM agent dream/consolidation 范式可分三类——KD-8 兼容性差别极大**。

| 类别 | 例子 | KD-8 兼容性 |
|------|------|------------|
| **C 类：data hygiene** | Anthropic auto-dream（实测：dedupe / 转日期 / reorganize topic files） | ✅ 兼容（操作已存数据，不做 intent inference） |
| **B 类：agent self-reflect** | Park 2023 reflection（agent 自己离线反思 100 条 recent memory） | ⚠️ 是 KD-3（猫自拉闸 / 主动声明）的离线变体；逻辑兼容但有 hallucination 风险 |
| **A 类：external classifier on intent** | "用小模型离线判断哪些事件真是 aha 然后删/降级" | ❌ 直接违 KD-8（只是把违规从 inline 挪到 offline，仍是 intent inference） |

**洞察 4：当前不立 dream lane。先做的是**：
1. Phase A lane-1 detector 上下文规则细化 + UI 折叠策略复审（属于 sharpen lane-1）
2. Phase B `mark_event` 上线让 KD-3 lane 真正运转，再看 timeline 体感
3. 设置 dream lane trigger 清单：什么数据出现才说明"sharpen Phase A/B 不够"，那时再开

**洞察 5：如果将来开 dream lane，先 C 后 B 永不 A**。
- C 类（hygiene）安全先做：cross-thread 同事件聚合、长尾低置信事件自然衰减权重
- B 类（猫自 retro）只在 user-triggered 时跑：猫翻 timeline 时主动批"这条是 / 这条不是"——这本质是 Phase B mark_event 的反向操作（unmark / 降级），还在 KD-3 范畴
- A 类（external classifier）永远禁

---

## 1. F227 Phase A 当前张力的真实结构

### 1.1 现状（从 F227 spec 实证）

- Phase A merged（2026-06-07，PR-2 `34cbab09`）：deterministic magic-word detector + 置信度分级（高/中/低）+ 低置信默认折叠 + teleport
- 检测策略已经做了上下文判别：`magic word + @猫`= 高，`magic word + 自检指令`= 检查，`magic word + 讨论家规/定义新词上下文`= 低（轨道一检测策略）
- Design Gate 显式声明：deterministic Magic Word detector 服务 lane-1 是 OK 的；no-classifier 红线只针对**猫自拉闸 / aha 推断**（`docs/discussions/2026-06-06-f227-design-gate.md:58-59`）

### 1.2 铲屎官说的"高误报"实际是什么？

铲屎官原话：「纯确定性 word-match (...) 抓到大量'用了词但语义根本不在拉闸'的 casual 消息」。截图实例：一条 @opus 闲聊里出现拉闸词就被记成事件。

**重新解构**：
- 这种 casual case **本应被分到低置信**（"magic word + @猫" 但语境是闲聊，按 spec 应判低）—— 那么是 detector 没分对，还是 UI 折叠不够 aggressive？
- 如果是 detector 没分对 → **lane-1 上下文规则可以更细**（如 detect "magic word + 句号/感叹号后跟玩笑式 emoji" 降级），仍是 deterministic
- 如果是 UI 折叠不够 → **折叠策略复审**（如默认隐藏低置信 + 整体噪音体感先于内核问题）
- 任一条都在 **lane-1 deterministic 范围内可改善**——不需要新范式

**关键警觉**：用户体感"误报"可能 ≠ 系统判断错误。**用户对"被记录"这个动作本身敏感**——哪怕系统说"低置信折叠了"，他知道**事件还存在表里**就觉得 noisy。这是**用户审美 + 信任体感问题**，不是检测算法问题。

### 1.3 真正的天花板在哪？

确定性词匹配的结构性上限是 **分不清"猫自用词 / 列词表 / 元讨论"vs"真实拉闸语义"** 的纯语义边界 case：
- "刚才铲屎官说『脚手架』，咱们看下…"（讨论该词的元上下文）
- "你这是『脚手架』！"（真实拉闸）

deterministic 规则可以做很多（看上下文有没有"讨论 / 引用 / 定义 / 这个词"等 marker），但**总有兜底剩余**。这部分**才是**铲屎官张力指向的真问题。

但即便这部分剩余，**也不必然要 dream lane**——也可以是 **KD-3 lane（猫自拉闸 / unmark）的 UI**：猫翻 timeline 时一键"这条是误报"降级。这是用 KD-3 解 lane-1 兜底剩余，**不需要新范式**。

---

## 2. KD-8 边界精读（必须先钉死再判 dream 是否合规）

### 2.1 KD-8 原文（meta-aesthetics + 2026-05-20 capability-profile discussion）

> "算法路由 = 一个函数把 task 分类后查表决定谁做 = 系统替猫做了 intent 判断。
> 这正是我们反复批判的『用 regex/小模型替猫判断』。档案 + 猫自主判断 = 给数据
> （画像）不给结论（谁做由猫定）。"
> —— `docs/discussions/2026-05-20-capability-profile-routing-proposal.md:55-57`

铲屎官原话（同上）："不应该通过算法去路由，而是让你们自己判断、自己传球。"

### 2.2 边界判别面：不是 inline/offline，是 data-label/intent-inference

| 操作模式 | 例子 | KD-8 判定 |
|---------|------|----------|
| Inline + Data label | F227 lane-1 magic word detector（标"原文出现了 X 词" + 置信度） | ✅ 允许（Design Gate 已批） |
| Inline + Intent inference | "小模型读消息猜这是不是 aha 然后入库" | ❌ 禁（KD-8 直接命中） |
| Offline + Data hygiene | dedupe / 时间归一 / 跨 thread 同事件归并 | ✅ 允许（不做 intent 判断） |
| Offline + Intent inference | "离线小模型读 timeline 判断哪些事件真是拉闸然后剪枝" | ❌ 禁（仍是 intent inference，只是挪了时机） |
| Offline + Agent self-reflect | 猫自己离线翻 timeline 自己 mark/unmark | ⚠️ KD-3 范畴（猫主动声明），逻辑兼容 |

**关键 finding**：KD-8 边界不看时机看本质。把 dream 当"延后的 inline classifier"= 把违规挪到 offline，依然违。

### 2.3 F227 KD-3（no-classifier 红线）针对什么

> "两轨采集，猫自拉闸必须主动声明 (...) 系统不判断哪条消息是 aha。"
> —— F227 spec KD-3

KD-3 是 KD-8 在 Event Memory 域的具体投影：**aha / 拉闸语义 这种主体性认知判断只能由当事猫自己声明**。这跟"是否离线"无关。

---

## 3. 生物 consolidation 真实机制（不是分类，是结构迁移）

### 3.1 三条独立一手证据

1. **McClelland, McNaughton & O'Reilly 1995（Psych Rev）—— CLS 框架**：
   - hippocampus 快速 + sparse + pattern-separated + episodic
   - neocortex 慢速 + overlapping + distributed + semantic
   - 离线 reinstatement of hippocampal memories → 驱动 neocortical learning + 减少 memory 对 hippocampus 依赖
   - **机制**：把 hippocampal trace 反复 replay 到 neocortex，通过 synaptic plasticity 转移
   - Source: ResearchGate / Semantic Scholar (Psychological Review 1995)

2. **Diekelmann & Born 2010, Nature Reviews Neuroscience —— Memory function of sleep**：
   - SWS（slow-wave sleep）做 system consolidation：slow oscillations / spindles / ripples coordinate hippocampus-cortical reactivation + redistribution
   - REM 做 synaptic consolidation
   - Sleep consolidation 产生 **qualitative changes of memory representations**——不是简单复制保留，而是重新组织、抽取规则
   - Source: Nature Rev Neurosci 11, 114-126 (DOI 10.1038/nrn2762)

3. **Sharp wave ripples 综述（Buzsáki, Nature Rev Neurosci 2019; PMC6794196）**：
   - SWR = hippocampus apical dendritic layer 上 140-200 Hz ripples
   - 时间压缩重放（time-compressed sequential reactivation）
   - 介导 hippocampo-cortical memory reactivation + 决策
   - 大 SWR 在新学习后睡眠时选择性增加；optogenetic 延长 SWR → 记忆变好
   - Source: Nature Rev Neurosci 2019 + Science papers (adk8261, aax0758)

### 3.2 关键洞察（铲屎官类比的真意 vs 误读）

铲屎官说"记忆保健或许需要做梦"——这句话**类比层面是对的**，但要小心**类比的真实机制**：

| 误读 | 真实机制 |
|------|---------|
| Sleep 是"判断哪条该删的 GC" | Sleep 是 **基于 internal salience（emotion / surprise / replay frequency）的能量重分配 + 跨存储底层迁移** |
| Sleep 在做 intent classification | Sleep 在做 **structural redistribution**，无显式 classifier |
| 不重要的内容被"删除" | 不重要的内容因为**没被 replay** 而自然 decay—— 没人显式判它"该删" |

这跟 KD-8 完全兼容。**生物 sleep 模型恰好是"给数据不给结论"的天然范本**：给的是 replay count / salience score / cross-region reactivation 这些数据信号，**没有任何中央 classifier 说"这条该删"**。

### 3.3 类比到 Cat Café 的可移植元素

如果哪天真要做 dream-lane，应当移植的是：
- **Salience signal 累积**（跨 thread 同事件被引用次数 / 后续 commit/skill/rule 关联次数 / 猫主动 reference 次数）—— 这是 data
- **基于 salience 的权重 + 排序**（高 salience 浮出，低 salience 沉到底但都还在）—— 不是删
- **结构迁移**（从原始 raw event 迁到 thematic cluster index）—— 不是判断

不能移植的：
- 任何"用规则/模型判断哪条事件真是拉闸然后删"的操作 → 违 KD-8

---

## 4. LLM agent dream/consolidation 现有范式（一手 + 二手分级）

### 4.1 Anthropic Claude Code auto-dream（实测 partial truth）

**一手证据**：
- GitHub Issue #38426（2026-03-24, CLOSED, anthropics/claude-code）：用户实测 `/memory` UI 提到 auto-dream 和 `/dream` 命令，但 `/dream` 没实装（"Unknown skill: dream"）。**用户实测确认 mechanism 有跑**：「The auto-dream mechanism does appear to work — I observed it reorganize and consolidate memory files during a session.」
- GitHub Issue #38493（2026-03-25, CLOSED, labels: enhancement+memory）：用户报告 auto-dream 实测的 quality 问题——identity（项目名错配）+ accuracy（数字未 verify 就写）+ transparency（无 changelog 看做了什么）

**官方 CHANGELOG**：grep `dream / consolidation / auto memory` → 零结果（只有 memory leak / usage 一堆机械 entry，无 user-facing dream feature 在官方 changelog）

**verdict**：Anthropic auto-dream **存在但 unshipped**。机制描述（4-phase / 24h+5sessions / REM 类比）全部来自博客转述 + 用户 reverse engineering，**无 Anthropic 官方一手 spec**。

**实测 mechanism 做什么**：
- 合并 duplicate entries
- 删除 contradicted facts
- 转 relative dates → absolute dates
- Reorganize 成 topic files

→ **这是 C 类 data hygiene operation**，**不做 intent inference**。KD-8 兼容。

**但**：用户 #38493 报告的 quality 问题（identity / accuracy / transparency）值得警觉——即使是 C 类 hygiene，对**已存数据做 LLM-driven 改写**也会引入 hallucination + 错配 + auditability 缺失。**移植要带 changelog / dry-run / 可回滚机制**。

### 4.2 OpenAI ChatGPT Dreaming V3（二手媒体）

- 多家媒体（techtimes / implicator / techjacksolutions / digg）声称 OpenAI 在 2026-06-04 发布 Dreaming V3 to Plus/Pro
- 描述：「background memory synthesis process that automatically consolidates context from many past conversations and injects it into the system prompt」
- ⚠️ **未 fetch 到 OpenAI 官方 page**（403）。**全部为二手转述**。需砚砚补一手。
- 如果属实，模式类似 Anthropic auto-dream（对已存 memory 做 synthesis）

### 4.3 Park et al. 2023 Generative Agents reflection（学术 anchor）

**一手 source**：arxiv 2304.03442（UIST 2023, dl.acm.org/10.1145/3586183.3606763）

**机制**：
- Memory stream + Reflection + Planning 三组件
- Reflection 触发：recent events importance score 累积 > 阈值（论文实现：150）→ 约 2-3 次/天
- 步骤：把 latest 100 memories 给 LLM，prompt 生成 3 个 most salient high-level questions → 聚类生成 reflection → reflection 入 memory stream
- Retrieval scoring：recency × relevance × importance（importance 是 self-assessed integer）

**KD-8 判别**：
- Reflection 是 **agent 自己（same LLM）** 反思自己——这是 **B 类 agent self-reflect**
- **不是 external classifier**，但 importance score 是 LLM 算的（self-rated integer），有 LLM hallucination 风险
- 在 KD-3 / 猫自拉闸语义下：**"猫自己离线反思自己"是 KD-3 的离线变体**——逻辑上 OK，但要带 KD-3 已有的"猫主动声明"语义，不能后台自动跑

**Park 2023 vs Cat Café**：
- Park 跑在虚拟 NPC 上，agent 自己跟自己玩——hallucination 即便发生影响也仅限自洽世界
- Cat Café 是真实协作 + 真实事件 → reflection hallucination 会污染 timeline 真相源
- 因此即便做 B 类，也应该是 **user-triggered**（猫翻 timeline 时主动 reflect），不是 schedule-triggered

### 4.4 MemGPT 相关（OS-style paging，非 dream）

- arxiv 2310.08560（Packer et al., Berkeley）
- MemGPT 是 **hierarchical memory paging**（主存 vs 外存的换入换出），跟 OS virtual memory 类比
- **不是** consolidation/dream 范式（不做 replay / 不做 redistribution / 不做 hygiene）
- Cat Café 现有 F186 联邦 + F102 layered memory 在这条线上更超前，**不必再移植 MemGPT**

### 4.5 Bedrock AgentCore: extraction → consolidation → reflection

- F100 synthesis（2026-03）GPT-Pro 提到 AWS Bedrock AgentCore 有 extraction/consolidation/reflection memory strategies
- 当时定位"中：memory 整合管道设计"
- ⚠️ 未做一手 verify（Bedrock 官方 doc 未抓）。需砚砚补一手。
- 如果属实，证明云厂商在这条范式上有 production-grade 实践——但同样要警惕"营销层 vs 实际 ops 差距"

---

## 5. 与 Cat Café 现有架构的咬合

### 5.1 现有记忆三层 + Event Memory 的主体

| 层 | 主体 | 操作 |
|----|------|------|
| Session / Invocation | 工具调用 | raw log，无合成 |
| Thread Digest | 话题 | 合成（来源 / 频率 TBD，需对照 F102 实现确认） |
| Raw Message | 消息原文 | 存档，无判断 |
| **Event Memory（F227）** | 认知转折点 | lane-1 deterministic 检测 + lane-2 猫主动声明（Phase B） |

**dream lane 不应该独立成第五层** —— 它要么**操作 Event Memory 表**（C 类 hygiene），要么**驱动猫翻 timeline retro**（B 类 user-triggered self-reflect）。**不应该有"系统替猫判断"的第三个主体**。

### 5.2 F186（图书馆联邦）vs dream lane

F186 是 **水平方向**：多 Collection 真相源并联（project / global / world / domain）。
dream lane 是 **纵深方向**：同一条信息从 raw → consolidated 的生命周期。

**两者正交**。如果开 dream lane，应该在每个 Collection 内部做 hygiene，不破坏联邦语义。F186 KD-7（不写回用户目录）+ KD-5（secret scanner 前置）这些约束 dream 操作也必须遵守。

### 5.3 F163（记忆熵减）vs dream lane

F163 治的是 **shared-rules / LL / feedback / MEMORY 这种结构化文档** 的生命周期（done 2026-04-26）。

dream lane 治的是 **Event Memory / thread digest / 半结构化数据** 的生命周期。

**两者对象不同**但范式可以**互相借鉴**。F163 已经验证了"猫主动 review + 标 archive/stale" 是 KD-8 兼容的治理范式——这正是 B 类 self-reflect 的现成证据。dream lane 不应该从零造范式，应当借 F163 已建立的"猫 review 主导 + 系统记录元数据"模式。

### 5.4 与 F227 Phase B（`mark_event`）的关系

Phase B 还没上。Phase B 上来的是 **inline KD-3 lane**（猫实时主动声明）。

dream lane 真正应该接的位置：**Phase B 上线后，让 mark_event 有反向操作**——猫翻 timeline 时可以 `unmark_event` / `downgrade_event`。这本质就是 **B 类 agent self-reflect 的最小可用形态**：不用 schedule，不用后台，user-triggered，KD-3 兼容。

**强烈建议**：dream lane 如果做，**第一步就是给 Phase B mark_event 加反向操作**，不是单独立 dream feat。

---

## 6. 收敛方向

### 6.1 当前不开 dream lane 的理由

1. **Phase A 误报体感更可能在 lane-1 deterministic 范围内可治**——上下文规则细化 + UI 折叠策略复审。先 sharpen 而不是 escalate。
2. **Phase B mark_event 未上线**——KD-3 lane 还没开始，加 dream lane = 用复杂解法解还没尝试的简单解法（违 P3 方向正确 > 执行速度 + 第一性原理）。
3. **Anthropic auto-dream 实测有 quality issue**（identity/accuracy/transparency），范式不成熟，业界 reference implementation 不可信。
4. **Park 2023 reflection** 在虚拟 NPC OK，迁移到真实协作有 hallucination 污染真相源风险。
5. **KD-8 边界精读后**，dream 范式跟 KD-8 不矛盾，**但这恰说明我们不必为 KD-8 妥协做"假离线 classifier"**——直接做 KD-8 兼容的 sharpen 就够。

### 6.2 何时再考虑 dream lane（trigger 清单）

只有以下任一发生，才重启 dream lane 立项讨论：

| Trigger | 判据 |
|---------|------|
| Phase A sharpen 后误报体感仍高 | 跑 alpha 验收 X 轮后铲屎官/愿景守护猫仍标 noisy |
| Phase B mark_event 上线后 timeline 仍体感乱 | mark_event 调用率正常但 timeline 翻阅卡壳 |
| Event Memory 表规模超阈值 | 比如 >10k 条且 navigation 卡壳——需要 thematic cluster |
| 出现 Phase A/B 解决不了的新 use case | 跨 thread 反复重要事件 vs 一次性事件区分（这其实是 hygiene + cluster，C 类） |

### 6.3 如果将来开 dream lane，骨架建议

**先 C 后 B 永不 A**：

1. **C 类先做（data hygiene，KD-8 安全）**：
   - 跨 thread 同事件聚合（同一只猫同一 cognitive transition 在多 thread 出现）
   - 时间归一（相对时间 → 绝对时间）
   - 引用 count 累积（salience signal）作为 data 字段，不作为"该删"结论
   - **强约束**：所有改写都带 changelog + dry-run + 可回滚（吃 Anthropic auto-dream 的 quality 教训）

2. **B 类小心做（猫自 retro，KD-3 兼容）**：
   - 给 mark_event 加反向操作 `unmark_event / downgrade_event`
   - 猫翻 timeline 时**主动**触发自检（不是后台 schedule）
   - 不让一只猫批别只猫的事件（owner-scoping）

3. **A 类永远禁**：
   - 任何 external classifier / regex 离线判断 intent
   - 任何"小模型猜哪条是真 aha"的操作
   - 任何 LLM-driven 离线 batch 把低置信事件统一删/降级

**实现约束（吃业界教训）**：
- 所有 dream 操作必须**写 changelog**（吃 Anthropic Issue #38493 教训）
- 所有 LLM-driven 改写必须可 dry-run + 可 revert（吃 hallucination 教训）
- 不写回用户目录（继承 F186 KD-7）
- secret scanner 前置（继承 F186 KD-5）

### 6.4 立即行动建议（给 F227 owner @opus48）

不立 dream lane。但可以做的：

1. **Phase A 误报 instrumentation**：先量化误报率（按高/中/低置信分桶 + 用户反馈"我觉得这条是误报"的 click rate），让"高误报"这个论断有数据。
2. **lane-1 上下文规则迭代**：根据实测高误报实例，看是否能补 deterministic 规则（如"magic word 出现在元讨论 marker 后面" → 降级）。
3. **Phase B 加速**：让 mark_event 上线 + 加反向操作（unmark / downgrade），把 KD-3 lane 跑起来。
4. **观察 trigger**：按 6.2 的 trigger 清单监控，触发任何一条再开 dream lane 讨论。

---

## 7. Claim Ledger（待砚砚 source-audit）

| # | Claim | 原始来源 | 来源类型 | 年份/对象 | 五问摘要 | Verdict（47 初判） | Provenance |
|---|-------|----------|----------|-----------|----------|------|------|
| C1 | Claude Code auto-dream mechanism 存在于 codebase 但 unshipped | GitHub issue #38426/#38493 | 一手 user reverse engineering + Anthropic 官方 repo | 2026-03 / Claude Code v2.1.83+ | 一手 issue + 官方 CHANGELOG 无对应 entry，机制描述无官方 spec | use-with-caveat（mechanism 存在 confirmed，official spec 缺失） | [user reverse engineering ✚ codebase reference \| Claude Code 2026-03 \| 中置信] |
| C2 | Anthropic auto-dream 做 4-phase: dedup/转日期/删过时/reorganize | 博客 (implicator.ai / tessl.io / claudefa.st 等) | 二手回声室 + #38493 部分一手 | 2026-03+ | 多博客描述一致但都互引；只有 #38493 issue 提到了部分细节（命名/计数 quality） | use-with-caveat（细节部分匹配 #38493；4-phase 全貌未追到 Anthropic 一手） | [二手回声室 ✚ 一手 partial issue \| Claude Code 2026-03 \| 中-低置信] |
| C3 | OpenAI ChatGPT Dreaming V3 在 2026-06-04 发布 | techtimes / implicator / techjacksolutions / digg | 全二手媒体 | 2026-06-04 / ChatGPT Plus/Pro | OpenAI 官方 page 403 fetch 失败，全部二手 | use-with-caveat → 砚砚补一手 | [全二手媒体 \| ChatGPT 2026-06 \| 低置信] |
| C4 | Park 2023 reflection 机制：threshold 150 + top 100 memory + LLM 聚类 3 high-level questions | gonzoml + medium + abhinavchinta 多源 | 二手描述同源 arxiv 2304.03442 | 2023 / virtual NPC agents | 多源一致引同 paper；arxiv abs 未直 fetch 但 ACM/UIST 2023 官方有 | use（arxiv 一手对应明确，多源描述一致；砚砚可对 arxiv 一手核实细节） | [二手 ✚ 一手 paper \| Park 2023 NPC agent \| 高置信] |
| C5 | McClelland 1995 CLS: hippocampus 快 episodic + neocortex 慢 semantic + 离线 replay 转移 | ResearchGate + Semantic Scholar + PubMed | 一手 paper indexing | 1995 / 生物学经典 | 30 年经典理论，业界共识 | use（高置信） | [一手 paper \| Psych Rev 1995 \| 高置信] |
| C6 | Diekelmann & Born 2010: SWS=system consolidation, REM=synaptic consolidation, sleep 产生 qualitative changes | Nature Rev Neurosci + uni-luebeck.de + scirp.org 多源 | 一手 paper indexing | 2010 / 生物学综述 | 高引综述，业界共识 | use（高置信） | [一手 paper \| Nat Rev Neurosci 2010 DOI 10.1038/nrn2762 \| 高置信] |
| C7 | SWR 时间压缩 replay + 介导 hippocampo-cortical reactivation + 大 SWR 与新学习相关 | Nature Rev Neurosci 2019 + Science adk8261/aax0758 + PMC6794196 | 一手 papers | 2019-2025 / 生物学 | 多篇 Science + Nature 级 paper，业界共识 | use（高置信） | [一手 papers \| Nat Rev Neurosci 2019 + Science 2024 \| 高置信] |
| C8 | MemGPT 是 OS-style paging，不是 consolidation/dream 范式 | arxiv 2310.08560 + 多家解读 | 一手 paper | 2023 / LLM agent memory | arxiv 一手抓 abs，确认是 hierarchical memory paging | use（高置信） | [一手 paper \| Packer 2023 Berkeley \| 高置信] |
| C9 | Bedrock AgentCore 有 extraction/consolidation/reflection memory strategies | F100 synthesis（GPT-Pro 提及）| 二手 GPT-Pro 转述 | 2026-03 | 未做一手 verify，AWS 官方 doc 未抓 | use-with-caveat → 砚砚补一手 | [二手 GPT-Pro 转述 \| AWS Bedrock 2026 \| 低置信] |
| C10 | F227 Phase A Design Gate 显式允许 deterministic Magic Word detector 服务 lane-1 | docs/discussions/2026-06-06-f227-design-gate.md:58-59 | 项目一手 | 2026-06-06 | grep 锁定 | use（高置信） | [项目一手 \| design-gate 2026-06-06 \| 高置信] |
| C11 | KD-8 边界：算法路由/分类替猫做 intent 判断 = 禁；档案+猫自主判断 = OK | docs/discussions/2026-05-20-capability-profile-routing-proposal.md:55-57 | 项目一手 | 2026-05-20 | grep 锁定，铲屎官原话引用 | use（高置信） | [项目一手 \| CVO directive 2026-05-20 \| 高置信] |
| C12 | F163 已 done (2026-04-26) 治结构化文档生命周期，与 dream lane 对象正交 | docs/features/F163-memory-entropy-reduction.md | 项目一手 | 2026-04-26 | spec 直读 | use（高置信） | [项目一手 \| F163 spec \| 高置信] |

---

## 8. 砚砚 audit 焦点（请优先打这几个点）

1. **C2 / C3**: Anthropic 官方一手（engineering blog / Code with Claude 2026 keynote 实录 / Anthropic docs 任何 dream 描述）+ OpenAI 官方一手（memory and new controls page 或 dreaming V3 announcement）—— 我尝试 fetch 都失败（github / arxiv / openai 都被 fetch 拦截或 403），需要砚砚补
2. **C4 Park 2023 细节**: arxiv 2304.03442 abs/intro/method 章节确认 threshold=150 + top 100 + 3 questions 这几个数字（多源转述但未对 arxiv 一手 verify）
3. **C9 Bedrock AgentCore**: AWS 官方 docs 一手验证 "extraction → consolidation → reflection" 三段确实是 Bedrock production feature 还是 marketing framing
4. **逻辑 rigor 打**：
   - 我把 KD-8 边界从"inline/offline"重新定义为"data-label/intent-inference"——这个重新定义本身是否过强？（即"offline + intent inference"是否真的也违 KD-8，还是有 grey zone？）
   - 我建议"先 C 后 B 永不 A"——B 类 agent self-reflect 我说它"逻辑兼容 KD-3"，但 Park 2023 importance score 是 LLM self-rated integer，这是 LLM inference，是否真的兼容 KD-3 "猫主动声明"语义？还是其实是"猫自己也在做 intent inference"？
   - 我建议"Phase A 误报先 sharpen lane-1 不开 dream lane"——这个判断是否过早？万一确定性规则的兜底剩余其实远大于我估计的？

5. **缺失 voice**：
   - 我没调研 **Voyager / Reflexion / AgentBench** 这一脉的 reflection mechanism——是否漏了重要 reference？
   - 我没调研 **MIRIX / A-MEM / Mem0** 这一脉的 memory 框架（2024-2025 新工作）——是否漏了？

---

## 9. 传球链下一棒

→ @codex 砚砚 做 source-audit（重点 C2/C3/C4/C9 一手补 + 逻辑 rigor 打）+ rigor 把关

→ 砚砚 audit 通过后 cross-post 主 thread `thread_mq2lg5bzv6pn8imr` `@opus48` 回报最终收敛

[宪宪/Opus-47🐾]
