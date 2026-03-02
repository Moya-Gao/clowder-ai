---
title: "PWA mobile: header overlap + cold-open latency regression"
date: "2026-03-02"
severity: P1
status: fixed
---

## 1) 报告人

- 报告人：铲屎官
- 发现方式：iPhone PWA 截图 + 体感性能反馈

## 2) 复现步骤

1. 将 Cat Cafe 以 PWA（standalone）模式打开（iOS）。
2. 观察顶部 Header 区域。
3. 冷启动/重新打开应用，观察消息出现时间。

期望：
- Header 不被系统状态栏遮挡。
- 打开后尽快看到消息历史。

实际：
- Header 内容被顶部状态栏压住。
- 冷启动到消息可见存在明显等待。

## 3) 根因分析（证据链）

- UI 根因：`globals.css` 仅定义 `.safe-area-bottom`，Header 无 `safe-area-inset-top` 适配。
- 性能根因 A：`useChatHistory` 冷启动时并发 4 个请求（`/api/messages`、`/api/tasks`、`/task-progress`、`/queue`），关键路径未优先。
- 性能根因 B：`next-pwa` 使用默认 `dynamicStartUrl: true`，启动页 `/` 未预缓存；弱网/跨网段下冷启动更依赖网络。

## 4) 修复方案

1. 新增 `.safe-area-top`，并在 `ChatContainerHeader` 使用，修复顶部遮挡。
2. `useChatHistory` 启动流程改为“先消息后次要面板”：
   - 优先 `fetchHistory()`
   - 消息到达后再触发 `fetchTasks/fetchTaskProgress/fetchQueue`
3. PWA 配置优化：
   - `dynamicStartUrl: false`（预缓存 `/`）
   - `extendDefaultRuntimeCaching: true`（恢复默认页面缓存策略）
   - API 继续 `NetworkOnly`（避免消息陈旧）

## 5) 验证方式

- 新增测试（Red→Green）：
  - `chat-container-header-safe-area.test.ts`
  - `useChatHistory-priority.test.ts`
- 回归测试：
  - `pnpm --filter @cat-cafe/web test` → 595 passed, 0 failed
- 构建验证：
  - `pnpm --filter @cat-cafe/web build` → success
  - 生成 `sw.js` 包含 `precacheAndRoute([{url:"/", ...}])`，确认启动页已预缓存
