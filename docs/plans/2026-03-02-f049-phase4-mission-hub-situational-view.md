---
feature_ids: [F049]
topics: [mission-hub, phase4, situational-view, atomic-dispatch]
doc_kind: plan
created: 2026-03-02
---

# F049 Phase4（态势图 + 派发链路收敛）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 把 F049 从“可用调度面板”推进到“可用指挥中心”：Mission Hub 能直接看到跨 thread 态势，并把 `suggest/approve/dispatch` 与权限棘轮语义收敛到可验证的一致行为。

**Architecture:** Phase4 分两条主线并行推进：① Mission Hub UI 增加 thread 态势面（以 `backlogItemId` 反向关联 thread 执行态）；② 后端把 `suggest/approve/dispatch` 链路做成可恢复、可幂等、可并发验证的状态迁移（沿用 Redis Lua/CAS 风格）。最后用愿景守护 review（`@gpt52`）做原始需求对照签收，确保不是“功能全了但指挥体验没到位”。

**Tech Stack:** Fastify、TypeScript、Redis（ioredis + Lua EVAL）、Node test runner、Vitest（Mission Hub UI）。

**Execution Strategy:** 先做 Task 1（态势图最小可用）并不以 F043 MCP 工具为硬阻塞；Task 2 拆成两个 PR：PR-A 语义/幂等收敛，PR-B Lua/CAS 并发硬化，降低单 PR 风险面。

---

### Task 1: Mission Hub 增加跨 thread 态势视图（F043 对齐）

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Create: `packages/web/src/components/mission-control/ThreadSituationPanel.tsx`
- Modify: `packages/web/src/components/__tests__/mission-control-page.test.ts`
- Modify: `packages/web/src/components/__tests__/mission-control-page.test-helpers.ts`

**Step 1: Write the failing test**

新增 UI 用例（先红灯）：

```ts
it('renders dispatched backlog items with linked thread status summary', async () => {
  // 给定 dispatched item + /api/threads 返回 backlogItemId 对应 thread
  // 期望：Mission Hub 显示 thread 标题/最近活跃时间/参与猫
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: FAIL（当前页面没有 thread 态势区）。

**Step 3: Write minimal implementation**

- 在 `MissionControlPage` 加载 `/api/threads`，按 `backlogItemId` 建立映射。
- 新增 `ThreadSituationPanel`，展示每个 dispatched item 的 thread 摘要：标题、lastActive、participants、跳转入口。
- 保持“无 thread 数据”时降级提示，不阻塞 backlog 主流程。

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/web/src/components/mission-control/MissionControlPage.tsx \
        packages/web/src/components/mission-control/ThreadSituationPanel.tsx \
        packages/web/src/components/__tests__/mission-control-page.test.ts \
        packages/web/src/components/__tests__/mission-control-page.test-helpers.ts
git commit -m "feat(f049): add mission hub thread situation panel"
```

---

### Task 2: 派发链路收敛（suggest/approve/dispatch 可恢复 + 幂等）

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-store.test.js`
- Modify: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

新增后端回归用例：

```js
test('approve + dispatch retry stays idempotent across crash window', async () => {
  // 第一次 approve 后模拟 dispatch 前崩溃
  // 第二次重试能完成 dispatch 且不会重复创建 thread
});

test('decideClaim rejects stale suggestion version under concurrent updates', async () => {
  // 并发 approve/reject，只允许一个 winner
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js packages/api/test/backlog-store.test.js
```

Expected: FAIL（当前链路存在中间态恢复复杂度）。

**Step 3: Write minimal implementation**

- 在 `RedisBacklogStore` 为 `suggest/decide` 增加 Lua/CAS 保护（对齐 lease 迁移风格）。
- 在 `backlog.ts` 将 approve→dispatch 路径改为显式恢复流程：优先识别已 dispatch 幂等返回，再做非幂等状态推进。
- 保持现有 API 兼容（不破坏前端调用面）。

**Step 4: Run test to verify it passes**

Run:
```bash
env -u REDIS_URL pnpm --dir packages/api run build
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js packages/api/test/backlog-store.test.js
pnpm --dir packages/api run test:redis -- node --test test/redis-backlog-store.test.js
```

Expected: PASS（新增回归 + 既有用例全绿）。

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts \
        packages/api/src/routes/backlog.ts \
        packages/api/test/backlog-store.test.js \
        packages/api/test/backlog-routes.test.js
git commit -m "feat(f049): harden suggest-approve-dispatch transition semantics"
```

**PR split requirement**
- **PR-A（先做）**：只包含 route/store 语义收敛 + 幂等/恢复测试（不引入 Lua 脚本）。
- **PR-B（后做）**：在 PR-A 放行后，再引入 Lua/CAS 并发硬化 + Redis 竞态测试。

---

### Task 3: 权限棘轮语义闭环（once/thread/global）

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-routes.test.js`
- Modify: `packages/web/src/components/mission-control/SuggestionDrawer.tsx`
- Modify: `packages/web/src/components/__tests__/mission-control-page.test.ts`

**Step 1: Write the failing test**

```js
test('global scope allows repeated non-idempotent self-claim without once/thread blockers', async () => {
  // global 下同猫多次自领不同 item 应可通过
});
```

```ts
it('shows scope-specific guidance for disabled/once/thread/global in drawer', async () => {
  // UI 文案应与服务端语义一致
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js
pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: FAIL（当前 global 语义与提示仍偏基础 gate）。

**Step 3: Write minimal implementation**

- 在 route 层补齐 `global` 的显式语义与错误码契约。
- 在 `SuggestionDrawer` 增加“当前 scope + 行为说明 + 冲突处理建议”固定文案块。

**Step 4: Run test to verify it passes**

Run:
```bash
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js
pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts \
        packages/api/test/backlog-routes.test.js \
        packages/web/src/components/mission-control/SuggestionDrawer.tsx \
        packages/web/src/components/__tests__/mission-control-page.test.ts
git commit -m "feat(f049): close self-claim ratchet semantics for phase4"
```

---

### Task 4: 文档收敛 + 愿景守护签收

**Files:**
- Modify: `docs/features/F049-mission-control-backlog-center.md`
- Create: `docs/mailbox/2026-03-02-f049-phase4-review-request-to-gpt52.md`
- Create: `docs/mailbox/2026-03-02-f049-phase4-quality-gate.md`

**Step 1: Write doc assertions first**

- 更新 F049 的 Phase4 进度、Open Questions 关闭状态、Timeline。
- 在 review request 附原始需求摘录（≤5 行）+ 本轮测试证据 + 需 `@gpt52` 重点审查项。

**Step 2: Run verification commands**

```bash
env -u REDIS_URL pnpm --dir packages/api run build
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js packages/api/test/backlog-store.test.js
pnpm --dir packages/api run test:redis -- node --test test/redis-backlog-store.test.js
pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
pnpm --filter @cat-cafe/web build
pnpm lint
```

**Step 3: Commit docs**

```bash
git add docs/features/F049-mission-control-backlog-center.md \
        docs/mailbox/2026-03-02-f049-phase4-review-request-to-gpt52.md \
        docs/mailbox/2026-03-02-f049-phase4-quality-gate.md
git commit -m "docs(f049): record phase4 quality gate and vision review request"
```

---

### Exit Criteria（Phase4）

- Mission Hub 可直接展示 dispatched item 的 thread 态势，不再依赖手工切换 thread 才知道执行状态。
- `suggest/approve/dispatch` 具备可恢复幂等路径，并有并发回归测试证明。
- `once/thread/global` 三档语义在 API 与 UI 一致，失败原因对用户可解释。
- `@gpt52` 完成愿景守护 review（对照原始需求摘录签收），无 P1/P2 后进入 merge-gate。
