# F049 Phase3（权限棘轮语义 + Lease 原子化）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 把 F049 从“可用 MVP”推进到“可扩展协同基建”：补齐 `once/thread/global` 的可执行语义，并将 lease 状态迁移升级为 Redis 原子操作（Lua/CAS），减少并发竞态。

**Architecture:** 先在 `backlog` 路由层引入显式 `self-claim` 授权判定器（基于 backlog 历史状态 + 当前 lease 活跃态），确保 `disabled/once/thread/global` 不再只是 UI gate。随后在 `RedisBacklogStore` 中将 lease 相关状态迁移（acquire/heartbeat/release/reclaim）从读改写切到 Lua 原子更新，保证并发下状态一致。最后更新 Feature 文档与 Open Questions 收敛状态，形成可追溯证据链。

**Tech Stack:** Fastify、TypeScript、Redis（ioredis + Lua EVAL）、Node test runner、Vitest（Mission Hub UI）。

---

### Task 1: 定义并锁定 self-claim 语义（API）

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-routes.test.js`
- Modify: `packages/shared/src/types/backlog.ts`（仅当需要新增错误码/metadata）

**Step 1: Write the failing test**

在 `backlog-routes.test.js` 新增 3 组失败用例（先红灯）：

```js
test('self-claim once scope rejects second non-idempotent claim for same cat', async () => {
  // 第一次 self-claim dispatch 成功
  // 第二次对另一 item self-claim -> 403
});

test('self-claim thread scope rejects new claim when cat has another active leased thread', async () => {
  // 已有 dispatched+active lease item
  // 对新 item self-claim -> 409
});

test('self-claim thread scope allows claim after previous lease reclaimed/released', async () => {
  // reclaim/release 后再次 self-claim -> 200
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd packages/api
pnpm run build
node --test test/backlog-routes.test.js
```

Expected: 新增用例 FAIL（当前实现仅 `disabled` 拦截）。

**Step 3: Write minimal implementation**

在 `backlog.ts` 增加 `enforceSelfClaimScope(...)`：
- `disabled`: 403（保持现状）
- `once`: 仅允许首个非幂等 self-claim；已消费后阻断新的 item 自领
- `thread`: 若该 cat 在其他 item 上存在 active lease，则拒绝新自领（409）
- `global`: 放行

并保持 `existing.status === 'dispatched'` 的幂等返回路径不变。

**Step 4: Run test to verify it passes**

Run:
```bash
cd packages/api
pnpm run build
node --test test/backlog-routes.test.js
```

Expected: 新增用例 PASS，旧用例不回归。

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(f049): enforce self-claim scope semantics in backlog route"
```

---

### Task 2: Lease 状态迁移改为 Redis Lua 原子更新

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- Modify: `packages/api/test/backlog-store.test.js`
- Modify: `packages/api/test/backlog-routes.test.js`（并发/竞态回归）

**Step 1: Write the failing test**

新增并发场景失败用例：

```js
test('concurrent heartbeat vs reclaim: only one transition wins atomically', async () => {
  // lease 到期边界，heartbeat/reclaim 并发
  // 期望只有一个成功，最终状态一致
});

test('concurrent acquire by different cats: second cat cannot steal active lease', async () => {
  // 并发 acquire，只有一个成功
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd packages/api
pnpm run build
node --test test/backlog-store.test.js
```

Expected: 竞态用例 FAIL（当前读改写存在 TOCTOU 窗口）。

**Step 3: Write minimal implementation**

在 `RedisBacklogStore.ts` 引入 Lua 脚本（与现有 `RedisInvocationRecordStore`/`RedisThreadStore` 同风格）：
- `LEASE_ACQUIRE_LUA`
- `LEASE_HEARTBEAT_LUA`
- `LEASE_RELEASE_LUA`
- `LEASE_RECLAIM_LUA`

脚本内完成：
- 读取当前 hash
- 校验状态机前置条件
- 原子写回 `lease`、`updatedAt`、`audit`
- 返回更新后的序列化 item（或错误码）

**Step 4: Run test to verify it passes**

Run:
```bash
cd packages/api
pnpm run build
node --test test/backlog-store.test.js test/backlog-routes.test.js
```

Expected: 新增并发用例 PASS。

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts \
        packages/api/test/backlog-store.test.js \
        packages/api/test/backlog-routes.test.js
git commit -m "feat(f049): make lease transitions atomic with redis lua"
```

---

### Task 3: Mission Hub 语义提示与行为一致性

**Files:**
- Modify: `packages/web/src/components/mission-control/SuggestionDrawer.tsx`
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Modify: `packages/web/src/components/__tests__/mission-control-page.test.ts`

**Step 1: Write the failing test**

```ts
it('shows scope-specific blocker reason for once/thread self-claim rejection', async () => {
  // mock 403/409 message, assert UI 文案可见
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd packages/web
pnpm test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: FAIL（当前仅显示通用错误）。

**Step 3: Write minimal implementation**

- 将 API 返回的 `error` 映射为明确提示：
  - once 已消费
  - thread 有活跃 lease 冲突
- 在 drawer 中展示 scope 当前值和阻断原因，避免“按钮可见但必失败”体验。

**Step 4: Run test to verify it passes**

Run:
```bash
cd packages/web
pnpm test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/web/src/components/mission-control/SuggestionDrawer.tsx \
        packages/web/src/components/mission-control/MissionControlPage.tsx \
        packages/web/src/components/__tests__/mission-control-page.test.ts
git commit -m "feat(f049): align mission hub ui with ratchet semantics"
```

---

### Task 4: 文档收敛 + 证据同步

**Files:**
- Modify: `docs/features/F049-mission-control-backlog-center.md`
- Create: `docs/mailbox/2026-03-02-f049-phase3-review-request.md`

**Step 1: Write doc assertions first**

先补充：
- `once/thread/global` 的最终语义定义
- lease 原子化完成状态
- 仍未完成项（若有）

**Step 2: Run verification commands**

```bash
cd packages/api && pnpm run build && node --test test/backlog-store.test.js test/backlog-routes.test.js
cd packages/web && pnpm test -- src/components/__tests__/mission-control-page.test.ts
cd ../.. && pnpm lint
```

**Step 3: Commit docs**

```bash
git add docs/features/F049-mission-control-backlog-center.md \
        docs/mailbox/2026-03-02-f049-phase3-review-request.md
git commit -m "docs(f049): record phase3 semantics and review evidence"
```

---

### Exit Criteria（Phase3）

- `self-claim` 的 `once/thread/global` 行为可通过自动化测试证明，不再是“仅配置可见性”。
- lease 四个迁移操作具备原子一致性（并发回归测试通过）。
- Mission Hub UI 与 API 错误语义一致，用户可理解为什么被阻断。
- F049 文档中的 Open Questions 至少关闭 2 项，并给出余项下一步。

