# March-CLI Architecture Map

源码快照：`4043909` (2026-05-19)

## Directory Tree

```
march-cli/                          # monorepo root
├── apps/
│   ├── server/src/                 # Group Chat MVP 后端（Node.js HTTP + SSE）
│   │   ├── server.mjs              # HTTP server, port 4317
│   │   ├── orchestrator.mjs        # Agent 生命周期编排 + 轮询
│   │   ├── db.mjs                  # SQLite WAL, 13 张表
│   │   ├── event-bus.mjs           # 内存 SSE broker（per-group, 500 event ring buffer）
│   │   ├── context.mjs             # XML-based agent context builder
│   │   ├── provider-auth.mjs       # Token 解析（env:* / auth:acct_*）
│   │   ├── subscription-connectors.mjs  # GitHub/GitLab/Sentry 轮询
│   │   └── *-smoke.mjs             # 13 个 smoke test
│   ├── web/                        # Vanilla JS SPA（无构建步骤）
│   │   ├── app.js                  # ~90KB, SSE 客户端 + 全功能 UI
│   │   ├── index.html              # Semantic HTML + CSS Grid
│   │   └── styles.css              # ~30KB, dark theme
│   └── web-react/dist/             # React 前端（仅编译产物，源码不在仓内）
│
├── march-cli/                      # 核心 CLI agent（主体）
│   ├── bin/march.mjs               # CLI 入口 → src/main.mjs
│   ├── src/
│   │   ├── main.mjs                # 初始化 config/auth/memory/runner
│   │   ├── agent/
│   │   │   ├── runner.mjs          # createRuntimeRunner()：model registry, provider, payload dump
│   │   │   ├── tools.mjs           # createMarchCustomTools()：工具组装工厂
│   │   │   ├── command-exec-tool.mjs  # 命令执行（60s timeout, 64KB output cap, tree kill）
│   │   │   ├── file-edit-tool.mjs  # 文件编辑（patch/write/overwrite 三模式）
│   │   │   ├── tool-summary.mjs    # Tool 执行摘要格式化
│   │   │   ├── turn/
│   │   │   │   ├── turn-runner.mjs # Turn 编排：prompt → model call → tool exec → finalize
│   │   │   │   └── turn-events.mjs # Turn 事件状态机 + compactAssistantContext()
│   │   │   ├── runner/             # Session lifecycle
│   │   │   ├── runtime/            # Process/IPC
│   │   │   ├── editing/            # Diff formatting, LSP diagnostics
│   │   │   ├── file-tools/         # Read/write operations
│   │   │   ├── provider/           # Payload transformation + model registry
│   │   │   ├── session/            # Session binding
│   │   │   └── vision-capability.mjs
│   │   ├── cli/
│   │   │   ├── repl-loop.mjs       # REPL 主循环：readline → recall → turn
│   │   │   ├── tui/                # TUI 渲染、语法高亮、鼠标输入
│   │   │   ├── input/              # 快捷键、历史、自动完成
│   │   │   ├── shell/              # Split layout
│   │   │   └── startup/            # Session resume
│   │   ├── context/
│   │   │   ├── engine.mjs          # ContextEngine：6 层 context + turn history（max 15, trim 5）
│   │   │   ├── system-core/        # 按模型分化的 system prompt（base.md, deepseek.md 等）
│   │   │   ├── session-status.mjs
│   │   │   ├── injections.mjs      # MCP server instructions
│   │   │   ├── project-context.mjs
│   │   │   └── profiles.mjs        # ~/.march/profiles/ 用户配置
│   │   ├── memory/
│   │   │   ├── markdown-store.mjs  # MarkdownMemoryStore：scan/recall/save/delete/search
│   │   │   ├── markdown-tools.mjs  # 暴露给 agent 的 4 个 memory tools
│   │   │   ├── markdown/
│   │   │   │   ├── markdown-format.mjs  # Frontmatter 解析、tag 规范化、ID 生成
│   │   │   │   ├── markdown-recall.mjs  # scoreEntry()、formatRecallHints()
│   │   │   │   ├── sqlite-index.mjs     # FTS5 索引维护
│   │   │   │   ├── ripgrep.mjs          # rg 全文搜索
│   │   │   │   └── markdown-delete.mjs  # 软删除
│   │   │   └── graph/              # Knowledge graph（级联、诊断、路径移除）
│   │   ├── mcp/
│   │   │   ├── index.mjs           # MCP 初始化 + server discovery
│   │   │   └── tools.mjs           # MCP → March tool 转换（mcp__{server}__{tool}）
│   │   ├── session/
│   │   │   ├── pi-manager.mjs      # Pi session 存储（~/.march/pi-sessions/）
│   │   │   └── sidecar-sync.mjs    # Engine state → JSON sidecar 同步
│   │   ├── shell/                  # PTY adapter + terminal tools
│   │   ├── lsp/                    # Language server client
│   │   ├── web/                    # Web search tools
│   │   └── supergrok/              # Image gen, search, OAuth
│   ├── test/                       # 150+ smoke/acceptance tests
│   ├── docs/                       # 系统文档
│   │   ├── markdown-memory-system.md
│   │   ├── context-core.md
│   │   └── custom-provider.md
│   ├── reference-prompts/          # Vendored: Claude Code system prompts（~30 files）
│   ├── AGENTS.md                   # Codex agent instructions
│   └── package.json
│
├── packages/
│   ├── march-core/src/             # env.mjs（.env parser）, ids.mjs（ID 生成）
│   ├── march-tools/src/            # git.mjs（worktree 管理）, path-guard.mjs（路径安全）
│   └── pi-adapter/src/index.mjs    # MarchPiAdapter：Pi SDK 桥接层
│
├── poc/pi-adapter/                 # PoC：验证 Pi 作为无状态执行层
├── scripts/                        # 构建/部署脚本
├── group-chat-model-brainstorm.md  # 589 行设计文档（68+ 轮讨论）
└── package.json                    # monorepo root（deps: pi-ai, pi-coding-agent, MCP SDK, typebox）
```

## Entrypoints

| 入口 | 路径 | 协议 |
|------|------|------|
| CLI | `march-cli/bin/march.mjs` → `src/main.mjs` | stdio（REPL/单次 prompt） |
| HTTP Server | `apps/server/src/server.mjs` | HTTP + SSE (port 4317) |
| Smoke Tests | `apps/server/src/*.mjs` | Node.js test scripts |

## State Stores

| 存储 | 类型 | 路径 | 持久性 |
|------|------|------|--------|
| SQLite DB | 关系数据 | `.tmp/march-state/dev/march.db` | 持久（WAL mode） |
| Event Bus | Ring Buffer | 内存 | 易失（max 500 events/group） |
| Memory Files | Markdown + FTS5 | `{memory_root}/March Memories/**/*.md` | 持久 |
| FTS5 Index | SQLite | `{memory_root}/.march-memory-index.sqlite` | 可重建 |
| Pi Sessions | JSON | `~/.march/pi-sessions/` | 持久 |
| Sidecar Sync | JSON | session 文件旁 | 可重建 |
| Agent Logs | JSONL | `.march/{user}/agent_logs/{agent_id}/{turn_id}.jsonl` | 持久 |
| Working Draft | DB column | `group_members.draft` | DB 持久 + SSE 推送 |

## Extension Points

| 扩展点 | 机制 | 代码 |
|--------|------|------|
| Tool Registry | `createMarchCustomTools()` 组装数组 | `march-cli/src/agent/tools.mjs` |
| MCP Servers | 标准 MCP 协议发现 + 转换 | `march-cli/src/mcp/` |
| Custom Providers | `registerCustomProviders()` | `march-cli/src/agent/runner.mjs` |
| Profile Layers | `~/.march/profiles/*.md` | `march-cli/src/context/profiles.mjs` |
| Subscription Connectors | `pollConnector` 接口 | `apps/server/src/subscription-connectors.mjs` |
| Framework Proposals | Agent 提议 → 用户审批 | `apps/server/src/db.mjs` |

## Data Flow

### CLI 单轮 Turn

```
User Input
  ↓
repl-loop.mjs: memoryStore.recallForUser(prompt)  ──→  memory_hint (max 3)
  ↓
engine.buildProviderContext(userMessage)
  ├── system_core          (stable, prefix-cacheable)
  ├── injections           (MCP server instructions)
  ├── session_identity     (workspace metadata)
  ├── project_context      (README, .gitignore)
  ├── profiles             (~/.march/profiles/)
  └── recent_chat          (compacted turn history + memory hints + current user)
  ↓
turn-runner.mjs: resetPiMessageHistory()  ←── 清空 Pi 的 raw messages
  ↓
Pi SDK: session.prompt(full_context)  ──→  LLM call
  ↓
  ├── tool_execution_start → flushAssistantRecall(thinking+draft delta)
  │                            → memory_hint 注入 (deliverAs: "steer")
  ├── tool_execution_end   → tool summary appended to context parts
  └── message_update       → draft accumulation
  ↓
finalizeTurn()
  ├── compactAssistantContext(turnState)  ──→  压缩的 assistant 上下文
  ├── engine.recordTurn(compact)          ──→  保存到 turn history
  └── syncCurrentPiSidecar()              ──→  持久化 engine state
```

### Group Chat Server 编排

```
Event Source (User Message / Alarm / Subscription)
  ↓
orchestrator.mjs: activateGroup()
  ├── ensureWorktree() per agent
  ├── buildAgentContext() ──→ group metadata + framework + messages + rules
  └── Promise.all(agents.map(runTurn))
       ↓
       MarchPiAdapter.runTurn()
         ├── Pi session with March tools
         ├── tool events → tool_events table
         ├── draft updates → DB + SSE broadcast
         └── final message → group_messages + SSE
```

## Key Dependencies

| Package | Version | Role |
|---------|---------|------|
| `@mariozechner/pi-ai` | ^0.73.0 | Pi AI 基础 SDK |
| `@mariozechner/pi-coding-agent` | ^0.73.0 | Pi coding agent（LLM 执行层） |
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP 标准协议 |
| `typebox` | ^1.0.58 | JSON Schema 运行时类型 |
| `@playwright/test` | ^1.59.1 | E2E 测试（devDep） |
| `node:sqlite` | built-in | SQLite WAL（Node.js 原生） |

## Suspicious / Notable

1. **web-react 只有编译产物** — `apps/web-react/dist/` 有 CSS/JS/HTML 但无源码
2. **Brainstorm 大量未实现** — `group-chat-model-brainstorm.md`（589 行）描述的 shadow prompt / DAG task / subscription routing 等未落地
3. **Deepseek 硬编码** — MVP server 默认 `deepseek-v4-flash`，provider abstraction 表存在但 auth refresh 未实现
4. **vendored Claude Code prompts** — `march-cli/reference-prompts/claude-code-system-prompts/` 包含完整 CC system prompt 合集，用于参考/学习
5. **Pi SDK 紧耦合** — 执行层完全依赖 `@mariozechner/pi-coding-agent`，换 provider 需要同时换 SDK
6. **Memory graph 模块存在** — `march-cli/src/memory/graph/` 有级联/诊断/路径操作，暗示比 tag recall 更复杂的知识图谱能力（待深挖）
