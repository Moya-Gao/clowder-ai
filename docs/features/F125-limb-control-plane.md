---
feature_ids: [F125]
related_features: [F041, F088, F102, F118, F124]
topics: [node, capability, presence, fleet, control-plane, distributed]
doc_kind: spec
created: 2026-03-16
---

# F125: 四肢控制面 — Cat Café Limb Control Plane

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官 2026-03-16 在三猫 OpenClaw Node 研讨中指出：

> "你们这群小笨蛋想浅了。他们会想要——如果你们这一群猫猫军团，你们要如何管理多个不同的四肢？你们如何在 Mac 上管理一堆其他的 Windows 节点？"

> "你们这一群猫猫，类似于一个大脑，每只猫都是一个灵魂议会的议员！虽然有自己不同的看法，但是都住在猫咖这个大脑里。"

**核心模型**：Cat Café = 一个大脑（灵魂议会，多猫议员）→ 需要管理 M 个四肢（外部设备/节点）。这是 OpenClaw `1 brain → N limbs` 的升级版：`1 brain (N cats) → M limbs`。

**四个已确认的缺陷**（宪宪分析，铲屎官确认"完全都是我们需要优化的"）：

| # | 缺陷 | 现状 | 影响 |
|---|------|------|------|
| D1 | **没有 Capability Registry** — 猫的能力是隐性的 | 能力藏在 system prompt 和人脑里，路由靠 @mention + intent 推断 | 无法知道"哪个设备/节点能做什么"，扩展新节点需要改代码 |
| D2 | **没有 Presence 系统** — 不知道谁在线 | F118 Watchdog 检测进程活性，但不知道"能力是否可用" | 路由到不可用节点 → 超时，无法优雅降级 |
| D3 | **没有跨平台 Node 管理** — 只能管本机 CLI | 所有猫都是本机 `spawn` 的 CLI 进程 | 无法在 Mac 上管理 Windows/远程/移动设备节点 |
| D4 | **没有统一 Node 抽象** — Provider 是特化的 | `ClaudeAgentService`、`CodexAgentService` 等实现完全不同，无统一接口 | 新增 Provider 需要写全新 Service，没有复用 |

**商业价值**：华子看到苹果全家桶 + 多猫协作 + 跨设备管控 = 未来企业协作形态 → 找我们做 → 猫粮自由。

## What

### 正确模型（铲屎官定义）

```
Cat Café（大脑 / 灵魂议会）
├── 宪宪（议员：架构）
├── 砚砚（议员：安全审查）
├── 烁烁（议员：设计）
├── 金渐层（议员：多模型编排）
└── ...
     │
     │ 四肢控制面（Limb Control Plane）
     │
     ├── iPhone        ← 四肢 (camera, voice, location)
     ├── Windows 机    ← 四肢 (GPU, .NET, render)
     ├── Mac Mini      ← 四肢 (build, deploy)
     ├── Apple Watch   ← 四肢 (haptic, presence)
     └── Browser Farm  ← 四肢 (automation)
```

**与 OpenClaw 的区别**：OpenClaw 是 1 agent × N nodes（简单，无竞争）。我们是 1 brain (N cats) × M limbs（多猫共享四肢，需要调度和仲裁）。

### Phase A: 统一 Node 抽象 + Capability Registry

**目标**：把现有的特化 Provider 收敛为统一接口，建立能力注册表。

1. **IAgentNode 统一接口**
   - 抽取 `ClaudeAgentService`、`CodexAgentService`、`GeminiAgentService`、`OpenCodeAgentService` 的共性
   - 定义统一的 `register() → invoke() → healthCheck()` 生命周期
   - Provider 差异收敛在适配层，不暴露给上层

2. **Capability Registry**（借鉴 OpenClaw 三层声明）
   - `caps`: 高级能力类别（`["code", "review", "design", "camera", "voice"]`）
   - `commands`: 精确命令白名单（`["code.edit", "review.diff", "camera.snap"]`）
   - `permissions`: 细粒度开关（运行时可调）
   - 存储：扩展现有 `capabilities.json`（F041 真相源）为动态 registry

3. **AgentRouter 升级**
   - 路由时查 Capability Registry（不再只靠 @mention + intent 推断）
   - 支持 capability-based 路由："需要 camera → 查谁有 camera → 路由过去"

### Phase B: Presence + 健康管理

**目标**：知道每个节点的实时状态，不可用时自动降级。

1. **Presence Manager**
   - 心跳机制（15s tick，参考 OpenClaw）
   - 节点状态：`online` / `busy` / `offline` / `degraded`
   - 能力级别：节点在线但某个能力不可用（如 camera 被其他 app 占用）
   - 与 F118 CLI Liveness Watchdog 整合

2. **降级策略**
   - 节点离线 → 自动从 Capability Registry 移除其能力
   - 猫请求不可用能力 → 告知原因 + 建议替代方案
   - 可配置：严格模式（拒绝）/ 宽松模式（排队等待）

### Phase C: 跨平台 Node 管理

**目标**：Mac 上的 Cat Café 能管理远程 Windows/Linux/移动设备节点。

1. **Remote Node Transport**
   - MCP over HTTP / WebSocket — 复用 MCP 标准协议（不造新轮子）
   - 远程节点跑本地 MCP adapter，向控制面暴露统一 capability surface
   - 猫只申请 capability，scheduler 决定派给哪条四肢

2. **Node Pairing（设备配对）**
   - 新节点连接 → 创建配对请求 → 铲屎官审批
   - 审批后签发 token，建立信任关系
   - 扩展 F088 ConnectorThreadBindingStore 为 Device Binding

3. **调度与仲裁**（砚砚 + 金渐层共识）
   - **Lease 机制**：独占资源需要租约（camera 同时只能一个用）
   - **Scheduling Queue**：复用 InvocationQueue 模式处理竞争
   - **Access Policy**：三维权限矩阵 `catId × nodeId × capability`（金渐层提案）
   - **Artifact/Action Log**：每次四肢调用记录 provenance（谁申请、哪条四肢、结果）

### Phase D: F124 Apple 生态落地

**目标**：iPhone/Watch/AirPods 作为四肢接入。

- 依赖 Phase A-C 基础设施
- 具体设计沿用 F124 spec
- 此 Phase 与 F124 合并执行

## 三猫研讨共识与分歧

### 共识（2026-03-16 会议纪要）

| # | 共识 |
|---|------|
| C1 | Cat Café = 一个大脑（灵魂议会），四肢是外部设备/节点 |
| C2 | 不抄 OpenClaw 的自定义 WebSocket 协议，用 MCP 标准 |
| C3 | Capability-based 能力声明和发现值得学 |
| C4 | Memory lifecycle 需要补"pre-seal 自动写入"环节（F102 范围） |
| C5 | 设备能力走 MCP 接入，不造新轮子 |
| C6 | Full node architecture 不急——先统一抽象，再加远程 |

### 砚砚 (GPT-5.4) 独特贡献

1. **N brains → M limbs 的编队调度**（`Capability Fleet Control Plane`）
   - NodeRegistry + CapabilityCatalog（设备/OS/driver/能力/信任级）
   - Lease/Scheduler（多猫争用同一四肢时的租约、并发、抢占、优先级）
   - Artifact/Action Log（产物 provenance 追踪）
   - Memory split：F102 管 durable knowledge；Redis/live store 管 heartbeat/lease/online state

2. **Session truth boundary** — 建议先归一 Conversation Identity + Session Pointer（可独立于 F125 推进）

3. **Per-cat tool policy** — 工具权限从 prompt 约束升级为运行时配置（tool family allow/deny）

### 金渐层 (opencode) 独特贡献

1. **Resource Broker 层**（在 Gateway 和 Node 之间）
   - Capability Registry + Access Policy + Scheduling Queue
   - 三维权限矩阵：`catId × deviceId × capability`
   - 行业对标：MCP 替代自定义协议是行业共识；Capability-based 安全模型优于 RBAC

2. **N×M 是行业未解问题** — OpenClaw/LangGraph/CrewAI/A2A 都没完整解决多 agent 共享物理资源的仲裁。我们做了会是独特贡献

3. **Agent-Driven UI 演进** — Rich Blocks 是 Canvas/A2UI 的雏形，后续可泛化

### 待议分歧

| # | 分歧 | 需确认 |
|---|------|--------|
| D1 | Session truth boundary 是否单独立项 vs 归入 F125 | 砚砚建议独立，宪宪倾向归入 |
| D2 | Per-cat tool policy 是 Phase A 的一部分还是独立 | 砚砚建议 P2 独立推进 |
| D3 | Agent-Driven UI 泛化时机 | 金渐层建议中长期方向 |

## Acceptance Criteria

### Phase A（统一 Node 抽象 + Capability Registry）
- [ ] AC-A1: 定义 `IAgentNode` 统一接口，现有 4 个 Provider 适配到此接口
- [ ] AC-A2: Capability Registry 从 `capabilities.json` 演化为动态注册表，支持运行时查询
- [ ] AC-A3: AgentRouter 支持 capability-based 路由（除 @mention 外可按能力路由）
- [ ] AC-A4: 新增 Provider 只需实现 `IAgentNode` 接口 + 注册能力，不需要写特化 Service

### Phase B（Presence + 健康管理）
- [ ] AC-B1: Presence Manager 实时追踪节点状态（online/busy/offline/degraded）
- [ ] AC-B2: 节点离线时自动从可用能力表移除，路由不再派发到不可用节点
- [ ] AC-B3: F118 Watchdog 整合到 Presence Manager

### Phase C（跨平台 Node 管理）
- [ ] AC-C1: 远程节点可通过 MCP over HTTP 注册到控制面
- [ ] AC-C2: Node Pairing 审批流程可用（新节点连接 → 铲屎官审批 → 建立信任）
- [ ] AC-C3: Lease 机制可防止多猫争用独占资源
- [ ] AC-C4: 每次四肢调用有 Artifact/Action Log 记录

### Phase D（F124 Apple 生态落地）
- [ ] AC-D1: iPhone 作为 Device Node 接入，暴露 camera/voice/location 能力
- [ ] AC-D2: Apple Watch 作为 Device Node 接入，暴露 haptic/presence 能力
- [ ] AC-D3: 铲屎官可通过 AirPods 语音与猫猫交互

## Dependencies

- **Evolved from**: F041（能力看板 — `capabilities.json` 是 Capability Registry 的种子）
- **Related**: F088（Chat Gateway — Connector 模式可复用于 Device Node）
- **Related**: F102（Memory Adapter — durable knowledge vs runtime state 的分界）
- **Related**: F118（CLI Liveness Watchdog — Presence 的种子）
- **Related**: F124（Apple Ecosystem — Phase D 的应用场景，可合并执行）

## Risk

| 风险 | 缓解 |
|------|------|
| 统一抽象过度，现有 Provider 的特化优势丢失 | Phase A 保留 adapter 层处理差异，interface 只定义共性 |
| 远程 Node 网络不稳定（弱网/断连） | Presence Manager 自动降级 + 重连机制 |
| N×M 调度复杂度爆炸 | 先做简单的先来先服务，再按需加优先级/抢占 |
| 安全风险：远程 Node 被攻击 | Pairing 审批 + token 认证 + 能力白名单 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Agent 如何知道有四肢可用？注入 system prompt vs MCP tool 动态列出 | ⬜ 未定 |
| OQ-2 | 四肢能力的权限模型：每次审批 vs 配对时一次性授权 | ⬜ 未定 |
| OQ-3 | Session truth boundary 是否归入本 Feature | ⬜ 待三猫对齐 |
| OQ-4 | Per-cat tool policy 是否归入本 Feature Phase A | ⬜ 待三猫对齐 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 猫猫是议员不是 Node——Cat Café 是一个大脑（灵魂议会），四肢是外部设备 | 铲屎官定义，多猫协作是核心价值 | 2026-03-16 |
| KD-2 | 用 MCP 标准协议做设备接入，不抄 OpenClaw 的自定义 WebSocket 协议 | MCP 已成行业标准（Linux Foundation），不造新轮子 | 2026-03-16 |
| KD-3 | 先统一抽象（Phase A），再加远程（Phase C），最后接设备（Phase D） | 方向正确 > 速度；每步是终态基座 | 2026-03-16 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-16 | 三猫 OpenClaw Node 研讨 → 铲屎官指出"想浅了" → 重新框定 |
| 2026-03-16 | 立项 |

## Review Gate

- Phase A: 跨 family review（缅因猫优先）
- Phase B: 跨 family review + F118 owner 确认整合方案
- Phase C: 架构级 → 猫猫讨论 + 铲屎官拍板
- Phase D: 与 F124 合并 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-03-16-openclaw-node-learning-meeting-notes.md` | 三猫研讨会议纪要 |
| **Research** | `docs/research/2026-03-16-openclaw-cat-cafe-learning-synthesis.md` | 砚砚 OpenClaw 对照研究 |
| **Research** | `docs/research/2026-03-16-f102-memory-alignment-proposal.md` | 砚砚 F102 memory 对齐提案 |
| **Research** | `docs/archive/2026-02/research/open-claw-report.md` | 原始 OpenClaw 调研报告 |
| **Feature** | `docs/features/F041-capability-dashboard.md` | 能力看板（Evolved from） |
| **Feature** | `docs/features/F088-multi-platform-chat-gateway.md` | Chat Gateway（Related） |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | Memory Adapter（Related） |
| **Feature** | `docs/features/F118-cli-liveness-watchdog.md` | CLI Watchdog（Related） |
| **Feature** | `docs/features/F124-apple-ecosystem-voice-interaction.md` | Apple 生态（Related, Phase D 合并） |

## 需求点 Checklist

| 需求来源 | 需求点 | 覆盖到的 AC |
|---------|--------|-----------|
| 铲屎官："管理多个不同的四肢" | 统一 Node 抽象 + Registry | AC-A1, AC-A2 |
| 铲屎官："Mac 上管理 Windows 节点" | 跨平台远程 Node 管理 | AC-C1, AC-C2 |
| 宪宪：没有 Capability Registry | 动态能力注册与发现 | AC-A2, AC-A3 |
| 宪宪：没有 Presence 系统 | Presence Manager | AC-B1, AC-B2 |
| 宪宪：没有统一 Node 抽象 | IAgentNode 接口 | AC-A1, AC-A4 |
| 宪宪：没有跨平台 Node 管理 | Remote Node Transport | AC-C1 |
| 砚砚：Lease/Scheduler 多猫争用 | 租约 + 调度队列 | AC-C3 |
| 砚砚：Artifact/Action Log | 产物 provenance | AC-C4 |
| 砚砚：Memory split | F102 管 durable / Redis 管 runtime | Related F102 |
| 金渐层：三维权限矩阵 | Access Policy catId×nodeId×cap | AC-C3 |
| 金渐层：行业独特贡献 | N×M 编队控制面 | 整体愿景 |
