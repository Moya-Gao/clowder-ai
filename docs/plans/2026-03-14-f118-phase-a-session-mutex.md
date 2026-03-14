# F118 Phase A: Session Mutex + 超时诊断增强 Implementation Plan

**Feature:** F118 — `docs/features/F118-cli-liveness-watchdog.md`
**Goal:** 消除 cliSessionId 并发 resume 导致的 CLI 静默挂死，并增强超时诊断信息
**Acceptance Criteria:**
- AC-A1: 同一 cliSessionId 并发 resume 时，第二颗排队等待或 fail-fast
- AC-A2: SessionMutex 有独立单元测试
- AC-A3: __cliTimeout 事件包含增强诊断字段
- AC-A4: 回归测试复现"同 session 双 resume"场景
- AC-A5: 回归测试验证 timeout 诊断字段完整
**Architecture:** 新建 `SessionMutex` 类管理 per-cliSessionId 串行锁；在 `invoke-single-cat.ts` 拿到 sessionId 后、进入 service.invoke() 前加锁。`cli-spawn.ts` 的 timeout 事件增加诊断字段（通过 options 回调注入）。
**Tech Stack:** Node.js, node:test
**前端验证:** No — 纯后端

---

## Terminal Schema

```typescript
// SessionMutex — per-cliSessionId 串行锁
interface SessionMutexRelease {
  (): void;
}

class SessionMutex {
  acquire(sessionId: string, signal?: AbortSignal): Promise<SessionMutexRelease>;
  // acquire 语义:
  //   - 无竞争 → 立即返回 release 函数
  //   - 有竞争 → 排队等旧的结束（或 signal abort 时 reject）
  //   - 同一 sessionId 同时只有一个持锁者
}

// cli-spawn.ts __cliTimeout 增强
interface CliTimeoutEvent {
  __cliTimeout: true;
  timeoutMs: number;
  message: string;
  command: string;
  // 新增字段:
  firstEventAt: number | null;   // 第一条 NDJSON 事件时间戳
  lastEventAt: number | null;    // 最后一条 NDJSON 事件时间戳
  lastEventType: string | null;  // 最后一条事件的 type 字段
  silenceDurationMs: number;     // now - lastEventAt
  processAlive: boolean;         // timeout 触发当刻的存活快照（kill 之前采样）
}

// invoke-single-cat.ts 在调用时注入额外 context
interface CliSpawnOptions {
  // 新增（可选）:
  invocationId?: string;
  cliSessionId?: string;
}
```

## Not Building

- Phase B 的进程活性探针（CPU 采样）
- Phase C 的前端 UI
- 修改 InvocationTracker（保持不变）
- Codex CLI 上游修复

---

## Task 1: SessionMutex 类

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/SessionMutex.ts`
- Test: `packages/api/test/session-mutex.test.js`

### Step 1: Write failing test — basic acquire/release

```javascript
test('acquire returns release function when no contention', async () => {
  const mutex = new SessionMutex();
  const release = await mutex.acquire('session-1');
  assert.equal(typeof release, 'function');
  release();
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && node --test test/session-mutex.test.js`
Expected: FAIL — SessionMutex not found

### Step 3: Write minimal SessionMutex

```typescript
export class SessionMutex {
  private locks = new Map<string, { promise: Promise<void>; resolve: () => void }>();

  async acquire(sessionId: string, signal?: AbortSignal): Promise<() => void> {
    while (this.locks.has(sessionId)) {
      if (signal?.aborted) throw new Error('SessionMutex acquire aborted');
      await this.locks.get(sessionId)!.promise;
    }
    let resolveRelease!: () => void;
    const promise = new Promise<void>((r) => { resolveRelease = r; });
    this.locks.set(sessionId, { promise, resolve: resolveRelease });

    return () => {
      this.locks.delete(sessionId);
      resolveRelease();
    };
  }
}
```

### Step 4: Run test to verify it passes

### Step 5: Write failing test — serialization under contention

```javascript
test('second acquire waits until first releases', async () => {
  const mutex = new SessionMutex();
  const order = [];

  const release1 = await mutex.acquire('s1');
  order.push('acquired-1');

  const p2 = mutex.acquire('s1').then((release) => {
    order.push('acquired-2');
    return release;
  });

  // Give p2 a tick — it should NOT resolve yet
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(order, ['acquired-1']);

  release1();
  const release2 = await p2;
  assert.deepEqual(order, ['acquired-1', 'acquired-2']);
  release2();
});
```

### Step 6: Run test, verify pass (should pass with existing impl)

### Step 7: Write failing test — different sessionIds don't block

```javascript
test('different sessionIds do not block each other', async () => {
  const mutex = new SessionMutex();
  const release1 = await mutex.acquire('s1');
  const release2 = await mutex.acquire('s2'); // Should not block
  assert.equal(typeof release2, 'function');
  release1();
  release2();
});
```

### Step 8: Run test, verify pass

### Step 9: Write failing test — AbortSignal rejects queued acquire

```javascript
test('queued acquire rejects when signal aborted', async () => {
  const mutex = new SessionMutex();
  const release1 = await mutex.acquire('s1');

  const controller = new AbortController();
  const p2 = mutex.acquire('s1', controller.signal);

  controller.abort();
  await assert.rejects(p2, /aborted/);
  release1();
});
```

### Step 10: Run test — may need to adjust impl for abort during wait

### Step 11: Commit

```
feat(F118): add SessionMutex — per-cliSessionId serialization lock
```

---

## Task 2: 超时诊断增强 (cli-spawn.ts)

**Files:**
- Modify: `packages/api/src/utils/cli-spawn.ts`
- Modify: `packages/api/src/utils/cli-types.ts`
- Test: `packages/api/test/cli-spawn.test.js`

### Step 1: Write failing test — timeout event includes diagnostic fields

```javascript
test('timeout event includes firstEventAt/lastEventAt/silenceDurationMs/processAlive', async () => {
  const proc = createMockProcess({ exitOnKill: true });
  const spawnFn = () => proc;

  // Feed one event then go silent
  proc.stdout.write(JSON.stringify({ type: 'thread.started' }) + '\n');

  // Force very short timeout
  const gen = spawnCli({ command: 'test', args: [], timeoutMs: 50 }, { spawnFn });
  const events = await collect(gen);

  const timeout = events.find(isCliTimeout);
  assert.ok(timeout, 'should have timeout event');
  assert.equal(typeof timeout.firstEventAt, 'number');
  assert.equal(typeof timeout.lastEventAt, 'number');
  assert.equal(timeout.lastEventType, 'thread.started');
  assert.equal(typeof timeout.silenceDurationMs, 'number');
  assert.equal(typeof timeout.processAlive, 'boolean');
});
```

### Step 2: Run test to verify it fails

### Step 3: Implement — track event timestamps in spawnCli

In `cli-spawn.ts`, add tracking variables before the for-await loop:

```typescript
let firstEventAt: number | null = null;
let lastEventAt: number | null = null;
let lastEventType: string | null = null;
```

In the for-await loop, after `resetTimeout()`:

```typescript
const now = Date.now();
if (firstEventAt === null) firstEventAt = now;
lastEventAt = now;
if (typeof event === 'object' && event !== null && 'type' in event) {
  lastEventType = String((event as Record<string, unknown>).type);
}
```

In the `__cliTimeout` yield block, add fields:

```typescript
yield {
  __cliTimeout: true,
  timeoutMs,
  message: `CLI 响应超时 (${Math.round(timeoutMs / 1000)}s)`,
  command: options.command,
  firstEventAt,
  lastEventAt,
  lastEventType,
  silenceDurationMs: lastEventAt ? Date.now() - lastEventAt : timeoutMs,
  processAlive: !childExited,
};
```

### Step 4: Run test to verify it passes

### Step 5: Write failing test — timeout with zero events

```javascript
test('timeout with no events has null firstEventAt/lastEventAt', async () => {
  const proc = createMockProcess({ exitOnKill: true });
  const spawnFn = () => proc;
  // No events written to stdout — just let it timeout

  const gen = spawnCli({ command: 'test', args: [], timeoutMs: 50 }, { spawnFn });
  const events = await collect(gen);

  const timeout = events.find(isCliTimeout);
  assert.ok(timeout);
  assert.equal(timeout.firstEventAt, null);
  assert.equal(timeout.lastEventAt, null);
  assert.equal(timeout.lastEventType, null);
});
```

### Step 6: Run test, verify pass

### Step 7: Also pass through invocationId/cliSessionId from options

Add optional fields to `CliSpawnOptions`:

```typescript
/** Invocation context for diagnostic enrichment */
invocationId?: string;
cliSessionId?: string;
```

In `__cliTimeout` yield, add:

```typescript
...(options.invocationId ? { invocationId: options.invocationId } : {}),
...(options.cliSessionId ? { cliSessionId: options.cliSessionId } : {}),
```

### Step 8: Commit

```
feat(F118): enrich __cliTimeout with diagnostic fields
```

---

## Task 3: 接入 SessionMutex 到 invoke-single-cat.ts

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/index.ts` (export)

### Step 1: Import SessionMutex and create singleton

At module level in `invoke-single-cat.ts`:

```typescript
import { SessionMutex } from './SessionMutex.js';
const sessionMutex = new SessionMutex();
```

### Step 2: Wrap service.invoke() call with mutex

After sessionId is resolved (around line 397), before the retry loop (line 921):

```typescript
let sessionMutexRelease: (() => void) | undefined;
if (sessionId) {
  sessionMutexRelease = await sessionMutex.acquire(sessionId, signal);
}
```

In the `finally` block, release:

```typescript
sessionMutexRelease?.();
```

### Step 3: Pass invocationId/cliSessionId to baseOptions

In `baseOptions` construction (around line 547):

```typescript
...(invocationId ? { invocationId } : {}),
...(sessionId ? { cliSessionId: sessionId } : {}),
```

And ensure the AgentService passes these through to `spawnCli` options.

### Step 4: Integration test — verify mutex prevents concurrent resume

This test goes in the SessionMutex test file:

```javascript
test('integration: concurrent invocations with same sessionId are serialized', async () => {
  const mutex = new SessionMutex();
  const timeline = [];

  async function simulateInvocation(id) {
    const release = await mutex.acquire('shared-session');
    timeline.push(`start-${id}`);
    await new Promise((r) => setTimeout(r, 50)); // simulate work
    timeline.push(`end-${id}`);
    release();
  }

  await Promise.all([simulateInvocation('A'), simulateInvocation('B')]);

  // A and B should not overlap
  const startA = timeline.indexOf('start-A');
  const endA = timeline.indexOf('end-A');
  const startB = timeline.indexOf('start-B');
  assert.ok(startB > endA, 'B should start after A ends');
});
```

### Step 5: Commit

```
feat(F118): wire SessionMutex into invoke-single-cat
```

---

## Task 4: Final verification + cleanup

### Step 1: Run full test suite

```bash
cd packages/api && pnpm test
```

### Step 2: Run type check

```bash
pnpm lint
```

### Step 3: Run biome check

```bash
pnpm check
```

### Step 4: Verify file size limits

```bash
pnpm check:dir-size
```

### Step 5: Final commit if any cleanup needed
