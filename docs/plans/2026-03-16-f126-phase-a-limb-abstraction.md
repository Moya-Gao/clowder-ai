# F126 Phase A: 四肢抽象 + Capability Registry + Basic Presence

**Feature:** F126 — `docs/features/F126-limb-control-plane.md`
**Goal:** 让 Cat Café 知道"有哪些四肢、能做什么、在不在线"，新设备接入只需实现一个接口。
**Acceptance Criteria:**
- AC-A1: 定义 `ILimbNode` 统一接口（register/invoke/healthCheck/deregister），不改动现有猫 Provider
- AC-A2: Capability Registry 从 `capabilities.json` 演化，静态配置 vs 动态 live registry 职责分离
- AC-A3: Registry schema 从一开始包含 `catId × nodeId × capability` 三维结构
- AC-A4: 新增四肢类型只需实现 `ILimbNode` 接口 + 注册能力
- AC-A5: `capabilities.json` schema 升级向后兼容（现有 `type: mcp | skill` 不受影响）
- AC-A6: Basic Presence — 节点状态追踪（online/busy/offline/degraded），离线自动移除能力
- AC-A7: F118 Watchdog 整合到 Presence Manager
- AC-A8: MCP tool `limb_list_available` + `limb_invoke` 可用
- AC-A9: F126 只消费 session contract，不拥有 session truth 实现
**Architecture:** 新增四肢侧抽象层（ILimbNode + LimbRegistry + LimbPresenceManager），不改动现有猫 Provider（AgentService）。通过 MCP tools 暴露四肢能力给猫猫，通过 WebSocket 广播 presence 变更。
**Tech Stack:** TypeScript, Zod validation, Redis (presence state), Socket.io (presence broadcast), MCP Server (tool registration)
**前端验证:** No — Phase A 是纯后端 + MCP 工具层

---

## Not Building（Phase A 范围外）

- 不重构现有猫 Provider（ClaudeAgentService 等）
- 不做远程 Node transport（Phase C）
- 不做 Lease/Scheduler/Access Policy（Phase B）
- 不做 A2A/ACP 协议（F050 Phase 3）
- 不改 AgentRouter 路由逻辑（Phase A 只建 registry，路由升级是 follow-up）

## Terminal Schema（终态类型定义）

```typescript
// packages/shared/src/types/limb.ts — 新文件

/** 四肢节点状态 */
export type LimbNodeStatus = 'online' | 'busy' | 'offline' | 'degraded';

/** 能力授权级别（Phase B 用，Phase A 先定义） */
export type LimbAuthLevel = 'free' | 'leased' | 'gated';

/** 单个四肢能力 */
export interface LimbCapability {
  cap: string;           // 高级类别: "camera", "voice", "gpu_render"
  commands: string[];    // 精确命令: ["camera.snap", "camera.record"]
  authLevel: LimbAuthLevel;
}

/** 三维权限条目（Phase A 预留 schema，Phase B 实现） */
export interface LimbAccessEntry {
  catId: string;
  nodeId: string;
  capability: string;
  authLevel: LimbAuthLevel;
}

/** ILimbNode 接口 — 所有四肢必须实现 */
export interface ILimbNode {
  readonly nodeId: string;
  readonly displayName: string;
  readonly platform: string;       // "ios" | "macos" | "windows" | "linux" | "browser"
  readonly capabilities: LimbCapability[];

  register(): Promise<void>;
  invoke(command: string, params: Record<string, unknown>): Promise<LimbInvokeResult>;
  healthCheck(): Promise<LimbNodeStatus>;
  deregister(): Promise<void>;
}

/** 调用结果 */
export interface LimbInvokeResult {
  success: boolean;
  data?: unknown;
  artifactUri?: string;
  error?: string;
}

/** Registry 中的节点记录 */
export interface LimbNodeRecord {
  nodeId: string;
  displayName: string;
  platform: string;
  capabilities: LimbCapability[];
  status: LimbNodeStatus;
  registeredAt: number;
  lastHeartbeatAt: number;
}
```

```typescript
// CapabilityEntry 扩展 — packages/shared/src/types/capability.ts
// type 字段从 'mcp' | 'skill' 扩展为 'mcp' | 'skill' | 'limb'
```

---

## PR 1: ILimbNode 接口 + CapabilityEntry schema 扩展

**目标**：定义终态类型，schema 向后兼容。纯类型，零运行时影响。
**覆盖 AC**：AC-A1（接口定义）、AC-A3（三维 schema）、AC-A5（向后兼容）

### Task 1.1: 定义 limb 类型模块

**Files:**
- Create: `packages/shared/src/types/limb.ts`
- Modify: `packages/shared/src/types/index.ts` — 加 re-export
- Test: `packages/shared/test/types/limb.test.ts`

**Step 1: Write failing test** — limb types 可以被 import 和使用

**Step 2: Create `limb.ts`** — 按上面的 Terminal Schema 写入所有类型

**Step 3: Update `index.ts`** — 加 `export * from './types/limb.js';`

**Step 4: Run test, verify pass**

**Step 5: Commit** — `feat(F126): define ILimbNode interface + limb types`

### Task 1.2: 扩展 CapabilityEntry type union

**Files:**
- Modify: `packages/shared/src/types/capability.ts:37` — type 字段加 `'limb'`
- Test: `packages/shared/test/types/capability-limb.test.ts`

**Step 1: Write failing test** — CapabilityEntry 可以用 `type: 'limb'`

**Step 2: Modify `capability.ts`** — `type: 'mcp' | 'skill' | 'limb'`

**Step 3: Verify** — `pnpm --filter @cat-cafe/shared build` 通过，现有代码不受影响

**Step 4: Commit** — `feat(F126): extend CapabilityEntry type union with 'limb'`

### Task 1.3: shared 包 build 验证

**Step 1:** `pnpm --filter @cat-cafe/shared build`
**Step 2:** `pnpm lint` — 全局类型检查通过
**Step 3:** Commit（如有 build 产物变更）

---

## PR 2: LimbRegistry 实现

**目标**：内存中的四肢节点注册表，支持注册/注销/查询。
**覆盖 AC**：AC-A2（live registry）、AC-A4（新增四肢只需实现接口+注册）

### Task 2.1: LimbRegistry 核心

**Files:**
- Create: `packages/api/src/domains/limb/LimbRegistry.ts`
- Test: `packages/api/test/domains/limb/LimbRegistry.test.ts`

**核心方法：**
```typescript
class LimbRegistry {
  register(node: ILimbNode): Promise<LimbNodeRecord>
  deregister(nodeId: string): Promise<void>
  getNode(nodeId: string): LimbNodeRecord | undefined
  listAvailable(): LimbNodeRecord[]
  findByCapability(cap: string): LimbNodeRecord[]
  updateStatus(nodeId: string, status: LimbNodeStatus): void
}
```

**TDD 顺序：**
1. `test: register a node and retrieve it` → RED → implement register/getNode → GREEN
2. `test: deregister removes node` → RED → implement deregister → GREEN
3. `test: listAvailable returns only online nodes` → RED → implement listAvailable with status filter → GREEN
4. `test: findByCapability matches cap string` → RED → implement findByCapability → GREEN
5. `test: updateStatus changes node state` → RED → implement updateStatus → GREEN
6. `test: register duplicate nodeId throws` → RED → add guard → GREEN

**Step: Commit** — `feat(F126): implement LimbRegistry with CRUD + capability query`

### Task 2.2: Mock LimbNode 用于测试

**Files:**
- Create: `packages/api/test/domains/limb/MockLimbNode.ts`

一个简单的 `ILimbNode` 实现用于单元测试，验证 AC-A4（新增四肢只需实现接口）。

**Step: Commit** — `test(F126): add MockLimbNode for registry tests`

---

## PR 3: LimbPresenceManager（整合 F118 Watchdog）

**目标**：追踪四肢节点的在线状态，离线时自动从 registry 移除能力。
**覆盖 AC**：AC-A6（presence 追踪）、AC-A7（F118 整合）

### Task 3.1: LimbPresenceManager 核心

**Files:**
- Create: `packages/api/src/domains/limb/LimbPresenceManager.ts`
- Test: `packages/api/test/domains/limb/LimbPresenceManager.test.ts`

**核心方法：**
```typescript
class LimbPresenceManager {
  constructor(registry: LimbRegistry, options: { heartbeatIntervalMs: number, timeoutMs: number })

  recordHeartbeat(nodeId: string): void
  checkAll(): void                    // 检查所有节点，超时的标记 offline
  getStatus(nodeId: string): LimbNodeStatus
  onStatusChange(cb: (nodeId: string, from: LimbNodeStatus, to: LimbNodeStatus) => void): void

  start(): void                       // 启动定时检查
  stop(): void                        // 停止
}
```

**TDD 顺序：**
1. `test: recordHeartbeat keeps node online` → RED → implement → GREEN
2. `test: checkAll marks timed-out node as offline` → RED → implement timeout logic → GREEN
3. `test: offline node capabilities removed from registry available list` → RED → wire to registry.updateStatus → GREEN
4. `test: onStatusChange callback fires on transition` → RED → implement event emitter → GREEN
5. `test: start/stop lifecycle` → RED → implement setInterval/clearInterval → GREEN

**Step: Commit** — `feat(F126): implement LimbPresenceManager with heartbeat + auto-offline`

### Task 3.2: F118 ProcessLivenessProbe 整合点

**Files:**
- Modify: `packages/api/src/domains/limb/LimbPresenceManager.ts` — 加 `attachProcessProbe()` 方法

**设计**：对于本机 CLI 进程类的 limb node（未来场景），可以把 ProcessLivenessProbe 的 4 态映射到 LimbNodeStatus：
- `active` → `online`
- `busy-silent` → `busy`
- `idle-silent` → `degraded`
- `dead` → `offline`

Phase A 只做映射函数和接口，不改 ProcessLivenessProbe 本身。

**TDD 顺序：**
1. `test: mapProbeState maps 4 states correctly` → RED → implement → GREEN

**Step: Commit** — `feat(F126): add ProcessLivenessProbe → LimbNodeStatus mapping (AC-A7)`

---

## PR 4: MCP Tools（limb_list_available + limb_invoke）

**目标**：猫猫可以通过 MCP 工具查询和调用四肢。
**覆盖 AC**：AC-A8

### Task 4.1: 定义 limb MCP tools

**Files:**
- Create: `packages/mcp-server/src/tools/limb-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts` — 加 export
- Modify: `packages/mcp-server/src/server-toolsets.ts` — 加 `registerLimbToolset()`
- Test: `packages/mcp-server/test/tools/limb-tools.test.ts`

**Tool 定义：**

```typescript
// limb_list_available
{
  name: 'limb_list_available',
  description: '列出当前在线的四肢节点及其能力',
  inputSchema: {
    type: 'object',
    properties: {
      capability: { type: 'string', description: '按能力过滤（可选）' }
    }
  },
  handler: async ({ capability }) => {
    // 从 LimbRegistry.listAvailable() 或 findByCapability(capability) 获取
    return { content: [{ type: 'text', text: JSON.stringify(nodes) }] };
  }
}

// limb_invoke
{
  name: 'limb_invoke',
  description: '调用指定四肢节点的能力',
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: '目标节点 ID' },
      command: { type: 'string', description: '要执行的命令（如 camera.snap）' },
      params: { type: 'object', description: '命令参数' }
    },
    required: ['nodeId', 'command']
  },
  handler: async ({ nodeId, command, params }) => {
    // 从 LimbRegistry 查找节点 → 调用 node.invoke(command, params)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
```

**TDD 顺序：**
1. `test: limb_list_available returns empty when no nodes` → RED → implement handler → GREEN
2. `test: limb_list_available returns registered nodes` → RED → wire to registry → GREEN
3. `test: limb_list_available filters by capability` → RED → add filter logic → GREEN
4. `test: limb_invoke calls node.invoke and returns result` → RED → implement → GREEN
5. `test: limb_invoke returns error for unknown nodeId` → RED → add guard → GREEN
6. `test: limb_invoke returns error for offline node` → RED → add status check → GREEN

**Step: Commit** — `feat(F126): add limb_list_available + limb_invoke MCP tools`

### Task 4.2: 注册到 server-toolsets

**Step 1:** 在 `server-toolsets.ts` 添加 `registerLimbToolset()` 并集成到 `registerFullToolset()`
**Step 2:** 验证 MCP Server 启动正常
**Step 3:** Commit — `feat(F126): register limb toolset in MCP server`

---

## PR 粒度总结

| PR | 内容 | 影响现有代码？ | 风险 |
|----|------|--------------|------|
| PR 1 | 类型定义 + schema 扩展 | 改 `capability.ts` 一行 type union | 极低 |
| PR 2 | LimbRegistry 实现 | 纯新增 | 低 |
| PR 3 | LimbPresenceManager + F118 整合 | 不改 F118 代码，只加映射 | 低 |
| PR 4 | MCP tools + server 注册 | 改 `server-toolsets.ts` 和 `index.ts` | 低-中 |

**总 PR 数：4 个，每个独立可合入 main。**

---

## 验证检查点

每个 PR 合入后：
1. `pnpm check` — Biome lint 通过
2. `pnpm lint` — TypeScript 类型检查通过
3. `pnpm --filter @cat-cafe/shared build` — shared 包构建成功
4. 现有测试全部通过（不破坏现有功能）

Phase A 全部合入后的端到端验证：
1. 用 MockLimbNode 注册一个假节点
2. 通过 `limb_list_available` 查到它
3. 通过 `limb_invoke` 调用它
4. 模拟心跳超时，节点自动标记 offline
5. `limb_list_available` 不再返回它
