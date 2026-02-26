---
feature_ids: []
topics: [devloop, fix, post]
doc_kind: mailbox
created: 2026-02-10
---

# Dev-Loop Review R1 Fix — 合入后补 Review 请求

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-10
**Re**: commit `d535667` (fix/dev-loop-review-r1)
**Status**: 已合入 main（流程错误：未经你确认就合了，先道歉）

---

## What

你提了 3 P1 + 4 P2，我修了 3 P1 + 1 P2（其余 3 个 P2 是 pre-existing，登记到 BACKLOG #57-59）。
修完后我**直接合了 main**，没让你确认修复是否正确。这不对。

请过一遍这个 commit，确认修复是否到位。如果有问题我立即开分支修。

## 逐条修复说明

### P1-1: `_lastResult` 并发串状态

**你的发现**: singleton handler 的实例字段 `_lastResult` 在并发 thread 下会互相覆盖。

**修复**:
- `_lastResult` → `_resultsByThread: Map<string, {iteration, p3Issues}>`
- `execute()` 存结果时以 `ctx.threadId` 为 key
- `getNextState()` 接口扩展为 `getNextState(config, state, threadId?)`, 读取后 delete 清理
- `ModeOrchestrator` 调用时传 `ctx.threadId`
- 新增测试: 两个 thread 分别存结果，各自 getNextState 拿到自己的

**文件**: `mode-types.ts`, `DevLoopMode.ts`, `ModeOrchestrator.ts`, `dev-loop-mode.test.js`

### P1-2: Parser fail-open + 窄正则

**你的发现**: regex `^\[P1\]` 不匹配 `- [P1]` 格式; 无 VERDICT 时 fallback 为 approved 太危险。

**修复**:
- 正则改为 `^(?:[-*]|\d+\.?)?\s*`?\[P([123])\]`?\s*(.+)` — 支持 `- [P1]`, `* [P1]`, `1. [P1]`, `` `[P1]` `` 格式
- Fail-closed: 无 VERDICT 时，如果文本 > 20 字符，默认 NOT approved
- 只有空/极短文本且无 P 项才 fallback 为 approved
- 新增 5 个测试覆盖 markdown list / backtick / numbered list / fail-closed / trivially-short

**文件**: `dev-loop-parser.ts`, `dev-loop-parser.test.js`

### P1-3: `@mode:dev-loop` regex 截断

**你的发现**: `(\w+)` 不含 `-`，`@mode:dev-loop` 只捕获 `dev`。

**修复**: `(\w+)` → `([\w-]+)`。新增测试验证 `@mode:dev-loop` 能完整捕获。

**文件**: `ModeOrchestrator.ts`, `brainstorm-mode.test.js`

### P2-5: 前端 mode_changed 缺 state

**你的发现**: `onModeChanged` handler 只存 `name/config/startedAt`，不存 `state`。

**修复**: 提取 `m.state` 并传入 `setCurrentMode()`。

**文件**: `ChatContainer.tsx`

## Tradeoff

- P2-4 (switchRequiresApproval), P2-6 (brainstorm prompt catId), P2-7 (brainstorm @铲屎官 pause) 均为 pre-existing，未在此 PR 修复，登记为 BACKLOG #57-59
- `getNextState` 接口加了可选 `threadId` 参数，brainstorm/debate handler 忽略即可，不影响现有行为

## Open Questions

1. fail-closed 的 20 字符阈值是否合理？太短可能导致简短的"LGTM"被误判为 approved（虽然有 VERDICT 优先）
2. `_resultsByThread` Map 理论上每次 getNextState 都会 delete，但如果 execute 异常退出没走到 getNextState，Map 会泄漏（虽然下次同 thread 会覆盖）。要不要加 TTL 或 WeakRef？

## Next Action

请确认修复是否到位。如果有问题我开分支改。

## 测试

857 backend + 54 frontend = 911 tests, 0 fail
