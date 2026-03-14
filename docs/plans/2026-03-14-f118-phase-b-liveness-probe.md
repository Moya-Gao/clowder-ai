# F118 Phase B: Process Liveness Detection + Tiered Timeout

**Feature:** F118 — `docs/features/F118-cli-liveness-watchdog.md`
**Goal:** 30 分钟静默不再是黑箱——进程活性探针区分 busy-silent / idle-silent / dead，分级预警让前端实时可见，hard cap 防 busy-loop 永不超时
**Acceptance Criteria:**
- AC-B1: 进程活性探针每 60s 采样 CPU 时间，`busy-silent` 延长超时至 bounded extension 上限，hard cap 一律 kill
- AC-B2: `idle-silent`（CPU 不涨 + 无输出）不重置计时器，正常走超时流程
- AC-B3: 进程已死（PID 不存在）时立即清理，不等超时
- AC-B4: 分级预警：静默 2min 发 `alive_but_silent`，5min 发 `suspected_stall`
- AC-B5: 后端产出 `__livenessWarning` 事件（`alive_but_silent` / `suspected_stall`），前端展示待 Phase C
- AC-A3-deferred: `rawArchivePath` 作为 provider-scoped 可选字段在 Codex timeout 路径可用
**Architecture:** 新建 `ProcessLivenessProbe` 类封装 CPU 采样 + 状态分类 + 预警生成。cli-spawn.ts 用 `Promise.race` 将 NDJSON 事件流和探针事件流合并，替换原有的简单 for-await。探针独立于 timeout 机制运行。
**Tech Stack:** Node.js, node:child_process (execFile for ps), node:test
**前端验证:** No — 纯后端（Phase C 做 UI）

---

## Terminal Schema

```typescript
// 活性状态
type LivenessState = 'active' | 'busy-silent' | 'idle-silent' | 'dead';

// 探针事件（yield 给消费者）
interface LivenessWarningEvent {
  __livenessWarning: true;
  state: LivenessState;
  silenceDurationMs: number;
  /** 'alive_but_silent' | 'suspected_stall' */
  level: 'alive_but_silent' | 'suspected_stall';
  cpuTimeMs?: number;      // macOS ps -o cputime=
  processAlive: boolean;
}

// 探针配置
interface ProbeConfig {
  sampleIntervalMs: number;  // default 60_000
  softWarningMs: number;     // default 120_000 (2 min)
  stallWarningMs: number;    // default 300_000 (5 min)
  boundedExtensionFactor: number; // default 2.0 (2x timeoutMs)
}

// ProcessLivenessProbe
class ProcessLivenessProbe {
  constructor(pid: number, config?: Partial<ProbeConfig>);
  /** Notify probe that output was received (resets silence timer) */
  notifyActivity(): void;
  /** Get current liveness state */
  getState(): LivenessState;
  /** Get pending warning events (drains queue) */
  drainWarnings(): LivenessWarningEvent[];
  /** Check if hard cap exceeded */
  isHardCapExceeded(elapsedMs: number, timeoutMs: number): boolean;
  /** Check if bounded extension applies */
  shouldExtendTimeout(): boolean;
  /** Start periodic sampling */
  start(): void;
  /** Stop and cleanup */
  stop(): void;
}
```

## Not Building

- Phase C 前端 UI（needs Design Gate）
- 修改 InvocationTracker
- 跨平台 CPU 采样（macOS only for now，Linux fallback 用 /proc/stat）
- SessionMutex 的 abort 分类优化（Phase A open question，可 Phase B 做但不 block）

---

## Task 1: ProcessLivenessProbe — CPU sampling + state classification

**Files:**
- Create: `packages/api/src/utils/ProcessLivenessProbe.ts`
- Test: `packages/api/test/process-liveness-probe.test.js`

### Step 1: Write failing test — probe starts and classifies initial state

```javascript
test('new probe starts in active state', () => {
  const probe = new ProcessLivenessProbe(process.pid, { sampleIntervalMs: 100 });
  assert.equal(probe.getState(), 'active');
  probe.stop();
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && node --test test/process-liveness-probe.test.js`
Expected: FAIL — ProcessLivenessProbe not found

### Step 3: Write minimal ProcessLivenessProbe

Core implementation:
- `notifyActivity()` — marks output received, resets silence tracking
- `getState()` — returns current liveness state based on silence + CPU
- CPU sampling via `execFile('ps', ['-o', 'cputime=', '-p', pid])`
- Parse `mm:ss.SS` or `hh:mm:ss` format to milliseconds
- State classification per spec table
- Warning queue with drain

### Step 4: Run test to verify pass

### Step 5: Write failing test — dead process detection

```javascript
test('detects dead process (PID does not exist)', async () => {
  const probe = new ProcessLivenessProbe(99999, { sampleIntervalMs: 50 });
  probe.start();
  await new Promise(r => setTimeout(r, 100));
  assert.equal(probe.getState(), 'dead');
  probe.stop();
});
```

### Step 6: Run test, verify pass with implementation

### Step 7: Write failing test — busy-silent detection

```javascript
test('classifies as busy-silent when CPU grows but no output', async () => {
  // Use own process PID — CPU is growing
  const probe = new ProcessLivenessProbe(process.pid, { sampleIntervalMs: 50 });
  probe.start();
  // Don't call notifyActivity — simulate silence
  await new Promise(r => setTimeout(r, 150)); // let 2+ samples run
  const state = probe.getState();
  // Own process should be busy (CPU growing)
  assert.equal(state, 'busy-silent');
  probe.stop();
});
```

### Step 8: Write failing test — warning generation at thresholds

```javascript
test('generates alive_but_silent warning at soft threshold', async () => {
  const probe = new ProcessLivenessProbe(process.pid, {
    sampleIntervalMs: 20,
    softWarningMs: 50,
    stallWarningMs: 200,
  });
  probe.start();
  await new Promise(r => setTimeout(r, 100));
  const warnings = probe.drainWarnings();
  assert.ok(warnings.some(w => w.level === 'alive_but_silent'));
  probe.stop();
});
```

### Step 9: Write failing test — suspected_stall warning

```javascript
test('generates suspected_stall warning at stall threshold', async () => {
  const probe = new ProcessLivenessProbe(process.pid, {
    sampleIntervalMs: 20,
    softWarningMs: 30,
    stallWarningMs: 80,
  });
  probe.start();
  await new Promise(r => setTimeout(r, 150));
  const warnings = probe.drainWarnings();
  assert.ok(warnings.some(w => w.level === 'suspected_stall'));
  probe.stop();
});
```

### Step 10: Write failing test — notifyActivity resets silence

```javascript
test('notifyActivity resets silence timer and clears warning state', async () => {
  const probe = new ProcessLivenessProbe(process.pid, {
    sampleIntervalMs: 20,
    softWarningMs: 50,
    stallWarningMs: 200,
  });
  probe.start();
  await new Promise(r => setTimeout(r, 30));
  probe.notifyActivity(); // reset silence
  await new Promise(r => setTimeout(r, 30));
  // Should NOT have warnings yet (silence < softWarningMs after reset)
  const warnings = probe.drainWarnings();
  const softWarnings = warnings.filter(w => w.level === 'alive_but_silent');
  assert.equal(softWarnings.length, 0);
  probe.stop();
});
```

### Step 11: Write failing test — bounded extension + hard cap

```javascript
test('shouldExtendTimeout returns true when busy-silent', async () => {
  const probe = new ProcessLivenessProbe(process.pid, { sampleIntervalMs: 50 });
  probe.start();
  await new Promise(r => setTimeout(r, 120));
  assert.equal(probe.shouldExtendTimeout(), true);
  probe.stop();
});

test('isHardCapExceeded returns true when elapsed exceeds factor * timeout', () => {
  const probe = new ProcessLivenessProbe(process.pid, { boundedExtensionFactor: 2 });
  assert.equal(probe.isHardCapExceeded(500, 300), false);
  assert.equal(probe.isHardCapExceeded(601, 300), true);
  probe.stop();
});
```

### Step 12: Commit

```
feat(F118): add ProcessLivenessProbe — CPU sampling + state classification
```

---

## Task 2: Integrate probe into cli-spawn.ts

**Files:**
- Modify: `packages/api/src/utils/cli-spawn.ts`
- Modify: `packages/api/src/utils/cli-types.ts` (add probe config options)
- Test: `packages/api/test/cli-spawn.test.js`

### Step 1: Add probe config to CliSpawnOptions

```typescript
// cli-types.ts — add optional fields
/** F118 Phase B: Liveness probe config (undefined = disabled) */
livenessProbe?: {
  sampleIntervalMs?: number;
  softWarningMs?: number;
  stallWarningMs?: number;
  boundedExtensionFactor?: number;
};
```

### Step 2: Write failing test — probe yields warning events during silence

```javascript
test('B4: yields alive_but_silent warning during CLI silence', async () => {
  const proc = createMockProcess({ exitOnKill: true });
  const spawnFn = createMockSpawnFn(proc);

  // Feed one event then go silent
  proc.stdout.write(JSON.stringify({ type: 'init' }) + '\n');

  const promise = collect(spawnCli({
    command: 'codex', args: [], timeoutMs: 500,
    livenessProbe: { sampleIntervalMs: 30, softWarningMs: 80, stallWarningMs: 300 },
  }, { spawnFn }));

  await new Promise(r => setTimeout(r, 600));

  const results = await promise;
  const warnings = results.filter(e => e?.__livenessWarning);
  assert.ok(warnings.length > 0, 'should have liveness warnings');
  assert.ok(warnings.some(w => w.level === 'alive_but_silent'));
});
```

### Step 3: Integrate probe into spawnCli

Key changes to cli-spawn.ts (minimal — ~20 net lines):

1. Import `ProcessLivenessProbe`
2. After child spawn, if `options.livenessProbe` → create probe instance, `probe.start()`
3. Replace simple `for await` with a polling loop that races NDJSON events vs probe warnings:

```typescript
// Replace: for await (const event of parseNDJSON(child.stdout))
// With: merged iteration that also yields probe warnings
const ndjson = parseNDJSON(child.stdout)[Symbol.asyncIterator]();
let ndjsonDone = false;
while (!ndjsonDone) {
  // Drain any pending probe warnings first
  if (probe) {
    for (const warning of probe.drainWarnings()) yield warning;
    // Dead process → immediate cleanup
    if (probe.getState() === 'dead') { killChild(); break; }
  }
  // Race: next NDJSON event vs probe poll interval
  const nextPromise = ndjson.next();
  const result = probe
    ? await Promise.race([
        nextPromise.then(r => ({ source: 'ndjson' as const, result: r })),
        new Promise<{ source: 'probe' }>(r => setTimeout(() => r({ source: 'probe' }), probe.config.sampleIntervalMs)),
      ])
    : { source: 'ndjson' as const, result: await nextPromise };

  if (result.source === 'probe') continue; // loop back to drain warnings
  const { done, value } = result.result;
  if (done) { ndjsonDone = true; break; }
  // ... existing event processing (resetTimeout, timestamp tracking, yield)
  if (probe) probe.notifyActivity();
}
```

4. In timeout callback, check `probe?.shouldExtendTimeout()` and `probe?.isHardCapExceeded()`
5. In finally block, `probe?.stop()`

### Step 4: Write failing test — B1: bounded extension for busy-silent

```javascript
test('B1: busy-silent extends timeout, but hard cap still kills', async () => {
  // Test that timeout is extended when CPU is active
  // but hard cap (2x) still triggers kill
});
```

### Step 5: Write failing test — B3: dead process immediate cleanup

```javascript
test('B3: dead process triggers immediate cleanup', async () => {
  const proc = createMockProcess({ exitOnKill: false });
  const spawnFn = createMockSpawnFn(proc);

  proc.stdout.write(JSON.stringify({ type: 'init' }) + '\n');

  // Simulate process dying
  proc._emitter.emit('exit', 1, null);

  const promise = collect(spawnCli({
    command: 'codex', args: [], timeoutMs: 5000,
    livenessProbe: { sampleIntervalMs: 30 },
  }, { spawnFn }));

  // Should finish quickly — not wait for timeout
  const results = await promise;
  // Should have early exit, not a 5s timeout
});
```

### Step 6: Commit

```
feat(F118): integrate ProcessLivenessProbe into cli-spawn
```

---

## Task 3: rawArchivePath provider-scoped diagnostic (AC-A3 deferred)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
- Modify: `packages/api/src/utils/cli-types.ts` (add rawArchivePath option)
- Test: `packages/api/test/cli-spawn.test.js`

### Step 1: Add `rawArchivePath` to CliSpawnOptions (optional)

```typescript
/** F118: Provider-scoped raw archive path for diagnostic enrichment */
rawArchivePath?: string;
```

### Step 2: Pass rawArchivePath in CodexAgentService cliOpts

Derive from `CliRawArchive.getPath(invocationId)` and pass through.

### Step 3: Include in __cliTimeout yield (if present)

```typescript
...(options.rawArchivePath ? { rawArchivePath: options.rawArchivePath } : {}),
```

### Step 4: Write test for rawArchivePath in timeout

### Step 5: Commit

```
feat(F118): add rawArchivePath provider-scoped diagnostic (Codex only)
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

cli-spawn.ts MUST stay under 350 lines. If over → extract helpers.

### Step 5: Final commit if any cleanup needed
