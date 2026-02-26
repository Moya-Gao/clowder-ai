---
feature_ids: []
topics: [cli, ndjson, treasure]
doc_kind: research
created: 2026-02-26
---

# 三猫 CLI NDJSON 宝藏地图

> **调研人**: 布偶猫 (宪宪)
> **日期**: 2026-02-12
> **状态**: 考证完成
> **关联**: [F8 Token 预算 + 深度可观测性 Plan](../plans/2026-02-12-f8-token-budget-migration.md)

## 1. 背景

Cat Café 通过 CLI 子进程 (`claude` / `codex` / `gemini`) 调用三只猫，每只猫的 CLI 都以 NDJSON 格式输出事件流。我们在 `*AgentService.ts` 的 transform 函数中解析这些事件，但**只提取了一小部分**，大量有价值的数据被 `return null` 丢弃。

本次考证的目标：**完整摸清三猫 CLI 的 NDJSON 输出，找出被丢弃的宝藏**。

### 考证方法

| 猫猫 | 数据来源 | 说明 |
|------|---------|------|
| 布偶猫 | `claude -p "say hi" --output-format stream-json --verbose` 实际输出 | 直接在终端捕获完整 NDJSON |
| 缅因猫 | `data/cli-raw-archive/2026-02-10/*.ndjson` (19 个 session) | CliRawArchive 归档的真实生产数据 |
| 暹罗猫 | `gemini-agent-service.test.js` 测试 fixtures + 源码 | 无生产 archive，以测试数据为准 |

---

## 2. 布偶猫 (Claude CLI) — 最丰富

### 2.1 事件类型全景

CLI 调用方式: `claude -p "..." --output-format stream-json --verbose --include-partial-messages`

| 事件类型 | 当前处理 | 说明 |
|----------|---------|------|
| `system/init` | 只取 `session_id` | 包含工具列表、MCP 状态、Skills、插件等元信息 |
| `stream_event/message_start` | 只取 `message.id` | 包含 `message.usage` (input tokens, cache tokens) |
| `stream_event/content_block_delta` | ✅ 提取 text delta | 流式文本增量 |
| `stream_event/message_stop` | 清空 stream state | 无额外数据 |
| `assistant` | ✅ 提取 text + tool_use | 包含完整 `message.usage`，被忽略 |
| `result/success` | ❌ **完全丢弃** | **最大宝藏**：cost、duration、token 用量、模型窗口 |
| `result/error` | ✅ 提取 errors | 错误信息 |
| `system/hook` | ❌ 丢弃 | hook 执行信息 |

### 2.2 `system/init` — 能力发现（当前只取了 session_id）

实际捕获的完整事件:

```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/Users/lysander/projects/relay-station/cat-cafe",
  "session_id": "ab21de4e-3685-42dd-ae0c-3a25af98445d",
  "model": "claude-opus-4-6",
  "permissionMode": "default",
  "claude_code_version": "2.1.41",
  "apiKeySource": "none",
  "output_style": "default",
  "fast_mode_state": "off",

  "tools": [
    "Task", "TaskOutput", "Bash", "Glob", "Grep", "Read", "Edit", "Write",
    "NotebookEdit", "WebFetch", "TodoWrite", "WebSearch", "TaskStop",
    "AskUserQuestion", "Skill", "EnterPlanMode", "ToolSearch",
    "mcp__claude_ai_Hugging_Face__hf_whoami",
    "mcp__claude_ai_Hugging_Face__space_search",
    "..."
  ],

  "mcp_servers": [
    {"name": "pencil", "status": "disabled"},
    {"name": "plugin:figma:figma", "status": "disabled"},
    {"name": "claude.ai Hugging Face", "status": "connected"}
  ],

  "slash_commands": [
    "keybindings-help", "debug", "using-git-worktrees",
    "cross-cat-handoff", "test-driven-development",
    "systematic-debugging", "brainstorming",
    "compact", "context", "cost", "init",
    "pr-comments", "release-notes", "review", "security-review", "insights",
    "mcp__claude_ai_Hugging_Face__User Summary",
    "..."
  ],

  "skills": [
    "keybindings-help", "brainstorming", "cross-cat-handoff",
    "merge-approval-gate", "spec-compliance-check",
    "verification-before-completion", "..."
  ],

  "agents": [
    "Bash", "general-purpose", "statusline-setup",
    "Explore", "Plan", "claude-code-guide"
  ],

  "plugins": [
    {"name": "frontend-design", "path": "/Users/lysander/.claude/plugins/cache/.../frontend-design/2cd88e7947b7"},
    {"name": "figma", "path": "/Users/lysander/.claude/plugins/cache/.../figma/1.1.0"}
  ]
}
```

**可利用价值**:
- `tools[]`: 运行时工具清单，可在前端展示"这只猫目前能干什么"
- `mcp_servers[]`: MCP 连接健康状态，`status: "connected"|"disabled"` 可做状态面板
- `slash_commands[]` / `skills[]`: 可用技能列表，功能发现 (F12) 的数据源
- `agents[]`: subagent 类型列表
- `plugins[]`: 已安装插件
- `claude_code_version`: CLI 版本追踪，兼容性检查
- `permissionMode` / `apiKeySource`: 安全审计

### 2.3 `result/success` — 超级宝藏（当前完全丢弃）

实际捕获的完整事件:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "session_id": "ab21de4e-3685-42dd-ae0c-3a25af98445d",
  "result": "嗨，铲屎官！宪宪在线，有什么需要帮忙的吗？",
  "stop_reason": null,

  "duration_ms": 4901,
  "duration_api_ms": 3857,
  "num_turns": 1,
  "total_cost_usd": 0.1666175,

  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 25412,
    "cache_read_input_tokens": 13855,
    "output_tokens": 34,
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 25412,
      "ephemeral_5m_input_tokens": 0
    },
    "inference_geo": ""
  },

  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 3,
      "outputTokens": 34,
      "cacheReadInputTokens": 13855,
      "cacheCreationInputTokens": 25412,
      "webSearchRequests": 0,
      "costUSD": 0.1666175,
      "contextWindow": 200000,
      "maxOutputTokens": 32000
    }
  },

  "permission_denials": []
}
```

**逐字段价值分析**:

| 字段 | 值 (示例) | 价值 |
|------|-----------|------|
| `total_cost_usd` | 0.1666 | 成本追踪！单次调用花了多少钱 |
| `duration_ms` | 4901 | 总耗时 (含 CLI 启动) |
| `duration_api_ms` | 3857 | 纯 API 耗时 (差值 = CLI 开销 ~1s) |
| `num_turns` | 1 | 本次调用的轮数 (多轮工具使用时 > 1) |
| `usage.input_tokens` | 3 | 实际 input token 数 |
| `usage.output_tokens` | 34 | 实际 output token 数 |
| `usage.cache_creation_input_tokens` | 25412 | 新建缓存的 token 数 |
| `usage.cache_read_input_tokens` | 13855 | 命中缓存的 token 数 |
| `usage.server_tool_use` | {web_search: 0, web_fetch: 0} | 服务端工具使用计数 |
| `usage.service_tier` | "standard" | 服务层级 |
| `usage.cache_creation.ephemeral_*` | 5m/1h 缓存分类 | 缓存生命周期分析 |
| `modelUsage.*.contextWindow` | 200000 | 该模型的上下文窗口大小！ |
| `modelUsage.*.maxOutputTokens` | 32000 | 最大输出 token 限制 |
| `modelUsage.*.costUSD` | 0.1666 | 单模型维度的花费 |
| `permission_denials` | [] | 权限拒绝记录 (安全审计) |

### 2.4 `assistant` 消息中的 usage（当前只取 text/tool_use）

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_01MfdR7rpMbj2Qtxqfuwzef3",
    "model": "claude-opus-4-6",
    "content": [{"type": "text", "text": "..."}],
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 25412,
      "cache_read_input_tokens": 13855,
      "output_tokens": 1,
      "service_tier": "standard"
    }
  },
  "session_id": "ab21de4e-..."
}
```

注意: `assistant` 事件的 `output_tokens` 可能是中间值 (streaming 进行中)，而 `result/success` 的是最终值。

---

## 3. 缅因猫 (Codex CLI) — 独有思考链

### 3.1 事件类型全景

CLI 调用方式: `codex exec --json --sandbox danger-full-access --add-dir .git ...`

统计来源: 19 个真实 session，总计约 750 条事件。

| 事件类型 | 出现次数 | 当前处理 | 说明 |
|----------|:-------:|---------|------|
| `thread.started` | 18 | ✅ session_init | `thread_id` |
| `turn.started` | 18 | ❌ 丢弃 | 空事件 (无有用字段) |
| `item.completed(reasoning)` | **161** | ❌ **丢弃** | 缅因猫思考过程！ |
| `item.completed(agent_message)` | 68 | ✅ text | 最终输出文本 |
| `item.started(command_execution)` | 224 | ✅ tool_use | 命令开始执行 |
| `item.completed(command_execution)` | 222 | ✅ tool_result | 命令执行完成 + 输出 |
| `item.completed(file_change)` | 11 | ✅ tool_use | 文件新增/修改 |
| `turn.completed` | 10 | ❌ **丢弃** | token 用量 + 缓存 |
| `error` | 6 | 部分 (仅 Reconnecting) | 流错误信息 |
| `turn.failed` | 1 | ❌ 丢弃 | 轮次失败 + 错误原因 |

### 3.2 `item.completed(reasoning)` — 缅因猫的思考链

这是 Codex CLI 独有的事件。示例:

```json
{
  "type": "item.completed",
  "item": {
    "id": "item_0",
    "type": "reasoning",
    "text": "**Planning investigation for feature statuses**"
  }
}
```

**统计发现**:
- 161 条 reasoning vs 68 条 agent_message = 缅因猫的**思考量是输出的 2.4 倍**
- reasoning text 使用 Markdown 格式 (加粗标题 + 换行说明)
- 类似 Claude 的 thinking block，但 Codex 直接在 NDJSON 流里输出

**利用价值**:
- 在前端展示"缅因猫正在思考..."的过程 (类似 thinking block 折叠展示)
- 调试/审计时理解缅因猫的推理过程
- 评估缅因猫的思考深度和质量

### 3.3 `turn.completed` — 真实 token 数据

从真实 archive 提取的实际数据:

```json
{
  "type": "turn.completed",
  "usage": {
    "input_tokens": 1294316,
    "cached_input_tokens": 1107456,
    "output_tokens": 9938
  }
}
```

**关键指标**:
- `input_tokens`: 1,294,316 (~1.3M) — 缅因猫单次调用的 input 规模
- `cached_input_tokens`: 1,107,456 — **缓存命中率 85.6%！**
- `output_tokens`: 9,938 (~10k) — 输出规模

注: Codex 没有 `total_cost_usd` 字段。如需成本估算，需根据 token 数 + 定价计算。

### 3.4 `item.completed(file_change)` — 文件变更详情

```json
{
  "type": "item.completed",
  "item": {
    "id": "item_30",
    "type": "file_change",
    "status": "completed",
    "changes": [
      {
        "path": "/Users/lysander/projects/relay-station/cat-cafe/docs/bug-report/.../bug-report.md",
        "kind": "add"
      }
    ]
  }
}
```

`changes[].kind`: `"add"` (新建) 或 `"update"` (修改)。当前只取了 `changes.length`，丢失了具体路径和操作类型。

### 3.5 `turn.failed` — 失败原因

```json
{
  "type": "turn.failed",
  "error": {
    "message": "stream disconnected before completion: error sending request for url (https://chatgpt.com/backend-api/codex/responses)"
  }
}
```

当前完全丢弃。可用于区分"CLI 崩溃" vs "API 断连" vs "超时"等不同失败模式。

### 3.6 `error` — 流错误 / 重连

```json
{"type": "error", "message": "Reconnecting... 1/5 (stream disconnected before completion: ...)"}
{"type": "error", "message": "Reconnecting... 2/5 (...)"}
{"type": "error", "message": "stream disconnected before completion: ..."}
```

当前只捕获 `Reconnecting...` 前缀的错误作为 `system_info`，其他错误丢弃。

---

## 4. 暹罗猫 (Gemini CLI) — 最简陋

### 4.1 事件类型全景

CLI 调用方式: `gemini -p "..." -o stream-json -y`

| 事件类型 | 当前处理 | 说明 |
|----------|---------|------|
| `init` | ✅ session_init | `session_id`, `model` |
| `message(user)` | ❌ 跳过 (echo) | 用户消息回显 |
| `message(assistant)` | ✅ text | `content`, `delta` 标志 |
| `tool_use` | ✅ tool_use | `tool_name`, `parameters` |
| `tool_result` | ❌ 跳过 | 工具执行结果 |
| `result/success` | ❌ **丢弃** | `stats: {total_tokens}` |
| `result/error` | ✅ error | 错误信息 |

### 4.2 `result/success` — 仅有 total_tokens

从测试 fixtures:

```json
{
  "type": "result",
  "status": "success",
  "stats": {
    "total_tokens": 100
  }
}
```

**对比三猫**:
- Claude: `input_tokens` + `output_tokens` + `cache_*_tokens` + `cost_usd` + `duration` + `contextWindow`
- Codex: `input_tokens` + `output_tokens` + `cached_input_tokens`
- Gemini: **仅 `total_tokens`**，无 input/output 拆分，无 cost，无 cache

Gemini CLI 的 NDJSON 格式是三猫中最简陋的，信息量最少。

---

## 5. Slash Commands / Skills — 无头模式能力考证

### 5.1 三猫 Skills 系统对比

| 特性 | 布偶猫 (Claude) | 缅因猫 (Codex) | 暹罗猫 (Gemini) |
|------|:---:|:---:|:---:|
| Skill 系统 | ✅ `~/.claude/skills/` | ❌ 无 | ✅ `~/.gemini/skills/` |
| 共享 Cat Café Skills | 17 个 | — | 17 个 (同步安装) |
| 内置 Slash 命令 | `/cost` `/context` `/compact` `/init` | — | — |
| 内置 Skills | `/review` `/security-review` `/pr-comments` `/release-notes` `/insights` | `exec review` 子命令 | — |
| MCP 命令 | HuggingFace 系列 | — | — |
| 管理命令 | `--disable-slash-commands` | — | `gemini skills list/enable/disable/install/uninstall` |

### 5.2 共享 Cat Café Skills 列表 (17 个)

三猫共享同一套 skills（安装在各自的 `~/.<cli>/skills/` 目录）:

| Skill | 触发场景 |
|-------|---------|
| `brainstorming` | 创意工作前 |
| `test-driven-development` | 实现功能/修 bug 前 |
| `systematic-debugging` | 遇到 bug/测试失败 |
| `writing-plans` | 有 spec 需要做多步任务 |
| `executing-plans` | 执行已有计划 |
| `writing-skills` | 创建/编辑 skills |
| `using-git-worktrees` | 开始功能开发 |
| `dispatching-parallel-agents` | 2+ 独立任务并行 |
| `subagent-driven-development` | 当前 session 执行独立任务 |
| `finishing-a-development-branch` | 实现完成准备集成 |
| `cross-cat-handoff` | 跨猫交接/传话 |
| `cat-cafe-requesting-review` | 请求 review |
| `cat-cafe-receiving-review` | 收到 review 反馈 |
| `merge-approval-gate` | 准备合入 main |
| `spec-compliance-check` | 开发完成准备提 review |
| `verification-before-completion` | 声称完成前验证 |
| `feat-discussion` | 讨论功能需求 |

### 5.3 无头模式 (`-p`) 下 Slash Commands 能否工作？

#### 布偶猫 (Claude CLI)

**实测结论: ❌ 不工作**

测试了三个命令:
```bash
env -u CLAUDECODE claude -p "/cost"       # 空输出
env -u CLAUDECODE claude -p "/context"    # 空输出
env -u CLAUDECODE claude -p "/review"     # 空输出 (等待 >30s 无响应后终止)
```

**原因分析**: Slash commands 和 Skills 由 Claude CLI 的交互式 TUI 层处理。`-p` (print) 模式跳过了 TUI，直接将文本作为 prompt 发送给 API。`/cost` 这样的客户端命令被 TUI 拦截处理，不经过 API；`/review` 这样的 Skill 需要 TUI 展开为完整 prompt 后才发送。

**但有一个信号**: `system/init` 事件中 `slash_commands[]` 和 `skills[]` 列表完整暴露了所有可用命令——说明 CLI 在 `-p` 模式下仍然**加载**了这些命令，只是**没有路由**。

#### 缅因猫 (Codex CLI)

Codex 没有 skill 系统，但有独立子命令:

```bash
codex exec review --uncommitted --json    # ✅ 可用！无头模式 review 当前改动
codex exec review --base main --json      # ✅ 可用！review 相对 main 的改动
codex exec review --commit <SHA> --json   # ✅ 可用！review 某个 commit
```

`codex exec review` 是独立子命令，不依赖交互模式。支持 `--json` NDJSON 输出、`--title` 自定义标题、`--model` 模型选择。这是三猫中唯一在无头模式下有内置 review 能力的。

#### 暹罗猫 (Gemini CLI)

Gemini 有完整的 skills 管理:

```bash
gemini skills list                        # 列出所有 skills
gemini skills enable/disable <name>       # 启用/禁用
gemini skills install <source>            # 从 git/本地安装
gemini skills uninstall <name>            # 卸载
```

未实测无头模式 (`-p`) 下 skills 是否自动触发。Gemini CLI 的 `-p` 模式较新 (v0.27.2+)，需要进一步验证。

### 5.4 无头模式 Slash Command 的可能解法

虽然 `-p` 模式下 slash commands 不直接工作，但我们有几条路:

1. **Skill 展开后注入**: 在 Cat Café 侧读取 `~/.claude/skills/<name>/SKILL.md`，手动展开为 prompt 文本，再传给 `-p`
2. **Codex review 子命令**: 直接可用，只需在 `CodexAgentService` 中增加 `review()` 方法
3. **利用 `system/init` 数据**: 即使不能调用，也能知道"有什么可用"，驱动 F12 功能发现
4. **MCP 工具替代**: 很多 slash command 的功能可以通过 MCP 工具实现 (Cat Café 已有 MCP callback 机制)

---

## 6. 数据流架构：从 CLI 到前端

当前数据流:

```
CLI NDJSON 流
  → *AgentService.ts (transform: 大量 return null)
    → AgentMessage (type/catId/content/metadata)
      → AgentRouter (yield to route-strategies)
        → WebSocket (推送到前端)
          → chatStore (更新状态)
            → UI 组件 (渲染)
```

关键瓶颈在 **transform 函数**——这是宝藏被丢弃的地方:

| 文件 | 函数 | 丢弃了什么 |
|------|------|-----------|
| `ClaudeAgentService.ts:191` | `transformClaudeEvent()` | `result/success` 全部数据 |
| `ClaudeAgentService.ts:97` | (message_start handler) | `message.usage` |
| `codex-event-transform.ts:53` | `transformCodexEvent()` | `turn.completed`, `reasoning`, `turn.failed` |
| `GeminiAgentService.ts:121` | `transformGeminiEvent()` | `result/success` stats |

---

## 7. 被丢弃的宝藏汇总

### 7.1 立即可用（F8 核心）

| 数据 | 来源猫 | 当前状态 | 价值 |
|------|--------|---------|------|
| Token 用量 (input/output) | 布偶猫 + 缅因猫 | ❌ 丢弃 | F8 核心指标 |
| Token 用量 (total) | 暹罗猫 | ❌ 丢弃 | F8 fallback 指标 |
| 实际花费 (USD) | 布偶猫 | ❌ 丢弃 | 成本监控 |
| 缓存命中率 | 布偶猫 + 缅因猫 | ❌ 丢弃 | 性能优化指引 |
| API 耗时 / 总耗时 | 布偶猫 | ❌ 丢弃 | CLI 开销量化 |
| 上下文窗口大小 | 布偶猫 | ❌ 丢弃 | 动态 budget 上限 |
| 调用轮数 | 布偶猫 | ❌ 丢弃 | 复杂度指标 |

### 7.2 体验增强

| 数据 | 来源猫 | 当前状态 | 价值 |
|------|--------|---------|------|
| 缅因猫思考链 (reasoning) | 缅因猫 | ❌ 丢弃 | 类 thinking block 展示 |
| 文件变更路径详情 | 缅因猫 | 部分 (只取 count) | 精确展示改了哪些文件 |
| 权限拒绝记录 | 布偶猫 | ❌ 丢弃 | 安全审计 |
| 服务端工具使用统计 | 布偶猫 | ❌ 丢弃 | web_search/web_fetch 次数 |
| turn.failed 失败原因 | 缅因猫 | ❌ 丢弃 | 错误分类分析 |

### 7.3 基础设施 / 元信息

| 数据 | 来源猫 | 当前状态 | 价值 |
|------|--------|---------|------|
| 可用工具列表 | 布偶猫 | ❌ 丢弃 | 运行时能力发现 |
| MCP 连接状态 | 布偶猫 | ❌ 丢弃 | 健康检查面板 |
| Skills 列表 | 布偶猫 | ❌ 丢弃 | F12 功能发现 |
| CLI 版本 | 布偶猫 | ❌ 丢弃 | 兼容性追踪 |
| 插件列表 | 布偶猫 | ❌ 丢弃 | 能力可见性 |
| 服务层级 (service_tier) | 布偶猫 | ❌ 丢弃 | 标注当前服务等级 |

---

## 8. 三猫数据丰富度对比

```
布偶猫 (Claude)  ████████████████████████████████  ★★★★★  最丰富
缅因猫 (Codex)   ████████████████████             ★★★★   独有 reasoning
暹罗猫 (Gemini)  ████████                         ★★     最简陋
```

| 维度 | 布偶猫 | 缅因猫 | 暹罗猫 |
|------|:------:|:------:|:------:|
| input/output 拆分 | ✅ | ✅ | ❌ (仅 total) |
| 缓存 token 统计 | ✅ (含 5m/1h 分类) | ✅ (cached_input) | ❌ |
| 花费 (USD) | ✅ | ❌ | ❌ |
| 耗时 (ms) | ✅ (total + API) | ❌ | ❌ |
| 上下文窗口大小 | ✅ | ❌ | ❌ |
| 思考链 | ❌ (thinking 不在 NDJSON) | ✅ (reasoning) | ❌ |
| 文件变更详情 | ❌ (用 MCP) | ✅ (path + kind) | ❌ |
| 能力清单 | ✅ (tools/skills/plugins) | ❌ | ❌ |
| 重连/失败诊断 | ❌ | ✅ (error + turn.failed) | ❌ |

---

## 9. 后续行动建议

1. **F8 Token 预算 + 深度可观测性** — 提取 usage 数据，迁移 char→token，开采 NDJSON 宝藏。详见 [F8 Plan](../plans/2026-02-12-f8-token-budget-migration.md)
2. **Codex reasoning 展示** — 在前端增加 thinking/reasoning block 折叠展示
3. **system/init 数据捕获** — 为 F12 功能发现提供数据源
4. **Codex exec review 集成** — 利用无头 review 能力做自动 code review
5. **无头 Skill 调用研究** — 探索手动展开 SKILL.md → prompt 注入的可行性
