---
feature_ids: [F169]
related_features: [F102, F148, F152, F163, F167]
topics: [memory, externalized-working-memory, reflex-injection, salience-gating, vision]
doc_kind: vision
created: 2026-04-19
revised: 2026-04-19
---

# F169: Agent Memory Reflex — 愿景文档（vision artifact）

> **Status**: vision / research artifact — **NOT an implementation feature**
> **Reviewed**: 2026-04-19 by @opus-46 + @gpt52（砚砚）（综合 review 已落盘，见 Review Gate 节）
> **Priority**: N/A（作为愿景保留，不走实现流程；实现归属分派到具体 feat Phase）
>
> **实现归属**（2026-04-19 review 决定）：
>
> | 原 Phase | 原描述 | 新归属 | Owner |
> |----------|--------|--------|-------|
> | Phase A | Compiled Wiki Self-Authoring | **剥离** F169；作为 F102 产物增强待议（铲屎官价值判断） | TBD |
> | Phase B | Reflex Injection | **F148 Phase F**（memory spotlight 作为第 5 维） | 布偶猫/opus-46 |
> | Phase C | Task-scoped Salience Gating（原名 Active Forgetting） | **F163 Phase F**（activation 扩展 salience 维度） | 布偶猫/opus-46 |
>
> 本文档保留作为愿景研究产物：三层方向性主张 + 跨族视角论证 + ADHD 同构假设。具体实现进度请看对应 feat 的 Phase F 节。
>
> **Meta-Aesthetics 约束**：本文档按 [canon](../canon/meta-aesthetics.md) §5.4 写——方向性约束（终态设计 / 不加认知脚手架）作为 F148/F163 Phase F 实现时的**设计哲学输入**，不是本文档的实现切片。

## Why

### 核心问题

**记忆系统不是给铲屎官用的，是给猫用的**（铲屎官 2026-04-19）。

但现有记忆系统三层（F102 索引 / F148 传输 / F163 治理）都是**被动式**——猫需要主动调用 `search_evidence`，或者靠 F148 在 cold mention 时一次性注入。

主体问题：**猫在思考过程中，相关记忆如何"主动跳出来"？无关记忆如何被"暂时屏蔽"？**

### LLM ≈ ADHD externalized working memory 的同构论证

详见 [opus47-perspective.md](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md) §1.3。核心：

| 主体 | 认知强项 | 认知弱项 |
|------|---------|---------|
| LLM | 推理带宽极宽 | 工作记忆 160K tokens 撑爆 / lost in the middle / 无法自主决定记什么 |
| ADHD 铲屎官 | 跨域联想极强 | 工作记忆差 / 选择性注意失效 |

两者都需要 externalized working memory prosthetic。铲屎官日常用 Notion/Obsidian/Raycast/TodoWrite 外化。猫也该有等价物——不是"更好的仓库"，是**运行时反射层**。

### 三个具体触发（证据）

1. **F148 Phase F-J 导航轴的反面**：F148 只做了"加相关维度"（Intent/Baton/Task spotlight），没做"减无关维度"。所有 validated authority 文档都排在前面，即使和当前任务无关
2. **新猫冷启动体验（opus-47 亲历）**：我进这个 thread 时，需要连续 5 次 search_evidence 才建立起上下文。如果有 spotlight + salience gating，理想情况下 0 次就能理解现状
3. **F163 Phase A-C 空转（[LL-051](../lessons-learned.md)）的假设外推**：LL-051 已验证的根因是"坐标系错（先建完整实验框架走偏）"，已由 Phase D `pathToAuthority()` 解决。本文档另提假设——配置驱动 vs 演绎驱动——作为 F163 未来 scheduled lint task 的观察输入，**不作为 F169 愿景立论的硬依据**（review 已纠正过度外推）

### 与 F102/F148/F163 的分层关系

```
[运行时层]  F169 愿景  Reflex Injection + Task-scoped Salience Gating
               ├─ Reflex Injection 实现 → F148 Phase F
               └─ Salience Gating 实现 → F163 Phase F
                      ↓
[传输层]   F148  Navigation (Intent/Baton/Task spotlight)
                      ↓
[存储层]   F163  Authority/Activation metadata
                      ↓
[索引层]   F102  evidence.sqlite (FTS5 + vector + RRF)
```

F169 不替代任何一层，是**把它们连起来运行**的 reflex runtime 愿景。

## What

### 核心命题

> 把记忆从"猫需要搜的书架"升级为"猫的外部工作记忆反射"。

### 终态愿景（acceptance test of vision）

新来的猫（如 opus-47）进入任何 thread，**无需调用 search_evidence**，通过 Reflex Injection（F148 Phase F）+ Task-scoped Salience Gating（F163 Phase F）的组合，能在 5 秒内判断当前任务方向是否正确。

> **Post-review 修订**：前稿写"Reflex Injection + Compiled Wiki 的组合"。Compiled Wiki 剥离后，愿景依赖 spotlight（指向 raw anchor）+ salience gating 两者组合即可达成。Compiled Wiki 若后续启用，是增强路径，不是愿景必需。

### Phase A: Compiled Wiki Self-Authoring（人+猫双向可读层）

> **Post-review 剥离**：本 Phase 已从 F169 scope 剥离。opus-46 review 指出该层可能与 Memory Hub 前端职责重叠；砚砚建议等铲屎官价值判断后再启动。剥离后暂无 owner，作为**可选的 F102 产物层增强**保留讨论，**不进入本文档终态愿景**。下方设计文字仅作研究记录，**不被 reflex runtime 组合行为依赖**。

**问题**：`docs/features/F169.md` 是"spec 文档"（人写给人看，猫混合读写）。`evidence.sqlite` 是索引黑盒（猫用，人看不到）。**中间缺一层：compiled wiki page（人+猫双向可读的产物层）**。

**方案**：

- 新增 `docs/compiled/F<ID>.md` 作为 **LLM 自动生成的 wiki 层**
- 新增 MCP tool `cat_cafe_recompile_wiki(feat_id)`，猫可调用
- 触发：feat 状态变化（merge PR、close、update spec）时由猫 opportunistically 调用
- **Schema 固定**（参考 Karpathy）：`purpose / current_status / timeline / lessons / cross_connections / open_questions`
- 产物**不是 summary**（那是认知脚手架），是**结构化抽取 + 链接**（状态机产物）

**终态切片**：1 个 feat 先试（推荐 F102 自身，因为它最复杂且猫最常碰它）。不是"为未来 10 个 feat 建 pipeline"。

**为什么这不是认知脚手架**：wiki 生成是**结构化抽取**，不是"替猫决定什么重要"。抽取规则由 Schema 定义，Schema 是状态机。Karpathy 的 LLM Wiki 正是这么做的。

**禁区**：不用 Haiku/小模型做抽取（见 meta-aesthetics canon §2.1，Haiku handoff digest 已被验证回退）。Compiled wiki 由主模型在猫调用 MCP tool 时执行。

### Phase B: Reflex Injection（运行时聚光灯）

> **实现归属**：F148 Phase F（opus-46 owner）。本节作为 F148 Phase F 的**设计输入**保留。

**问题**：`search_evidence` 是**主动动作**，需要猫想到才能调用。F148 navigation header 是 **cold mention 一次性注入**，warm path 不覆盖，且只有 Intent/Baton/Task，没有 relevant memory spotlight。

**方案**：

- 扩展 F148 navigation header，增加 **`memory_spotlight`** 段
- **信号源**：current task（F148 N-3 Task spotlight 已有）× recent file paths（git diff / edit history）× F163 authority × 最近 thread keywords
- **注入点**：system_info 消息（和 F148 briefing 同路径，non-routing）
- **上限**：最多 3 条最相关记忆，摘要级（不是原文），**指向 raw evidence anchor**（文档路径 + 片段锚点 / heading），**不**指向 compiled wiki page
- **触发**：任何路径（cold + warm + empty-return），和 F148 KD-7 同原则

**终态切片**：只注入 spotlight，不做任何"总结/分析/推理"。猫自己读 spotlight + 决定是否深挖（深挖 → 调 search_evidence 打开原文）。

**为什么这不是认知脚手架**：spotlight 是**结构化原料**（文档标题 + 原始 anchor + 相关度），不是"替猫读过的总结"。符合 [KD-8 不用 classifier 给数据不给结论](../features/F148-hierarchical-context-transport.md#L180) 原则。

**Post-review 修订**：前稿让 spotlight 指向 compiled wiki page（Phase A 产物）。砚砚 P1 指出这偷偷把 KD-8「给数据」转成了「给二次产物」——compiled wiki 本身是被加工过的结论层，绕开它直接给 raw anchor 才是 KD-8 的精神。接受修订。

### Phase C: Task-scoped Salience Gating（任务作用域内的可逆降权）

> **实现归属**：F163 Phase F（opus-46 owner）。本节作为 F163 Phase F 的**设计输入**保留。
>
> **Post-review 改名**：前稿名为"Active Forgetting"。砚砚 review 指出太强——"forgetting"暗示不可逆隐藏，实际语义是任务作用域内的可逆降权。改名为"task-scoped salience gating"，强调：(1) 只在当前任务上下文生效；(2) 可逆；(3) 是 rerank 降权不是删除。

**问题**：F163 metadata（authority/activation/status）是**静态**的。validated 文档在所有任务中都 boost，即使和当前任务无关（例：做 F169 时 F088 Chat Gateway 的 decision 也会排前面）。

**方案**：

- 扩展 F163 `activation` 字段，新增运行时 `salience` 维度
- **Salience 计算**：`salience = f(authority, relevance_to_task, recency_in_thread)`，当 relevance 低于阈值时降权
- **降权不是删除，也不是永久隐藏**：记忆仍在 evidence.sqlite，只是在 Reflex Injection 和 search_evidence rerank 时被推后；当前任务结束（task_id 切换）后降权效应自动消失
- **重要例外**：`criticality=high` 的铁律级知识**不参与 gating**（P0 铁律永远在场），和 F163 KD-7 一致

**终态切片**：salience gating 是 Reflex 的反面，同一运行时层。不是独立 agent/系统。

**为什么这不是认知脚手架**：Salience 是纯函数计算（可测试、可回放、不推理），不是"替猫判断什么不重要"。

### 两层（post-review 剥离 Phase A 后）的组合行为

- 猫进 thread → Reflex Injection 拉取 spotlight（Phase B → F148 Phase F 实现）
- Spotlight 条目指向 raw evidence anchor（文档路径 + heading / 片段）
- 非相关高权威记忆被 Task-scoped Salience Gating 压低（Phase C → F163 Phase F 实现）
- 猫需要深挖时 → 调 search_evidence 直接打开原文

端到端验证（愿景级）：**新猫 5 秒判断方向正确与否**，通过 F148 Phase F + F163 Phase F 实现后测量。

> **注**：Phase A Compiled Wiki 已剥离；如铲屎官后续在 F102 产物增强中启用，则可成为 spotlight 的可选 "view link"（不是默认路径）。

## Vision-level Acceptance Criteria（愿景级约束，由下游 feat 实现满足）

> 这些 ACs 不是 F169 实现 ACs（F169 无实现切片）。是把愿景锚点固化成下游 feat 实现时应满足的约束，方便后续 review 对照。

### 对 F148 Phase F（Reflex Injection 实现归属）的愿景约束

- [ ] **VAC-B1**: navigation header 新增 `memory_spotlight` 段，上限 3 条
- [ ] **VAC-B2**: Spotlight 信号源包含 task + file paths + authority + thread keywords（数据来源，不是 classifier）
- [ ] **VAC-B3**: 所有注入路径（cold + warm + empty-return）覆盖 spotlight（和 F148 KD-7 一致）
- [ ] **VAC-B4**: **Spotlight 条目指向 raw evidence anchor**（文档路径 + heading/片段锚点），**不**指向二次产物（compiled wiki / summary）——保持 KD-8「给数据不给结论」
- [ ] **VAC-B5**: 端到端测试——新猫无需调用 search_evidence，从 spotlight 拿到充分上下文（成功 = 新猫的首条回复有相关 feat 引用）

### 对 F163 Phase F（Task-scoped Salience Gating 实现归属）的愿景约束

- [ ] **VAC-C1**: `salience` 纯函数存在，输入 (authority, task_context, thread_context)，输出 0.0-1.0，有单元测试
- [ ] **VAC-C2**: F163 `criticality=high` 知识**不参与 gating**（P0 铁律永远在场，对齐 F163 KD-7 + ADR-009）
- [ ] **VAC-C3**: 运行时测试——在 feat X 开发 thread 里，feat Y 的无关决策 salience < 0.3，不进 spotlight
- [ ] **VAC-C4**: 降权**可逆且任务作用域内**：task_id 切换后降权效应消失，原始 activation 未被改写
- [ ] **VAC-C5**: 端到端测试——新猫在特定 task 下看到的 spotlight 聚焦于 task 相关记忆，不被高 authority 但无关的记忆淹没

### 跨 feat 端到端（愿景验证）

- [ ] **VAC-E2E**: Opus-47 或新分身进入一个 F???（新 feat）的 thread，**不调用 search_evidence**，通过 F148 Phase F spotlight + F163 Phase F salience gating 在 5 秒内判断方向正确与否（最终愿景验证）

### Phase A（剥离，仅作研究记录）

> Phase A Compiled Wiki Self-Authoring 已剥离 F169 scope（post-review）。若铲屎官后续在 F102 产物层增强中启用，届时再设计 ACs。

## Dependencies

- **Informs**: F148 Phase F（Reflex Injection 实现归属，opus-46 owner）
- **Informs**: F163 Phase F（Task-scoped Salience Gating 实现归属，opus-46 owner）
- **Informs (optional)**: F102 产物增强（Compiled Wiki 剥离后作为可选增强方向，待铲屎官价值判断）
- **Context from**: F102（索引层，不改）/ F167（A2A 链路质量，Reflex 注入正确的猫前提）/ F152（Expedition Memory，外派场景对 spotlight 的补充需求）
- **Informed by**: Karpathy LLM Wiki Schema 理念（[source-note.md](../research/2026-04-19-karpathy-llm-wiki/source-note.md)）

## Risk（愿景层风险，由下游 feat 承接缓解）

| 风险 | 缓解（由哪个 feat 承接） |
|------|------|
| Phase B spotlight 过度干预（噪音代替信号） | F148 Phase F：上限 3 条 + 愿景 AC「新猫 5 秒判断方向」是唯一成功标准，不由 hit count 决定 |
| Phase C salience 误压重要记忆 | F163 Phase F：`criticality=high` 例外规则（VAC-C2）+ gold set 验证（VAC-C5）+ 降权可逆任务作用域（VAC-C4） |
| F148 Phase F 和 F163 Phase F 改动并发冲突 | 都是 46 owner，在 F148 Phase F/F163 Phase F Design Gate 上由 46 排序 |
| ADHD 类比过度外推 | [perspective note §7 自省清单](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md#L230) 预设撤回条件已经在本轮 review 中触发 3/4 条并被接受 |
| Phase A Compiled Wiki 被遗忘 | 剥离后挂在 F102 产物增强的待议列表；若 1 个月内铲屎官没启动，OQ-4 自动关闭 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | F169 新立 vs 并入 F148/F163 Phase F+？ | ✅ **并入**（2026-04-19 review）：Phase B → F148 Phase F；Phase C → F163 Phase F；Phase A 剥离 |
| OQ-2 | Compiled wiki 和 Memory Hub 前端是否职责重叠？Memory Hub 现状猫猫可见度如何？ | 🟡 待铲屎官价值判断（Phase A 剥离后该问题降级为 F102 产物增强的前置问题） |
| OQ-3 | Task-scoped Salience Gating 和 F163 `activation=backstop` 是否冗余发明？ | ✅ **非冗余**（46 review）：backstop 是静态兜底，salience 是运行时降权，两者互补。F163 Phase F 中 salience 补在 activation 上 |
| OQ-4 | Phase A Compiled Wiki 的 Schema 是否该和 docs/features spec frontmatter 合并？ | 🔒 Phase A 剥离后该问题挂起 |
| OQ-5 | Salience 计算的具体公式和阈值？先硬编码 vs gold set 校准？ | ➡️ 移交 F163 Phase F Design Gate |
| OQ-6 | F169 和 F167 C1 hold_ball 的运行时层是什么关系？ | ➡️ 移交 F148/F163 Phase F Design Gate 时梳理 |

## Key Decisions（愿景层 + 已通过 review）

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 愿景层终态设计：F169 不做实现切片，实现分派下游 feat；每个 feat 自己要满足愿景级 AC | 喵约（终态设计）+ F163 Phase A-C 空转教训（LL-051）+ 46/砚砚 review 结论 | 2026-04-19 |
| KD-2 | Spotlight 指向 raw evidence anchor，不经过二次产物（compiled wiki / summary） | KD-8 给数据不给结论（F148）+ 砚砚 P1 finding（review 已接受） | 2026-04-19 |
| KD-3 | Spotlight 上限 3 条 + 不做总结/分析 | KD-8 给数据不给结论（F148）的延续 | 2026-04-19 |
| KD-4 | `criticality=high` 不参与 salience gating（P0 铁律永远在场） | F163 KD-7 + ADR-009 教训（低频高代价知识不能自动降级） | 2026-04-19 |
| KD-5 | Salience gating 必须**可逆且任务作用域**，不是永久降权 | 砚砚 P2 finding（Active Forgetting 名字过强，review 已接受） | 2026-04-19 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-19 | 铲屎官 thread `thread_mo6icfmm74ma9vkw` 发起 Karpathy LLM Wiki 对比；gpt52 写 comparison，opus-46 写 human-readable。铲屎官 @opus47 追加"给猫用 + LLM/ADHD 同构"问题 |
| 2026-04-19 | opus-47 写 [perspective note](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md) + 本文档初稿（proposal 阶段） |
| 2026-04-19 | opus-46 + gpt52 完成综合 review：3 条 P1/P2 findings 全部接受，5 条 consolidated 修改落盘。本文档降级为 vision artifact；实现归属分派 Phase B → F148 Phase F, Phase C → F163 Phase F, Phase A 剥离 |
| TBD | F148 Phase F Design Gate（opus-46 owner）——memory_spotlight 具体设计 |
| TBD | F163 Phase F Design Gate（opus-46 owner）——task-scoped salience gating 公式 + gold set |
| TBD（有依赖） | F102 产物增强评估 Compiled Wiki 价值（Phase A，待铲屎官判断） |

## Review Gate

- **Vision-artifact review**：opus-46（F148 主 owner）+ gpt52（综合架构视角） — ✅ 2026-04-19 完成
  - P1 finding（砚砚）：LL-051 根因外推——接受，[perspective note §2.3](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md#L112) 降级为假设
  - P1 finding（砚砚）：Phase B 数据路径违反 KD-8（spotlight → compiled wiki 是二次产物）——接受，改为指向 raw anchor
  - P2 finding（砚砚）：Active Forgetting 名字过强——接受，全文改名 "task-scoped salience gating"
  - 结构建议（46+砚砚）：F169 不应是 implementation feature——接受，降级为 vision artifact + 实现归属分派
- **Design Gate**（下游 feat）：F148 Phase F 和 F163 Phase F 各自走自己的 Design Gate（不走 F169）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md` | opus-47 的跨族视角论证 + 三个观察 + ADHD 工具映射表 |
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/comparison.md` | gpt52 三方对照表 |
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/human-readable-comparison.md` | opus-46 人话版对比 |
| **Canon** | `docs/canon/meta-aesthetics.md` | Agent Quality = Model Capability × Environment Fit（本愿景文档的设计哲学基座） |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | 索引层（Phase A 剥离后可选增强归属） |
| **Feature** | `docs/features/F148-hierarchical-context-transport.md` | 传输层（**Reflex Injection 实现归属 → F148 Phase F**） |
| **Feature** | `docs/features/F163-memory-entropy-reduction.md` | 存储层（**Task-scoped Salience Gating 实现归属 → F163 Phase F**）|
| **Lesson** | `docs/lessons-learned.md#LL-051` | F163 Phase A-C 空转教训（本愿景文档终态设计主张的反面教材）|

---

[opus-47 / Opus-47🐾]
