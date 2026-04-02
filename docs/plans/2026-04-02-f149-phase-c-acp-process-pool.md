# F149 Phase C: ACP Process Pool + Session Lease

**Feature:** F149 — `docs/features/F149-acp-runtime-operations.md`
**Goal:** 项目级进程池管理 ACP client 生命周期：thread 按需获取/释放 lease，idle process 自动回收，crash/zombie 自动清理，运行时指标可观测。
**Acceptance Criteria:**
- AC-C1: 默认进程池 key 为 `(projectPath, providerProfile)`，thread 不直接拥有 ACP process
- AC-C2: thread 获取和释放 lease 的控制面完成，inactive thread 不会长期 pin 住进程
- AC-C3: idle TTL / max live process count / eviction policy 可配置
- AC-C4: cancel / crash / timeout 后不会残留僵尸进程或悬挂 lease
- AC-C5: 并发 10 个活跃 thread 时，live process 数和 warm hit rate 都有可观测指标而非靠体感判断
**Architecture:**
Phase B 的 GeminiAcpAdapter 自己 lazy-init 一个共享 AcpClient。Phase C 把这个拆成 AcpProcessPool（进程池）→ AcpLease（短期占用）→ AcpPoolMetrics（可观测指标）。Adapter 从 pool 借 client，用完还。Pool 管理 idle TTL、eviction、zombie 清理。
**Tech Stack:** TypeScript, Node.js EventEmitter, setTimeout/setInterval, existing AcpClient
**前端验证:** No — 前端只读 adapterMode badge（Phase B 已完成），Phase C 不涉及新前端。

**设计决策（已拍板）：**
- KD-6: thread 持有 logical session binding，不持有 long process lease（lease 只在 prompt 执行期短暂存在）
- KD-7: 三层失败：process-poison → kill process / session-poison → seal session / turn-transient → retry
- KD-10: Gemini `supportsMultiplexing = true`（单进程多 session 并发）
- V1 pool key = per-project（cwd 绑定是 Gemini 硬约束）
- F048 StartupReconciler sweep 模式可复用

**NOT building:**
- 跨 project 进程复用（V2 待第二个 carrier）
- 前端 pool 仪表盘（指标先通过 API/日志暴露）
- Phase D 泛化（第二个 non-Gemini carrier）
- loadSession / session resume（Phase C+ 或独立 feature）

---

## Terminal Schema（最终形态的接口）

```typescript
// ── AcpProcessPool ──────────────────────────────────────────
interface AcpPoolConfig {
  maxLiveProcesses: number;        // default: 3
  idleTtlMs: number;               // default: 5 * 60 * 1000 (5 min)
  evictionPolicy: 'lru';           // V1 只支持 LRU
  healthCheckIntervalMs: number;   // default: 30 * 1000
}

interface PoolKey {
  projectPath: string;
  providerProfile: string;         // e.g. 'gemini-default'
}

interface AcpLease {
  client: AcpClient;
  poolKey: PoolKey;
  /** Release lease — marks the client as idle, starts TTL countdown */
  release(): void;
}

interface AcpPoolMetrics {
  liveProcessCount: number;
  activeLeaseCount: number;
  idleProcessCount: number;
  warmHitCount: number;             // acquired existing warm process
  coldStartCount: number;           // spawned new process
  evictionCount: number;            // evicted due to max or TTL
  zombieCleanupCount: number;       // killed unresponsive processes
}

class AcpProcessPool {
  constructor(config: Partial<AcpPoolConfig>, acpVariantConfig: AcpVariantConfig);

  /** Acquire a client lease. Reuses warm process if available, else spawns new. */
  acquire(poolKey: PoolKey): Promise<AcpLease>;

  /** Current metrics snapshot */
  getMetrics(): AcpPoolMetrics;

  /** Graceful shutdown — close all processes */
  closeAll(): Promise<void>;

  /** Startup sweep — kill orphaned processes from a previous API lifecycle */
  reconcileOrphans(): Promise<number>;
}
```

```typescript
// ── Modified GeminiAcpAdapter (Phase C) ─────────────────────
class GeminiAcpAdapter implements AgentService {
  // Phase B: private client + initPromise (REMOVED)
  // Phase C: private pool: AcpProcessPool (INJECTED)

  async *invoke(prompt, options?): AsyncIterable<AgentMessage> {
    const lease = await this.pool.acquire(this.poolKey);
    try {
      // ... same 4-window abort + promptStream logic as Phase B ...
      // but uses lease.client instead of this.client
    } finally {
      lease.release();
    }
  }
}
```

---

## Task 1: AcpProcessPool — core pool + acquire/release

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/acp/AcpProcessPool.ts`
- Test: `packages/api/test/acp/acp-process-pool.test.js`

### Step 1.1: Write failing test — acquire returns a lease with a live client

```javascript
// acp-process-pool.test.js
test('acquire returns a lease with a working client', async () => {
  const pool = new AcpProcessPool(defaultConfig, mockAcpVariantConfig);
  const lease = await pool.acquire({ projectPath: '/tmp/test', providerProfile: 'gemini-default' });
  assert.ok(lease.client);
  assert.ok(lease.client.isAlive);
  lease.release();
  await pool.closeAll();
});
```

Run: `node --test packages/api/test/acp/acp-process-pool.test.js`
Expected: FAIL — `AcpProcessPool` not found

### Step 1.2: Implement AcpProcessPool with acquire/release

Core structure:
- `entries: Map<string, PoolEntry[]>` keyed by `poolKey` serialized
- `PoolEntry = { client: AcpClient, leaseCount: number, lastUsedAt: number, state: 'initializing' | 'ready' | 'closing' }`
- `acquire()`: find entry with `state=ready`; if none and under max → spawn new; if at max → evict LRU idle → spawn new
- `release()`: decrement `leaseCount`, update `lastUsedAt`, if `leaseCount=0` → start idle TTL timer
- multiplexing: since `supportsMultiplexing=true`, multiple leases CAN share one process

```typescript
// Key logic: acquire
async acquire(poolKey: PoolKey): Promise<AcpLease> {
  const key = this.serializeKey(poolKey);
  let entries = this.entries.get(key) ?? [];

  // Try warm reuse (multiplexing: any ready entry)
  const warm = entries.find(e => e.state === 'ready');
  if (warm) {
    warm.leaseCount++;
    warm.lastUsedAt = Date.now();
    this.clearIdleTimer(warm);
    this.metrics.warmHitCount++;
    return this.createLease(warm, poolKey);
  }

  // Cold start (respecting maxLiveProcesses across ALL keys)
  if (this.totalLiveProcesses >= this.config.maxLiveProcesses) {
    this.evictOne();  // LRU idle process from any key
  }
  const entry = await this.spawnEntry(poolKey);
  entries.push(entry);
  this.entries.set(key, entries);
  this.metrics.coldStartCount++;
  return this.createLease(entry, poolKey);
}
```

### Step 1.3: Run test to verify it passes

Run: `node --test packages/api/test/acp/acp-process-pool.test.js`
Expected: PASS

### Step 1.4: Write failing test — acquire reuses warm process (multiplexing)

```javascript
test('acquire reuses warm process for second lease (multiplexing)', async () => {
  const pool = new AcpProcessPool(defaultConfig, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };
  const lease1 = await pool.acquire(key);
  const lease2 = await pool.acquire(key);
  assert.strictEqual(lease1.client, lease2.client);  // same underlying process
  assert.strictEqual(pool.getMetrics().warmHitCount, 1);
  assert.strictEqual(pool.getMetrics().coldStartCount, 1);
  lease1.release();
  lease2.release();
  await pool.closeAll();
});
```

### Step 1.5: Run — should PASS (multiplexing logic already in acquire)

### Step 1.6: Write failing test — release decrements lease count

```javascript
test('release decrements leaseCount and starts idle timer', async () => {
  const pool = new AcpProcessPool({ ...defaultConfig, idleTtlMs: 100 }, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };
  const lease = await pool.acquire(key);
  assert.strictEqual(pool.getMetrics().activeLeaseCount, 1);
  lease.release();
  assert.strictEqual(pool.getMetrics().activeLeaseCount, 0);
  assert.strictEqual(pool.getMetrics().idleProcessCount, 1);
  await pool.closeAll();
});
```

### Step 1.7: Commit

```bash
git add packages/api/src/domains/cats/services/agents/providers/acp/AcpProcessPool.ts \
       packages/api/test/acp/acp-process-pool.test.js
git commit -m "feat(F149): AcpProcessPool — acquire/release with warm reuse [布偶猫🐾]"
```

---

## Task 2: Idle TTL + LRU eviction

**Files:**
- Modify: `AcpProcessPool.ts`
- Test: `acp-process-pool.test.js`

### Step 2.1: Write failing test — idle process evicted after TTL

```javascript
test('idle process is closed after idleTtlMs', async () => {
  const pool = new AcpProcessPool({ ...defaultConfig, idleTtlMs: 50 }, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };
  const lease = await pool.acquire(key);
  lease.release();
  assert.strictEqual(pool.getMetrics().liveProcessCount, 1);
  await setTimeout(100);
  assert.strictEqual(pool.getMetrics().liveProcessCount, 0);
  assert.strictEqual(pool.getMetrics().evictionCount, 1);
  await pool.closeAll();
});
```

### Step 2.2: Implement idle timer in release path

When `leaseCount` drops to 0 → `setTimeout(idleTtlMs)` → if still idle → `entry.client.close()` + remove from entries + `metrics.evictionCount++`.

### Step 2.3: Write failing test — LRU eviction when at max

```javascript
test('evicts LRU idle process when maxLiveProcesses reached', async () => {
  const pool = new AcpProcessPool({ ...defaultConfig, maxLiveProcesses: 2 }, mockAcpVariantConfig);
  const key1 = { projectPath: '/tmp/a', providerProfile: 'gemini-default' };
  const key2 = { projectPath: '/tmp/b', providerProfile: 'gemini-default' };
  const key3 = { projectPath: '/tmp/c', providerProfile: 'gemini-default' };

  const l1 = await pool.acquire(key1);
  l1.release();  // idle, oldest
  const l2 = await pool.acquire(key2);
  l2.release();  // idle, newer

  assert.strictEqual(pool.getMetrics().liveProcessCount, 2);

  const l3 = await pool.acquire(key3);  // should evict key1 (LRU)
  assert.strictEqual(pool.getMetrics().liveProcessCount, 2);  // key1 evicted, key3 spawned
  assert.strictEqual(pool.getMetrics().evictionCount, 1);
  l3.release();
  await pool.closeAll();
});
```

### Step 2.4: Implement evictOne — find globally oldest idle entry, close it

### Step 2.5: Commit

```bash
git commit -m "feat(F149): idle TTL + LRU eviction for AcpProcessPool [布偶猫🐾]"
```

---

## Task 3: Health check + zombie cleanup (AC-C4)

**Files:**
- Modify: `AcpProcessPool.ts`
- Test: `acp-process-pool.test.js`

### Step 3.1: Write failing test — dead process detected and cleaned up

```javascript
test('health check detects dead process and removes it', async () => {
  const pool = new AcpProcessPool({ ...defaultConfig, healthCheckIntervalMs: 50 }, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };
  const lease = await pool.acquire(key);
  lease.release();

  // Simulate process death
  lease.client.child?.kill('SIGKILL');  // or mock isAlive to false

  await setTimeout(100);  // wait for health check cycle
  assert.strictEqual(pool.getMetrics().liveProcessCount, 0);
  assert.strictEqual(pool.getMetrics().zombieCleanupCount, 1);
  await pool.closeAll();
});
```

### Step 3.2: Implement periodic health check

```typescript
private startHealthCheck(): void {
  this.healthTimer = setInterval(() => {
    for (const [key, entries] of this.entries) {
      for (const entry of entries) {
        if (!entry.client.isAlive && entry.state === 'ready') {
          this.removeEntry(key, entry);
          this.metrics.zombieCleanupCount++;
        }
      }
    }
  }, this.config.healthCheckIntervalMs);
}
```

Also listen to AcpClient process 'exit' event for immediate detection (don't wait for interval).

### Step 3.3: Write failing test — acquire after zombie gives fresh process

```javascript
test('acquire after zombie cleanup spawns fresh process', async () => {
  // ... kill the process, wait for health check, then acquire again
  // Should get a new cold start, not a dead client
});
```

### Step 3.4: Commit

```bash
git commit -m "feat(F149): health check + zombie cleanup for AcpProcessPool [布偶猫🐾]"
```

---

## Task 4: Metrics API (AC-C5)

**Files:**
- Modify: `AcpProcessPool.ts`
- Create: `packages/api/src/routes/acp-pool.ts` (diagnostics endpoint)
- Test: `acp-process-pool.test.js` (metrics assertions already in Tasks 1-3)

### Step 4.1: Write failing test — getMetrics returns correct snapshot

```javascript
test('getMetrics reflects current pool state', async () => {
  const pool = new AcpProcessPool(defaultConfig, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };

  let m = pool.getMetrics();
  assert.strictEqual(m.liveProcessCount, 0);
  assert.strictEqual(m.activeLeaseCount, 0);

  const l1 = await pool.acquire(key);
  m = pool.getMetrics();
  assert.strictEqual(m.liveProcessCount, 1);
  assert.strictEqual(m.activeLeaseCount, 1);
  assert.strictEqual(m.coldStartCount, 1);

  const l2 = await pool.acquire(key);  // multiplexed
  m = pool.getMetrics();
  assert.strictEqual(m.activeLeaseCount, 2);
  assert.strictEqual(m.warmHitCount, 1);

  l1.release();
  l2.release();
  m = pool.getMetrics();
  assert.strictEqual(m.activeLeaseCount, 0);
  assert.strictEqual(m.idleProcessCount, 1);

  await pool.closeAll();
});
```

### Step 4.2: Add diagnostics route

```typescript
// routes/acp-pool.ts
app.get('/api/diagnostics/acp-pool', async () => {
  return pool.getMetrics();
});
```

### Step 4.3: Commit

```bash
git commit -m "feat(F149): ACP pool metrics + diagnostics endpoint [布偶猫🐾]"
```

---

## Task 5: Startup reconciler for ACP processes

**Files:**
- Modify: `AcpProcessPool.ts`
- Test: `acp-process-pool.test.js`

### Step 5.1: Write failing test — reconcileOrphans kills leftover processes

This is primarily a design concern: on API restart, any previously spawned `gemini --acp` processes are orphaned OS-level processes. The pool must not adopt them (different stdio pipe), so `reconcileOrphans()` is a safety net:

```javascript
test('closeAll kills all processes on shutdown', async () => {
  const pool = new AcpProcessPool(defaultConfig, mockAcpVariantConfig);
  const key = { projectPath: '/tmp/test', providerProfile: 'gemini-default' };
  const l1 = await pool.acquire(key);
  l1.release();
  const pids = pool.getActivePids();
  assert.ok(pids.length > 0);
  await pool.closeAll();
  assert.strictEqual(pool.getMetrics().liveProcessCount, 0);
});
```

Note: OS-level orphans from previous API lifecycle are handled by `child_process` auto-reaping when the parent dies. The pool's `closeAll()` ensures graceful shutdown for the current lifecycle. We register `closeAll` on `app.addHook('onClose')`.

### Step 5.2: Register pool shutdown on app close

```typescript
// In index.ts registration
app.addHook('onClose', async () => {
  await acpPool.closeAll();
});
```

### Step 5.3: Commit

```bash
git commit -m "feat(F149): ACP pool startup reconcile + graceful shutdown [布偶猫🐾]"
```

---

## Task 6: Wire GeminiAcpAdapter to use pool

**Files:**
- Modify: `GeminiAcpAdapter.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js`

### Step 6.1: Write failing test — adapter uses pool.acquire/release

```javascript
test('invoke acquires lease from pool and releases after done', async () => {
  const mockPool = createMockPool();
  const adapter = new GeminiAcpAdapter({ catId: 'gemini', pool: mockPool, poolKey });
  const messages = [];
  for await (const msg of adapter.invoke('hello')) messages.push(msg);
  assert.ok(mockPool.acquireCalled);
  assert.ok(mockPool.releaseCalled);
});
```

### Step 6.2: Refactor GeminiAcpAdapter

Remove:
- `private client: AcpClient | null`
- `private initPromise: Promise<void> | null`
- `ensureInitialized()` / `doInitialize()` / `close()`

Add:
- `private pool: AcpProcessPool` (constructor injection)
- `private poolKey: PoolKey`
- In `invoke()`: `const lease = await this.pool.acquire(this.poolKey)` → use `lease.client` → `lease.release()` in finally

The 4-window abort logic stays identical, just `this.client!` → `lease.client`.

### Step 6.3: Update index.ts registration

```typescript
case 'google': {
  const acpConfig = getAcpConfig(id);
  if (acpConfig) {
    // Phase C: create or reuse pool per variant
    const pool = getOrCreateAcpPool(acpConfig);
    const { GeminiAcpAdapter } = await import('./...GeminiAcpAdapter.js');
    service = new GeminiAcpAdapter({
      catId,
      pool,
      poolKey: { projectPath: process.cwd(), providerProfile: variantId },
    });
  }
  break;
}
```

### Step 6.4: Verify all existing adapter tests still pass

Run: `node --test packages/api/test/acp/gemini-acp-adapter.test.js`
Expected: all 10 pass (tests use mock, need to update mock to provide pool interface)

### Step 6.5: Commit

```bash
git commit -m "feat(F149): wire GeminiAcpAdapter to AcpProcessPool [布偶猫🐾]"
```

---

## Task 7: AcpPoolConfig from cat-config.json

**Files:**
- Modify: `cat-config-loader.ts`
- Test: `acp-process-pool.test.js`

### Step 7.1: Extend AcpVariantConfig with optional pool settings

```typescript
export interface AcpVariantConfig {
  command: string;
  startupArgs: string[];
  mcpWhitelist?: string[];
  supportsMultiplexing?: boolean;
  // Phase C: pool config (optional, has defaults)
  pool?: {
    maxLiveProcesses?: number;
    idleTtlMs?: number;
  };
}
```

### Step 7.2: Write test — pool respects config from cat-config.json

### Step 7.3: Commit

```bash
git commit -m "feat(F149): AcpPoolConfig from cat-config.json [布偶猫🐾]"
```

---

## Verification Checklist

| AC | Task | Verified by |
|----|------|-------------|
| C1 | Task 1 | Pool key = `(projectPath, providerProfile)`; adapter gets lease, not client |
| C2 | Task 1 + 2 | Lease acquire/release; idle TTL auto-evicts |
| C3 | Task 2 + 7 | idleTtlMs, maxLiveProcesses, evictionPolicy configurable |
| C4 | Task 3 + 5 | Health check + zombie cleanup + graceful shutdown |
| C5 | Task 4 | getMetrics() + `/api/diagnostics/acp-pool` endpoint |
