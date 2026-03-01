---
title: "Frontend: --prod-web build fails (hooks lint) → 3001 connection refused"
date: "2026-02-28"
severity: P1
status: fixed
---

## 1) 报告人

- 报告人：铲屎官（runtime worktree 同步后）
- 发现方式：浏览器访问 `http://127.0.0.1:3001/thread/...` 报 `ERR_CONNECTION_REFUSED`

## 2) 复现步骤

1. 在 runtime worktree 运行 `pnpm start`（等价于 `./scripts/runtime-worktree.sh start`，会注入 `--prod-web`）。
2. 访问 `http://127.0.0.1:3001`（或 thread 页面）。

期望：前端服务在 3001 端口可访问。  
实际：3001 无监听；浏览器报连接被拒绝。

## 3) 根因分析（证据链）

- 现象：`lsof -iTCP:3001 -sTCP:LISTEN` 无输出；`lsof -iTCP:3002 ...` 显示 API 正常监听。
- 直接错误：`cd packages/web && pnpm exec next start -p 3001` 报：
  - `Could not find a production build in the '.next' directory`（缺少 build id）。
- 上游原因：`pnpm -C packages/web run build` 失败于 ESLint：
  - `packages/web/src/components/ChatMessage.tsx` 中 `ToolEventsPanel` 在 `if (events.length === 0) return null;` 之后调用 `useLayoutEffect`，触发 `react-hooks/rules-of-hooks`（Hooks 条件调用）。
- 额外放大器：`scripts/start-dev.sh` 的 `build_packages()` 把 `pnpm run build` 的输出管道给 `tail`，且未开启 `pipefail`，导致 build 失败时脚本仍继续执行，最终进入 `next start` 才暴露 “no build id”。

## 4) 修复方案

1. 代码修复：调整 `ToolEventsPanel`，保证 Hooks 总是在 render 时按固定顺序调用（把 early-return 放到 hooks 之后）。
2. 启动脚本修复：`scripts/start-dev.sh` 增加 `set -o pipefail`，确保 `pnpm run build` 失败时立即中止并显示真实错误。

## 5) 验证方式

- `pnpm -C packages/web run build` 通过（不再出现 `react-hooks/rules-of-hooks`）。
- `PORT=3001 pnpm -C packages/web exec next start -p 3001 -H 0.0.0.0` 能启动并保持监听。
- 浏览器访问 `http://127.0.0.1:3001` 正常加载。
