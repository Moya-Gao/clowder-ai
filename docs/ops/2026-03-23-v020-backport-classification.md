---
doc_kind: note
title: v0.2.0 Target Fixes Backport Classification
status: active
created: 2026-03-23
updated: 2026-03-23
owner: 砚砚
---

# v0.2.0 回家收口分类清单

这份清单只回答一个问题：`clowder-ai v0.2.0` 发版过程中在 target 仓补的东西，哪些应该改 `sync/public gate`，哪些应该直接回到共享代码，哪些只是 CI parity。

## 一眼判断

- **改的是 target 导出规则、public gate 契约、临时 target 验证链** → 归 `sync/public gate`
- **改的是 source 和 target 共用的运行逻辑 / adapter / runtime 行为** → 归 `shared code`
- **改的是 GitHub runner / Linux / node test runner 才暴露的测试稳定性** → 归 `CI parity`

## A. Sync / Public Gate

这些问题的根因不在共享业务逻辑，而在“家里如何把代码导出到公开环境并验证”。

- `/var` vs `/private/var` physical path 别名
  - 症状：temp target public gate 下 `PROJECT_ALLOWED_ROOTS` 命中逻辑和真实路径不一致
  - 处置：修 `sync-to-opensource.sh` 的 physical-path 解析与 allow-root 传递
- `test:public` 失败时只剩 `tail -5`
  - 症状：validate 红了但证据不够，定位被日志截断
  - 处置：先完整落盘，再按退出码打印尾部
- `4100` 被误判成 forbidden port
  - 症状：Preview Gateway 属于公开能力，却被 public gate 当成内部端口拦掉
  - 处置：修 source-owned public gate 规则
- `workspace-navigator` 文档写死 `3002`
  - 症状：home-only 默认值泄漏到公开文档
  - 处置：文档改成从 env 读取，不写死 home port
- `runtime-worktree.sh` 在开源仓里默认走 `3004` / `--profile=opensource`
  - 归类原因：这是 target transform，不是家里 runtime 的真相源
  - 执行规则：**不要把这类 target-only 变换原样 backport 到 `cat-cafe main`**

## B. Shared Code

这些问题在 source / target 两边都是真逻辑缺口，必须回家。

- `scripts/runtime-worktree.sh`
  - 回补内容：先读 runtime `.env` 的 `API_SERVER_PORT`，再 fallback 到 shell env / 默认值
  - 不回补内容：target-only 的 `3004` 默认端口和 opensource profile 变换
- `packages/api/src/infrastructure/connectors/adapters/DingTalkAdapter.ts`
  - 回补内容：`sendMedia()` 支持 `absPath` / `fileName`
  - 行为：没有 `url` 时退回文本投递，不再静默丢失本地媒体
- 关联回归测试
  - `packages/api/test/runtime-worktree-script.test.js`
  - `packages/api/test/dingtalk-adapter.test.js`

## C. CI Parity

这些问题主要发生在 GitHub Linux runner / node test runner 的执行语义上，不等于共享业务逻辑错了，但也不能只留在 target。

- `packages/api/test/invocation-timeout-guard.test.js`
  - 症状：GitHub CI 上 `unref()` 定时器可能被事件循环提早排空，导致 hanging-service 用例假红
  - 处置：测试层加 `withKeepAlive()`，让 test runner 不会在 Promise 仍应收敛时提前退场
  - 判断原则：这不是 sync 脚本问题，也不是 target-only 逻辑；它属于我们 source gate 对 target CI 行为的对齐

## D. 本次回家清单

- `scripts/runtime-worktree.sh`
- `packages/api/test/runtime-worktree-script.test.js`
- `packages/api/src/infrastructure/connectors/adapters/DingTalkAdapter.ts`
- `packages/api/test/dingtalk-adapter.test.js`
- `packages/api/test/invocation-timeout-guard.test.js`

## E. 下次别再混着查

看到 target PR / release 后的补丁时，按这个顺序切：

1. 先问：这是 target transform 还是共享代码？
2. 如果只在 `sync-to-opensource.sh`、temp target、public gate、公开默认端口上出现，先按 `sync/public gate` 查
3. 如果改动落在 adapter / runtime / shared service 本身，直接按 `shared code` 查
4. 如果只在 GitHub runner / Linux CI 才出现，而本地和 temp target 业务都正常，按 `CI parity` 查
5. 只有分类清楚了，才决定是 backport 到家里、修 sync 脚本，还是补 source gate 的 parity
