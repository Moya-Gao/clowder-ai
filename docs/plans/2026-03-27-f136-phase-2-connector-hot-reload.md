# F136 Phase 2: Connector Hot Reload + Secrets Endpoint

**Feature:** F136 — `docs/features/F136-unified-config-hot-reload.md`
**Goal:** Hub 配置向导改 IM connector 配置后，不用重启 API 就能生效 — MVP 达成
**Acceptance Criteria:**
- AC-1: `POST /api/config/secrets` 允许写入 connector 需要的 tokens（allowlist），拒绝非允许的变量
- AC-2: Loopback/same-origin guard — 只接受来自 localhost/private network 的请求
- AC-3: 审计日志只记 key 不记 value
- AC-4: 写入后发 ConfigChangeEvent（source: 'secrets', scope: 'key'）
- AC-5: ConnectorGateway 订阅 configEventBus，connector 相关 key 变更触发 restart
- AC-6: Restart = stop 旧 adapters → reload config from process.env → start 新 adapters → re-wire hooks
- AC-7: 多键变更 debounce（500ms）防止频繁 restart
- AC-8: 前端调用 secrets endpoint 后，connector 实际能用新 token 收发消息（端到端）
**Architecture:** 两个独立模块 + 一处胶水。(A) 新建 `config-secrets.ts` route，有自己的 allowlist 和 loopback guard。(B) 新建 `connector-reload-subscriber.ts`，订阅 configEventBus，debounce 后调 restart 函数。(C) `index.ts` 胶水——subscriber 创建时传入 restart callback（stop 旧 handle → start 新 → re-wire setters）。
**Tech Stack:** Fastify route, Zod validation, configEventBus (Phase 1), grammy/dingtalk-stream/lark SDK graceful shutdown
**前端验证:** No — 本 Phase 不涉及前端 UI 改动

---

## Terminal Schema

```typescript
// --- A: Secrets Allowlist ---
// packages/api/src/config/connector-secrets-allowlist.ts

/** Connector env vars writable via POST /api/config/secrets */
export const CONNECTOR_SECRETS_ALLOWLIST: ReadonlySet<string> = new Set([
  'TELEGRAM_BOT_TOKEN',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_VERIFICATION_TOKEN',
  'FEISHU_BOT_OPEN_ID',
  'FEISHU_ADMIN_OPEN_IDS',
  'FEISHU_CONNECTION_MODE',
  'DINGTALK_APP_KEY',
  'DINGTALK_APP_SECRET',
  'WEIXIN_BOT_TOKEN',
]);

export function isConnectorSecret(name: string): boolean {
  return CONNECTOR_SECRETS_ALLOWLIST.has(name);
}

// --- B: Secrets Route ---
// packages/api/src/routes/config-secrets.ts

// POST /api/config/secrets
// Request: { updates: [{ name: string, value: string | null }] }
// Guard: loopback + identity
// Writes .env + process.env → ConfigChangeEvent { source: 'secrets' } → audit log

// --- C: Connector Reload Subscriber ---
// packages/api/src/infrastructure/connectors/connector-reload-subscriber.ts

export interface ConnectorReloadSubscriberOpts {
  onRestart: () => Promise<void>;
  debounceMs?: number; // default 500
  log: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
}

// Subscribes to configEventBus, filters for CONNECTOR_SECRETS_ALLOWLIST keys,
// debounces, calls onRestart()
```

## What We're NOT Building

- No frontend UI changes (that's a separate Phase or F088 concern)
- No partial adapter reload (full gateway restart — correct and simple)
- No `/api/config/env` changes (existing security model untouched)
- No Provider Profile hot reload (that's Phase 4)
- No cat-config.yaml hot reload (that's Phase 3A-3C)

---

## Task 1: Connector Secrets Allowlist + Validation

**Files:**
- Create: `packages/api/src/config/connector-secrets-allowlist.ts`
- Test: `packages/api/test/connector-secrets-allowlist.test.js`

**Step 1: Write failing test**

```javascript
// connector-secrets-allowlist.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isConnectorSecret, CONNECTOR_SECRETS_ALLOWLIST } from '../dist/config/connector-secrets-allowlist.js';

describe('connector-secrets-allowlist', () => {
  it('accepts all connector env vars from loadConnectorGatewayConfig', () => {
    const expected = [
      'TELEGRAM_BOT_TOKEN', 'FEISHU_APP_ID', 'FEISHU_APP_SECRET',
      'FEISHU_VERIFICATION_TOKEN', 'FEISHU_BOT_OPEN_ID', 'FEISHU_ADMIN_OPEN_IDS',
      'FEISHU_CONNECTION_MODE', 'DINGTALK_APP_KEY', 'DINGTALK_APP_SECRET',
      'WEIXIN_BOT_TOKEN',
    ];
    for (const name of expected) {
      assert.ok(isConnectorSecret(name), `${name} should be in allowlist`);
    }
  });

  it('rejects non-connector env vars', () => {
    assert.ok(!isConnectorSecret('OPENAI_API_KEY'));
    assert.ok(!isConnectorSecret('REDIS_URL'));
    assert.ok(!isConnectorSecret('API_SERVER_PORT'));
    assert.ok(!isConnectorSecret(''));
    assert.ok(!isConnectorSecret('RANDOM_KEY'));
  });

  it('allowlist size matches exactly 10 connector vars', () => {
    assert.equal(CONNECTOR_SECRETS_ALLOWLIST.size, 10);
  });
});
```

**Step 2: Run test → FAIL** (module not found)

**Step 3: Implement `connector-secrets-allowlist.ts`** — Set + function as shown in terminal schema

**Step 4: Build + run test → PASS**

**Step 5: Commit** — `feat(F136): add connector secrets allowlist`

---

## Task 2: POST /api/config/secrets Endpoint

**Files:**
- Create: `packages/api/src/routes/config-secrets.ts`
- Modify: `packages/api/src/index.ts` (register route)
- Test: `packages/api/test/config-secrets.test.js`

**Step 1: Write failing tests**

```javascript
// config-secrets.test.js — key test cases:
// 1. writes allowed connector var to .env + process.env
// 2. rejects non-allowlist var (400)
// 3. rejects when no identity header (400)
// 4. emits ConfigChangeEvent with source='secrets'
// 5. no-op detection: same value → no event
// 6. audit log records keys not values
// 7. multiple keys in one request (batch)
```

Test setup: `mkdtempSync` for temp .env (same pattern as Phase 1 and env-registry.test.js).

**Step 2: Run tests → FAIL**

**Step 3: Implement `config-secrets.ts`**

Key implementation:
- Reuse `applyEnvUpdatesToFile` and `formatEnvFileValue` from config.ts (extract to shared helper if needed, or import directly)
- Loopback guard: check `request.ip` against `127.0.0.1`/`::1`/`::ffff:127.0.0.1` (Fastify provides `request.ip`)
- Zod schema for `{ updates: [{ name, value }] }`
- `isConnectorSecret(name)` validation
- Write .env + process.env
- Emit `configEventBus.emitChange({ source: 'secrets', ... })`
- Audit log (keys only)

**Step 4: Register route in `index.ts`**

```typescript
import { configSecretsRoutes } from './routes/config-secrets.js';
// ...
await app.register(configSecretsRoutes);
```

**Step 5: Build + run tests → PASS**

**Step 6: Commit** — `feat(F136): POST /api/config/secrets endpoint with loopback guard`

---

## Task 3: Gateway Restart Function

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts` (add export only)
- Create: `packages/api/src/infrastructure/connectors/connector-gateway-lifecycle.ts`
- Test: `packages/api/test/connector-gateway-lifecycle.test.js`

**Step 1: Write failing test**

```javascript
// Test restartConnectorGateway():
// 1. calls stop() on old handle
// 2. calls startConnectorGateway() with fresh config from process.env
// 3. returns new handle (or null if no connectors configured)
// 4. logs restart event
```

Use mock deps (messageStore, threadStore, etc.) — we're testing the lifecycle sequence, not adapter internals.

**Step 2: Run → FAIL**

**Step 3: Implement `connector-gateway-lifecycle.ts`**

```typescript
import { loadConnectorGatewayConfig, startConnectorGateway,
         type ConnectorGatewayDeps, type ConnectorGatewayHandle } from './connector-gateway-bootstrap.js';

export async function restartConnectorGateway(
  oldHandle: ConnectorGatewayHandle | null,
  deps: ConnectorGatewayDeps,
): Promise<ConnectorGatewayHandle | null> {
  if (oldHandle) {
    await oldHandle.stop();
  }
  const config = loadConnectorGatewayConfig(); // reads fresh process.env
  return startConnectorGateway(config, deps);
}
```

**Step 4: Build + run → PASS**

**Step 5: Commit** — `feat(F136): connector gateway restart lifecycle function`

---

## Task 4: Connector Reload Subscriber

**Files:**
- Create: `packages/api/src/infrastructure/connectors/connector-reload-subscriber.ts`
- Test: `packages/api/test/connector-reload-subscriber.test.js`

**Step 1: Write failing tests**

```javascript
// 1. calls onRestart when configEventBus emits a connector key change
// 2. does NOT call onRestart for non-connector key changes
// 3. debounces: two rapid events → only one onRestart call
// 4. file-scope event → triggers restart (conservative: connector keys may have changed)
// 5. unsubscribe stops listening
// 6. onRestart error is logged, not propagated
```

**Step 2: Run → FAIL**

**Step 3: Implement `connector-reload-subscriber.ts`**

Core logic:
- `configEventBus.onConfigChange(listener)` — subscribe
- Filter: check if `event.changedKeys` overlaps `CONNECTOR_SECRETS_ALLOWLIST` OR `event.scope === 'file'`
- Debounce: simple `setTimeout`/`clearTimeout` pattern (no external dependency)
- Call `opts.onRestart()` with try/catch + log error

**Step 4: Build + run → PASS**

**Step 5: Commit** — `feat(F136): connector reload subscriber with debounce`

---

## Task 5: Wire Everything in index.ts + Integration

**Files:**
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/connector-hot-reload-integration.test.js`

**Step 1: Write integration test**

```javascript
// End-to-end: POST /api/config/secrets with a connector key
// → ConfigChangeEvent fires
// → subscriber triggers
// → (mock) restart callback invoked
// Validates the full wiring without real adapters.
```

**Step 2: Run → FAIL**

**Step 3: Wire subscriber in `index.ts`**

After gateway starts (after line 1708), add:

```typescript
import { createConnectorReloadSubscriber } from './infrastructure/connectors/connector-reload-subscriber.js';
import { restartConnectorGateway } from './infrastructure/connectors/connector-gateway-lifecycle.js';

// ... inside the if (connectorGatewayHandle) block:
const reloadSubscriber = createConnectorReloadSubscriber({
  log: app.log,
  debounceMs: 500,
  async onRestart() {
    app.log.info('[api] Hot-reloading connector gateway...');
    const newHandle = await restartConnectorGateway(connectorGatewayHandle, gatewayDeps);
    if (newHandle) {
      connectorGatewayHandle = newHandle;
      // Re-wire all hook consumers (same pattern as initial startup)
      invokeTrigger.setOutboundHook(newHandle.outboundHook);
      invokeTrigger.setStreamingHook(newHandle.streamingHook);
      queueProcessor.setOutboundHook(newHandle.outboundHook as any);
      queueProcessor.setStreamingHook(newHandle.streamingHook as any);
      (callbackOpts as any).outboundHook = newHandle.outboundHook;
      (messagesOpts as any).outboundHook = newHandle.outboundHook;
      (messagesOpts as any).streamingHook = newHandle.streamingHook;
      for (const [id, handler] of newHandle.webhookHandlers) {
        connectorWebhookHandlers.set(id, handler);
      }
      (connectorHubOpts as any).weixinAdapter = newHandle.weixinAdapter;
      (connectorHubOpts as any).startWeixinPolling = newHandle.startWeixinPolling;
      (connectorHubOpts as any).permissionStore = newHandle.permissionStore;
    }
    app.log.info('[api] Connector gateway hot-reload complete');
  },
});
// Add to shutdown
stopFns.push(() => { reloadSubscriber.unsubscribe(); });
```

**Step 4: Build + run → PASS**

**Step 5: Commit** — `feat(F136): wire connector reload subscriber in server bootstrap`

---

## Task 6: Regenerate Feature Index + Final Commit

**Step 1:** `node scripts/generate-feature-index.mjs`
**Step 2:** Commit — `chore: regenerate feature index`

---

## File Change Summary

| Action | File | Lines (est.) |
|--------|------|-------------|
| Create | `packages/api/src/config/connector-secrets-allowlist.ts` | ~25 |
| Create | `packages/api/src/routes/config-secrets.ts` | ~100 |
| Create | `packages/api/src/infrastructure/connectors/connector-gateway-lifecycle.ts` | ~25 |
| Create | `packages/api/src/infrastructure/connectors/connector-reload-subscriber.ts` | ~55 |
| Modify | `packages/api/src/index.ts` | +30 (imports + wiring) |
| Modify | `packages/api/src/routes/config.ts` | +2 (export helper functions) |
| Create | `packages/api/test/connector-secrets-allowlist.test.js` | ~40 |
| Create | `packages/api/test/config-secrets.test.js` | ~150 |
| Create | `packages/api/test/connector-gateway-lifecycle.test.js` | ~60 |
| Create | `packages/api/test/connector-reload-subscriber.test.js` | ~90 |
| Create | `packages/api/test/connector-hot-reload-integration.test.js` | ~80 |

## Risk Mitigation

1. **Telegram polling race**: grammy's `bot.stop()` waits for current poll to finish — safe
2. **DingTalk stream**: `client.disconnect()` is clean — tested in existing shutdown
3. **Feishu WebSocket**: `WSClient.close()` is synchronous — no race
4. **Hook re-wiring atomicity**: hooks are set one by one, but all setters are sync — no request can see partial state since Node.js is single-threaded
5. **Message loss during restart**: brief window where adapters are stopped. Acceptable for config change (infrequent). Telegram messages are retried by Telegram servers; DingTalk stream reconnects automatically; Feishu webhooks return non-200 and Feishu retries.
