---
feature_ids: []
topics: [test, backlog, import, flaky, gate, timeout]
doc_kind: bug-report
created: 2026-05-08
---

# Bug Report: `backlog-routes.test.js` 2 个 import 测试本身耗时 ~75-96s，超过 60s default `--test-timeout` → `pnpm gate` 假阳性 fail

> 报告人: 布偶猫（Opus 4.7）— `feat/F193-cross-thread-comm` 实施 thread
> 严重程度: P1（block 任何 `pnpm gate` 通过的合入流程）
> 状态: 已定位（不是 hang，是 inherent slow），等修复 thread 接手
> 发现时机: F193 Phase A merge-gate Step 0 跑 `pnpm gate`（`09c7088ed` start-dev fixture fix 修复后第二次卡点）

---

## 1. 报告来源

接续上一份 bug report（`docs/bug-report/start-dev-test-worktree-offset-leak/`，已 fix `09c7088ed` merged），F193 worktree rebase 到最新 origin/main 后重跑 `pnpm gate`，又遇到第二个 unrelated 阻塞——`packages/api/test/backlog-routes.test.js` 的 2 个 import 测试 60s timeout。

---

## 2. 复现步骤（期望 vs 实际）

### 复现

```bash
cd /any/worktree
env -u CAT_CAFE_INVOCATION_ID -u CAT_CAFE_CALLBACK_TOKEN -u REDIS_URL pnpm --filter @cat-cafe/api test
```

或直接运行受影响测试：

```bash
node --test \
  --test-name-pattern='dispatched item not in BACKLOG.md gets marked done|suggested item not in BACKLOG.md gets marked done' \
  --test-timeout=60000 \
  packages/api/test/backlog-routes.test.js
```

### 期望

`packages/api` 测试套件配置 `--test-timeout=60000`（见 `packages/api/package.json` 的 test script），单 test 应在 60s 内完成。`pnpm gate` 通过。

### 实际

两个测试 timeout：

```
✖ dispatched item not in BACKLOG.md gets marked done on import (60006ms)
  'test timed out after 60000ms'
✖ suggested item not in BACKLOG.md gets marked done on import (60080ms)
  'test timed out after 60000ms'
```

---

## 3. 根因分析

### 不是 hang，是 inherent slow

把 `--test-timeout` 放宽到 120000ms 重跑两次：

| 第 N 次 | duration | 状态 |
|---|---|---|
| Cold cache | 74.5s | ✅ pass |
| Warm cache | 96.1s | ✅ pass |

测试本身能跑完，只是**单 test 真实耗时 ~75-96s**，超过了 60s 的 default `--test-timeout`。

### 受影响测试的 import flow（推测）

测试位置：[`packages/api/test/backlog-routes.test.js:1510`](../../../packages/api/test/backlog-routes.test.js) 和 `:1596`。

测试动作：
1. 创建临时 BACKLOG.md（含 1 个 active feature `F001`）
2. 通过 `app.inject` 创建一个 dispatched/suggested item with tag `feature:f999`（不在 BACKLOG.md 里）
3. 触发 import sync
4. 期望：BACKLOG.md 没的 feature → import 把对应 item marked done

import sync 内部估计触发了 evidence/embedding/全文索引重建，cold/warm cache 都 ~75-96s。这是 import 本身的固有耗时——不是 hang。

### 为什么之前 main 上没炸

可能性：
- main 上跑 `pnpm gate` 时这两个 test 也 timeout 但没人注意（gate failure 在没合入的 PR 才被注意）
- 或者 main 上 evidence backend 配置不同（Redis-backed embedding cache 等）让 import 更快
- 或者 PR #1499 (WORKTREE_PORT_OFFSET) / 之后某个改动让 import 变慢，但没人在 OFFSET ≠ 0 worktree 跑过 gate

具体 root cause 需要 profile import sync 哪个步骤慢——超 F193 scope，留给修复 thread。

---

## 4. 影响面

- **任何 worktree 跑 `pnpm gate` 都会失败**（不限于 OFFSET ≠ 0）——只要 `packages/api` test 跑过这两个 test，就会 hit 60s timeout
- **CI 行为待验证**：CI pipeline 用什么 test runner / timeout 不知道，可能 CI 跑得过（更强机器）也可能跑不过
- 阻塞所有合入流程的 `pnpm gate` 步骤

---

## 5. 修复方案（建议选 A）

### 选项 A：profile import sync 找瓶颈，优化到 60s 内（推荐 — 治本）

`backlogStore.import()` / 相关 evidence rebuild 估计是瓶颈。可能的优化方向：
- Cache evidence index（如果每次 import 都重建）
- 跳过 embedding 计算（只在 production 启用）
- 使用 in-memory backend for tests（避开 Redis/sqlite I/O）

预估工作量：1-2h（profile + 优化 + 验证 60s 内）

### 选项 B：单 test override `--test-timeout` 到 120000ms（治标）

```js
test('dispatched item not in BACKLOG.md gets marked done on import', { timeout: 120000 }, async () => {
  // ...
});
```

不解决根因（test 本来就慢），但让 gate 通过。可作为 hotfix 给 F193 解锁，再单开 follow-up 优化。

预估工作量：5 min

### 选项 C：把这两个 test 抽到 `*.slow.test.js` 单独 suite

不在 `pnpm gate` 跑（让 gate 快），有专门的 nightly suite 跑慢测。

预估工作量：30 min（重组 test + script 配置）

---

## 6. 不在 F193 Phase A scope

F193 只动 mcp-server + `packages/api/src/routes/callbacks.ts`，**没碰** `backlog-routes.test.js` / `backlog.ts`。这是 main 仓本身的 inherent test slowness 问题。

```bash
$ git diff --name-only origin/main...HEAD | grep -E 'backlog'
(no F193 touch)
```

---

## 7. F193 Phase A 当前处理

按铲屎官 2026-05-08 02:20 拍板：
1. **写本 bug report**（即此文档）✅ done
2. **F193 Phase A 直接开 PR + 触发云端 review**（不被这个 unrelated test block）

云端 review 通过 + 修复 thread 完成后，F193 rebase 重跑 gate。

---

## Links

- 上一份相关 bug report: [`docs/bug-report/start-dev-test-worktree-offset-leak/`](../start-dev-test-worktree-offset-leak/bug-report.md)（已 fix `09c7088ed`）
- F193 Phase A branch: `feat/F193-cross-thread-comm`，HEAD `5cb077ace`（rebased 到 main `b7245d45d`）
- 受影响测试: [`packages/api/test/backlog-routes.test.js:1510`](../../../packages/api/test/backlog-routes.test.js) + `:1596`
- API test timeout 配置: [`packages/api/package.json`](../../../packages/api/package.json) test script `--test-timeout=60000`
- 验证耗时（worktree, OFFSET=-50）: cold 74.5s / warm 96.1s（120s timeout 都能 pass）
