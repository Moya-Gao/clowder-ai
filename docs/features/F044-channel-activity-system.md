---
feature_ids: [F044]
topics: [channel, activity, game, collaboration]
doc_kind: spec
created: 2026-02-27
---

# F044: Channel & Activity System（频道与活动系统）

> **Status**: proposal
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

## What

### 核心概念

```
Thread (现有)
  └── Activity (新增：一局游戏/一场辩论)
        ├── roles: { 铲屎官: "法官", opus: "狼人", codex: "村民", ... }
        ├── channels:
        │     ├── #public (默认公开)
        │     ├── #werewolf-night (狼人夜话，狼人+法官可见)
        │     └── @opus-codex (私聊)
        └── rules:
              ├── crossChannelQuote: "forbidden" | "authorized" | "free"
              └── phaseTransitions: [...]
```

### 数据模型增量

```typescript
// 活动（一局游戏/一场辩论）
interface Activity {
  id: string
  threadId: string
  type: 'werewolf' | 'debate' | 'sanguosha' | 'election' | 'custom'
  name: string                    // "第一届猫猫辩论赛"
  roles: Record<ParticipantId, Role>  // 铲屎官也是 Participant
  channels: Channel[]
  rules: ActivityRules
  phase?: string                  // "night" | "day" | "voting" | ...
  createdAt: Date
}

// 频道
interface Channel {
  id: string
  activityId: string
  name: string                    // "#werewolf-night" | "@opus-codex"
  type: 'public' | 'faction' | 'dm' | 'role-based'
  members: ParticipantId[]        // 可见成员
  allowQuoteFrom: boolean         // 是否允许被引用到其他频道
}

// 活动规则
interface ActivityRules {
  crossChannelQuote: 'forbidden' | 'authorized' | 'free'
  authorizeQuoteBy?: 'self' | 'channel-owner' | 'host'  // 谁授权引用
  phases?: PhaseDefinition[]      // 阶段定义（狼人杀用）
}

// 消息增量
interface Message {
  // ...existing fields
  activityId?: string
  channelId?: string
}
```

### 场景映射

| 场景 | Activity Type | 频道结构 | 跨频道引用规则 |
|------|---------------|----------|----------------|
| 狼人杀 | `werewolf` | `#day` + `#werewolf-night` + `#seer-check` + 私信 | `forbidden`（夜晚→白天禁止） |
| 辩论会 | `debate` | `#stage` + `#pro-lounge` + `#con-lounge` | `free` 或 `authorized` |
| 三国杀 | `sanguosha` | `#table` + 身份私信 | `free`（公开行动可引用） |
| 领袖选举 | `election` | `#campaign` + `#ballot-box`(只写) | `free` |
| 自由组队 | `custom` | 用户自定义 | 用户自定义 |

### 铲屎官角色

铲屎官的角色是**活动级别**的配置，不是系统权限：

```typescript
type HostRole =
  | 'spectator'     // 旁观者（可见所有，不参与）
  | 'judge'         // 法官（上帝视角 + 阶段控制权）
  | 'moderator'     // 主持人（可见所有 + 发言权）
  | 'player'        // 玩家（按角色限制可见性）
  | 'participant'   // 辩手（属于某个战队）
```

### UX 草案

```
┌─────────────────────────────────────────────────────────────┐
│  Thread: 猫猫狼人杀第一局                                    │
│  Activity: 🐺 Werewolf · Phase: 🌙 Night 2                  │
├─────────────────────────────────────────────────────────────┤
│ [#day] [#werewolf-night👀] [@opus私信]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  #werewolf-night (你是狼人，可见此频道)                      │
│  ──────────────────────────────────────                     │
│  🐱 codex [狼人]: 今晚刀 sonnet                              │
│  🐱 gemini [狼人]: 同意                                      │
│                                                             │
│  ───── 法官视角 ─────                                       │
│  🧑 铲屎官 [法官]: 狼人请确认目标                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Open Questions

### OQ-1: 频道 vs Activity 的粒度

- 是否每个 Thread 只能有一个 Activity？
- 还是一个 Thread 可以有多个 Activity（历史存档）？

### OQ-2: 跨频道引用的 UX

- "授权引用"怎么交互？弹窗确认？还是引用时自动请求？
- 被引用内容在目标频道如何展示？折叠？水印？

### OQ-3: 阶段转换的控制

- 狼人杀的"天亮了"由谁触发？法官手动？系统自动？
- 需要状态机吗？

### OQ-4: 与现有 Whisper 的关系

- Whisper 是否迁移为 Activity 内的私信频道？
- 还是保持独立（Whisper = 系统级私聊，Channel = 活动内私聊）？

### OQ-5: 存储与性能

- Channel 消息是否独立存储？
- 铲屎官的"聚合视图"如何高效实现？

## Dependencies

- 无硬依赖，但与 F037 Agent Swarm 有协同可能（Swarm 内部讨论频道）

## Next Steps

1. [ ] 铲屎官确认场景优先级（先做哪个场景？）
2. [ ] 三猫讨论数据模型细节
3. [ ] UX 原型（可能需要暹罗猫）
4. [ ] Phase 拆分

## Links

- 发起讨论：2026-02-27 铲屎官 @opus45
