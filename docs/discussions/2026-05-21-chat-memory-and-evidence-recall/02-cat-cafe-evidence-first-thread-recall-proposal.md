---
title: "Cat Café Evidence-first Thread Recall 提案"
date: 2026-05-21
status: proposal
doc_kind: discussion
topics: [memory, search-evidence, threads, sessions, invocations, anchors, mcp]
related_features: [F102, F148, F188, F200]
---

# Cat Café Evidence-first Thread Recall 提案

## 0. 一句话版本

普通用户不会认真拆 thread。Cat Café 要支持“一条长 thread 里什么都聊”的现实使用方式，但不能把方案做成“小模型话题分片器”。

正确方向是：

> 把 thread / message / session / invocation 全部作为 evidence，可检索、可 drill-down；摘要只是索引，原文才是证据，猫负责判断。

## 1. 反目标：不要做小模型总结注入

不做：

```text
长 thread
  → 小模型切话题
  → 小模型生成摘要
  → 摘要硬塞给大模型
  → 大模型基于摘要回答
```

原因：

1. 摘要容易没有 provenance。
2. 摘要会混淆偏好、历史事实、讨论倾向、最终决策。
3. 摘要一旦被注入上下文，模型会高估它。
4. 小模型如果独立写结论，就等于替猫做语义判断。

这违反 Cat Café 的核心原则：

> 给数据，不给结论。

## 2. 正确坐标系：search_evidence 找候选，不下结论

家里的记忆不是单独手写 memory item，而是 durable artifacts 动态编译成可检索 evidence：

```text
docs / decisions / features / lessons / discussions / threads / sessions / invocations
        ↓
IndexBuilder / evidence.sqlite / FTS + vector rerank
        ↓
search_evidence 返回候选 + anchor + drill-down
        ↓
猫打开原始材料，自己判断
```

`search_evidence` 已经支持：

- `scope=docs | memory | threads | sessions | all`
- `mode=lexical | semantic | hybrid`
- `depth=summary | raw`
- `threadId` 过滤
- thread 结果 drill-down 到 `get_thread_context`
- session 结果 drill-down 到 `read_session_digest`

所以问题不是“要不要另做话题系统”，而是：

> 怎么让 chat history 的每个关键单位都成为可搜索、可定位、可打开的 evidence。

## 3. 统一 anchor contract，不统一 reader

一个容易补锅的错误方案是做万能 `read_anchor(anchor)`。

更好的方案是：**统一 anchor 语义，但保留不同 source 的最佳读取方式。**

| sourceType | anchor 示例 | 最佳读取方式 |
|---|---|---|
| docs/file | `docs/features/F208.md:120` | `rg` / `sed` / `nl` / `git show` |
| thread/message | `thread:<id>#message:<id>` | `get_thread_context` / message window |
| session | `session:<id>` | `read_session_digest` / `read_session_events` |
| invocation | `session:<id>#invocation:<id>` | `read_invocation_detail` |
| decision graph | `ADR-031` / `F188` | `graph_resolve` |
| recent activity | time range / scope | `list_recent` |

因此，`search_evidence` 结果应该返回：

```yaml
anchor: "thread:thread_xxx#message:msg_yyy"
sourceType: "thread_message"
snippet: "..."
confidence: "medium"
drillDown:
  tool: "cat_cafe_get_thread_context"
  params:
    threadId: "thread_xxx"
    messageId: "msg_yyy"
    before: 5
    after: 5
```

对于文件，drill-down 不一定是 MCP 工具，而可以是操作建议：

```yaml
anchor: "docs/features/F208-capability-profile-routing.md:120"
sourceType: "file"
drillDown:
  command: "sed -n '110,150p' docs/features/F208-capability-profile-routing.md"
```

## 4. 关键缺口：message-level window reader

文件可以用 `rg` / `sed` 精确打开。Redis 里的 thread/message 不能 grep 文件系统。

因此真正可能缺的不是万能 reader，而是更精细的 thread reader：

```text
read_message_window(threadId, messageId, before=5, after=5)
```

或者扩展现有 `get_thread_context`：

```text
get_thread_context(threadId, messageId?, before?, after?, keyword?, cursor?, limit?)
```

这样命中某条消息时，猫不会被迫读完整 thread，只读相关窗口。

## 5. Thread Topic Map 是视图，不是真相源

如果用户问：

> “这个超长 thread 我们到底聊过什么？”

系统不应该先验生成一个永久 topic map。更好的流程是：

```text
1. list_recent / search_evidence(scope=threads/sessions) 找候选
2. depth=raw + contextWindow / message window 拿局部原文
3. 猫按证据临时组织 topic map
4. 每个 topic 都显示支撑 anchor
```

Topic Map 应该长这样：

```yaml
- topic: "工具坐标系 vs 伙伴坐标系"
  timeRange: "2026-05-17 19:30-20:00"
  anchors:
    - "thread:thread_mpal...#message:msg_a"
    - "thread:thread_mpal...#message:msg_b"
  summary: "讨论小红书用户觉得 Claude 恶臭，收敛到环境坐标系差异。"
```

重点：

> Topic Map 是检索结果的组织形式，不是独立判断器。

## 6. 允许 embedding / rerank，但不允许黑盒结论

FTS、embedding、RRF、F200 consumption rerank 都可以用。它们的职责是排序候选证据，不是替猫写结论。

允许：

- 找相似片段
- 排序候选
- 提醒可能相关的 thread/session
- 给 drill-down 建议

不允许：

- 自动宣称“这个话题的最终结论是 X”
- 自动把摘要当 current truth
- 自动决定猫该相信哪条旧记忆
- 自动替猫路由任务

一句话：

> Retrieval 可以自动，judgment 不能黑盒自动。

## 7. 推荐工作流

### 7.1 用户问“之前聊过 X 吗？”

```text
search_evidence(query="X", scope=threads, mode=hybrid)
  → 命中 thread/message/session
  → drill down message window
  → 猫基于原文回答，并给 anchor
```

### 7.2 用户问“这个 thread 到底聊了什么？”

```text
list_recent(scope=threads, since=...)
  → 定位 thread
get_thread_context(threadId, limit/window)
  → 粗看结构
search_evidence(scope=threads, threadId=..., mode=hybrid, depth=raw)
  → 找高信号片段
猫整理 topic map，topic 带 anchors
```

### 7.3 用户问“我们当前有效决策是什么？”

```text
search_evidence(query, scope=docs, mode=hybrid)
graph_resolve(anchor)
git/file drill-down
猫判断 current / superseded / draft / disputed
```

决策问题优先查 docs / ADR / feature / commit，不优先查 thread 摘要。

## 8. Open Questions

1. **Message anchor 是否已有稳定 ID？**  
   如果没有，需要在 message store / evidence index 里统一 `threadId + messageId` anchor。

2. **`get_thread_context` 是否应扩展 message window 参数？**  
   推荐扩展，而不是新增万能 `read_anchor`。

3. **search_evidence 当前 threads/sessions 覆盖的是 digest 还是 raw message passage？**  
   如果主要是 digest，应补 raw message / invocation passage ingestion。

4. **文件类 anchor 是否需要 MCP reader？**  
   暂不建议。猫本地已有 `rg` / `sed` / `git show`，比万能 reader 更精确。

5. **Topic Map 是否需要持久化？**  
   默认不持久。只有当用户/猫确认其有长期价值时，才沉淀成 discussion / ADR / lesson / feature doc。

## 9. 结论

Cat Café 不需要复制 ChatGPT / Claude.ai 的摘要注入式 memory。我们已经有更好的路线：

> 用 `search_evidence` 统一找候选，用 anchor 指向原始材料，用 typed drill-down 打开证据，用猫判断语义和状态。

这条路线保留了模型的判断力，也保留了工程系统的可审计性。

