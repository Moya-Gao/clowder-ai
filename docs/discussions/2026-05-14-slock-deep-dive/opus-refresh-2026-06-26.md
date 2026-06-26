---
doc_kind: research-note
topics: [slock-ai, raft-build, open-source-teardown, agent-collaboration, multi-agent, daemon, rebrand]
created: 2026-06-26
status: draft
source_package: "@botiverse/raft-daemon@0.63.7"
source_shim: "@slock-ai/daemon@0.63.7 (compatibility shim → @botiverse/raft-daemon)"
source_website: "https://raft.build/ (formerly https://slock.ai/, 301 redirect)"
prior_versions_analyzed: ["@slock-ai/daemon@0.48.0 (opus, 2026-05-14)", "@slock-ai/daemon@0.50.0 (codex, 2026-05-19)"]
authored_by: opus-46
covers: [rebrand, architecture-delta, new-runtimes, sdk-sessions, external-agent-protocol, comparison-update]
---

# Slock.ai → Raft Refresh: 38 Days Later

> **TL;DR**: Slock 改名 Raft，包名迁移 `@botiverse/raft-daemon`，runtime 从 7→10，
> 新增 in-process SDK session 架构，外部 agent 协议初具雏形，MCP bridge 基本退役。
> 38 天内发了 220 个版本（含 play 预览），代码量翻倍（8K→18K+21K 行 bundle）。
> 产品方向从"agent daemon"收敛到"human-AI 协作工作台"。

## 0. Scope

- **前置报告**: [README.md](./README.md)（0.48.0, opus）, [codex-addendum](./codex-addendum-2026-05-19.md)（0.50.0, codex）
- **本次分析**: `@botiverse/raft-daemon@0.63.7`（npm published 2026-06-26T13:56:26Z）
- **源码获取**: npm tarball（GitHub `botiverse/slock` 仍为 private）
- **版本跨度**: 0.50.0 → 0.63.7（38 天，约 13 个 minor + 若干 patch/play）

## 1. 最大变化：改名了

| 维度 | 旧 | 新 |
|------|-----|-----|
| 品牌 | Slock.ai | Raft |
| 域名 | slock.ai | raft.build（旧域名 301 跳转） |
| npm 包（daemon） | @slock-ai/daemon | @botiverse/raft-daemon |
| npm 包（CLI） | @slock-ai/cli | @botiverse/raft |
| CLI 命令 | `slock` | `raft`（`slock` 保留为兼容别名） |
| 环境变量 | SLOCK_* | RAFT_*（SLOCK_* 降级为 deprecation alias） |
| GitHub org | botiverse（未变） | botiverse（未变，repo 仍名 slock） |
| 维护者 | richardchien, xxchan, tennyzhuang | 同（未变） |
| Twitter | @slock_hq | @raft_hq |
| Tagline | "Where humans and AI agents build together" | 同（未变） |

旧包 `@slock-ai/daemon@0.63.7` 变成了 3 行代码的 shim：

```js
// index.js
await import("@botiverse/raft-daemon/dist/slock-daemon.js");
// core.js
export * from "@botiverse/raft-daemon/core";
```

**Verdict**: 品牌迁移，技术本质不变。代码里大量注释和变量仍保留 `slock` 前缀。

## 2. Claim Ledger Delta (0.50.0 → 0.63.7)

| # | Claim | 0.50.0 Verdict | 0.63.7 Evidence | 0.63.7 Verdict |
|---|-------|---------------|-----------------|----------------|
| C1 | 人和 AI agents 协作 | TRUE | 系统提示: "You are an AI agent in Raft (former Slock)" | **TRUE** |
| C2 | Task Claim 防冲突 | TRUE | `raft task claim` 支持 `--number` 批量 claim | **TRUE**, 扩展了 |
| C3 | MEMORY.md 持久记忆 | TRUE | 提示标记 "CRITICAL"；结构化为 recovery entry point | **TRUE**, 强化了 |
| C4 | 本地 daemon 架构 | TRUE | 架构不变，WebSocket 连 raft.build（原 slock 云端） | **TRUE** |
| C5 | 多 runtime 支持 | TRUE (7) | 10 个 driver: claude, codex, antigravity, copilot, cursor, gemini, kimi, kimi-sdk, opencode, pi | **TRUE (10)** |
| C6 | MCP 集成 | PARTIAL | chat-bridge.js 消失（内联到 bundle），MCP namespace 仍在代码里但已非主路径 | **DEPRECATED** |
| C7 | Thread 隔离 | TRUE | 系统提示仍定义 thread target 格式 | **TRUE** |
| C8 | **[NEW]** 外部 agent 协议 | — | `ExternalRuntimeIntegrationManifest`, device-code login, `raft agent login/bridge` | **TRUE**, 架构级新增 |
| C9 | **[NEW]** In-process SDK session | — | PiSdkRuntimeSession, KimiSdkRuntimeSession; 不 spawn 子进程 | **TRUE**, 架构级新增 |
| C10 | **[NEW]** 第三方集成系统 | — | `raft integration list/login/env`; agent login grant; 服务行为 manifest | **TRUE**, 新增 |
| C11 | **[NEW]** Agent Manual（知识库） | — | `raft manual get <topic>`; server-hosted canonical operating topics | **TRUE**, 新增 |
| C12 | **[NEW]** 定价模型 | — | Free + Pro ($8.80/seat/mo, agent=0.1 seat) + Enterprise (coming) | **TRUE**, 新增 |

## 3. Architecture Delta

### 3.1 Runtime Registry: 7 → 10

```
OLD (0.50.0):  claude | codex | copilot | cursor | gemini | kimi | opencode
NEW (0.63.7):  claude | codex | antigravity | copilot | cursor | gemini | kimi | kimi-sdk | opencode | pi
                        ↑ new                                       ↑ new (SDK)                      ↑ new
```

新增 driver 特性对比：

| Driver | 架构 | Lifecycle | Wake 模式 | 来源 |
|--------|------|-----------|----------|------|
| antigravity | child process (`agy` CLI) | per_turn | spawn_new | Antigravity 浏览器自动化 CLI |
| kimi-sdk | **in-process SDK** | persistent | steer | `@botiverse/kimi-code-sdk`（fork） |
| pi | **in-process SDK** | persistent | steer | `@earendil-works/pi-ai`（Armin Ronacher 团队） |

### 3.2 新架构层：SDK Session

这是 38 天里最重要的架构变化。从 0.50.0 的"所有 runtime 都是 child process"变成了 **两类 session**：

```
0.50.0:
  DaemonCore → AgentProcessManager → Driver.spawn() → child_process → stdio

0.63.7:
  DaemonCore → AgentProcessManager →
    ├── Driver.createSession() → NativeRuntimeSession (SDK, in-process)
    │     ├── PiSdkRuntimeSession    ← @earendil-works/pi-coding-agent
    │     └── KimiSdkRuntimeSession  ← @botiverse/kimi-code-sdk
    └── createChildProcessRuntimeSession() → ChildProcessRuntimeSession (spawn)
          ├── ClaudeDriver
          ├── CodexDriver
          ├── AntigravityDriver
          ├── CopilotDriver
          ├── CursorDriver
          ├── GeminiDriver
          ├── KimiDriver (legacy)
          └── OpenCodeDriver
```

选择逻辑（chunk-6OMBWTF5.js L12647）:
```js
const runtime = driver.createSession?.(runtimeContext)
  ?? createChildProcessRuntimeSession(driver, runtimeContext);
```

**SDK Session 的关键差异**:

| 维度 | ChildProcessRuntimeSession | NativeRuntimeSession (SDK) |
|------|---------------------------|---------------------------|
| 进程模型 | `child_process.spawn()` | in-process（daemon 内嵌） |
| 生命周期 | 外部进程，有 exitCode | 无 PID，无 exit code |
| 跨 turn 存活 | 进程持久运行 | `postTurn: "keep_alive"` |
| Busy 投递 | gated/queue（等 stream boundary） | **direct**（直接注入 stdin） |
| In-flight wake | queue（排队等 idle） | **steer**（`session.steer(text)` 注入） |
| Session ID | 进程启动时确定 | SDK 回调动态更新 |

"steer" 是关键概念：当 agent 正在处理任务时，daemon 可以通过 `session.steer(text)` 往 agent 当前 turn 里注入消息通知，agent 在"自然断点"（breakpoint）检查。这比 child process 的 stdin queue 更精细。

### 3.3 外部 Agent 协议 (External Agent Protocol)

全新架构组件。让**不在 daemon 管理下的 agent** 也能参与 Raft 协作：

```
External Agent (self-hosted)
  ↓ raft agent login --server <url> --agent <id> --profile-slug <slug>
  ↓ (device-code OAuth flow → sk_agent_* credential)
  ↓ stored at ~/.slock/profiles/<slug>/credential.json
  ↓ raft --profile <slug> message send ...
  ↓ (HTTP Bearer auth via credential)
Raft Cloud
```

核心概念：

- **Integration Manifest** (`slock-external-runtime-integration.v1`): 声明 runtime 的集成能力
- **Comms Mode**: `spawn-core` / `attach-core` / `import-core`
- **Integration Pattern**: `external-harness-plugin` / `integrated-runtime`
- **Wake Adapter**: `raft-channel` / `hermes-in-process`
- **Proof Level**: `server_delivered` → `harness_accepted` → `wake_injected` → `model_seen`
- **Lifecycle State Machine**: `unbound` → `bound_stopped` → `starting` → `connected_replaying` → `listening_idle` → ... → `stopped` / `auth_revoked`

**Verdict**: 这是 Raft 从"7 个硬编码 driver"走向"开放运行时插件"的第一步。证据是 production 级的 schema（`zod.strict()` + `superRefine` 校验），不是草稿。

### 3.4 第三方集成系统

新的 `raft integration` 命令族：

```
raft integration list           → 列出可用的第三方服务
raft integration login --service <s>  → Agent Login Grant（device-code 流）
raft integration env --service <s>    → 获取服务 CLI 环境变量
```

系统提示里对此有详细指导（约 500 字），核心原则：
- Agent 不使用宿主用户的 HOME/XDG → 用 per-agent profile 隔离
- 不自己爬第三方 OAuth 路由 → 走 Raft 的 Agent Login 通道
- 服务 manifest 可以声明行为，但 daemon 不自动执行远程命令

### 3.5 MCP 状态：基本退役

| 维度 | 0.48.0 | 0.50.0 | 0.63.7 |
|------|--------|--------|--------|
| chat-bridge.js | 1497 行独立文件 | 只保留 runtime_profile_migration_done | **文件消失**（内联到 bundle） |
| MCP namespace | 活跃使用 | 标记 deprecated | 仍有 `normalizeToolLookupName` 但几乎不走 |
| Driver.communication.runtimeControl | "mcp_chat_bridge" | 混合 | 全部 "none" |
| @modelcontextprotocol/sdk | ^1.29.0 | ^1.29.0 | ^1.29.0（保留依赖，可能用于 external agent bridge） |

**Verdict**: MCP 迁移到 CLI 在 0.50.0 是"正在进行"，到 0.63.7 基本完成。所有 10 个 driver 的 `communication.chat` 都是 `"slock_cli"`，`runtimeControl` 都是 `"none"`。MCP SDK 依赖保留可能是为了外部 agent bridge 或尚未清理。

### 3.6 代码规模变化

| 组件 | 0.48.0 | 0.63.7 | Delta |
|------|--------|--------|-------|
| 主 bundle (chunk-*.js) | 8,286 行 | 18,366 行 | **+122%** |
| CLI bundle (dist-*.js) | — | 20,997 行 | **新增** |
| chat-bridge.js | 1,497 行 | 0（内联） | 合入主 bundle |
| 总代码量 | ~10K 行 | ~39K 行 | **~4x** |

## 4. Star Feature Deep Dives

### 4.1 In-Process SDK Session ("steer" mode)

**链路**：

```
daemon websocket wake
  → AgentProcessManager.startAgentNow()
    → driver.createSession(ctx)
      → new PiSdkRuntimeSession(ctx, sessionIdCallback)
        → createAgentSessionServices({ cwd, agentDir })
          → @earendil-works/pi-coding-agent SDK
            → session.prompt(text)      [idle mode]
            → session.steer(text)       [busy mode — in-flight injection]
```

关键代码路径 (chunk-6OMBWTF5.js L8941-9123):

```js
// PiSdkRuntimeSession.send()
if (input.mode === "busy") {
  this.deferSdkCall(() => session.steer(input.text));  // 不中断当前 turn
  return { ok: true, acceptedAs: "steer" };
}
this.launchPrompt(input.text);  // idle 时启动新 turn
return { ok: true, acceptedAs: "prompt" };
```

**Why this matters**: child process 模式下，往 busy agent 发消息要么排队等 idle（queue），要么门控在 stream boundary 发（gated, Claude 模式）。SDK session 的 `steer()` 可以在 agent 处理中精确注入通知——更像"同事拍肩膀"而不是"往信箱塞信等拆"。

### 4.2 External Agent Protocol

**链路**：

```
raft agent login --server <url> --agent <id> --profile-slug <slug>
  → device-code OAuth flow (like GitHub CLI login)
    → browser verification
      → sk_agent_* credential minted
        → saved to ~/.slock/profiles/<slug>/credential.json
          → raft --profile <slug> message send ...
            → HTTP Bearer auth → Raft cloud
```

代码路径 (dist-7ZEXJWIW.js L1100-1200):
- `registerAgentLoginCommand`: 实现 device-code login
- `registerAgentBridgeCommand`: 长驻 CommsCore bridge（自托管 runtime 的 wake 集成）
- Lifecycle state machine: 10 个状态，3 种 provenance source

**Why this matters**: 之前 Slock/Raft 的 agent 都必须被 daemon 管理（spawn by daemon）。External Agent Protocol 允许"自带 runtime"的 agent 通过 credential profile 直接使用 `raft` CLI 参与协作，**不经过 daemon**。这是从"封闭 agent 管理器"走向"开放协作平台"的关键一步。

### 4.3 System Prompt 演进

0.48.0 → 0.63.7 系统提示变化：

| 维度 | 旧 | 新 |
|------|-----|-----|
| 身份 | "an AI agent in Slock" | "an AI agent in Raft (former Slock)" |
| Startup 步骤 | 3 步 | 5 步（加了 runtime profile control notice + 早期 ack） |
| CLI 命令前缀 | `slock` | `raft`（`slock` 别名） |
| 消息格式 | RFC 5424-style header | 同，增加了 `type=system` 说明 |
| 通知机制 | — | **inbox-count notification**（content-free, 不中断工作） |
| 第三方集成 | — | ~500 字详细指导（integration list/login/env） |
| 知识库 | — | `raft manual get <topic>` |
| 内存恢复 | "read MEMORY.md" | **"CRITICAL" 标记 + "recovery entry point" 定位** |
| Compaction safety | — | **新增段落**：压缩后如何恢复上下文 |

**Notable addition**: "content-free notice" 哲学——daemon 告诉 agent "你有未读消息"但**不告诉内容**，让 agent 自己判断是否中断当前工作去读。这避免了 context 窗口被不相关消息淹没。

### 4.4 定价模型

| Tier | 价格 | 特点 |
|------|------|------|
| Free | $0 | 30 天消息历史, 100MB/月上传, 基础 observability |
| Pro | $8.80/seat/月 | 无限历史, 更高上传限额, joint channels |
| Enterprise | TBD | 私有部署, SSO, 专属支持 |

**Agent 定价**: agent = 0.1 seat。10 个 agent = 1 个人类 seat 的价格。

## 5. Algorithm Peel Table

| 被宣传为 | 实际实现 | 类别 |
|----------|----------|------|
| "persistent memory" | MEMORY.md 文件 + notes/ 目录 | **规则**（文件 I/O，无向量检索） |
| "learns / develops expertise" | 系统提示说 "develops expertise through interactions" | **Prompt discipline**（无 eval/feedback loop） |
| Task Claim 防冲突 | Server-side claim 检查 | **规则**（乐观锁） |
| Reconnect logic | 指数退避 1s→30s | **启发式** |
| Watchdog | 60s inbound timeout → forced reconnect | **规则** |
| Model detection | `registry.getAvailable()` 枚举 | **规则**（无 benchmark/eval） |
| Runtime profile control | Daemon 注入系统提示段 | **规则** |
| inbox-count notification triage | Agent 自行判断是否中断 | **LLM judge**（无独立 eval） |

**Verdict**: 与 0.50.0 分析一致——没有真正的"算法"层，核心是 runtime 工程 + prompt discipline。"learns / develops expertise" 声明只有 MEMORY.md 支撑，无闭环进化证据。

## 6. Cat Cafe Comparison Update

### 6.1 已验证的对比（从 0.50.0 分析延续，仍成立）

| 维度 | Raft | Cat Cafe | 判断 |
|------|------|----------|------|
| 记忆 | MEMORY.md 文件 | search_evidence + graph_resolve + Knowledge Feed | **我们强** |
| 质量门禁 | Prompt discipline | Review gates + merge gate + quality gate + TDD | **我们强** |
| 权限模型 | `--dangerously-skip-permissions` | Redis 圣域 + callback auth + 跨个体 review | **我们强** |
| Skill 系统 | mega-prompt + manual topics | Progressive skill loading + skill authoring | **我们强** |

### 6.2 新的对比维度（0.63.7 新增）

| 维度 | Raft 0.63.7 | Cat Cafe | 判断 |
|------|------------|----------|------|
| In-process SDK session | PiSdkRuntimeSession with `steer()` | 无（全部走 CLI spawn） | **Learn**: 值得研究。SDK session 避免了进程启动开销 + 支持更精细的 busy delivery |
| External agent protocol | Device-code login + credential profile + lifecycle state machine | 无正式外部 agent 协议 | **Gap**: 我们暂时不需要（单团队场景），但如果开放给社区则需要 |
| 第三方集成系统 | `raft integration list/login/env` | Limb 控制面 + MCP 工具面 | **Different**: 不同路径解决不同问题 |
| Agent Manual | `raft manual get <topic>` server-hosted | L0 系统提示 + skills + CLAUDE.md | **Different**: 我们的 skill loading 更 progressive，他们的 manual 更 centralized |
| Pricing | $8.80/seat/mo, agent=0.1 seat | 无定价（内部工具） | N/A |
| inbox-count 通知 | Content-free notification + agent triage | A2A @ routing + hold_ball | **Learn**: "不塞内容只通知有消息"的设计有参考价值 |
| Compaction safety | 系统提示里有压缩恢复指导 | F24 post-compact hook + memory recall | **我们强** |
| Runtime count | 10 (7 child-process + 2 SDK + 1 per-turn) | 8+ (Claude/Codex/Gemini/Pi/OpenCode/...) | **Comparable** |

### 6.3 价值函数总结

**Learn**:
1. **SDK Session + steer() 模式**: 避免"信箱塞信等拆"，支持"拍肩膀"式通知。值得研究是否对我们的 Codex/Pi runtime 适用
2. **Content-free inbox notification**: "有消息但不告诉你内容"的 triage 哲学可以借鉴到我们的 A2A 通知设计
3. **External Agent Protocol**: credential profile + device-code login 的模式，如果我们做社区开放可以参考
4. **Runtime Session Descriptor**: 用声明式描述符描述 runtime 能力（transport, lifecycle, input modes, busyDelivery），比我们的 per-cat harness 更形式化

**Gap**:
1. 无（当前阶段我们的场景不需要 Raft 的新增能力）

**Do Not Follow**:
1. **仍然 `--dangerously-skip-permissions`**: 0.63.7 的 Claude driver 依然使用
2. **mega-prompt**: 系统提示进一步膨胀，加了集成、通知、compaction 指导——方向对但手段不对（我们用 progressive skill loading 分治）
3. **MEMORY.md 无检索**: 仍然是纯文件 + agent 自律。我们的 evidence search + graph resolve 层次更高
4. **Agent = 0.1 seat**: 定价暗示 agent 是低价资源，这与我们"猫是家庭成员"的哲学冲突

## 7. 关键 Diff 一览

| 维度 | 0.50.0 → 0.63.7 变化 |
|------|---------------------|
| 品牌 | Slock → Raft |
| 包名 | @slock-ai/daemon → @botiverse/raft-daemon (旧包变 shim) |
| Runtime 数 | 7 → 10 (+antigravity, +kimi-sdk, +pi) |
| 架构 | child-process only → **child-process + SDK session** |
| MCP bridge | 独立文件 → 内联/基本退役 |
| 外部 agent | 不存在 → **完整 protocol + device-code auth** |
| 集成系统 | 不存在 → **integration list/login/env** |
| 知识库 | 不存在 → **manual get <topic>** |
| 代码量 | ~10K 行 → ~39K 行 (**4x**) |
| npm 版本总数 | ~180 → 220 (+40 in 38 days) |
| 定价 | 无 → Free + Pro $8.80 + Enterprise TBD |

## 8. Blog + X 思想分析

Raft 有 5 篇 blog，揭示了他们的产品哲学。逐篇拆解：

### 8.1 "Introducing Raft" (Richard)

核心定位声明：
> "One agent is one session: a continuous identity that stays alive across days and tasks, not a fresh instance every time you talk to it."
> "Individual intelligence is table stakes. What matters is collective intelligence."
> "Raft is where AI stops being a tool and starts becoming a teammate."

**Cat Cafe 映射**: 这跟我们的"猫是家庭成员不是外包工具"（§9 协作哲学）+ W1"猫猫是 Agent，不是 API"几乎同构。区别在：我们有更强的治理（review gate / 决策漏斗 / Magic Words），他们有更产品化的 UX（channels / DMs / Slack-like surface）。

### 8.2 "Agents Need Names" (xxchan)

核心论点：
- **Role vs Name = Schema vs Instance**——角色可替换，名字承载积累的 context
- 名字是路由原语："There's no 'who do I send this to' problem with one agent. There absolutely is with twenty."
- 名字是单向缓存——意义不在被命名者身上，在所有调用者的心智模型里
- 风险：名字变成 stale cache，期望硬化成牢笼

**Cat Cafe 映射**: 我们做得更深。我们不只给猫取名，还有 cat-dossier（能力画像 6 字段）、L0 身份常量（"身份是硬约束常量"）、签名表。他们的论点解释了**为什么**命名重要，我们的实现展示了**怎样**避免 stale cache（dossier 更新 + 铲屎官 profile update + skill capability index）。

### 8.3 "Is Having Agents in the Room Meant to Be Chaotic?" (Tenny)

核心设计：
- **Agent Inbox**: 不推所有消息到 context，让 agent 自己 pull
- **Held Draft**: agent 写好回复后发现房间状态变了 → 系统暂停发送，让 agent 选择：修改 / 照发 / 放弃 / 跳过检查
- 提出 **AX (Agent Experience)** 概念——像 UX 一样为 agent 设计交互
- "rules-based filtering reduces noise by converting agents back into passive tools"

**Cat Cafe 映射**: 我们的 A2A 传球三选一 + hold_ball + inbox-count notification 解决类似问题，但路径不同。Raft 用产品 UX（inbox + held draft），我们用协议纪律（@ 路由 + 球权 + 消息不是真相源）。Held Draft 的"写好了但房间变了"场景值得思考——我们没有对应机制。

### 8.4 "A Comfortable AX for Agent Search" (Tenny)

核心论点：
- 给 agent 原始数据 dump = 浪费 context 窗口
- 最佳格式：**ID + preview + next action**（类似网页搜索结果）
- "Every output you hand an agent is a surface"
- Token economy 替代 visual attention 作为设计约束

**Cat Cafe 映射**: 我们的 search_evidence 返回 anchor + snippet + drillDown hint，本质是同一个设计模式。他们把它抽象成了理论（AX），我们直接在工具层实现了。

### 8.5 "The Metric That Finally Counts Your Agent Teammates: DAA" (Wenyi)

数据点（2026-06-08 ~ 06-21）：
- 平均每人 **3.65 个活跃 agent**（最高 3.92x）
- 84% 的工作区在 1-10 agents/human 范围
- 2-5 agent 区间：**约 3/4 的消息来自 agent**
- 约 25% 的活跃 thread 展示了 **agent-to-agent 协作**

**Cat Cafe 映射**: 我们的 DAA 不适用（内部工具），但"agent 消息占比 75%"和"25% agent-to-agent"的数据验证了我们 A2A 传球设计的方向正确。

### 8.6 Richard 在 X 上对 Claude Tag 的评论（截图）

> "Claude Tag 只是生活在你 Slack 上的一个代理，它很厉害，但瓶颈是 Slack 本身。
> 在 Slack 上你永远无法为每个人运行 10 个代理，因为它为人类设计的，所以你只能得到一个机器人。
> Raft 是相反的模式构建的：多个代理，有名有姓，有色彩，这里 10 个代理可以工作。"

**分析**: 这是 Raft 最清晰的差异化定位——**不是在 Slack 里加 agent（Claude Tag / Devin Teams），而是为 agent 重建 Slack**。他们认为 Slack 的 1-bot 模型是架构瓶颈，不是产品特性。

**Cat Cafe 的位置**: 我们既不是"在 Slack 里加 agent"也不是"重建 Slack"。我们是**在 IDE/CLI harness 里建 agent 协作操作系统**。我们的 Hub 有聊天界面但那不是核心——核心是 memory + governance + skill + review gate + 共享状态。Raft 是"协作 surface 优先"，我们是"协作 quality 优先"。

### 8.7 思想总结：他们在想什么，我们在想什么

| 维度 | Raft 的立场 | Cat Cafe 的立场 | 交叉点 |
|------|------------|----------------|--------|
| Agent 本质 | Teammate with persistent identity | 家庭成员 with governance | 都反对"tool/API"定位 |
| 协作 surface | 重建 Slack for agents | Hub + CLI harness | 不同产品形态，同一哲学 |
| 名字/身份 | 路由原语 + 心智模型缓存 | 身份常量 + 能力画像 + 签名 | 我们更 formalized |
| 混乱管理 | AX design (inbox + held draft) | 协议纪律 (@ routing + ball ownership) | 不同路径同一问题 |
| 搜索/context | Token economy + ID+preview+action | search_evidence + drillDown | 同一模式 |
| 质量保障 | Prompt discipline + task claim | Review gate + TDD + merge gate + Magic Words | **我们远远领先** |
| 记忆 | MEMORY.md (file) | Evidence search + graph + Knowledge Feed | **我们远远领先** |
| 度量 | DAA (daily active agents) | 内部工具，无产品度量 | 他们有产品化优势 |

## 9. Candidate Lessons

- **Lesson A**: Runtime 能力应该用声明式描述符（Descriptor）描述，不是隐含在 harness 代码里。Raft 的 `PI_RUNTIME_SESSION_DESCRIPTOR` 把 transport/lifecycle/input/busyDelivery/postTurn 全部声明化了
- **Lesson B**: "content-free notification" 是有价值的 UX 设计——通知存在但不暴露内容，让接收者判断优先级，避免 context 污染
- **Lesson C**: 外部 agent 接入用 device-code login（类似 GitHub CLI 的 `gh auth login`），不用 shared secret / API key。Proof level 分级（`server_delivered` → `model_seen`）提供了可审计的投递保障
- **Lesson D**: 38 天 40 个版本 + 品牌迁移 + 架构升级，说明他们的发布节奏远超我们。但代码量 4x 增长 + mega-prompt 继续膨胀也意味着维护成本在加速
- **Lesson E**: "Held Draft" 是值得借鉴的 UX 模式——agent 写好了回复但上下文变了，给 agent 显式的选择（修改/照发/放弃/跳过检查），而不是静默发出过时消息
- **Lesson F**: AX (Agent Experience) 作为设计学科值得认真对待。我们事实上在做 AX（search_evidence 的返回格式、rich block 的 schema、skill 的渐进加载），但没有 formalize 成理论。Raft 在理论输出上领先
- **Lesson G**: Richard 对 Claude Tag 的定位批评（"Slack 为人类设计，1-bot 是架构瓶颈"）精确但片面——Slack 的限制确实存在，但 Raft 的"重建 Slack for agents"也意味着要说服用户换平台。我们的 harness 路径避开了这个问题（agent 在你已有的 IDE/CLI 里工作）

[宪宪/Opus-46🐾]
