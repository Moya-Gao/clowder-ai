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
  notRoutable: Array<{ catId: string; displayName: string }>;
  routingPolicy: string | null;
}
```

---

## Task 1: A0 — 幽灵命令清理 + 一致性测试 (AC-A4)

**Files:**
- Modify: `packages/web/src/config/command-registry.ts:69-71`
- Modify: `packages/web/src/config/__tests__/registries.test.ts`

### Step 1: 确认幽灵命令

读 `command-registry.ts` 和 `useChatCommands.ts`，确认 `/game status` 和 `/game end` 确实无 handler。

### Step 2: 写一致性测试（Red）

```typescript
// registries.test.ts — 新增测试
test('every registered command has a matching handler or is marked stub', () => {
  // 从 COMMANDS 提取所有命令名
  // 从 useChatCommands 或 ConnectorCommandLayer 中提取已实现的命令
  // 断言：注册表中每个命令都有对应 handler
});
```

Run: `pnpm --filter @cat-cafe/web test -- --grep "consistency"`
Expected: FAIL（`/game status` 和 `/game end` 没有 handler）

### Step 3: 从 registry 删除幽灵命令（Green）

从 `COMMANDS[]` 中删除 `/game status` 和 `/game end`（它们在 Web 和 Connector 均无 handler）。

### Step 4: 跑测试确认通过

Run: `pnpm --filter @cat-cafe/web test -- --grep "consistency"`
Expected: PASS

### Step 5: Commit

```
fix(F142): remove ghost commands /game status & /game end from registry [宪宪/Opus-46🐾]
```

---

## Task 2: ConnectorCommandLayer 测试基础设施 (AC-A8 前置)

**Files:**
- Create: `packages/api/test/infrastructure/connectors/ConnectorCommandLayer.test.ts`

### Step 1: 写现有命令的基线回归测试

测试现有 9 个命令（`/where`, `/new`, `/threads`, `/use`, `/thread`, `/unbind`, `/allow-group`, `/deny-group`, + not-command passthrough）的 happy path，建立回归基线。

```typescript
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectorCommandLayer } from '../../../src/infrastructure/connectors/ConnectorCommandLayer.js';

describe('ConnectorCommandLayer', () => {
  let layer: ConnectorCommandLayer;
  let mockBindingStore, mockThreadStore;

  beforeEach(() => {
    mockBindingStore = { /* mock methods */ };
    mockThreadStore = { /* mock methods */ };
    layer = new ConnectorCommandLayer({
      bindingStore: mockBindingStore,
      threadStore: mockThreadStore,
      frontendBaseUrl: 'http://localhost:3001',
    });
  });

  it('/where with no binding returns guidance', async () => {
    mockBindingStore.getByExternal = mock.fn(async () => null);
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response);
  });

  it('/new creates thread and binds', async () => {
    mockThreadStore.create = mock.fn(async () => ({ id: 't-new' }));
    mockBindingStore.bind = mock.fn(async () => {});
    const result = await layer.handle('feishu', 'chat1', 'user1', '/new Test');
    assert.equal(result.kind, 'new');
  });

  it('non-command returns not-command', async () => {
    const result = await layer.handle('feishu', 'chat1', 'user1', 'hello');
    assert.equal(result.kind, 'not-command');
  });

  // ... /threads, /use, /unbind 等
});
```

### Step 2: 跑测试确认全部通过

Run: `pnpm --filter @cat-cafe/api test -- --grep "ConnectorCommandLayer"`
Expected: PASS（全部基线测试通过）

### Step 3: Commit

```
test(F142): add ConnectorCommandLayer baseline regression tests [宪宪/Opus-46🐾]
```

---

## Task 3: `/commands` 命令 (AC-A1)

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Modify: `packages/api/test/infrastructure/connectors/ConnectorCommandLayer.test.ts`

### Step 1: 写 `/commands` 失败测试（Red）

```typescript
it('/commands returns list of available connector commands', async () => {
  const result = await layer.handle('feishu', 'chat1', 'user1', '/commands');
  assert.equal(result.kind, 'commands');
  assert.ok(result.response);
  assert.ok(result.response.includes('/commands'));
  assert.ok(result.response.includes('/cats'));
  assert.ok(result.response.includes('/where'));
});
```

Run: `pnpm --filter @cat-cafe/api test -- --grep "/commands"`
Expected: FAIL

### Step 2: 实现 `/commands` handler（Green）

```typescript
// CommandResult kind 联合类型加 'commands'
// 新增 handler:
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

// dispatch 加 case:
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
- Create: `packages/api/test/routes/thread-cats.test.ts`
- Modify: `packages/api/src/routes/index.ts` (注册路由)

### Step 1: 写 API 测试（Red）

```typescript
describe('GET /api/threads/:id/cats', () => {
  it('returns structured cat data for thread', async () => {
    // Setup: thread with participants, some cats available, some not
    const response = await app.inject({
      method: 'GET',
      url: '/api/threads/t-test/cats',
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
    });
    assert.equal(response.statusCode, 404);
  });

  it('returns 403 for unauthorized user', async () => {
    // Setup: thread owned by different user
    // Request without matching connector binding
    const response = await app.inject({
      method: 'GET',
      url: '/api/threads/t-other/cats',
      headers: { 'x-connector-binding-owner': 'wrong-user' },
    });
    assert.equal(response.statusCode, 403);
  });
});
```

### Step 2: 实现路由（Green）

```typescript
// thread-cats.ts
export function threadCatsRoutes(
  app: FastifyInstance,
  opts: {
    threadStore: IThreadStore;
    agentRegistry: AgentRegistry;
  },
) {
  const { threadStore, agentRegistry } = opts;

  app.get('/api/threads/:id/cats', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 1. Thread exists?
    const thread = await threadStore.get(id);
    if (!thread) return reply.status(404).send({ error: 'Thread not found' });

    // 2. Auth check (connector binding owner)
    // ... (check request context against thread ownership)

    // 3. Gather data
    const participantActivity = await threadStore.getParticipantsWithActivity(id);
    const registeredServices = agentRegistry.getAllEntries();
    const roster = getRoster();
    const allCatIds = Object.keys(roster);

    const participantIds = new Set(participantActivity.map(p => p.catId));

    // 4. Categorize
    const routableNow: CatSummary[] = [];
    const routableNotJoined: CatSummary[] = [];
    const notRoutable: CatSummary[] = [];

    for (const catId of allCatIds) {
      const hasService = registeredServices.has(catId);
      const available = isCatAvailable(catId);
      const isParticipant = participantIds.has(catId as CatId);

      if (hasService && available) {
        if (!isParticipant) routableNotJoined.push(toCatSummary(catId));
        // participants handled separately with activity data
      } else {
        if (!isParticipant) notRoutable.push(toCatSummary(catId));
      }
    }

    // routableNow = participants that are also routable
    const routableNowList = participantActivity
      .filter(p => registeredServices.has(p.catId) && isCatAvailable(p.catId))
      .map(p => toCatSummary(p.catId));

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

```typescript
it('snapshot: cat categorization matches AgentRouter logic', async () => {
  // Setup: 4 cats — 1 participant+routable, 1 participant+not-routable,
  //        1 not-participant+routable, 1 not-participant+not-routable
  const response = await app.inject({ method: 'GET', url: '/api/threads/t-snap/cats' });
  const body = JSON.parse(response.body);

  // Snapshot assertions
  assert.equal(body.participants.length, 2);
  assert.equal(body.routableNow.length, 1);      // participant + has service + available
  assert.equal(body.routableNotJoined.length, 1); // not participant + has service + available
  assert.equal(body.notRoutable.length, 1);       // not participant + !available or !service
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
- Modify: `packages/api/test/infrastructure/connectors/ConnectorCommandLayer.test.ts`

### Step 1: 写 `/cats` 失败测试（Red）

```typescript
it('/cats returns formatted cat list for bound thread', async () => {
  // Setup: binding exists, thread has participants
  mockBindingStore.getByExternal = mock.fn(async () => ({
    threadId: 't-bound', connectorId: 'feishu', externalChatId: 'chat1',
  }));
  const result = await layer.handle('feishu', 'chat1', 'user1', '/cats');
  assert.equal(result.kind, 'cats');
  assert.ok(result.response);
  assert.ok(result.response.includes('参与猫'));
});

it('/cats with no binding returns guidance', async () => {
  mockBindingStore.getByExternal = mock.fn(async () => null);
  const result = await layer.handle('feishu', 'chat1', 'user1', '/cats');
  assert.equal(result.kind, 'cats');
  assert.ok(result.response?.includes('没有绑定'));
});
```

### Step 2: 扩展 ConnectorCommandLayerDeps

```typescript
// 新增依赖
export interface ConnectorCommandLayerDeps {
  // ... existing ...
  readonly agentRegistry?: {
    getAllEntries(): Map<string, unknown>;
    has(catId: string): boolean;
  };
}
```

### Step 3: 实现 `/cats` handler（Green）

```typescript
private async handleCats(
  connectorId: string,
  externalChatId: string,
  userId: string,
): Promise<CommandResult> {
  const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
  if (!binding) {
    return {
      kind: 'cats',
      response: '⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。',
    };
  }

  const threadId = binding.threadId;
  const participantActivity = await this.deps.threadStore.getParticipantsWithActivity?.(threadId) ?? [];
  const roster = getRoster();
  const allCatIds = Object.keys(roster);

  const participantIds = new Set(participantActivity.map(p => p.catId));
  const lines: string[] = [];

  // Participants
  if (participantActivity.length > 0) {
    lines.push('🐾 参与猫：');
    for (const p of participantActivity) {
      const available = isCatAvailable(p.catId);
      const hasService = this.deps.agentRegistry?.has(p.catId) ?? false;
      const tag = available && hasService ? '✅' : '⚠️';
      lines.push(`  ${tag} ${getDisplayName(p.catId)}（${p.messageCount} 条消息）`);
    }
  }

  // Routable but not joined
  const routableNotJoined = allCatIds.filter(id =>
    !participantIds.has(id as CatId)
    && isCatAvailable(id)
    && (this.deps.agentRegistry?.has(id) ?? false)
  );
  if (routableNotJoined.length > 0) {
    lines.push('\n📡 可调度（未加入）：');
    for (const id of routableNotJoined) {
      lines.push(`  ${getDisplayName(id)}`);
    }
  }

  // Not routable
  const notRoutable = allCatIds.filter(id =>
    !participantIds.has(id as CatId)
    && (!isCatAvailable(id) || !(this.deps.agentRegistry?.has(id) ?? false))
  );
  if (notRoutable.length > 0) {
    lines.push('\n💤 不可调度：');
    for (const id of notRoutable) {
      lines.push(`  ${getDisplayName(id)}`);
    }
  }

  return {
    kind: 'cats',
    response: lines.join('\n') || '没有找到猫猫。',
    contextThreadId: threadId,
  };
}
```

### Step 4: 跑测试

Run: `pnpm --filter @cat-cafe/api test -- --grep "/cats"`
Expected: PASS

### Step 5: Commit

```
feat(F142): add /cats connector command [宪宪/Opus-46🐾]
```

---

## Task 6: `/status` 连接器命令 (AC-A3)

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- Modify: `packages/api/test/infrastructure/connectors/ConnectorCommandLayer.test.ts`

### Step 1: 写 `/status` 失败测试（Red）

```typescript
it('/status returns thread overview', async () => {
  mockBindingStore.getByExternal = mock.fn(async () => ({
    threadId: 't-bound', connectorId: 'feishu', externalChatId: 'chat1',
  }));
  mockThreadStore.get = mock.fn(async () => ({
    id: 't-bound',
    title: 'F142 开发',
    createdAt: Date.now() - 86400000,
    participants: ['opus', 'codex'],
    lastActiveAt: Date.now(),
  }));
  const result = await layer.handle('feishu', 'chat1', 'user1', '/status');
  assert.equal(result.kind, 'status');
  assert.ok(result.response?.includes('F142 开发'));
  assert.ok(result.response?.includes('2'));  // participant count
});

it('/status with no binding returns guidance', async () => {
  mockBindingStore.getByExternal = mock.fn(async () => null);
  const result = await layer.handle('feishu', 'chat1', 'user1', '/status');
  assert.equal(result.kind, 'status');
  assert.ok(result.response?.includes('没有绑定'));
});
```

### Step 2: 实现 `/status` handler（Green）

```typescript
private async handleStatus(
  connectorId: string,
  externalChatId: string,
  userId: string,
): Promise<CommandResult> {
  const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
  if (!binding) {
    return {
      kind: 'status',
      response: '⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。',
    };
  }

  const thread = await this.deps.threadStore.get(binding.threadId);
  if (!thread) {
    return { kind: 'status', response: '⚠️ 绑定的 thread 已不存在。' };
  }

  const title = thread.title || '(无标题)';
  const created = new Date(thread.createdAt ?? 0).toLocaleDateString('zh-CN');
  const participantCount = thread.participants?.length ?? 0;
  const lastActive = thread.lastActiveAt
    ? timeAgo(thread.lastActiveAt)
    : '未知';
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

### Step 2: 跑 Web 端 registry 测试

Run: `pnpm --filter @cat-cafe/web test -- --grep "registries"`
Expected: PASS（含 Task 1 一致性测试）

### Step 3: 跑 gate 检查

Run: `pnpm check && pnpm lint`
Expected: PASS

### Step 4: Final commit（如有小修）

```
test(F142): Phase A regression suite green [宪宪/Opus-46🐾]
```

---

## Task 依赖图

```
Task 1 (A0 清理) ─────────────────────────────┐
Task 2 (基线测试) ─────┬── Task 3 (/commands) ─┤
                       ├── Task 5 (/cats cmd)  ─┤── Task 7 (回归)
Task 4 (API endpoint) ─┘── Task 6 (/status)   ─┘
```

- Task 1 和 Task 2 可并行（不同 package）
- Task 3 最简单先做，验证 CommandLayer 扩展模式
- Task 4 (API) 和 Task 5 (/cats cmd) 有依赖：API 先行
- Task 6 (/status) 独立，可在 Task 3 之后任意位置
- Task 7 全部完成后做

## 实施顺序

`Task 1` → `Task 2` → `Task 3` → `Task 4` → `Task 5` → `Task 6` → `Task 7`

预计 7 个 commit，每个 commit 都是可测试的增量。
