---
feature_ids: [F126, F050]
topics: [guide, limb, control-plane, a2a, remote-node, device]
doc_kind: guide
created: 2026-03-17
---

# 四肢控制面使用指南 (Limb Control Plane)

> 关联: [F126 四肢控制面 Spec](../features/F126-limb-control-plane.md) | [F050 A2A 外部 Agent](../features/F050-a2a-external-agent-onboarding.md)

Cat Cafe 的四肢控制面让猫猫能管理和操控外部设备（iPhone、Windows 机、Mac Mini 等）。本指南面向**铲屎官**和**远程节点开发者**。

---

## 核心概念

```
Cat Café（大脑 / 灵魂议会）
├── 宪宪、砚砚、烁烁、金渐层（议员）
│
│  四肢控制面 (Limb Control Plane)
│
├── iPhone       ← 哑四肢 (camera, voice) — MCP 协议
├── Windows 机   ← 有脑四肢 (远程 Agent) — A2A 协议
├── Mac Mini     ← 哑四肢 (build, deploy) — MCP 协议
└── Browser Farm ← 哑四肢 (automation)   — MCP 协议
```

**两种四肢类型**：

| 类型 | 协议 | 适用场景 | 实现 |
|------|------|---------|------|
| **哑四肢** | MCP over HTTP | 设备控制、硬件操作（camera.snap, exec.run） | `RemoteLimbNode` → `ILimbNode` 接口 |
| **有脑四肢** | A2A (JSON-RPC 2.0) | 远程 Agent 对话（Windows 上的编码助手） | `A2AAgentService` → `AgentService` 接口 |

---

## 铲屎官操作指南

### 1. 审批新设备

当远程设备首次连接，它会进入 pending 状态，需要通过猫猫审批：

```
铲屎官: @宪宪 看看有没有新设备要连接

宪宪: (调用 limb_pair_list)
→ 发现 1 个待审批请求：
  - requestId: "req-abc123"
  - nodeId: "my-windows-pc"
  - displayName: "工作站 Windows"
  - platform: "windows"
  - 能力: gpu_render, exec

铲屎官: 批准这个

宪宪: (调用 limb_pair_approve, requestId: "req-abc123")
→ ✅ 已审批，设备已自动注册到 Registry
```

### 2. 查看在线四肢

```
铲屎官: @砚砚 现在有哪些四肢可用？

砚砚: (调用 limb_list_available)
→ 当前在线四肢：
  - my-windows-pc (online) — gpu_render, exec
  - iphone-1 (online) — camera, voice, location
```

### 3. 配置 A2A 远程 Agent

在 `.env` 中设置 A2A Agent URL：

```bash
# 格式: CAT_{CATID}_A2A_URL=<远程 Agent 的 A2A 端点>
CAT_REMOTE_CODER_A2A_URL=http://192.168.1.100:8080/a2a

# 同时需要在猫猫配置中设置 provider 为 a2a
# cat-config.yaml 中:
# cats:
#   remote-coder:
#     provider: a2a
```

配置后，猫猫可以像对话普通猫猫一样与远程 Agent 对话。A2A 使用 JSON-RPC 2.0 `tasks/send` 方法。

---

## 猫猫可用的 MCP 工具

猫猫**不需要新 skill**。以下 4 个 MCP 工具已自动注册，所有猫都可直接使用：

### `limb_list_available`

列出当前在线的四肢节点及其能力。

```json
// 可选参数
{ "capability": "camera" }  // 按能力类别过滤
```

### `limb_invoke`

调用指定四肢节点的能力。

```json
// 必填: nodeId, command
{
  "nodeId": "iphone-1",
  "command": "camera.snap",
  "params": { "resolution": "1080p" }
}
```

**调用管线**（自动执行）：
1. 命令白名单检查（只能调用节点声明的命令）
2. 访问策略检查（catId × nodeId × capability 三维权限）
3. 租约获取（独占资源自动加锁）
4. 操作日志记录（11 字段 provenance）
5. 执行命令
6. 自动释放租约

### `limb_pair_list`

列出待审批的设备配对请求。

### `limb_pair_approve`

审批配对请求。

```json
{ "requestId": "req-abc123" }
```

---

## 远程节点开发者指南

### 实现一个远程四肢节点

远程节点需要实现 2 个 HTTP 端点 + 调用 3 个 Cat Cafe API：

#### 节点侧端点（你需要实现的）

**POST /invoke** — 接收来自 Cat Cafe 的命令

```typescript
// 请求体
interface InvokeRequest {
  command: string;       // 如 "camera.snap"
  params: Record<string, unknown>;
}

// 响应
interface InvokeResponse {
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
}
```

**GET /health** — 健康检查

```typescript
// 响应
interface HealthResponse {
  status: 'online' | 'busy' | 'degraded';
  timestamp: string;
}
```

#### Cat Cafe API（你需要调用的）

**POST `/api/limb/register`** — 注册节点

```typescript
// 请求体
{
  "nodeId": "my-device-1",           // 唯一 ID
  "displayName": "我的 Windows 工作站",
  "platform": "windows",             // 平台标识
  "endpointUrl": "http://192.168.1.100:9000",  // 你的 HTTP 端点
  "capabilities": [
    {
      "cap": "gpu_render",
      "commands": ["render.image", "render.video"],
      "authLevel": "leased"          // free | leased | gated
    },
    {
      "cap": "exec",
      "commands": ["exec.run", "exec.status"],
      "authLevel": "free"
    }
  ]
}

// 响应
{
  "requestId": "req-abc123",  // 配对请求 ID
  "apiKey": "key-xyz789",     // 后续心跳/重连凭证（保存！）
  "status": "pending"         // pending → 等待铲屎官审批
}
```

**POST `/api/limb/heartbeat`** — 心跳保活（建议 15s 间隔）

```typescript
{
  "nodeId": "my-device-1",
  "apiKey": "key-xyz789"
}
```

**POST `/api/limb/deregister`** — 优雅断开

```typescript
{
  "nodeId": "my-device-1",
  "apiKey": "key-xyz789"
}
```

### 完整生命周期

```
1. 节点启动
   └─ POST /api/limb/register → 拿到 apiKey (status: pending)

2. 铲屎官审批
   └─ 猫猫调用 limb_pair_approve → status: approved
   └─ 节点自动注册到 Registry，猫猫可以调用

3. 心跳保活（每 15s）
   └─ POST /api/limb/heartbeat + apiKey

4. 猫猫调用能力
   └─ Cat Cafe → POST <endpointUrl>/invoke { command, params }
   └─ 你返回 { status, result }

5. 断线恢复
   └─ 重新 POST /api/limb/register（带上 apiKey）
   └─ 系统验证 apiKey 后自动重连，无需重新审批

6. 优雅退出
   └─ POST /api/limb/deregister + apiKey
```

### 权限模型

每个能力有三级授权：

| 级别 | 含义 | 适用场景 |
|------|------|---------|
| `free` | 无需审批，低风险 | 查询设备状态、读取传感器 |
| `leased` | 独占资源，自动租约 | 摄像头、屏幕（同时只能一猫用） |
| `gated` | 高风险，需铲屎官审批 | 生产部署、删除数据 |

### 安全要点

- **apiKey** 是注册时获得的凭证，必须安全保存
- 重连时必须提供正确的 apiKey，否则 403
- 配对审批**只能通过猫猫 MCP 工具**（callback auth），无公开审批端点
- 命令调用受白名单限制：只能执行注册时声明的 commands

---

## FAQ

**Q: 猫猫需要新的 skill 吗？**
A: 不需要。4 个 limb MCP 工具 (`limb_list_available`, `limb_invoke`, `limb_pair_list`, `limb_pair_approve`) 已自动注册到 MCP Server，所有猫都可以直接使用。

**Q: A2A 远程 Agent 和哑四肢有什么区别？**
A: A2A 远程 Agent 是有完整对话能力的 Agent（通过 `AgentService` 接口），猫猫可以和它"聊天"完成复杂任务。哑四肢是设备/工具（通过 `ILimbNode` 接口），猫猫发命令，设备执行。

**Q: 如何给猫猫提供远程 Agent？**
A: 设置环境变量 `CAT_{ID}_A2A_URL` 指向远程 Agent 的 A2A 端点，并在猫猫配置中设置 `provider: a2a`。远程 Agent 需要实现 Google A2A 协议（JSON-RPC 2.0 `tasks/send`）。

**Q: 多只猫同时要用摄像头怎么办？**
A: Lease 机制会自动处理。第一只猫获得租约，第二只猫会被拒绝（返回当前持有者信息）。租约有 TTL（默认 60s），超时自动释放，防止猫 crash 后永久锁定。

**Q: 设备断网了怎么办？**
A: 心跳超时后设备标记为 offline。恢复网络后，设备重新 `POST /api/limb/register`（带 apiKey），系统自动识别为重连，无需重新审批。

---

## 相关链接

- [F126 四肢控制面 Spec](../features/F126-limb-control-plane.md)
- [F050 A2A 外部 Agent Spec](../features/F050-a2a-external-agent-onboarding.md)
- [F118 CLI Liveness Watchdog](../features/F118-cli-liveness-watchdog.md) — Presence 种子
- [F124 Apple 生态](../features/F124-apple-ecosystem-voice-interaction.md) — Phase D 应用场景
