---
feature_ids: [F126]
topics: [vision-guard, review, limb, control-plane]
doc_kind: review
created: 2026-03-17
---

# F126 四肢控制面 — 愿景守护报告 (Phase A / B / C)

> **守护者**: 金渐层 (opencode) | **日期**: 2026-03-17
> **审查范围**: Phase A (PR #507) + Phase B (PR #514) + F050 P3 A2A (PR #519) + Phase C (PR #528)
> **代码量**: ~2800 行新增 | **测试文件**: 7 个

---

## 方法

逐文件阅读全部 16 个关键实现文件，对照 spec `F126-limb-control-plane.md` 中 17 项 AC 逐条交叉验证。同时验证了 `index.ts` 的引导接线、types 的 re-export、以及 CapabilityEntry 向后兼容性。

---

## Phase A — 四肢抽象 + Capability Registry + Basic Presence

| AC | 描述 | 判定 | 证据 |
|----|------|------|------|
| **AC-A1** | `ILimbNode` 统一接口 (register/invoke/healthCheck/deregister)，不改动猫 Provider | **✅ PASS** | `limb.ts:5-12` — 4 方法签名完整。`AgentService` 接口未改动（grep 验证）。`RemoteLimbNode` 实现 `ILimbNode`。 |
| **AC-A2** | Capability Registry 从 capabilities.json 演化，静态/动态分离 | **✅ PASS** | `limb.ts:14-19` — `LimbCapability` 有 `caps`/`commands`/`permissions`。Registry 是运行时 `Map<string, ILimbNode>`，不混写 capabilities.json。 |
| **AC-A3** | Schema 包含 `catId × nodeId × capability` 三维结构 | **✅ PASS** | `limb.ts:21-27` — `LimbAccessEntry` 有 `catId`、`nodeId`、`capability`、`authLevel`。`LimbAccessPolicy.ts` 的 `checkAccess()` 接受这三个维度。 |
| **AC-A4** | 新四肢只需实现 ILimbNode + 注册能力 | **✅ PASS** | `LimbRegistry.register(id, node, record)` → 存入 Map。`RemoteLimbNode` 是活证——一个新四肢类型，100 行就接入了。 |
| **AC-A5** | capabilities.json schema 向后兼容 | **✅ PASS** | `capability.ts` — `type: 'mcp' \| 'skill' \| 'limb'`。原有 `mcp` 和 `skill` 不受影响，新增 `'limb'` 是纯 additive。 |
| **AC-A6** | Basic Presence — 节点状态追踪 + 离线自动移除 | **⚠️ PARTIAL** | `LimbPresenceManager.ts` 实现了完整的 4 状态(`online`/`busy`/`offline`/`degraded`) + 心跳超时检测 + 离线回调。**但 `start()` 未在 `index.ts` 中调用**，定时器永远不会启动。当前只有 `heartbeat()` 被 route 手动触发时才工作（被动模式）。超时自动离线检测是空操作。 |
| **AC-A7** | F118 Watchdog 映射函数预埋 | **✅ PASS** | `LimbPresenceManager.ts:89-99` — `mapProbeStateToLimbStatus()` 完整映射 6 种 F118 状态到 4 种 Limb 状态。函数已导出但未接线（spec 说"完整整合含事件接线在 Phase B"，预埋已满足）。 |
| **AC-A8** | MCP tool `limb_list_available` + `limb_invoke` + callback route | **✅ PASS** | `limb-tools.ts` 定义 4 个工具（list + invoke + pair_list + pair_approve）。`callback-limb-routes.ts` 注册 callback 端点。`index.ts:644` 将 `limbRegistry` 传入 callbacks。 |
| **AC-A9** | F126 只消费 session contract，不拥有 session truth | **✅ PASS** | 全部实现无 session 管理代码。`invocationId` 从 callback 上下文透传，不自行创建或管理 session。 |

### Phase A 总结: 8/9 PASS, 1 PARTIAL

**唯一缺口**: AC-A6 的 `LimbPresenceManager.start()` 未在 bootstrap 调用。影响：超时自动离线不工作。缓解：心跳触发的被动模式仍正常工作，远程节点通过 route 的 heartbeat 端点维持存活。

---

## Phase B — 调度层 (Lease + Access Policy + Action Log)

| AC | 描述 | 判定 | 证据 |
|----|------|------|------|
| **AC-B1** | Lease 机制防止多猫争用独占资源 | **✅ PASS** | `LimbLeaseManager.ts` — `acquire()` 检查现有 lease，同一 `nodeId+capability` 只允许一个持有者。第二只猫 acquire 会被拒绝并返回现有持有者信息。 |
| **AC-B2** | Lease 过期自动释放 | **✅ PASS** | `LimbLeaseManager.ts:42-52` — `acquire()` 内置过期检查，过期 lease 自动 delete。`releaseAllByCat()` 支持崩溃恢复。TTL 默认 60s 可配置。 |
| **AC-B3** | Limb Access Policy 三级授权 (free/leased/gated) | **✅ PASS** | `LimbAccessPolicy.ts` — `addRule()` + `checkAccess()` 基于三维 key。`authLevel` 类型为 `'free' \| 'leased' \| 'gated'`（定义在 `limb.ts:25`）。 |
| **AC-B4** | Action Log 最小 provenance 字段集 | **✅ PASS** | `limb.ts:37-49` — `LimbActionLogEntry` 包含全部 11 个字段：`requestId`, `invocationId`, `leaseId`, `catId`, `nodeId`, `capability`, `artifactUri`, `status`, `startedAt`, `endedAt`, `idempotencyKey`。`LimbActionLog.ts` 实现 `append()` + `query()` + maxEntries 淘汰。 |
| **AC-B5** | Runtime 活状态只进内存，不进 F102/evidence | **✅ PASS** | 所有 4 个 Phase B 模块（Policy/Lease/ActionLog/PresenceManager）均使用 `Map` 或数组，无 Redis/文件/F102 写入。 |

### Phase B 总结: 5/5 全部 PASS

**特别亮点**: `LimbRegistry.invoke()` 的管线设计精妙——
`命令白名单 → accessPolicy.checkAccess → leaseManager.acquire → actionLog.append(running) → node.invoke() → actionLog.append(completed) → finally: leaseManager.release`

---

## F050 Phase 3 — A2A 外部 Agent 接入

虽然 F050 P3 不在 F126 AC 列表内，但它是 Phase C 远程 Agent 类四肢的前置依赖（KD-8），且铲屎官明确将其列为愿景守护范围。

| 项目 | 判定 | 证据 |
|------|------|------|
| A2A 协议类型定义 | **✅ PASS** | `a2a.ts` — `A2ATask`(JSON-RPC), `A2AAgentCard`, `A2AAgentConfig` |
| A2A Agent Service | **✅ PASS** | `A2AAgentService.ts` — 实现 `AgentService` 接口, JSON-RPC 2.0 `tasks/send`, combined AbortSignal (caller abort + timeout) |
| 状态标准化 | **✅ PASS** | `a2a-event-transform.ts` — `normalizeStatus()` 处理 SCREAMING_SNAKE_CASE, artifact/history extraction |
| Bootstrap 接线 | **✅ PASS** | `index.ts:457-465` — `case 'a2a'` 在 provider switch 中，构造 `A2AAgentService` |
| 配置方式 | **⚠️ P2 残留** | Env var shim (`CAT_{ID}_A2A_URL`)，非正式配置模型。砚砚 review 时标记为 P2，接受暂不修 |

---

## Phase C — 跨平台 Node 管理

| AC | 描述 | 判定 | 证据 |
|----|------|------|------|
| **AC-C1** | 远程节点通过 HTTP 注册到控制面 | **✅ PASS** | `RemoteLimbNode.ts` — HTTP proxy 实现 `ILimbNode`。`POST /invoke` + `GET /health`。`limb-node-routes.ts` — `POST /register` 创建 `RemoteLimbNode` 实例并注册到 `LimbRegistry`。 |
| **AC-C2** | Node Pairing 审批流程 | **✅ PASS** | `LimbPairingStore.ts` — `pending → approved → rejected` 状态机。审批生成 apiKey。**仅 MCP callback auth 路径** (`callback-limb-routes.ts`)，公开路由已移除（砚砚 P1-1 安全修复）。 |
| **AC-C3** | 断线恢复 + 重连机制 | **✅ PASS** | `limb-node-routes.ts` — reconnect 处理 3 种情况：(1) 不在 registry → 新注册, (2) 离线但在 registry → apiKey 验证后重连, (3) endpoint 变化 → 更新 endpoint。心跳端点支持持续存活。 |

### Phase C 总结: 3/3 全部 PASS

**安全亮点**: 公共 pairing 路由已移除，审批只能通过 MCP callback auth（需 invocationId + callbackToken），防止自审批攻击。

---

## 综合评估

### 整体判定: **✅ PASS — 可以发用户指南**

| 维度 | 评分 | 说明 |
|------|------|------|
| **AC 覆盖度** | 16/17 (94%) | AC-A6 Partial（PresenceManager 未启动） |
| **架构合规** | ✅ | KD-3 严格遵守（猫 Provider 未改）, KD-7 遵守（runtime 不进 F102）|
| **安全** | ✅ | Pairing 审批仅 callback auth, apiKey 验证重连, 命令白名单 |
| **代码质量** | ✅ | 7 个测试文件, invoke 管线完整 try/finally |
| **向后兼容** | ✅ | CapabilityEntry additive 扩展 |

### 发现的缺口 (1 项)

| # | 缺口 | 严重程度 | 建议 |
|---|------|---------|------|
| G-1 | `LimbPresenceManager.start()` 未在 `index.ts` bootstrap 中调用 | **P2** | `index.ts` 中 `limbRegistry` 创建后添加 `new LimbPresenceManager()` + `.start()`，将超时回调连接到 `limbRegistry.deregister()`。目前被动心跳模式可用，不阻塞 Phase D。 |

### P2 残留 (1 项，已知)

| # | 残留 | 来源 |
|---|------|------|
| R-1 | A2A 配置用 env var shim，非正式配置模型 | 砚砚 review Phase C 时标记，接受为 P2 |

### 关键设计决策验证

| 决策 | 代码验证 | 结果 |
|------|---------|------|
| KD-1: 猫是议员不是 Node | AgentService 未改, ILimbNode 独立接口 | ✅ |
| KD-3: 不重构猫 Provider | `AgentService.invoke()` 未修改 | ✅ |
| KD-5: free/leased/gated 三级 | `LimbAccessPolicy` + `limb.ts:25` | ✅ |
| KD-6: MCP tool 动态暴露 | `limb_list_available` + `limb_invoke` | ✅ |
| KD-7: Runtime 不进 F102 | 全 in-memory, 无持久化写入 | ✅ |
| KD-9: 哑四肢 MCP, 有脑四肢 A2A | RemoteLimbNode (HTTP/MCP) + A2AAgentService (JSON-RPC) | ✅ |

---

## 结论

宪宪的 F126 Phase A/B/C 实现质量扎实，架构决策执行一致，安全考量到位。16/17 项 AC 完全通过，唯一的 Partial（AC-A6 PresenceManager 未启动）是 P2 级别，不影响核心功能路径。

**建议**：
1. Phase D 开始前补上 G-1（PresenceManager 启动 + 超时接线）
2. A2A 配置模型在 Phase D 或独立 debt item 中正式化

愿景守护通过。可以发用户指南。
