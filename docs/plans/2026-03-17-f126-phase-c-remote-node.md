# F126 Phase C: 跨平台远程 Node 管理

**Feature:** F126 — `docs/features/F126-limb-control-plane.md`
**Goal:** Mac 上的 Cat Café 能管理远程 Windows/Linux/移动设备节点——注册、配对、调用、断线恢复。
**Acceptance Criteria:**
- AC-C1: 远程节点可通过 MCP over HTTP 注册到控制面
- AC-C2: Node Pairing 审批流程可用（新节点连接 → 铲屎官审批 → 建立信任）
- AC-C3: 断线恢复 + 重连机制
**Architecture:** 新增 `RemoteLimbNode`（ILimbNode 的远程代理实现）+ HTTP 注册/心跳 API routes + Pairing 审批模块。远程节点跑本地 HTTP server 暴露 invoke 端点，Cat Café 侧的 RemoteLimbNode 把 invoke() 转发过去。
**Tech Stack:** TypeScript, Fastify routes, fetch API, Node test runner
**前端验证:** No — Phase C 纯后端（前端审批 UI 是 follow-up）

---

## Not Building

- 不做前端审批 UI（Phase C 用 API/MCP tool 审批，UI 是 follow-up）
- 不做 mDNS/自动发现（手动注册 endpoint）
- 不做 TLS 证书管理（开发阶段用 HTTP，生产 TLS 是 follow-up）
- 不做远程节点的 SDK/CLI（Phase C 只定义协议，节点侧实现是各平台自己的事）

## Architecture

```
远程节点 (Windows/iPhone)              Cat Café API (Mac)
┌──────────────────┐                ┌──────────────────────┐
│ HTTP Server      │                │ LimbRegistry         │
│ POST /invoke     │←── invoke() ──│ RemoteLimbNode proxy  │
│ GET /health      │←── health ────│ LimbPresenceManager   │
└──────────────────┘                │                      │
       │                           │ Pairing Store         │
       ├── POST /api/limb/register → create pairing req    │
       ├── POST /api/limb/heartbeat→ recordHeartbeat()     │
       └── POST /api/limb/deregister→ deregister()         │
                                   └──────────────────────┘
```

**两类四肢的协议路径**（KD-9）：
- **哑四肢**（camera/GPU）→ RemoteLimbNode 直接 HTTP invoke
- **有脑四肢**（远程 Agent）→ A2AAgentService 通过 A2A 协议

Phase C 实现哑四肢的远程管理。有脑四肢已由 F050 Phase 3 的 A2AAgentService 覆盖。

## Task 1: RemoteLimbNode（ILimbNode 的远程代理实现）

**Files:**
- Create: `packages/api/src/domains/limb/RemoteLimbNode.ts`
- Test: `packages/api/test/remote-limb-node.test.js`

远程节点在注册时提供自己的 HTTP endpoint。RemoteLimbNode 把 invoke/healthCheck 转发到那个 endpoint。

```typescript
class RemoteLimbNode implements ILimbNode {
  constructor(config: {
    nodeId: string;
    displayName: string;
    platform: string;
    capabilities: LimbCapability[];
    endpointUrl: string;  // 远程节点的 HTTP 地址
    apiKey?: string;      // 认证 token
  })

  invoke(command, params) → fetch(endpointUrl + '/invoke', { command, params })
  healthCheck() → fetch(endpointUrl + '/health')
  register() → no-op (registration is done via API route)
  deregister() → no-op
}
```

**TDD：**
1. `invoke forwards to remote endpoint` (mock fetch)
2. `invoke returns error on network failure`
3. `healthCheck returns status from remote`
4. `healthCheck returns offline on network failure`
5. `sends auth header when apiKey configured`

## Task 2: Limb Pairing Store（配对审批）

**Files:**
- Create: `packages/api/src/domains/limb/LimbPairingStore.ts`
- Test: `packages/api/test/limb-pairing.test.js`

```typescript
interface PairingRequest {
  requestId: string;
  nodeId: string;
  displayName: string;
  platform: string;
  endpointUrl: string;
  capabilities: LimbCapability[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt?: number;
  apiKey: string;  // 生成给远程节点用的 token
}

class LimbPairingStore {
  createRequest(params): PairingRequest
  approve(requestId): PairingRequest  // → 触发 RemoteLimbNode 注册到 Registry
  reject(requestId): void
  getPending(): PairingRequest[]
  getApproved(): PairingRequest[]
}
```

**TDD：**
1. `createRequest creates pending request with generated apiKey`
2. `approve changes status and returns request`
3. `reject changes status`
4. `getPending returns only pending requests`
5. `approve on already-approved is idempotent`

## Task 3: Limb Node API Routes（远程注册/心跳/注销）

**Files:**
- Create: `packages/api/src/routes/limb-node-routes.ts`
- Modify: `packages/api/src/index.ts` — 注册路由
- Test: `packages/api/test/limb-node-routes.test.js`

```
POST /api/limb/register     → 创建配对请求
POST /api/limb/heartbeat    → 更新心跳（需要 approved apiKey）
POST /api/limb/deregister   → 注销节点
POST /api/limb/pair/approve → 铲屎官审批配对（或通过 MCP tool）
POST /api/limb/pair/reject  → 铲屎官拒绝
GET  /api/limb/pair/pending → 查看待审批列表
```

**TDD（Fastify injection）：**
1. `register creates pairing request (200)`
2. `register returns requestId + generated apiKey`
3. `heartbeat with approved apiKey succeeds`
4. `heartbeat with unknown apiKey rejects (403)`
5. `approve registers RemoteLimbNode to Registry`
6. `reject removes request`
7. `pending returns only pending requests`

## Task 4: MCP Pairing Tools

**Files:**
- Modify: `packages/mcp-server/src/tools/limb-tools.ts` — 加 `limb_pair_approve` + `limb_pair_list`
- Modify: `packages/mcp-server/test/limb-tools.test.js`
- Modify: `packages/api/src/routes/callback-limb-routes.ts` — 加 pairing callback routes

猫猫可以通过 MCP 工具帮铲屎官审批配对请求（Phase C 不做前端 UI）。

## Task 5: 断线恢复 + 重连

**Files:**
- Modify: `packages/api/src/domains/limb/LimbPresenceManager.ts` — 加 reconnect 逻辑
- Modify: `packages/api/test/limb-presence.test.js`

断线恢复 = 已 approved 的节点重新发 heartbeat 后自动恢复 online 状态。
LimbPresenceManager 已有 recordHeartbeat() 可以 revive offline nodes，只需确保路由正确。

---

## 验证检查点

Phase C 完成后端到端验证：
1. 远程节点 POST /api/limb/register → 创建配对请求
2. 铲屎官通过 limb_pair_approve 审批
3. 审批后 RemoteLimbNode 自动注册到 Registry
4. 猫猫 limb_list_available 看到远程节点
5. 猫猫 limb_invoke → RemoteLimbNode → HTTP 转发到远程端点
6. 远程节点断线 → Presence 标记 offline
7. 远程节点恢复心跳 → 自动 online
