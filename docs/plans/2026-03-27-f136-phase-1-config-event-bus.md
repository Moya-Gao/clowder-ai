---
feature_ids: [F136]
related_features: [F004, F088, F127]
topics: [config, hot-reload, event-bus]
doc_kind: plan
created: 2026-03-27
---

# F136 Phase 1: ConfigEventBus + ConfigChangeEvent Schema

**Feature:** F136 — `docs/features/F136-unified-config-hot-reload.md`
**Goal:** 建立统一的配置变更 event bus，让所有配置变更走同一条管线发射事件，为 Phase 2（connector 热重载）提供基座
**Acceptance Criteria:**
- AC-1: ConfigChangeEvent schema 定义完整（source/scope/changedKeys/changeSetId/timestamp）
- AC-2: ConfigEventBus 单例可被任意模块 import 并订阅
- AC-3: PATCH /api/config/env 变更后自动发射 ConfigChangeEvent（scope=key）
- AC-4: ConfigStore.set() 变更后自动发射 ConfigChangeEvent（scope=key）
- AC-5: 订阅者可按 key pattern 过滤事件
- AC-6: 所有现有测试不受影响（纯加法）
**Architecture:** Node.js EventEmitter 单例，两个现有 config 变更入口（PATCH env + ConfigStore.set）在变更完成后 emit 事件。纯加法改动，不改任何现有行为。
**Tech Stack:** Node.js EventEmitter, TypeScript, node:test
**前端验证:** No — 纯后端基座，无 UI 变更

---

## Straight-Line Check

**Finish line (B):** 一个全局 ConfigEventBus 单例，任何模块都能 import 并订阅配置变更事件。现有两个 config 变更路径（PATCH /api/config/env、ConfigStore.set）在变更完成后自动 emit 事件。

**NOT building:**
- Connector restart/reload（Phase 2）
- `/api/config/secrets` endpoint（Phase 2）
- File watcher（手动编辑 .env 的 watch 是 Phase 2+ 范围）
- F127 runtime-cat-catalog 收编（Phase 3）
- Debounce/coalesce（Phase 2 需要时再加，Phase 1 是 API-driven 变更，不需要防抖）

## Terminal Schema

```typescript
// packages/api/src/config/config-event-bus.ts

type ConfigChangeSource = 'env' | 'config-store' | 'cat-config' | 'provider-profile' | 'secrets';
type ConfigChangeScope = 'key' | 'domain' | 'file';

interface ConfigChangeEvent {
  source: ConfigChangeSource;
  scope: ConfigChangeScope;
  changedKeys: string[];
  changeSetId: string;   // crypto.randomUUID()
  timestamp: number;     // Date.now()
}

class ConfigEventBus extends EventEmitter {
  emitChange(event: ConfigChangeEvent): void;
  onConfigChange(listener: (event: ConfigChangeEvent) => void): () => void;
  onKeysChange(keys: string[], listener: (event: ConfigChangeEvent) => void): () => void;
}

// Singleton export
export const configEventBus: ConfigEventBus;
```

---

## Task 1: ConfigEventBus + ConfigChangeEvent types

**Files:**
- Create: `packages/api/src/config/config-event-bus.ts`
- Test: `packages/api/test/config-event-bus.test.js`

### Step 1: Write failing tests

```javascript
// packages/api/test/config-event-bus.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('ConfigEventBus', () => {
  let bus;

  beforeEach(async () => {
    // Import fresh each time to test singleton behavior
    const mod = await import('../src/config/config-event-bus.js');
    bus = mod.configEventBus;
    bus.removeAllListeners();
  });

  it('emitChange delivers event to onConfigChange listeners', () => {
    const received = [];
    bus.onConfigChange((event) => received.push(event));

    bus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['TELEGRAM_BOT_TOKEN'],
      changeSetId: 'test-1',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1);
    assert.deepEqual(received[0].changedKeys, ['TELEGRAM_BOT_TOKEN']);
  });

  it('onKeysChange only fires when matching keys change', () => {
    const received = [];
    bus.onKeysChange(['FEISHU_APP_ID', 'FEISHU_APP_SECRET'], (event) =>
      received.push(event),
    );

    // Non-matching key
    bus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['TELEGRAM_BOT_TOKEN'],
      changeSetId: 'test-2',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 0, 'should not fire for non-matching key');

    // Matching key
    bus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['FEISHU_APP_ID'],
      changeSetId: 'test-3',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1, 'should fire for matching key');
  });

  it('onKeysChange fires on file-scope events (cannot filter by key)', () => {
    const received = [];
    bus.onKeysChange(['ANYTHING'], (event) => received.push(event));

    bus.emitChange({
      source: 'env',
      scope: 'file',
      changedKeys: [],
      changeSetId: 'test-4',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1, 'file-scope should always fire (degraded)');
  });

  it('onConfigChange returns unsubscribe function', () => {
    const received = [];
    const unsub = bus.onConfigChange((event) => received.push(event));

    bus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['X'],
      changeSetId: 'test-5',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1);

    unsub();

    bus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['Y'],
      changeSetId: 'test-6',
      timestamp: Date.now(),
    });

    assert.equal(received.length, 1, 'should not receive after unsub');
  });
});
```

### Step 2: Run test, verify it fails

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f136-config-hot-reload
node --test packages/api/test/config-event-bus.test.js
```

Expected: FAIL — `Cannot find module '../src/config/config-event-bus.js'`

### Step 3: Write minimal implementation

```typescript
// packages/api/src/config/config-event-bus.ts
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

// ── Types ──

export type ConfigChangeSource =
  | 'env'
  | 'config-store'
  | 'cat-config'
  | 'provider-profile'
  | 'secrets';

export type ConfigChangeScope = 'key' | 'domain' | 'file';

export interface ConfigChangeEvent {
  source: ConfigChangeSource;
  scope: ConfigChangeScope;
  changedKeys: string[];
  changeSetId: string;
  timestamp: number;
}

// ── Helper ──

export function createChangeSetId(): string {
  return randomUUID();
}

// ── Bus ──

const CONFIG_CHANGE = 'config:change';

class ConfigEventBus extends EventEmitter {
  emitChange(event: ConfigChangeEvent): void {
    this.emit(CONFIG_CHANGE, event);
  }

  /** Subscribe to all config changes. Returns unsubscribe function. */
  onConfigChange(listener: (event: ConfigChangeEvent) => void): () => void {
    this.on(CONFIG_CHANGE, listener);
    return () => this.off(CONFIG_CHANGE, listener);
  }

  /**
   * Subscribe to changes affecting specific keys.
   * file-scope events (no key info) always fire (degraded mode).
   * Returns unsubscribe function.
   */
  onKeysChange(
    keys: string[],
    listener: (event: ConfigChangeEvent) => void,
  ): () => void {
    const keySet = new Set(keys);
    const filtered = (event: ConfigChangeEvent) => {
      if (event.scope === 'file' || event.changedKeys.length === 0) {
        listener(event);
        return;
      }
      if (event.changedKeys.some((k) => keySet.has(k))) {
        listener(event);
      }
    };
    this.on(CONFIG_CHANGE, filtered);
    return () => this.off(CONFIG_CHANGE, filtered);
  }
}

export const configEventBus = new ConfigEventBus();
```

### Step 4: Run test, verify it passes

```bash
node --test packages/api/test/config-event-bus.test.js
```

Expected: 4/4 PASS

### Step 5: Commit

```bash
git add packages/api/src/config/config-event-bus.ts packages/api/test/config-event-bus.test.js
git commit -m "feat(F136): add ConfigEventBus + ConfigChangeEvent schema [宪宪/Opus-46🐾]"
```

---

## Task 2: Wire PATCH /api/config/env to emit ConfigChangeEvent

**Files:**
- Modify: `packages/api/src/routes/config.ts:251-295` (PATCH handler)
- Test: `packages/api/test/config-event-bus-integration.test.js` (new)

### Step 1: Write failing integration test

```javascript
// packages/api/test/config-event-bus-integration.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { configEventBus } from '../src/config/config-event-bus.js';

describe('PATCH /api/config/env → ConfigEventBus integration', () => {
  let unsub;
  const received = [];

  beforeEach(() => {
    received.length = 0;
    unsub = configEventBus.onConfigChange((e) => received.push(e));
  });

  afterEach(() => {
    unsub?.();
  });

  it('emits config:change with source=env after successful PATCH', async () => {
    // Build a real Fastify app with the config route
    const { buildApp } = await import('../src/test-helpers/build-app.js');
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/config/env',
      payload: {
        updates: [{ name: 'PREVIEW_GATEWAY_PORT', value: '4200' }],
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(received.length, 1);
    assert.equal(received[0].source, 'env');
    assert.equal(received[0].scope, 'key');
    assert.deepEqual(received[0].changedKeys, ['PREVIEW_GATEWAY_PORT']);
    assert.ok(received[0].changeSetId);
    assert.ok(received[0].timestamp);

    await app.close();
  });
});
```

> Note: 如果项目没有 `build-app.js` test helper，这个测试需要适配现有的集成测试模式。实现时检查 `packages/api/test/` 里其他集成测试怎么起 Fastify。

### Step 2: Run test, verify it fails

Expected: FAIL — no event emitted (received.length === 0)

### Step 3: Modify PATCH handler to emit event

在 `config.ts` 的 PATCH /api/config/env handler 里，process.env 赋值循环之后，加 emit：

```typescript
// After the existing process.env mutation loop (line ~279)
import { configEventBus, createChangeSetId } from '../config/config-event-bus.js';

// ... existing code: for (const [name, value] of updates) { process.env[name] = value; }

// NEW: emit ConfigChangeEvent
configEventBus.emitChange({
  source: 'env',
  scope: 'key',
  changedKeys: [...updates.keys()],
  changeSetId: createChangeSetId(),
  timestamp: Date.now(),
});
```

### Step 4: Run test, verify it passes

### Step 5: Run existing config tests to verify no regression

```bash
node --test packages/api/test/config-hotreload.test.js
node --test packages/api/test/env-registry.test.js
```

Expected: all PASS (纯加法，不改现有行为)

### Step 6: Commit

```bash
git add packages/api/src/routes/config.ts packages/api/test/config-event-bus-integration.test.js
git commit -m "feat(F136): wire PATCH /api/config/env to emit ConfigChangeEvent [宪宪/Opus-46🐾]"
```

---

## Task 3: Wire ConfigStore.set() to emit ConfigChangeEvent

**Files:**
- Modify: `packages/api/src/config/ConfigStore.ts:72-86` (set method)
- Test: add to `packages/api/test/config-event-bus.test.js`

### Step 1: Write failing test

```javascript
// Add to config-event-bus.test.js
describe('ConfigStore → ConfigEventBus integration', () => {
  it('ConfigStore.set() emits config:change with source=config-store', () => {
    const { configStore } = await import('../src/config/ConfigStore.js');
    const received = [];
    const unsub = bus.onConfigChange((e) => received.push(e));

    configStore.set('cli.timeoutMs', 600000);

    assert.equal(received.length, 1);
    assert.equal(received[0].source, 'config-store');
    assert.equal(received[0].scope, 'key');
    assert.deepEqual(received[0].changedKeys, ['CLI_TIMEOUT_MS']);

    unsub();
    configStore.reset();
  });
});
```

### Step 2: Run test, verify it fails

Expected: FAIL — received.length === 0

### Step 3: Modify ConfigStore.set() to emit event

在 `ConfigStore.ts` 的 `set()` 方法末尾加 emit：

```typescript
import { configEventBus, createChangeSetId } from './config-event-bus.js';

// In set() method, after line 85 (clearBudgetCache):
configEventBus.emitChange({
  source: 'config-store',
  scope: 'key',
  changedKeys: [definition.envKey],
  changeSetId: createChangeSetId(),
  timestamp: Date.now(),
});
```

### Step 4: Run test, verify it passes

### Step 5: Run existing ConfigStore tests

```bash
node --test packages/api/test/config-hotreload.test.js
node --test packages/api/test/config-registry.test.js
```

Expected: all PASS

### Step 6: Commit

```bash
git add packages/api/src/config/ConfigStore.ts packages/api/test/config-event-bus.test.js
git commit -m "feat(F136): wire ConfigStore.set() to emit ConfigChangeEvent [宪宪/Opus-46🐾]"
```

---

## Task 4: Final verification + baseline

### Step 1: Run full test suite

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f136-config-hot-reload
pnpm test
```

### Step 2: Run type check

```bash
pnpm lint
```

### Step 3: Run biome

```bash
pnpm check
```

Expected: all PASS, no new diagnostics

### Step 4: Final commit (if any cleanup)

---

## File Change Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `packages/api/src/config/config-event-bus.ts` | Create | ~65 |
| `packages/api/src/routes/config.ts` | Modify | +8 (import + emitChange) |
| `packages/api/src/config/ConfigStore.ts` | Modify | +8 (import + emitChange) |
| `packages/api/test/config-event-bus.test.js` | Create | ~100 |
| `packages/api/test/config-event-bus-integration.test.js` | Create | ~40 |

Total: ~65 new + ~16 modified = ~80 lines production code, ~140 lines test code.
