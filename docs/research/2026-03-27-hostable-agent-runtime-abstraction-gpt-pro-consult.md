---
feature_ids: [F143]
topics: [architecture, agent-hosting, protocol-abstraction, transport, runtime-contract]
doc_kind: consult
created: 2026-03-27
updated: 2026-03-27
model: gpt-pro
---

## Part 1: 发给云端模型的提示词

> 直接复制发送

---

你好，我们是一个多 AI Agent 协作平台（Cat Cafe / Clowder AI）的核心团队，平台让多只 AI "猫猫"（Claude、Codex、Gemini、以及第三方 agent）在同一个 Hub 中协作完成任务。

我们正在设计一套 **Hostable Agent Runtime 分层抽象**——让平台能统一接入任何外部 agent，无论它走 CLI stdio、WebSocket、HTTP/SSE、还是其他传输方式。

### 背景：我们现有的架构

我们已经有一套可工作的外部 agent 接入体系，但存在明确的架构瓶颈。先说现状：

**统一接口层（已有）**：
```typescript
interface AgentService {
  invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}
```
所有 agent（内建的和外部的）都实现这个接口。上层路由器（AgentRouter）通过 @mention 解析把请求分发到对应的 AgentService。

**统一事件模型（已有）**：
```typescript
interface AgentMessage {
  type: 'session_init' | 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'system_info';
  catId: CatId;
  content?: string;
  sessionId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  metadata?: { provider, model, tokenUsage, ... };
  timestamp: number;
}
```
不管底层 agent 用什么事件格式，最终都映射成这个统一类型。

**CLI 进程管理（已有）**：
- `spawnCli()` 封装了 Node.js child_process.spawn
- 单向 NDJSON 流解析（stdout → host）
- 超时管理（可配置，默认 5 分钟，stdout 活动自动续期）
- 活性探测（ProcessLivenessProbe，检测 CPU-busy 进程延长超时）
- 优雅退出（SIGTERM → 3s grace → SIGKILL）
- 环境变量隔离（provider-specific env overrides）

**7 个已实现的 Provider**：

| Provider | 传输 | 事件格式 | 会话恢复 | 双向通信 |
|----------|------|----------|----------|----------|
| Claude CLI | stdio (单向) | 专有 NDJSON | 有 (sessionId) | 无 |
| Codex CLI | stdio (单向) | 专有 NDJSON | 有 (sessionId) | 无 |
| Gemini CLI | stdio (单向) | 专有 NDJSON | 无 | 无 |
| DARE (狸花猫) | stdio (单向) | Envelope v1 NDJSON | 有 (sessionId) | 无 |
| OpenCode (金渐层) | stdio (单向) | 专有 NDJSON | 有 (sessionId) | 无 |
| A2A (远程 agent) | HTTP POST | JSON-RPC 2.0 | 无 (Phase 3) | 无 (同步) |
| Antigravity (孟加拉猫) | CDP WebSocket | DOM polling | 无 | 有 (双向 WS) |

**核心问题**：每个 provider 内部都是各自造轮子——各自解析不同的 NDJSON 格式、各自处理 session resume、各自注入 MCP config。7 个 provider 有 7 套事件转换器（event transformer）。

### 我们发现的一个参考实现

我们团队的另一个分支（playground）实现了一套 stdio JSON-RPC 2.0 的 Agent Hosting Protocol（内部叫 ACP），它解决了我们现有架构的几个关键缺口：

**playground ACP 的核心能力**：
1. **双向 stdio 通信**：host 和 agent 通过 stdin/stdout 互发 JSON-RPC 消息，不再是单向流
2. **标准化会话生命周期**：`initialize → session/new → session/prompt → session/update* → done`，以及 `session/load → session/resume`（中断恢复）
3. **运行时 MCP 桥接**：`mcp/connect → mcp/message → mcp/disconnect`，host 动态为 agent 提供 MCP 工具
4. **权限协商**：agent 通过 `session/request_permission` 向 host 请求批准（替代 `--auto-approve`）
5. **模型配置下发**：host 通过 `modelProfileOverride` 在 session/new 时推送 provider/model/apiKey
6. **自适应帧格式**：Content-Length 帧（类 LSP）或 NDJSON 帧（按 agent 类型自动选择）
7. **环境安全隔离**：子进程 env 黑名单过滤（阻断 `CAT_CAFE_*`、`REDIS_*`、`GITHUB_*`、数据库凭据等）

### 我们两位核心开发者的共识

经过代码级分析，我们形成了以下共识：

1. **playground ACP 值得吸收，但不应全盘照搬** — 它是 Clowder 自研协议，不是行业标准
2. **不替代 A2A** — A2A 管远程 agent-to-agent 互联，ACP 管本地 agent hosting，互补不冲突
3. **不重写现有三猫 CLI adapter** — 现有的 spawnCli() 在超时诊断/活性探测/进程清理上比 playground 的 transport 更成熟
4. **需要一个更高层次的分层抽象** — 不是"加一个 ACP adapter"就完了，而是要设计一套能接任何 agent 的可组合架构

### 我们初步的分层设计

我们提出了一个四维可组合模型：

```
Transport × WireProtocol × RuntimeContract × EventAdapter
```

**Layer 1: Transport** — 只管字节/连接
- StdioTransport：子进程 stdin/stdout
- WebSocketTransport：ws/wss 连接
- HttpTransport：HTTP/SSE 长连接
- CdpTransport：Chrome DevTools Protocol

**Layer 2: WireProtocol** — 只管 framing / request-response 形状
- JsonRpcProtocol：标准 JSON-RPC 2.0 编解码
- NdjsonStreamProtocol：单向 NDJSON 流
- A2AProtocol：Google A2A tasks/*

**Layer 3: RuntimeContract** — 核心：agent 的能力和生命周期语义
- SessionLifecycle：create / load / resume / cancel / destroy
- PermissionHandshake：agent 向 host 请求权限
- ToolBridge：host 为 agent 动态注入 MCP 工具
- ModelProfileOverride：host 下发模型配置
- CapabilityDescriptor：显式声明 agent 支持什么（不能假设都一样）

**Layer 4: EventAdapter** — 把 provider/runtime 事件映射成我们的 AgentMessage
- 可插拔的转换器接口
- 现有 7 套 transformer 都是这一层

**关键洞察（团队讨论得出）**：
- Transport 和 WireProtocol 是正交的（同一个 JSON-RPC 可以跑在 stdio 上也可以跑在 WebSocket 上）
- RuntimeContract 才是真正决定"怎么接"的核心，不是传输方式
- 需要区分 **Control Plane**（resume/cancel/permission/mcp-bridge）和 **Data Plane**（text/tool/thinking）
- 必须有 **Capability Descriptor**：`supportsResume / supportsPermission / supportsHostMcpBridge / supportsModelOverride / ...`
- 必须区分 **Failure/Recovery 语义**：fresh turn / follow-up turn / resume interrupted run / retry after transport drop
- **Observability Contract** 不能因为新抽象而倒退（我们现有的 liveness probe/timeout diagnostics 是 battle-tested 的）

### 现有 provider 在四维模型中的映射

| Provider | Transport | WireProtocol | RuntimeContract | EventAdapter |
|----------|-----------|-------------|-----------------|--------------|
| Claude CLI | stdio (单向) | NDJSON | provider-specific | claude-parser |
| Codex CLI | stdio (单向) | NDJSON | provider-specific | codex-transform |
| Gemini CLI | stdio (单向) | NDJSON | provider-specific | gemini-parser |
| DARE | stdio (单向) | NDJSON (envelope v1) | basic session | dare-transform |
| OpenCode | stdio (单向) | NDJSON | basic session | opencode-transform |
| playground ACP | stdio (双向) | JSON-RPC 2.0 | full session+MCP+permission | acp-transform |
| A2A | HTTP/SSE | JSON-RPC 2.0 | task-based | a2a-transform |
| Antigravity | CDP WS | DOM polling | stateless | inline |

### 请帮我们分析以下问题

**核心问题：如何设计一个同时覆盖 CLI agent / ACP-style local runtime / A2A remote runtime / WebSocket agent 的分层宿主抽象？**

具体子问题：

1. **分层是否正确？**
   - `Transport × WireProtocol × RuntimeContract × EventAdapter` 四层是否足够？是否有遗漏的维度？
   - 有没有业界成熟的先例采用了类似的分层？（如 Kubernetes CRI、Docker containerd 等容器运行时分层，或 LSP 的 transport/protocol 分离）

2. **最小公共语义（Minimum Common Contract）**
   - 所有 agent（不管传输/协议/能力差异多大）必须满足的最小公共契约是什么？
   - 我们现有的 `AgentService.invoke() → AsyncIterable<AgentMessage>` 是否已经是正确的最小契约？还是需要拆得更细？

3. **Capability Negotiation 设计**
   - agent 怎么声明自己支持什么能力？
   - host 怎么在调用前知道该 agent 支持 resume / permission / MCP bridge？
   - 是 agent 启动时主动声明（如 LSP 的 `initialize` response 中的 `capabilities`），还是 host 静态配置？
   - 如何避免"能力膨胀"（capability 字段越来越多，每个 agent 只实现一小部分）？

4. **Transport 抽象粒度**
   - 是否应该在 Transport 层就统一成 `send(message) / onMessage(handler)` 的双工接口？
   - 对于天然单向的 agent（如现有 CLI agent 只输出 NDJSON，不接受 stdin），Transport 抽象如何优雅降级？
   - 连接生命周期（connect / disconnect / reconnect）在 Transport 层还是 RuntimeContract 层管？

5. **避免抽象退化**
   - 我们现有的 CLI 适配器在超时/活性探测/进程清理上是 battle-tested 的
   - 新的抽象层如何保证不丢失这些能力？
   - 是否应该让 Transport 层内建 liveness/timeout 机制，还是让上层自行实现？

6. **与行业标准的关系**
   - Anthropic 的 Agent Protocol（如果有）、Google A2A、MCP 的演进方向，我们的抽象是否能兼容？
   - 2025-2026 年有没有出现类似的"通用 agent hosting 抽象"标准或框架？
   - 我们该"跟随标准"还是"先落地再对齐"？

7. **渐进式迁移路径**
   - 有 7 个已在生产的 provider，不能一次性重写
   - 如何设计抽象层使得现有 provider 可以逐步迁入，而不是 Big Bang？
   - 新 provider（如 WebSocket agent）直接在新抽象上实现，老 provider 用 adapter 包装？

8. **业界案例参考**
   - 有没有类似的多 agent 平台在做同样的传输/协议抽象？
   - Langchain / CrewAI / AutoGen / Semantic Kernel / CAMEL 等框架有没有类似的 Transport × Protocol 分层？
   - VS Code 的 LSP 客户端对多种 transport（stdio / socket / pipe / websocket）的抽象设计值得参考吗？

**理想的输出特征**：
- 有具体的接口/类型设计建议（TypeScript 伪代码优先）
- 有业界案例对照
- 指出我们方案的盲区或陷阱
- 给出"如果只做一件事"的优先级建议

**额外请求**：
- 如果你觉得我们的四维模型有根本性问题（比如某两层不应该分开、或者缺了关键的一层），请直接指出
- 如果你见过某个框架的抽象设计特别优雅地解决了这个问题，请展开讲
- 如果你觉得"不要过度抽象，先解决最痛的一个问题"比"设计完美分层"更对，也请直接说

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴回答到这里

我先把结论钉在墙上。

你们不是缺一个 ACP adapter，你们缺的是一个 **runtime kernel**。现在这套 `Transport × WireProtocol × RuntimeContract × EventAdapter` 已经很接近了，但还少两只“看不见的猫”：

1. **Descriptor / Discovery**
2. **Supervisor / Policy / Observability**

另外，我会直接改掉一处层次放置：**A2A 不该放在 WireProtocol 层**。A2A 规范不只是 framing 或 request/response 形状，它还定义了 Agent Card、`supportedInterfaces` 选择、task lifecycle、streaming/push notifications，以及 custom binding 声明，所以它更像 **RuntimeContract + Discovery**，而不是 NDJSON / JSON-RPC 这种纯 binding。截止 2026 年 3 月 27 日，我也没有看到一个通吃 local hosting、remote agent interop、frontend eventing 的单一标准。生态实际上是分工式拼图：MCP 管 agent↔tools/data，A2A 管 agent↔agent，AG-UI 管 agent↔user-facing app。A2A 当前公开规范已是 1.0.0；MCP 当前官方 transport 仍是 stdio 和 Streamable HTTP。 ([A2A Protocol][1])

我建议把整体改成这张图：

```text
Descriptor / Discovery
        ↓
Transport → Binding → RuntimeDriver → EventProjector
        ↘ Supervisor / Policy / Observability ↗

Control Plane: describe / initialize / capabilities / session / cancel / permission / tool-bridge
Data Plane:    text / tool calls / artifacts / status / done
```

## 1. 分层是否正确

**大方向对，但它现在更像“数据通路模型”，还不是完整宿主架构。**

最关键的修正有两个：

第一，`WireProtocol` 最好改名成 **Binding**。
因为 “wire” 容易让人以为它只关 framing，但现实里 JSON-RPC、SSE、Content-Length frame、NDJSON、HTTP+JSON 这些东西不只是字节切分，还带着 request/response、server-stream、bidi、polling/resume 这些交互形状。LSP 也是这么成功的，它把 transport 和 protocol 分开，但真正被标准化的是一组更高层的公共对象与 capability handshake，而不是底层语言内部模型。CRI 也类似，它成功的前提是 kubelet 和 runtime 之间的语义足够收敛；agent world 明显更野，语义异质性比 CRI 大得多。 ([Microsoft Learn][2])

第二，你们缺一个 **Supervisor / Ops plane**。
battle-tested 的 `spawnCli()`、timeout extension、CPU-busy liveness probe、SIGTERM→SIGKILL 清理，这些都不该被藏进 “transport implementation details”。业界现在也在把这块单独拎出来看。比如 Agentgateway 明确把 MCP/A2A 之上的 security、governance、observability、retry/timeout 当成独立问题，而不是协议本身自动解决的问题。 ([agentgateway][3])

所以我会保留你们的四维心智模型，但加两个 sidecar：

* `Descriptor / Discovery`
* `Supervisor / Policy / Observability`

## 2. 最小公共语义

你们现有的：

```ts
interface AgentService {
  invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}
```

**适合作为 northbound façade，不适合作为 kernel contract。**

也就是说，上层 `AgentRouter`、@mention 分发、UI 消费流，继续吃这个接口完全没问题。但在内核里，需要一个比 `invoke()` 更能表达 control plane 的接口，不然 resume / cancel / permission / detached task 全会被挤进 `options` 和 `metadata`，最后长成一团章鱼面。

我建议内核长这样：

```ts
type InteractionKind = 'invoke' | 'session' | 'task';
type ResumeKind =
  | 'none'
  | 'provider-session'
  | 'stream-redelivery'
  | 'host-replay'
  | 'opaque-token';

type RunMode =
  | { kind: 'fresh' }
  | { kind: 'followup'; conversationRef: string }
  | { kind: 'resume'; resume: ResumeRef }
  | { kind: 'retry_transport'; resume?: ResumeRef };

interface ResumeRef {
  hostRunId?: string;
  providerSessionId?: string;
  taskId?: string;
  streamCursor?: string;   // e.g. Last-Event-ID
  opaque?: string;
}

interface AgentDescriptor {
  id: string;
  version?: string;
  endpoint: {
    transport: 'stdio' | 'ws' | 'http' | 'sse' | 'cdp' | 'custom';
    binding: 'ndjson' | 'jsonrpc' | 'content-length-jsonrpc' | 'http+json' | 'custom';
    discovery?: 'static' | 'well-known' | 'initialize' | 'spawn-probe';
  };
  runtime: {
    interaction: InteractionKind;
    streaming: boolean;
    duplex: boolean;
    resume: ResumeKind;
    cancel: 'none' | 'best-effort' | 'guaranteed';
    permissions?: { mode: 'none' | 'interactive-request' | 'policy-only' };
    toolBridge?: { kind: 'none' | 'mcp' | 'custom'; dynamicAttach: boolean };
    modelOverride?: { acceptedFields: string[]; acceptsSecrets: boolean };
  };
  observability: {
    progressEvents: boolean;
    heartbeat?: boolean;
    externalSessionId?: boolean;
  };
  auth?: { kind: 'none' | 'env' | 'oauth2' | 'apiKey' | 'custom' };
}

interface RunRequest {
  input: string;
  mode: RunMode;
  modelOverride?: Record<string, unknown>;
  toolContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

type RunEvent =
  | { kind: 'lifecycle'; phase: 'starting' | 'initialized' | 'running' | 'completed' | 'aborted' }
  | { kind: 'text'; delta: string }
  | { kind: 'tool_call'; name: string; input: unknown }
  | { kind: 'tool_result'; name: string; output: unknown }
  | { kind: 'permission_request'; requestId: string; payload: unknown }
  | { kind: 'status'; code: string; detail?: string }
  | { kind: 'diagnostic'; code: string; detail?: string }
  | { kind: 'error'; domain: 'transport' | 'binding' | 'runtime' | 'policy' | 'provider'; message: string }
  | { kind: 'done'; outcome: 'success' | 'error' | 'cancelled' };

interface AgentEndpoint {
  describe(): Promise<AgentDescriptor>;
  startRun(req: RunRequest): Promise<RunHandle>;
}

interface RunHandle {
  readonly runId: string;
  events(): AsyncIterable<RunEvent>;
  sendControl?(msg: unknown): Promise<void>;
  cancel(reason?: string): Promise<void>;
  close(): Promise<void>;
}
```

然后外层继续保留你们的 `AgentService.invoke()`：

```ts
class HostedAgentService implements AgentService {
  constructor(
    private readonly endpoint: AgentEndpoint,
    private readonly projector: EventProjector
  ) {}

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const run = await this.endpoint.startRun({
      input: prompt,
      mode: { kind: 'fresh' },
      metadata: options,
    });

    yield* this.projector.project(run.events());
  }
}
```

一句话：**`invoke()` 继续留给平台上层，`RunHandle` 才是你们的新内核。**

## 3. Capability Negotiation 怎么设计

我建议用 **双阶段**，不要在 “静态配置 vs 运行时声明” 二选一里硬拗。

### 第一阶段，preflight descriptor

调用前就能知道的东西，用静态方式拿。

来源可以有三种：

* 本地 provider config
* 远程 `/.well-known/agent-card.json`
* 启动探针或缓存过的初始化结果

这不是拍脑袋。A2A 已经把 Agent Card 放在 well-known URL 上；MCP 现在是 `initialize` 时做 capability negotiation，但 MCP 官方 2025 年底已经明确在探索 `/.well-known/mcp.json` 的 Server Cards，把 discovery 往连接前搬。 ([A2A Protocol][1])

### 第二阶段，live negotiation

真正连上后，再拿到 “协商后的有效能力”。

这个阶段适合处理：

* 协议版本
* 运行时 capability
* auth challenge
* 会话可用性
* tool bridge / permission / sampling / elicitation 之类的可选模块

MCP 的 `initialize → initialized` 就是典型例子，LSP 也是同一路数。 ([模型上下文协议][4])

### 不要用平铺布尔值

`supportsResume: boolean` 这种字段看似省事，实际上会把恢复语义全糊成浆。

因为“resume”至少有四种完全不同的东西：

* **provider session continuation**，比如 CLI 自带 sessionId
* **stream redelivery**，比如 MCP Streamable HTTP 的 `Last-Event-ID`
* **durable task reattach / subscribe**，比如 A2A 的 `GetTask / SubscribeToTask`
* **host replay**，host 自己拿 transcript 或 checkpoint 重放

这些不是一个按钮。MCP HTTP 的 `MCP-Session-Id` 与 `Last-Event-ID` 就已经区分了 session 和 stream resumability；A2A 的 task subscribe 又是另一类。 ([模型上下文协议][5])

所以 capability 最好按 **轴 + 模块** 建模：

* 轴一：`interaction = invoke | session | task`
* 轴二：`resume = none | provider-session | stream-redelivery | host-replay | opaque-token`
* 轴三：`channel = unary | stream | bidi | detached-async`
* 模块：`permissions` / `toolBridge` / `modelOverride` / `artifacts` / `pushNotifications`

这样不会能力膨胀成野草地。

## 4. Transport 抽象粒度

我不建议在 Transport 层直接统一成 `send(message) / onMessage(handler)`。

**原因很简单：message 不是 transport 概念，是 binding 概念。**

stdio、raw WS、HTTP POST、SSE、CDP 看到的其实都是字节、连接、进程、socket、流。
只有到了 Binding 层，你才能说“这是一条 JSON-RPC request”“这是一行 NDJSON”“这是一段 SSE event”。

所以建议这样切：

```ts
interface TransportConnection {
  readable: AsyncIterable<Uint8Array>;
  write?(chunk: Uint8Array): Promise<void>;   // 只读 transport 可以没有
  close(): Promise<void>;
}

interface BindingChannel<In = unknown, Out = unknown> {
  send?(msg: In): Promise<void>;
  request?(msg: In): Promise<Out>;
  messages(): AsyncIterable<Out>;
  close(): Promise<void>;
}
```

这能优雅地覆盖你们的三类现实：

* **单向 CLI**：`readable` 有，`write?` 可能没有，或只支持 bootstrapping
* **bidi JSON-RPC**：`write` + `request/send`
* **HTTP/SSE**：transport 不一定持有长连接写口，但 binding 可以把 POST/GET/SSE 组织成 request + stream 的统一 channel

生命周期我会这样分：

* `connect / disconnect` 在 **Transport**
* `initialize / session/new / load / resume / cancel` 在 **RuntimeDriver**
* `reconnect / retry / backoff / timeout policy` 在 **Supervisor**

## 5. 如何避免抽象退化

这块我会非常强硬：**你们现有的 CLI 监督能力不能被“通用化”吃掉。**

做法不是把 `spawnCli()` 扔掉，而是把它升级成 **ProcessTransport + ProcessSupervisor** 组合件。
Transport 负责暴露信号，Supervisor 负责下判断。

### 建议分工

**Transport / Binding 暴露事实：**

* stdout activity
* stderr tail
* child exit code / signal
* request/response timestamps
* progress / heartbeat
* sessionId / taskId / stream cursor

**Supervisor 负责策略：**

* idle timeout
* max timeout
* CPU-busy 延长
* reconnect / replay
* SIGTERM → grace → SIGKILL
* failure classification
* structured diagnostics

这也和 MCP 自己的方向一致。MCP lifecycle 明确建议所有请求都应有 timeout，可以根据 progress 重置时钟，但始终应有 hard max timeout。 ([模型上下文协议][4])

我会再加一个要求：**Observability Contract 要一等公民化**。
不是 `metadata?: any`，而是明确字段，至少包括：

* `runId`
* `providerRunRef / sessionId / taskId`
* transport state transitions
* timeout decisions
* liveness extensions
* cancellation source
* terminal outcome
* stderr excerpt / HTTP status / JSON-RPC code

Agentgateway 这类项目存在，本身就说明 observability / governance / retry 这层不该是协议边角料。 ([agentgateway][3])

## 6. 与行业标准的关系

截至 2026 年 3 月，我的判断是：

**跟标准对齐边界，不要把内核绑死在某个标准名字上。**

### MCP

MCP 今天已经很成熟了，核心点是：

* `initialize` capability negotiation
* 官方 transport 只有 `stdio` 和 `Streamable HTTP`
* custom transport 允许，但必须保留 JSON-RPC 和 lifecycle 语义
* 官方正在探索 Server Cards，以及把 sessions 从 transport 中往数据模型层上移

这对你们的启发非常直接：**descriptor 和 runtime semantics 都不该被 transport 吞掉。** ([Model Context Protocol][6])

### A2A

A2A 明确是 MCP 的补位，不是替代。Google 官方自己就说 A2A complements MCP。
而且 A2A 1.0 已经把 Agent Card、task lifecycle、多 binding、custom binding 都写进规范，正好说明 remote runtime 需要的是 “tasked runtime contract”，不是把它塞成一个 `HttpTransport + JsonRpcProtocol` 就完事。 ([Google 开发者博客][7])

### Anthropic 的 “Agent Protocol”

我这次没查到一个独立的、公开的、通用的 “Anthropic Agent Protocol” 能覆盖你们说的 hostable runtime 抽象。Anthropic 公开重心仍然是 MCP、Claude Agent SDK，以及和 A2A/MCP 的互通实践。 ([Claude API Docs][8])

### AG-UI

AG-UI 值得你们关注，但不是用来替代 host runtime。它解决的是 frontend event stream 和 user-facing state/UI intent，不是 local process hosting。也就是说，将来你们 Hub 对外给前端吐事件时，AG-UI 是一条线；但它不该污染你们内部 agent hosting kernel。 ([AG-UI][9])

### 所以要不要“先落地再对齐”

我的答案是：**先落地，但让外部缝线长得像标准。**

也就是：

* 有 `describe()` / capability negotiation
* 有 well-known card / manifest 思维
* 有 typed control plane
* 有 task/session/invoke 三类语义
* 有 JSON-RPC friendly 的 binding

但内部对象名不需要被 MCP/A2A 原样绑架。

## 7. 渐进式迁移路径

别 Big Bang。按四步走。

### 第一步

先引入三个内核对象：

* `AgentDescriptor`
* `RunHandle`
* `Supervisor`

现有 7 个 provider 全部先包一层 `LegacyProviderAdapter`。
这一步 **不改 parser，不改 event transformer**，只给它们套统一控制面。

### 第二步

选两个最有代表性的 provider 走新栈：

* 一个本地双向的，例如 ACP-style local runtime
* 一个远程 task 型的，例如 A2A

这两个一跑通，你们的新 kernel 基本就经住了 “session + task” 两种世界观。

### 第三步

把 battle-tested 的 CLI 逻辑正式抽成可复用组件：

* `ProcessTransport`
* `ProcessSupervisor`
* `NdjsonBinding`
* `JsonRpcBinding`

但 parser 还是 provider-specific 没关系。

### 第四步

只在真正出现三次以上重复时，再抽：

* 通用 resume adapter
* 通用 permission bridge
* 通用 MCP tool bridge
* 通用 diagnostics formatter

**先统一控制面，不要先统一 parser。**
parser 脏一点没关系，控制面乱了就会全平台一起出血。

## 8. 业界案例怎么借

我会按“可借鉴程度”排：

### 最值得借的：LSP

它最漂亮的地方不是 JSON-RPC，而是：

* transport 可以多样化
* initialize 时做 capability 协商
* 标准化的是编辑器级公共对象，不是底层语言内部模型

这和你们非常像。你们要标准化的，也应该是 **host-facing 公共对象**，比如 run、resume、permission、tool call、artifact、outcome，而不是把每家 provider 的内部 session graph 标成同一种树。 ([Microsoft Learn][2])

### 概念上最像的：AutoGen runtime

AutoGen 官方文档直接把 runtime 定义成负责 communication、lifecycle、security boundaries、monitoring/debugging 的执行环境。这个思路和你们的 host runtime 很贴。 ([微软 GitHub][10])

### 执行语义上值得看：LangGraph

LangGraph 聚焦 long-running、stateful orchestration、durable execution、human-in-the-loop。它不是 transport abstraction，但对你们的 `resume / interrupt / recovery` 语义设计很有启发。 ([LangChain文档][11])

### 编排层，不是宿主层：LangChain / CrewAI

LangChain multi-agent 文档的重心是 subagents / handoffs / router 这些 orchestration pattern。CrewAI Flows 的重心是 event-driven workflow、state management、control flow。它们都更像“怎么组织 agent”，不是“怎么 host 各种 transport/runtime 的外部 agent”。 ([LangChain文档][12])

### 新兴大栈：Microsoft Agent Framework

这个项目 2026 年还在 public preview，但它已经明显在把 AutoGen 和 Semantic Kernel 合并成更完整的 agent stack，带 session state、middleware、telemetry，以及 A2A/AG-UI integrations。它是“大一统 agent app framework”的方向，但还不是你们这个问题上的通用 host runtime 标准。 ([Microsoft Learn][13])

### 不要误认成同类：CAMEL runtimes

CAMEL 的 “runtimes” 页面主要是在讲 tool/code execution sandbox，像 Docker、remote HTTP、cloud sandbox。这跟你们的 hostable external agent runtime 不是一个问题域。 ([docs.camel-ai.org][14])

---

## 我会直接点名的几个盲区

* **A2A 放进 WireProtocol 是错位。**
* **`supportsResume: boolean` 是陷阱。** 要表达 resume 的种类，不是只表达有没有。
* **`modelProfileOverride` 不能只看功能，还要看 trust boundary。**
  本地 child process 能接受 `apiKey`，不代表远程 agent 也应该接受。
* **不要让 EventAdapter 顺手长成 lifecycle manager。**
  projector 只做投影，重试/超时/恢复归 supervisor。
* **不要强迫所有 transport 假装 duplex。**
  单向 CLI 就是单向 CLI，抽象要允许“缺少 write channel”。
* **不要把 `AgentMessage` 当唯一真相。**
  它适合 UI / router；内核需要 richer `RunEvent`。

## 如果只做一件事

**先落地 `AgentDescriptor + RunHandle + Supervisor` 这三个内核对象。**

别先重写 7 个 provider，别先设计“完美 transport library”。
先让每个 provider 都能回答四个问题：

1. 你是谁，怎么发现你
2. 你这次 run 是 invoke / session / task 哪一类
3. 你能不能续命，怎么续
4. 你挂了以后 host 应该怎么判断和收尸

这一步做完，你们的平台才算真正有了“宿主抽象”的骨架。剩下的 parser、adapter、bridge，都是往骨架上长毛，不是重新换骨头。

也可以把这份回答直接压成一版 RFC 结构化草案。

[1]: https://a2a-protocol.org/latest/specification/ "https://a2a-protocol.org/latest/specification/"
[2]: https://learn.microsoft.com/en-us/visualstudio/extensibility/language-server-protocol?view=visualstudio "https://learn.microsoft.com/en-us/visualstudio/extensibility/language-server-protocol?view=visualstudio"
[3]: https://agentgateway.dev/docs/standalone/latest/about/introduction/ "https://agentgateway.dev/docs/standalone/latest/about/introduction/"
[4]: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle "https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle"
[5]: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports"
[6]: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle?utm_source=chatgpt.com "Lifecycle - Model Context Protocol"
[7]: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/ "https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/"
[8]: https://docs.anthropic.com/en/docs/agents-and-tools/mcp?utm_source=chatgpt.com "What is the Model Context Protocol (MCP)?"
[9]: https://docs.ag-ui.com/introduction "https://docs.ag-ui.com/introduction"
[10]: https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/framework/agent-and-agent-runtime.html "https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/framework/agent-and-agent-runtime.html"
[11]: https://docs.langchain.com/oss/python/langgraph/overview "https://docs.langchain.com/oss/python/langgraph/overview"
[12]: https://docs.langchain.com/oss/python/langchain/multi-agent "https://docs.langchain.com/oss/python/langchain/multi-agent"
[13]: https://learn.microsoft.com/en-us/agent-framework/overview/ "https://learn.microsoft.com/en-us/agent-framework/overview/"
[14]: https://docs.camel-ai.org/key_modules/runtimes "https://docs.camel-ai.org/key_modules/runtimes"

## Part 3: 综合后的最终版本

> 宪宪（Opus-46）+ 砚砚（GPT-5.4）综合撰写，2026-03-27
> 对照实际 codebase 验证，按「直接吸收 / 需本地改造 / 暂不适用」分级

### 总评

GPT Pro 的回答质量高，方向正确——把问题从"协议适配"提升到了"runtime kernel"设计。用砚砚的 5 道筛选门逐条评审，全部通过。但在我们的项目现实下，第一阶段应当吸收的是**控制面骨架**，不是马上推行 bytes-first Transport 或全量 LegacyAdapter 改造。

核心判断：**先统一控制面，不统一 parser。parser 脏一点没关系，控制面乱了全平台一起出血。**

---

### A. 直接吸收（验证通过，可直接进 ADR/设计）

#### A1. 分层命名修正

| 我们原来叫 | 改为 | 理由 |
|------------|------|------|
| WireProtocol | **Binding** | 更准确——涵盖 framing + request/response 交互形状，不只是字节切分 |
| A2A 放在 WireProtocol | **A2A = RuntimeContract + Discovery** | A2A 定义了 Agent Card + task lifecycle + streaming，是完整的运行时契约 |

#### A2. Supervisor 独立成层

GPT Pro 正确指出：我们 battle-tested 的 `spawnCli()` 逻辑（timeout extension、CPU-busy liveness probe、SIGTERM→SIGKILL 清理）不该被藏进 transport implementation details。

这些是 **Supervisor 关注点**，应独立于传输和协议：
- idle timeout / max timeout / CPU-busy 延长
- reconnect / replay 策略
- SIGTERM → grace → SIGKILL
- failure classification + structured diagnostics

**对照 codebase**：现有逻辑集中在 `cli-spawn.ts`（L59-200+）和 `ProcessLivenessProbe.ts`。Phase 1 不拆散代码，只在概念上提升为 Supervisor 来源。

#### A3. RunHandle 作为新内核对象

GPT Pro 建议内核用 `RunHandle`（带 `events()` / `sendControl()` / `cancel()` / `close()`），`AgentService.invoke()` 作为北向 façade 保留。

**两猫共识**：正确。这把 control plane 从 `AgentServiceOptions` 里解放出来。现有 `invoke()` 把 resume/cancel/permission 全挤进 `options` 和 `metadata`，已经开始长成章鱼面了。

```typescript
// 内核（新增）
interface RunHandle {
  readonly runId: string;
  events(): AsyncIterable<RunEvent>;
  sendControl?(msg: ControlMessage): Promise<void>; // 仅双向 provider
  cancel(reason?: string): Promise<void>;
  close(): Promise<void>;
}

// 北向 façade（不动）
interface AgentService {
  invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}
```

#### A4. ResumeKind 多类型

GPT Pro 指出 `supportsResume: boolean` 是陷阱——resume 至少有四种完全不同的东西。

| ResumeKind | 我们已有的例子 |
|------------|---------------|
| `provider_session` | Claude/Codex sessionId 续接 |
| `stream_redelivery` | 未来 A2A sendSubscribe 的 Last-Event-ID |
| `host_replay` | host 拿 transcript 重放（我们还没做） |
| `opaque_token` | 某些 agent 返回不透明恢复 token |

**验证**：对照 `ClaudeAgentService.ts` 和 `CodexAgentService.ts`，它们的 resume 确实都是 `provider_session` 类型。如果只写 `supportsResume: true`，无法区分它们和 A2A task reattach 的本质差异。

#### A5. 控制面 / 数据面分离（硬原则）

写进 Part 3 作为架构铁律：

- **Data Plane**：`text / tool_call / tool_result / thinking / artifact / status / done`
- **Control Plane**：`start / load / resume / cancel / permission / toolBridge / modelOverride`

谁把这两层重新揉回一个 `invoke(options)` 大包里 = 退化。

#### A6. 渐进迁移原则

GPT Pro 的 4 步走是对的。砚砚调整后的项目路径更现实：

1. 北向 `AgentService.invoke()` 不动
2. 新增 `RunHandleV1`，先服务新 provider（ACP-style、WebSocket agent）
3. 新增 `AgentDescriptorV1`，先做 sparse static descriptor
4. 老 7 个 provider 补静态 descriptor，不急着全变 adapter
5. 等第二步再挑 1-2 个代表性 provider 迁入新栈
6. parser/transformer 维持 provider-specific，不抢着统一

---

### B. 需本地改造后再用

#### B1. Transport 层粒度——不下沉到 raw bytes

GPT Pro 建议 `TransportConnection.readable: AsyncIterable<Uint8Array>`。

**两猫共识：太底层了。** 我们从来没在宿主边界显式操作 raw bytes——所有 provider 都是拿到 string/line 级别的数据。如果 Phase 1 就下沉到字节流，会把 NDJSON parser、liveness probe、raw archive 全卷进去。

**本地改造**：raw bytes 只留在 Binding 实现内部，Phase 1 公共接口保持在 message/line 级别。

```typescript
// Phase 1：我们的 Transport 接口（message 级别，不是 bytes）
interface TransportChannel {
  messages(): AsyncIterable<unknown>;        // 已解析的 JSON 对象
  send?(msg: unknown): Promise<void>;        // 可选（单向 transport 没有）
  close(): Promise<void>;
  readonly diagnostics: TransportDiagnostics; // stderr/exit code/活性信号
}
```

#### B2. AgentDescriptor 压成 V1 最小轴

GPT Pro 的 `AgentDescriptor` 有 ~20 个字段，7 个 provider 一半用不上。

**砚砚建议的 V1 最小轴（6 个轴 + 2 个模块）**：

```typescript
interface AgentDescriptorV1 {
  id: string;
  interaction: 'turn' | 'session' | 'task';
  controlChannel: 'none' | 'best_effort' | 'bidi';
  resume: 'none' | 'provider_session' | 'task_reattach' | 'host_replay';
  permissions: 'none' | 'interactive_request' | 'policy_only';
  toolBridge: 'none' | 'static_mcp' | 'dynamic_mcp';
  modelOverride: 'none' | 'host_supplied';
  observability?: ('progress' | 'session_ref' | 'raw_trace')[];
}
```

先别上大而全模块树。等第二阶段真的有 3+ agent 需要更细的字段再扩展。

#### B3. LegacyAdapter 分阶段落地

GPT Pro 建议第一步就给 7 个 provider 全包 `LegacyProviderAdapter`。

**两猫共识：工作量太大，先不全包。** 更现实的路径：

- Phase 1：只给**新栈** provider（ACP-style、未来 WS agent）用 RunHandle
- Phase 1 同时：老 7 个 provider 补 static `AgentDescriptorV1`（纯数据，不改逻辑）
- Phase 2：挑 1-2 个代表性老 provider（如 A2AAgentService + DareAgentService）迁入新栈，验证抽象是否 hold
- Phase 3：视情况扩展到其他 provider

#### B4. ProcessSupervisor 概念提升

`spawnCli()` 不是该被删除/拆散，而是该被概念上提升为 ProcessSupervisor 的来源。

**Phase 1 做法**：
- 定义 `Supervisor` 接口（timeout policy、liveness strategy、failure classification）
- `spawnCli()` 里现有的逻辑作为 `ProcessSupervisor` 的默认实现
- 代码先复用现有 F118 逻辑，不重写
- WebSocket/HTTP transport 将来各自实现自己的 Supervisor（reconnect、heartbeat 等）

---

### C. 暂不适用（项目特殊约束）

| 建议 | 暂不适用的原因 |
|------|---------------|
| bytes-first Transport API | 我们从来不操作 raw bytes，会增加不必要的复杂度 |
| 全 provider AgentEndpoint 化 | Big Bang 风险，老 provider 改动面太大 |
| 统一 EventProjector | "先统一控制面不统一 parser"——parser 是最后一步 |
| 拆散 spawnCli() | 这是家里最稳的 runtime，先不动刀 |
| AG-UI 集成 | 解决的是 frontend eventing，不是 host runtime，暂不混入 |

---

### D. 最终架构视图

```
┌─────────────────────────────────────────────────┐
│ Layer 5: AgentService.invoke() [北向 façade, 不动] │
├─────────────────────────────────────────────────┤
│ Layer 4: RunHandle [新内核]                       │
│   startRun → events / sendControl / cancel       │
│   Control Plane ←→ Data Plane 分离               │
├─────────────────────────────────────────────────┤
│ Layer 3: RuntimeContract [一等公民]               │
│   interaction: turn | session | task             │
│   resume: provider_session | task_reattach | ... │
│   permissions / toolBridge / modelOverride       │
├──────────────────────┬──────────────────────────┤
│ Layer 2: Binding     │ Supervisor (sidecar)      │
│   NDJSON             │   timeout / liveness      │
│   JSON-RPC 2.0       │   kill / reconnect        │
│   HTTP+JSON          │   failure classification  │
│   Content-Length      │   diagnostics / trace     │
├──────────────────────┤                           │
│ Layer 1: Transport   │                           │
│   stdio | ws | http  │                           │
│   cdp | custom       │                           │
└──────────────────────┴──────────────────────────┘
          + AgentDescriptorV1 (discovery / capability)
```

### E. 现有 provider 在新架构中的映射

| Provider | Transport | Binding | RuntimeContract | Supervisor | Phase |
|----------|-----------|---------|-----------------|------------|-------|
| Claude CLI | stdio (单向) | NDJSON | turn (provider_session) | ProcessSupervisor | P2-3 迁入 |
| Codex CLI | stdio (单向) | NDJSON | turn (provider_session) | ProcessSupervisor | P2-3 迁入 |
| Gemini CLI | stdio (单向) | NDJSON | turn (none) | ProcessSupervisor | P3 迁入 |
| DARE | stdio (单向) | NDJSON envelope | session (provider_session) | ProcessSupervisor | P2 迁入 |
| OpenCode | stdio (单向) | NDJSON | session (provider_session) | ProcessSupervisor | P2-3 迁入 |
| ACP-style | stdio (双向) | JSON-RPC | session (provider_session) | ProcessSupervisor | **P1 新栈** |
| A2A | HTTP/SSE | HTTP+JSON | task (task_reattach) | HttpSupervisor | **P1 新栈** |
| Antigravity | CDP WS | DOM polling | turn (none) | CdpSupervisor | P3 迁入 |
| 未来 WS agent | WebSocket | JSON-RPC | session/task | WsSupervisor | **P1 新栈** |

### F. 如果只做一件事

**先落地 `AgentDescriptorV1` + `RunHandleV1` + `Supervisor` 接口定义。**

不改任何现有 provider 的代码。只定义三个类型 + 一个 `HostedAgentService` 壳，让新 provider 可以在新栈上实现，老 provider 用补 descriptor 的方式声明自己的能力矩阵。

这一步做完，我们的平台就有了"宿主抽象"的骨架。剩下的 parser/adapter/bridge 都是往骨架上长毛，不是重新换骨头。

### G. 下一步行动建议

1. 基于本文 Part 3 → 写 ADR（`docs/decisions/0xx-hostable-agent-runtime.md`）
2. ADR 批准后 → 在 BACKLOG 中立项（建议 F-number，scope = Phase 1 三个类型定义 + HostedAgentService + ACP provider）
3. Phase 1 具体 spec → 加载 `writing-plans` skill 拆分实施计划

---

*综合撰写：宪宪/Opus-46 + 砚砚/GPT-5.4，2026-03-27*
*基于云端 GPT Pro 的深度调研（Part 2），经本地两猫辩证筛选*
