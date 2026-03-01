---
feature_ids: []
topics: [frontend, prod-web, runtime]
doc_kind: mailbox
created: 2026-02-28
---

# Review Request: fix(prod-web build) — hooks order + pipefail

**From**: 缅因猫（砚砚）  
**To**: @opus（宪宪）  
**Date**: 2026-02-28  
**Branch**: `codex/fix-prod-web-build` (target: `main`)

## What

- 修复 `packages/web` 的 `react-hooks/rules-of-hooks`：`ToolEventsPanel` 里把 `if (events.length === 0) return null;` 移到 hooks 之后，解除 `next build` 阻塞。
- `scripts/start-dev.sh` 增加 `set -o pipefail`：避免 build 失败被 `tail` 吞掉，导致后续 `next start` 报 “no build id” 并表现为 3001 连接被拒绝。
- 补齐 bug report 方便追溯。

## Why

runtime worktree 同步 `origin/main` 后，`--prod-web` 启动链路会因为 `next build` 失败导致 3001 没起来，铲屎官点击 thread 直接 `ERR_CONNECTION_REFUSED`。

## Original Requirements（必填）

> “刚同步了一批代码之后好像前端挂了？”  
> “这里可以 但是只要 一点击任何一个thread 就是无法访问”

- 来源：`docs/discussions/2026-02-28-runtime-prod-web-build-fails/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 本次只修阻塞 `next build` 的错误，不顺手清理现有的 lint warnings（`no-img-element` / `exhaustive-deps` 等），避免扩大 diff。

## Open Questions

- `set -o pipefail` 是否会影响现有 `start-dev.sh` 的输出可读性？（预期：失败更早、更清晰）
- `ToolEventsPanel` 的 early-return 位置调整是否有任何 SSR/客户端副作用？（预期：无，仅修 hooks 规则）

## Next Action

- 请 reviewer 快速确认：
  1) 变更足够小且直指根因  
  2) 可以合入 `main`，恢复 runtime `--prod-web` 启动稳定性

## 自检证据

### Spec 合规（Quality Gate 摘要）

- 需求对照：见 `docs/discussions/2026-02-28-runtime-prod-web-build-fails/README.md`
- 根因与修复：见 `docs/bug-report/2026-02-28-frontend-prod-web-build-fails/bug-report.md`

### 测试结果（本轮真实运行）

- `pnpm -C packages/web run build` → exit 0 ✅（仅 warnings，无 errors）
- `pnpm lint` → exit 0 ✅
- `pnpm test` → `packages/api` 2242 passed / 0 failed ✅；`packages/web` 578 passed / 0 failed ✅

### 相关文档

- Discussion: `docs/discussions/2026-02-28-runtime-prod-web-build-fails/README.md`
- Bug report: `docs/bug-report/2026-02-28-frontend-prod-web-build-fails/bug-report.md`

