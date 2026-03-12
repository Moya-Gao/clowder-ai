# F091 Phase 6: Thread Session Reuse — Implementation Plan

**Feature:** F091 — `docs/features/F091-signal-study-mode.md`
**Goal:** 播客生成通过消息管道往 study thread 发消息，复用该 thread 的猫实例（含 thread memory）
**Acceptance Criteria:**
- [ ] AC-P6-1: 有已有 study thread → 往 thread 发消息触发生成（复用该 thread 的猫实例 + 上下文）
- [ ] AC-P6-2: 无 study thread → 创建新 thread + link 到 article → 发消息
**Architecture:** 替换 `generateScriptViaLLM`（直接 `new ClaudeAgentService`）为 `generateScriptViaThread`（往 study thread 发消息 + `router.routeExecution()` 捕获响应）。其余流程（artifact 管理、TTS、文件保存）不变。
**Tech Stack:** AgentRouter, MessageStore, ThreadStore, InvocationRecordStore, InvocationTracker
**前端验证:** No — 前端不变，后端透明切换生成方式

---

## Straight-Line Check

**Finish line:** `POST /api/signals/articles/:id/podcast` 通过 thread 消息管道调度猫生成脚本，而非独立 ClaudeAgentService。

**NOT building:**
- 前端任何变更
- 新 MCP tool
- 新的 prompt 注入系统（复用现有 SystemPromptBuilder + thread memory）

**Terminal schema:** `PodcastRequest` 新增 `threadId?: string`。`generateScriptViaThread(threadId, prompt, deps)` 返回 `Promise<string>`（LLM 原始响应文本）。

---

## Task 1: Wire DI — podcast routes 接收 router + stores

**Files:**
- Modify: `packages/api/src/routes/signal-podcast-routes.ts` — 添加 options interface
- Modify: `packages/api/src/index.ts` — 传递 deps

**Step 1:** 给 `signalPodcastRoutes` 加 options type + 从 opts 取 deps

```typescript
// signal-podcast-routes.ts
interface PodcastRouteOptions {
  messageStore: AnyMessageStore;
  threadStore: AnyThreadStore;
  router: AgentRouter;
  invocationRecordStore: IInvocationRecordStore;
  invocationTracker: InvocationTracker;
}

export const signalPodcastRoutes: FastifyPluginAsync<PodcastRouteOptions> = async (app, opts) => {
  // existing code, but now has access to opts.router, opts.messageStore, etc.
};
```

**Step 2:** 在 `index.ts` 注册时传递 deps

```typescript
await app.register(signalPodcastRoutes, {
  messageStore,
  router,
  threadStore,
  invocationRecordStore,
  invocationTracker,
});
```

**Step 3:** Verify — `pnpm lint` 类型检查通过

**Step 4:** Commit

---

## Task 2: Thread resolution — 查找或创建 study thread

**Files:**
- Modify: `packages/api/src/routes/signal-podcast-routes.ts` — 新增 `resolveStudyThread()`

**Step 1:** Write `resolveStudyThread` function

```typescript
async function resolveStudyThread(
  studyMeta: StudyMetaService,
  threadStore: AnyThreadStore,
  articleId: string,
  articleFilePath: string,
  articleTitle: string,
  userId: string,
): Promise<string> {
  // 1. Check study meta for existing linked thread
  const meta = await studyMeta.readMeta(articleId, articleFilePath);
  const existingThread = meta.threads[0]; // Use first linked thread
  if (existingThread) {
    return existingThread.threadId;
  }

  // 2. No thread — create one
  const threadId = `study-${articleId}-${Date.now()}`;
  await threadStore.upsert({
    id: threadId,
    title: `Study: ${articleTitle}`,
    participants: [userId],
    preferredCats: ['opus'],
    createdBy: userId,
  });

  // 3. Link thread to article
  await studyMeta.linkThread(articleId, articleFilePath, {
    threadId,
    linkedBy: userId,
  });

  return threadId;
}
```

**Step 2:** Verify — `pnpm lint` passes

**Step 3:** Commit

---

## Task 3: `generateScriptViaThread` — 核心替换

**Files:**
- Modify: `packages/api/src/domains/signals/services/podcast-generator.ts`
- Test: `packages/api/test/podcast-thread-dispatch.test.js`

**Step 1:** Write failing test — thread dispatch posts message + captures response

```javascript
// Test: generateScriptViaThread posts message to thread and parses response
test('generateScriptViaThread posts to thread and returns parsed script', async () => {
  // mock messageStore, router that yields a JSON response
  // assert: messageStore.append called with correct threadId
  // assert: returned script has segments
});
```

**Step 2:** Run test — verify FAIL

**Step 3:** Implement `generateScriptViaThread`

```typescript
interface ThreadInvokeDeps {
  messageStore: AnyMessageStore;
  router: AgentRouter;
  invocationRecordStore: IInvocationRecordStore;
  invocationTracker: InvocationTracker;
}

async function generateScriptViaThread(
  threadId: string,
  prompt: string,
  userId: string,
  deps: ThreadInvokeDeps,
): Promise<string> {
  // 1. Post prompt as user message to thread
  const msg = await deps.messageStore.append({
    threadId,
    userId,
    catId: null,
    content: prompt,
    mentions: ['opus' as CatId],
    timestamp: Date.now(),
  });

  // 2. Create invocation record
  const record = await deps.invocationRecordStore.create({
    threadId,
    userId,
    targetCats: ['opus' as CatId],
    intent: 'execute',
    idempotencyKey: `podcast-${threadId}-${Date.now()}`,
  });

  // 3. Start invocation tracker
  const controller = deps.invocationTracker.start(threadId, userId, ['opus' as CatId]);

  try {
    // 4. Route execution and collect text response
    let fullText = '';
    const intent = { intent: 'execute' as const, explicit: true, promptTags: [] as string[] };
    const persistenceContext = { failed: false, errors: [] };

    for await (const agentMsg of deps.router.routeExecution(
      userId, prompt, threadId, msg.id,
      ['opus' as CatId], intent,
      { persistenceContext },
    )) {
      if (agentMsg.type === 'text' && typeof agentMsg.content === 'string') {
        fullText += agentMsg.content;
      }
    }

    await deps.invocationRecordStore.update(record.invocationId, { status: 'succeeded' });
    return fullText;
  } catch (err) {
    await deps.invocationRecordStore.update(record.invocationId, {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown',
    });
    throw err;
  } finally {
    deps.invocationTracker.complete(threadId, controller);
  }
}
```

**Step 4:** Run test — verify PASS

**Step 5:** Commit

---

## Task 4: Wire it together — route uses thread dispatch

**Files:**
- Modify: `packages/api/src/domains/signals/services/podcast-generator.ts` — accept deps, choose path
- Modify: `packages/api/src/routes/signal-podcast-routes.ts` — pass deps + threadId

**Step 1:** Update `PodcastRequest` to accept thread info + deps

```typescript
export interface PodcastRequest {
  // ... existing fields ...
  readonly threadId?: string;
  readonly threadDeps?: ThreadInvokeDeps;
}
```

**Step 2:** Update `generatePodcastScript` — if `threadId` + `threadDeps` provided, use thread dispatch

```typescript
// Inside generatePodcastScript, replace the LLM call:
const script = request.threadId && request.threadDeps
  ? parseScriptResponse(
      await generateScriptViaThread(request.threadId, prompt, request.requestedBy, request.threadDeps),
      request.mode,
    )
  : await generateScriptViaLLM(request);
```

**Step 3:** Update POST route to resolve thread + pass deps

```typescript
const threadId = await resolveStudyThread(studyMeta, opts.threadStore, params.id, article.filePath, article.title, userId);

const artifact = await generatePodcastScript({
  // ... existing fields ...
  threadId,
  threadDeps: {
    messageStore: opts.messageStore,
    router: opts.router,
    invocationRecordStore: opts.invocationRecordStore,
    invocationTracker: opts.invocationTracker,
  },
});
```

**Step 4:** Run `pnpm lint` + existing tests — verify no regression

**Step 5:** Commit

---

## Task 5: End-to-end verification

**Step 1:** Run `pnpm --filter @cat-cafe/api lint` — 0 errors
**Step 2:** Run `node --test test/study-meta-dedup.test.js` — 3 pass
**Step 3:** Run `node --test test/podcast-thread-dispatch.test.js` — pass
**Step 4:** Commit all + push

---

## Task 6: Quality gate + review

**Step 1:** Self-check against AC-P6-1/P6-2
**Step 2:** Request gpt52 review
**Step 3:** Address feedback → merge-gate
