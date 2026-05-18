# OpenHuman Architecture Map v1（第一波）

> 数据快照：HEAD `db087a7d3` / v0.53.49-staging
> 范围：模块拓扑 / entrypoints / state stores / extension points / 空目录 & placeholder 信号
> 状态：第一波拓扑（基于 ls + Glob + 重点 Read），未做 RPC 调用图（Step 2 任务）

## 仓库顶层布局

```
openhuman/
├── Cargo.toml                  # 单 crate "openhuman" + 2 个 bin（openhuman-core / slack-backfill / gmail-backfill-3d）
├── src/                        # Rust core 业务逻辑 + RPC 服务器
│   ├── main.rs                 # bin entrypoint：Sentry init → 委托 lib
│   ├── lib.rs                  # 应该 re-export openhuman_core（未读，第一波 skip）
│   ├── bin/                    # 一次性 backfill 工具
│   ├── core/                   # JSON-RPC dispatcher / event_bus / observability
│   └── openhuman/              # 66 个顶级业务模块（详见下表）
├── app/                        # Tauri 桌面壳（TS/TSX）
│   ├── src-tauri/              # Tauri Rust 桥
│   │   └── src/                # cdp / core_process / core_rpc / dictation_hotkeys
│   │       │                   #   / native_notifications / screen_capture
│   │       │                   #   + 7 个 native scanner（slack/telegram/whatsapp/meet/imessage/gmessages/discord）
│   │       └── src/lib/        # TS 前端业务
└── gitbooks/                   # 文档站
```

## src/openhuman/ 66 个顶级模块（按功能聚类）

```
[Memory & 知识]
  memory/                     ← Memory trait + UnifiedMemory + store/agentmemory backend
  tree_summarizer/            ← LLM 层级摘要引擎（hour → day → month → year → root），610 行 engine.rs
  vault/                      ← Obsidian wiki 文件系统侧
  embeddings/                 ← embedding provider abstraction
  context/                    ← prompt 上下文组装

[Agent harness & 多 agent]
  agent/
    agents/{archivist, code_executor, critic, crypto_agent, help,
            integrations_agent, morning_briefing, orchestrator, planner,
            researcher, skill_creator, summarizer, tool_maker, tools_agent,
            trigger_reactor, trigger_triage, welcome}          # 17 个内置 agent
    harness/{session, subagent_runner, ...}                    # session 状态机 + subagent
    bus.rs / dispatcher.rs / cost.rs                            # 总线/调度/计费

[Tools 层]
  tools/                      ← Tool trait + impl/memory/{recall,store,forget,tree/*}
  tool_registry/              ← tool 注册与查找
  tool_timeout/               ← 工具调用超时管理
  mcp_client/  mcp_server/    ← MCP 双向：作为 client 也作为 server
  skills/                     ← skill 加载（agent/skill_creator 配对）

[Token & 推理]
  tokenjuice/                 ← Rust port of vincentkoc/tokenjuice（纯规则压缩，928 行 reduce.rs）
  inference/                  ← provider 抽象（OpenAI/Anthropic/Ollama）
  routing/                    ← model routing（reasoning/fast/vision）

[集成 & 桌面体验]
  integrations/               ← 118+ OAuth catalog
  channels/                   ← inbound/outbound messaging（matrix-sdk optional）
  meet/  meet_agent/          ← Google Meet 桌面 agent
  voice/  audio_toolkit/      ← Whisper STT + ElevenLabs TTS（whisper-rs + cpal + hound + enigo）
  accessibility/              ← macOS Accessibility API + 全局热键 + 屏幕焦点
  screen_intelligence/        ← 屏幕识别
  text_input/  overlay/       ← 桌面交互层
  notifications/              ← OS 原生通知
  people/                     ← Contacts 框架（objc2-contacts macOS）
  webview_*/                  ← 多 webview 进程（accounts/apis/notifications）

[基础设施]
  app_state/  config/  service/  http_host/  socket/
  cron/  scheduler_gate/      ← 定时任务 + 调度门禁（battery / 网络感知节流）
  heartbeat/                  ← 后台心跳
  subconscious/               ← 后台 LLM 工作（presumably proactive）
  encryption/  security/      ← aes-gcm / argon2 / chacha20poly1305 / ring
  credentials/                ← 凭据管理
  health/  doctor/            ← 系统自检
  prompt_injection/           ← prompt injection 防御
  approval/                   ← 用户审批流（敏感操作）

[runtime 引导]
  runtime_node/               ← 内嵌 Node.js（tar.xz / zip 解压）
  runtime_python/             ← 内嵌 Python
  javascript/                 ← JS 执行环境

[业务功能]
  todos/  threads/  workspace/  team/
  billing/  cost/  wallet/    ← 多套计费/钱包（包含 ethers / 加密钱包）
  composio/                   ← Composio 集成（第三方 agent 工具市场）
  webhooks/  redirect_links/
  referral/                   ← 邀请奖励
  whatsapp_data/              ← WhatsApp 数据持久化
  update/                     ← 自动更新
  autocomplete/               ← 输入补全
  learning/                   ← stability_detector + config schema（**无 RL/reward 算法**）
  test_support/               ← 测试辅助（启用 e2e-test-support feature 才暴露）

[迁移]
  migration/  migrations/     ← DB schema 演进（两份）
```

## Entry points（程序入口）

| Entry | 文件 | 用途 |
|-------|------|------|
| `openhuman-core` bin | `src/main.rs` | 主进程：Sentry init → JSON-RPC 服务器 |
| `slack-backfill` bin | `src/bin/slack_backfill.rs` | 一次性 Slack 历史回填 |
| `gmail-backfill-3d` bin | `src/bin/gmail_backfill_3d.rs` | Gmail 3 天回填 |
| `openhuman_core` rlib | `src/lib.rs` | 给 Tauri / 测试用的库入口 |
| Tauri app | `app/src-tauri/src/main.rs` | 桌面进程，IPC 到 openhuman-core |

## State stores（数据持久化位置）

| Store | 路径 / 模块 | 内容 |
|-------|-----------|------|
| **Memory Tree DB** | `<workspace>/memory_tree/chunks.db`（rusqlite bundled） | chunks / scores / summaries / entity index / jobs / hotness |
| **Obsidian Vault** | `<workspace>/wiki/` | canonical Markdown 文件（user-readable） |
| **agentmemory backend** | `http://localhost:3111`（optional opt-in） | trait-level memory，REST 代理到 rohitg00/agentmemory |
| **PostgreSQL** | 通过 `postgres` crate | 后端 metadata（用途待查 Step 2） |
| **Job queue** | 同 chunks.db | 6 种 job kind + retry/dedupe/scheduling |
| **Whisper models** | 本地缓存 | STT（whisper-rs + metal feature on macOS） |
| **Node.js runtime** | runtime_node 解压目标 | 内嵌 Node 二进制 |
| **TokenJuice rules** | 三层叠加：vendored / `~/.config/tokenjuice/rules/` / `.tokenjuice/rules/` | JSON 规则 |
| **Sentry** | DSN `OPENHUMAN_CORE_SENTRY_DSN` | 错误追踪（after `before_send` 多层过滤） |

## Extension points（外部可插拔）

| Point | 机制 | 状态 |
|-------|------|------|
| **Memory backend** | `MemoryConfig.backend = "sqlite" | "agentmemory"` | sqlite 默认；agentmemory 真插件 |
| **MCP server** | `mcp_server/` | 暴露 OpenHuman tools 给外部 MCP client |
| **MCP client** | `mcp_client/` | 消费外部 MCP servers |
| **Composio integration** | `composio/` | 第三方 agent 工具市场（118+ 中相当一部分可能走这） |
| **Local model** | Ollama via `routing/` + `inference/` | 可选 on-device LLM（embeddings / summarization） |
| **Channels (matrix-sdk)** | `channels-matrix` feature | optional cargo feature |
| **WhatsApp Web** | `whatsapp-web` feature | optional cargo feature（不开默认，依赖 whatsapp-rust 0.5） |
| **Browser native** | `browser-native`/`fantoccini` feature | optional 真浏览器自动化 |
| **PDF extract** | `rag-pdf`/`pdf-extract` feature | optional PDF RAG |
| **Sandbox** | `sandbox-landlock` (Linux) / `sandbox-bubblewrap` | optional 沙箱 |
| **Raspberry Pi** | `peripheral-rpi` feature | optional Pi 外设 |
| **TokenJuice rules** | 三层 overlay（builtin/user/project） | 用户/项目可加自定义规则 |
| **Skills** | `skills/` + `agent/agents/skill_creator/` | agent 可生成新 skill |
| **Tool maker** | `agent/agents/tool_maker/` | agent 可创建新工具（self-modifying tool surface） |

## 可疑信号 & placeholder（第一波扫到的）

| 信号 | 位置 | 解读 |
|------|------|------|
| `learning/` 模块只有 stability_detector + config schema | `src/openhuman/learning/` | **README 没 claim self-learning，但 Hermes 对比给了 "✅ Self-learning"**。learning 是 hook 不是算法，符合 README claim；只是要注意 marketing 表格语义 |
| `test_support/` feature 受 `e2e-test-support` feature gate | `Cargo.toml` L185-188 | "destructive `openhuman.test_reset` RPC, shipped binaries never have this feature" — 工程上好实践 |
| 两份 migration 目录：`migration/` 和 `migrations/` | `src/openhuman/` | 命名重复，可能历史包袱 |
| `subconscious/` 名字玄学但未读 | `src/openhuman/subconscious/` | 推测是 idle 时 background LLM 工作；Step 2 必读 |
| `wallet/` + `ethers-core` + `ethers-signers` | `Cargo.toml` L135-136 | 项目有加密钱包组件，跟 AI agent 主线关系待查 |
| `subagent_runner/` 在 harness 下 | `src/openhuman/agent/harness/subagent_runner/` | subagent 派遣机制，跟我们 Agent tool 对应 |
| `prompt_injection/` 独立模块 | `src/openhuman/prompt_injection/` | 防御层，工程严谨度 + 1 |

## 与 Cat Café 模块对应表（粗对照，仅作 Step 5 的 prework）

| OpenHuman 模块 | Cat Café 对应 | 第一波体感 |
|---------------|--------------|----------|
| `tree_summarizer/` | 我们 F102 memory 层 + F200 ranking | 他们用 hour → day → month → year → root **时间轴**层级；我们用 thread/anchor + spec/doc 多类型 |
| `tools/impl/memory/tree/{6 primitives}` | 我们 search_evidence / graph_resolve / list_recent **三入口** | 他们 6 个 entity-first；我们 3 个 navigation-first |
| `tokenjuice/` | 我们没有 tool output 压缩层 | **Gap**：我们值得评估（参考上游 vincentkoc/tokenjuice） |
| `learning/` | 我们 F200 recall eval | **Do Not Follow（他们）/ Keep（我们）**：他们没做 eval，我们做了 |
| `agent/agents/*` 17 个 prompt-only agent | 我们三猫 + L0 system prompt | 他们 prompt 多 agent；我们 model 多 agent + 跨族 review |
| `prompt_injection/` | 我们 W3 守鼓 + sanitize | 对照学习点 |
| `subagent_runner/` | 我们 Agent tool + subagent_type | 对应 |
| `composio/` | 我们 MCP integrations | 他们用 Composio 外包工具市场；我们走 MCP |
| `meet/` + `meet_agent/` | 我们 enterprise-workflow skill | 他们做 Meet 真参与；我们只做日程/待办 |

## 第一波遗留问题（带去 Step 2）

1. **Hot path 真实代码位置** — `memory_tree_ingest` RPC handler / chunker / fast-score 在哪
2. **Hotness 算法** — topic tree 物化阈值是 LLM judge 还是规则
3. **scheduler_gate 真实门禁** — battery / 网络 / 后台 idle 的实际触发逻辑
4. **subconscious 模块** — idle background LLM 跟 memory pipeline 的耦合
5. **TokenJuice 实测压缩比** — `tokenjuice_integration.rs` 测试数据
6. **agentmemory 真实数据流** — 选 agentmemory 后 memory tree 是继续独立运行还是协同
7. **17 个内置 agent** — 是 prompt 模板还是有独立调度状态机
8. **inference/routing 真实策略** — "Model routing 自动派" 的判断函数
