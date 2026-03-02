---
feature_ids: [F049, F042, F043, F046]
topics: [mission-hub, backlog, lease, permission-ratchet, thread-link]
doc_kind: plan
created: 2026-03-02
---

# F049 Phase2 (backlogItemId + lease 状态机 + 权限棘轮) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在 Mission Hub 上完成 Phase2 三件套：thread 反向关联 `backlogItemId`、可回收 lease 状态机、可配置 self-claim 权限棘轮（`once/thread/global`）。

**Architecture:** 以 BacklogStore 作为任务状态真相源，新增 `lease` 子状态并通过 Redis 原子脚本保证 acquire/heartbeat/release/reclaim 的一致性；ThreadStore 增加 `backlogItemId` 反向索引完成 `backlog ↔ thread` 双向可追溯。权限棘轮通过 `cat-config.json` 配置驱动，默认 `disabled`（沿用“建议+批准”），逐步放开到 `once/thread/global`，避免一上来全自动自领。

**Tech Stack:** Fastify + Zod + Node test runner（API）、Redis（Lua 原子更新）、Next.js + Zustand（Web）、cat-config loader（配置治理）。

---

## 并发结论（F042→F043→F046 关系）

- **可以并发**：F042 已 done，不阻塞。
- **与 F043 并发策略**：F049 Phase2 只改 `backlog` 路由/存储与 `thread.backlogItemId` 字段，避免触碰 F043 `list_threads/feat_index` 契约面。
- **与 F046 并发策略**：F046 是流程守护层，不是运行时数据依赖；按 F046 门禁执行 review/证据链即可。
- **冲突控制**：Phase2 拆成 2 个可独立合入 PR（PR-A 数据面，PR-B 权限+UI），减少跨线 rebase 成本。

---

### Task 1: 先锁定 `backlogItemId` 反向关联契约（测试先行）

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
- Modify: `packages/web/src/stores/chat-types.ts`
- Test: `packages/api/test/thread-store.test.js`
- Test: `packages/api/test/redis-thread-store.test.js`

**Step 1: Write the failing test**

```js
test('links backlog item to thread and persists', async () => {
  const thread = store.create('u1', 't');
  await store.linkBacklogItem(thread.id, 'blg_123');
  const updated = await store.get(thread.id);
  assert.equal(updated?.backlogItemId, 'blg_123');
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm run build && node --test test/thread-store.test.js test/redis-thread-store.test.js`
Expected: FAIL with `linkBacklogItem is not a function` or missing field assertion.

**Step 3: Write minimal implementation**

- `Thread` 增加 `backlogItemId?: string`
- `IThreadStore` 增加 `linkBacklogItem(threadId, backlogItemId)`（memory+redis 都实现）
- Redis serialize/hydrate 增加 `backlogItemId` 字段

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm run build && node --test test/thread-store.test.js test/redis-thread-store.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts \
        packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts \
        packages/web/src/stores/chat-types.ts \
        packages/api/test/thread-store.test.js \
        packages/api/test/redis-thread-store.test.js
git commit -m "feat(f049): add backlogItemId reverse link on thread store"
```

### Task 2: 打通派发链路写入反向关联（`approve/dispatched → thread.backlogItemId`）

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

```js
test('approve-dispatch writes thread.backlogItemId', async () => {
  // suggest -> approve flow
  const thread = response.body.thread;
  assert.equal(thread.backlogItemId, itemId);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js`
Expected: FAIL because returned thread has no `backlogItemId`.

**Step 3: Write minimal implementation**

- `dispatchApprovedItem()` 创建 thread 后调用 `threadStore.linkBacklogItem(thread.id, item.id)`
- 失败时不标记 `dispatched`（保持现有幂等/恢复路径）

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(f049): persist reverse backlogItemId during dispatch"
```

### Task 3: 设计并锁定 lease 状态机契约（类型 + 失败测试）

**Files:**
- Modify: `packages/shared/src/types/backlog.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`
- Test: `packages/api/test/backlog-store.test.js`

**Step 1: Write the failing test**

```js
test('lease lifecycle: acquire -> heartbeat -> release -> reclaim', async () => {
  const acquired = await store.acquireLease(id, { catId: 'codex', ttlMs: 30000 });
  assert.equal(acquired?.lease?.ownerCatId, 'codex');
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js`
Expected: FAIL because lease methods/types do not exist.

**Step 3: Write minimal implementation**

- `BacklogItem` 新增 `lease` 结构（`ownerCatId`, `expiresAt`, `heartbeatAt`, `state`）
- `BacklogAuditAction` 新增 `lease_acquired | lease_heartbeat | lease_released | lease_reclaimed`
- `IBacklogStore` 新增：
  - `acquireLease`
  - `heartbeatLease`
  - `releaseLease`
  - `reclaimExpiredLease`

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/shared/src/types/backlog.ts \
        packages/shared/src/types/index.ts \
        packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts \
        packages/api/test/backlog-store.test.js
git commit -m "feat(f049): define lease state machine contracts for backlog"
```

### Task 4: 在 Store + Route 实现 lease 原子流转（Redis 优先）

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- Modify: `packages/api/src/routes/backlog.ts`
- Test: `packages/api/test/backlog-store.test.js`
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing route tests**

```js
test('acquire lease rejects when active lease owned by others', async () => {
  // expect 409 conflict
});
```

```js
test('heartbeat extends expiresAt for owner only', async () => {
  // expect expiresAt increases
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js test/backlog-routes.test.js`
Expected: FAIL (missing endpoints/state checks).

**Step 3: Write minimal implementation**

- Redis store 用 Lua/CAS 实现原子约束：
  - acquire：仅 `status='dispatched'` 且 lease 不活跃时成功
  - heartbeat：仅 owner 可续租
  - release：仅 owner 或用户可手动释放（按策略）
  - reclaim：仅当 `expiresAt < now` 才可回收
- 新增 API（建议）：
  - `POST /api/backlog/items/:id/lease/acquire`
  - `POST /api/backlog/items/:id/lease/heartbeat`
  - `POST /api/backlog/items/:id/lease/release`
  - `POST /api/backlog/items/:id/lease/reclaim`

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js test/backlog-routes.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts \
        packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts \
        packages/api/src/routes/backlog.ts \
        packages/api/test/backlog-store.test.js \
        packages/api/test/backlog-routes.test.js
git commit -m "feat(f049): implement lease acquire heartbeat release reclaim flow"
```

### Task 5: 权限棘轮配置（`disabled/once/thread/global`）+ self-claim gate

**Files:**
- Modify: `packages/shared/src/types/cat-breed.ts`
- Modify: `packages/api/src/config/cat-config-loader.ts`
- Modify: `cat-config.json`
- Modify: `packages/api/src/routes/backlog.ts`
- Test: `packages/api/test/backlog-routes.test.js`
- (Optional new) Test: `packages/api/test/backlog-self-claim-policy.test.js`

**Step 1: Write the failing policy tests**

```js
test('self-claim denied when missionHub policy is disabled', async () => {
  // expect 403
});
```

```js
test('self-claim allowed by policy scope global', async () => {
  // expect item directly dispatched + lease acquired
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js`
Expected: FAIL (policy schema/route missing).

**Step 3: Write minimal implementation**

- `cat-config` 新增 `missionHub.selfClaimScope`（默认 `disabled`）
- 路由新增 `POST /api/backlog/items/:id/self-claim`
- scope 行为：
  - `disabled`：403（继续建议+批准）
  - `once`：本次允许 self-claim（不写持久授权）
  - `thread`：仅同 thread 后续 lease 操作可直通
  - `global`：该 cat 在所有 backlog item 可直通

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js test/backlog-self-claim-policy.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/shared/src/types/cat-breed.ts \
        packages/api/src/config/cat-config-loader.ts \
        cat-config.json \
        packages/api/src/routes/backlog.ts \
        packages/api/test/backlog-routes.test.js \
        packages/api/test/backlog-self-claim-policy.test.js
git commit -m "feat(f049): add mission hub self-claim ratchet policy scopes"
```

### Task 6: Mission Hub UI 同步 lease/权限态 + F049 文档验收更新

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Modify: `packages/web/src/components/mission-control/SuggestionDrawer.tsx`
- Modify: `packages/web/src/components/__tests__/mission-control-page.test.ts`
- Modify: `docs/features/F049-mission-control-backlog-center.md`

**Step 1: Write the failing UI tests**

```ts
it('shows lease badge and heartbeat action on dispatched item', async () => {
  // expect lease info visible
});
```

```ts
it('hides self-claim action when policy is disabled', async () => {
  // expect no self-claim button
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts`
Expected: FAIL (UI controls missing).

**Step 3: Write minimal implementation**

- Drawer 显示 lease 状态（owner、expiresAt、剩余时间）
- 对 `dispatched` 且 lease 活跃项提供 heartbeat/release 按钮
- 根据 policy 展示或隐藏 self-claim 入口
- 继续使用 `Mission Hub` 命名，不回退到旧命名

**Step 4: Run test to verify it passes**

Run: `pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web/src/components/mission-control/MissionControlPage.tsx \
        packages/web/src/components/mission-control/SuggestionDrawer.tsx \
        packages/web/src/components/__tests__/mission-control-page.test.ts \
        docs/features/F049-mission-control-backlog-center.md
git commit -m "feat(f049): ship mission hub phase2 lease and ratchet ui"
```

### Task 7: 质量门禁 + review + merge-gate

**Files:**
- Create: `docs/mailbox/2026-03-02-f049-phase2-review-request.md`

**Step 1: Run focused verification**

Run:
- `cd packages/api && pnpm run build && node --test test/backlog-store.test.js test/backlog-routes.test.js test/thread-store.test.js test/redis-thread-store.test.js`
- `pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts`

Expected: PASS.

**Step 2: Run broader regression (same day)**

Run:
- `pnpm -r --if-present run build`
- `pnpm lint`

Expected: no new errors introduced by F049 changes.

**Step 3: Prepare review request**

`docs/mailbox/2026-03-02-f049-phase2-review-request.md` 包含：
- 原始需求摘录（铲屎官）
- P0/P1 风险点
- 测试证据
- 并发策略（与 F043/F046 无阻塞）

**Step 4: Merge gate**

Run:
- `gh pr create ...`
- 触发云端 review（merge-gate）
- `gh pr merge --squash --delete-branch`

Expected: main 绿色，F049 AC 对应项更新。

**Step 5: Commit**

```bash
git add docs/mailbox/2026-03-02-f049-phase2-review-request.md
git commit -m "docs(f049): add phase2 review package and verification evidence"
```

---

## 执行顺序建议（并发视角）

1. **PR-A（数据面）**：Task 1-4（thread backlink + lease 状态机）
2. **PR-B（策略面）**：Task 5-6（ratchet policy + Mission Hub UI）
3. **Gate PR**：Task 7（质量门禁与合入）

这样我们能与 F043/F046 并发推进，同时把冲突面限制在可控范围内。

## Skill 链（执行时必须）

`@worktree` → `@tdd` → `@quality-gate` → `@request-review` → `@receive-review` → `@merge-gate`

