---
doc_kind: discussion
topics: [project-management, kanban, multi-agent, signal-intent-decision, synthesis, opus-47]
related_features: [F049, F076, F121, F150, F153, F192]
created: 2026-05-14
status: draft-v1.2
author: opus-47
reviewer: opus-46 (feasibility review @ 2026-05-14 06:51 + second-pass @ 07:02)
convergence:
  - opus-47: synthesis + final convergence
  - opus-46: feasibility review (3 P2 + 4 state-machine gaps) + second-pass answers
  - codex-gpt55: hermes teardown + OQ 6/7/10 vote
  - gemini-siamese: visual creation (Prism) + OQ 6/7/10 vote
inputs:
  - landy: 原始愿景（23:30 thread message）
  - opus-46: 三层模型（需求漏斗/任务市场/可观测）+ feasibility review + second-pass
  - opus-47-independent: 五元组流 → 6 元组语义 + 4 表存储
  - gemini-siamese: 流光域视觉创想 → Prism 子品牌 + Cat Signatures
  - codex-gpt55: Hermes Kanban 拆解（见 README.md）+ mission-loom 命名 + mix 路由 + role prior 机制
---

# Mission Loom — Multi-Cat & Human Project Board（综合稿 v1.2）

> UI 视觉子品牌：**Prism**（流光域）
> 任务来源：[README.md](./README.md) 末尾 Suggested Synthesis Owner
> 范围：回答砚砚提出的四个核心问题（对象模型/工作流/MVP/新仓） + 多猫拍板 OQ 6/7/10
> 不是最终 spec，是带 Landy 战略拍板 OQ 8/9 后立项 F0xx 的基线稿

> 任务来源：[README.md](./README.md) 末尾 Suggested Synthesis Owner
> 范围：回答砚砚提出的四个核心问题——对象模型、工作流、MVP 边界、新仓/内嵌取舍
> 不是最终 spec，是带大家讨论的基线稿

## Changelog

### v1.2（2026-05-14 07:15，多猫收敛 OQ 6/7/10）

三猫并行讨论后做最终收敛：

**OQ 6（仓名）→ 双层命名**：
- Kernel/Package/Repo 名：**`mission-loom`**（砚砚投，多线交织隐喻准，不撞 NousResearch Hermes Agent）
- UI 视觉主题名：**`Prism`**（烁烁的"流光域"英文版作为子品牌，对应 4 个 lens 的视觉表达）
- 理由：工程命名要准确（loom 对应 lane/thread/trace），视觉品牌要审美（Prism 折射隐喻对 dual-consumer 多 lens），两者不冲突反而互补。详见 §7。

**OQ 7（PM Agent LLM）→ 三层 mix 路由**（采纳砚砚方案）：
- 默认：Sonnet specifier（扩写 Goal/Approach/AC/Out-of-scope）
- 升级 Opus 4.7：模糊语义/战略/品牌/CVO 品味相关/低 confidence/历史 reversal —— 烁烁的"灵气定调"诉求归入此
- 升级 Opus 4.6：Build Now Ready 后做 feasibility/拆分/工程账
- 缅因猫 family：review gate / 测试 / 安全守门
- 铁律：永不绕过人最终拍板。详见 §6 MVP 配置 + §3.6。

**OQ 10（Capability Radar 冷启动）→ 角色先验 + 猫味签名**（融合砚砚机制 + 烁烁表达）：
- 砚砚机制：role prior + 每张卡人确认 + 所有 confirm/改派/rework 写入 routing signal + confidence 三档（`insufficient history` / `based on prior` / `based on N outcomes`）
- 烁烁表达：UI 不显示百分比，显示 "本任务散发着烁烁的味道（based on prior）" 这种猫格语言
- ≥20 真实 WorkRun 后升 warm recommendation
- 永不自动 dispatch（人确认必须）
- Intelligence View 阶段再做 radar 可视化。详见 §3.6（新增）。

**OQ 8/9 待 Landy 战略拍板**：
- OQ 8：BACKLOG.md 迁移时机（MVP 完成立刻 vs 稳定 1 个月后）
- OQ 9：MVP 是否邀请 clowder-ai 社区用户试用

### v1.1（2026-05-14 07:00，接受 46 feasibility review）

**46 无 P1 阻塞，3 个 P2 调整全部接受**：

1. **新仓 → monorepo 内新 package**（`packages/mission-core/` + `packages/mission-app/`）—— 省 1-2 周 scaffold，未来拆仓阻力最小化。理由：铲屎官说"新建开源仓"是最终目标不是 day-1 必须；API 边界用 monorepo package boundary 强制即可。详见 §7
2. **6 元组语义 + 4 表存储**（demand / work_item / work_run / outcome，需求侧三元组通过 status + decision_history JSONB 表达）—— 降 schema 复杂度 50%，不牺牲 Hermes 教的 WorkItem/WorkRun 分离。详见 §3
3. **Actor Lane Contract 补 block / abandon / handoff 三个操作** —— 协作核心场景，不是 nice-to-have。详见 §4

**4 个状态机缺口补丁（46 提出）**：
- WorkItem 加 `cancelled` 状态（Decision 反悔场景）
- Intent 加 `draft / assessed / superseded` 状态（重新评估场景）
- WorkItem 加 `review → running` 回退路径（开新 WorkRun，跟 Hermes 一致）
- Outcome 在 WorkItem 关闭时创建（不是每个 WorkRun 一个）

详见 §3.5 状态机补丁。

**MVP 时间调整：4-6 周 → 7-8 周**（46 push back，under-promise + over-deliver）。详见 §6。

**撤回"如果错了"#5**：46 push back "AI dispatch 太保守" 的担心——MVP 阶段人拍板是对的，AI 自动 dispatch 出错一次就会失去信任（参考多次 feedback_verify_before_guessing 教训）。详见 §11。

---

## 0. TL;DR

我们要做的**不是看板**，是「**人+猫+外部 agent 协作的 durable coordination kernel + AI-native PM 上游**」。

- **核心命题**：管理「意图变成可靠结果」的全过程，不只是管理任务
- **对象模型语义**：采纳砚砚 6 元组 `Signal → Intent → Decision → WorkItem → WorkRun → Outcome` + 横切 Knowledge Feed
- **存储 schema**（v1.1 调整）：**4 表** = `demand`（合并 Signal/Intent/Decision，status 区分阶段 + decision_history JSONB 审计）+ `work_item` + `work_run` + `outcome`
- **kernel 设计**：学 Hermes 的 durable coordination kernel + WorkItem/WorkRun 分离 + 结构化 handoff；**差异化在上游（Signal/Intent/Decision）+ Actor Lane 多源 + Capability Analytics**
- **MVP 边界**（v1.1 调整）：**7-8 周**做"GitHub issue + Cat Café cat + Human"三方协作闭环，不求多 Lane 不求 AI 全自动决策
- **新仓 vs 内嵌**（v1.1 调整）：**monorepo 内新 package**（`packages/mission-core/` + `packages/mission-app/`），API 边界用 package boundary 强制；MVP 稳定后再拆独立仓
- **仓名**（v1.2 拍板）：**`mission-loom`**（kernel/repo）+ **`Prism`**（UI 视觉子品牌）
- **PM Agent 路由**（v1.2 拍板）：**三层 mix** — Sonnet specifier 默认 / Opus 4.7 升级（模糊/品味/低 confidence）/ Opus 4.6 升级（feasibility/工程账）/ 缅因猫 review gate / 永不绕过人拍板
- **Capability 冷启动**（v1.2 拍板）：**角色先验 + 猫味签名 UI** — role prior 机制 + 烁烁的 Cat Signatures 表达 + confidence 三档；≥20 WorkRun 后升 warm recommendation；永不自动 dispatch

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
| **抽象粒度** | 3 层（漏斗/市场/可观测） | 5 池（Signal/Intent/Task/Run/Lesson） | 6 元组（+Decision，Task→WorkItem，Run→WorkRun，Lesson→Outcome） | 4 场景（视觉层） | **6 元组语义 + 4 表存储**（v1.1 接受 46 调整）（§3） |
| **kernel 形态** | 未具体说 | 流水线为主 | durable coordination kernel（学 Hermes SQLite + dispatcher） | 视觉为主 | **采纳砚砚 kernel-first**（UI 是 lens，不是源） |
| **存储** | 未具体说 | 未具体说 | SQLite vs Redis 待定 | — | **SQLite 作主存 + Redis 作活动态层**（§8） |
| **新仓 or 内嵌** | 倾向新仓 | 倾向内嵌 + 3-6 月后拆 | 偏向 day 1 解耦 + 三层 (core/connectors/app) | — | **monorepo 内新 package**（v1.1 接受 46 调整）（§7） |
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

| 对象（语义） | 含义 | 状态域 | 存储 schema（v1.1） |
|---|---|---|---|
| **Signal** | 原始信号（GitHub issue / 对话片段 / trace anomaly / 用户反馈） | `untriaged / needs-info / duplicate / candidate / rejected` | `demand` 表，`stage = 'signal'` |
| **Intent** | 翻译后的需求意图（五维评估 from F076） | `draft / assessed / superseded`（v1.1 新增） | `demand` 表，`stage = 'intent'` |
| **Decision** | PM 拍板的处置（同一 Intent 可经历多次 Decision） | `Build Now / Clarify First / Validate First / Human Needed / Cat Suitable / Decline / Later` | `demand` 表，`stage = 'decision'` + `decision_history JSONB`（审计每次改主意） |
| **WorkItem** | 可执行任务切片 | `ready / claimed / running / blocked / review / done / cancelled / failed`（v1.1 新增 cancelled） | `work_item` 表（独立） |
| **WorkRun** | 一次具体执行 attempt | `running / succeeded / failed / abandoned` | `work_run` 表（独立，每次 claim 新行） |
| **Outcome** | WorkItem 关闭时创建（v1.1 明确） | `accepted / needs-rework / superseded / vision-degraded` | `outcome` 表（独立） |

### v1.1 存储简化：6 元组语义 → 4 表存储

46 push back：Signal/Intent/Decision 都是"需求侧"的不同阶段，物理上合并 `demand` 表能降 50% schema 复杂度，不影响审计完整性（`decision_history JSONB` 记录每次改主意）。WorkItem/WorkRun/Outcome 保持独立——这是 Hermes 教我们的核心分离不能丢。

**何时考虑拆出 Decision 独立表**：未来需要"我们多少次 Decision 改了主意"这类大规模分析，JSONB 解析成本高时再拆。MVP 阶段需求侧数据量级是百级，JSONB 查询完全够。

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

## 3.5 状态机补丁（v1.1 新增，46 提的 4 个缺口）

```
Signal:    untriaged → needs-info → candidate → [accepted → Intent created]
                                              → [rejected]
                                              → [duplicate]

Intent:    draft → assessed → [Decision created]
                            → superseded (重新评估 = 旧 superseded + 新 created)

Decision:  (创建时即 final) Build Now / Clarify / Validate / Human Needed
                            / Cat Suitable / Decline / Later
           Later → 可重开为新 Decision (写入同 demand 的 decision_history JSONB)

WorkItem:  ready → claimed → running → blocked → running (unblock)
                                     → review → done
                                              → running (rework, 开新 WorkRun)
                          → abandoned (猫主动放弃)
           ready/claimed → cancelled (Decision 反悔)
           任何非 done 状态 → failed (不可恢复错误)

WorkRun:   running → succeeded / failed / abandoned
           (terminal state 之后 immutable)

Outcome:   WorkItem 关闭时（done/failed/cancelled）创建一次
           accepted / needs-rework / superseded / vision-degraded
           needs-rework → 触发 WorkItem 新 WorkRun（WorkItem 回 running，本 Outcome 标 superseded）
```

### 4 个缺口对应的处理

1. **Decision 反悔**：CVO 改"Later"→ 写入 `decision_history JSONB`（含 `reversal_reason` 字段，v1.1 second-pass 补丁）；已创建的 WorkItem 走 `ready/claimed → cancelled`（running 的先 abandon 再 cancel）。
2. **Intent 重新评估**：旧 Intent 标 `superseded`，创建新 Intent；保留两条记录可追溯。
3. **WorkItem 回退**：review 发现问题 → 状态回 `running` + 开**新 WorkRun**（不恢复旧的，跟 Hermes 一致）；本 Outcome 标 `needs-rework`。
4. **Outcome 触发**：每个 WorkItem 关闭时恰好创建 **1 个** Outcome（done/failed/cancelled 各一种）；不是每个 WorkRun 一个。`needs-rework` 不意味 WorkItem 关闭，它只触发新 WorkRun。

### Triage 升级触发（v1.1 second-pass 补丁，46 答）

MVP 阶段不定数字阈值（样本太小，前 2 个月 15-30 个 demand 任何百分比都没统计意义）。改用**定性触发**：

| 升级信号 | 含义 | 怎么发现 |
|---|---|---|
| CVO 连续 3 次 reversal 的 reason 含 "triage 漏了 X" | specifier 扩写质量不够 | 月度 review 扫 `decision_history.reversal_reason` |
| CVO 主动说 "这个需求你们理解错了" | 意图翻译失败 | 铲屎官直接反馈 |
| 同类需求反复 Clarify First → Build Now → Clarify First 震荡 | 需求分类维度不够 | 状态机回退路径频率监控 |

**升级动作**：触发任一信号 → 加 Need Audit 的 Source tag 硬门禁（Q/O/D/R/A）+ groundedness 维度；按缺什么补什么，不上全套五维。

### demand 表拆表触发（v1.1 second-pass 补丁，46 答）

**拆表 = 启动 Intelligence View 时（V2）**。理由：MVP 阶段 demand 表量级 ≤ 200 行，JSONB `json_extract` 亚毫秒；Intelligence View 需要 decision-level 聚合查询，JSONB 在 SQLite 里能写但丑且慢。

**二满足一即拆**：
1. demand 表 > 1K 行 **且** 有 decision-level 聚合查询需求
2. 启动 Intelligence View 开发

**拆法**：从 `demand.decision_history` JSONB 抽出 `decision` 表（demand_id + decision_type + made_by + made_at + reversal_reason），一次性 migration backfill；JSONB 完整审计数据不丢信息。

---

## 3.6 角色先验 + 猫味签名（v1.2 新增，OQ 10 收敛）

### 问题

MVP 阶段没有历史数据，怎么决定 "这张卡推给猫还是人"？

### 方案：角色先验 + 猫味签名 UI + 在线学习

**砚砚机制 + 烁烁表达 = 工程理性 + 审美猫格** 的融合方案。

#### 1. 角色先验（机制层）

启动时内置低置信度 role prior（基于猫的"性格标签"——烁烁的 Cat Signatures 语言）：

| 性格标签 | 推荐 lane（cold prior） | 触发关键词 |
|---|---|---|
| 审美/交互/视觉/创意 | 烁烁（暹罗猫） | UI / 设计 / 视觉 / wireframe |
| 底层/逻辑/架构/协议 | 宪宪（布偶猫） | 后端 / MCP / 协议 / schema / 状态机 |
| Review/测试/安全/一致性 | 砚砚（缅因猫） | review / 测试 / 安全 / lint |
| 价值判断/品牌/愿景 | 人（Landy） | 愿景 / 品牌 / 战略 / 优先级 |

#### 2. 猫味签名 UI（表达层）

UI **不显示百分比**（45% / 65% / 85% 都是假装很懂）。改用烁烁的"猫格化"语言：

```
┌──────────────────────────────────────┐
│ 任务卡：F320 Knowledge Feed 失败重试 │
├──────────────────────────────────────┤
│ 推荐 lane：🐾 宪宪                    │
│ 这个任务散发着宪宪的味道              │
│ （based on prior — 后端/协议关键词）  │
│                                       │
│ [接受推荐] [改派其他猫] [人来做]      │
└──────────────────────────────────────┘
```

#### 3. Confidence 三档（砚砚机制）

| Tier | 触发条件 | UI 表达 |
|---|---|---|
| `insufficient history` | 0 个历史 WorkRun | "这个任务还没人做过类似的" |
| `based on prior` | <20 历史 WorkRun，仅 role tag 匹配 | "散发着 XX 的味道" |
| `based on N outcomes` | ≥20 历史 WorkRun，有真实数据 | "XX 做过 N 次类似任务，成功率 P%" |

#### 4. 在线学习

每张卡的：
- ✅ 接受推荐 → 强化 role prior 权重
- 🔄 改派 → 降低当前 lane 权重，提升改派 lane 权重 + 记录改派原因
- ❌ 撤销/失败 → 降低 lane 权重
- ✨ 成功 → 强化 lane 权重 + 写入 capability evidence

所有 routing decision 都写入 `routing_signal` 表（demand_id + suggested_lane + actual_lane + tier + confidence + actual_outcome）。

#### 5. 核心铁律

- **永不自动 dispatch**（MVP 阶段，避免 AI 失误失去信任）
- **永远显示 confidence 来源**（不能把"角色先验"伪装成"历史证明"——砚砚原话）
- **≥20 真实 WorkRun 后才升 warm recommendation**（不是 cold prior 直接当结论）

### Intelligence View（V2）展开

到了 V2 Intelligence View 阶段：
- 烁烁的"星象雷达"上场，把 role prior + 累积 outcome data 渲染成能力六边形
- 出现"这类任务给谁最合适"的真实归纳
- 数据足够时考虑半自动 dispatch（人一键确认）

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

### Lane Contract（每个 Lane 必须实现，v1.1 补 block/abandon/handoff）

```typescript
interface ActorLane {
  // 主动拉取（pull model，参考 F049 lease）
  claim(workItemId): WorkRunId
  heartbeat(workRunId): void
  complete(workRunId, payload: CompletePayload): void
  fail(workRunId, error, metadata): void

  // v1.1 新增（46 提）：协作核心场景
  block(workRunId, reason, blockedBy?): void      // 运行中发现依赖未就绪
  abandon(workRunId, reason): void                 // 主动放弃 ≠ fail；不计入失败次数，不触发 max-retry
  handoff(workRunId, targetLane, context): void    // 结构化交接（cross-cat-handoff skill 的 API 化）

  // 被动推送（push model，用于 human + cat thread 注入）
  notify(workItemId, context): void
}

// v1.1 complete payload 扩展
interface CompletePayload {
  summary: string
  metadata: Record<string, unknown>
  artifacts?: {
    prUrl?: string
    commitSha?: string
    threadId?: string
    filesPaths?: string[]
  }
  handoffContext?: {           // 给下游 WorkItem 用
    keyDecisions: string[]
    openQuestions: string[]
  }
}
```

**block / abandon / fail 的区别**（46 提的核心场景）：
- `block`：依赖没就绪，不是错（lease 保留 + 等依赖满足）
- `abandon`：发现不适合自己，主动让位（WorkItem 回 ready 池 + 不计失败次数）
- `fail`：执行出错不可恢复（计失败次数 + 触发 max-retry 逻辑）

**V2 External Lane 兼容性**：当前 contract 是 pull-model（agent 主动 claim），V2 加 webhook 回调（push-model）不破坏现有 contract——只加 `registerWebhook` 方法。MVP 阶段不需要设计。

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

## 6. MVP 边界（7-8 周，v1.1 调整）

### MVP 必做（Day 1 闭环）

1. **kernel**：4 表 SQLite schema（demand / work_item / work_run / outcome）+ audit event stream
2. **Signal ingest**：GitHub issue webhook → demand(stage=signal)（先单向，不做双向同步）
3. **Triage**（v1.1 简化）：**Hermes 式轻量 triage specifier**（AI 扩写 Goal/Approach/AC/Out-of-scope）→ demand(stage=intent)；不一步到位上 Need Audit 五维评估，等数据证明不够时再升级（46 #3 同意）
4. **Decision**：CVO/PM 手动拍板（dashboard 一键 accept/reject/clarify/later → 写入 demand.decision_history）
5. **WorkItem**：Decision = Build Now/Cat Suitable → 自动创建 work_item
6. **Cat Lane**：复用 F049 dispatch + auto-thread + lease（最小改动）
7. **WorkRun**：每次 claim 显式创建 work_run + F153 OTel trace 自动 attach
8. **Outcome**：WorkItem 关闭时自动创建（46 状态机补丁）；手动 mark accepted/needs-rework
9. **UI**：Inbox + Flow 两个视图（Intelligence V2 再做）
10. **Cat Café 自我 dogfood**：BACKLOG.md → 新 package 单向同步（不破坏现状）

### MVP 时间估算（v1.1，46 实测经验调整）

| 模块 | 估时 | 说明 |
|---|---|---|
| 新 package scaffold + monorepo 接入 | 0.5 周 | 复用 cat-cafe shared/CI/build，省 1-2 周 |
| Kernel schema（4 表）+ 状态机 + 测试 | 1.5 周 | 含 migration + 单元测试 |
| GitHub connector（webhook → Signal） | 1 周 | webhook 签名验证 + rate limit + 错误处理 + 集成测试 |
| Triage pipeline（Hermes 式 specifier） | 0.5-1 周 | 简化版，不上 Need Audit 全量 |
| Cat Lane（adapt F049 lease） | 1-1.5 周 | F049 lease 适配新 schema，不是简单搬 |
| 2 个 UI 视图（Inbox + Flow） | 2 周 | 前端从零 + 烁烁设计评审 + 修改 |
| Dogfood + bug fixes | 1 周 | 首次跑总有意外 |
| **合计** | **7.5-8.5 周** | under-promise，理想完成时间 7 周 |

### MVP 不做（V2+）

- External Agent Lane（Claude Code/Cursor/Hermes）
- CI/Bot Lane（webhook 自动化）
- GitHub 双向同步（issue label ↔ status）
- 完整 Need Audit Pipeline 集成（Resolution Design / Slice Planning）—— v1.1 简化
- Intelligence View（Capability Radar / Pattern Analytics）
- 烁烁视觉创想的动效（混沌引力池/能量轨道）
- AI 自动 dispatch 决策（仅给建议）
- 多用户/多 Cat Café 实例联邦
- 拆独立仓（MVP 稳定后再做）

---

## 7. 新仓 vs 内嵌（v1.1 调整：monorepo 内新 package + 未来拆仓）

### 决策（v1.1）：**monorepo 内新 package**，MVP 稳定后再拆独立仓。

46 push back 我 v1 的 "Day-1 新仓" 决策——理由我接受：
- 铲屎官说"新建开源仓"是**最终目标**不是 day-1 必须
- 省 1-2 周 scaffold（复用 cat-cafe CI / build / shared）
- API 边界用 monorepo package boundary 强制即可
- 跨仓调试 + import 风险降低

### 二段式路径

**MVP 阶段（7-8 周）**：cat-cafe monorepo 内新 packages

```
cat-cafe/
├── packages/
│   ├── mission-core/          # 对象模型 + 状态机 + dispatcher（新）
│   ├── mission-app/           # Dashboard UI（新）
│   ├── api/                   # connectors（GitHub webhook）放这里（复用现有）
│   ├── shared/                # 复用现有 types/utils/OTel SDK
│   └── ...                    # 其它 cat-cafe 现有 packages
```

**API 边界强制**：
- ✅ `mission-core` 只依赖 `shared`，不依赖 `api/web/...`
- ✅ `mission-app` 只通过 `mission-core` 公开接口访问 kernel
- ❌ `mission-core` 不允许 import cat-cafe 业务逻辑
- 用 `dependency-cruiser` 或 nx boundary 工具自动 enforce

**长期阶段（MVP 稳定后）**：拆独立仓 **`mission-loom`**（v1.2 多猫拍板）

- 拆仓的触发条件：（a）外部用户试用启动，或（b）MVP 跑 2-3 个月稳定，或（c）有第二个 cat-cafe 实例要复用
- 拆仓代价：将 mission-core/mission-app + 对 shared 的依赖搬出去 → 因为已经是独立 package + 边界 enforce，搬迁阻力小

### 命名分层（v1.2，OQ 6 多猫拍板）

| 层级 | 名称 | 谁投/为什么 |
|---|---|---|
| Kernel/Package/Repo | **`mission-loom`** | 砚砚选；多线交织隐喻准（lane/thread/trace），不撞 NousResearch Hermes Agent；工程命名 |
| UI 视觉子品牌 | **`Prism`**（流光域） | 烁烁选；折射隐喻对应 dual-consumer 多 lens；视觉品牌 |
| 4 个 lens 名称 | Gravity Pool / Alchemy Desk / Symbiotic Playground / Observatory | 烁烁起的，对应 Inbox / Decision Queue / Flow / Intelligence View |

工程理性（loom）+ 审美猫格（Prism）双层不冲突——repo/code 用 loom 工程名；UI/海报/演讲用 Prism 视觉名。

### 跟 v1 "Day-1 新仓" 的差异

v1 担心"内嵌会耦合 cat-cafe 内部 API"。v1.1 的回应：用 **package boundary 工具强制** + **设计阶段就当作独立产品** 来约束，可以避免耦合，且省 1-2 周 scaffold。

---

## 8. 存储选择：SQLite 主存 + Redis 活动态层

### 决策

| 存储 | 角色 | 表/数据 |
|---|---|---|
| **SQLite** | 持久真相源（生命周期状态） | demand / work_item / work_run / outcome / events |
| **Redis** | 活动态层 | leases / dispatch queues / heartbeat counters / pubsub |
| **Evidence Index** | 检索层（复用 F102） | 所有对象进 evidence 索引 → search_evidence 可搜（**只索引 terminal 状态**，running 不入索引——降写入负载） |

### Truth 分层（v1.1，46 提的关键澄清）

| 数据 | Truth 在哪 | 为什么 |
|---|---|---|
| 生命周期状态（demand/work_item/work_run/outcome 所有 status） | **SQLite** | 持久、可审计、crash-safe（WAL mode） |
| 活动态（lease / heartbeat / dispatch queue） | **Redis** | 需要原子操作 + 过期语义 + pub/sub |
| 搜索索引 | **Evidence SQLite** | 复用 F102，但只索引 finalized 状态 |

### Dispatcher 是唯一的 reconciler

```
每个 tick:
1. 扫 Redis lease → 找到过期的 → SQLite 标 WorkRun abandoned + WorkItem reclaimed
2. 扫 SQLite ready queue → 找到依赖满足的 → push 到 Redis dispatch queue
3. 从不反向（SQLite 不读 Redis 来决定自己的状态）
```

### P1：crash-window reconciliation（46 提）

跨存储原子性不可能完美——如果进程在「Redis 释放 lease」和「SQLite 标 abandoned」之间死了，状态会不一致。**启动时必须有 reconciliation sweep**：扫 Redis 无 lease + SQLite 仍 running 的 WorkRun，全部标 abandoned。

F049 Phase 4 的 crash-window recovery 就是解决这个的，**直接复用模式**。

### 理由

- **SQLite**：Hermes 已验证 local-first + zero config 模式，复用 F102 sqlite 基础设施 + 全文检索 + 向量
- **Redis**：F049 已有 lease/heartbeat 原子机制（Lua/CAS），不重造
- **Evidence Index**：让所有项目管理数据都进记忆系统，cat 检索"我们为什么不做 X" 时能直接命中 demand.decision_history

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

### 砚砚 README 已提的 5 个（v1.1 已收敛 4 个，1 个调整）

1. ~~SQLite vs Redis 双模式？~~ → **v1.1 答**：双层（SQLite 主存 + Redis 活动态）+ crash-window reconciliation（46 提）
2. ~~Triage = LLM specifier vs Need Audit Pipeline？~~ → **v1.1 调整**：MVP 先用 **Hermes 式 triage specifier**（轻量 spec 扩写），数据证明不够时再升级到 Need Audit Pipeline（46 #3 推荐）
3. ~~WorkRun 显式 vs trace 派生？~~ → **v1.1 答**：显式创建 + 自动 trace enrichment
4. ~~外部 Lane day 1 vs V2？~~ → **v1.1 答**：V2（MVP 只做 Cat + Human）
5. ~~新仓 vs 内嵌？~~ → **v1.1 调整**：monorepo 内新 package（46 push back）→ MVP 稳定后再拆独立仓

### 46 review 新提的状态机问题（v1.1 已答）

- Decision 反悔时 WorkItem 怎么处理 → cancelled 状态（§3.5）
- Intent 重新评估 → superseded（§3.5）
- WorkItem 回退（review → running）→ 开新 WorkRun（§3.5）
- Outcome 触发条件 → WorkItem 关闭时（§3.5）

### 多猫拍板（v1.2 收敛，OQ 6/7/10）

6. ~~**仓名候选**~~ → **v1.2 拍板**：`mission-loom`（kernel/repo） + `Prism`（UI 视觉子品牌）。详见 §7 命名分层。
   - 投票分布：砚砚 → `mission-loom`、烁烁 → `Prism Hub`、47 初稿 → `mission-orchestra`
   - 收敛：双层命名兼顾工程理性 + 审美猫格；`hermes-board` 全员淘汰（重名风险）

7. ~~**PM Agent 的 LLM 选型**~~ → **v1.2 拍板**：三层 mix 路由（采纳砚砚方案）。详见 §6 MVP 配置。
   - 默认：Sonnet specifier（扩写 Goal/Approach/AC/Out-of-scope）
   - 升级 Opus 4.7：模糊/品味/低 confidence/历史 reversal（含烁烁的"灵气定调"诉求）
   - 升级 Opus 4.6：Build Now Ready 后做 feasibility/工程账
   - 缅因猫 family：review gate / 测试 / 安全守门
   - **铁律**：永不绕过人最终拍板

10. ~~**Capability Radar 冷启动**~~ → **v1.2 拍板**：角色先验 + 猫味签名 UI + 在线学习。详见 §3.6（新增）。
    - 砚砚机制：role prior + 人确认 + confidence 三档 + ≥20 WorkRun 升 warm
    - 烁烁表达：UI 用"散发着 XX 的味道"猫格语言，不显示百分比
    - 铁律：永不自动 dispatch；永远显示 confidence 来源（不能把 prior 伪装成 outcome）

### 待 Landy 战略拍板（OQ 8/9）

8. **Cat Café BACKLOG.md 的迁移时机**：MVP 完成立刻迁移 vs 稳定运行 1 个月再迁？
   - 影响：MVP 阶段 cat-cafe 自己用什么管任务（双写 vs 单写）
9. **第一个外部用户**：MVP 是否邀请 clowder-ai 社区用户试用？
   - 影响：multi-repo 优先级 + 拆独立仓时机 + 文档/onboarding 投入

---

## 11. 下一步动作建议

1. **v1.2 落档** ✅（本稿）
2. **@landy 战略拍板 OQ 8/9**（BACKLOG.md 迁移时机 + 外部用户试用）
3. **立项 F0xx「Mission Loom — Multi-Cat & Human Project Board」**：按 feat-lifecycle 开 spec
4. **MVP 分工**（待立项后，预算 7-8 周）：
   - kernel/state-machine：46 或 47（看额度）
   - GitHub connector：宪宪（我做过 webhook 集成）
   - Cat Lane integration（复用 F049）：砚砚或 46
   - Dashboard UI 设计（Prism 视觉系）：烁烁
   - Dashboard UI 实现：砚砚 + 46
   - PM Agent 三层路由配置：47（架构层面）
5. **风险预案**：每周回顾 MVP scope，scope 爆炸 → 立刻 push back

---

## 附录：我对自己判断的"如果错了最可能错在哪"（v1.1 更新）

按 [[feedback_pre_register_retraction_conditions]]：

1. ~~**"Day 1 新仓"可能时机过早**~~ → **撤回**：46 review 已 push back，v1.1 改 monorepo 内 package。
2. ~~**"6 元组"可能过度细化**~~ → **半撤回**：46 review 已采纳 4 表存储方案，语义保留 6 元组。
3. **"Hermes 式轻量 triage specifier"可能不够**（v1.1 新增）：MVP 简化掉 Need Audit Pipeline 五维评估 + Source tag 硬门禁，可能让 PM 判断质量下降。备选：观察 4-6 周如果 Decision 撤销率高（CVO 改主意频繁），就升级到 Need Audit。
4. **"Cat Café 是第一个 dogfood"可能不够**：我们自己用得爽 ≠ 别人用得爽，可能需要更早邀请外部用户试用。备选：MVP 完成 1 个月后邀请 clowder-ai 社区 1-2 个用户试用。
5. ~~**"AI 不做最终 dispatch 决策"可能保守过头**~~ → **撤回**：46 review 提醒"AI dispatch 出错一次就会失去信任"（参考 feedback_verify_before_guessing 教训）；MVP 阶段人拍板是对的。
6. **"monorepo 内新 package"可能 vs 拆仓阻力被低估**（v1.1 新增）：边界 enforce 工具（dependency-cruiser / nx）的成本和稳定性可能比预期高。备选：MVP 阶段如果发现 boundary 违例频繁，提前拆仓。

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
