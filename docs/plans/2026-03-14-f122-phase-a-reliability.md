# F122 Phase A: 可靠性加固 — Implementation Plan

**Feature:** F122 — `docs/features/F122-unified-dispatch-queue.md`
**Goal:** 不改架构，只补漏洞和可观测性——修 multi_mention parentInvocationId 断链、pushToWorklist 无 reason、target 崩溃锁 caller、QueuePanel 不显示 processing
**Acceptance Criteria:**
- AC-A1: multi_mention 的 routeExecution 传递 parentInvocationId
- AC-A2: pushToWorklist 返回结构化 reason，不再只返回空数组
- AC-A3: reason='not_found' 时降级到 standalone invocation
- AC-A4: QueuePanel 显示 processing 态条目
- AC-A5: 回归测试覆盖：A2A 期间用户发消息 → 必须 queued；steer → 必须 immediate
- AC-A6: 回归测试覆盖：connector 消息在 active slot 下 → 必须 queued；steer → 必须 immediate
- AC-A7: multi_mention target 崩溃/超时时，caller 的 InvocationTracker slot 必须正确释放
**Architecture:** 四个独立切口，每个改 1-2 个文件，互不依赖。可以任意顺序实现，最后统一回归测试。
**Tech Stack:** TypeScript, node:test, Fastify, React/Zustand
**前端验证:** Yes — AC-A4 QueuePanel 改动需 reviewer 用 Playwright/Chrome 实测

---

## Task 1: pushToWorklist 结构化 reason（AC-A2）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts:122-164`
- Test: `packages/api/test/worklist-registry.test.js`

### Step 1.1: 定义 PushResult 类型 + 写失败测试

在 `WorklistRegistry.ts` 新增导出类型：

```typescript
export interface PushResult {
  added: CatId[];
  reason?: 'not_found' | 'depth_limit' | 'caller_mismatch' | 'all_duplicate';
}
```

修改 `pushToWorklist` 返回值从 `CatId[]` 改为 `PushResult`。

测试：

```javascript
test('pushToWorklist returns structured PushResult with reason', async () => {
  const { registerWorklist, pushToWorklist } = await import(
    '../dist/domains/cats/services/agents/routing/WorklistRegistry.js'
  );
  // not_found
  const notFound = pushToWorklist('nonexistent', ['opus']);
  assert.equal(notFound.reason, 'not_found');
  assert.deepEqual(notFound.added, []);

  // depth_limit
  const threadId = 'test-reason-depth';
  registerWorklist(threadId, ['opus'], 0); // maxDepth=0
  const depthResult = pushToWorklist(threadId, ['codex']);
  assert.equal(depthResult.reason, 'depth_limit');
  assert.deepEqual(depthResult.added, []);

  // caller_mismatch
  const threadId2 = 'test-reason-caller';
  registerWorklist(threadId2, ['opus'], 10);
  const callerResult = pushToWorklist(threadId2, ['codex'], 'gemini'); // gemini != opus (current)
  assert.equal(callerResult.reason, 'caller_mismatch');
  assert.deepEqual(callerResult.added, []);

  // all_duplicate
  const threadId3 = 'test-reason-dup';
  registerWorklist(threadId3, ['opus'], 10);
  const dupResult = pushToWorklist(threadId3, ['opus']); // opus already in list
  assert.equal(dupResult.reason, 'all_duplicate');
  assert.deepEqual(dupResult.added, []);

  // success — no reason
  const successResult = pushToWorklist(threadId3, ['codex']);
  assert.equal(successResult.reason, undefined);
  assert.deepEqual(successResult.added, ['codex']);
});
```

### Step 1.2: 运行测试，确认失败

```bash
cd packages/api && pnpm build && node --test test/worklist-registry.test.js
```

Expected: FAIL — pushToWorklist returns `CatId[]` not `PushResult`

### Step 1.3: 实现 PushResult 返回值

修改 `WorklistRegistry.ts` 的 `pushToWorklist`：

```typescript
export function pushToWorklist(
  threadId: string,
  cats: CatId[],
  callerCatId?: CatId,
  parentInvocationId?: string,
): PushResult {
  const key = registryKey(threadId, parentInvocationId);
  const entry = registry.get(key);
  if (!entry) return { added: [], reason: 'not_found' };

  if (callerCatId !== undefined) {
    const currentCat = entry.list[entry.executedIndex];
    if (currentCat !== callerCatId) return { added: [], reason: 'caller_mismatch' };
  }

  const pending = entry.list.slice(entry.executedIndex);
  const added: CatId[] = [];
  let hitDepthLimit = false;

  for (const cat of cats) {
    if (entry.a2aCount >= entry.maxDepth) {
      hitDepthLimit = true;
      break;
    }
    if (!pending.includes(cat)) {
      entry.list.push(cat);
      entry.a2aCount++;
      added.push(cat);
      pending.push(cat);
      if (callerCatId !== undefined) {
        entry.a2aFrom.set(cat, callerCatId);
      }
    } else if (callerCatId !== undefined) {
      const existingIndex = entry.list.findIndex((id, idx) => idx >= entry.executedIndex && id === cat);
      const isOriginalPendingTarget = existingIndex !== -1 && existingIndex < entry.originalCount;
      if (!isOriginalPendingTarget) {
        entry.a2aFrom.set(cat, callerCatId);
      }
    }
  }

  if (added.length === 0) {
    return { added: [], reason: hitDepthLimit ? 'depth_limit' : 'all_duplicate' };
  }
  return { added };
}
```

### Step 1.4: 修复调用方（callback-a2a-trigger.ts）

`callback-a2a-trigger.ts:68` 改为读取 `PushResult`：

```typescript
// 原：const enqueued = pushToWorklist(threadId, targetCats, callerCatId, opts.parentInvocationId);
// 改为：
const pushResult = pushToWorklist(threadId, targetCats, callerCatId, opts.parentInvocationId);
const enqueued = pushResult.added;
```

在 `enqueued.length === 0` 的日志中补 reason：

```typescript
log.info(
  {
    threadId,
    triggerMessageId,
    targetCats,
    reason: pushResult.reason,
  },
  `[F27] A2A callback: targets not enqueued (${pushResult.reason})`,
);
```

### Step 1.5: 修复现有测试兼容性

`worklist-registry.test.js` 中现有测试用 `assert.deepEqual(pushed, ['codex'])` 的形式断言返回值。需要把这些改为 `pushed.added`：

- `pushed = pushToWorklist(...)` → `pushed.added`
- `pushDup = pushToWorklist(...)` → `pushDup.added`

### Step 1.6: 运行测试，确认全部通过

```bash
cd packages/api && pnpm build && node --test test/worklist-registry.test.js
node --test test/callback-a2a-trigger.test.js
```

Expected: ALL PASS

### Step 1.7: Commit

```bash
git add packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts \
  packages/api/src/routes/callback-a2a-trigger.ts \
  packages/api/test/worklist-registry.test.js
git commit -m "feat(F122): pushToWorklist returns structured PushResult with reason (AC-A2)"
```

---

## Task 2: reason='not_found' 降级到 standalone invocation（AC-A3）

**Files:**
- Modify: `packages/api/src/routes/callback-a2a-trigger.ts:67-116`
- Test: `packages/api/test/callback-a2a-trigger.test.js`

### Step 2.1: 写测试

```javascript
test('A2A with reason=not_found falls back to standalone invocation', async () => {
  // Setup: hasWorklist returns true but pushToWorklist returns not_found
  // (race condition: worklist unregistered between has and push)
  // Verify: triggerA2AInvocation is called as fallback
});
```

### Step 2.2: 运行测试，确认失败

### Step 2.3: 实现降级逻辑

在 `callback-a2a-trigger.ts` 的 `hasWorklist(threadId)` 分支中，`pushResult.reason === 'not_found'` 时 fallthrough 到 standalone invocation：

```typescript
if (hasWorklist(threadId)) {
  const pushResult = pushToWorklist(threadId, targetCats, callerCatId, opts.parentInvocationId);
  const enqueued = pushResult.added;

  if (pushResult.reason === 'not_found') {
    // Race: worklist disappeared between has() and push(). Fall through to standalone.
    log.warn(
      { threadId, triggerMessageId, targetCats },
      '[F27] A2A callback: worklist vanished between has/push, falling back to standalone',
    );
  } else {
    // ... existing log + return logic ...
    return { enqueued, fallback: false };
  }
}
```

### Step 2.4: 运行测试，确认通过

### Step 2.5: Commit

```bash
git commit -m "feat(F122): not_found reason triggers standalone invocation fallback (AC-A3)"
```

---

## Task 3: multi_mention parentInvocationId 透传（AC-A1）

**Files:**
- Modify: `packages/api/src/routes/callback-multi-mention-routes.ts:156-164`
- Test: `packages/api/test/multi-mention-routes.test.js`

### Step 3.1: 写测试

验证 `routeExecution` 被调用时包含 `parentInvocationId`：

```javascript
test('dispatchToTarget passes parentInvocationId to routeExecution', async () => {
  // Setup mock router that captures options
  // Call dispatchToTarget
  // Assert routeExecution received { parentInvocationId: createResult.invocationId }
});
```

### Step 3.2: 运行测试，确认失败

### Step 3.3: 实现透传

`callback-multi-mention-routes.ts:156-164`，`routeExecution` 调用补最后一个参数对象：

```typescript
// 原：{ signal: controller.signal }
// 改为：
{ signal: controller.signal, parentInvocationId: createResult.invocationId }
```

### Step 3.4: 运行测试，确认通过

### Step 3.5: Commit

```bash
git commit -m "feat(F122): multi_mention passes parentInvocationId to routeExecution (AC-A1)"
```

---

## Task 4: multi_mention target 崩溃释放 caller slot（AC-A7）

**Files:**
- Modify: `packages/api/src/routes/callback-multi-mention-routes.ts` — dispatchToTarget 的 error handling
- Test: `packages/api/test/multi-mention-routes.test.js`

### Step 4.1: 确认根因

读 `dispatchToTarget` 的 finally block（line 184）。当前 `tracker.complete(threadId, targetCatId, controller)` 只释放 **target** 的 slot。

但问题不是 target slot——而是 **caller（缅因猫）的 invocation 在等所有 target 完成才结束**。如果 target 崩了但 caller 不知道，caller 的 CLI 进程可能已经退出但 tracker slot 没 complete。

需要确认：caller 的 slot 由谁管理？是 multi_mention 的 HTTP handler，还是 caller 自己的 CLI 进程？

### Step 4.2: 写测试

```javascript
test('target execution failure does not leave caller slot locked', async () => {
  // Setup: caller slot is tracked
  // dispatchToTarget throws (simulating target crash)
  // Assert: caller slot is released
  // Assert: invocationTracker.has(threadId, callerCatId) === false
});
```

### Step 4.3: 运行测试，确认失败

### Step 4.4: 实现修复

根因有两种可能，实现时选其一：

**方案 A**：如果 caller slot 是 multi_mention handler 管的——在 handler 的 finally block 确保所有 target dispatch 完成后释放 caller slot。

**方案 B**：如果 caller slot 是 CLI 进程管的——确保 multi_mention callback HTTP 返回后，caller CLI 进程能正确读取返回值并 complete 自己的 tracker。这可能需要在 HTTP response 中返回结构化 error 而非挂起。

### Step 4.5: 运行测试，确认通过

### Step 4.6: Commit

```bash
git commit -m "fix(F122): release caller slot when multi_mention target crashes (AC-A7)"
```

---

## Task 5: QueuePanel 显示 processing 态（AC-A4）

**Files:**
- Modify: `packages/web/src/components/chat/QueuePanel.tsx:142`
- Test: `packages/web/src/components/__tests__/queue-panel-processing.test.ts` (new)

### Step 5.1: 写测试

```typescript
test('QueuePanel shows processing entries with distinct styling', () => {
  // Render QueuePanel with entries: [{ status: 'queued' }, { status: 'processing' }]
  // Assert: both entries visible
  // Assert: processing entry has "正在处理中" label or processing visual indicator
  // Assert: processing entry does NOT have steer/remove controls
});
```

### Step 5.2: 运行测试，确认失败

### Step 5.3: 实现

`QueuePanel.tsx:142`：

```typescript
// 原：const visibleEntries = queue.filter((e) => e.status === 'queued');
// 改为：
const visibleEntries = queue.filter((e) => e.status === 'queued' || e.status === 'processing');
```

渲染时区分：

```tsx
{entry.status === 'processing' ? (
  <span className="text-xs text-gray-400 animate-pulse">正在处理中</span>
) : (
  // existing steer/remove/move controls
)}
```

### Step 5.4: 运行测试，确认通过

### Step 5.5: Commit

```bash
git commit -m "feat(F122): QueuePanel shows processing entries with distinct styling (AC-A4)"
```

---

## Task 6: 回归测试（AC-A5, AC-A6）

**Files:**
- Test: `packages/api/test/integration/a2a-chain.test.js` (extend)

### Step 6.1: 写回归测试

```javascript
describe('F122 regression: queue behavior during active invocations', () => {
  test('user message during A2A must be queued', async () => {
    // Setup: active A2A chain (worklist running)
    // Send user message
    // Assert: response status is 'queued', not 'immediate'
  });

  test('steer during A2A must be immediate', async () => {
    // Setup: active A2A chain
    // Send steer
    // Assert: steer executes immediately, aborting current
  });

  test('connector message during active slot must be queued', async () => {
    // Setup: cat slot active
    // Send connector message for same cat
    // Assert: enqueueWhileActive called, not executeInBackground
  });
});
```

### Step 6.2: 运行测试，确认通过（这些是回归测试，现有行为应已正确）

### Step 6.3: Commit

```bash
git commit -m "test(F122): regression tests for queue behavior during A2A (AC-A5, AC-A6)"
```

---

## 最终验证

```bash
# 全量测试
cd packages/api && pnpm build && node --test test/worklist-registry.test.js test/callback-a2a-trigger.test.js test/multi-mention-routes.test.js
# 类型检查
pnpm lint
# Biome
pnpm check
```

全部通过后 → 加载 `quality-gate` → `request-review`（@ 缅因猫，要求看 Roadmap 章节的架构决策）。
