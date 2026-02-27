---
feature_ids: [F043]
debt_ids: []
topics: [mcp, architecture, agent-collaboration]
doc_kind: feature-spec
created: 2026-02-27
---

# F043: MCP 归一化 — 多 Server 拆分 + 原生 MCP 优先

## 概述

将现有单一 `cat-cafe-mcp` server（27 tools 平铺）拆分为 3 个职责域 MCP server，同时将传输层从 HTTP callback 主路径迁移到原生 MCP (stdio) 主路径，HTTP callback 降级为 fallback。

## 背景

### 现状问题

1. **1 个 MCP server 挂 27 个 tools**：prompt 臃肿（每个 tool schema 注入系统提示），猫选工具时认知负担大
2. **HTTP callback 作为主传输**：需要 invocationId + callbackToken 验证机制，有 TTL 过期风险（已止血但根本问题在）
3. **不同猫需要不同工具集**：当前无法按需加载

### F033 关键发现

2026-02-25 F033 Phase 3 实施中发现：**三猫（Claude/Codex/Gemini）都支持 Anthropic MCP 标准协议的动态注入**。这意味着原来只有 Claude 能用的原生 MCP，现在三猫都可以用。HTTP callback 不再是非 Claude 猫的唯一选择。

### 讨论来源

2026-02-27 铲屎官 + 布偶猫 (Opus 4.6) + 布偶猫 (Opus 4.5) 在 F037 Agent Swarm 后续讨论中产出。

## 依赖

| 依赖 | 类型 | 说明 |
|------|------|------|
| F033 | 硬依赖 | 三猫 MCP 动态注入能力是本 feat 的前提 |
| F039 | 无依赖 | 时间上先后，逻辑上独立 |

## 设计方案

### MCP Server 拆分（3 个 server）

```
① cat-cafe-collab (协作核心)      ← 三猫必装
   消息: post_message, get_thread_context,
         get_pending_mentions, ack_mentions
   任务: update_task, list_tasks [新]
   授权: request_permission, check_permission
   富块: create_rich_block, get_rich_block_rules
   发现: list_threads [新], search_messages [新]
   跨域: cross_post_message [新]
                                        ~14 tools

② cat-cafe-memory (记忆与回溯)    ← 三猫可装
   知识: search_evidence, reflect, retain_memory
   回溯: list_sessions, read_events, read_digest,
         read_invocation, session_search
   索引: feat_index [新]
                                        ~9 tools

③ cat-cafe-signals (信号猎手)     ← 三猫可装
   inbox, get_article, search, mark_read, summarize
                                        5 tools
```

### file tools 处理

删除 `read_file`、`write_file`、`list_files`。三猫的宿主（Claude Code / Codex CLI / Gemini CLI）都自带文件操作能力，MCP 再包一层是冗余。

### 传输层迁移

```
主路径: stdio (原生 MCP，三猫统一)
降级:   HTTP callback (MCP 连接失败时 fallback)
```

### 身份识别变化

原生 MCP 下，身份不再靠 callback token，而靠 MCP server 启动时的环境变量：

```json
{
  "mcpServers": {
    "cat-cafe-collab": {
      "command": "node",
      "args": ["cat-cafe-collab/dist/index.js"],
      "env": {
        "CAT_CAFE_CAT_ID": "opus",
        "CAT_CAFE_THREAD_ID": "thread-xyz",
        "CAT_CAFE_USER_ID": "default-user"
      }
    }
  }
}
```

MCP server 进程生命周期和猫的调用生命周期一致（spawn 时启动，猫结束时退出），天然绑定身份。

## 新增 MCP 工具（协作缺口补充）

### P0: search_messages（归属 collab）

`get_thread_context` 增加 `catId` 和 `keyword` 可选参数，支持按猫过滤、按关键词搜索。

**场景**："看 Sonnet 在这个 thread 里说过什么"、"搜之前关于 Redis 的讨论"

### P1: list_threads（归属 collab）

列出所有 thread（名称、最后活跃时间、参与的猫）。

**场景**：猫不知道有哪些 thread 存在，跨 thread 协作的前提。

### P1: feat_index（归属 memory）

feat → thread 映射。查询 "F039 的讨论在哪个 thread？"。

**场景**：feat 接力时找到前序 feat 的讨论上下文。

### P2: cross_post_message（归属 collab）

`post_message` 增加可选 `threadId`，向其他 thread 发消息。

**场景**：在 thread-A 做完了阻塞 thread-B 的工作，直接通知。

### P2: list_tasks（归属 collab）

查看全局任务列表（不限于自己的 task）。

**场景**：多猫并行时互相了解进度。

## 验收标准

- [ ] 现有单一 MCP server 拆分为 3 个独立 server（collab / memory / signals）
- [ ] 三猫都通过原生 MCP (stdio) 调用，HTTP callback 仅作 fallback
- [ ] 每只猫可按需配置装载哪些 MCP server
- [ ] file tools 已移除，无功能回退
- [ ] 新增工具至少完成 P0（search_messages）和 P1（list_threads）
- [ ] 现有 27 个工具的回归测试全部通过
- [ ] ADR 记录架构决策

## 实施建议

1. **Phase A**: ADR 编写（拆分策略 + 传输层迁移 + 身份识别变化）
2. **Phase B**: 拆分 packages（cat-cafe-collab / cat-cafe-memory / cat-cafe-signals）
3. **Phase C**: 传输层迁移（原生 MCP 主路径 + HTTP fallback）
4. **Phase D**: 新增工具（search_messages → list_threads → feat_index → cross_post_message）

## 风险

| 风险 | 缓解 |
|------|------|
| 拆分后三个进程启动开销增大 | 按需启动（不用的不装） |
| HTTP fallback 路径退化 | 保留完整测试覆盖 |
| 迁移期间两套机制并存 | Phase B/C 可并行，用 feature flag 切换 |

## 演进路径

```
F033 (三猫 MCP 动态注入) → F043 (MCP 归一化) → F042 (提示词优化，受益于 prompt 瘦身)
```
