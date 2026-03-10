---
feature_ids: [F088]
phase: D
doc_kind: plan
created: 2026-03-10
author: opus
---

# F088 Phase D — `/use` 模糊匹配（feat号 + title关键词 + 列表序号）

## Why

铲屎官原话："用户鬼记得住你的 thread id 啊，这完全不现实"
"改 /use 支持三种匹配模式：/use F088 按 feat 号匹配...最后说话的大猫猫时间最靠近现在的"

当前 `/use` 只支持 thread ID 前缀匹配，不实用。

## What

三级匹配（按优先级，先匹配到先返回）：

```
/use F088        → feat 号匹配（scan backlog tags → 关联 threads → 按 lastActiveAt 取最新）
/use 3           → /threads 列表序号匹配（e.g., /threads 输出的第 3 行）
/use 飞书登录     → thread title 模糊匹配（substring, case-insensitive）
/use thread-abc  → ID 前缀匹配（保持现有逻辑作为 fallback）
```

同时 `/threads` 输出升级：展示 feat 号（如有）
```
📋 最近的 threads:

1. 飞书登录bug排查 [F088] [abc123ef]
2. 语音模式测试 [F066] [def456ab]
3. (无标题) [9876fedc]

用 /use F088 或 /use 飞书 或 /use 3 切换
```

## Data Model

Thread → feat 的映射链：
```
Thread.backlogItemId → BacklogStore.get(backlogItemId) → BacklogItem.tags
→ tags.find(t => t.startsWith('feature:')) → 'feature:f088' → 'F088'
```

`buildThreadIdsByFeatId()` 已有实现（`packages/api/src/routes/callbacks.ts:164`），可复用模式。

## Implementation Steps

### Step 1: Add backlogStore to ConnectorCommandLayerDeps (optional dep)

```typescript
// ConnectorCommandLayerDeps 新增：
readonly backlogStore?: {
  get(itemId: string, userId?: string):
    | BacklogItem | null
    | Promise<BacklogItem | null>;
};
```

同时扩展 `threadStore.list()` 返回的 subset 类型，加 `backlogItemId`:
```typescript
list(userId: string): Array<{
  id: string;
  title?: string | null;
  lastActiveAt?: number;
  backlogItemId?: string;   // ← 新增
}> | Promise<...>;
```

### Step 2: Implement resolveThreadByFeatId() private helper

```typescript
private async resolveThreadByFeatId(
  featInput: string, userId: string
): Promise<{ id: string; title?: string | null } | null>
```

逻辑：
1. 如果 `backlogStore` 不可用，return null（优雅降级）
2. `threadStore.list(userId)` 取所有 thread
3. 对每个有 `backlogItemId` 的 thread，`backlogStore.get()` 取 backlog item
4. `getFeatureTagId(tags)` 提取 feat 号
5. 匹配 `featInput.toUpperCase()` == normalized feat ID
6. 多个匹配时按 `lastActiveAt` 取最新（铲屎官要求）

### Step 3: Implement resolveThreadByIndex() private helper

```typescript
private async resolveThreadByIndex(
  indexStr: string, userId: string
): Promise<{ id: string; title?: string | null } | null>
```

逻辑：
1. Parse `indexStr` as integer, 1-based
2. `threadStore.list(userId).slice(0, 10)` 取列表（和 `/threads` 输出一致）
3. Return `threads[index - 1]` or null

### Step 4: Implement resolveThreadByTitle() private helper

```typescript
private async resolveThreadByTitle(
  query: string, userId: string
): Promise<{ id: string; title?: string | null } | null>
```

逻辑：substring match, case-insensitive, 多匹配取 `lastActiveAt` 最新

### Step 5: Refactor handleUse() to cascade through matchers

```typescript
private async handleUse(connectorId, externalChatId, userId, input):
  // 1. feat 号模式 /^F\d+$/i
  if (/^F\d+$/i.test(input)) → resolveThreadByFeatId
  // 2. 纯数字 → 列表序号
  if (/^\d+$/.test(input)) → resolveThreadByIndex
  // 3. ID 前缀匹配（保持现有）
  → threadStore.list().find(t => t.id.startsWith(input))
  // 4. title 模糊匹配（fallback）
  → resolveThreadByTitle
```

### Step 6: Upgrade /threads output with feat badge

`handleThreads()` 也要用 `backlogStore` 查 feat 号，展示 `[F088]` badge。

### Step 7: Wire backlogStore through bootstrap

`connector-gateway-bootstrap.ts` 的 deps 加 `backlogStore`。

### Step 8: Tests

- `/use F088` → 匹配 feat 号，返回最活跃的 thread
- `/use 3` → 匹配 /threads 列表第 3 项
- `/use 飞书` → title substring 匹配
- `/use thread-abc` → ID 前缀匹配（保持现有）
- `/use F999` → 无匹配，返回错误
- `/threads` → 输出包含 `[F088]` badge
- backlogStore 不可用时 → 优雅降级到 ID 前缀 + title 匹配

## Dependencies

- `getFeatureTagId()` from `packages/api/src/routes/backlog-doc-import.ts`
- `BacklogStore.get()` — 已有接口
- `ThreadStore.list()` — 已扩展到 ConnectorCommandLayerDeps (Phase C)

## Risk

- **BacklogStore N+1 查询**：每个有 backlogItemId 的 thread 都要 `get()` 一次。MVP 可接受（<10 threads），后续可加 batch 接口或缓存。
- **feat 号碰撞**：一个 feat 多个 thread 时取最新 — 铲屎官明确要求这个行为。
