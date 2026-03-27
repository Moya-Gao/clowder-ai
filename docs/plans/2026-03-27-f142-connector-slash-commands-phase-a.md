# F142 Phase A — Connector Slash Commands Implementation Plan

**Feature:** F142 — `docs/features/F142-connector-slash-commands.md`
**Goal:** 为 connector 端（飞书/微信/Telegram）提供 `/commands`、`/cats`、`/status` 核心命令，并清理注册表漂移
**Acceptance Criteria:**
- AC-A1: `/commands` 返回 connector 可用命令列表
- AC-A2: `/cats` 返回 participants + routableNow + routableNotJoined + notRoutable
- AC-A3: `/status` 返回 thread 标题、创建时间、参与猫数、最近活跃
- AC-A4: 清理幽灵命令 + 注册表-执行器一致性测试
- AC-A5: `GET /api/threads/:id/cats` 聚合 API
- AC-A6: API 有 connector binding owner 权限校验
- AC-A7: `/cats` 口径绑定 AgentRouter，有快照测试
- AC-A8: 现有 connector 命令无回退
**Architecture:** 在 `ConnectorCommandLayer` 添加 3 个命令（扩展 `CommandResult` 联合类型 + handler + dispatch）；新增 `GET /api/threads/:id/cats` 聚合 API；数据源复用 `AgentRegistry.getAllEntries()` + `isCatAvailable()` + `ThreadStore.getParticipantsWithActivity()`
**Tech Stack:** TypeScript, Fastify, node:test, cat-config-loader, AgentRegistry
**前端验证:** No — 纯后端 + connector 端

---

## Straight-Line Check

**Finish line:** Connector 用户在飞书/Telegram 输入 `/commands`、`/cats`、`/status` 能得到准确、格式化的文字响应；幽灵命令已清理；新 API 有权限校验。

**NOT building:** Hub 端改动、`surface` 字段、Skill 声明式注册（Phase B）、MCP 命令注册。

## Terminal Schema

```typescript
// ConnectorCommandLayer — CommandResult 新增 kind
export interface CommandResult {
  readonly kind:
    | 'new' | 'threads' | 'use' | 'where' | 'thread'
    | 'unbind' | 'allow-group' | 'deny-group'
    | 'commands'      // ← NEW
    | 'cats'          // ← NEW
    | 'status'        // ← NEW
    | 'not-command';
  readonly response?: string;
  readonly newActiveThreadId?: string;
  readonly contextThreadId?: string;
  readonly forwardContent?: string;
}

// ConnectorCommandLayerDeps — 新增可选依赖
export interface ConnectorCommandLayerDeps {
  // ... existing (bindingStore, threadStore, backlogStore, frontendBaseUrl, permissionStore) ...
  readonly agentRegistry?: {
    getAllEntries(): Map<string, unknown>;
    has(catId: string): boolean;
  };
  readonly participantStore?: {
    getParticipantsWithActivity(threadId: string):
      | ThreadParticipantActivity[] | Promise<ThreadParticipantActivity[]>;
  };
}

// GET /api/threads/:id/cats — Response
interface ThreadCatsResponse {
  participants: Array<{
    catId: string;
    displayName: string;
    lastMessageAt: number;
    messageCount: number;
  }>;
  routableNow: Array<{ catId: string; displayName: string }>;
  routableNotJoined: Array<{ catId: string; displayName: string }>;
  notRoutable: Array<{ catId: string; displayName: string }>;  // strictly available=false (KD-9)
  routingPolicy: string | null;
}
```

---

## Task 1: A0 — 幽灵命令清理 + Connector 一致性测试 (AC-A4)

**Files:**
- Modify: `packages/web/src/config/command-registry.ts:69-71`
- Modify: `packages/api/test/connector-command-layer.test.js` (新增一致性测试)

### Step 1: 确认幽灵命令

读 `command-registry.ts` 和 `useChatCommands.ts`，确认 `/game status` 和 `/game end` 确实无 handler。

### Step 2: 写 connector 侧一致性测试（Red）

> **P1-3 fix**: 一致性测试限定 connector scope，不跨 surface 对齐 Web registry。

```javascript
// packages/api/test/connector-command-layer.test.js — 新增
describe('registry-executor consistency (connector scope)', () => {
  it('every connector command dispatched in handle() is reachable', async () => {
    // 枚举 ConnectorCommandLayer.handle() 的 switch cases
    // 断言每个 case 都有对应 handler 方法且不会 fallthrough 到 not-command
    const connectorCommands = [
      '/where', '/new', '/threads', '/use', '/thread',
      '/unbind', '/allow-group', '/deny-group',
    ];
    for (const cmd of connectorCommands) {
      // 最小 mock，只验 kind !== 'not-command'
      const result = await layer.handle('test', 'chat1', 'user1', cmd);
      assert.notEqual(result.kind, 'not-command', `${cmd} should be handled`);
    }
  });
});
```

Run: `pnpm --filter @cat-cafe/api test -- --grep "consistency"`
Expected: PASS（现有命令都有 handler）

### Step 3: 从 Web registry 删除幽灵命令

从 `COMMANDS[]` 中删除 `/game status` 和 `/game end`（它们在 Web 和 Connector 均无 handler，仅做减法）。

### Step 4: 跑测试确认通过

Run: `pnpm --filter @cat-cafe/web test -- --grep "registries"` 和 `pnpm --filter @cat-cafe/api test -- --grep "consistency"`
Expected: PASS

### Step 5: Commit

```
fix(F142): remove ghost commands /game status & /game end from registry [宪宪/Opus-46🐾]
```

---

## Task 2: ConnectorCommandLayer 基线回归测试 (AC-A8 前置)

**Files:**
- Modify: `packages/api/test/connector-command-layer.test.js`

> **P1-1 fix**: 沿用现有 `test/connector-command-layer.test.js`（JS，node:test），不新建 TS 文件。API 测试跑 `pnpm run build && node --test test/*.test.js test/**/*.test.js`。

### Step 1: 在现有测试文件中补齐基线 happy path

测试现有命令的核心行为，复用文件中已有的 `stubThreadStore()` / `stubBindingStore()` helper。

```javascript
// packages/api/test/connector-command-layer.test.js — 新增 describe
describe('baseline regression (F142)', () => {
  it('/where with no binding returns guidance', async () => {
    // 使用现有 stubBindingStore（getByExternal 返回 null）
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response);
  });

  it('/new creates thread and binds', async () => {
    const result = await layer.handle('feishu', 'chat1', 'user1', '/new Test');
    assert.equal(result.kind, 'new');
    assert.ok(result.newActiveThreadId);
  });

  it('non-command returns not-command', async () => {
    const result = await layer.handle('feishu', 'chat1', 'user1', 'hello world');
    assert.equal(result.kind, 'not-command');
  });

  // /threads, /use, /unbind 等 happy path
});
```

### Step 2: 跑测试确认全部通过

Run: `pnpm --filter @cat-cafe/api test -- --grep "baseline regression"`
Expected: PASS

### Step 3: Commit

```
test(F142): add ConnectorCommandLayer baseline regression tests [宪宪/Opus-46🐾]
```

---

## Task 3: `/commands` 命令 (AC-A1)

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Modify: `packages/api/test/connector-command-layer.test.js`

### Step 1: 写 `/commands` 失败测试（Red）

```javascript
describe('/commands (F142)', () => {
  it('returns list of available connector commands', async () => {
    const result = await layer.handle('feishu', 'chat1', 'user1', '/commands');
    assert.equal(result.kind, 'commands');
    assert.ok(result.response);
    assert.ok(result.response.includes('/commands'));
    assert.ok(result.response.includes('/cats'));
    assert.ok(result.response.includes('/where'));
  });
});
```

Run: `pnpm --filter @cat-cafe/api test -- --grep "/commands"`
Expected: FAIL

### Step 2: 实现 `/commands` handler（Green）

```typescript
// 1. CommandResult kind 联合类型加 'commands'
// 2. 新增 handler:
private handleCommands(): CommandResult {
  const commands = [
    { cmd: '/commands', desc: '列出所有可用命令' },
    { cmd: '/cats', desc: '查看当前 thread 的猫猫' },
    { cmd: '/status', desc: '查看当前 thread 状态' },
    { cmd: '/where', desc: '查看当前绑定的 thread' },
    { cmd: '/new [标题]', desc: '创建新 thread 并切换' },
    { cmd: '/threads', desc: '列出最近的 threads' },
    { cmd: '/use <F号|序号|关键词>', desc: '切换到指定 thread' },
    { cmd: '/thread <id> <消息>', desc: '切换并发送消息' },
    { cmd: '/unbind', desc: '解除当前绑定' },
  ];
  const lines = commands.map(c => `  ${c.cmd} — ${c.desc}`);
  return {
    kind: 'commands',
    response: `📋 可用命令：\n\n${lines.join('\n')}`,
  };
}
// 3. dispatch switch 加 case:
case '/commands': return this.handleCommands();
```

### Step 3: 跑测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "/commands"`
Expected: PASS

### Step 4: Commit

```
feat(F142): add /commands connector command [宪宪/Opus-46🐾]
```

---

## Task 4: `GET /api/threads/:id/cats` 聚合 API (AC-A5, AC-A6, AC-A7)

**Files:**
- Create: `packages/api/src/routes/thread-cats.ts`
- Create: `packages/api/test/thread-cats.test.js`
- Modify: `packages/api/src/routes/index.ts` (注册路由)

> **P1-1 fix**: 测试文件 `test/thread-cats.test.js`（JS），遵循现有 API 测试约定。
> **P1-2 fix**: 权限走 `X-Cat-Cafe-User` header（通过 `resolveUserId()`），+ `bindingStore.getByThread(threadId)` 比对 binding owner。
> **P2 fix**: `notRoutable` 严格遵循 KD-9，仅包含 `available=false` 的猫。

### Step 1: 写 API 测试（Red）

```javascript
// packages/api/test/thread-cats.test.js
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('GET /api/threads/:id/cats', () => {
  it('returns structured cat data for thread', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/threads/t-test/cats',
      headers: { 'x-cat-cafe-user': 'owner-user' },
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.participants));
    assert.ok(Array.isArray(body.routableNow));
    assert.ok(Array.isArray(body.routableNotJoined));
    assert.ok(Array.isArray(body.notRoutable));
  });

  it('returns 404 for non-existent thread', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/threads/t-nonexistent/cats',
      headers: { 'x-cat-cafe-user': 'any-user' },
    });
    assert.equal(response.statusCode, 404);
  });

  it('returns 403 when user is not binding owner (AC-A6)', async () => {
    // Thread exists + has connector binding owned by 'owner-user'
    // Requesting user 'wrong-user' is not the binding owner
    const response = await app.inject({
      method: 'GET',
      url: '/api/threads/t-other/cats',
      headers: { 'x-cat-cafe-user': 'wrong-user' },
      // Note: no query userId — resolveHeaderUserId is header-only
    });
    assert.equal(response.statusCode, 403);
  });
});
```

### Step 2: 实现路由（Green）

```typescript
// packages/api/src/routes/thread-cats.ts
import type { FastifyInstance } from 'fastify';
import type { IThreadStore, ThreadParticipantActivity } from '...';
import type { AgentRegistry } from '...';
import type { IConnectorThreadBindingStore } from '...';
import { resolveHeaderUserId } from '../utils/request-identity.js';
import { getRoster, isCatAvailable, getDisplayName } from '../config/cat-config-loader.js';

export function threadCatsRoutes(
  app: FastifyInstance,
  opts: {
    threadStore: IThreadStore;
    agentRegistry: AgentRegistry;
    bindingStore: IConnectorThreadBindingStore;
    defaultUserId: string;
  },
) {
  const { threadStore, agentRegistry, bindingStore, defaultUserId } = opts;

  app.get('/api/threads/:id/cats', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 1. Thread exists?
    const thread = await threadStore.get(id);
    if (!thread) return reply.status(404).send({ error: 'Thread not found' });

    // 2. Auth: connector binding owner check
    // P1 fix v3: resolveHeaderUserId (header-only, no query param) + getByThread returns array
    const requestUserId = resolveHeaderUserId(request) ?? defaultUserId;
    const bindings = await bindingStore.getByThread(id);
    // If thread has connector bindings, verify requester is one of the binding owners
    if (bindings.length > 0) {
      const isBindingOwner = bindings.some(b => b.userId === requestUserId);
      if (!isBindingOwner) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }
    // Hub-only threads (no bindings) allow defaultUserId access

    // 3. Gather data
    const participantActivity = await threadStore.getParticipantsWithActivity(id);
    const registeredServices = agentRegistry.getAllEntries();
    const roster = getRoster();
    const allCatIds = Object.keys(roster);
    const participantIds = new Set(participantActivity.map(p => p.catId));

    // 4. Categorize (KD-9: notRoutable = strictly available=false)
    const routableNow = [];
    const routableNotJoined = [];
    const notRoutable = [];

    for (const catId of allCatIds) {
      const hasService = registeredServices.has(catId);
      const available = isCatAvailable(catId);
      const isParticipant = participantIds.has(catId);

      if (!available) {
        // KD-9: notRoutable = available=false only
        if (!isParticipant) notRoutable.push({ catId, displayName: getDisplayName(catId) });
      } else if (hasService && !isParticipant) {
        routableNotJoined.push({ catId, displayName: getDisplayName(catId) });
      }
    }

    // routableNow = participants that have service + available
    const routableNowList = participantActivity
      .filter(p => registeredServices.has(p.catId) && isCatAvailable(p.catId))
      .map(p => ({ catId: p.catId, displayName: getDisplayName(p.catId) }));

    return {
      participants: participantActivity.map(p => ({
        catId: p.catId,
        displayName: getDisplayName(p.catId),
        lastMessageAt: p.lastMessageAt,
        messageCount: p.messageCount,
      })),
      routableNow: routableNowList,
      routableNotJoined,
      notRoutable,
      routingPolicy: thread.routingPolicy?.type ?? null,
    };
  });
}
```

### Step 3: 写快照测试 (AC-A7)

```javascript
it('snapshot: cat categorization matches AgentRouter logic', async () => {
  // Setup: 4 cats
  // - opus: participant + service + available → participants ✅ + routableNow ✅
  // - codex: participant + service + available=false → participants ✅ only
  //          (participants always listed regardless of availability;
  //           notRoutable excludes participants — they're already visible)
  // - gpt52: not participant + service + available → routableNotJoined ✅
  // - gemini: not participant + available=false → notRoutable ✅ (KD-9)
  const response = await app.inject({
    method: 'GET',
    url: '/api/threads/t-snap/cats',
    headers: { 'x-cat-cafe-user': 'owner-user' },
  });
  const body = JSON.parse(response.body);
  assert.equal(body.participants.length, 2);        // opus + codex
  assert.equal(body.routableNow.length, 1);          // opus (participant + routable)
  assert.equal(body.routableNotJoined.length, 1);    // gpt52 (not participant + routable)
  assert.equal(body.notRoutable.length, 1);           // gemini (not participant + available=false)
  // Note: codex is unavailable but already in participants, NOT double-counted in notRoutable
});
```

### Step 4: 跑测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "thread-cats"`
Expected: PASS

### Step 5: Commit

```
feat(F142): add GET /api/threads/:id/cats aggregation API [宪宪/Opus-46🐾]
```

---

## Task 5: `/cats` 连接器命令 (AC-A2)

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Modify: `packages/api/test/connector-command-layer.test.js`

### Step 1: 写 `/cats` 失败测试（Red）

```javascript
describe('/cats (F142)', () => {
  it('returns formatted cat list for bound thread', async () => {
    stubBindingStore.getByExternal = async () => ({
      threadId: 't-bound', connectorId: 'feishu', externalChatId: 'chat1',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/cats');
    assert.equal(result.kind, 'cats');
    assert.ok(result.response);
    assert.ok(result.response.includes('参与猫'));
  });

  it('with no binding returns guidance', async () => {
    stubBindingStore.getByExternal = async () => null;
    const result = await layer.handle('feishu', 'chat1', 'user1', '/cats');
    assert.equal(result.kind, 'cats');
    assert.ok(result.response?.includes('没有绑定'));
  });
});
```

### Step 2: 扩展 ConnectorCommandLayerDeps + 实现 handler

```typescript
// Deps 新增 participantStore（可选，向后兼容）
readonly participantStore?: {
  getParticipantsWithActivity(threadId: string):
    ThreadParticipantActivity[] | Promise<ThreadParticipantActivity[]>;
};
readonly agentRegistry?: {
  has(catId: string): boolean;
};
```

> **P1-4 fix**: 不依赖 `threadStore.get()` 的 `participants` 字段（类型没有），改用 `participantStore.getParticipantsWithActivity()` 获取参与者数据。
> **P2 fix**: `notRoutable` 严格 = `available=false`（KD-9），不含 `service_missing`。

```typescript
private async handleCats(connectorId: string, externalChatId: string): Promise<CommandResult> {
  const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
  if (!binding) {
    return { kind: 'cats', response: '⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。' };
  }

  const participantActivity = await this.deps.participantStore
    ?.getParticipantsWithActivity(binding.threadId) ?? [];
  const roster = getRoster();
  const allCatIds = Object.keys(roster);
  const participantIds = new Set(participantActivity.map(p => p.catId));
  const lines: string[] = [];

  // Participants
  if (participantActivity.length > 0) {
    lines.push('🐾 参与猫：');
    for (const p of participantActivity) {
      const routable = isCatAvailable(p.catId) && (this.deps.agentRegistry?.has(p.catId) ?? false);
      lines.push(`  ${routable ? '✅' : '⚠️'} ${getDisplayName(p.catId)}（${p.messageCount} 条消息）`);
    }
  }

  // Routable not joined
  const routableNotJoined = allCatIds.filter(id =>
    !participantIds.has(id) && isCatAvailable(id) && (this.deps.agentRegistry?.has(id) ?? false));
  if (routableNotJoined.length > 0) {
    lines.push('\n📡 可调度（未加入）：');
    for (const id of routableNotJoined) lines.push(`  ${getDisplayName(id)}`);
  }

  // Not routable — KD-9: strictly available=false
  const notRoutable = allCatIds.filter(id => !participantIds.has(id) && !isCatAvailable(id));
  if (notRoutable.length > 0) {
    lines.push('\n💤 不可调度：');
    for (const id of notRoutable) lines.push(`  ${getDisplayName(id)}`);
  }

  return { kind: 'cats', response: lines.join('\n') || '没有找到猫猫。', contextThreadId: binding.threadId };
}
```

### Step 3: 跑测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "/cats"`
Expected: PASS

### Step 4: Commit

```
feat(F142): add /cats connector command [宪宪/Opus-46🐾]
```

---

## Task 6: `/status` 连接器命令 (AC-A3)

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Modify: `packages/api/test/connector-command-layer.test.js`

> **P1-4 fix**: `threadStore.get()` 返回 `{ id, title?, createdAt? }`——没有 `participants` 和 `lastActiveAt`。参与猫数通过 `participantStore.getParticipantsWithActivity()` 获取；最近活跃从 participant activity 的 `max(lastMessageAt)` 推导。

### Step 1: 写 `/status` 失败测试（Red）

```javascript
describe('/status (F142)', () => {
  it('returns thread overview', async () => {
    stubBindingStore.getByExternal = async () => ({
      threadId: 't-bound', connectorId: 'feishu', externalChatId: 'chat1',
    });
    stubThreadStore.get = async () => ({
      id: 't-bound', title: 'F142 开发', createdAt: Date.now() - 86400000,
    });
    // participantStore 返回 2 个参与者
    stubParticipantStore.getParticipantsWithActivity = async () => [
      { catId: 'opus', lastMessageAt: Date.now(), messageCount: 5, lastResponseHealthy: true },
      { catId: 'codex', lastMessageAt: Date.now() - 3600000, messageCount: 3, lastResponseHealthy: true },
    ];
    const result = await layer.handle('feishu', 'chat1', 'user1', '/status');
    assert.equal(result.kind, 'status');
    assert.ok(result.response?.includes('F142 开发'));
    assert.ok(result.response?.includes('2'));  // participant count
  });

  it('with no binding returns guidance', async () => {
    stubBindingStore.getByExternal = async () => null;
    const result = await layer.handle('feishu', 'chat1', 'user1', '/status');
    assert.equal(result.kind, 'status');
    assert.ok(result.response?.includes('没有绑定'));
  });
});
```

### Step 2: 实现 `/status` handler（Green）

```typescript
private async handleStatus(connectorId: string, externalChatId: string): Promise<CommandResult> {
  const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
  if (!binding) {
    return { kind: 'status', response: '⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。' };
  }

  const thread = await this.deps.threadStore.get(binding.threadId);
  if (!thread) {
    return { kind: 'status', response: '⚠️ 绑定的 thread 已不存在。' };
  }

  // P1-4 fix: get participant data from participantStore, not threadStore.get()
  const participants = await this.deps.participantStore
    ?.getParticipantsWithActivity(binding.threadId) ?? [];
  const participantCount = participants.length;
  const lastActive = participants.length > 0
    ? timeAgo(Math.max(...participants.map(p => p.lastMessageAt)))
    : '未知';

  const title = thread.title || '(无标题)';
  const created = new Date(thread.createdAt ?? 0).toLocaleDateString('zh-CN');
  const link = `${this.deps.frontendBaseUrl}/threads/${binding.threadId}`;

  return {
    kind: 'status',
    response: [
      `📊 Thread 状态`,
      `  标题：${title}`,
      `  创建：${created}`,
      `  参与猫：${participantCount} 只`,
      `  最近活跃：${lastActive}`,
      `  🔗 ${link}`,
    ].join('\n'),
    contextThreadId: binding.threadId,
  };
}
```

### Step 3: 跑测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "/status"`
Expected: PASS

### Step 4: Commit

```
feat(F142): add /status connector command [宪宪/Opus-46🐾]
```

---

## Task 7: 端到端回归 (AC-A8)

### Step 1: 跑完整 ConnectorCommandLayer 测试套件

Run: `pnpm --filter @cat-cafe/api test -- --grep "ConnectorCommandLayer"`
Expected: 全部 PASS（含 Task 2 基线 + Task 3-6 新增）

### Step 2: 跑 API 端 thread-cats 测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "thread-cats"`
Expected: PASS

### Step 3: 跑 Web 端 registry 测试

Run: `pnpm --filter @cat-cafe/web test -- --grep "registries"`
Expected: PASS

### Step 4: 跑 gate 检查

Run: `pnpm check && pnpm lint`
Expected: PASS

### Step 5: Final commit（如有小修）

```
test(F142): Phase A regression suite green [宪宪/Opus-46🐾]
```

---

## 砚砚 Review 修订记录

| P | 问题 | 修正 |
|---|------|------|
| P1-1 | 测试路径 `test/infrastructure/...test.ts` 不会被 API test runner 执行 | 改用现有 `test/connector-command-layer.test.js`（JS） |
| P1-2 | `x-connector-binding-owner` header 不存在 | 改用 `X-Cat-Cafe-User` + `resolveHeaderUserId()`（header-only）+ `bindingStore.getByThread()` |
| P1-3 | A0 一致性测试跨 surface 误报 | 限定 connector scope，只验证 ConnectorCommandLayer dispatch |
| P1-4 | `/status` 用 `thread.participants` / `thread.lastActiveAt` 但 deps 类型没有 | 新增 `participantStore` 依赖，从 `getParticipantsWithActivity()` 获取 |
| P2 | `notRoutable = !available \|\| !service` 偏离 KD-9 | 严格 `notRoutable = available=false`，`service_missing` 不纳入 |
| P1-5 (v3) | `getByThread` 返回数组但代码当单对象；判断条件是 `!== defaultUserId` 不是比 binding.userId | `bindings.some(b => b.userId === requestUserId)` 遍历数组比较 |
| P1-6 (v3) | `resolveUserId()` 接受 query param 不安全 | 改用 `resolveHeaderUserId()`（header-only） |
| P2-2 (v3) | 快照注释说 codex(participant+unavailable) 在 notRoutable，但实现排除 participants | 明确：participants 始终列出（不管 availability）；notRoutable 仅含非参与者 |

---

## Task 依赖图

```
Task 1 (A0 清理) ─────────────────────────────┐
Task 2 (基线测试) ─────┬── Task 3 (/commands) ─┤
                       ├── Task 5 (/cats cmd)  ─┤── Task 7 (回归)
Task 4 (API endpoint) ─┘── Task 6 (/status)   ─┘
```

## 实施顺序

`Task 1` → `Task 2` → `Task 3` → `Task 4` → `Task 5` → `Task 6` → `Task 7`

预计 7 个 commit，每个 commit 都是可测试的增量。
