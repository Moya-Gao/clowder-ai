# F089 Phase 1: tmux 基础设施 + 用户 Shell — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在 Hub 浏览器里打开一个真正的 terminal，底层直接走 tmux，用户可以在浏览器里操作 shell。

**Architecture:** 双轨制——现有 socket.io（机器轨）不动；新增 `@fastify/websocket` 路由（人类轨）传输 terminal 字节流。每个 worktree 对应一个 tmux server (`tmux -L catcafe-{worktreeId}`)，用户 shell 是 tmux window 里的 pane。前端用 xterm.js + addon-attach 直接对接 WebSocket。

**Tech Stack:** tmux (control mode -CC), node-pty, @fastify/websocket, @xterm/xterm + addon-fit + addon-attach

**Not building (Phase 1):** agent watch pane, takeover, process monitoring, stdin pipe — 那些是 Phase 2-4。

---

## Spike：tmux control mode (-CC) 可行性验证

> Spike 是显式的探索，产出是决策/结论，不是交付物。时间盒：≤1h。

### 目的

验证 tmux control mode 在 Node.js 里的可编程控制能力：
1. 能否通过 `spawn('tmux', ['-CC', ...])` 的 stdin/stdout 控制 tmux？
2. control mode 输出的文本协议能否可靠解析（`%begin`, `%end`, `%output` 等）？
3. `new-window`, `resize-window`, `kill-session` 等关键操作是否正常？
4. 替代方案评估：control mode vs. 纯 CLI 调用 (`tmux new-window ...`) 哪个更适合我们？

### 验证步骤

1. 写一个独立脚本 `scripts/spike-tmux-control.ts`，用 `child_process.spawn` 启动 `tmux -CC new-session -s test-spike`
2. 向 stdin 写入 `new-window -t test-spike`，解析 stdout 的 `%begin/%end` 响应
3. 写入 `list-panes -t test-spike -F "#{pane_id} #{pane_pid}"`，解析 pane 列表
4. 写入 `resize-window -t test-spike -x 120 -y 40`，确认响应
5. 写入 `kill-session -t test-spike`，确认清理
6. **结论**：control mode 可用 → 采用；不可用/太复杂 → 退回纯 CLI 模式（`execFile('tmux', [...])` 逐命令调用）

### Spike 判定

- **GO**：5 个操作都能可靠执行 + 响应可解析 → 继续 Task 1 用 control mode
- **PIVOT**：解析不稳定 → Task 1 改用 CLI 模式（每个操作一次 `execFile`）
- 两种模式的 TmuxGateway 接口完全一样，差异封装在内部

---

## Terminal Schema（终态数据结构）

```typescript
// packages/api/src/domains/terminal/types.ts

/** A terminal session bound to a worktree's tmux server */
export interface TerminalSession {
  /** Unique session ID (uuid) */
  id: string;
  /** Which worktree this terminal belongs to */
  worktreeId: string;
  /** tmux server socket name: `catcafe-{worktreeId}` */
  tmuxSocketName: string;
  /** tmux pane ID within the session (e.g., "%0") */
  paneId: string;
  /** PTY process spawned by node-pty */
  pty: import('node-pty').IPty;
  /** Active WebSocket connections to this session */
  wsConnections: Set<import('ws').WebSocket>;
  /** Shell command (e.g., '/bin/zsh') */
  shell: string;
  /** Terminal dimensions */
  cols: number;
  rows: number;
  /** Created at timestamp */
  createdAt: number;
}

/** Wire format: browser → server (JSON over WS) */
export type TerminalClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

/** Wire format: server → browser (binary PTY output, no framing needed for xterm) */
// Raw bytes — xterm.js addon-attach handles binary directly
```

```typescript
// packages/web/src/types/terminal.ts (or inline in component)

export interface TerminalTabState {
  sessionId: string;
  worktreeId: string;
  connected: boolean;
}
```

---

## Task 1: TmuxGateway 服务 + 单元测试

**Files:**
- Create: `packages/api/src/domains/terminal/tmux-gateway.ts`
- Create: `packages/api/src/domains/terminal/types.ts`
- Test: `packages/api/test/domains/terminal/tmux-gateway.test.ts`

### Step 1: Create types file

```typescript
// packages/api/src/domains/terminal/types.ts
export interface TerminalSession {
  id: string;
  worktreeId: string;
  tmuxSocketName: string;
  paneId: string;
  shell: string;
  cols: number;
  rows: number;
  createdAt: number;
}
```

### Step 2: Write failing test for TmuxGateway

```typescript
// packages/api/test/domains/terminal/tmux-gateway.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TmuxGateway } from '../../../src/domains/terminal/tmux-gateway.js';

describe('TmuxGateway', () => {
  // NOTE: These tests require tmux installed on the system
  const TEST_WORKTREE_ID = 'test-gateway-unit';
  let gateway: TmuxGateway;

  before(() => {
    gateway = new TmuxGateway();
  });

  after(async () => {
    await gateway.destroyServer(TEST_WORKTREE_ID);
  });

  it('should create a tmux server for a worktree', async () => {
    const socketName = await gateway.ensureServer(TEST_WORKTREE_ID);
    assert.equal(socketName, `catcafe-${TEST_WORKTREE_ID}`);
  });

  it('should create a pane and return its ID', async () => {
    const paneId = await gateway.createPane(TEST_WORKTREE_ID, {
      cols: 80, rows: 24, cwd: '/tmp'
    });
    assert.ok(paneId, 'pane ID should be non-empty');
    assert.match(paneId, /^%\d+$/);
  });

  it('should list panes for a worktree', async () => {
    const panes = await gateway.listPanes(TEST_WORKTREE_ID);
    assert.ok(panes.length >= 1);
  });

  it('should destroy server and clean up', async () => {
    await gateway.destroyServer(TEST_WORKTREE_ID);
    const panes = await gateway.listPanes(TEST_WORKTREE_ID);
    assert.equal(panes.length, 0);
  });
});
```

### Step 3: Run test to verify it fails

Run: `cd packages/api && node --test test/domains/terminal/tmux-gateway.test.ts`
Expected: FAIL — module not found

### Step 4: Implement TmuxGateway

```typescript
// packages/api/src/domains/terminal/tmux-gateway.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface CreatePaneOpts {
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
}

export interface PaneInfo {
  paneId: string;
  panePid: number;
  paneWidth: number;
  paneHeight: number;
}

/**
 * Manages tmux servers: one tmux server per worktree.
 * Uses CLI mode (execFile per command) — reliable and simple.
 * Control mode (-CC) can be added later if needed for streaming events.
 */
export class TmuxGateway {
  private activeServers = new Set<string>();

  /** Socket name for a worktree */
  socketName(worktreeId: string): string {
    return `catcafe-${worktreeId}`;
  }

  /** Ensure a tmux server is running for this worktree */
  async ensureServer(worktreeId: string): Promise<string> {
    const sock = this.socketName(worktreeId);
    if (this.activeServers.has(worktreeId)) return sock;

    // Check if server already running
    try {
      await exec('tmux', ['-L', sock, 'list-sessions']);
      this.activeServers.add(worktreeId);
      return sock;
    } catch {
      // Server not running — will be created on first pane
    }
    return sock;
  }

  /** Create a new pane (creates session if needed) */
  async createPane(worktreeId: string, opts: CreatePaneOpts = {}): Promise<string> {
    const sock = this.socketName(worktreeId);
    const shell = opts.shell ?? process.env['SHELL'] ?? '/bin/zsh';
    const cwd = opts.cwd ?? process.env['HOME'] ?? '/tmp';
    const cols = opts.cols ?? 80;
    const rows = opts.rows ?? 24;

    if (!this.activeServers.has(worktreeId)) {
      // Create new session
      await exec('tmux', [
        '-L', sock,
        'new-session', '-d',
        '-x', String(cols), '-y', String(rows),
        '-c', cwd,
        shell,
      ]);
      this.activeServers.add(worktreeId);
    } else {
      // Add window to existing session
      await exec('tmux', [
        '-L', sock,
        'new-window',
        '-c', cwd,
        shell,
      ]);
    }

    // Get the pane ID of the most recently created pane
    const { stdout } = await exec('tmux', [
      '-L', sock,
      'display-message', '-p', '#{pane_id}',
    ]);
    return stdout.trim();
  }

  /** List all panes for a worktree */
  async listPanes(worktreeId: string): Promise<PaneInfo[]> {
    const sock = this.socketName(worktreeId);
    try {
      const { stdout } = await exec('tmux', [
        '-L', sock,
        'list-panes', '-a',
        '-F', '#{pane_id} #{pane_pid} #{pane_width} #{pane_height}',
      ]);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [paneId, pid, width, height] = line.split(' ');
        return {
          paneId: paneId!,
          panePid: Number(pid),
          paneWidth: Number(width),
          paneHeight: Number(height),
        };
      });
    } catch {
      return []; // Server not running
    }
  }

  /** Resize a pane */
  async resizePane(worktreeId: string, paneId: string, cols: number, rows: number): Promise<void> {
    const sock = this.socketName(worktreeId);
    await exec('tmux', ['-L', sock, 'resize-pane', '-t', paneId, '-x', String(cols), '-y', String(rows)]);
  }

  /** Kill the entire tmux server for a worktree */
  async destroyServer(worktreeId: string): Promise<void> {
    const sock = this.socketName(worktreeId);
    try {
      await exec('tmux', ['-L', sock, 'kill-server']);
    } catch {
      // Already dead
    }
    this.activeServers.delete(worktreeId);
  }
}
```

### Step 5: Run test to verify it passes

Run: `cd packages/api && node --test test/domains/terminal/tmux-gateway.test.ts`
Expected: PASS (requires `tmux` installed on system)

### Step 6: Commit

```bash
git add packages/api/src/domains/terminal/ packages/api/test/domains/terminal/
git commit -m "feat(F089): TmuxGateway service — worktree-level tmux server management [布偶猫]"
```

---

## Task 2: Terminal WebSocket 路由（@fastify/websocket）

**Files:**
- Create: `packages/api/src/routes/terminal.ts`
- Modify: `packages/api/src/index.ts` (register websocket plugin + terminal routes)
- Test: `packages/api/test/routes/terminal.test.ts`

### Step 1: Write failing test for terminal WebSocket route

```typescript
// packages/api/test/routes/terminal.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { terminalRoutes } from '../../src/routes/terminal.js';
import { TmuxGateway } from '../../src/domains/terminal/tmux-gateway.js';

describe('Terminal WebSocket Route', () => {
  let app: ReturnType<typeof Fastify>;
  let gateway: TmuxGateway;
  const TEST_PORT = 0; // random port

  before(async () => {
    gateway = new TmuxGateway();
    app = Fastify();
    await app.register(fastifyWebsocket);
    await app.register(terminalRoutes, { tmuxGateway: gateway });
    await app.listen({ port: TEST_PORT, host: '127.0.0.1' });
  });

  after(async () => {
    await app.close();
    await gateway.destroyServer('test-ws');
  });

  it('should accept WebSocket connection and echo PTY output', async () => {
    const port = (app.server.address() as any).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/terminal/sessions?worktreeId=test-ws`);

    const output = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('message', (data) => {
        clearTimeout(timeout);
        resolve(data.toString());
      });
      ws.on('error', reject);
      ws.on('open', () => {
        // Send a simple command once we get any initial output
      });
    });

    assert.ok(output.length > 0, 'should receive PTY output');
    ws.close();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && node --test test/routes/terminal.test.ts`
Expected: FAIL — module not found

### Step 3: Register @fastify/websocket in main server

Modify `packages/api/src/index.ts`:
- Add `import fastifyWebsocket from '@fastify/websocket';`
- After CORS setup: `await app.register(fastifyWebsocket);`
- Import and register `terminalRoutes` with injected `TmuxGateway`

```typescript
// Near top imports
import fastifyWebsocket from '@fastify/websocket';
import { terminalRoutes } from './routes/terminal.js';
import { TmuxGateway } from './domains/terminal/tmux-gateway.js';

// After CORS
await app.register(fastifyWebsocket);

// After other route registrations
const tmuxGateway = new TmuxGateway();
await app.register(terminalRoutes, { tmuxGateway });
```

### Step 4: Implement terminal route

```typescript
// packages/api/src/routes/terminal.ts
import type { FastifyPluginAsync } from 'fastify';
import type { TmuxGateway } from '../domains/terminal/tmux-gateway.js';
import * as pty from 'node-pty';
import { randomUUID } from 'node:crypto';

interface TerminalRouteOpts {
  tmuxGateway: TmuxGateway;
}

interface ActiveSession {
  id: string;
  pty: pty.IPty;
  worktreeId: string;
}

export const terminalRoutes: FastifyPluginAsync<TerminalRouteOpts> = async (app, opts) => {
  const { tmuxGateway } = opts;
  const sessions = new Map<string, ActiveSession>();

  // POST /api/terminal/sessions — create a new terminal session
  app.post<{
    Body: { worktreeId: string; cols?: number; rows?: number };
  }>('/api/terminal/sessions', async (req, reply) => {
    const { worktreeId, cols = 80, rows = 24 } = req.body;
    const id = randomUUID();
    const shell = process.env['SHELL'] ?? '/bin/zsh';

    // Ensure tmux server exists
    await tmuxGateway.ensureServer(worktreeId);
    const paneId = await tmuxGateway.createPane(worktreeId, { cols, rows });

    // Spawn PTY attached to the tmux pane
    // For Phase 1: direct PTY spawn (tmux pane for lifecycle, PTY for I/O)
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env['HOME'] ?? '/tmp',
      env: { ...process.env } as Record<string, string>,
    });

    sessions.set(id, { id, pty: ptyProcess, worktreeId });

    return { sessionId: id, paneId };
  });

  // GET /api/terminal/sessions/:sessionId/ws — WebSocket attach
  app.get<{
    Params: { sessionId: string };
  }>('/api/terminal/sessions/:sessionId/ws', { websocket: true }, (socket, req) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      socket.close(4004, 'Session not found');
      return;
    }

    const { pty: ptyProcess } = session;

    // PTY output → WebSocket
    const dataHandler = ptyProcess.onData((data) => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(data);
      }
    });

    // WebSocket input → PTY
    socket.on('message', (raw) => {
      const msg = raw.toString();
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
        } else if (parsed.type === 'input' && typeof parsed.data === 'string') {
          ptyProcess.write(parsed.data);
        }
      } catch {
        // Not JSON — treat as raw input
        ptyProcess.write(msg);
      }
    });

    // Cleanup on disconnect
    socket.on('close', () => {
      dataHandler.dispose();
    });

    // PTY exit → close WS
    ptyProcess.onExit(() => {
      socket.close(1000, 'PTY exited');
      sessions.delete(sessionId);
    });
  });

  // DELETE /api/terminal/sessions/:sessionId — kill session
  app.delete<{
    Params: { sessionId: string };
  }>('/api/terminal/sessions/:sessionId', async (req, reply) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    session.pty.kill();
    sessions.delete(sessionId);
    return { ok: true };
  });

  // GET /api/terminal/sessions — list active sessions
  app.get('/api/terminal/sessions', async () => {
    return [...sessions.values()].map((s) => ({
      id: s.id,
      worktreeId: s.worktreeId,
    }));
  });
};
```

### Step 5: Run test to verify it passes

Run: `cd packages/api && node --test test/routes/terminal.test.ts`
Expected: PASS

### Step 6: Commit

```bash
git add packages/api/src/routes/terminal.ts packages/api/src/index.ts packages/api/test/routes/terminal.test.ts
git commit -m "feat(F089): terminal WebSocket route — @fastify/websocket + node-pty [布偶猫]"
```

---

## Task 3: 安装前端依赖 + TerminalTab 组件

**Files:**
- Modify: `packages/web/package.json` (add xterm deps)
- Create: `packages/web/src/components/workspace/TerminalTab.tsx`

### Step 1: Install xterm dependencies

```bash
cd packages/web && pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-attach
```

### Step 2: Implement TerminalTab component

```tsx
// packages/web/src/components/workspace/TerminalTab.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  worktreeId: string;
  apiBase?: string;
}

export function TerminalTab({ worktreeId, apiBase = '' }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  // Create terminal session and connect WebSocket
  const connect = useCallback(async () => {
    if (!containerRef.current) return;
    setStatus('connecting');

    // 1. Create session via REST
    const res = await fetch(`${apiBase}/api/terminal/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worktreeId, cols: 80, rows: 24 }),
    });
    if (!res.ok) {
      setStatus('disconnected');
      return;
    }
    const { sessionId: sid } = await res.json();
    setSessionId(sid);

    // 2. Init xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // 3. Connect WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = apiBase ? new URL(apiBase).host : window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/terminal/sessions/${sid}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Send initial resize
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    };

    ws.onmessage = (event) => {
      term.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer));
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    // 4. Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // 5. Resize handling
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [worktreeId, apiBase]);

  // Auto-connect on mount
  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.then((fn) => fn?.());
      // Kill session on unmount
      if (sessionId) {
        fetch(`${apiBase}/api/terminal/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, [connect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px', fontSize: 12, color: '#888',
        borderBottom: '1px solid #2a2b3d',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status === 'connected' ? '#9ece6a' : status === 'connecting' ? '#e0af68' : '#f7768e',
        }} />
        <span>{status === 'connected' ? 'Terminal' : status === 'connecting' ? 'Connecting…' : 'Disconnected'}</span>
        {status === 'disconnected' && (
          <button onClick={connect} style={{
            background: 'none', border: '1px solid #444', color: '#aaa',
            padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
          }}>
            Reconnect
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
}
```

### Step 3: Commit

```bash
git add packages/web/package.json packages/web/src/components/workspace/TerminalTab.tsx
git commit -m "feat(F089): TerminalTab component — xterm.js + WebSocket connect [布偶猫]"
```

---

## Task 4: WorkspacePanel 集成 Terminal tab

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx`

### Step 1: Add 'terminal' to viewMode union

Change `useState<'files' | 'changes' | 'git'>('files')` to `useState<'files' | 'changes' | 'git' | 'terminal'>('files')`

### Step 2: Add Terminal tab button in the tab bar

In the tab bar array `['files', 'changes', 'git']`, add `'terminal'`.
Update the label logic: `mode === 'terminal' ? 'Terminal' : ...`

### Step 3: Add TerminalTab rendering

After the existing `viewMode === 'git'` / `viewMode === 'changes'` conditionals, add:
```tsx
viewMode === 'terminal' ? (
  <TerminalTab worktreeId={worktreeId} apiBase={apiBase} />
) : ...
```

### Step 4: Import TerminalTab

```typescript
import { TerminalTab } from './workspace/TerminalTab';
```

### Step 5: Verify build

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

### Step 6: Commit

```bash
git add packages/web/src/components/WorkspacePanel.tsx
git commit -m "feat(F089): integrate Terminal tab into WorkspacePanel [布偶猫]"
```

---

## Task 5: 安装后端依赖 + node-pty

**Files:**
- Modify: `packages/api/package.json`

### Step 1: Install node-pty

```bash
cd packages/api && pnpm add node-pty
```

Note: `node-pty` requires native compilation. Verify with:
```bash
node -e "require('node-pty')"
```

If Xcode CLI tools are missing: `xcode-select --install`

### Step 2: Verify full test suite

```bash
cd packages/api && pnpm test
```

### Step 3: Commit

```bash
git add packages/api/package.json pnpm-lock.yaml
git commit -m "deps(F089): add node-pty for terminal PTY management [布偶猫]"
```

---

## Task 6: 端到端验证

### Step 1: Start API server

```bash
cd packages/api && pnpm dev
```

### Step 2: Start web dev server

```bash
cd packages/web && pnpm dev
```

### Step 3: Manual test in browser

1. 打开 Hub → 选择一个 worktree → 点 Terminal tab
2. 验证：terminal 渲染、能输入命令、输出正确
3. 验证：resize 跟随面板大小变化
4. 验证：关闭 tab → session 清理（检查 `tmux ls` 输出）

### Step 4: Run full test suite

```bash
pnpm test && pnpm check && pnpm lint
```

### Step 5: Commit any fixes

---

## 检查清单

| # | 检查项 | AC 对应 |
|---|--------|---------|
| 1 | TmuxGateway 能管理 per-worktree tmux server | AC: TmuxGateway 服务 |
| 2 | `@fastify/websocket` 路由可连接 | AC: websocket 路由 |
| 3 | 浏览器 xterm.js 能渲染 terminal | AC: 前端 xterm |
| 4 | WorkspacePanel 有 Terminal tab | AC: Terminal tab |
| 5 | 输入/输出/resize 都正常 | AC: 用户 shell |
| 6 | Spike 结论记录在 spec 中 | AC: Spike |
| 7 | 所有测试通过 + build clean | 基本质量 |
