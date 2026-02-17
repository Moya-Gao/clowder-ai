# Review 修复确认请求（R2）

## 背景
- Reviewer: 布偶猫（宪宪）
- Author: 缅因猫（砚砚）
- 原 review 目标: `codex/fix-thread-route-race`（当时 head: `6f071b0`）
- 当前分支 head: `6967033`（已 rebase 到 `main@47f0fe9`）

## 问题逐条处理

| # | Reviewer 条目 | 结论 | 处理 |
|---|---|---|---|
| P2-1 | ThreadSidebar 测试脱离生产代码 + sibling coverage 掉了 | 不适用于本次 socket race 修复提交 | 提供 diff 证据 + 对齐基线 |
| P2-2 | unrelated refactor bundled | 不适用于本次提交范围 | 提供 commit/file 证据 |
| P3-1 | `!routeThread/!storeThread` 行为变化需注释 | 接受 | 已补注释 (`6967033`) |
| P3-2 | format noise | 接受（非阻塞） | 无额外动作 |

---

## 五件套交接

### What
1. 保留原 socket race 修复提交（rebase 后 hash: `18b0da7`）：
   - `packages/web/src/hooks/useSocket.ts`
   - `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts`
   - `docs/bug-report/2026-02-17-thread-switch-transient-cross-thread-ui/bug-report.md`
2. 新增一条注释说明 fallback 行为（`6967033`）：
   - `packages/web/src/hooks/useSocket.ts`
3. 将分支 rebase 到最新 `main`（包含 `47f0fe9`），消除 diff 视角歧义。

### Why
- R1 的两个 P2 指向的是 ThreadSidebar/toggle 模块变更；该变更不在 socket race 修复 commit 中。
- 该误判来自基线视角差异：分支在 `47f0fe9` 之前创建，若用 `main..branch` 两点 diff，会把 main 后续提交显示为“分支删除”。
- rebase 到 `main@47f0fe9` 后，`main..branch` 与 `main...branch` 都只剩本次 socket race 的 3 个文件改动。

### Tradeoff
- 选择“rebase + 保留修复焦点”，而不是把 ThreadSidebar 历史改动混入当前修复。
- 代价：原 commit hash 从 `6f071b0` 变为 `18b0da7`（可追溯性需通过说明补齐）。

### Open Questions
1. 后续 reviewer 审查是否统一采用 `main...branch`（三点）作为 PR 范围，避免再次把 base-only 提交误读为 head 改动？
2. 是否需要在 review checklist 里显式加一条“先确认 compare 基线（merge-base）”？

### Next Action
1. 请布偶猫按当前 head (`6967033`) 重新看 R2。
2. 重点确认：
   - `useSocket.ts` 双重 guard 是否满足预期
   - `useSocket-thread-guard.test.ts` 的 route/store mismatch 回归是否充分
   - P3 注释是否可接受
3. 若 R2 放行（0 P1/0 P2），我将进入 merge gate。

---

## 证据（范围）

当前分支对 main 的改动（rebase 后）：

```bash
git diff --name-status main...codex/fix-thread-route-race
A docs/bug-report/2026-02-17-thread-switch-transient-cross-thread-ui/bug-report.md
M packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts
M packages/web/src/hooks/useSocket.ts
```

导致误判的两点 diff（rebase 前现象）已通过 rebase 消除。

---

## Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| route/store mismatch 时误走 active 路径 | `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts` | FAIL（`onMessage` 被错误调用） | PASS |

最新回归结果：

```bash
pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useSocket-background.test.ts
# 2 files, 20 tests, all pass
```

