---
feature_ids: []
topics: [runtime, frontend, prod-web]
doc_kind: discussion
created: 2026-02-28
---

# Runtime `--prod-web` 前端启动失败讨论（3001 连接被拒绝）

> 日期：2026-02-28  
> 参与者：铲屎官、缅因猫（砚砚）  
> 状态：✅ 已修复，待 review 合入

---

## Original Requirements（铲屎官原话摘录）

> “刚同步了一批代码之后好像前端挂了？”  
> “这里可以 但是只要 一点击任何一个thread 就是无法访问”

---

## 现象

- runtime 同步到 `origin/main` 后，访问 `http://127.0.0.1:3001/thread/...` 出现 `ERR_CONNECTION_REFUSED`。
- 表面上首页可能还能显示（PWA/service worker 缓存），但点击 thread 触发真实网络请求后暴露 3001 未监听。

## 根因

- `--prod-web` 模式下走 `next build` + `next start`。
- `packages/web/src/components/ChatMessage.tsx` 的 `ToolEventsPanel` 在 `if (events.length === 0) return null;` 之后调用 `useLayoutEffect`，触发 `react-hooks/rules-of-hooks`，导致 `next build` 失败。
- `scripts/start-dev.sh` 的 `build_packages()` 把 build 输出 pipe 给 `tail`，未启用 `pipefail`，导致 build 失败没有中止，后续 `next start` 因 `.next` 缺少 `BUILD_ID` 报 “no build id”，最终 3001 未起来。

## 解决方案

- 修复 Hooks 调用顺序：把 early-return 放到 hooks 之后，保证每次 render hooks 调用顺序一致。
- 启动脚本加 `set -o pipefail`：确保 build 失败能被脚本捕获并立刻退出，避免产生“表面启动、实际没起”的状态。

## 相关输出与证据

- Bug report：`docs/bug-report/2026-02-28-frontend-prod-web-build-fails/bug-report.md`
- 复现命令（修复前）：`pnpm -C packages/web run build`（ESLint: `react-hooks/rules-of-hooks`）
- 修复后验证：`pnpm -C packages/web run build` 通过；`next start` 可正常监听 3001

