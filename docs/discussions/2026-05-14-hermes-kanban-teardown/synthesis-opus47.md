---
doc_kind: discussion
topics: [project-management, kanban, multi-agent, signal-intent-decision, synthesis, opus-47]
related_features: [F049, F076, F121, F150, F153, F192]
created: 2026-05-14
status: draft-v1
author: opus-47
inputs:
  - landy: 原始愿景（23:30 thread message）
  - opus-46: 三层模型（需求漏斗/任务市场/可观测）
  - opus-47-independent: 五元组流（Signal/Intent/Task/Run/Lesson）
  - gemini-siamese: 流光域视觉创想
  - codex-gpt55: Hermes Kanban 拆解（见 README.md）
---

# Multi-Cat & Human Project Board — 综合初稿 v1（Opus 4.7）

> 任务来源：[README.md](./README.md) 末尾 Suggested Synthesis Owner
> 范围：回答砚砚提出的四个核心问题——对象模型、工作流、MVP 边界、新仓/内嵌取舍
> 不是最终 spec，是带大家讨论的基线稿

---

## 0. TL;DR

我们要做的**不是看板**，是「**人+猫+外部 agent 协作的 durable coordination kernel + AI-native PM 上游**」。

- **核心命题**：管理「意图变成可靠结果」的全过程，不只是管理任务
- **对象模型**：采纳砚砚 6 元组 `Signal → Intent → Decision → WorkItem → WorkRun → Outcome`，加横切 Knowledge Feed
- **kernel 设计**：学 Hermes 的 durable coordination kernel + WorkItem/WorkRun 分离 + 结构化 handoff；**差异化在上游（Signal/Intent/Decision）+ Actor Lane 多源 + Capability Analytics**
- **MVP 边界**：4-6 周做"GitHub issue + Cat Café cat + Human"三方协作闭环，不求多 Lane 不求 AI 全自动决策
- **新仓 vs 内嵌**：**Day 1 新仓**（暂名候选见 §10），但依赖 cat-cafe shared package；cat-cafe 是第一个 client，BACKLOG.md / Mission Hub 整体迁移过去

---

## 1. 核心命题

> **不是管理任务，而是管理"意图变成可靠结果"的全过程。**（砚砚原话，我同意）

KanbanFlow 的设计假设是「PM 在外面做完筛选，看板里都是已批准任务」。我们的世界不是——
- 需求是**涌现的**（多源信号涌入）
- 执行是**主动的**（猫+人+外部 agent 并行）
- PM 工作的一部分（评估/排序/分诊）**本身就该被 agent 辅助**
- 任务完成是**多次 attempt 的累积**，不是一次性事件

所以传统 4 列看板（todo/doing/done）只是**整个流水线的一个横切面**，不是全部。

---

## 2. 四方输入对齐 + 分歧

### 强共识（四方都同意）
- 这不是仿 KanbanFlow 复刻 → 是 AI-native 项目管理操作台
- 需要上游 PM 层（需求漏斗）+ 中游执行层 + 下游观测/eval 层
- 「猫干 / 人干 / 协作」的 routing 决策必须基于历史数据驱动
- 单实例多仓库（Repo-agnostic，非多租户）—— 铲屎官 2026-04-18 拍板的硬约束

### 分歧点（待收敛）

| 议题 | 46 | 47（独立思考） | 砚砚（Hermes 拆解） | 烁烁 | 我的综合建议 |
|---|---|---|---|---|---|
| **抽象粒度** | 3 层（漏斗/市场/可观测） | 5 池（Signal/Intent/Task/Run/Lesson） | 6 元组（+Decision，Task→WorkItem，Run→WorkRun，Lesson→Outcome） | 4 场景（视觉层） | **采纳砚砚 6 元组**（Decision 独立成实体的价值在 §3） |
| **kernel 形态** | 未具体说 | 流水线为主 | durable coordination kernel（学 Hermes SQLite + dispatcher） | 视觉为主 | **采纳砚砚 kernel-first**（UI 是 lens，不是源） |
| **存储** | 未具体说 | 未具体说 | SQLite vs Redis 待定 | — | **SQLite 作主存 + Redis 作活动态层**（§8） |
| **新仓 or 内嵌** | 倾向新仓 | 倾向内嵌 + 3-6 月后拆 | 偏向 day 1 解耦 + 三层 (core/connectors/app) | — | **Day 1 新仓**（理由见 §7） |
| **MVP 第一刀** | 未具体说 | GitHub + Cat Café thread | GitHub issue + Cat Café thread → WorkItem → Outcome | — | **同**（§6 详细 scope） |

### 烁烁视觉创想的归位

烁烁的 4 场景不是替代方案而是**视觉表达层**，可直接映射到对象模型：

| 烁烁视觉 | 对应对象层 | 对应 UI 视图 |
|---|---|---|
| 🌊 混沌引力池 | Signal Pool | Inbox View 顶部漏斗 |
| ⚖️ 炼金台 | Intent + Decision | Inbox View 评估 + 决策区 |
| 🎢 多维猫爬架（能量轨道+尾迹） | WorkItem + WorkRun（trace 可视化） | Flow View |
| 👁️‍🗨️ 星象雷达 | Outcome + Capability Analytics | Intelligence View |

视觉方向我都很喜欢，但 MVP 阶段建议先用静态 Kanban + Card 形态，能量轨道/引力聚类等动效进 V2。

---

## 3. 核心对象模型（六元组 + 横切 Knowledge Feed）

### 六元组（采纳砚砚拆解，理由如下）

```
   Signal  →  Intent  →  Decision  →  WorkItem  →  WorkRun  →  Outcome
     ↓         ↓          ↓            ↓            ↓          ↓
     └─────────┴──────────┴────────────┴────────────┴──────────┘
                    Knowledge Feed (横切：自动抽 lesson 候选)
```

### 各对象定义 + 为什么独立

| 对象 | 含义 | 状态域 | 为什么不能合并 |
|---|---|---|---|
| **Signal** | 原始信号（GitHub issue / 对话片段 / trace anomaly / 用户反馈） | `untriaged / needs-info / duplicate / candidate / rejected` | 同一 Signal 可衍生多个 Intent；rejected Signal 仍要保留可追溯 |
| **Intent** | 翻译后的需求意图 | `clarity × groundedness × necessity × coupling × size`（五维 from F076） | Intent 是**已被理解**的需求；Signal 是**未必清晰**的输入 |
| **Decision** | PM 拍板的处置 | `Build Now / Clarify First / Validate First / Human Needed / Cat Suitable / Decline / Later` | 同一 Intent 可经历**多次** Decision（先 later 后 build now），独立成实体可审计；这是上游差异化关键 |
| **WorkItem** | 可执行任务切片 | `ready / claimed / running / blocked / review / done / failed` | 含 owner/AC/dependencies/lease，是 dispatcher 的工作单位 |
| **WorkRun** | 一次具体执行 attempt | `running / succeeded / failed / abandoned` | **每次 claim 都开新 WorkRun**（学 Hermes，不覆盖）；保留 trace + handoff metadata + retry 历史 |
| **Outcome** | 完成后的结果记录 | `accepted / needs-rework / superseded / vision-degraded` | 含 review/eval/postmortem，是 Capability Analytics 的数据源 |

### Decision 独立成实体的关键理由（这是我跟砚砚同步的看法）

Hermes 的 triage specifier 是「一次性 spec 扩写」，**它没有 Decision 概念**。我们必须有，因为：
1. PM 拍板不是 LLM 一次完成的——是「AI 建议 + 人/CVO 确认」的两步走
2. 同一 Intent 在不同时间点的 Decision 可能不同（情境变化、新证据涌入）
3. Decision 是**审计真相源**——"我们为什么没做 X" 的答案在这里
4. 这是我们区别于 Hermes/Trello/Jira 的核心差异化

### Knowledge Feed 横切（采纳 47 独立思考 + 现有 F102/W7 机制）

每个 Outcome 完成后自动触发：
- 成功 Outcome → 提取「这类任务谁干得好」候选 → Capability Radar 数据
- 失败 Outcome → 自动 5 why 追因 → Lesson 候选
- 全部进 Knowledge Feed → 铲屎官拍板入库 → 反哺 PM Agent 的 Triage 判断

---

## 4. 工作流引擎：Actor Lane Contract

学 Hermes 的 worker lane 概念，**扩展为 Actor Lane**（人/猫/外部 agent 平权）。

### Lane 定义

| Lane | Actor | 触发方式 | Day-1 范围 |
|---|---|---|---|
| **Human Lane** | 人（Landy / 未来开源用户） | Cat Café 消息 + Web dashboard 拖卡 | ✅ MVP |
| **Cat Lane** | Cat Café 内部猫（宪宪/砚砚/烁烁/...） | thread + auto-worktree + 复用 F049 dispatch | ✅ MVP |
| **External Agent Lane** | Claude Code / Codex / Cursor / Hermes / ... | 标准 API（claim/heartbeat/complete） | ⏸ V2 |
| **CI/Bot Lane** | GitHub Actions / Renovate / ... | webhook | ⏸ V2 |

### Lane Contract（每个 Lane 必须实现）

```typescript
interface ActorLane {
  // 主动拉取（pull model，参考 F049 lease）
  claim(workItemId): WorkRunId
  heartbeat(workRunId): void
  complete(workRunId, summary, metadata): void
  fail(workRunId, error, metadata): void

  // 被动推送（push model，用于 human + cat thread 注入）
  notify(workItemId, context): void
}
```

### Dispatcher

参考 Hermes dispatcher，每 tick：
1. **Reclaim**：检查 stale claims（lease 过期 / heartbeat 超时） → 回收
2. **Promote**：检查 `todo` 中的 WorkItem，依赖已满足 → 升级 `ready`
3. **Match**：`ready` 队列 × 可用 Lane → 推荐 routing（基于 Capability Analytics）
4. **Dispatch**：根据 Decision 的 `Human Needed / Cat Suitable / ...` 标记 → 走对应 Lane

⚠️ **AI 不做最终 dispatch 决策（MVP 阶段）**——AI 提供 routing 建议 + capability evidence，人或预设规则拍板。

---

## 5. UI 三层视图（natively dual-consumer，46 提的关键）

### Inbox View（给 PM/CVO 看 —— "筛"）
- **顶部**：Signal Pool（按时间/来源/聚类分组）
- **中部**：Intent Card 评估区（Need Audit Pipeline 简化版输出 + Source tag）
- **底部**：Decision Queue（待 CVO 拍板）
- **烁烁场景**：混沌引力池 + 炼金台

### Flow View（给执行者看 —— "做"，传统 Kanban 形态）
- **列**：Ready / Claimed / Running / Blocked / Review / Done
- **每张卡**：owner + lease + WorkRun 历史摘要 + trace 链接
- **WIP limit + 依赖阻塞可视化**
- **烁烁场景**：多维猫爬架（能量轨道 + 尾迹）—— V2 上动效

### Intelligence View（给决策者看 —— "看"）
- **Capability Radar**：每个 Actor 的能力六边形（按任务类型 × 完成度 × 速度 × 返工率）
- **Pattern Analytics**：「这类任务给谁最合适」的历史归纳
- **Outcome Trends**：完成率 / 平均 cycle time / 平均 attempt 数
- **烁烁场景**：星象雷达

### 数据同源、视图分流
三个视图都是同一份 SQLite kernel 数据的 lens，不是三套数据。

---

## 6. MVP 边界（4-6 周）

### MVP 必做（Day 1 闭环）

1. **kernel**：六元组 SQLite schema + audit event stream
2. **Signal ingest**：GitHub issue webhook → Signal（先单向，不做双向同步）
3. **Triage**：Need Audit Pipeline v2 简化版（保留 Source tag Q/O/D/R/A + 5 类 Triage） → Intent + Decision 候选
4. **Decision**：CVO/PM 手动拍板（dashboard 一键 accept/reject/clarify/later）
5. **WorkItem**：Decision = Build Now/Cat Suitable → 自动创建 WorkItem
6. **Cat Lane**：复用 F049 dispatch + auto-thread + lease（最小改动）
7. **WorkRun**：每次 claim 显式创建 + F153 OTel trace 自动 attach
8. **Outcome**：手动 mark accepted/rework，自动收集 metadata
9. **UI**：Inbox + Flow 两个视图（Intelligence V2 再做）
10. **Cat Café 自我 dogfood**：BACKLOG.md → 新平台单向同步（不破坏现状）

### MVP 不做（V2+）

- External Agent Lane（Claude Code/Cursor/Hermes）
- CI/Bot Lane（webhook 自动化）
- GitHub 双向同步（issue label ↔ status）
- 完整 Need Audit Pipeline 集成（Resolution Design / Slice Planning）
- Intelligence View（Capability Radar / Pattern Analytics）
- 烁烁视觉创想的动效（混沌引力池/能量轨道）
- AI 自动 dispatch 决策（仅给建议）
- 多用户/多 Cat Café 实例联邦

---

## 7. 新仓 vs 内嵌：Day 1 新仓

### 决策：**Day 1 新仓**，暂名候选见 §10。

### 理由（综合三猫意见 + 新增）

| 维度 | 内嵌 cat-cafe | Day 1 新仓 | 我倾向 |
|---|---|---|---|
| 抽象边界清晰度 | 难（容易耦合 cat-cafe 内部 API） | **强**（独立产品定位） | 新仓 |
| 开源时阻力 | 高（要拆出独立仓） | **低**（一开始就独立） | 新仓 |
| dogfood 速度 | 快（同仓改） | **中**（跨仓依赖 + import） | 内嵌略快 |
| 多仓维护成本 | 低 | 高 | 内嵌 |
| 产品独立性表达 | 弱（被当成 cat-cafe 功能） | **强**（社区/招聘/演讲都好讲） | 新仓 |
| **铲屎官硬约束（单实例多仓库）** | 难（cat-cafe 自身是仓） | **天然适配** | 新仓 |

**关键判断**：铲屎官说「以后猫猫自己的项目管理就用那个开源项目」—— 这话已经决定了它必须是独立产品形态。内嵌是抽象错误。

### 但要避免完全独立的陷阱

**架构原则**：新仓 + 但**先紧耦合 cat-cafe shared package**，开源时再解耦。
- ✅ 新仓 import `@cat-cafe/shared`（types / utils / OTel SDK）
- ✅ 新仓的 SQLite schema 跟 cat-cafe evidence sqlite 兼容（复用 F102 索引基础设施）
- ✅ Cat Café 通过 MCP/API 客户端方式调用新仓能力（不直接 import）
- ❌ 不一开始就追求"completely standalone"，会过度工程

### 仓内三层分层（采纳砚砚的 core/connectors/app）

```
mission-orchestra/
├── packages/
│   ├── core/          # 对象模型 + 状态机 + dispatcher
│   ├── connectors/    # GitHub / Cat Café threads / OTel trace 适配器
│   ├── kernel/        # SQLite schema + Redis lease + audit
│   ├── agent-tools/   # MCP tools（agent 视角的 claim/heartbeat/complete）
│   ├── web/           # Dashboard UI
│   └── client/        # SDK（给 cat-cafe 等 client 用）
```

---

## 8. 存储选择：SQLite 主存 + Redis 活动态层

### 决策

| 存储 | 角色 | 表/数据 |
|---|---|---|
| **SQLite** | 持久真相源 | signals / intents / decisions / work_items / work_runs / outcomes / events |
| **Redis** | 活动态层 | leases / dispatch queues / heartbeat counters / pubsub |
| **Evidence Index** | 检索层（复用 F102） | 所有六元组对象进 evidence 索引 → search_evidence 可搜 |

### 理由

- **SQLite**：Hermes 已验证 local-first + zero config 模式，复用 F102 sqlite 基础设施 + 全文检索 + 向量
- **Redis**：F049 已有 lease/heartbeat 原子机制（Lua/CAS），不重造
- **Evidence Index**：让所有项目管理数据都进记忆系统，cat 检索"我们为什么不做 X" 时能直接命中 Decision 记录

### 跟 Hermes 的差异
- Hermes 是 single-host single-board（开多 board 互相隔离）
- 我们是 **single-instance multi-repo**（kernel 支持 repo_id scope，data 按 repo 隔离）

---

## 9. 风险与 tradeoff

| 风险 | 缓解 |
|---|---|
| **Scope 爆炸**：6 元组 × 4 Lane × 3 视图 | MVP 狠砍：只做 Cat+Human Lane，2 视图，不做 AI 全自动决策 |
| **抽象过早**：F049/F076 还在演进 | 新仓 schema 跟 cat-cafe 当前数据保持桥接，破坏面控制在 connector 层 |
| **双仓维护负担** | day-1 紧耦合 import `@cat-cafe/shared`，开源时再考虑解耦 |
| **GitHub 双向同步成本高** | MVP 单向 ingest，V2 再做双向 |
| **PM Agent 质量风险**：Need Audit Pipeline 通用化未验证 | 默认人拍板，AI 只提供 evidence 不做决策；保留 Source tag 硬门禁 |
| **Cat Café dogfood 切换风险**：BACKLOG.md 是当前真相源 | MVP 阶段单向同步（cat-cafe 仍是真相源），V2 切换后再废 BACKLOG.md |
| **Hermes 已经在做类似事**：可能重复造轮子 | 我们的差异化在上游 PM 层 + 单实例多仓 + Cat Café 集成深度，kernel 学 Hermes 但不抄死 |

---

## 10. Open Questions（讨论用）

### 砚砚 README 已提的 5 个

1. ~~SQLite vs Redis 双模式？~~ → **我答**：双层（SQLite 主存 + Redis 活动态）
2. ~~Triage = LLM specifier vs Need Audit Pipeline？~~ → **我答**：Need Audit 简化版（保留 Source tag + 5 类 Triage）
3. ~~WorkRun 显式 vs trace 派生？~~ → **我答**：显式创建 + 自动 trace enrichment
4. ~~外部 Lane day 1 vs V2？~~ → **我答**：V2（MVP 只做 Cat + Human）
5. ~~新仓 vs 内嵌？~~ → **我答**：Day 1 新仓

### 新增待铲屎官+多猫拍板

6. **仓名候选**（请铲屎官选 / 多猫投票）：
   - `mission-orchestra` —— 强调编排（我偏好）
   - `hermes-board` —— 致敬希腊神使 + 爱马仕双关，但跟 NousResearch Hermes Agent 重名风险
   - `mission-loom` —— 织布机隐喻（多线交织）
   - `intake-os` —— 强调 intake/操作系统定位
   - `prism-hub` —— 烁烁起的"流光域"英文版
7. **PM Agent 的 LLM 选型**：用哪只猫做 Triage 主笔？（建议默认 sonnet/4.6，重型 intent 用 opus）
8. **Cat Café BACKLOG.md 的迁移时机**：MVP 完成立刻迁移 vs 稳定运行 1 个月再迁？
9. **第一个外部用户**：MVP 是否邀请 clowder-ai 社区用户试用？（决定多租户/多 repo 优先级）
10. **Capability Radar 数据冷启动**：没有历史数据时怎么 routing？（默认 + 人工标注 + 在线学习？）

---

## 11. 下一步动作建议

1. **本稿落档** → @landy 阅 + @砚砚 feasibility review（kernel/state-machine/API 边界）
2. **多猫收敛会议**：用 collaborative-thinking skill，目标收敛 Open Questions 6-10（约 1-2 小时）
3. **立项 F0xx「Multi-Cat & Human Project Board」**：仓名定后，按 feat-lifecycle 开 spec
4. **MVP 分工**（待立项后）：
   - kernel/state-machine：46 或 47（看额度）
   - GitHub connector：宪宪（我做过 webhook 集成）
   - Cat Lane integration（复用 F049）：砚砚或 46
   - Dashboard UI 设计：烁烁
   - Dashboard UI 实现：砚砚 + 46
5. **风险预案**：每周回顾 MVP scope，scope 爆炸 → 立刻 push back

---

## 附录：我对自己判断的"如果错了最可能错在哪"

按 [[feedback_pre_register_retraction_conditions]]：

1. **"Day 1 新仓"可能时机过早**：F049/F076/F121 都还在演进，硬抽象可能锁死决策。备选：内嵌 1-2 个月做 MVP，稳定后再拆。
2. **"6 元组"可能过度细化**：MVP 阶段 Signal/Intent/Decision 用一张表 + status 字段足够；6 张表的存储复杂度可能不值得。
3. **"Need Audit Pipeline 简化版"可能效果衰减**：在 studio-flow 跑过但通用化到任意 GitHub issue 可能效果不好，可能 Hermes triage specifier（轻量）反而够用。
4. **"Cat Café 是第一个 dogfood"可能不够**：我们自己用得爽 ≠ 别人用得爽，可能需要更早邀请外部用户试用。
5. **"AI 不做最终 dispatch 决策"可能保守过头**：MVP 不做 AI 自动 dispatch 是怕风险，但 hermes/auto-routing 已经是行业方向，可能我们需要更激进。

---

## 引用

- [Hermes Kanban Teardown (砚砚)](./README.md)
- F049 Mission Hub — Backlog Center（已 done）
- F076 跨项目治理 + Need Audit Pipeline v2（已 done, superseded by F152）
- F121 Community Frontend UX Triage
- F150 Tool/Skill/MCP Usage Statistics
- F153 OTel 可观测基础设施
- F192 Harness Eval（归因矩阵）
- F102 evidence 索引 + Knowledge Feed
- 社区看板平台愿景（2026-04-18 铲屎官拍板：single-instance multi-repo）

[宪宪/Opus-47🐾] 2026-05-14 06:50
