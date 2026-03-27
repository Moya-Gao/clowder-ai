# F139 Phase 4: Template Execution + Builtin Control

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** 三个 builtin 模板真实执行（reminder 投递消息、web-digest 路由抓取+摘要、repo-activity GitHub 追踪），所有任务支持面板 pause/resume，E2E 全链路走通
**Acceptance Criteria:**
- AC-H1: reminder 模板真实执行——到达 cron 时刻后向 deliveryThreadId 投递提醒消息，ledger 记录 RUN_DELIVERED
- AC-H2: web-digest 模板真实执行——通过 browser-automation 路由选择抓取方式（WebFetch 只是后端之一，X/小红书/B站等 JS 重站点需要真实浏览器），生成摘要后投递到 deliveryThreadId
- AC-H3: repo-activity 模板真实执行——查询 GitHub repo 新 issue/PR（cursor 追踪已见），投递到 deliveryThreadId
- AC-H4: Builtin 任务面板控制——所有任务（不限 dynamic）在 SchedulePanel 支持 pause/resume，后端复用 task override API
- AC-H5: 端到端验证——铲屎官在 thread 说"每天九点提醒我喝水"，任务注册、到点执行、消息投递、面板可控，全链路走通
**Architecture:** 扩展 ExecuteContext 注入 deliver + fetchContent 能力，模板 gate/execute 从 stub 变为真实实现。Builtin 任务通过 GlobalControlStore task override 实现面板控制（复用 Phase 3B 基建）。Web-digest 路由策略：server fetch 为默认，URL 模式匹配 JS 重站点时标记 needs-browser。
**Tech Stack:** Node fetch, cheerio (HTML text extraction), GitHub REST API, SQLite (cursor), WebSocket (live delivery)
**前端验证:** Yes — SchedulePanel pause/resume 需要 Chrome/Playwright 实测

---

## Terminal Schema

```typescript
// Extended ExecuteContext (types.ts)
export interface ExecuteContext {
  assignedCatId: string | null;
  context?: ContextSpec;
  /** Phase 4: deliver message to a thread */
  deliver?: (opts: DeliverOpts) => Promise<string>;
  /** Phase 4: fetch web content with browser-automation routing */
  fetchContent?: (url: string) => Promise<FetchResult>;
}

export interface DeliverOpts {
  threadId: string;
  content: string;
  catId: string;
  userId: string;
}

export interface FetchResult {
  text: string;
  title: string;
  url: string;
  method: 'server-fetch' | 'browser';
  truncated: boolean;
}
```

## What We're NOT Building

- LLM 摘要（Phase 4 用 HTML→text 提取 + 截断，LLM 摘要是后续增强）
- Event/hybrid trigger（属于 F139 但不在这个 worktree）
- 新的浏览器后端集成（routing 标记 needs-browser，实际 headless 集成是后续）
- 动态任务 CRUD 变更（Phase 3A 已完成，不动）

---

## Task 1: Delivery Infrastructure — ExecuteContext.deliver

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/delivery.ts`
- Modify: `packages/api/src/infrastructure/scheduler/types.ts`
- Modify: `packages/api/src/infrastructure/scheduler/execute-pipeline.ts`
- Test: `packages/api/test/scheduler-delivery.test.js`

**Step 1: Write failing test for createDeliverFn**

```javascript
// packages/api/test/scheduler-delivery.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createDeliverFn } from '../src/infrastructure/scheduler/delivery.js';

describe('createDeliverFn', () => {
  it('appends message to store and broadcasts via socket', async () => {
    const appendResult = { id: 'msg-1', threadId: 'th-1' };
    const messageStore = { append: mock.fn(() => appendResult) };
    const socketManager = { broadcastAgentMessage: mock.fn() };
    const deliver = createDeliverFn({ messageStore, socketManager });

    const msgId = await deliver({
      threadId: 'th-1',
      content: 'Hello reminder',
      catId: 'opus',
      userId: 'user-1',
    });

    assert.equal(msgId, 'msg-1');
    assert.equal(messageStore.append.mock.calls.length, 1);
    const appendArg = messageStore.append.mock.calls[0].arguments[0];
    assert.equal(appendArg.threadId, 'th-1');
    assert.equal(appendArg.content, 'Hello reminder');
    assert.equal(appendArg.catId, 'opus');
    assert.equal(socketManager.broadcastAgentMessage.mock.calls.length, 1);
  });
});
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "createDeliverFn"`
Expected: FAIL — module not found

**Step 2: Extend ExecuteContext types**

```typescript
// types.ts — add to ExecuteContext interface
export interface DeliverOpts {
  threadId: string;
  content: string;
  catId: string;
  userId: string;
}

export interface FetchResult {
  text: string;
  title: string;
  url: string;
  method: 'server-fetch' | 'browser';
  truncated: boolean;
}

export interface ExecuteContext {
  assignedCatId: string | null;
  context?: ContextSpec;
  deliver?: (opts: DeliverOpts) => Promise<string>;
  fetchContent?: (url: string) => Promise<FetchResult>;
}
```

**Step 3: Implement createDeliverFn**

```typescript
// packages/api/src/infrastructure/scheduler/delivery.ts
import type { DeliverOpts } from './types.js';

export interface DeliveryDeps {
  messageStore: {
    append: (msg: Record<string, unknown>) => { id: string } | Promise<{ id: string }>;
  };
  socketManager: {
    broadcastAgentMessage: (msg: Record<string, unknown>, threadId: string) => void;
  };
}

export function createDeliverFn(deps: DeliveryDeps) {
  return async (opts: DeliverOpts): Promise<string> => {
    const stored = await deps.messageStore.append({
      userId: opts.userId,
      catId: opts.catId,
      content: opts.content,
      mentions: [],
      origin: 'callback',
      timestamp: Date.now(),
      threadId: opts.threadId,
    });
    deps.socketManager.broadcastAgentMessage(
      {
        type: 'text',
        catId: opts.catId,
        content: opts.content,
        origin: 'callback',
        messageId: stored.id,
        timestamp: Date.now(),
      },
      opts.threadId,
    );
    return stored.id;
  };
}
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "createDeliverFn"`
Expected: PASS

**Step 4: Wire deliver into execute-pipeline**

Modify `PipelineContext` to accept optional `deliver`:
```typescript
// execute-pipeline.ts — add to PipelineContext
deliver?: (opts: DeliverOpts) => Promise<string>;
fetchContent?: (url: string) => Promise<FetchResult>;
```

In `executeTaskPipeline`, pass through to ExecuteContext:
```typescript
const rawExecute = task.run.execute(item.signal, item.subjectKey, {
  assignedCatId,
  context: task.context,
  deliver: ctx.deliver,       // NEW
  fetchContent: ctx.fetchContent, // NEW
});
```

**Step 5: Commit**

```
feat(F139-H1): delivery infrastructure — createDeliverFn + ExecuteContext.deliver
```

---

## Task 2: AC-H1 — Reminder Template Real Execution

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/templates/reminder.ts`
- Test: `packages/api/test/reminder-template.test.js`

**Step 1: Write failing test for reminder gate + execute**

```javascript
describe('reminderTemplate', () => {
  it('gate returns run:true with thread workItem', async () => {
    const spec = reminderTemplate.createSpec('rem-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { message: '喝水提醒' },
      deliveryThreadId: 'th-abc',
    });
    const result = await spec.admission.gate({ taskId: 'rem-1', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems[0].subjectKey, 'thread-th-abc');
  });

  it('execute calls deliver with message content', async () => {
    const deliverMock = mock.fn(async () => 'msg-1');
    const spec = reminderTemplate.createSpec('rem-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { message: '喝水提醒' },
      deliveryThreadId: 'th-abc',
    });
    await spec.run.execute('喝水提醒', 'thread-th-abc', {
      assignedCatId: 'opus',
      deliver: deliverMock,
    });
    assert.equal(deliverMock.mock.calls.length, 1);
    assert.equal(deliverMock.mock.calls[0].arguments[0].content, '喝水提醒');
    assert.equal(deliverMock.mock.calls[0].arguments[0].threadId, 'th-abc');
  });

  it('gate returns run:false when no deliveryThreadId', async () => {
    const spec = reminderTemplate.createSpec('rem-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { message: 'test' },
      deliveryThreadId: null,
    });
    const result = await spec.admission.gate({ taskId: 'rem-1', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });
});
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "reminderTemplate"`
Expected: FAIL — gate still returns `run: false`

**Step 2: Implement real reminder gate + execute**

```typescript
// reminder.ts — replace gate and execute
createSpec(instanceId: string, p: DynamicTaskParams): TaskSpec_P1 {
  const message = (p.params.message as string) || '定时提醒';
  const threadId = p.deliveryThreadId;
  return {
    id: instanceId,
    profile: 'awareness',
    trigger: p.trigger,
    admission: {
      async gate() {
        if (!threadId) return { run: false, reason: 'no deliveryThreadId' };
        return {
          run: true,
          workItems: [{ signal: message, subjectKey: `thread-${threadId}` }],
        };
      },
    },
    run: {
      overlap: 'skip',
      timeoutMs: 30_000,
      async execute(_signal, subjectKey, ctx) {
        if (!ctx.deliver) throw new Error('deliver not available');
        const tid = subjectKey.startsWith('thread-') ? subjectKey.slice(7) : subjectKey;
        await ctx.deliver({
          threadId: tid,
          content: message,
          catId: ctx.assignedCatId ?? 'system',
          userId: 'scheduler',
        });
      },
    },
    state: { runLedger: 'sqlite' },
    outcome: { whenNoSignal: 'drop' },
    enabled: () => true,
    display: {
      label: message.slice(0, 30),
      category: 'system',
      description: message,
      subjectKind: 'none',
    },
  };
},
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "reminderTemplate"`
Expected: PASS

**Step 3: Commit**

```
feat(F139-H1): reminder template real execution — gate + deliver to thread
```

---

## Task 3: Content Fetch Infrastructure — browser-automation routing

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/content-fetcher.ts`
- Test: `packages/api/test/content-fetcher.test.js`

**Step 1: Write failing test for fetchContent**

```javascript
describe('createFetchContentFn', () => {
  it('fetches HTML and extracts text', async () => {
    // Mock global fetch
    const result = await fetchContent('https://example.com');
    assert.equal(result.method, 'server-fetch');
    assert.ok(result.text.length > 0);
    assert.equal(result.url, 'https://example.com');
  });

  it('flags JS-heavy sites as needs-browser', () => {
    assert.equal(needsBrowser('https://x.com/user/status/123'), true);
    assert.equal(needsBrowser('https://www.xiaohongshu.com/explore'), true);
    assert.equal(needsBrowser('https://www.bilibili.com/video/BV123'), true);
    assert.equal(needsBrowser('https://example.com/article'), false);
  });
});
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "createFetchContentFn"`
Expected: FAIL

**Step 2: Implement content-fetcher with routing**

```typescript
// packages/api/src/infrastructure/scheduler/content-fetcher.ts
import type { FetchResult } from './types.js';

/** Known JS-heavy site patterns that need real browser */
const JS_HEAVY_PATTERNS = [
  /^https?:\/\/(www\.)?x\.com\//,
  /^https?:\/\/(www\.)?twitter\.com\//,
  /^https?:\/\/(www\.)?xiaohongshu\.com\//,
  /^https?:\/\/(www\.)?bilibili\.com\//,
  /^https?:\/\/(www\.)?douyin\.com\//,
  /^https?:\/\/(www\.)?instagram\.com\//,
  /^https?:\/\/(www\.)?threads\.net\//,
];

const MAX_TEXT_LENGTH = 2000;

export function needsBrowser(url: string): boolean {
  return JS_HEAVY_PATTERNS.some((p) => p.test(url));
}

/** Extract readable text from HTML (simple tag stripping) */
export function extractText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : '';
  // Strip script/style, then tags, collapse whitespace
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, text: cleaned };
}

export function createFetchContentFn(): (url: string) => Promise<FetchResult> {
  return async (url: string): Promise<FetchResult> => {
    if (needsBrowser(url)) {
      // Phase 4 MVP: flag JS-heavy sites, return placeholder
      // Full browser integration is a future enhancement
      return {
        text: `[needs-browser] This site (${url}) requires a real browser for content extraction. Server-side fetch cannot render JavaScript.`,
        title: url,
        url,
        method: 'browser' as const,
        truncated: false,
      };
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'CatCafe-WebDigest/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const { title, text } = extractText(html);
    const truncated = text.length > MAX_TEXT_LENGTH;

    return {
      text: truncated ? text.slice(0, MAX_TEXT_LENGTH) : text,
      title,
      url,
      method: 'server-fetch',
      truncated,
    };
  };
}
```

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern "content-fetcher"`
Expected: PASS

**Step 3: Commit**

```
feat(F139-H2): content-fetcher with browser-automation routing detection
```

---

## Task 4: AC-H2 — Web-Digest Template Real Execution

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/templates/web-digest.ts`
- Test: `packages/api/test/web-digest-template.test.js`

**Step 1: Write failing test**

```javascript
describe('webDigestTemplate', () => {
  it('gate returns run:true with thread workItem', async () => {
    const spec = webDigestTemplate.createSpec('wd-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { url: 'https://example.com', topic: 'AI' },
      deliveryThreadId: 'th-1',
    });
    const result = await spec.admission.gate({ taskId: 'wd-1', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
  });

  it('execute fetches content and delivers digest', async () => {
    const deliverMock = mock.fn(async () => 'msg-1');
    const fetchMock = mock.fn(async () => ({
      text: 'Article about AI advances',
      title: 'AI News',
      url: 'https://example.com',
      method: 'server-fetch',
      truncated: false,
    }));
    const spec = webDigestTemplate.createSpec('wd-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { url: 'https://example.com', topic: 'AI' },
      deliveryThreadId: 'th-1',
    });
    await spec.run.execute(null, 'thread-th-1', {
      assignedCatId: 'opus',
      deliver: deliverMock,
      fetchContent: fetchMock,
    });
    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(deliverMock.mock.calls.length, 1);
    const delivered = deliverMock.mock.calls[0].arguments[0];
    assert.ok(delivered.content.includes('AI News'));
  });

  it('gate returns run:false when no url param', async () => {
    const spec = webDigestTemplate.createSpec('wd-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: {},
      deliveryThreadId: 'th-1',
    });
    const result = await spec.admission.gate({ taskId: 'wd-1', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });
});
```

**Step 2: Implement web-digest gate + execute**

Gate: check url + deliveryThreadId → run:true.
Execute: call `ctx.fetchContent(url)` → format digest message (title + method + truncated text) → `ctx.deliver()`.

**Step 3: Commit**

```
feat(F139-H2): web-digest template — fetchContent routing + deliver digest
```

---

## Task 5: AC-H3 — Repo-Activity Template Real Execution

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/templates/repo-activity.ts`
- Test: `packages/api/test/repo-activity-template.test.js`

**Step 1: Write failing test**

```javascript
describe('repoActivityTemplate', () => {
  it('gate queries GitHub events and returns new items', async () => {
    // Gate uses ledger's last signal_summary as cursor
    const spec = repoActivityTemplate.createSpec('ra-1', {
      trigger: { type: 'interval', ms: 3600_000 },
      params: { repo: 'anthropics/claude-code' },
      deliveryThreadId: 'th-1',
    });
    const result = await spec.admission.gate({
      taskId: 'ra-1',
      lastRunAt: null,
      tickCount: 1,
    });
    // First run with no cursor: gate returns run:true (check for recent events)
    // Depends on GitHub API mock
  });

  it('execute formats activity summary and delivers', async () => {
    const deliverMock = mock.fn(async () => 'msg-1');
    const spec = repoActivityTemplate.createSpec('ra-1', {
      trigger: { type: 'interval', ms: 3600_000 },
      params: { repo: 'anthropics/claude-code' },
      deliveryThreadId: 'th-1',
    });
    const signal = {
      items: [
        { type: 'issue', number: 42, title: 'Bug fix', url: 'https://github.com/...' },
      ],
      cursor: '2026-03-27T00:00:00Z',
    };
    await spec.run.execute(signal, 'thread-th-1', {
      assignedCatId: 'opus',
      deliver: deliverMock,
    });
    assert.equal(deliverMock.mock.calls.length, 1);
    assert.ok(deliverMock.mock.calls[0].arguments[0].content.includes('#42'));
  });
});
```

**Step 2: Implement repo-activity gate + execute**

Gate approach:
- Use `gh api /repos/{owner}/{repo}/events?per_page=30` (or issues/pulls endpoints)
- The gate receives `gateCtx.lastRunAt` as temporal cursor
- Filter events newer than lastRunAt (or last 24h if first run)
- Return workItems with signal containing the new items list + updated cursor

Execute:
- Format signal items as a digest: "## {repo} 动态\n- Issue #42: Bug fix\n- PR #43: New feature"
- Deliver to thread via `ctx.deliver()`

Cursor strategy: `lastRunAt` from gate context (managed by TaskRunnerV2) is the natural cursor — no extra storage needed. Gate queries events since `lastRunAt`.

**Step 3: Commit**

```
feat(F139-H3): repo-activity template — GitHub API + cursor tracking
```

---

## Task 6: AC-H4 — Builtin Task Panel Control

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`
- Test: `packages/api/test/builtin-panel-control.test.js`

**Step 1: Write failing test for builtin task override toggle**

```javascript
describe('builtin task panel control', () => {
  it('PUT /api/schedule/control/tasks/:id toggles builtin task', async () => {
    // Hit governance route to set override for a builtin task
    const res = await fetch('/api/schedule/control/tasks/builtin-task-1', {
      method: 'PUT',
      body: JSON.stringify({ enabled: false, updatedBy: 'user' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.override.enabled, false);
  });
});
```

**Step 2: Update SchedulePanel — remove source === 'dynamic' guard**

Current code (lines 265, 309):
```tsx
{task.source === 'dynamic' && (
  <span className="...">user</span>
)}
// ...
{task.source === 'dynamic' && task.dynamicTaskId && (
  <div className="flex items-center gap-2">
    <button ... onClick={() => handleToggleEnabled(...)}>Pause/Resume</button>
    <button ... onClick={() => handleDeleteDynamic(...)}>Delete</button>
  </div>
)}
```

Change to:
- Show Pause/Resume for ALL tasks (both builtin and dynamic)
- Show Delete only for dynamic tasks (builtin can't be deleted)
- For builtin tasks: pause/resume calls `PUT /api/schedule/control/tasks/:id`
- For dynamic tasks: keep using `PATCH /api/schedule/tasks/:id`

```tsx
{/* Controls: pause/resume for all, delete for dynamic only */}
<div className="flex items-center gap-2">
  <button onClick={() => handleToggleTask(task)}>
    {(task.effectiveEnabled ?? task.enabled) ? '⏸ Pause' : '▶ Resume'}
  </button>
  {task.source === 'dynamic' && task.dynamicTaskId && (
    <button onClick={() => handleDeleteDynamic(task.dynamicTaskId!)}>Delete</button>
  )}
</div>
```

New handler:
```typescript
const handleToggleTask = useCallback(async (task: ScheduleTask) => {
  const nextEnabled = !(task.effectiveEnabled ?? task.enabled);
  if (task.source === 'dynamic' && task.dynamicTaskId) {
    // Dynamic: use existing PATCH endpoint
    await apiFetch(`/api/schedule/tasks/${encodeURIComponent(task.dynamicTaskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
  } else {
    // Builtin: use governance task override API
    await apiFetch(`/api/schedule/control/tasks/${encodeURIComponent(task.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled, updatedBy: 'user' }),
    });
  }
  fetchTasks();
  fetchControl();
}, [fetchTasks, fetchControl]);
```

**Step 3: Commit**

```
feat(F139-H4): builtin task panel control — pause/resume for all tasks
```

---

## Task 7: Wire Delivery into TaskRunnerV2 + App Startup

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Extend TaskRunnerV2Options with delivery deps**

```typescript
export interface TaskRunnerV2Options {
  // ... existing
  deliver?: (opts: DeliverOpts) => Promise<string>;
  fetchContent?: (url: string) => Promise<FetchResult>;
}
```

Pass through in `executePipeline`:
```typescript
private async executePipeline(task: AnyTaskSpec, isManualTrigger?: boolean): Promise<void> {
  await executeTaskPipeline({
    // ... existing
    deliver: this.deliver,
    fetchContent: this.fetchContent,
  });
}
```

**Step 2: Wire in index.ts startup**

At app startup where TaskRunnerV2 is created, inject:
```typescript
import { createDeliverFn } from './infrastructure/scheduler/delivery.js';
import { createFetchContentFn } from './infrastructure/scheduler/content-fetcher.js';

const deliver = createDeliverFn({ messageStore, socketManager });
const fetchContent = createFetchContentFn();

const taskRunner = new TaskRunnerV2({
  // ... existing
  deliver,
  fetchContent,
});
```

**Step 3: Commit**

```
feat(F139-H1/H2/H3): wire delivery + fetchContent into TaskRunnerV2 startup
```

---

## Task 8: AC-H5 — End-to-End Integration Test

**Files:**
- Test: `packages/api/test/scheduler-e2e.test.js`

**Step 1: Write E2E test**

Test the full chain:
1. Register a reminder task via POST /api/schedule/tasks (conversational registration)
2. Verify task appears in GET /api/schedule/tasks
3. Trigger manually via POST /api/schedule/tasks/:id/trigger
4. Verify ledger records RUN_DELIVERED
5. Verify pause/resume works for the task
6. Verify builtin task pause/resume via override API

```javascript
describe('F139 Phase 4 E2E', () => {
  it('reminder: register → trigger → deliver → pause → resume', async () => {
    // 1. Register reminder task
    // 2. GET /api/schedule/tasks → task visible
    // 3. POST /api/schedule/tasks/:id/trigger → manual trigger
    // 4. Verify ledger: RUN_DELIVERED
    // 5. Pause via PATCH → effectiveEnabled false
    // 6. Resume → effectiveEnabled true
  });
});
```

**Step 2: Run full test suite**

Run: `pnpm --filter @cat-cafe/api test`
Expected: All pass

**Step 3: Commit**

```
test(F139-H5): end-to-end scheduler test — register → trigger → deliver → control
```

---

## Execution Order Summary

| # | Task | AC | Key Change |
|---|------|----|------------|
| 1 | Delivery infrastructure | H1 pre | `createDeliverFn` + `ExecuteContext.deliver` |
| 2 | Reminder template | H1 | Gate returns run:true, execute calls deliver |
| 3 | Content fetcher | H2 pre | `needsBrowser()` routing + `extractText()` |
| 4 | Web-digest template | H2 | Fetch + format digest + deliver |
| 5 | Repo-activity template | H3 | GitHub API + lastRunAt cursor + deliver |
| 6 | Builtin panel control | H4 | SchedulePanel pause/resume for all tasks |
| 7 | Wire into TaskRunnerV2 | H1-H3 | DI at startup — messageStore + socketManager |
| 8 | E2E test | H5 | Full chain validation |
