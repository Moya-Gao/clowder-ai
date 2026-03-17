# F126 Phase B: 调度层 — Lease/Scheduler + Access Policy + Action Log

**Feature:** F126 — `docs/features/F126-limb-control-plane.md`
**Goal:** 解决多猫争用四肢的调度、权限、审计问题——谁先用、谁能用、用了记录在案。
**Acceptance Criteria:**
- AC-B1: Lease 机制可防止多猫争用独占资源
- AC-B2: Lease 过期自动释放（猫 crash/超时不永久锁四肢）
- AC-B3: Limb Access Policy 实现三级授权（free/leased/gated）
- AC-B4: Action Log 记录最小 provenance 字段集（requestId/invocationId/leaseId/catId/nodeId/capability/artifactUri/status/startedAt/endedAt/idempotencyKey）
- AC-B5: runtime 活状态（heartbeat/lease/online）只进 Redis，不进 F102/evidence index
**Architecture:** 在 Phase A 的 LimbRegistry 之上新增三个模块：LimbLeaseManager（租约调度）、LimbAccessPolicy（三维权限检查）、LimbActionLog（provenance 审计）。LimbRegistry.invoke() 升级为先检查权限 → 获取租约 → 执行 → 记录日志的 pipeline。
**Tech Stack:** TypeScript, Node test runner
**前端验证:** No — 纯后端

---

## Not Building

- 不做 Scheduling Queue（v1 用简单的 lease 排他，非终态——spec 已标注）
- 不做远程 Node transport（Phase C）
- 不做 Redis 持久化（AC-B5 说"活状态只进 Redis"，但 Phase B 先用内存，Redis 适配是 follow-up）
- 不做铲屎官审批 UI（gated 权限在 Phase B 只做检查 + 拒绝，审批流程是 Phase C）

## Terminal Schema

```typescript
// packages/shared/src/types/limb.ts — 新增类型

/** 租约记录 */
export interface LimbLease {
  leaseId: string;
  nodeId: string;
  capability: string;
  catId: string;
  acquiredAt: number;
  expiresAt: number;
  /** 续期次数 */
  renewCount: number;
}

/** Action Log 条目 — 最小 provenance 字段集 */
export interface LimbActionLogEntry {
  requestId: string;
  invocationId: string;
  leaseId: string | null;
  catId: string;
  nodeId: string;
  capability: string;
  command: string;
  artifactUri: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  endedAt: number | null;
  idempotencyKey: string | null;
}
```

---

## Task 1: 新增 Phase B 类型定义

**Files:**
- Modify: `packages/shared/src/types/limb.ts` — 新增 `LimbLease` + `LimbActionLogEntry`
- Modify: `packages/shared/src/types/index.ts` — 加 re-export

**TDD:** TypeScript 编译通过 = 类型正确。`pnpm --filter @cat-cafe/shared build`

## Task 2: LimbAccessPolicy（三维权限检查）

**Files:**
- Create: `packages/api/src/domains/limb/LimbAccessPolicy.ts`
- Test: `packages/api/test/limb-access-policy.test.js`

**核心方法：**
```typescript
class LimbAccessPolicy {
  /** 添加权限条目 */
  setPolicy(entry: LimbAccessEntry): void
  /** 检查猫是否有权使用某节点的某能力 */
  check(catId: string, nodeId: string, capability: string): LimbAuthLevel
  /** 默认策略（未配置时回退到能力自身的 authLevel） */
  getEffectiveAuth(catId: string, nodeId: string, cap: LimbCapability): LimbAuthLevel
}
```

**TDD 顺序：**
1. `check returns capability's default authLevel when no policy set` → RED → implement → GREEN
2. `check returns overridden authLevel from policy` → RED → implement → GREEN
3. `setPolicy overrides default` → RED → implement → GREEN
4. `gated capability blocks without explicit policy` → RED → implement → GREEN

## Task 3: LimbLeaseManager（租约调度）

**Files:**
- Create: `packages/api/src/domains/limb/LimbLeaseManager.ts`
- Test: `packages/api/test/limb-lease.test.js`

**核心方法：**
```typescript
class LimbLeaseManager {
  constructor(options: { defaultTtlMs: number })
  /** 获取租约（独占资源） */
  acquire(catId: string, nodeId: string, capability: string): LimbLease | null
  /** 释放租约 */
  release(leaseId: string): void
  /** 续期 */
  renew(leaseId: string): boolean
  /** 检查是否有活跃租约 */
  isLeased(nodeId: string, capability: string): LimbLease | null
  /** 清理过期租约 */
  expireAll(): string[]  // returns expired leaseIds
  /** 按 catId 释放所有租约（猫 crash 时调用） */
  releaseAllByCat(catId: string): string[]
}
```

**TDD 顺序：**
1. `acquire returns lease for unleased capability` → RED → implement → GREEN
2. `acquire returns null when already leased by another cat` → RED → implement → GREEN
3. `acquire succeeds when leased by same cat (idempotent)` → RED → implement → GREEN
4. `release frees the lease` → RED → implement → GREEN
5. `renew extends expiry` → RED → implement → GREEN
6. `expireAll removes stale leases` → RED → implement → GREEN
7. `releaseAllByCat clears all leases for a cat` → RED → implement → GREEN
8. `isLeased returns active lease` → RED → implement → GREEN

## Task 4: LimbActionLog（provenance 审计）

**Files:**
- Create: `packages/api/src/domains/limb/LimbActionLog.ts`
- Test: `packages/api/test/limb-action-log.test.js`

**核心方法：**
```typescript
class LimbActionLog {
  /** 开始记录一次操作 */
  start(entry: Omit<LimbActionLogEntry, 'status' | 'endedAt'>): string  // returns requestId
  /** 标记完成 */
  complete(requestId: string, result: { artifactUri?: string }): void
  /** 标记失败 */
  fail(requestId: string, error: string): void
  /** 查询日志 */
  getByNode(nodeId: string, limit?: number): LimbActionLogEntry[]
  getByCat(catId: string, limit?: number): LimbActionLogEntry[]
  get(requestId: string): LimbActionLogEntry | undefined
}
```

**TDD 顺序：**
1. `start creates pending entry` → RED → implement → GREEN
2. `complete marks entry as completed with artifactUri` → RED → implement → GREEN
3. `fail marks entry as failed` → RED → implement → GREEN
4. `getByNode returns entries for node` → RED → implement → GREEN
5. `getByCat returns entries for cat` → RED → implement → GREEN
6. `entries have all required provenance fields` → RED → verify field coverage → GREEN

## Task 5: 升级 LimbRegistry.invoke() pipeline

**Files:**
- Modify: `packages/api/src/domains/limb/LimbRegistry.ts` — invoke 加 policy check + lease + action log
- Modify: `packages/api/test/limb-registry.test.js` — 加 pipeline 测试
- Modify: `packages/api/src/routes/callback-limb-routes.ts` — invoke route 传 catId

**升级 invoke 为 pipeline：**
```
invoke(catId, nodeId, command, params, invocationId?)
  → accessPolicy.getEffectiveAuth(catId, nodeId, cap)
  → if leased: leaseManager.acquire(catId, nodeId, cap) or reject
  → if gated: reject (Phase C 才有审批)
  → actionLog.start(...)
  → node.invoke(command, params)
  → actionLog.complete/fail(...)
  → return result
```

**TDD 顺序：**
1. `invoke with free capability succeeds without lease` → RED → implement → GREEN
2. `invoke with leased capability acquires lease` → RED → implement → GREEN
3. `invoke with leased capability rejects when already leased by other cat` → RED → implement → GREEN
4. `invoke with gated capability rejects` → RED → implement → GREEN
5. `invoke records action log entry` → RED → implement → GREEN
6. `invoke on failure records fail in action log` → RED → implement → GREEN

## Task 6: 升级 callback route 传 catId

**Files:**
- Modify: `packages/api/src/routes/callback-limb-routes.ts` — invoke route 从 invocation record 提取 catId
- Modify: `packages/api/test/callback-limb-routes.test.js` — 更新测试

callback route 的 `verify()` 返回 `InvocationRecord`，里面有 `catId`。把它传给 `registry.invoke()`。

## Task 7: Biome + lint + 全量测试

`pnpm check:fix` → `pnpm lint` → `pnpm --filter @cat-cafe/shared build` → 全部 limb 测试

---

## 验证检查点

Phase B 全部完成后的端到端验证：
1. MockLimbNode 注册，能力 authLevel 设为 `leased`
2. 猫 A invoke → 获取 lease → 成功
3. 猫 B invoke 同一能力 → 被拒绝（lease 冲突）
4. 猫 A lease 过期 → expireAll → 猫 B 可以 invoke
5. 猫 A crash → releaseAllByCat → 猫 B 可以 invoke
6. Action Log 有完整 provenance 记录
7. gated 能力被拒绝（Phase C 才有审批）
