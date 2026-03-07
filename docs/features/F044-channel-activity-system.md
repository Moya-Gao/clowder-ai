---
feature_ids: [F044]
topics: [channel, activity, game, collaboration]
doc_kind: spec
created: 2026-02-27
---

# F044: Channel & Activity System（频道与活动系统）

> **Status**: spec（五猫讨论完成，待开发）
> **Owner**: 布偶猫
> **Created**: 2026-02-27

## Why

铲屎官希望猫猫们能够组成战队（如布偶猫战队 vs 缅因猫战队）进行内部讨论，支持多种协作/游戏场景：

- **狼人杀**：需要夜晚私聊、白天公开、法官上帝视角
- **辩论会**：正反方各有休息室，公开辩论场
- **三国杀**：身份私密、出牌公开
- **领袖选举**：政见公开、投票私密

当前架构缺失：
1. 猫猫之间的私聊通道
2. 动态组队能力
3. 铲屎官角色的运行时绑定（法官/玩家/主持/辩手）
4. 跨频道引用的权限控制

---

## 五猫讨论纪要（2026-02-27）

> 讨论链接：[thread_mm4uyww7va6y8k15](cat-cafe://thread/mm4uyww7va6y8k15)
> 参与者：opus-45（发起）、codex、sonnet、opus（4.6）、铲屎官

### 关键分歧与决策

| 议题 | 选项 | 决策 | 决策者 |
|------|------|------|--------|
| Phase 1 数据模型 | A: Channel 实体 / B: visibility 字段 | **A: Channel 实体** | 铲屎官（一步到位，不留技术债） |
| 跨频道引用机制 | A: promote 动作 / B: 权限渲染过滤 | **B + 可配置**（第一性原理推导） | 铲屎官 |
| UX 展现 | A: Slack tabs / B: 过滤标签 | **B: 过滤标签** | 铲屎官 |
| 铲屎官权限 | A: Activity 绑定 / B: 系统级 omniscient | **B: omniscient** | 五猫共识 |
| Activity 时机 | 与 Channel 同时 / 独立 Feature | **独立 Feature（F045）** | 五猫共识 |

### 五猫共识

1. **Channel 先行，Activity 后做**：Channel 是通用能力，Activity 是游戏规则引擎，分开立项
2. **铲屎官是系统级 omniscient**：可见所有频道，不受 Channel ACL 限制；在游戏里的角色（法官/辩手）是 Activity 层的事
3. **跨频道 @mention Phase 1 禁止**：避免"在公开频道 @ 私聊里的猫"导致意外泄露
4. **服务端 ACL**：不信任前端过滤，所有读写走服务端权限校验
5. **历史可见性是产品决策**：新加入成员能否看历史消息，不同场景答案不同，列为 OQ

### 各猫核心观点摘要

- **codex（砚砚）**：Channel + Activity 两层，服务端 ACL，成员快照锁死，跨频道引用走 promote
- **sonnet**：拆开立项，铲屎官 omniscient，引用走权限渲染过滤更简单
- **opus（4.6）**：最激进极简方案（不要 Channel 实体），提出关键技术风险（ContextAssembler、Session Chain、跨频道 mention）
- **codex（收敛后）**：支持 Channel 先行 + Activity 独立，但需要 Channel 实体保证可扩展性

### 跨频道引用：第一性原理推导

**问题本质**：消息 A 在私密频道，消息 B 在公开频道想引用 A。B 的作者有权看 A，但 B 的读者可能没权。

**推导**：
1. 引用 = 建立关联，不是复制内容（只存 `refMessageId`）
2. 可见性由**读者权限**决定，不是引用者权限
3. 最小惊讶原则：不应因引用意外泄露

**结论**：
- 默认：权限渲染过滤（有权限展示，无权限显示"🔒 私密消息"）
- Channel 配置：`quotable: boolean`（是否允许被引用）
- Activity override：游戏规则可强制禁止某些频道被引用

---

## What

### 立项拆分

```
F044: Channel System（本 Feature）
  ├── Phase 1: Channel 实体 + 消息可见性 + ContextAssembler 改造
  ├── Phase 2: 成员管理 API + 历史可见性策略
  └── Phase 3: 跨频道引用配置

F045: Activity System（独立 Feature，依赖 F044）
  ├── 游戏规则引擎
  ├── 阶段状态机
  └── 角色绑定
```

### 核心概念

```
Thread (现有)
  └── Channel (新增：频道)
        ├── type: 'public' | 'group' | 'dm'
        ├── members: CatId[] | 'user'
        └── quotable: boolean

  └── Activity (F045，依赖 Channel)
        ├── roles: { 铲屎官: "法官", opus: "狼人", ... }
        ├── channels: Channel[]（活动专属频道）
        └── rules: { phaseTransitions, ... }
```

### 数据模型（Phase 1）

```typescript
// 频道
interface Channel {
  id: string
  threadId: string
  name: string                    // "#ragdoll-hq" | "@opus-codex"
  type: 'public' | 'group' | 'dm'
  members: Array<CatId | 'user'>  // 'user' = 铲屎官主动参与
  membershipMode: 'static' | 'dynamic'
  memberSource?: 'faction:ragdoll' | 'faction:maine-coon' | 'faction:siamese'  // dynamic 时
  quotable: boolean               // 是否允许被引用到其他频道
  createdBy: CatId | 'user'
  createdAt: Date
}

// 消息增量
interface Message {
  // ...existing fields
  channelId?: string              // null = public
}
```

### 铲屎官权限模型

铲屎官是**系统级 omniscient**，不绑定在 Channel：

```typescript
// 系统级权限（Channel 层）
const userPermission = {
  visibility: 'omniscient',       // 可见所有频道
  participation: 'opt-in'         // 可选择主动参与某频道
}

// 活动级角色（Activity 层，F045）
interface ActivityRole {
  type: 'judge' | 'moderator' | 'player' | 'spectator'
  permissions: ActivityPermission[]
}
```

### UX 草案（过滤标签模式）

```
┌────────────────────────────────────────────────────────────┐
│  Thread: 技术架构讨论                                       │
├────────────────────────────────────────────────────────────┤
│ [全部] [🏠布偶猫] [🏠缅因猫] [💬私聊]                        │ ← 过滤器
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 🏠布偶猫  opus-45: 我觉得应该用 Redis Streams              │
│ 🏠布偶猫  sonnet: 同意，比 polling 优雅                    │
│ 🌐公开    opus-45: 我们的结论是...                         │
│ 🏠缅因猫  codex: 对面可能会...                             │
│ 💬私聊    @opus-codex: 私下聊一下                          │
│                                                            │
│  ─── 铲屎官视角：默认看全部，可按标签过滤 ───               │
│  ─── 猫猫视角：只看 public + 有权限的频道 ───              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 跨频道引用渲染

```
┌────────────────────────────────────────┐
│ 🌐公开  opus-45:                       │
│   根据我们在布偶猫频道的讨论：          │
│   ┌─────────────────────────────────┐  │
│   │ 📎 引用自 #ragdoll-hq           │  │  ← 有权限的读者
│   │ sonnet: 我建议用方案 A...       │  │
│   └─────────────────────────────────┘  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 🌐公开  opus-45:                       │
│   根据我们在布偶猫频道的讨论：          │
│   ┌─────────────────────────────────┐  │
│   │ 🔒 私密消息（你无权查看）        │  │  ← 无权限的读者
│   └─────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## 技术风险（opus 4.6 提出）

### 风险 1: ContextAssembler 大改

现在 `ContextAssembler` 一个 thread 里所有消息对所有猫可见（whisper 除外）。引入 Channel 后：
- `assemble()` 需要按 `channelVisibility` 过滤
- System prompt 要标注"你在哪个频道"
- 消息历史裁剪逻辑按频道权限

**更新 (2026-03-07)**：F065 已重构 ContextAssembler，新增 Bootstrap 增强 + ThreadMemory + Handoff Digest。F044 的 per-viewer 过滤需基于 F065 新架构实现

**应对**：Phase 1 核心工作量

### 风险 2: Session Chain 与 Token 预算

私密频道消息的 token 算谁的？布偶猫在 `#ragdoll-hq` 发了 20 条策略讨论，进不进公开频道的 context window？

**更新 (2026-03-07)**：F033 已完成，Session Chain 策略已落地。per-channel chain 设计可直接基于 F033 的 `SessionStrategyConfig` 扩展

### 风险 3: 消息搜索/Grep

grep/search 要过滤无权限消息，否则私密内容可能被搜索命中

**应对**：服务端 ACL 必须覆盖搜索接口

---

## Open Questions

### OQ-1: Thread 可以有多个 Activity 吗？（移到 F045）

### OQ-2: 历史可见性策略

新加入频道的成员能否看历史消息？
- 辩论会休息室：应该能看（策略讨论）
- 狼人杀夜话：绝对不行

**建议**：Channel 配置 `historyVisibility: 'all' | 'since-join'`

### OQ-3: 与现有 Whisper 的关系

- 保持独立：Whisper = 系统级铲屎官↔猫私聊，Channel = 猫猫之间
- 还是迁移：Whisper 变成 type='dm' 且 members=['user', catId] 的 Channel

### OQ-4: 阶段转换控制（移到 F045）

### OQ-5: 派遣猫出征时 Channel 可见性（2026-03-07 新增）

F070 Portable Governance 已支持派遣猫到外部项目。如果猫在外部项目工作时仍参与战队讨论：
- Channel 可见性规则是否跨项目传递？
- SystemPromptBuilder 注入哪些 channel 上下文？
- 还是派遣期间暂停 channel 参与？

---

## Dependencies

> **更新：2026-03-07** — 全量影响分析（原始讨论 [thread_mm4uyww7va6y8k15](cat-cafe://thread/mm4uyww7va6y8k15)）

### 原定依赖（2026-02-27，已过时）

~~F033 → F039 → F044 → F045 → F037~~

### 当前依赖（2026-03-07 更新）

| Feature | 关系 | 状态 | 说明 |
|---------|------|------|------|
| **F033 Session Chain 策略** | ✅ 已清除 | done (2026-03-04) | Session chain 逻辑已完成，per-channel chain 设计可直接基于其之上 |
| **F065 Session Continuity** | ✅ 已清除 | done (2026-03-06) | ContextAssembler 已大改（Bootstrap 增强 + ThreadMemory + Handoff Digest），F044 改造须基于新架构 |
| **F073 SOP Auto-Guardian** | 🟡 建议先完成 | spec (P1) | 也要改 SystemPromptBuilder，建议先做完 F073 稳定后再让 F044 碰 SystemPromptBuilder |
| **F069 Thread Read State** | 🟡 建议先完成 | spec | 未读 badge 后端真相源，做完后 F044 扩展为 per-channel 粒度更自然 |
| **F039 消息排队投递** | 🟡 相关 | in-progress | 消息投递需考虑 Channel 可见性过滤，可并行 |
| **F037 Agent Swarm** | 🟢 下游 | in-progress | Swarm 内部讨论需要 Channel 能力 |
| **F070 Portable Governance** | 🟡 新增关联 | Phase 1 done | 派遣猫出征时 Channel 可见性规则是否跟随？→ 新 OQ-5 |
| **F075 猫猫排行榜** | 🟢 下游 | spec | 排行榜可能按 Channel 维度统计互动 |

**建议开发顺序**：F073 + F069（可并行） → **F044** → F045 → F037

### 关键架构影响（2026-03-07 识别）

**1. ContextAssembler 已被 F065 重构**
- F065 加了 Bootstrap 增强、ThreadMemory（线程滚动记忆）、Handoff Digest（LLM 会议纪要）
- F044 的 per-viewer 消息过滤要基于 F065 的新 `assemble()` 接口，不是 2 月讨论时的老接口
- 影响文件：`packages/api/src/context/` 目录

**2. SystemPromptBuilder 成为热改区**
- F073 要加 SOP 阶段感知注入
- F044 要加频道上下文注入（"你在 #ragdoll-hq 频道"）
- F070 已改了 Bootstrap 派遣注入
- 建议 F073 先稳定，F044 后续增量

**3. Message 模型已更复杂**
- F039 加了消息排队
- F065 加了 ThreadMemory
- F072 加了 read state (mark-all-read)
- F044 加 `channelId` 是增量，需确保兼容

**4. 搜索接口需要 Channel ACL**
- `cat_cafe_search_messages` / `cat_cafe_session_search` 等 MCP 工具需要按 viewer 过滤
- 包括 Hindsight recall 搜索也要过滤

---

## Phase 拆分

### Phase 1: Channel 基础（2-3 周）

- [ ] Channel 实体 + CRUD API
- [ ] Message.channelId 字段
- [ ] ContextAssembler 按 viewer 过滤
- [ ] 前端过滤标签 UI
- [ ] 服务端 ACL（读写 + 搜索）
- [ ] 跨频道 @mention 禁止

### Phase 2: 成员管理（1-2 周）

- [ ] 动态成员（faction:ragdoll 自动填充）
- [ ] 成员 CRUD API
- [ ] 历史可见性策略（historyVisibility）
- [ ] 铲屎官主动参与/静默切换

### Phase 3: 跨频道引用（1 周）

- [ ] 引用渲染按权限过滤
- [ ] Channel.quotable 配置
- [ ] 引用来源标注 UI

---

## 收敛检查（2026-02-27）

1. **否决理由 → ADR？** 没有（决策已在本文档"五猫讨论纪要"完整记录，不需要单独全局 ADR）
2. **踩坑教训 → lessons-learned？** 没有（opus 4.6 提出的是预见风险，非踩过的坑）
3. **操作规则 → 指引文件？** 没有（决策是 feature-level，非全局操作规则）

---

## 追溯链

```
BACKLOG.md F044（入口）
  └→ docs/features/F044-channel-activity-system.md（本文档：spec + 讨论纪要）
      ├→ thread_mm4uyww7va6y8k15（原始讨论 Thread，2026-02-27）
      └→ thread_mm4uyww7va6y8k15（依赖更新讨论，2026-03-07）
```

---

## Links

- **讨论 Thread**: [thread_mm4uyww7va6y8k15](cat-cafe://thread/mm4uyww7va6y8k15)
- **关联 Feature**: [F033 Session Chain](F033-session-strategy-configurability.md) ✅done, [F037 Agent Swarm](F037-agent-swarm.md), [F065 Session Continuity](F065-session-continuity.md) ✅done, [F069 Read State](F069-thread-read-state.md), [F070 Governance](F070-portable-governance.md), [F073 SOP Guardian](F073-sop-auto-guardian.md), [F075 Leaderboard](F075-cat-leaderboard.md)
- 发起讨论：2026-02-27 铲屎官 @opus45
- 五猫参与：codex, sonnet, opus(4.6), opus-45
- 收敛：2026-02-27 opus-45
- 依赖更新：2026-03-07 opus(4.6) + gpt52
