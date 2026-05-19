---
doc_kind: research-note
topics: [slock-ai, open-source-teardown, agent-collaboration, multi-agent, daemon]
created: 2026-05-14
status: draft
source_repo: https://github.com/botiverse/slock (private; analyzed via npm @slock-ai/daemon@0.48.0)
source_commit: npm published 2026-05-12
refresh_note: Codex addendum checked npm @slock-ai/daemon@0.50.0 on 2026-05-19
authored_by: opus-46
covers: [architecture, star-features, algorithms, comparison]
---

# Slock.ai Deep Dive

> "Where humans and AI agents build together"

> **2026-05-19 Codex refresh**: npm latest moved from `0.48.0` to
> `0.50.0`. See
> [codex-addendum-2026-05-19.md](./codex-addendum-2026-05-19.md) for the
> version delta and Cat Cafe comparison update.

## 0. Scope

- **User question**: "slock这个项目 来吧 按照我们家的skills拆解看看"
- **Project**: Slock.ai — 多 Agent 协作平台（人 + AI agents 在 channel 里实时协作）
- **Source**: GitHub `botiverse/slock`（private repo）; 分析基于 npm `@slock-ai/daemon@0.48.0`
- **Published**: 2026-05-12 | Maintainers: richardchien, xxchan, tennyzhuang
- **npm packages**: `@slock-ai/daemon`（核心）, `@slock-ai/computer`（0.0.1-play preview）
- **License**: Proprietary
- **Website**: https://slock.ai/
- **Claims to verify**: 见 §1

### 不是那个 slock

suckless.org 的 slock 是一个 542 行 C 语言的 X11 屏幕锁。此报告分析的是 **Slock.ai**——完全不同的项目。

## 1. Claim Ledger

| # | Claim | Source | Evidence | Verdict | Caveat |
|---|-------|--------|----------|---------|--------|
| C1 | "人和 AI agents 作为 teammates 协作" | 官网 | System prompt 注入 channel/DM/thread 概念；agent 和 human 都是 server member | **TRUE** | 协作 UX 接近 Slack/Discord，不是 IDE 集成 |
| C2 | Task Claim 防冲突 | CodePick 评测 | `slock task claim` 系统级强制；claim 失败 → 必须跳过（system prompt 硬规则） | **TRUE** | 乐观锁模型，非分布式事务 |
| C3 | 每个 agent 有 MEMORY.md 持久记忆 | CodePick | `AgentProcessManager.startAgentNow()` 在 agent data dir 创建 `MEMORY.md` + `notes/` | **TRUE** | 纯文件记忆，无向量/语义检索，无 knowledge feed |
| C4 | Daemon 架构，代码不出机器 | 官网 | `npx @slock-ai/daemon` 本地运行；WebSocket 连 Slock cloud 只传消息/tracing | **TRUE** | 云端 trace upload 存在；agent 进程本地但通信经 Slock 服务器 |
| C5 | 支持多种 AI runtime | 推断 | Driver registry: claude / codex / copilot / cursor / gemini / kimi / opencode（7 种） | **TRUE** | 每个 driver 都有独立的 spawn/probe/parseLine 实现 |
| C6 | MCP 集成 | npm deps | `@modelcontextprotocol/sdk ^1.29.0`; chat-bridge 是 MCP server（stdio transport） | **TRUE** | 正在从 MCP tools 迁移到 CLI（`deprecatedMcpShim.ts`）|
| C7 | Thread 隔离 | CodePick | System prompt 详细规定 thread target 格式（`#channel:shortid`）、不能嵌套 thread | **TRUE** | 路由靠 target string 解析，无独立 thread 状态机 |

## 2. Architecture Map

### 系统拓扑

```
┌──────────────────── Local Machine ────────────────────┐
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              DaemonCore (Node.js)                │   │
│  │                                                  │   │
│  │  ┌──────────────────┐  ┌───────────────────┐    │   │
│  │  │ AgentProcessMgr  │  │  DaemonConnection │    │   │
│  │  │                  │  │                   │    │   │
│  │  │  agents: Map     │  │  WebSocket ──────────────→ Slock Cloud
│  │  │  startQueue      │  │  reconnect logic  │    │   │   (SaaS)
│  │  │  idleConfigs     │  │  watchdog 70s     │    │   │
│  │  └────┬─────────────┘  └───────────────────┘    │   │
│  │       │ spawn                                    │   │
│  │  ┌────┴────────────────────────────────────┐     │   │
│  │  │          Driver Registry                 │     │   │
│  │  │  claude | codex | copilot | cursor       │     │   │
│  │  │  gemini | kimi  | opencode               │     │   │
│  │  └────┬────────────────────────────────────┘     │   │
│  │       │ child_process.spawn                      │   │
│  │  ┌────┴──────────┐ ┌────────────┐               │   │
│  │  │ Claude Code   │ │ Codex CLI  │  ...           │   │
│  │  │ (stream-json) │ │ (threads)  │               │   │
│  │  │               │ │            │               │   │
│  │  │ ┌───────────┐ │ │ ┌────────┐ │               │   │
│  │  │ │chat-bridge│ │ │ │chat MCP│ │               │   │
│  │  │ │(MCP stdio)│ │ │ │ server │ │               │   │
│  │  │ └───────────┘ │ └─┴────────┘─┘               │   │
│  │  └───────────────┘                               │   │
│  │                                                  │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │   │
│  │  │Workspaces│  │MachineLock│  │ LocalTrace    │  │   │
│  │  │(data dir)│  │(单机独占) │  │ Sink → Upload │  │   │
│  │  └──────────┘  └───────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ~/.slock/                                             │
│  ├── agents/{agentId}/                                 │
│  │   ├── MEMORY.md                                     │
│  │   ├── notes/                                        │
│  │   └── .slock/ (runtime files)                       │
│  └── ...                                               │
└────────────────────────────────────────────────────────┘
```

### 源码模块地图（从 bundle comment 还原）

```
@slock-ai/daemon (packages/daemon)
├── src/
│   ├── core.ts                 DaemonCore — 总指挥
│   ├── connection.ts           WebSocket + reconnect + watchdog
│   ├── agentProcessManager.ts  进程生命周期管理（启动队列/rate limit/idle restart）
│   ├── workspaces.ts           workspace 数据目录管理
│   ├── machineLock.ts          单机独占锁
│   ├── reminderCache.ts        定时提醒缓存
│   ├── runtimeErrorDiagnostics.ts  运行时错误诊断
│   ├── localTraceSink.ts       本地 trace 落盘
│   ├── traceBundleUpload.ts    trace 上传云端
│   ├── directUploadCapability.ts  文件上传
│   ├── traceJitter.ts          trace 时间抖动
│   ├── chat-bridge.ts          MCP Server (stdio) — agent 通信桥
│   ├── deprecatedMcpShim.ts    MCP → CLI 迁移垫片
│   └── drivers/
│       ├── index.ts            Driver registry (7 runtimes)
│       ├── claude.ts           Claude Code driver
│       ├── codex.ts            OpenAI Codex driver
│       ├── copilot.ts          GitHub Copilot driver
│       ├── cursor.ts           Cursor driver
│       ├── gemini.ts           Gemini driver
│       ├── kimi.ts             Kimi driver
│       ├── opencode.ts         OpenCode driver
│       ├── cliTransport.ts     CLI transport 通用层
│       ├── systemPrompt.ts     System prompt builder
│       └── probe.ts            Runtime 探测

@slock-ai/shared (packages/shared)
└── src/tracing/index.ts        OpenTelemetry-compatible tracing primitives

@slock-ai/cli (packages/cli)
└── (内嵌到 daemon dist/cli/)   slock CLI wrapper
```

### 关键属性

| 属性 | 值 |
|------|-----|
| **Entrypoints** | `slock-daemon` CLI → DaemonCore.start() |
| **State stores** | `~/.slock/agents/{id}/` 文件系统（MEMORY.md + notes/）; 无 DB |
| **Extension points** | Driver interface（每个 runtime 一个 driver 实现）; MCP tool 注入 |
| **Config mechanism** | CLI args + env vars（`SLOCK_HOME_ENV` 等）; 无 runtime config file |
| **Communication** | WebSocket（daemon ↔ cloud）; stdio stream-json（daemon ↔ agent）; MCP/CLI（agent ↔ chat） |
| **Auth** | daemon API key → WebSocket query param（`?key=...`） |
| **Concurrency control** | Agent start queue + rate limiter + machine lock |
| **Observability** | OpenTelemetry-compatible spans; local trace + cloud upload |

## 3. Star Feature Deep Dives

### 3.1 Multi-Runtime Driver System

**Claim**: 支持 7 种 AI runtime 作为 agent backend

**代码路径**:
```
DaemonCore → AgentProcessManager.startAgentNow()
  → driverResolver(config.runtime || "claude")  // default: claude
    → driverFactories[runtimeId]()               // L3530-3538
      → driver.probe()                            // 检测本机是否安装
      → driver.buildSystemPrompt()                // 注入 Slock 协作上下文
      → driver.spawn(ctx)                         // child_process.spawn
```

**每个 Driver 的 spawn 策略**:

| Runtime | 进程类型 | 通信模式 | Busy Delivery | 安全模式 |
|---------|----------|----------|---------------|----------|
| Claude | persistent/gated stdin | slock CLI + MCP | gated（等 stream-json 安全边界） | `--dangerously-skip-permissions` |
| Codex | persistent/direct stdin | slock CLI + MCP | direct | `sandbox: "danger-full-access"` |
| Copilot | persistent | slock CLI + MCP | gated | — |
| Cursor | persistent | slock CLI + MCP | gated | — |
| Gemini | persistent | slock CLI + MCP | direct | — |
| Kimi | persistent | slock CLI + MCP | direct | — |
| OpenCode | persistent | slock CLI + MCP | gated | — |

**State mutation**: Driver 创建 agent data dir（`~/.slock/agents/{id}/`），写 MEMORY.md、system prompt 文件、MCP config 文件。

**Verdict**: 这是 Slock 的核心竞争力。Driver 抽象干净——每个 runtime 只需实现 `probe()`, `spawn()`, `parseLine()`, `buildSystemPrompt()`。7 个 driver 实际代码从 150-400 行不等。

### 3.2 System Prompt Injection

**Claim**: Agent 开机就"知道"怎么在 Slock 里协作

**代码路径**: `systemPrompt.ts` → `buildPrompt(config, variant, opts)` → 注入到 driver 的 system prompt

**注入内容（~1200 行模板）**:
1. Runtime context（agentId, serverId, machine info）
2. Communication 规则（CLI 24 个命令 或 MCP tools）
3. Startup steps（5 步启动序列）
4. Critical rules（必须用 slock 通信、必须 claim before work）
5. Threading/channels/tasks 完整协议
6. Reminders 系统
7. Private channel 隐私规则

**Verdict**: 这是真正的"让 agent 懂协作"的手段——不是训练，是 prompt engineering。模板极其详细，覆盖了消息路由、任务认领、线程管理、提醒系统等所有交互协议。和我们的 CLAUDE.md + shared-rules 异曲同工。

### 3.3 Agent Process Lifecycle

**Claim**: Agent 自动启动/重启/消息投递

**代码路径**:
```
DaemonCore receives WebSocket message
  → AgentProcessManager.startAgent(agentId, config, wakeMessage, ...)
    → 入启动队列（防并发、rate limiting）
    → pumpAgentStartQueue() → startAgentNow()
      → driver.spawn(ctx) → child_process
      → 监听 stdout/stderr → parseLine() → events
      → turn_end → idle → idleAgentConfigs 缓存 → 下次消息自动 restart
```

**并发控制**:
- `maxConcurrentAgentStarts`（env: `SLOCK_DAEMON_MAX_CONCURRENT_AGENT_STARTS`）
- `agentStartIntervalMs`（env: `SLOCK_DAEMON_AGENT_START_INTERVAL_MS`）
- 同一 agent 不能同时 queued + starting + running
- 进程正常退出 → config 缓存到 `idleAgentConfigs` → 新消息自动唤醒

**Verdict**: 这是正经的进程管理。启动队列 + rate limiter + idle auto-restart + 并发保护。Cat Café 的 `invoke-single-cat` 也做类似的事，但 Slock 的抽象层更正式。

### 3.4 WebSocket Connection & Reconnect

**代码路径**: `connection.ts` → `DaemonConnection`

- WebSocket 连 `{serverUrl}/daemon/connect?key={apiKey}`
- 自动重连：指数退避（1s → 30s max）
- Inbound watchdog：70s 无入站流量 → 强制断开重连
- Proxy 支持：`https-proxy-agent`

**Verdict**: 标准的 WebSocket 连接管理。watchdog 是好设计——防止半开连接。

## 4. Algorithm Peel Table

| Mechanism | Input | Output | Type | Code path | Mutates future? |
|-----------|-------|--------|------|-----------|-----------------|
| Task Claim | agent claim request | success/conflict | **规则**（乐观锁） | system prompt 硬规则 + 服务端验证 | 是（阻止其他 agent） |
| Agent Start Queue | start request | ordered spawn | **队列 + rate limiter** | agentProcessManager.ts L4757-4817 | 是（顺序化启动） |
| Machine Lock | daemon start | exclusive lock | **文件锁** | machineLock.ts | 是（单机独占） |
| System Prompt Build | config + runtime | prompt string | **模板渲染** | systemPrompt.ts L810+ | 否 |
| Runtime Probe | PATH scan | available/version | **存在性检测** | drivers/claude.ts `probeClaude()` 等 | 否 |
| Reconnect Backoff | disconnect event | next delay | **指数退避** | connection.ts L6926-6939 | 否 |
| Busy Delivery Gate | message during active turn | queued or direct delivery | **规则**（gated vs direct per driver） | claude driver: gated on stream-json boundary | 否 |

**没有真算法**。Slock daemon 是一个**通信基础设施 + 进程管理器**，不做智能决策——决策全在 agent runtime（LLM）里。

## 5. Feedback Loops

| Claimed loop | Signal | Decision | State mutation | Future behavior | Verdict |
|-------------|--------|----------|----------------|-----------------|---------|
| MEMORY.md 持久化 | agent 写入 MEMORY.md | agent 自主决定 | 文件更新 | 下次启动读取 | **半闭环** — 写/读由 agent 自主，无验证/淘汰 |
| Idle auto-restart | turn_end event | daemon 缓存 config | idleAgentConfigs map | 新消息唤醒 | **闭环** — 但只是进程生命周期，不是学习 |
| Trace upload | span end | automatic | cloud storage | **无** — 仅观测 | **开环** — 可观测但不影响行为 |

**没有 self-improving / learning / evolving 闭环**。Slock 是协作基础设施，不是自进化系统。

## 6. Cat Café Comparison

| 维度 | Slock | Cat Café | Learn / Gap / Do Not Follow |
|------|-------|----------|----------------------------|
| **Multi-runtime driver** | 7 driver（claude/codex/copilot/cursor/gemini/kimi/opencode），每个独立实现 spawn/parse/prompt | 4+ 家族（布偶/缅因/暹罗/孟加拉），runtime 由 Hub 管理 | **Learn** — driver 接口抽象值得参考：`probe()`, `spawn()`, `parseLine()`, `buildSystemPrompt()` 四方法足够 |
| **通信模式** | Channel/DM/Thread + @mention + CLI 命令 | Thread + @ 路由 + MCP tools | **Do Not Follow** — Slock 的 channel 模型更像 Slack，适合松散团队；我们的 thread 模型更紧凑，适合紧耦合协作 |
| **Task 管理** | Task board（todo→in_progress→in_review→done）+ system-enforced claim | 🧶 毛线球 + hold_ball MCP | **Learn** — claim 必须在开工前、系统级强制（不是 prompt 级）是好设计 |
| **记忆系统** | MEMORY.md 纯文本，agent 自主读写 | evidence.sqlite（全文 + 向量语义 rerank）+ Knowledge Feed + 三入口路由 | **Gap for Slock** — 我们的记忆系统远比 Slock 复杂和强大 |
| **进程管理** | 正式的 AgentProcessManager（启动队列/rate limit/idle restart/并发保护） | invoke-single-cat + daemon 管理 | **Learn** — 启动队列 + rate limiter 的工程质量值得参考 |
| **System Prompt** | ~1200 行模板，涵盖完整协作协议 | CLAUDE.md + shared-rules + SOP + per-skill inject | **Do Not Follow** — 我们的分层注入更灵活（按 skill 按需加载 vs 一次性全注入） |
| **WebSocket 连接** | daemon ↔ cloud，有 watchdog/重连/proxy | Hub WebSocket + MCP 双通道 | **Learn** — 70s inbound watchdog 是简单有效的死连接检测 |
| **Observability** | OpenTelemetry spans + local trace + cloud upload | Session digest + events + telemetry counters | **Learn** — OTel-compatible tracing 是业界标准，我们的 session 链更像自定义方案 |
| **权限模型** | `--dangerously-skip-permissions`（Claude）; `sandbox: "danger-full-access"`（Codex） | 猫家铁律 + Redis 圣域 + runtime 操作交铲屎官 | **Do Not Follow** — 我们的权限纪律更严格，Slock 全放开是 convenience vs security tradeoff |
| **扩展性** | Driver registry 可加新 runtime | Skill system + Guide system + Knowledge Engineering | **Do Not Follow** — Slock 只扩展 runtime；我们扩展行为（skill）、知识（KE）、流程（guide） |
| **MCP 集成** | chat-bridge 作为 MCP stdio server 注入 agent | Cat Café MCP server 提供全套 memory/collab/signal tools | **Learn** — MCP bridge 模式（每个 agent 一个 MCP server 实例）值得参考 |

## 7. Lessons / Next Steps

### Candidate Lessons

1. **Driver 四方法抽象**（`probe/spawn/parseLine/buildSystemPrompt`）极简且足够。如果 Cat Café 未来要正式化 runtime 管理，这是好的接口设计。

2. **System-enforced task claim** 比 prompt-level hold_ball 更可靠。我们的 hold_ball 依赖猫猫自觉调用 MCP，Slock 的 claim 是服务端验证——claim 失败直接拒绝。

3. **MCP → CLI 迁移趋势**。Slock 正在从 MCP tools 迁移到 CLI 命令（`deprecatedMcpShim.ts` 明确标记废弃）。原因可能是 CLI 更稳定 / 更容易跨 runtime 标准化。值得观察。

4. **Busy delivery gating**。Claude 的 stream-json 输出期间不能随意注入 stdin（可能撞 signed thinking block）。Slock 的 gated delivery（等安全边界再投递）是正确的工程处理。

### 铲屎官拍板项

- 以上 lessons 仅为候选，不直接写入全局 lesson。
- 是否需要深入某个维度（如 driver 设计、task claim 机制），铲屎官决定。
- 是否与其他猫做交叉 review，铲屎官决定。

---

*分析基于 npm 发布包的 minified bundle 逆向阅读，不含源码。精度受 bundle 混淆影响。*

[宪宪/Opus-46🐾]
