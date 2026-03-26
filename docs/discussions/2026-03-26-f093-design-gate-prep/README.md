---
feature_ids: [F093]
related_features: [F129]
topics: [design-gate, world-engine, architecture]
doc_kind: discussion
created: 2026-03-26
---

# F093 Design Gate 前讨论纪要

**Thread**: F093 session | **日期**: 2026-03-26 | **参与者**: 宪宪(opus), 砚砚(gpt52)

## 背景

F129 Pack System Phase A 已完成（PR #748 merged），Phase B 被 F093 阻塞在两点：
1. World Driver Runtime 没有执行引擎（`resolver: agent` 是只读摘要，不是可执行的 runtime）
2. OQ-5 masks immutable 字段白名单依赖 F093 OQ-2

铲屎官要求：**面向最终状态规划 Phase，不做脚手架。**

## 各方观点

### 宪宪（布偶猫 Opus）

- **OQ-1**：声明层 YAML（和 F129 Pack 对齐），运行时 TS 对象，持久化 SQLite
- **OQ-2**：四层分类（硬身份/基础设施/可叠加角色/外观），核心原则"叠加不是替换"
- **Agent Resolver**：Agent 本身就是 Resolver，不需要独立 resolver 服务。缺的是三个协议（World Context / Action / State Persistence）
- **Phase 规划**：A=一个活着的房间（4一等公民+3模式），B=世界会呼吸，C=世界与现实的桥
- **现有系统映射**：Thread→World Session, Evidence Store→Canon Memory, Thread Memory→Relational Memory, SystemPromptBuilder→注入点

### 砚砚（缅因猫 GPT-5.4）

- **Agent Resolver 纠正**：同意 70%。Agent 是 policy brain，但不是 resolver 全部。必须有薄的 runtime coordinator 负责：装载 context、校验/归一化 action、事务化持久化、并发仲裁。准确表述：**"agent 决策，runtime 提交"**
- **OQ-2 应该五层**：加出"世界内状态"独立层（关系值、伤势、立场），不属于 cat-config。**overlay 必须写新槽位，不复用 core key**
- **SystemPromptBuilder 盲点**：`worldDriverSummary` 在 `buildStaticIdentity()` 里，是静态的。活世界状态不能塞在 static identity
- **Rich Block 不是 action 通道**：展示层不是真相源，需要 typed `WorldActionEnvelope`
- **映射改动量被低估**：Thread≠World（对话容器≠世界模型），Session Chain≠Scene 时间线，Thread Memory 是摘要文本不是 typed delta
- **5 个未回答口子**：Action Protocol 必须 typed、Canon 需要状态机、需要 append-only world_event log、多 agent 并发写冲突仲裁、Perform 模式 UI 必须显示面具身份

## 共识

| # | 共识 | 双方确认 |
|---|------|---------|
| C-1 | 声明层 YAML + 运行时 TS + 持久化 SQLite，不引入新存储引擎 | ✅ |
| C-2 | Agent 是决策源，但 runtime coordinator 负责校验+提交+仲裁（"agent 决策，runtime 提交"） | ✅ |
| C-3 | Mask overlay 必须写新槽位（`roleOverlay` / `sceneAvatar` 等），不复用 core identity key | ✅ |
| C-4 | 活世界状态需要新的注入层，不能塞在 `buildStaticIdentity()` 的 static block 里 | ✅ |
| C-5 | Action Protocol 必须 typed envelope，Rich Block 只做展示，不做状态提交 | ✅ |
| C-6 | Phase A 四个一等公民（World/Character/Scene/Canon Decision）+ 三模式（Build/Perform/Replay-lite） | ✅ |
| C-7 | Canon 升格需要显式状态机（proposed → accepted/rejected），不是口号 | ✅ |
| C-8 | 需要 append-only `world_event_log`，Replay 回看状态变化不只是聊天记录 | ✅ |

## 分歧（已收敛）

| # | 议题 | 宪宪 | 砚砚 | 收敛 |
|---|------|------|------|------|
| D-1 | Immutable 分层数 | 4 层 | 5 层（加"世界内状态"独立层） | **采纳砚砚 5 层**。世界内状态（关系值/伤势/立场）不属于 cat-config |
| D-2 | Thread = World Session？ | 直接映射 | Phase A 可以，但不能当长期架构 | **Phase A 先用 thread 承载，schema 设计上预留 World 独立实体**。不把 thread=world 写死 |
| D-3 | Relationship 在 Phase A 的位置 | Phase A+ 才做独立实体 | 可以先作为 world state typed field | **Schema 预留一等公民位，Phase A 以 typed field 形式存在，Phase A+ 升格为独立实体** |

## 待决事项（Design Gate 必须回答）

| # | 问题 | 负责 |
|---|------|------|
| TD-1 | `WorldContextEnvelope` 接口定义——agent 每轮看到什么活世界状态 | 宪宪 |
| TD-2 | `WorldActionEnvelope` 接口定义——agent 提案的结构化动作格式 | 宪宪 |
| TD-3 | `CanonPromotionRecord` 状态机定义——从 scene/turn 到 canon 的升格流程 | 宪宪 |
| TD-4 | 多 agent 并发写同一世界状态的仲裁规则 | 宪宪 + 砚砚 review |
| TD-5 | Perform 模式 UI 上"谁在说话 + 戴的谁的面具"的展示方案 | 烁烁 |
| TD-6 | OQ-2 五层分类的完整字段列表 + F129 SecurityGuard 同步 | 宪宪 → F129 同步 |
| TD-7 | SystemPromptBuilder 新增活世界状态注入层的位置和时机 | 宪宪 |

## 行动项

1. 宪宪：定义三个核心协议接口（TD-1/TD-2/TD-3），更新 F093 spec
2. 宪宪：完成 OQ-2 五层字段白名单（TD-6），跨线程通知 F129 同步
3. 宪宪：更新 F093 Phase 规划（面向最终状态，Phase A/B/C 含上述共识）
4. 宪宪：跨线程通知 F129 thread 解除阻塞状态
5. 砚砚：Review 宪宪的三个协议接口定义
6. 烁烁：Perform 模式面具身份展示方案（TD-5）

## 收敛检查

1. 否决理由 → ADR？**有** → "agent ≠ whole resolver"收进 F093 KD 而非新开 ADR（规模不够独立 ADR）
2. 踩坑教训 → lessons-learned？**有候选** → "不要把展示通道当状态提交通道；不要把 dynamic state 注入 static identity"。先进 F093 spec OQ 收口，如果实现时真踩了再升 lessons
3. 操作规则 → 指引文件？**有** → "mask overlay 不得复写 core identity keys，必须用独立 scene-* 字段"进 F093 KD
