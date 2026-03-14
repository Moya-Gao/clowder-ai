# F120: Hub Embedded Browser — Implementation Plan

**Feature:** F120 — `docs/features/F120-hub-embedded-browser.md`
**Goal:** 在 Hub 内嵌浏览器 panel，通过反向代理预览运行中的 localhost 前端应用，支持 HMR 热更新
**Acceptance Criteria:**
- AC-A1: Hub 内可打开 browser panel，输入 localhost:xxxx 后显示运行中的页面
- AC-A2: Terminal 启动 dev server 后，Hub 自动检测端口并提示预览
- AC-A3: HMR 热更新在 browser panel 内正常工作
- AC-A4: browser panel 有 URL 栏、刷新、前进/后退基础导航控件
- AC-A5: browser panel 和 workspace file explorer 可同时可见或 tab 切换
- AC-B1: browser panel 只能访问 localhost
- AC-B2: iframe 内页面无法访问 Hub 的 Cookie/Storage/DOM
- AC-B3: 禁止访问 Cat Café 自身 API 端口（可配置排除列表）
**Architecture:** Preview Gateway（独立端口的反向代理）+ iframe sandbox（独立 origin 隔离）+ 端口发现（stdout 解析 + lsof 兜底 + 可达性探测）。前端在 WorkspacePanel 新增 "browser" tab。
**Tech Stack:** Fastify, http-proxy (node-http-proxy), iframe sandbox, WorkspacePanel.tsx (React), Socket.IO (端口发现事件推送)
**前端验证:** Yes — 需要 Playwright/Chrome 实测 iframe 嵌入 + HMR + 导航控件

---

## Straight-Line Check

### Finish Line (B)
Hub 用户在 WorkspacePanel 切到 "Browser" tab → 看到反向代理后的 localhost 应用 → HMR 实时刷新 → 端口自动发现弹提示。

### What We're NOT Building
- Phase C 功能（DevTools、截图、多 Tab）— 不在此 plan 范围
- 完整浏览器 DevTools（不做）
- 外部 URL 访问能力（只 localhost）

### Terminal Schema（最终形态的接口定义）

```typescript
// === packages/api/src/domains/preview/types.ts ===

/** Preview Gateway 配置 */
export interface PreviewGatewayConfig {
  /** Gateway 监听端口（独立 origin） */
  port: number;
  /** 允许的目标端口范围 */
  allowedPortRange: [number, number]; // [1024, 65535]
  /** 排除的端口列表（Cat Café 自身服务） */
  excludedPorts: number[];
}

/** 端口发现结果 */
export interface DiscoveredPort {
  port: number;
  /** 发现来源 */
  source: 'stdout' | 'lsof';
  /** dev server 框架猜测 */
  framework?: string; // 'vite' | 'next' | 'webpack' | 'unknown'
  /** 对应 tmux pane */
  paneId?: string;
  worktreeId: string;
  /** HTTP 可达性探测结果 */
  reachable: boolean;
  discoveredAt: number;
}

/** 前端请求预览的参数 */
export interface PreviewRequest {
  targetPort: number;
  targetHost?: string; // 默认 localhost
}

/** 前端 browser panel 状态 */
export interface BrowserPanelState {
  url: string;           // 当前 iframe src（指向 gateway）
  targetPort: number;    // 实际目标端口
  targetHost: string;    // 实际目标 host
  isConnected: boolean;  // gateway 是否可达
}
```

```typescript
// === packages/api/src/routes/preview.ts — API 路由 ===

// GET  /api/preview/status         → { available: boolean, gatewayPort: number }
// POST /api/preview/validate-port  → { allowed: boolean, reason?: string }
// GET  /api/preview/discovered     → DiscoveredPort[]
```

```typescript
// === packages/web — 前端组件 ===

// WorkspacePanel.tsx: viewMode 扩展 'files' | 'changes' | 'git' | 'terminal' | 'browser'
// BrowserPanel.tsx:   iframe + toolbar (URL bar, back, fwd, refresh, viewport switcher)
```

### Step Validation
每一步都留在最终系统中：
1. Preview types → 最终接口，后续只 extend
2. Port validator → gateway + API 路由都用
3. Preview Gateway (proxy server) → 最终形态
4. Port discovery service → 最终形态
5. API routes → 最终形态
6. BrowserPanel 前端 → 最终形态
7. WorkspacePanel 集成 → 最终形态
8. 端口发现 → Socket.IO 推送 → 最终形态
9. Audit events → 最终形态

---

## Task 1: Preview Domain Types + Port Validator

**Files:**
- Create: `packages/api/src/domains/preview/types.ts`
- Create: `packages/api/src/domains/preview/port-validator.ts`
- Test: `packages/api/test/domains/preview/port-validator.test.ts`

**Step 1: Write the failing test for port validator**

```typescript
// packages/api/test/domains/preview/port-validator.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePort, DEFAULT_EXCLUDED_PORTS } from '../../src/domains/preview/port-validator.js';

describe('validatePort', () => {
  it('allows a normal dev server port', () => {
    const result = validatePort(3847);
    assert.equal(result.allowed, true);
  });

  it('rejects port below 1024', () => {
    const result = validatePort(80);
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /range/i);
  });

  it('rejects port 0', () => {
    const result = validatePort(0);
    assert.equal(result.allowed, false);
  });

  it('rejects Hub API port (3002)', () => {
    const result = validatePort(3002);
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /excluded/i);
  });

  it('rejects Redis port (6399)', () => {
    const result = validatePort(6399);
    assert.equal(result.allowed, false);
  });

  it('rejects Hub frontend port (3001)', () => {
    const result = validatePort(3001);
    assert.equal(result.allowed, false);
  });

  it('rejects MCP port (18888)', () => {
    const result = validatePort(18888);
    assert.equal(result.allowed, false);
  });

  it('rejects gateway self port', () => {
    const result = validatePort(4000, { gatewaySelfPort: 4000 });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /gateway/i);
  });

  it('allows port with custom excluded list', () => {
    const result = validatePort(5555, { excludedPorts: [5555] });
    assert.equal(result.allowed, false);
  });

  it('validates host is loopback', () => {
    const result = validatePort(3847, { host: '192.168.1.1' });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /loopback/i);
  });

  it('allows localhost host', () => {
    const result = validatePort(3847, { host: 'localhost' });
    assert.equal(result.allowed, true);
  });

  it('allows 127.0.0.1 host', () => {
    const result = validatePort(3847, { host: '127.0.0.1' });
    assert.equal(result.allowed, true);
  });

  it('allows ::1 host', () => {
    const result = validatePort(3847, { host: '::1' });
    assert.equal(result.allowed, true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/domains/preview/port-validator.test.ts`
Expected: FAIL — module not found

**Step 3: Create types.ts**

```typescript
// packages/api/src/domains/preview/types.ts
export interface PreviewGatewayConfig {
  port: number;
  allowedPortRange: [number, number];
  excludedPorts: number[];
}

export interface DiscoveredPort {
  port: number;
  source: 'stdout' | 'lsof';
  framework?: string;
  paneId?: string;
  worktreeId: string;
  reachable: boolean;
  discoveredAt: number;
}

export interface PreviewRequest {
  targetPort: number;
  targetHost?: string;
}

export interface BrowserPanelState {
  url: string;
  targetPort: number;
  targetHost: string;
  isConnected: boolean;
}

export interface PortValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface PortValidationOptions {
  host?: string;
  excludedPorts?: number[];
  gatewaySelfPort?: number;
}
```

**Step 4: Implement port-validator.ts**

```typescript
// packages/api/src/domains/preview/port-validator.ts
import type { PortValidationOptions, PortValidationResult } from './types.js';

/** Cat Café 自身服务端口 — 硬编码保底 + 从 env 动态读取 */
export const DEFAULT_EXCLUDED_PORTS = [
  3001, 3002,          // Hub frontend + API
  6398, 6399,          // Redis dev + prod
  18888, 19999,        // MCP / API gateway
  9876, 9878, 9879,    // Whisper, LLM postprocess, TTS
  9877,                // Anthropic proxy
];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PORT_MIN = 1024;
const PORT_MAX = 65535;

export function validatePort(
  port: number,
  opts: PortValidationOptions = {},
): PortValidationResult {
  const { host, gatewaySelfPort } = opts;
  const excludedPorts = opts.excludedPorts
    ? [...DEFAULT_EXCLUDED_PORTS, ...opts.excludedPorts]
    : DEFAULT_EXCLUDED_PORTS;

  // Host validation
  if (host && !LOOPBACK_HOSTS.has(host)) {
    return { allowed: false, reason: `Only loopback hosts allowed (got: ${host})` };
  }

  // Port range
  if (port < PORT_MIN || port > PORT_MAX) {
    return { allowed: false, reason: `Port must be in range ${PORT_MIN}-${PORT_MAX}` };
  }

  // Gateway self-protection
  if (gatewaySelfPort && port === gatewaySelfPort) {
    return { allowed: false, reason: 'Cannot proxy to gateway self port (recursive proxy)' };
  }

  // Excluded ports
  if (excludedPorts.includes(port)) {
    return { allowed: false, reason: `Port ${port} is excluded (Cat Café service port)` };
  }

  return { allowed: true };
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/api && npx tsx --test test/domains/preview/port-validator.test.ts`
Expected: All 13 tests PASS

**Step 6: Commit**

```bash
git add packages/api/src/domains/preview/types.ts packages/api/src/domains/preview/port-validator.ts packages/api/test/domains/preview/port-validator.test.ts
git commit -m "feat(F120): add preview domain types + port validator [布偶猫🐾]"
```

---

## Task 2: Preview Gateway（反向代理服务器）

**Files:**
- Create: `packages/api/src/domains/preview/preview-gateway.ts`
- Test: `packages/api/test/domains/preview/preview-gateway.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/api/test/domains/preview/preview-gateway.test.ts
import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PreviewGateway } from '../../src/domains/preview/preview-gateway.js';

// Spin up a fake "dev server" on a random port for testing
function createFakeDevServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/ws-upgrade') {
        // WebSocket upgrade handled separately
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
      });
      res.end('<h1>Hello from dev server</h1>');
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

function httpGet(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    }).on('error', reject);
  });
}

describe('PreviewGateway', () => {
  let fakeDevServer: { server: http.Server; port: number };
  let gateway: PreviewGateway;

  before(async () => {
    fakeDevServer = await createFakeDevServer();
    gateway = new PreviewGateway({ port: 0 }); // random port
    await gateway.start();
  });

  after(async () => {
    await gateway.stop();
    fakeDevServer.server.close();
  });

  it('proxies request to target dev server', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/?__preview_port=${fakeDevServer.port}`;
    const res = await httpGet(url);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Hello from dev server'));
  });

  it('strips X-Frame-Options from proxied response', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/?__preview_port=${fakeDevServer.port}`;
    const res = await httpGet(url);
    assert.equal(res.headers['x-frame-options'], undefined);
  });

  it('strips CSP frame-ancestors from proxied response', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/?__preview_port=${fakeDevServer.port}`;
    const res = await httpGet(url);
    // CSP header should not contain frame-ancestors
    const csp = res.headers['content-security-policy'];
    if (csp) {
      assert.ok(!csp.includes('frame-ancestors'));
    }
  });

  it('rejects excluded ports', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/?__preview_port=6399`;
    const res = await httpGet(url);
    assert.equal(res.status, 403);
  });

  it('rejects missing port param', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/`;
    const res = await httpGet(url);
    assert.equal(res.status, 400);
  });

  it('rejects non-loopback host', async () => {
    const url = `http://127.0.0.1:${gateway.actualPort}/?__preview_port=${fakeDevServer.port}&__preview_host=192.168.1.1`;
    const res = await httpGet(url);
    assert.equal(res.status, 403);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && npx tsx --test test/domains/preview/preview-gateway.test.ts`
Expected: FAIL — module not found

**Step 3: Install http-proxy dependency**

```bash
cd packages/api && pnpm add http-proxy && pnpm add -D @types/http-proxy
```

**Step 4: Implement preview-gateway.ts**

```typescript
// packages/api/src/domains/preview/preview-gateway.ts
import http from 'node:http';
import httpProxy from 'http-proxy';
import { validatePort } from './port-validator.js';

export interface PreviewGatewayOptions {
  port: number; // 0 = random
  host?: string;
}

/**
 * Preview Gateway — 独立端口的反向代理。
 * iframe 永远只打开 gateway URL，不直接连 localhost:xxxx。
 *
 * 请求路径：
 *   GET http://gateway:PORT/path?__preview_port=3847
 *   → proxy to http://localhost:3847/path
 *
 * 安全：
 *   - 只允许 loopback 目标
 *   - 端口白名单校验（排除 Cat Café 自身端口）
 *   - 剥离 X-Frame-Options + CSP frame-ancestors
 *   - WebSocket 升级代理（HMR）
 */
export class PreviewGateway {
  private server: http.Server;
  private proxy: httpProxy;
  private port: number;
  private host: string;
  actualPort = 0;

  constructor(opts: PreviewGatewayOptions) {
    this.port = opts.port;
    this.host = opts.host ?? '127.0.0.1';

    this.proxy = httpProxy.createProxyServer({
      ws: true,
      xfwd: false,
      changeOrigin: true,
    });

    // Strip iframe-blocking headers from proxied responses
    this.proxy.on('proxyRes', (_proxyRes, _req, _res) => {
      delete _proxyRes.headers['x-frame-options'];
      const csp = _proxyRes.headers['content-security-policy'];
      if (csp) {
        // Remove frame-ancestors directive
        const cleaned = csp
          .split(';')
          .filter((d) => !d.trim().startsWith('frame-ancestors'))
          .join(';')
          .trim();
        if (cleaned) {
          _proxyRes.headers['content-security-policy'] = cleaned;
        } else {
          delete _proxyRes.headers['content-security-policy'];
        }
      }
    });

    this.server = http.createServer((req, res) => {
      const parsed = this.parseTarget(req);
      if (!parsed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing __preview_port query parameter' }));
        return;
      }

      const validation = validatePort(parsed.port, {
        host: parsed.host,
        gatewaySelfPort: this.actualPort,
      });
      if (!validation.allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.reason }));
        return;
      }

      // Strip __preview_port and __preview_host from the forwarded URL
      const url = new URL(req.url!, `http://${req.headers.host}`);
      url.searchParams.delete('__preview_port');
      url.searchParams.delete('__preview_host');
      req.url = url.pathname + url.search;

      const target = `http://${parsed.host}:${parsed.port}`;
      this.proxy.web(req, res, { target }, (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
        }
      });
    });

    // WebSocket upgrade handler
    this.server.on('upgrade', (req, socket, head) => {
      const parsed = this.parseTarget(req);
      if (!parsed) {
        socket.destroy();
        return;
      }
      const validation = validatePort(parsed.port, {
        host: parsed.host,
        gatewaySelfPort: this.actualPort,
      });
      if (!validation.allowed) {
        socket.destroy();
        return;
      }
      const target = `http://${parsed.host}:${parsed.port}`;
      this.proxy.ws(req, socket, head, { target });
    });
  }

  private parseTarget(req: http.IncomingMessage): { port: number; host: string } | null {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const portStr = url.searchParams.get('__preview_port');
    if (!portStr) return null;
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port)) return null;
    const host = url.searchParams.get('__preview_host') ?? 'localhost';
    return { port, host };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address() as { port: number };
        this.actualPort = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.proxy.close();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/api && npx tsx --test test/domains/preview/preview-gateway.test.ts`
Expected: All 6 tests PASS

**Step 6: Commit**

```bash
git add packages/api/src/domains/preview/preview-gateway.ts packages/api/test/domains/preview/preview-gateway.test.ts package.json pnpm-lock.yaml
git commit -m "feat(F120): preview gateway reverse proxy with header stripping + WebSocket [布偶猫🐾]"
```

---

## Task 3: Port Discovery Service

**Files:**
- Create: `packages/api/src/domains/preview/port-discovery.ts`
- Test: `packages/api/test/domains/preview/port-discovery.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/api/test/domains/preview/port-discovery.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePortFromStdout, detectFramework } from '../../src/domains/preview/port-discovery.js';

describe('parsePortFromStdout', () => {
  it('detects Vite dev server output', () => {
    const line = '  ➜  Local:   http://localhost:5173/';
    const result = parsePortFromStdout(line);
    assert.equal(result?.port, 5173);
    assert.equal(result?.framework, 'vite');
  });

  it('detects Next.js dev server output', () => {
    const line = '  ▲ Next.js 14.0.0\n  - Local: http://localhost:3000';
    const result = parsePortFromStdout(line);
    assert.equal(result?.port, 3000);
    assert.equal(result?.framework, 'next');
  });

  it('detects webpack dev server output', () => {
    const line = '<i> [webpack-dev-server] Project is running at http://localhost:8080/';
    const result = parsePortFromStdout(line);
    assert.equal(result?.port, 8080);
    assert.equal(result?.framework, 'webpack');
  });

  it('detects generic localhost URL', () => {
    const line = 'Server started on http://localhost:4200';
    const result = parsePortFromStdout(line);
    assert.equal(result?.port, 4200);
    assert.equal(result?.framework, 'unknown');
  });

  it('detects 127.0.0.1 URL', () => {
    const line = 'Listening on http://127.0.0.1:9000';
    const result = parsePortFromStdout(line);
    assert.equal(result?.port, 9000);
  });

  it('returns null for non-matching line', () => {
    const result = parsePortFromStdout('Building modules...');
    assert.equal(result, null);
  });

  it('ignores excluded ports', () => {
    const line = 'Server on http://localhost:3002';
    const result = parsePortFromStdout(line);
    assert.equal(result, null); // 3002 is Hub API port
  });
});

describe('detectFramework', () => {
  it('detects vite from output', () => {
    assert.equal(detectFramework('VITE v5.0.0  ready'), 'vite');
  });

  it('detects next from output', () => {
    assert.equal(detectFramework('▲ Next.js 14'), 'next');
  });

  it('detects webpack from output', () => {
    assert.equal(detectFramework('[webpack-dev-server]'), 'webpack');
  });

  it('returns unknown for generic output', () => {
    assert.equal(detectFramework('Server running'), 'unknown');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && npx tsx --test test/domains/preview/port-discovery.test.ts`
Expected: FAIL — module not found

**Step 3: Implement port-discovery.ts**

```typescript
// packages/api/src/domains/preview/port-discovery.ts
import { validatePort } from './port-validator.js';
import type { DiscoveredPort } from './types.js';

export type FrameworkHint = 'vite' | 'next' | 'webpack' | 'unknown';

const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; framework: FrameworkHint }> = [
  { pattern: /vite/i, framework: 'vite' },
  { pattern: /next\.?js/i, framework: 'next' },
  { pattern: /webpack/i, framework: 'webpack' },
];

const LOCALHOST_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|::1):(\d+)/;

export function detectFramework(text: string): FrameworkHint {
  for (const { pattern, framework } of FRAMEWORK_PATTERNS) {
    if (pattern.test(text)) return framework;
  }
  return 'unknown';
}

export function parsePortFromStdout(line: string): { port: number; framework: FrameworkHint } | null {
  const match = LOCALHOST_URL_RE.exec(line);
  if (!match) return null;

  const port = Number.parseInt(match[1], 10);
  const validation = validatePort(port);
  if (!validation.allowed) return null;

  const framework = detectFramework(line);
  return { port, framework };
}

/**
 * Probe whether a port is reachable via HTTP GET.
 * Returns true if any HTTP response is received (even 404/500).
 */
export async function probePort(port: number, host = 'localhost', timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`http://${host}:${port}/`, { signal: controller.signal, redirect: 'manual' });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PortDiscoveryService — monitors tmux pane stdout for dev server port announcements.
 *
 * Usage:
 *   1. Terminal captures pane output → calls feedStdout(worktreeId, paneId, line)
 *   2. If a port is detected → probes reachability → emits 'discovered' event
 *   3. Frontend receives event via Socket.IO → shows toast
 */
export class PortDiscoveryService {
  private discovered = new Map<string, DiscoveredPort>(); // key: `${worktreeId}:${port}`
  private listeners: Array<(port: DiscoveredPort) => void> = [];

  onDiscovered(fn: (port: DiscoveredPort) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  async feedStdout(worktreeId: string, paneId: string, line: string): Promise<void> {
    const parsed = parsePortFromStdout(line);
    if (!parsed) return;

    const key = `${worktreeId}:${parsed.port}`;
    if (this.discovered.has(key)) return; // Already discovered

    const reachable = await probePort(parsed.port);
    const entry: DiscoveredPort = {
      port: parsed.port,
      source: 'stdout',
      framework: parsed.framework,
      paneId,
      worktreeId,
      reachable,
      discoveredAt: Date.now(),
    };

    this.discovered.set(key, entry);
    if (reachable) {
      for (const fn of this.listeners) fn(entry);
    }
  }

  getDiscoveredPorts(worktreeId?: string): DiscoveredPort[] {
    const all = [...this.discovered.values()];
    return worktreeId ? all.filter((p) => p.worktreeId === worktreeId) : all;
  }

  removePort(worktreeId: string, port: number): void {
    this.discovered.delete(`${worktreeId}:${port}`);
  }

  clear(): void {
    this.discovered.clear();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && npx tsx --test test/domains/preview/port-discovery.test.ts`
Expected: All 11 tests PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/preview/port-discovery.ts packages/api/test/domains/preview/port-discovery.test.ts
git commit -m "feat(F120): port discovery service — stdout parsing + framework detection [布偶猫🐾]"
```

---

## Task 4: Preview API Routes

**Files:**
- Create: `packages/api/src/routes/preview.ts`
- Test: `packages/api/test/routes/preview.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/api/test/routes/preview.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { previewRoutes } from '../../src/routes/preview.js';
import { PortDiscoveryService } from '../../src/domains/preview/port-discovery.js';

describe('preview routes', () => {
  const app = Fastify();
  const portDiscovery = new PortDiscoveryService();

  before(async () => {
    await app.register(previewRoutes, { portDiscovery, gatewayPort: 4100 });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('GET /api/preview/status returns gateway info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/preview/status' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.available, true);
    assert.equal(body.gatewayPort, 4100);
  });

  it('POST /api/preview/validate-port allows valid port', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/validate-port',
      payload: { port: 5173 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, true);
  });

  it('POST /api/preview/validate-port rejects excluded port', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preview/validate-port',
      payload: { port: 6399 },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.allowed, false);
  });

  it('GET /api/preview/discovered returns empty initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/preview/discovered' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, []);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && npx tsx --test test/routes/preview.test.ts`
Expected: FAIL — module not found

**Step 3: Implement preview routes**

```typescript
// packages/api/src/routes/preview.ts
import type { FastifyPluginAsync } from 'fastify';
import { validatePort } from '../domains/preview/port-validator.js';
import type { PortDiscoveryService } from '../domains/preview/port-discovery.js';

interface PreviewRouteOpts {
  portDiscovery: PortDiscoveryService;
  gatewayPort: number;
}

export const previewRoutes: FastifyPluginAsync<PreviewRouteOpts> = async (app, opts) => {
  const { portDiscovery, gatewayPort } = opts;

  // GET /api/preview/status
  app.get('/api/preview/status', async () => {
    return { available: true, gatewayPort };
  });

  // POST /api/preview/validate-port
  app.post<{ Body: { port: number; host?: string } }>(
    '/api/preview/validate-port',
    async (req) => {
      const { port, host } = req.body;
      return validatePort(port, { host, gatewaySelfPort: gatewayPort });
    },
  );

  // GET /api/preview/discovered
  app.get<{ Querystring: { worktreeId?: string } }>(
    '/api/preview/discovered',
    async (req) => {
      return portDiscovery.getDiscoveredPorts(req.query.worktreeId);
    },
  );
};
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && npx tsx --test test/routes/preview.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/preview.ts packages/api/test/routes/preview.test.ts
git commit -m "feat(F120): preview API routes — status, validate-port, discovered [布偶猫🐾]"
```

---

## Task 5: Integrate Gateway + Port Discovery into Server Bootstrap

**Files:**
- Modify: `packages/api/src/index.ts` — 启动 PreviewGateway + PortDiscoveryService + 注册路由 + Socket.IO 事件推送
- Modify: `packages/api/src/config/env-registry.ts` — 注册 PREVIEW_GATEWAY_PORT 环境变量

**Step 1: Add env var to env-registry.ts**

Add to `ENV_VARS` array in server category:
```typescript
{
  name: 'PREVIEW_GATEWAY_PORT',
  defaultValue: '4100',
  description: 'Preview Gateway 端口（独立 origin 反向代理）',
  category: 'server',
  sensitive: false,
},
```

**Step 2: Add 'preview' to EnvCategory type**

Add `'preview'` to `EnvCategory` union, or reuse `'server'` category (simpler — use server).

**Step 3: Wire up in index.ts**

In the server bootstrap section (after tmuxGateway setup):

```typescript
// --- Preview Gateway (F120) ---
import { PreviewGateway } from './domains/preview/preview-gateway.js';
import { PortDiscoveryService } from './domains/preview/port-discovery.js';
import { previewRoutes } from './routes/preview.js';

const PREVIEW_GATEWAY_PORT = Number.parseInt(process.env.PREVIEW_GATEWAY_PORT ?? '4100', 10);
const previewGateway = new PreviewGateway({ port: PREVIEW_GATEWAY_PORT });
const portDiscovery = new PortDiscoveryService();

await previewGateway.start();
auditLog.append({ type: 'PREVIEW_GATEWAY_STARTED', data: { port: previewGateway.actualPort } });

// Port discovery → Socket.IO push
portDiscovery.onDiscovered((port) => {
  socketManager.broadcast('preview:port-discovered', port);
});

// Register preview routes
app.register(previewRoutes, { portDiscovery, gatewayPort: previewGateway.actualPort });

// Graceful shutdown
app.addHook('onClose', async () => {
  await previewGateway.stop();
});
```

**Step 4: Add PREVIEW_GATEWAY_PORT to env-registry**

Already described in Step 1.

**Step 5: Test server starts without errors**

Run: `cd packages/api && pnpm build && timeout 5 node dist/index.js 2>&1 || true`
Expected: Server starts, preview gateway logs port 4100

**Step 6: Commit**

```bash
git add packages/api/src/index.ts packages/api/src/config/env-registry.ts
git commit -m "feat(F120): wire preview gateway + port discovery into server bootstrap [布偶猫🐾]"
```

---

## Task 6: Terminal stdout → Port Discovery Integration

**Files:**
- Modify: `packages/api/src/routes/terminal.ts` — tmux pane output 喂给 PortDiscoveryService

**Step 1: Understand current terminal WebSocket flow**

The terminal route has a WebSocket endpoint that streams tmux pane output to the frontend (xterm.js). We need to tap into this data stream and feed it to `portDiscovery.feedStdout()`.

**Step 2: Add port discovery injection to terminal routes**

In `terminalRoutes` opts, add `portDiscovery?: PortDiscoveryService`. In the WebSocket message handler where pane output is sent to the client, also call:

```typescript
// After sending data to xterm frontend, also feed to port discovery
if (portDiscovery && worktreeId) {
  // Feed line-by-line to port discovery (non-blocking)
  const text = typeof data === 'string' ? data : data.toString();
  for (const line of text.split('\n')) {
    if (line.trim()) {
      portDiscovery.feedStdout(worktreeId, paneId, line).catch(() => {});
    }
  }
}
```

**Step 3: Update index.ts to pass portDiscovery to terminal routes**

Add `portDiscovery` to the terminalRoutes opts in index.ts.

**Step 4: Manual test**

1. Start Hub
2. Open terminal, run `npx vite` in a temp project
3. Expect: Socket.IO event `preview:port-discovered` with port 5173

**Step 5: Commit**

```bash
git add packages/api/src/routes/terminal.ts packages/api/src/index.ts
git commit -m "feat(F120): terminal stdout feeds port discovery service [布偶猫🐾]"
```

---

## Task 7: BrowserPanel Frontend Component

**Files:**
- Create: `packages/web/src/components/workspace/BrowserPanel.tsx`
- Test: Manual (Playwright/Chrome — 前端验证)

**Step 1: Create BrowserPanel component**

```tsx
// packages/web/src/components/workspace/BrowserPanel.tsx
'use client';
import { useState, useRef, useCallback } from 'react';

interface BrowserPanelProps {
  gatewayPort: number;
  initialPort?: number;
}

export function BrowserPanel({ gatewayPort, initialPort }: BrowserPanelProps) {
  const [targetPort, setTargetPort] = useState(initialPort ?? 0);
  const [urlInput, setUrlInput] = useState(initialPort ? `localhost:${initialPort}` : '');
  const [isConnected, setIsConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const gatewayUrl = targetPort
    ? `http://localhost:${gatewayPort}/?__preview_port=${targetPort}`
    : '';

  const handleNavigate = useCallback(() => {
    // Parse "localhost:PORT" or "localhost:PORT/path"
    const match = urlInput.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|::1):(\d+)(\/.*)?$/);
    if (match) {
      const port = Number.parseInt(match[1], 10);
      setTargetPort(port);
      setIsConnected(true);
    }
  }, [urlInput]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      // Force reload by toggling src
      const src = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => { iframeRef.current!.src = src; }, 50);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNavigate();
  }, [handleNavigate]);

  return (
    <div className="flex flex-col h-full bg-owner-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-owner-light/40 bg-white/60">
        {/* Back / Forward / Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-owner-light/40 text-owner-dark/50 text-xs"
          title="Refresh"
        >
          ↻
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="localhost:3000"
            className="w-full px-2 py-1 text-xs rounded border border-owner-light/40 bg-white focus:outline-none focus:border-owner-primary"
          />
        </div>

        {/* Go button */}
        <button
          type="button"
          onClick={handleNavigate}
          className="px-2 py-1 text-xs rounded bg-owner-primary text-white hover:bg-owner-primary/90"
        >
          Go
        </button>
      </div>

      {/* iframe or empty state */}
      {gatewayUrl ? (
        <iframe
          ref={iframeRef}
          src={gatewayUrl}
          sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin"
          referrerPolicy="no-referrer"
          className="flex-1 w-full border-0"
          title="Preview"
          onLoad={() => setIsConnected(true)}
          onError={() => setIsConnected(false)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-owner-dark/40 text-sm">
          <div className="text-center">
            <p className="mb-2">Enter a localhost URL to preview</p>
            <p className="text-xs">e.g. localhost:5173</p>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center px-2 py-0.5 border-t border-owner-light/40 text-[10px] text-owner-dark/40">
        {isConnected && targetPort ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            localhost:{targetPort}
          </span>
        ) : (
          <span>No preview</span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/workspace/BrowserPanel.tsx
git commit -m "feat(F120): BrowserPanel component — iframe + toolbar + URL bar [布偶猫🐾]"
```

---

## Task 8: WorkspacePanel Integration — Add "Browser" Tab

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx`

**Step 1: Add 'browser' to view mode type**

In `WorkspacePanel.tsx`, find the view mode union type and tab buttons array:

```diff
- {(['files', 'changes', 'git', 'terminal'] as const).map((mode) => (
+ {(['files', 'changes', 'git', 'terminal', 'browser'] as const).map((mode) => (
```

Update label mapping:
```diff
- {mode === 'files' ? 'Files' : mode === 'changes' ? 'Changes' : mode === 'git' ? 'Git' : 'Term'}
+ {mode === 'files' ? 'Files' : mode === 'changes' ? 'Changes' : mode === 'git' ? 'Git' : mode === 'terminal' ? 'Term' : '🌐'}
```

**Step 2: Add BrowserPanel rendering**

After the terminal rendering block, add:

```tsx
{viewMode === 'browser' && (
  <BrowserPanel
    gatewayPort={previewGatewayPort}
    initialPort={previewInitialPort}
  />
)}
```

Where `previewGatewayPort` comes from the `/api/preview/status` endpoint (fetch on mount or pass from parent).

**Step 3: Add port discovery toast notification**

Listen for Socket.IO `preview:port-discovered` event → show toast → click toast → switch to browser tab with that port.

**Step 4: Commit**

```bash
git add packages/web/src/components/WorkspacePanel.tsx
git commit -m "feat(F120): integrate browser tab into WorkspacePanel [布偶猫🐾]"
```

---

## Task 9: Audit Events

**Files:**
- Modify: `packages/api/src/domains/cats/services/orchestration/EventAuditLog.ts` — add event type constants

**Step 1: Add audit event types**

Add to `AuditEventTypes`:
```typescript
BROWSER_PREVIEW_OPEN: 'browser_preview_open',
BROWSER_PREVIEW_CLOSE: 'browser_preview_close',
BROWSER_PREVIEW_NAVIGATE: 'browser_preview_navigate',
```

**Step 2: Emit audit events from preview routes**

Add audit logging in preview routes when:
- Frontend calls validate-port with allowed=true → `BROWSER_PREVIEW_OPEN`
- Socket.IO disconnect / panel close → `BROWSER_PREVIEW_CLOSE`

**Step 3: Commit**

```bash
git add packages/api/src/domains/cats/services/orchestration/EventAuditLog.ts packages/api/src/routes/preview.ts
git commit -m "feat(F120): browser preview audit events [布偶猫🐾]"
```

---

## Task 10: End-to-End Validation

**Step 1: Build and start Hub**

```bash
cd packages/api && pnpm build
cd packages/web && pnpm build
```

**Step 2: Manual E2E test**

1. Start Hub API (`pnpm --filter @cat-cafe/api dev`)
2. Confirm preview gateway starts on port 4100
3. Open Hub frontend
4. Open terminal tab, run `npx vite --template react` (or any dev server)
5. Expect: toast "检测到 localhost:5173 启动，是否预览？"
6. Click toast → browser tab opens → shows Vite app
7. Edit a file → HMR updates in browser panel
8. Try entering `localhost:6399` → expect rejection

**Step 3: Commit any fixes**

```bash
git commit -m "fix(F120): e2e adjustments [布偶猫🐾]"
```

---

## Summary

| Task | AC Coverage | Files |
|------|------------|-------|
| 1. Types + Port Validator | AC-B1, AC-B3 | `domains/preview/types.ts`, `port-validator.ts` |
| 2. Preview Gateway | AC-A1, AC-A3, AC-B1, AC-B2 | `domains/preview/preview-gateway.ts` |
| 3. Port Discovery | AC-A2 | `domains/preview/port-discovery.ts` |
| 4. Preview API Routes | AC-A1 | `routes/preview.ts` |
| 5. Server Bootstrap | AC-A1, AC-A2 | `index.ts`, `env-registry.ts` |
| 6. Terminal Integration | AC-A2 | `routes/terminal.ts` |
| 7. BrowserPanel | AC-A1, AC-A4 | `workspace/BrowserPanel.tsx` |
| 8. WorkspacePanel | AC-A5 | `WorkspacePanel.tsx` |
| 9. Audit Events | AC-B3 (audit) | `EventAuditLog.ts` |
| 10. E2E Validation | All Phase A+B | — |

All Phase A + Phase B ACs covered. Phase C (DevTools, screenshot, multi-tab) deferred.
