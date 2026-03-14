# F115 Phase C: Proxy 弹性实施计划

**Feature:** F115 — `docs/features/F115-runtime-startup-optimization.md`
**Goal:** Proxy 不可达或 upstream 超时时，猫猫不卡死、不报 ECONNREFUSED，优雅降级
**Acceptance Criteria:**
- [x] AC-C1: upstream 529/503 自动 retry（最多 3 次，exponential backoff）— **已实现**
- [ ] AC-C2: thinking/signature 事件不做 JSON round-trip — **已实现（白名单 pickKeys），标记完成**
- [ ] AC-C3: proxy 进程不可达时 fallback 直连 upstream（TCP 探活 + 结构化告警）
- [ ] AC-C4: upstream fetch 增加超时（60s），避免无限等待返回 502（clowder-ai#52）
**Architecture:** 两处改动：(1) invoke-single-cat.ts 在设置 proxy baseUrl 前做 TCP 探活，失败则 fallback 直连；(2) anthropic-proxy.mjs 的 fetch 调用加 AbortSignal.timeout
**Tech Stack:** Node.js net.connect (TCP probe), AbortSignal.timeout (fetch timeout)
**前端验证:** No

---

## 现状分析

### AC-C1: ✅ 已实现
`anthropic-proxy.mjs:321-344` 已有 429/529 retry 循环（exponential backoff + Retry-After header）。

### AC-C2: ✅ 已实现
- Request 侧：`stripThinkingFromRequest()` 完全剥离 thinking blocks（不做 round-trip）
- Response 侧：`normalizeContentBlock()` 用白名单 `pickKeys` 只保留 `['type', 'thinking', 'signature']`，signature 是字符串字段，JSON parse→stringify 不会改变其内容
- 两者协同确保 thinking/signature 完整性

### AC-C3: ❌ 未实现（clowder-ai#46）
`invoke-single-cat.ts:469` 只看 `ANTHROPIC_PROXY_ENABLED !== '0'` 就把 baseUrl 改成 proxy。如果 proxy 进程没起来，CLI 直接 ECONNREFUSED。

### AC-C4: ❌ 未实现（clowder-ai#52）
`anthropic-proxy.mjs:324` fetch 没有 timeout，如果 upstream 不响应，客户端会无限等待直到 proxy 自己超时（Node.js 默认无上限）。

---

## Task 1: AC-C4 — fetch 超时（anthropic-proxy.mjs）

**Files:**
- Modify: `scripts/anthropic-proxy.mjs:324`
- Create: `packages/api/test/anthropic-proxy-timeout.test.js`

### Step 1: Write failing test

```javascript
// test: proxy 应在 upstream 不响应时返回 504 Gateway Timeout
// 起一个假 upstream 接收连接但永不响应，验证 proxy 60s 内返回 504
```

### Step 2: Run test to verify it fails

Run: `node --test packages/api/test/anthropic-proxy-timeout.test.js`
Expected: FAIL（当前 proxy 无超时，测试会挂住）

### Step 3: Implement — add AbortSignal.timeout to fetch

```javascript
// anthropic-proxy.mjs L324, fetch 调用加上 signal
upstream = await fetch(targetUrl.href, {
  method: req.method || 'GET',
  headers: forwardHeaders,
  ...(sanitizedBody.length > 0 ? { body: sanitizedBody } : {}),
  signal: AbortSignal.timeout(60_000),
});
```

catch 块需要区分 TimeoutError，返回 504 而非 502：

```javascript
} catch (err) {
  const isTimeout = err.name === 'TimeoutError';
  const status = isTimeout ? 504 : 502;
  // ...
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    type: 'error',
    error: { type: isTimeout ? 'proxy_timeout' : 'proxy_error', message: err.message },
  }));
}
```

### Step 4: Run test to verify it passes

Run: `node --test packages/api/test/anthropic-proxy-timeout.test.js`
Expected: PASS

### Step 5: Commit

```bash
git commit -m "feat(F115): AC-C4 — upstream fetch 60s 超时，避免无限等待 [布偶猫🐾]"
```

---

## Task 2: AC-C3 — proxy fallback（invoke-single-cat.ts）

**Files:**
- Create: `packages/api/src/utils/tcp-probe.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:462-476`
- Create: `packages/api/test/tcp-probe.test.js`
- Modify: `packages/api/test/invoke-single-cat.test.js`（加 fallback 测试）

### Step 1: Write tcp-probe failing test

```javascript
// test: tcpProbe 对不存在的端口应返回 false
// test: tcpProbe 对监听中的端口应返回 true
```

### Step 2: Run test to verify it fails

Run: `node --test packages/api/test/tcp-probe.test.js`
Expected: FAIL（模块不存在）

### Step 3: Implement tcp-probe

```typescript
// packages/api/src/utils/tcp-probe.ts
import { connect } from 'node:net';

export function tcpProbe(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}
```

### Step 4: Run test to verify it passes

Run: `node --test packages/api/test/tcp-probe.test.js`
Expected: PASS

### Step 5: Commit

```bash
git commit -m "feat(F115): add tcpProbe utility for proxy health check [布偶猫🐾]"
```

### Step 6: Write invoke-single-cat fallback failing test

```javascript
// test: when proxy is unreachable, baseUrl should fall back to direct upstream
// mock tcpProbe to return false → expect callbackEnv.CAT_CAFE_ANTHROPIC_BASE_URL === profile.baseUrl (直连)
```

### Step 7: Run test to verify it fails

Run: `node --test packages/api/test/invoke-single-cat.test.js`
Expected: FAIL（当前代码不做探活，始终走 proxy）

### Step 8: Implement fallback in invoke-single-cat.ts

```typescript
// L462-476 改为：
if (profile.baseUrl) {
  const proxyPort = process.env.ANTHROPIC_PROXY_PORT || '9877';
  const proxyEnabled = process.env.ANTHROPIC_PROXY_ENABLED !== '0';
  if (proxyEnabled) {
    const alive = await tcpProbe('127.0.0.1', parseInt(proxyPort, 10));
    if (alive) {
      const slug = deriveProxySlug(profile.id);
      registerProxyUpstream(projectRoot, slug, profile.baseUrl);
      callbackEnv.CAT_CAFE_ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxyPort}/${slug}`;
    } else {
      console.warn(
        `[invoke] proxy 127.0.0.1:${proxyPort} unreachable, falling back to direct upstream: ${profile.baseUrl}`
      );
      callbackEnv.CAT_CAFE_ANTHROPIC_BASE_URL = profile.baseUrl;
    }
  } else {
    callbackEnv.CAT_CAFE_ANTHROPIC_BASE_URL = profile.baseUrl;
  }
}
```

### Step 9: Run test to verify it passes

Run: `node --test packages/api/test/invoke-single-cat.test.js`
Expected: PASS

### Step 10: Commit

```bash
git commit -m "feat(F115): AC-C3 — proxy 不可达时 fallback 直连 upstream [布偶猫🐾]"
```

---

## Task 3: 标记 AC-C1/C2 完成 + 更新 spec

**Files:**
- Modify: `docs/features/F115-runtime-startup-optimization.md`

### Step 1: Update spec checkboxes

```markdown
- [x] AC-C1: upstream 529/503 自动 retry
- [x] AC-C2: thinking/signature 事件不做 JSON round-trip
- [x] AC-C3: proxy 不可达时 fallback 直连 upstream
- [x] AC-C4: upstream fetch 增加超时（60s）
```

### Step 2: Commit

```bash
git commit -m "docs(F115): mark Phase C acceptance criteria complete [布偶猫🐾]"
```

---

## 不做的事

- Phase A/B/D — 不在本次 scope
- proxy 自动重启 — 超出 scope，proxy 进程管理是 start-dev.sh 的事
- 客户端侧 retry — CLI 自己有 retry，不在 API 层加
