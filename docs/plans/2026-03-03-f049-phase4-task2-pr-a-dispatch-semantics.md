---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-a, dispatch-semantics]
doc_kind: plan
created: 2026-03-03
---

# F049 Phase4 Task2 PR-A（派发链路语义/幂等/可恢复）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在不引入 Lua/CAS 的前提下，先把 `suggest/approve/dispatch` 做成“可恢复、可重试、可预期”的可验收行为契约。

**Architecture:** PR-A 只做语义层收敛：用 `dispatchAttemptId/pendingThreadId/kickoffMessageId` 把崩溃窗口显式化，并通过幂等矩阵 + fault-injection 回归把状态机锁死。并发硬化（Lua/CAS）留给 PR-B。

**Tech Stack:** Fastify + TypeScript + Node test runner（API），Mission Hub 仅做必要适配。

---

## 硬约束（签收口径）

### 1) 状态机 + 幂等矩阵（返回码写死）

| Endpoint | 输入状态 | 行为 | 返回 |
|---|---|---|---|
| `POST /suggest-claim` | `open` | 创建 suggestion | `200` |
| `POST /suggest-claim` | `suggested`（同 cat） | 幂等 no-op（忽略 payload） | `200` |
| `POST /suggest-claim` | `suggested`（不同 cat） | 冲突 | `409` |
| `POST /suggest-claim` | `approved`/`dispatched` | 非法状态 | `409` |
| `POST /decide-claim approve` | `suggested` | 进入派发流程 | `200` |
| `POST /decide-claim approve` | `approved` | 重试 dispatch（可恢复） | `200` |
| `POST /decide-claim approve` | `dispatched` | 幂等返回现有 thread | `200` |
| `POST /decide-claim reject` | `suggested` | 回 `open` | `200` |
| `POST /decide-claim reject` | `open` | 幂等 no-op | `200` |
| `POST /decide-claim reject` | `dispatched` | 非法状态 | `409` |

### 2) 崩溃窗口恢复策略（窗口 A/B）

- **窗口A：thread 已创建，backlog 尚未 dispatched**
  - 立即写入 `dispatchAttemptId`（批准后）与 `pendingThreadId`（一旦拿到 threadId）。
  - 之后任何重试 **只允许复用 `pendingThreadId`**，禁止二次 create。
- **窗口B：backlog 近完成，但 link/kickoff 未齐**
  - 保持 `approved`，重试时补齐缺失步骤；
  - 仅当 `pendingThreadId + backlog link + kickoffMessageId` 三条件齐备才落 `dispatched`。

### 3) 新元数据字段清理/保留规则（必须测试锁死）

- 成功 `approved -> dispatched`：
  - `dispatchAttemptId` 保留（审计/追踪），
  - `pendingThreadId` 可保留为最终 threadId（单一真相），
  - `kickoffMessageId` 必须有值。
- 失败保持 `approved`：
  - `dispatchAttemptId` 必须保留，
  - 若 thread 已创建则 `pendingThreadId` 必须保留，
  - `kickoffMessageId` 为空（可重试补齐）。

### 4) PR-A 已知限制（P3，留给 PR-B）

- `kickoff` 仍存在极小崩溃窗：append 成功但 `kickoffMessageId` 未落盘可能导致重复发送。
- PR-B 再用 idempotencyKey/原子化硬化该窗口。

---

## TDD Tasks

### Task 1: 补元数据字段与状态机前置约束

**Files:**
- Modify: `packages/shared/src/types/backlog.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`

**Red:** 新增/更新类型测试（若有）+ 编译报错定位。

**Green:** 最小实现字段：`dispatchAttemptId?`、`pendingThreadId?`、`kickoffMessageId?`，并能在 store 层读写。

---

### Task 2: approve/dispatch 可恢复幂等（窗口 A/B）

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-routes.test.js`

**Red tests（必须先写失败）:**
1. `approve` 崩在 create 后，重试不重复创建 thread（复用 `pendingThreadId`）。
2. `approve` 在 `dispatched` 状态重放返回 200 幂等（同 thread）。
3. `reject` 在 `open` 状态重放返回 200 no-op。
4. 窗口B：缺 `kickoffMessageId` 时保持 `approved`，重试补齐后才变 `dispatched`。

**Green:** route 按矩阵收敛返回码和状态推进。

---

### Task 3: suggest-claim 同 cat 幂等 no-op 语义

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/test/backlog-routes.test.js`

**Red tests:**
1. `suggested` + 同 cat 再 `suggest-claim` 返回 200 且 suggestion 不被 why/plan 微改污染。
2. `suggested` + 不同 cat 返回 409。

**Green:** 实现“不支持编辑”语义，POST 仅首次创建。

---

### Task 4: quality-gate / request-review 文档证据

**Files:**
- Create: `docs/mailbox/2026-03-03-f049-phase4-task2a-quality-gate.md`
- Create: `docs/mailbox/2026-03-03-f049-phase4-task2a-review-request-to-gpt52.md`

**Evidence checklist（必须出现在 review 请求中）:**
- 幂等矩阵对照表（返回码 + 状态）
- 窗口A/B fault-injection 测试列表
- 字段清理/保留规则对应测试
- 关键命令输出（api tests/build）

---

## 关键验证命令（PR-A）

```bash
env -u REDIS_URL pnpm --dir packages/api run build
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js packages/api/test/backlog-store.test.js
pnpm --dir packages/api run test:redis -- node --test test/redis-backlog-store.test.js
```

## Exit Criteria（PR-A）

- 幂等矩阵全部由测试锁死。
- 窗口A/B 均有 fault-injection 回归且通过。
- `dispatchAttemptId/pendingThreadId/kickoffMessageId` 成功/失败保留态规则有测试证明。
- 通过 `quality-gate` + `request-review`，并由 `@gpt52` 完成愿景复核后再进 merge-gate。
