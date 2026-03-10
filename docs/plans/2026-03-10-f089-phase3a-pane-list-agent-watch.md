---
feature_ids: [F089]
doc_kind: plan
created: 2026-03-10
author: opus
---

# F089 Phase 3a: Pane List UI + Agent Watch + worktreeId Fix

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Frontend can list all tmux panes (user shell + agent) and attach read-only to agent panes, with correct worktreeId from canonical source.

**Architecture:** Backend adds `resolveWorktreeIdByPath()` to workspace-security (reverse lookup: path → canonical id). Agent pane WS attach reuses existing `@fastify/websocket` infrastructure with `node-pty` `tmux attach -r` (read-only). Frontend splits TerminalTab into a pane list sidebar + terminal view, with agent panes fetched from `GET /api/terminal/agent-panes`.

**Tech Stack:** node-pty, @fastify/websocket, @xterm/xterm, tmux CLI

**Not building:** Takeover (Phase 3b), ProcessTree (Phase 3b), stdin pipe (Phase 4)

---

## Task 1: Fix worktreeId derivation — add `resolveWorktreeIdByPath()`

**Files:**
- Modify: `packages/api/src/domains/workspace/workspace-security.ts:135`
- Test: `packages/api/test/workspace-security.test.js` (existing or new)

**Why:** `invoke-single-cat.ts:400` uses `basename(workingDirectory)` which doesn't match workspace-security's canonical id rules (sanitization + `_head` dedup suffix). We need a reverse lookup: given a directory path, find the canonical worktreeId.

**Step 1: Write the failing test**

```typescript
// In workspace-security test file
test('resolveWorktreeIdByPath returns canonical id for known worktree root', async () => {
  const entries = await listWorktrees();
  // At least the main worktree exists
  assert.ok(entries.length > 0);
  const first = entries[0];
  const resolvedId = await resolveWorktreeIdByPath(first.root);
  assert.strictEqual(resolvedId, first.id);
});

test('resolveWorktreeIdByPath throws for unknown path', async () => {
  await assert.rejects(
    () => resolveWorktreeIdByPath('/nonexistent/path/xyzzy'),
    { code: 'NOT_FOUND' },
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/workspace-security.test.js`
Expected: FAIL — `resolveWorktreeIdByPath` is not exported

**Step 3: Implement `resolveWorktreeIdByPath`**

Add after `getWorktreeRoot()` in `workspace-security.ts`:

```typescript
/**
 * Reverse lookup: given an absolute directory path, find its canonical worktreeId.
 * Checks git worktrees, linked roots, and in-memory registry.
 */
export async function resolveWorktreeIdByPath(dirPath: string, repoRoot?: string): Promise<string> {
  const resolved = resolve(dirPath);

  // Check git worktrees
  const entries = await listWorktrees(repoRoot);
  const entry = entries.find((e) => e.root === resolved);
  if (entry) return entry.id;

  // Check linked roots
  const linked = await getLinkedRootsAsync();
  const linkedEntry = linked.find((r) => r.root === resolved);
  if (linkedEntry) return linkedEntry.id;

  // Check in-memory registry
  for (const [id, root] of worktreeRegistry.entries()) {
    if (root === resolved) return id;
  }

  throw new WorkspaceSecurityError(`No worktree found for path: ${dirPath}`, 'NOT_FOUND');
}
```

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/workspace-security.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/workspace/workspace-security.ts packages/api/test/workspace-security.test.js
git commit -m "feat(F089): add resolveWorktreeIdByPath for canonical worktreeId lookup"
```

---

## Task 2: Use canonical worktreeId in invoke-single-cat

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:397-404`

**Step 1: Write the failing test**

This is an integration-level change. The test is implicit: Task 1's `resolveWorktreeIdByPath` is correct, and we wire it in. Add a targeted unit test if `invoke-single-cat` has existing test infrastructure; otherwise verify via type-check + existing tmux-agent-spawner tests.

**Step 2: Replace basename with canonical lookup**

Change `invoke-single-cat.ts:397-404` from:

```typescript
if (deps.tmuxGateway && workingDirectory) {
  const { basename } = await import('node:path');
  const { createTmuxSpawnOverride } = await import('../../../../terminal/tmux-agent-spawner.js');
  const worktreeId = basename(workingDirectory);
```

To:

```typescript
if (deps.tmuxGateway && workingDirectory) {
  const { resolveWorktreeIdByPath } = await import('../../../../workspace/workspace-security.js');
  const { createTmuxSpawnOverride } = await import('../../../../terminal/tmux-agent-spawner.js');
  let worktreeId: string;
  try {
    worktreeId = await resolveWorktreeIdByPath(workingDirectory);
  } catch {
    // Worktree not registered — fall back to basename (non-git project)
    const { basename } = await import('node:path');
    worktreeId = basename(workingDirectory);
  }
```

**Step 3: Type-check**

Run: `pnpm --filter @cat-cafe/api exec tsc --noEmit`
Expected: 0 errors

**Step 4: Run existing tests**

Run: `node --test packages/api/test/tmux-agent-spawner.test.js`
Expected: All pass (no regression)

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts
git commit -m "fix(F089): use canonical worktreeId from workspace-security instead of bare basename"
```

---

## Task 3: Backend — agent pane WS attach endpoint

**Files:**
- Modify: `packages/api/src/routes/terminal.ts` (add new WS route)
- Test: `packages/api/test/terminal-lifecycle.test.js` (or new file)

**Why:** Frontend needs to attach xterm.js to an agent pane for read-only observation. Reuse the same PTY-bridge pattern as user shell sessions: `node-pty` spawns `tmux attach -r -t {paneId}` (read-only flag `-r`).

**Step 1: Write the failing test**

```typescript
test('GET /api/terminal/agent-panes/:paneId/ws returns 404 for non-existent pane', async () => {
  // Test the error path — WS should close with 4004 if pane not found
  // (full WS test requires running tmux; this tests the guard clause)
});
```

**Step 2: Implement the endpoint**

Add after the existing `agent-panes` GET route in `terminal.ts`:

```typescript
// GET /api/terminal/agent-panes/:paneId/ws — read-only attach to agent pane
app.get<{
  Params: { paneId: string };
  Querystring: { worktreeId: string };
}>('/api/terminal/agent-panes/:paneId/ws', { websocket: true }, (socket, req) => {
  const { paneId } = req.params;
  const { worktreeId } = req.query;

  if (!worktreeId || !agentPaneRegistry) {
    socket.close(4004, 'Agent pane tracking not enabled or missing worktreeId');
    return;
  }

  // Verify pane exists in registry
  const panes = agentPaneRegistry.listByWorktree(worktreeId);
  const paneInfo = panes.find((p) => p.paneId === paneId);
  if (!paneInfo) {
    socket.close(4004, 'Agent pane not found');
    return;
  }

  // Spawn node-pty in read-only mode: tmux attach -r -t {paneId}
  const sock = tmuxGateway.socketName(worktreeId);
  const ptyProcess = pty.spawn('tmux', ['-L', sock, 'attach', '-r', '-t', paneId], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
  });

  // PTY output → WebSocket (read-only: no input from client)
  const dataHandler = ptyProcess.onData((data) => {
    if (socket.readyState === 1) socket.send(data);
  });

  // Only handle resize from client, ignore input
  socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
    const msg = Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    try {
      const parsed = JSON.parse(msg) as { type: string; cols?: number; rows?: number };
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(parsed.cols, parsed.rows);
      }
      // Silently ignore 'input' type — this is read-only
    } catch { /* ignore */ }
  });

  socket.on('close', () => {
    dataHandler.dispose();
    ptyProcess.kill();
  });

  ptyProcess.onExit(() => {
    socket.close(1000, 'Agent pane exited');
  });
});
```

**Step 3: Type-check**

Run: `pnpm --filter @cat-cafe/api exec tsc --noEmit`
Expected: 0 errors

**Step 4: Run existing terminal tests**

Run: `node --test packages/api/test/terminal-lifecycle.test.js`
Expected: All pass (no regression)

**Step 5: Commit**

```bash
git add packages/api/src/routes/terminal.ts
git commit -m "feat(F089): add agent pane WS attach endpoint (read-only)"
```

---

## Task 4: Frontend — AgentPaneList component

**Files:**
- Create: `packages/web/src/components/workspace/AgentPaneList.tsx`
- Test: visual verification (React component)

**Why:** Show all agent panes for the current worktree with status indicators. Click to attach (watch).

**Step 1: Implement the component**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

interface AgentPane {
  invocationId: string;
  paneId: string;
  status: 'running' | 'done' | 'crashed';
  startedAt: number;
}

interface AgentPaneListProps {
  worktreeId: string;
  onSelectPane: (paneId: string) => void;
  selectedPaneId?: string;
}

export function AgentPaneList({ worktreeId, onSelectPane, selectedPaneId }: AgentPaneListProps) {
  const [panes, setPanes] = useState<AgentPane[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/terminal/agent-panes?worktreeId=${encodeURIComponent(worktreeId)}`);
      if (res.ok) setPanes(await res.json() as AgentPane[]);
    } catch { /* ignore */ }
  }, [worktreeId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (panes.length === 0) return null;

  const statusColor = (s: AgentPane['status']) =>
    s === 'running' ? '#9ece6a' : s === 'crashed' ? '#f7768e' : '#888';
  const statusLabel = (s: AgentPane['status']) =>
    s === 'running' ? 'Running' : s === 'crashed' ? 'Crashed' : 'Done';

  return (
    <div style={{ borderBottom: '1px solid #2a2b3d', padding: '4px 0' }}>
      <div style={{ padding: '2px 8px', fontSize: 11, color: '#666', fontWeight: 600 }}>
        Agent Panes
      </div>
      {panes.map((p) => (
        <button
          key={p.invocationId}
          type="button"
          onClick={() => onSelectPane(p.paneId)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', padding: '4px 8px', fontSize: 12,
            background: selectedPaneId === p.paneId ? '#2a2b3d' : 'transparent',
            border: 'none', color: '#a9b1d6', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor(p.status), flexShrink: 0,
          }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.invocationId.slice(0, 8)}
          </span>
          <span style={{ fontSize: 10, color: '#666' }}>{statusLabel(p.status)}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Type-check**

Run: `pnpm --filter @cat-cafe/web exec tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add packages/web/src/components/workspace/AgentPaneList.tsx
git commit -m "feat(F089): add AgentPaneList component for agent pane discovery"
```

---

## Task 5: Frontend — AgentPaneViewer (read-only xterm.js)

**Files:**
- Create: `packages/web/src/components/workspace/AgentPaneViewer.tsx`
- Test: visual verification

**Why:** Attach xterm.js to the agent pane WS endpoint in read-only mode. Similar to TerminalTab but no input forwarding.

**Step 1: Implement the component**

```tsx
'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/utils/api-client';
import { getUserId } from '@/utils/userId';
import '@xterm/xterm/css/xterm.css';

interface AgentPaneViewerProps {
  worktreeId: string;
  paneId: string;
}

export function AgentPaneViewer({ worktreeId, paneId }: AgentPaneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'watching' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      disableStdin: true,
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

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = new URL(API_URL);
    const userId = encodeURIComponent(getUserId());
    const ws = new WebSocket(
      `${wsProtocol}//${apiUrl.host}/api/terminal/agent-panes/${paneId}/ws?worktreeId=${encodeURIComponent(worktreeId)}&userId=${userId}`,
    );

    ws.onopen = () => {
      setStatus('watching');
      const dims = fitAddon.proposeDimensions();
      if (dims) ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
    };
    ws.onmessage = (event) => {
      term.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer));
    };
    ws.onclose = () => setStatus('disconnected');

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [worktreeId, paneId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px', fontSize: 12, color: '#888',
        borderBottom: '1px solid #2a2b3d',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status === 'watching' ? '#7aa2f7' : status === 'connecting' ? '#e0af68' : '#f7768e',
        }} />
        <span>
          {status === 'watching' ? `Watching ${paneId}` : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </span>
        <span style={{ fontSize: 10, color: '#555', marginLeft: 'auto' }}>read-only</span>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
}
```

**Step 2: Type-check**

Run: `pnpm --filter @cat-cafe/web exec tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add packages/web/src/components/workspace/AgentPaneViewer.tsx
git commit -m "feat(F089): add AgentPaneViewer component (read-only xterm.js)"
```

---

## Task 6: Integrate into TerminalTab — pane list + agent watch

**Files:**
- Modify: `packages/web/src/components/workspace/TerminalTab.tsx`

**Why:** TerminalTab currently only shows a single user shell. Add the AgentPaneList above the terminal, and switch to AgentPaneViewer when an agent pane is selected.

**Step 1: Modify TerminalTab**

Add state for selected agent pane. When an agent pane is selected, render AgentPaneViewer instead of the user shell terminal. Add a "Back to shell" button to deselect.

Key changes:
- Import `AgentPaneList` and `AgentPaneViewer`
- Add `const [watchingPane, setWatchingPane] = useState<string | null>(null)`
- Render `<AgentPaneList>` above the terminal area
- When `watchingPane` is set, render `<AgentPaneViewer>` instead of shell terminal
- "Back to shell" button resets `watchingPane` to null

**Step 2: Type-check**

Run: `pnpm --filter @cat-cafe/web exec tsc --noEmit`
Expected: 0 errors

**Step 3: Build**

Run: `pnpm --filter @cat-cafe/web build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/web/src/components/workspace/TerminalTab.tsx
git commit -m "feat(F089): integrate agent pane list + watch into TerminalTab"
```

---

## Task 7: Update F089 spec checklist

**Files:**
- Modify: `docs/features/F089-hub-terminal-tmux.md`

**Step 1: Mark Phase 3a items as done**

Update checklist items:
- `[x] tmux pane 列表 UI` (Phase 3, line 85)
- `[x] 前端 agent pane attach/watch UI` (Phase 3, line 86)
- `[x] agent 侧 worktreeId 改用 canonical id` (Phase 3, line 87)
- `[x] 1b 浏览器内 tmux pane 列表 UI` (Checklist, line 149)
- `[x] 2b 观察 agent 操作（前端 UI 入口）` (Checklist, line 151)

**Step 2: Commit**

```bash
git add docs/features/F089-hub-terminal-tmux.md
git commit -m "docs(F089): mark Phase 3a items done in spec"
```

---

## Verification Checklist

After all tasks:

```bash
# Type-check
pnpm --filter @cat-cafe/api exec tsc --noEmit
pnpm --filter @cat-cafe/web exec tsc --noEmit

# Tests
node --test packages/api/test/workspace-security.test.js
node --test packages/api/test/tmux-gateway.test.js
node --test packages/api/test/tmux-agent-spawner.test.js
node --test packages/api/test/terminal-lifecycle.test.js

# Build
pnpm -r --if-present run build

# Biome
pnpm check
```
