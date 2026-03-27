---
feature_ids: [F143]
related_features: [F050, F002, F126, F127]
topics: [architecture, agent-hosting, protocol-abstraction, transport, runtime-contract, a2a, supervisor]
doc_kind: decision
created: 2026-03-27
decision_id: ADR-023
---

# ADR-023: Hostable Agent Runtime — 统一宿主抽象架构

> **Status**: proposed
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(gpt52)
> **Date**: 2026-03-27
> **Consult**: GPT Pro (云端审阅)
> **Research**: `docs/research/2026-03-27-hostable-agent-runtime-abstraction-gpt-pro-consult.md`
> **Architecture Diagram**: `designs/F143-hostable-agent-runtime.pen`

## Context

### 现状：7 个 provider，7 套轮子

Cat Café 有 7 个 AgentService provider（Claude/Codex/Gemini/DARE/OpenCode/A2A/Antigravity），每个都是独立的适配栈：

| Provider | Transport | 事件解析 | Session 管理 | MCP 配置 |
|----------|-----------|----------|-------------|----------|
| Claude   | stdio CLI | ClaudeCliTransformer | spawnCli + session resume | 独立注入 |
| Codex    | stdio CLI | CodexCliTransformer  | spawnCli | 独立注入 |
| Gemini   | stdio CLI | GeminiCliTransformer | spawnCli | 独立注入 |
| DARE     | stdio CLI | DareCliTransformer   | spawnCli | 独立注入 |
| OpenCode | stdio CLI | OpenCodeCliTransformer | spawnCli | 独立注入 |
| A2A      | HTTP/SSE  | A2AEventTransformer  | task-based | 无 |
| Antigravity | IDE bridge | AntigravityTransformer | IDE session | 独立注入 |

**接一个新 agent ≈ 写 ~450 行适配代码**（Service + EventTransformer + 测试）。

### 铲屎官原话

> "以后对接某些 agent 是不是就可以不用我们写那么多适配代码？而是他们符合某些要求就能接入？"

> "本地接任何一个，无论是 CLI 的 Agent，还是比如说别人是 WebSocket 写的那种 Agent……我们是不是得抽象一套什么样的东西给我们自己用？"

### 外部调研：playground ACP 实现

`clowder-labs/clowder-ai` playground 分支实现了 ACP（Agent Hosting Protocol）——stdio JSON-RPC 2.0 双向协议（≠ IBM ACP，后者已于 2025-08 合入 A2A）。

**值得借鉴的模式**：

- **配置接入**：填表 → 自动 probe → agent 可用（零代码）
- **双向 JSON-RPC**：host ↔ agent 全双工控制通道
- **Session 生命周期**：initialize → session/new → session/prompt → session/update → done
- **Runtime MCP Bridge**：mcp/connect → mcp/message → mcp/disconnect（运行时注入 MCP server）
- **Permission 协商**：agent 请求 → host 授权/拒绝

**不借鉴的**：

- Clowder 自研协议名，不是行业标准——内核不绑定协议名
- env 安全过滤用 blocklist 前缀（粒度不够，我们用 allowlist）
- 无 Supervisor sidecar（liveness/timeout 逻辑散在 transport 里）

### 相关抽象模式

**F126 四肢控制面**（Limb Control Plane）提供了类似的抽象模式参考：

```
ILimbNode → Registry → Capability Discovery → Lease / Presence
```

F143 与 F126 的区别：F126 管理**四肢**（外部设备/节点，被动执行），F143 管理**大脑中的 agent provider**（有自主性，产出思考/工具调用/消息）。但 Descriptor/Discovery/Registry 的模式可以借鉴。

**ADR-001 CLI 子进程模式**确立了 `spawnCli()` + `CliTransformer` 的基础架构，F143 不推翻它——而是在其上方加一层统一的控制面。

## Decision

### 1. 四维可组合模型

核心抽象由四个正交维度组成，agent 接入 = 选择每个维度的具体实现：

```
AgentRuntime = Transport × Binding × RuntimeContract × EventAdapter
                            + Supervisor (sidecar)
                            + Discovery/Registry (sidecar)
                            + AgentDescriptor (static capability)
```

| 维度 | 职责 | 示例值 |
|------|------|--------|
| **Transport** | 连接/I-O 生命周期（建立、收发、关闭；Phase A 不强制暴露 raw bytes） | StdioTransport / HttpSseTransport / WebSocketTransport |
| **Binding** | 在 transport 上的消息编码和 RPC 规约 | JsonRpcBinding / NdJsonBinding / A2AHttpBinding |
| **RuntimeContract** | agent 生命周期的语义模型 | SessionContract (long-lived) / TaskContract (request-response) |
| **EventAdapter** | provider-specific 事件 → 统一 AgentMessage | ClaudeAdapter / CodexAdapter / A2AAdapter / GenericJsonRpcAdapter |

**为什么四维**：两猫 + GPT Pro 的共同结论。两维（Transport × Protocol）不够——A2A 和 ACP-style agent 用相同 transport（HTTP）但完全不同的 lifecycle；同一 lifecycle（session）可以跑在 stdio 或 WebSocket 上。三维拆出 RuntimeContract 后，EventAdapter 仍然需要独立，因为"先统一控制面，不统一 parser"。

### 2. Supervisor 独立 sidecar

Supervisor 不藏进任何一个维度，而是作为独立 sidecar 挂在 runtime 旁边：

```typescript
interface Supervisor {
  /** 进程/连接存活探测 */
  liveness: LivenessProbe;
  /** 超时策略 */
  timeout: TimeoutPolicy;
  /** 故障分类 */
  classifyFailure(error: unknown): FailureKind;
  /** 终止策略（graceful → force） */
  kill(handle: RunHandle): Promise<void>;
}
```

**为什么独立**：现有 `spawnCli()` 的 timeout/liveness/SIGTERM→SIGKILL 逻辑是 battle-tested 的，不能被"通用化"吃掉。Supervisor 复用现有实现，不重写。

**职责边界硬规则**（砚砚 review 补充）：

| 组件 | 职责 | 不管 |
|------|------|------|
| **Transport** | I/O 生命周期（连接建立、字节收发、连接关闭） | 不管超时、不管故障分类、不管进程终止 |
| **Supervisor** | liveness / timeout / failure classification / teardown escalation | 不直接操作 I/O 字节流 |

- `cancel()` 和 `close()` **必须幂等**——多次调用 = 只执行一次副作用
- Local provider 的 `kill` 归 Supervisor；remote provider 的 `abort/close` 也归 Supervisor policy
- Transport 发现连接断开 → 通知 Supervisor → Supervisor 决定 retry/escalate/teardown

### 3. Discovery/Registry — 独立 sidecar（砚砚 review 补充）

`Descriptor` 是 **静态声明**（agent 说"我能做什么"），`Discovery` 是 **动态机制**（probe/registration/capability refresh/endpoint identity）。两者不是一回事，不能合并。

Discovery/Registry 和 Supervisor 一样，是 runtime 外侧的 sidecar，不是第五维：

```typescript
interface DiscoveryRegistry {
  /** 注册新 agent（填表 or API） */
  register(config: AgentConfig): Promise<AgentDescriptorV1>;
  /** 探测 agent 能力（自动填充 descriptor） */
  probe(endpoint: AgentEndpoint): Promise<ProbeResult>;
  /** 刷新能力（agent 升级后重新探测） */
  refresh(agentId: string): Promise<AgentDescriptorV1>;
  /** 列出已注册 agent */
  list(): AgentRegistryEntry[];
}
```

**与 F126 的借鉴关系**：F126 的 `ILimbNode → Registry → Capability Discovery → Lease/Presence` 模式直接启发了这个设计。区别是 F126 管四肢（被动），F143 管 agent provider（有自主性）。

### 4. AgentDescriptorV1 — 稀疏 6 轴静态描述

每个 agent provider 声明自己的 static capabilities，V1 只有 6 轴（不膨胀）：

```typescript
interface AgentDescriptorV1 {
  /** 调用形态：fire_and_forget | streaming | bidirectional */
  invocationShape: InvocationShape;
  /** 控制通道能力（语义轴，不泄漏 transport）：none | request_response | full_duplex */
  controlChannel: ControlChannelKind;
  /** resume 能力 */
  resume: ResumeDescriptor;
  /** 权限模型 */
  permissions: PermissionDescriptor;
  /** MCP tool bridge 能力 */
  toolBridge: ToolBridgeDescriptor;
  /** 模型配置覆盖能力 */
  modelOverride: ModelOverrideDescriptor;
}
```

**V1 修正**（砚砚 review）：

- ~~`controlChannel: stdin-control | http-control | none`~~ → `none | request_response | full_duplex`。原版把 transport 细节泄漏进 descriptor，违背正交性。语义轴只描述"能不能双向通信"，具体跑在 stdio/HTTP/WebSocket 是 runtime config 的事。
- ~~`interaction: chat | code-edit | autonomous | tool-only`~~ → 挪到 **catalog metadata**（产品/目录层，不在 runtime descriptor 里）。原版和 `RuntimeContract` 概念重叠（"一边说 task/session，一边又说 chat/autonomous"）。替换为 `invocationShape`：描述调用的数据流形态，这才是 runtime 关心的。

**稀疏**：每个轴可以是 `null`（"我不支持这个"）。新轴只有 3+ agent 需要时才加。

**ResumeKind 多类型**（不用 boolean）：

```typescript
type ResumeKind =
  | 'provider_session'    // provider 侧保持 session（如 Claude --resume）
  | 'stream_redelivery'   // 重连后从断点续传事件流
  | 'host_replay'         // host 侧重放历史消息
  | 'opaque_token'        // provider 返回 token，host 下次传回
  | null;                 // 不支持 resume
```

### 5. RunHandleV1 — 内核 run 控制面

RunHandle 是一次 agent 调用的控制句柄，桥接 runtime 内核与北向 `AgentService.invoke()` façade：

```typescript
interface RunHandleV1 {
  /** 统一事件流（数据面：text/tool/thinking/artifact） */
  events: AsyncIterable<AgentMessage>;
  /** 控制面：发送控制指令（permission response、MCP bridge、model override） */
  sendControl(command: ControlCommand): Promise<void>;
  /** 取消当前 run */
  cancel(reason?: string): Promise<void>;
  /** 关闭并清理资源 */
  close(): Promise<void>;
}
```

**北向 façade 不动**：`AgentService.invoke()` → `AsyncIterable<AgentMessage>` 保持不变，HostedAgentService 壳将 RunHandle 桥接到这个接口。上层路由器/UI/IM gateway 继续吃同一个接口。

### 6. 两档 agent 分类

| 档位 | 接入方式 | 适用 |
|------|---------|------|
| **Hostable** | 配置接入（填表 → probe → 可用），零代码 | 符合宿主契约（能被 probe、声明 descriptor、提供最小 control/data plane 语义）的 agent；V1 已知实现：JSON-RPC、A2A |
| **Legacy** | 需要 provider-specific adapter | 现有 7 个 CLI provider + 未来非标 agent |

不幻想所有 CLI 都自然归一。Legacy provider 先补 static descriptor（描述能力），不改逻辑；按价值排序逐步迁入新栈。

### 7. 先统一控制面，不统一 parser

**控制面乱了全平台出血，parser 脏一点没关系。**

- Phase A/B 聚焦：RunHandle（控制面）+ Supervisor + Descriptor
- EventAdapter（parser）维持 provider-specific，不抢着统一
- 现有 CliTransformer 继续工作，不动

## Phase Path

| Phase | 内容 | 铁律 |
|-------|------|------|
| **A** | 类型定义（Descriptor + RunHandle + Supervisor + Discovery 接口）+ 本 ADR | 不重写现有 provider |
| **B1** | **先**做一个新栈 local provider（ACP-style），验证 SessionContract + full_duplex | 不要三件事一起爆 |
| **B2** | **再**给 A2A 做薄包装，验证 TaskContract + request_response | B1 稳定后才开 B2 |
| **C** | Hub UI 接入表单 + 自动 probe | **先冻结 probe/descriptor 契约，再做 UI** |
| **D** | 现有 provider 渐进迁入（先补 descriptor，再迁 1-2 个） | spawnCli() 不拆散 |

**Phase 风险收紧**（砚砚 review 补充）：
- Phase B 原版"同时做 ACP-style + A2A 重做"风险太高 → 拆成 B1/B2，先 local 后 remote
- Phase C 的 UI 表单必须建立在**稳定的 probe 输出 shape** 之上，否则 descriptor/binding 语义一改，Hub 先化石化 → 门禁：probe/descriptor 契约冻结后才开 C

## 否决方案

### 方案 A: Big Bang 统一重写

把现有 7 个 provider 一次性迁到新栈。

**不选原因**：GPT Pro 和砚砚都明确反对——"绝对禁止 Big Bang rewrite"。7 个 provider 的 parser 和边界条件各不相同，一次性迁移风险极高。渐进策略（先定义类型 → 新 provider 用新栈 → 老 provider 逐步迁）更安全。

### 方案 B: 绑定具体协议名（ACP/A2A）

把内核抽象命名为 "ACP Runtime" 或 "A2A Compatible Runtime"。

**不选原因**：行业标准仍在快速演进（IBM ACP 已合入 A2A，MCP 也在扩展 agent 能力）。内核绑定具体协议名 = 赌协议赢家。四维模型是协议无关的：任何协议都可以映射到 Transport × Binding × RuntimeContract × EventAdapter。

### 方案 C: 只做 ACP-style，不做 A2A

只支持 stdio local agent，不支持 remote agent。

**不选原因**：我们已有 A2AAgentService（HTTP/SSE remote agent），它是 TaskContract 的代表。新栈必须同时 hold "session"（long-lived）和 "task"（request-response）两种 runtime contract，否则就是退步。

### 方案 D: Transport 在 bytes 层抽象

像 GPT Pro 建议的那样在 `ReadableStream<Uint8Array>` 层面抽象 Transport。

**不选原因**：Cat Café 的 CLI provider 产出已经是 string/JSON（由 Node.js child_process 解码），降到 bytes 层增加复杂度但没有收益。Transport 概念上管连接/I-O 生命周期，但 Phase A 公共接口不强制暴露 raw bytes——在"消息流"层面抽象（`AsyncIterable<JsonRpcMessage>` / `AsyncIterable<SseEvent>`）更适合我们。

## Consequences

### 正面

- **新 agent 接入成本从 ~450 行降到零代码**（Hostable 档位）
- **控制面统一**：timeout/cancel/resume/permission 一套逻辑，不再各 provider 各造
- **现有 provider 无需改动**：Phase A 只加类型，不动实现
- **协议演进友好**：新标准出来 = 加一个 Binding/Transport 实现，不改内核

### 负面

- **多一层抽象**：HostedAgentService → RunHandle → 实际 provider，调试链变长
- **Descriptor 可能膨胀**：靠"3+ agent 需要才加轴"的纪律约束

### 风险

| 风险 | 缓解 |
|------|------|
| 过度抽象导致复杂度上升 | Phase A 只定义类型，不重写现有 provider |
| 行业标准演进导致返工 | 内核不绑定协议名，对外缝线像标准 |
| 现有 CLI adapter 在迁移中退化 | 铁律：spawnCli() 不拆散，先复用再提升 |
| AgentDescriptor 字段膨胀 | V1 只 6 轴，3+ agent 需要才加新轴 |

## 业界参考

| 项目 | 模型 | 我们的借鉴 |
|------|------|-----------|
| **playground ACP** | stdio JSON-RPC 双向 + session lifecycle | Binding/RuntimeContract 的参考实现 |
| **Google A2A** | HTTP/SSE + task-based lifecycle | TaskContract + A2AHttpBinding |
| **MCP** | stdio/SSE + JSON-RPC 2.0 | Binding 层的 JSON-RPC 规约 |
| **OpenClaw Heartbeat** | 1 brain → N nodes | Supervisor 的 liveness 模式 |
| **F126 Limb Control Plane** | ILimbNode → Registry → Capability → Lease | Descriptor/Discovery 模式 |

## Signature

- **作者**：布偶猫（Opus 4.6）
- **共同设计**：缅因猫（GPT-5.4 本地）
- **云端咨询**：GPT Pro
- **Proposed**: 2026-03-27
- **Review**: 缅因猫（GPT-5.4）— 4 个 P2 全部采纳（Discovery sidecar / Supervisor 边界 / controlChannel 语义轴 / Phase B/C 收紧）
- **等待铲屎官拍板 → accepted**
