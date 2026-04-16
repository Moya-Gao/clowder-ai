# F146 Phase A: 能力中心写路径 Implementation Plan

**Feature:** F146 — `docs/features/F146-mcp-marketplace-control-plane.md`
**Goal:** Hub 可通过 UI 一键添加/删除 MCP，无需手改 capabilities.json，所有写操作带审计日志、并发安全、预览确认
**Acceptance Criteria:**
- AC-A1: Hub 可通过 UI 新增 MCP（无需手改 capabilities.json）
- AC-A2: Hub 可通过 UI 删除 MCP，并触发配置重编排
- AC-A3: 新增 MCP 后自动触发 generateCliConfigs + mcp:doctor 探测
- AC-A4: 所有 MCP 写操作有审计日志（用户、时间、变更 diff）
- AC-A5: 并发写入安全（锁或 CAS）可验证，双写场景不丢配置
- AC-A6: install preview 可显示"将写入项 + 将触发探测 + 风险提示"，用户确认后才执行
**Architecture:** 在现有 capability-orchestrator 的 read/write 基础上，新增 write lock + audit log + preview/install/delete API 三端口，前端在 Hub 能力中心新增 MCP 管理 UI（表单 + 预览确认流）
**Tech Stack:** Fastify routes, React (Hub components), existing capability-orchestrator, JSONL audit log
**前端验证:** Yes — 需用浏览器实测 Hub MCP 管理 UI

---

## NOT building (Phase A scope fence)

- 不做 marketplace 搜索/聚合（Phase B）
- 不做 trustLevel / community 二次确认策略（Phase C）
- 不做 skill poisoning defense（Phase C）
- 不做 L1/L2/L3 分层过滤视图（Phase D）
- 不做 MCP 版本升级流程（Phase B/C 范畴）

## Terminal Schema

```typescript
// packages/shared/src/types/capability.ts — 新增

/** POST /api/capabilities/mcp/install request body */
export interface McpInstallRequest {
  id: string;
  transport?: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  resolver?: string;
  projectPath?: string;
}

/** POST /api/capabilities/mcp/preview response */
export interface McpInstallPreview {
  entry: CapabilityEntry;
  cliConfigsAffected: string[];
  willProbe: boolean;
  risks: string[];
}

/** DELETE /api/capabilities/mcp/:id query params */
export interface McpDeleteParams {
  hard?: boolean; // true = remove from capabilities.json; false/omit = disable only
  projectPath?: string;
}

/** Audit log entry (append-only JSONL) */
export interface CapabilityAuditEntry {
  timestamp: string;
  userId: string;
  action: 'install' | 'delete' | 'update' | 'toggle';
  capabilityId: string;
  before: CapabilityEntry | null;
  after: CapabilityEntry | null;
}
```

---

## Task 1: Shared types for MCP write operations

**Files:**
- Modify: `packages/shared/src/types/capability.ts`
- Test: `packages/shared/src/types/capability.test.ts` (type-level, compile check)

**Step 1: Write the types**

Add `McpInstallRequest`, `McpInstallPreview`, `McpDeleteParams`, `CapabilityAuditEntry` to the bottom of capability.ts (before the closing of the file). Also add re-exports.

```typescript
/** POST /api/capabilities/mcp/install request body */
export interface McpInstallRequest {
  id: string;
  transport?: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  resolver?: string;
  projectPath?: string;
}

/** POST /api/capabilities/mcp/preview response */
export interface McpInstallPreview {
  entry: CapabilityEntry;
  cliConfigsAffected: string[];
  willProbe: boolean;
  risks: string[];
}

/** DELETE /api/capabilities/mcp/:id query params */
export interface McpDeleteParams {
  hard?: boolean;
  projectPath?: string;
}

/** Audit log entry (.cat-cafe/audit.jsonl) */
export interface CapabilityAuditEntry {
  timestamp: string;
  userId: string;
  action: 'install' | 'delete' | 'update' | 'toggle';
  capabilityId: string;
  before: CapabilityEntry | null;
  after: CapabilityEntry | null;
}
```

**Step 2: Build shared to verify types compile**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: success, no type errors

**Step 3: Commit**

```bash
git add packages/shared/src/types/capability.ts
git commit -m "feat(F146): add MCP write-path types (install/preview/delete/audit)"
```

---

## Task 2: Capability write lock (AC-A5)

**Files:**
- Modify: `packages/api/src/config/capabilities/capability-orchestrator.ts`
- Test: `packages/api/test/config/capabilities/capability-write-lock.test.ts`

**Step 1: Write failing test — concurrent writes don't lose entries**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { withCapabilityLock } from '../../../src/config/capabilities/capability-orchestrator.js';

describe('withCapabilityLock', () => {
  test('serializes concurrent writes — no entries lost', async () => {
    let counter = 0;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        withCapabilityLock('test-project', async () => {
          const current = counter;
          await new Promise((r) => setTimeout(r, 5)); // simulate async I/O
          counter = current + 1;
          return counter;
        }),
      ),
    );
    assert.equal(counter, 10, 'All 10 increments must succeed without race');
    assert.deepEqual(results, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/config/capabilities/capability-write-lock.test.ts`
Expected: FAIL — `withCapabilityLock` not exported yet

**Step 3: Implement withCapabilityLock**

Add to `capability-orchestrator.ts` near the top (after imports):

```typescript
// Per-project mutex to serialize capability config read-write cycles
const capabilityLocks = new Map<string, Promise<unknown>>();

export function withCapabilityLock<T>(projectRoot: string, fn: () => Promise<T>): Promise<T> {
  const prev = capabilityLocks.get(projectRoot) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  capabilityLocks.set(projectRoot, next);
  const cleanup = () => {
    if (capabilityLocks.get(projectRoot) === next) capabilityLocks.delete(projectRoot);
  };
  next.then(cleanup, cleanup);
  return next;
}
```

Pattern mirrors `withFileLock` in `workspace-edit.ts:63`.

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/config/capabilities/capability-write-lock.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/config/capabilities/capability-orchestrator.ts \
       packages/api/test/config/capabilities/capability-write-lock.test.ts
git commit -m "feat(F146): add withCapabilityLock for concurrent write safety (AC-A5)"
```

---

## Task 3: Audit log module (AC-A4)

**Files:**
- Create: `packages/api/src/config/capabilities/capability-audit.ts`
- Test: `packages/api/test/config/capabilities/capability-audit.test.ts`

**Step 1: Write failing test**

```typescript
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendAuditEntry, readAuditLog } from '../../../src/config/capabilities/capability-audit.js';

describe('capability audit log', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cap-audit-'));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('appends entry and reads back', async () => {
    await appendAuditEntry(tmpDir, {
      timestamp: '2026-04-16T00:00:00Z',
      userId: 'test-user',
      action: 'install',
      capabilityId: 'test-mcp',
      before: null,
      after: { id: 'test-mcp', type: 'mcp', enabled: true, source: 'external' },
    });
    const entries = await readAuditLog(tmpDir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, 'install');
    assert.equal(entries[0].capabilityId, 'test-mcp');
  });

  test('appends multiple entries', async () => {
    for (let i = 0; i < 3; i++) {
      await appendAuditEntry(tmpDir, {
        timestamp: new Date().toISOString(),
        userId: 'user',
        action: 'toggle',
        capabilityId: `mcp-${i}`,
        before: null,
        after: null,
      });
    }
    const entries = await readAuditLog(tmpDir);
    assert.equal(entries.length, 3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/config/capabilities/capability-audit.test.ts`
Expected: FAIL — module not found

**Step 3: Implement audit module**

```typescript
// packages/api/src/config/capabilities/capability-audit.ts
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CapabilityAuditEntry } from '@cat-cafe/shared';

const AUDIT_DIR = '.cat-cafe';
const AUDIT_FILE = 'audit.jsonl';

export async function appendAuditEntry(projectRoot: string, entry: CapabilityAuditEntry): Promise<void> {
  const dir = join(projectRoot, AUDIT_DIR);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, AUDIT_FILE);
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf-8');
}

export async function readAuditLog(projectRoot: string, limit = 100): Promise<CapabilityAuditEntry[]> {
  const filePath = join(projectRoot, AUDIT_DIR, AUDIT_FILE);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as CapabilityAuditEntry);
  } catch {
    return [];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/config/capabilities/capability-audit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/config/capabilities/capability-audit.ts \
       packages/api/test/config/capabilities/capability-audit.test.ts
git commit -m "feat(F146): add capability audit log module (AC-A4)"
```

---

## Task 4: Install preview API (AC-A6)

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
- Test: `packages/api/test/routes/capabilities-install.test.ts`

**Step 1: Write failing test — preview returns entry + affected configs + risks**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildInstallPreview } from '../../../src/routes/capabilities.js';

describe('buildInstallPreview', () => {
  test('stdio MCP returns entry with correct fields', () => {
    const preview = buildInstallPreview({
      id: 'test-mcp',
      command: 'npx',
      args: ['test-mcp-server'],
    });
    assert.equal(preview.entry.id, 'test-mcp');
    assert.equal(preview.entry.type, 'mcp');
    assert.equal(preview.entry.enabled, true);
    assert.equal(preview.entry.source, 'external');
    assert.equal(preview.entry.mcpServer?.command, 'npx');
    assert.equal(preview.willProbe, true);
    assert.ok(preview.cliConfigsAffected.length > 0);
  });

  test('streamableHttp MCP returns url-based entry', () => {
    const preview = buildInstallPreview({
      id: 'remote-mcp',
      transport: 'streamableHttp',
      url: 'https://mcp.example.com/api',
    });
    assert.equal(preview.entry.mcpServer?.transport, 'streamableHttp');
    assert.equal(preview.entry.mcpServer?.url, 'https://mcp.example.com/api');
  });

  test('duplicate ID flagged as risk', () => {
    const preview = buildInstallPreview(
      { id: 'existing-mcp', command: 'node', args: ['server.js'] },
      [{ id: 'existing-mcp', type: 'mcp', enabled: true, source: 'external' }],
    );
    assert.ok(preview.risks.some((r) => r.includes('already exists')));
  });
});
```

**Step 2: Run test — FAIL (buildInstallPreview not exported)**

**Step 3: Implement buildInstallPreview**

Add to `capabilities.ts` as an exported pure function (testable without HTTP):

```typescript
export function buildInstallPreview(
  req: McpInstallRequest,
  existingCaps?: CapabilityEntry[],
): McpInstallPreview {
  const entry: CapabilityEntry = {
    id: req.id,
    type: 'mcp',
    enabled: true,
    source: 'external',
    mcpServer: {
      transport: req.transport ?? 'stdio',
      command: req.command ?? '',
      args: req.args ?? [],
      ...(req.url && { url: req.url }),
      ...(req.headers && { headers: req.headers }),
      ...(req.env && { env: req.env }),
      ...(req.resolver && { resolver: req.resolver }),
    },
  };

  const cliConfigsAffected = ['.mcp.json', '.codex/config.toml', '.gemini/settings.json', '.kimi/mcp.json'];
  const willProbe = entry.mcpServer?.transport !== 'streamableHttp';

  const risks: string[] = [];
  if (existingCaps?.some((c) => c.id === req.id && c.type === 'mcp')) {
    risks.push(`MCP "${req.id}" already exists — install will overwrite`);
  }
  if (req.command === '' && !req.resolver && !req.url) {
    risks.push('No command, resolver, or URL — MCP will be unresolvable');
  }

  return { entry, cliConfigsAffected, willProbe, risks };
}
```

Then wire the route:

```typescript
// POST /api/capabilities/mcp/preview
app.post('/api/capabilities/mcp/preview', async (request, reply) => {
  const body = request.body as McpInstallRequest | undefined;
  if (!body?.id) {
    reply.status(400);
    return { error: 'Required: id' };
  }

  let projectRoot = getProjectRoot();
  if (body.projectPath) {
    const validated = await validateProjectPath(body.projectPath);
    if (!validated) { reply.status(400); return { error: 'Invalid project path' }; }
    projectRoot = validated;
  }

  const config = await readCapabilitiesConfig(projectRoot);
  return buildInstallPreview(body, config?.capabilities);
});
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add packages/api/src/routes/capabilities.ts \
       packages/api/test/routes/capabilities-install.test.ts
git commit -m "feat(F146): add install preview API (AC-A6)"
```

---

## Task 5: Install API — create MCP entry (AC-A1, AC-A3)

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
- Modify: `packages/api/test/routes/capabilities-install.test.ts`

**Step 1: Write failing test — install creates entry + triggers orchestration**

```typescript
describe('POST /api/capabilities/mcp/install (integration)', () => {
  test('creates new MCP entry and returns ok + probe status', async () => {
    // Uses Fastify inject for integration test
    const response = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: { 'x-cat-cafe-user': 'test-user' },
      payload: {
        id: 'test-new-mcp',
        command: 'echo',
        args: ['hello'],
      },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.ok, true);
    assert.equal(body.capability.id, 'test-new-mcp');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement POST /api/capabilities/mcp/install**

```typescript
app.post('/api/capabilities/mcp/install', async (request, reply) => {
  const userId = resolveUserId(request);
  if (!userId) { reply.status(401); return { error: 'Identity required' }; }

  const body = request.body as McpInstallRequest | undefined;
  if (!body?.id) { reply.status(400); return { error: 'Required: id' }; }

  let projectRoot = getProjectRoot();
  if (body.projectPath) {
    const validated = await validateProjectPath(body.projectPath);
    if (!validated) { reply.status(400); return { error: 'Invalid project path' }; }
    projectRoot = validated;
  }

  return withCapabilityLock(projectRoot, async () => {
    let config = await readCapabilitiesConfig(projectRoot);
    if (!config) {
      config = { version: 1, capabilities: [] };
    }

    const existingIdx = config.capabilities.findIndex((c) => c.id === body.id && c.type === 'mcp');
    const before = existingIdx >= 0 ? structuredClone(config.capabilities[existingIdx]) : null;

    const preview = buildInstallPreview(body, config.capabilities);
    const entry = preview.entry;

    if (existingIdx >= 0) {
      config.capabilities[existingIdx] = { ...config.capabilities[existingIdx], ...entry };
    } else {
      config.capabilities.push(entry);
    }

    await writeCapabilitiesConfig(projectRoot, config);
    await generateCliConfigs(config, getCliConfigPaths(projectRoot));

    // AC-A4: audit
    await appendAuditEntry(projectRoot, {
      timestamp: new Date().toISOString(),
      userId,
      action: before ? 'update' : 'install',
      capabilityId: body.id,
      before,
      after: entry,
    });

    // AC-A3: probe (best-effort, non-blocking response)
    let probeResult: McpProbeResult | null = null;
    if (preview.willProbe && entry.mcpServer) {
      try {
        probeResult = await probeMcpCapability({
          name: entry.id,
          ...entry.mcpServer,
          command: entry.mcpServer.command ?? '',
          args: entry.mcpServer.args ?? [],
          enabled: true,
          source: entry.source,
        });
      } catch { /* probe failure is non-fatal */ }
    }

    return {
      ok: true,
      capability: entry,
      probe: probeResult ? {
        connectionStatus: probeResult.connectionStatus,
        tools: probeResult.tools,
      } : null,
    };
  });
});
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add packages/api/src/routes/capabilities.ts \
       packages/api/test/routes/capabilities-install.test.ts
git commit -m "feat(F146): add MCP install API with orchestration + probe (AC-A1, AC-A3)"
```

---

## Task 6: Delete API — remove MCP entry (AC-A2)

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
- Test: `packages/api/test/routes/capabilities-delete.test.ts`

**Step 1: Write failing test**

```typescript
describe('DELETE /api/capabilities/mcp/:id', () => {
  test('soft delete disables entry', async () => {
    // setup: install first, then soft-delete
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/capabilities/mcp/test-mcp',
      headers: { 'x-cat-cafe-user': 'test-user' },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'disabled');
  });

  test('hard delete removes entry from config', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/capabilities/mcp/test-mcp?hard=true',
      headers: { 'x-cat-cafe-user': 'test-user' },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'removed');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement DELETE route**

```typescript
app.delete('/api/capabilities/mcp/:id', async (request, reply) => {
  const userId = resolveUserId(request);
  if (!userId) { reply.status(401); return { error: 'Identity required' }; }

  const { id } = request.params as { id: string };
  const query = request.query as McpDeleteParams;
  const hard = query.hard === true || query.hard === 'true';

  let projectRoot = getProjectRoot();
  if (query.projectPath) {
    const validated = await validateProjectPath(query.projectPath);
    if (!validated) { reply.status(400); return { error: 'Invalid project path' }; }
    projectRoot = validated;
  }

  return withCapabilityLock(projectRoot, async () => {
    const config = await readCapabilitiesConfig(projectRoot);
    if (!config) { reply.status(404); return { error: 'capabilities.json not found' }; }

    const idx = config.capabilities.findIndex((c) => c.id === id && c.type === 'mcp');
    if (idx === -1) { reply.status(404); return { error: `MCP "${id}" not found` }; }

    const before = structuredClone(config.capabilities[idx]);

    let mode: 'disabled' | 'removed';
    if (hard) {
      config.capabilities.splice(idx, 1);
      mode = 'removed';
    } else {
      config.capabilities[idx].enabled = false;
      mode = 'disabled';
    }

    await writeCapabilitiesConfig(projectRoot, config);
    await generateCliConfigs(config, getCliConfigPaths(projectRoot));

    await appendAuditEntry(projectRoot, {
      timestamp: new Date().toISOString(),
      userId,
      action: 'delete',
      capabilityId: id,
      before,
      after: hard ? null : config.capabilities[idx],
    });

    return { ok: true, mode };
  });
});
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add packages/api/src/routes/capabilities.ts \
       packages/api/test/routes/capabilities-delete.test.ts
git commit -m "feat(F146): add MCP delete API with soft/hard modes (AC-A2)"
```

---

## Task 7: Wire audit into existing PATCH toggle (AC-A4 completeness)

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts` (PATCH handler, ~line 774)
- Modify: existing PATCH tests if any

**Step 1: Add audit entry to existing PATCH handler**

Capture `before` snapshot before mutation, write audit after `writeCapabilitiesConfig`:

```typescript
// Inside PATCH handler, before mutation:
const before = structuredClone(cap);

// ... existing toggle logic ...

// After writeCapabilitiesConfig + generateCliConfigs:
await appendAuditEntry(projectRoot, {
  timestamp: new Date().toISOString(),
  userId,
  action: 'toggle',
  capabilityId: body.capabilityId,
  before,
  after: cap,
});
```

**Step 2: Run existing capability tests**

Run: `node --test packages/api/test/routes/capabilities*.test.ts`
Expected: all PASS

**Step 3: Commit**

```bash
git add packages/api/src/routes/capabilities.ts
git commit -m "feat(F146): add audit trail to existing PATCH toggle (AC-A4)"
```

---

## Task 8: Frontend — MCP add form in Hub (AC-A1)

**Files:**
- Create: `packages/web/src/components/McpInstallForm.tsx`
- Modify: `packages/web/src/components/HubCapabilityTab.tsx`
- Modify: `packages/web/src/components/capability-board-ui.tsx`

**Step 1: Create McpInstallForm component**

A modal/drawer form with fields:
- `id` (text, required)
- Transport selector (stdio / streamableHttp)
- `command` + `args` (for stdio)
- `url` (for streamableHttp)
- `env` key-value pairs (optional)
- `resolver` (optional, advanced)

Flow: fill form → click "Preview" → show preview card (entry + risks + affected configs) → click "Install" → POST to install API → show result + probe status.

**Step 2: Add "Add MCP" button to capability board header**

In `HubCapabilityTab.tsx`, add a button that opens the McpInstallForm.

**Step 3: Add delete action to MCP capability cards**

In `capability-board-ui.tsx`, add a delete icon/button to MCP cards (only for `source: 'external'`). Click → confirmation dialog → DELETE API.

**Step 4: Test in browser**

Start dev server: `pnpm dev`
1. Open Hub → 能力中心
2. Click "Add MCP" → fill form → Preview → Install → verify entry appears
3. Delete an MCP → verify it disappears / disables
4. Verify CLI configs regenerated (check `.mcp.json`)

**Step 5: Commit**

```bash
git add packages/web/src/components/McpInstallForm.tsx \
       packages/web/src/components/HubCapabilityTab.tsx \
       packages/web/src/components/capability-board-ui.tsx
git commit -m "feat(F146): add MCP install/delete UI in Hub capability center (AC-A1, AC-A2)"
```

---

## Task 9: Audit log viewer in Hub (AC-A4 UX)

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts` — add GET /api/capabilities/audit
- Modify: `packages/web/src/components/HubCapabilityTab.tsx` — add audit log section

**Step 1: Add audit read endpoint**

```typescript
app.get('/api/capabilities/audit', async (request) => {
  let projectRoot = getProjectRoot();
  const query = request.query as { projectPath?: string; limit?: string };
  if (query.projectPath) {
    const validated = await validateProjectPath(query.projectPath);
    if (validated) projectRoot = validated;
  }
  const limit = Math.min(Number(query.limit) || 50, 200);
  const entries = await readAuditLog(projectRoot, limit);
  return { entries };
});
```

**Step 2: Add audit log section to Hub UI**

Collapsible section at bottom of capability tab showing recent audit entries (time, user, action, capability ID, before/after diff summary).

**Step 3: Commit**

```bash
git add packages/api/src/routes/capabilities.ts \
       packages/web/src/components/HubCapabilityTab.tsx
git commit -m "feat(F146): add capability audit log viewer in Hub (AC-A4)"
```

---

## Task 10: Integration test — browser 3-backend validation (spec validation scenario)

**Files:**
- Create: `packages/api/test/routes/capabilities-install-integration.test.ts`

**Step 1: Write integration test**

Test the full flow: preview → install → verify config → delete → verify removed.

```typescript
describe('F146 validation scenario: browser 3-backend via API', () => {
  test('install agent-browser via API', async () => {
    const preview = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/preview',
      payload: { id: 'agent-browser', command: 'npx', args: ['agent-browser-mcp'] },
    });
    assert.equal(preview.statusCode, 200);
    const previewBody = JSON.parse(preview.payload);
    assert.equal(previewBody.entry.id, 'agent-browser');
    assert.equal(previewBody.risks.length, 0);

    const install = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: { 'x-cat-cafe-user': 'test-user' },
      payload: { id: 'agent-browser', command: 'npx', args: ['agent-browser-mcp'] },
    });
    assert.equal(install.statusCode, 200);
    assert.equal(JSON.parse(install.payload).ok, true);
  });

  test('install pinchtab via API', async () => {
    const install = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: { 'x-cat-cafe-user': 'test-user' },
      payload: {
        id: 'pinchtab',
        command: '/Users/lysander/.pinchtab/bin/pinchtab-darwin-arm64',
        args: ['mcp'],
      },
    });
    assert.equal(install.statusCode, 200);
  });

  test('install claude-in-chrome via API (resolver-backed)', async () => {
    const install = await app.inject({
      method: 'POST',
      url: '/api/capabilities/mcp/install',
      headers: { 'x-cat-cafe-user': 'test-user' },
      payload: { id: 'claude-in-chrome', resolver: 'chrome-extension' },
    });
    assert.equal(install.statusCode, 200);
  });

  test('hard-delete agent-browser', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/capabilities/mcp/agent-browser?hard=true',
      headers: { 'x-cat-cafe-user': 'test-user' },
    });
    assert.equal(del.statusCode, 200);
    assert.equal(JSON.parse(del.payload).mode, 'removed');
  });

  test('audit log records all operations', async () => {
    const audit = await app.inject({
      method: 'GET',
      url: '/api/capabilities/audit',
    });
    const entries = JSON.parse(audit.payload).entries;
    assert.ok(entries.length >= 4, 'Should have at least 4 audit entries');
  });
});
```

**Step 2: Run integration test**

Run: `node --test packages/api/test/routes/capabilities-install-integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/api/test/routes/capabilities-install-integration.test.ts
git commit -m "test(F146): add browser 3-backend validation scenario (AC-A1~A6)"
```

---

## Summary: AC Coverage

| AC | Task(s) | Verified by |
|----|---------|-------------|
| AC-A1 | T4, T5, T8 | Install API + Hub form |
| AC-A2 | T6, T8 | Delete API + Hub delete button |
| AC-A3 | T5 | generateCliConfigs + probeMcpCapability in install handler |
| AC-A4 | T3, T7, T9 | Audit module + PATCH audit + audit viewer |
| AC-A5 | T2 | withCapabilityLock serialization test |
| AC-A6 | T4, T8 | Preview API + preview UI flow |
