---
feature_ids: [F043]
debt_ids: []
topics: [mcp, architecture, agent-collaboration]
doc_kind: feature-spec
created: 2026-02-27
---

# F043: MCP 归一化 — Server 拆分 + 协作工具补全

> **Status**: spec
> **Owner**: 布偶猫
> **Priority**: P1
> **依赖**: F041（能力看板 + 配置编排就位后才能拆分 server）

## 与 F041 的关系

- **F041**：铲屎官视角 — 能力看板 UI + 配置编排器 + 全局/每猫开关
- **F043**：猫的视角 — MCP server 本身怎么拆分、新增哪些协作工具
- F041 提供配置编排基础设施，F043 在此基础上重组 MCP server 架构

## Why

### 现状问题

1. **1 个 MCP server 挂 27 个 tools 平铺**：所有 tool schema 注入系统提示，prompt 臃肿，猫选工具认知负担大
2. **协作工具缺口**：猫不能按 catId 过滤消息、不知道有哪些 thread、不能跨 thread 通知、没有 feat→thread 索引
3. **file tools 冗余**：宿主 CLI 自带文件操作，MCP 再包一层无意义

### 猫的实际痛点（布偶猫 4.5 + 4.6 共同反馈）

- **近视眼**：只能看到当前 thread，不知道其他 thread 的决策
- **接力棒丢了**：feat 接力时找不到前序 feat 的讨论在哪个 thread
- **肉眼找猫**：想看"砚砚说了什么"只能 `get_thread_context(limit=100)` 然后肉眼翻
- **隔墙喊话**：在 thread-A 做完了阻塞 thread-B 的工作，没有直接通知方式

## What

### 一、Server 拆分（1→3）

```
现状:
  cat-cafe-mcp (1 server, 27 tools 平铺)

目标:
  ① cat-cafe-collab  (协作核心, ~14 tools)  ← 三猫必装
  ② cat-cafe-memory   (记忆与回溯, ~9 tools) ← 按需
  ③ cat-cafe-signals  (信号猎手, 5 tools)    ← 按需
```

#### ① cat-cafe-collab（协作核心）

现有：post_message, get_thread_context, get_pending_mentions, ack_mentions, update_task, create_rich_block, get_rich_block_rules, request_permission, check_permission

新增：
- `search_messages` — catId/keyword 过滤 **[P0]**
- `list_threads` — thread 发现 **[P1]**
- `cross_post_message` — 跨 thread 发消息 **[P2]**
- `list_tasks` — 全局任务视图 **[P2]**

#### ② cat-cafe-memory（记忆与回溯）

现有：search_evidence, reflect, retain_memory, list_session_chain, read_session_events, read_session_digest, read_invocation_detail, session_search

新增：
- `feat_index` — feat→thread 映射 **[P1]**

#### ③ cat-cafe-signals（信号猎手）

现有：signal_list_inbox, signal_get_article, signal_search, signal_mark_read, signal_summarize

**注意**：Signals 是猫猫日报功能（F21++），三猫共用，不是某只猫专属。

#### file tools

删除 read_file, write_file, list_files。宿主 CLI 自带。

### 二、新增工具详细设计

#### P0: search_messages

扩展 `get_thread_context`，新增可选参数：

```typescript
// 新增参数
catId?: CatId | 'user'   // 按猫过滤（'user' = 铲屎官消息）
keyword?: string          // 内容包含关键词
```

**场景**：
- "看 Sonnet 在这个 thread 说了什么" → `catId=sonnet`
- "搜之前关于 Redis 的讨论" → `keyword=Redis`
- "看铲屎官的原始需求" → `catId=user`

**实现**：在现有分页循环里加 `canViewMessage` 之后的额外过滤条件。

#### P1: list_threads

```typescript
interface ListThreadsInput {
  limit?: number;        // 默认 20
  activeSince?: number;  // 时间戳，只返回此时间后活跃的
}

interface ThreadSummary {
  threadId: string;
  title?: string;
  lastActiveAt: number;
  messageCount: number;
  participants: CatId[];  // 参与过的猫
}
```

**场景**："有哪些 thread？F039 的讨论在哪？"

#### P1: feat_index

```typescript
interface FeatIndexInput {
  featId?: string;       // 查特定 feat（如 "F039"）
  query?: string;        // 模糊搜索 feat 名称
}

interface FeatEntry {
  featId: string;
  name: string;
  threadIds: string[];   // 关联的 thread
  status: string;
  keyDecisions?: string[];
}
```

**数据源**：`docs/features/*.md` 的 frontmatter + BACKLOG.md 解析。

#### P2: cross_post_message

`post_message` 新增可选 `threadId` 参数：

```typescript
threadId?: string  // 向指定 thread 发消息，省略 = 当前 thread
```

#### P2: list_tasks

```typescript
interface ListTasksInput {
  threadId?: string;     // 过滤特定 thread
  catId?: CatId;         // 过滤特定猫
  status?: TaskStatus;   // 过滤状态
}
```

## 验收标准

- [ ] 27 tools 拆分到 3 个独立 MCP server
- [ ] file tools 已移除，无功能回退
- [ ] F041 配置编排器能正确管理 3 个 server 的加载/卸载
- [ ] P0 search_messages 可用 + 测试
- [ ] P1 list_threads + feat_index 可用 + 测试
- [ ] 现有工具回归测试全部通过
- [ ] prompt 长度显著下降（按需加载 vs 全量注入）

## 实施建议

| Phase | 做什么 | 前置 |
|-------|--------|------|
| A | 新增 P0 工具（search_messages）| 无，可立即做 |
| B | Server 拆分（1→3 packages） | F041 配置编排就位 |
| C | 新增 P1 工具（list_threads, feat_index） | Phase B |
| D | 新增 P2 工具（cross_post_message, list_tasks） | Phase C |
| E | 删除 file tools + prompt 瘦身验证 | Phase B |

**注意**：Phase A 不依赖 F041，可以先做。

## 讨论来源

2026-02-27 铲屎官 + 布偶猫 (Opus 4.6) + 布偶猫 (Opus 4.5)，F037 Agent Swarm 后续讨论。

核心问题由铲屎官提出："agent 之间的协作，在 thread 之内和跨 thread 会用到什么功能？现在的搜 codebase 够吗？猫猫咖啡如何进化给你们更多可能性？"
