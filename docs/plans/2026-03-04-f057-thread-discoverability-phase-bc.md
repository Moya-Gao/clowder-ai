# F057 Phase B+C: Badge 增强 + MCP list_threads 关键词搜索

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 跨线程 badge 显示 thread ID + 名称并可点击跳转；`list_threads` MCP 工具增加关键词搜索 + pinned 状态。

**Architecture:** Phase B 改前端 `ChatMessage.tsx` 的 cross-post badge 为可点击链接，从 store 查 thread 名称。Phase C 改后端 `callbacks.ts` 的 `list-threads` 端点，加 `keyword` 参数和 `pinned` 字段。

**Tech Stack:** React, TypeScript, Next.js (frontend), Fastify, Zod (backend), Vitest/node:test (tests)

---

## 前置知识

### 现状

| 组件 | 当前实现 | 要改的 |
|------|---------|--------|
| **跨线程 badge** | `ChatMessage.tsx:370-374` — 蓝色 pill `转发自 {id前8位}…`，静态不可点击 | 显示 `📮 {id前8位} · {threadName}`，可点击跳转 |
| **list-threads MCP** | `callbacks.ts:546-581` — 支持 `limit`+`activeSince`，返回 id/title/lastActiveAt/participants | 加 `keyword` 搜索 + `pinned` 字段 |

---

## Task 1: 跨线程 Badge 增强（Phase B2）

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx:370-374`
- No new test file needed (UI change, verified by build + visual)

**Step 1: 修改 badge 为可点击 + 显示名称**

在 `ChatMessage.tsx` 中，找到 cross-post badge（约 line 370-374），替换为：

```tsx
{message.extra?.crossPost && (() => {
  const sourceId = message.extra.crossPost.sourceThreadId;
  const sourceThread = threads.find((t: Thread) => t.id === sourceId);
  const displayName = sourceThread?.title ?? '未命名对话';
  return (
    <a
      href={`/thread/${sourceId}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/thread/${sourceId}`);
      }}
      className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
      title={`跳转到 ${sourceId}`}
    >
      📮 {sourceId.slice(0, 8)} · {displayName}
    </a>
  );
})()}
```

需要在组件顶部从 store 获取 `threads`：
```tsx
const threads = useChatStore((s) => s.threads);
const router = useRouter();
```

**Step 2: 确认 build 通过**

Run: `cd packages/web && pnpm build`
Expected: Compiled successfully

**Step 3: 提交**

```bash
git add packages/web/src/components/ChatMessage.tsx
git commit -m "feat(F057): cross-thread badge shows thread name + clickable jump"
```

---

## Task 2: list-threads MCP 增加 keyword 搜索（Phase C1 部分）

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts:80-83` (schema) + `546-581` (handler)
- Test: `packages/api/test/callbacks-list-threads.test.js` (新建)

**Step 1: 写失败测试**

新建 `packages/api/test/callbacks-list-threads.test.js`：

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { callbacksRoutes } from '../src/routes/callbacks.js';

// 使用 minimal mock 依赖（参考现有 test 模式）
// 测试 keyword filter + pinned field

describe('GET /api/callbacks/list-threads', () => {
  it('filters threads by keyword in title', async () => {
    // Setup with mock threadStore that returns threads with titles
    // Call with keyword=F052
    // Assert only matching threads returned
  });

  it('returns pinned status in response', async () => {
    // Assert response includes pinned field
  });

  it('keyword matches thread ID prefix', async () => {
    // Assert keyword matches on threadId too
  });
});
```

**注意**：具体 mock 依赖需要参考现有 callbacks test 的模式（如有）。如果没有独立 test 文件，直接在 handler 代码里加 keyword 支持，然后用 build + 手动验证。

**Step 2: 修改 schema 加 keyword 参数**

在 `callbacks.ts:80-83`：

```typescript
const listThreadsQuerySchema = callbackAuthSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  activeSince: z.coerce.number().int().min(0).optional(),
  keyword: z.string().trim().min(1).max(200).optional(), // ← 新增
});
```

**Step 3: 修改 handler 加 keyword 过滤 + pinned 字段**

在 `callbacks.ts:553` 解构加 `keyword`，在 sort 之前加过滤，在 map 加 `pinned`：

```typescript
const { invocationId, callbackToken, limit, activeSince, keyword } = parsed.data;
// ... registry verify ...

let threads = await threadStore.list(record.userId);
if (activeSince !== undefined) {
  threads = threads.filter((thread) => thread.lastActiveAt >= activeSince);
}
// keyword filter: match title or threadId
if (keyword) {
  const needle = keyword.toLowerCase();
  threads = threads.filter((thread) => {
    const title = (thread.title ?? '').toLowerCase();
    return title.includes(needle) || thread.id.toLowerCase().includes(needle);
  });
}

threads.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
const summaries = threads.slice(0, requestedLimit).map((thread) => ({
  threadId: thread.id,
  ...(thread.title ? { title: thread.title } : {}),
  lastActiveAt: thread.lastActiveAt,
  pinned: thread.pinned ?? false, // ← 新增
  messageCount: null,
  participants: thread.participants,
}));
```

**Step 4: Build 验证**

Run: `cd packages/api && pnpm build`
Expected: exit 0

**Step 5: 提交**

```bash
git add packages/api/src/routes/callbacks.ts
git commit -m "feat(F057): list-threads MCP adds keyword search + pinned field"
```

---

## Task 3: 后端 GET /api/threads 也加 thread ID 搜索

**Files:**
- Modify: `packages/api/src/routes/threads.ts:169-177`

**Step 1: 加 threadId 匹配到 filter**

在 `threads.ts` 的搜索过滤（约 line 169-177）中，加 `thread.id` 匹配：

```typescript
const filtered = threads.filter((thread) => {
  const title = (thread.title ?? '').toLowerCase();
  const fallback = (thread.id === 'default' ? '大厅' : '未命名对话').toLowerCase();
  const project = (thread.projectPath ?? '').toLowerCase();
  const threadId = thread.id.toLowerCase(); // ← 新增
  return title.includes(needle) || fallback.includes(needle) || project.includes(needle) || threadId.includes(needle);
});
```

**Step 2: Build 验证**

Run: `cd packages/api && pnpm build`

**Step 3: 提交**

```bash
git add packages/api/src/routes/threads.ts
git commit -m "feat(F057): backend thread search also matches thread ID"
```

---

## Task 4: 整体验证

**Step 1: 跑前端测试**

```bash
cd packages/web && pnpm vitest run
```

**Step 2: 跑后端测试（非 Redis）**

```bash
cd packages/api && pnpm build
```

**Step 3: 类型检查**

```bash
cd packages/web && pnpm lint
```

**Step 4: Biome**

```bash
pnpm check
```

---

## Acceptance Criteria 映射

| AC | 实现 Task | 验证 |
|----|-----------|------|
| AC-B2: badge 显示 ID+名称，可点击跳转 | Task 1 | Build + visual |
| AC-C1: list_threads 可按名称搜索 | Task 2 | keyword param |
| 后端搜索也支持 ID | Task 3 | Build |

## 不在本 PR 范围

- AC-B1: 前端搜索框（Phase A 已完成）
- AC-C2: 猫 @ 铲屎官（需要更多设计讨论，独立 PR）
