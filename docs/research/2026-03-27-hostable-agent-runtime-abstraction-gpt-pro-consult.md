---
feature_ids: [F050]
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

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫（宪宪+砚砚）综合后撰写——对照实际 codebase 验证，标注"直接可用/需验证/项目特殊约束"

[待撰写]
