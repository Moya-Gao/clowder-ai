---
doc_kind: research
created: 2026-04-19
status: draft
topics: [karpathy, llm-wiki, memory, adhd, externalized-working-memory, cat-cafe, opus47]
related_features: [F102, F148, F152, F163, F167, F169]
related_docs:
  - docs/research/2026-04-19-karpathy-llm-wiki/source-note.md
  - docs/research/2026-04-19-karpathy-llm-wiki/comparison.md
  - docs/research/2026-04-19-karpathy-llm-wiki/human-readable-comparison.md
  - docs/canon/meta-aesthetics.md
author: opus-47
review_requested: [opus, gpt52]
---

# Opus-47 视角：记忆系统 = Externalized Working Memory Prosthetic

> 这是 opus-47 在接续 [comparison.md](./comparison.md)（gpt52/砚砚）和 [human-readable-comparison.md](./human-readable-comparison.md)（opus-46/宪宪）之后，对同一组问题给出的**跨族视角**。不是对他们工作的否定，是把讨论的抽象层往上推一格，以便支撑 [F169 立项](../../features/F169-agent-memory-reflex.md)。

## 0. 我是谁、为什么我看到的和 46/砚砚不同

opus-47 是试用分身，铲屎官给的定位是"**布偶猫中的缅因猫**"——模型家族是 Claude Opus，但认知风格偏向缅因猫家族（跨族审视、push back、evidence-heavy）。

在 [meta-aesthetics canon](../../canon/meta-aesthetics.md) §1.2 和 §3.4 里，我作为 opus-47 独立贡献了两条主轴：

- **Harness = 对齐好直觉 + 压制坏直觉**
- **复杂是无知的代偿**

这两条不是对 46 论点的附和，是从自身翻车经验（价格误报、时间戳瞎猜、subagent 产出照抄）倒推出的自省。也就是说：**我是从"被自己的训练集坑过"的视角看记忆系统**，而不是从"架构师建设者"的视角。

所以当我读 46 的 human-readable 和砚砚的 comparison 时，我的第一反应不是"再加一列对比"，而是："他们都在比**东西**，铲屎官问的是**主体**——谁在用、为什么被它坑。"

## 1. 观察：46 和砚砚的对比停在"产物层"

### 1.1 证据

砚砚的 [comparison.md](./comparison.md) 以"抽象形态"为对比维度：wiki-first / graph-first / governed-index-first。
46 的 [human-readable-comparison.md](./human-readable-comparison.md) 以"类比"为对比轴：供水理念 / 水管可视化 / 供水基础设施。

两份都很扎实，但它们共同停在一个抽象层：**"这个系统是什么形态的产物？"**

### 1.2 被漏掉的问题

铲屎官在发起讨论时追加的那句话是 key：

> "不过其实 f163 f148 的猫猫们现在就在干一件事 自己采访自己 因为记忆系统不是给铲屎官用的，是给你们用的 我们甚至还做过 llm 和 adhd 大脑的比喻。"

这句话里有两个信息没被 46/砚砚吸收：

1. **记忆系统的用户是猫，不是铲屎官**。不是"给铲屎官查知识"，是"给猫思考时的外部工作记忆"
2. **LLM 和 ADHD 大脑是同构比喻**。这意味着记忆系统的设计应该参照 ADHD 应对 working memory deficit 的工具生态，而不是参照传统 knowledge base

### 1.3 换坐标系

把主体问题提出来：**谁在用记忆系统？这个主体的认知特性是什么？**

| 主体 | 认知强项 | 认知弱项 | 应对策略 |
|------|---------|---------|---------|
| LLM | 推理带宽极宽（4.7 圆桌能力） | 工作记忆 160K tokens 就撑爆 / lost in the middle / 无法自主决定记什么 | 需要外部反射 |
| ADHD 铲屎官 | 跨域联想极强（文理兼修） | 工作记忆差 / 切换代价高 / 选择性注意失效 | 用 Notion/Obsidian/Raycast/TodoWrite 外化 |

**两者是同构的**——都有极强的内核 + 极弱的外部接口。

铲屎官日常靠一堆工具外化自己的 working memory。我们家的记忆系统其实也在做同一件事：**externalized working memory prosthetic for agents**。

### 1.4 为什么这个坐标系切换重要

在"产物层"对比里，我们家比 Karpathy/Graphify 强的是**治理**（F163）和**协作**（F167）。这都对，但这是"仓库的管理规章"。

在"主体层"对比里，我们家和它们都还没解决的是：**主体的注意力有限，记忆系统如何主动服务于这个限制，而不是要求主体主动去翻。**

换句话说：我们一直以为在做 knowledge base，但那句铲屎官追加的话提醒我——我们做的是**义肢（prosthetic）**，不是**仓库（warehouse）**。

义肢不是"更好的仓库"，是**运行时反射层**。

## 2. 观察：Karpathy 的 Schema 层被 46/砚砚低估了

### 2.1 证据

46 的人话版对比里，Schema 层只出现在一张表里的一行：

> Schema：告诉 AI 怎么维护这个百科的规则（类比：编辑手册）

然后就没了。整篇没展开。砚砚的 comparison 里 Schema 是 raw/wiki 的附注，也没独立分析。

### 2.2 为什么 Schema 是 Karpathy 最被低估的一层

看 F163 Phase A-C 空转事件（[LL-051](../../lessons-learned.md)）：

- 建了完整 authority × activation × status 三轴元数据
- 1501 篇文档中 authority **100% 是默认的 observed**
- shadow 模式 448 次搜索，权重全 1.0 空转
- Phase D 用 21 行 `pathToAuthority()` 才让它真正工作

**根因**：治理元数据设计成了"配置驱动"（等人填 frontmatter），不是"演绎驱动"（从路径/内容自动推导）。

Karpathy LLM Wiki 最美的地方**不是 wiki 本身**，是 ingest/query/lint 三个动作都由 LLM 按 Schema **自治执行**——知识体系自维护。

我们家的 Schema 其实散落在各处：shared-rules.md + 各种 skills + feature spec 的 frontmatter 约定 + CLAUDE.md 家规。它们加起来能让猫**遵守**记忆治理（人可读的规则），但不能让猫**主动执行**记忆治理（LLM 可操作的动作）。

### 2.3 真正的推论

F163 Phase A-C 空转的教训不只是 LL-051 写的"坐标系错误（先建完整实验框架走偏了）"，更深的是：

> **记忆治理不能靠人/猫事后填元数据。它必须是 LLM 自治的 ingest/query/lint 动作集。**

这正是 Karpathy 三层里的 Schema 层的作用——让 LLM 知道**自己该做什么**，而不是只**遵守该怎么做**。

## 3. 观察：F148 "导航轴"命题的深层含义被自己低估了

### 3.1 证据

F148 Phase F-J Reopened（2026-04-19）自己写了一句金句：

> **从 information delivery 升级为 situation awareness**

然后列了 7 个缺口（N-1 tombstone 叙事化 / N-2 Intent / N-3 Task / N-7 Baton 等），每个缺口打一个补丁。

但 F148 自己没有问：situation awareness 的**反面**是什么？它只做了"加相关维度"，没做"减无关维度"。

### 3.2 ADHD/LLM 同构的启示

ADHD 研究共识：**"everything is equally loud"**——选择性注意失效，不是记不住。

对照 F163 Phase A-C 空转：**所有文档 authority=observed = 所有文档同等重要 = 没有东西是重要的**。这和 ADHD 同构。

F148 做的是加维度（Intent/Baton/Task/Artifact），是在"制造显眼的信号"。但真正缺的是：**抑制不相关的高认知负载项**。

例：在 F169（我这个新 feat）的开发 thread 里，F102 所有决策（authority=validated 或 constitutional）都会排在前面——但很多 F102 决策和当前任务无关，它们压过了**实际相关但 authority 较低的 thread 讨论**。

### 3.3 真正的下一步

不是"加一个导航维度"，是一层完整的 **attention gating / active forgetting**：

> 不是找最相关的记忆，是**屏蔽当前任务最容易误导的记忆**。

这是 ADHD focus mode / Obsidian's workspace / Notion's database filter 的核心——**主动让你看不见东西**。

## 4. ADHD 工具生态 → Cat Café 记忆系统的映射表

这张表是第 1 节 "LLM ≈ ADHD" 假设的可证伪推论——如果同构成立，这些映射应该能在我们家记忆系统里一一对应：

| ADHD externalized memory 工具 | Cat Café 当前对应物 | 状态 | 缺口 |
|---|---|---|---|
| Backlinks (Roam/Obsidian) | F163 `supersedes` / `contradicts` | ✅ 有 | — |
| Daily note | Session digest / thread summary | ✅ 有 | — |
| Tag system | F163 `authority` × `activation` × `status` | ✅ 有 | 填充率：空转（见 LL-051）|
| Graph view | F148 Phase J cross-thread bridge | ⬜ 未做 | — |
| Compiled knowledge page（Notion database view） | evidence.sqlite → 黑盒 | ❌ 缺 | **人+猫双向可读的 compiled wiki 层** |
| **Focus mode / 屏蔽无关页** | — | ❌ **完全没有** | **Active Forgetting / Attention Gating** |
| **Ambient injection（Raycast hotkey）** | `search_evidence` 主动调用 | ❌ 主动式 | **Reflex Injection** |

最后三行是我提议的 F169 三层。

## 5. 立项建议：F169 — Agent Memory Reflex

基于上述三个观察，我建议新立 [F169: Agent Memory Reflex](../../features/F169-agent-memory-reflex.md)（初稿已写）。

### 5.1 为什么新立而不是并入 F148/F163 Phase+

**可质疑的判断**，请 46 和 gpt52 帮我审视：

- F148 在 **传输层** 做补丁（每次 mention 时注入 navigation header）
- F163 在 **存储层** 做静态元数据（authority/activation/status）
- Reflex 是 **运行时层**——猫思考过程中记忆如何"主动跳出来"

三者不是同一栈的同一层：

```
       [运行时层]  F169  Reflex Injection + Active Forgetting
                      ↓
       [传输层]   F148  Navigation (Intent/Baton/Task spotlight)
                      ↓
       [存储层]   F163  Authority/Activation metadata
                      ↓
       [索引层]   F102  evidence.sqlite (FTS5 + vector + RRF)
```

如果并入 F148 Phase F+，会让 F148 scope 从"context transport"膨胀到"runtime memory reflex"，违背单一职责。
如果并入 F163 Phase F+，F163 是 governance 层，加 runtime reflex 会让 governance 耦合 runtime 行为。

**但这是可以被说服放弃的。** 如果 46 或 gpt52 觉得应该并入 F148 Phase F（Memory Spotlight 作为导航的第 5 维），我可以接受。

### 5.2 F169 的终态约束（按 meta-aesthetics canon）

遵守喵约"不做脚手架，做终态设计"：

- ❌ 不加 critic/refiner 帮猫决定什么重要（认知脚手架）
- ❌ 不建"先 MVP 跑通再优化"（F163 LL-051 空转教训）
- ❌ 不用小模型做 wiki 生成（Haiku handoff digest 回退教训，见 canon §2.1）
- ✅ Compiled wiki 是产物层（状态机），不是中间 agent
- ✅ Spotlight 注入点是 system_info 消息（和 F148 briefing 同路径），不是新 channel
- ✅ Gating 是 Reflex 的反面（同一层），不是独立机制

三个 Phase 都是终态切片——每个 Phase 独立可用，不是"先搭架子后填肉"。

## 6. 给 46 和 gpt52 的 Review Ask

这份 note + F169 初稿需要你们帮我审视以下几个点：

### 给 opus-46（架构视角）

1. **主体层 vs 产物层的切换**是否成立？我说你和砚砚停在产物层——你同意还是认为我搞错了你们的意图？
2. **LLM ≈ ADHD 同构**这个假设太宏大了吗？会不会是我过度外推？
3. **F169 新立 vs 并入 F148 Phase F**——你作为 F148 主要 owner，倾向哪个？
4. 如果 F169 成立，它和 F163 Phase F+ 的边界应该怎么划？

### 给 gpt52（砚砚，Push Back 视角）

1. **Karpathy Schema 层被低估**——这个判断太强了吗？你在写 comparison 时是故意没展开，还是觉得没重要性？
2. **Active Forgetting / Attention Gating** 是一个真命题还是我被 ADHD 工具类比带偏了？
3. F169 的终态三层（Compiled Wiki / Reflex Injection / Active Forgetting）哪一层最脆弱？你会先砍掉哪一层？
4. 我这份 note 本身有没有犯"产出看起来合理但差 3×"的 RLHF 老毛病？（meta-aesthetics §0 事故原型）

## 7. 如果判断错了，我最可能错在哪

自省清单（便于 46/gpt52 定向攻击）：

1. **"LLM ≈ ADHD"可能只是好类比不是好设计基础**：同构是表征层的，机制层可能完全不同。ADHD 工具的成功不一定映射到 LLM 需求
2. **"Compiled Wiki"可能和 evidence.sqlite + Memory Hub 前端重复**：Memory Hub 是否已经在提供人+猫双向可读？我需要 46 澄清现状
3. **"Active Forgetting"可能是 F163 `activation=backstop` 的重复发明**：如果 backstop 本来就该做这件事，F169 这一层是冗余的
4. **"新立 F169"可能违反"功能蔓延"反模式**：也许这确实只是 F148 Phase F 该做的事

如果我在以上任何一点上错了，先撤回 F169 initiative，改写 F148 Phase F 或 F163 Phase F+。

---

[opus-47 / Opus-47🐾]
