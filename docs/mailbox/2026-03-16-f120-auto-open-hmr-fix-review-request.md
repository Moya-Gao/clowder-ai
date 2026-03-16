---
feature_ids: [F120]
topics: [preview, browser, websocket, hmr, auto-open]
doc_kind: review-request
created: 2026-03-16
---

# Review Request: F120 preview auto-open + HMR WebSocket fix

## What

两个 bug fix：

1. **auto-open 在状态栏模式下无效**：`preview:auto-open` socket 事件的 listener 在 WorkspacePanel 里，但 `rightPanelMode='status'` 时 WorkspacePanel 没挂载，事件丢失。修复：提升 listener 到 ChatContainer（始终挂载），通过 store 中的 `pendingPreviewAutoOpen` 传递给 WorkspacePanel。

2. **HMR WebSocket 断连**：Vite HMR 客户端尝试 `ws://gateway:PORT/__vite_hmr`，但没带 `__preview_port` 参数，gateway 的 `parseTarget()` 返回 null → socket 被 destroy。修复：在 HTML 响应中注入 WebSocket 构造器补丁，自动为连接到 gateway 的 WS 请求追加 `__preview_port`。

### 变更文件

| 文件 | 变更 |
|------|------|
| `packages/web/src/stores/chatStore.ts` | 新增 `pendingPreviewAutoOpen` + setter + consumer |
| `packages/web/src/hooks/usePreviewAutoOpen.ts` | **新** — 始终挂载的 socket listener hook |
| `packages/web/src/components/ChatContainer.tsx` | 调用 `usePreviewAutoOpen` hook |
| `packages/web/src/components/WorkspacePanel.tsx` | 消费 `pendingPreviewAutoOpen`，挂载时应用 |
| `packages/api/src/domains/preview/ws-patch-script.ts` | **新** — WebSocket 构造器补丁生成器 |
| `packages/api/src/domains/preview/preview-gateway.ts` | 存储 target port → 注入 WS patch 到 HTML |
| `packages/web/src/components/__tests__/preview-auto-open-store.test.ts` | **新** — 5 tests |
| `packages/api/test/domains/preview/preview-gateway.test.js` | 新增 2 tests |

## Why

铲屎官在 Alpha 测试中报告：猫调用 auto-open API 后浏览器面板打不开（只能手动输入 URL），且看到 "HMR disconnected. Retry" 错误。

## Original Requirements（必填）

> "别手动让我输入，你最好打开浏览器，把页面放出来"
> "自动好像还是打不开这是我手动打的，我是希望如果我和你聊天是状态栏不是文件树的时候你用那个技能能把状态切换到文件树，然后打开预览"

- 来源：F120 thread session #4（2026-03-15/16）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **WS patch 是客户端 monkey-patch**：比服务端维护连接映射表更简单可靠，但修改了全局 WebSocket 构造器。`data-cat-cafe-ws-patch` 属性标识，且只在 gateway 同源 WS 连接时追加参数。
- **两个 socket 连接**：ChatContainer 的 auto-open listener 和 WorkspacePanel 的 port-discovered listener 各自建立 socket。Socket.IO 内部会复用传输层，开销可忽略。

## Open Questions

1. WS patch 是否需要处理 `wss://` 场景？（当前 Preview Gateway 只走 HTTP，不应出现 wss）
2. port-discovered 事件（toast 提示）在状态栏模式下同样丢失，是否一并提升？（本次未改，scope 控制）

## Next Action

请 review 代码质量 + 安全模型（WS patch 的 monkey-patch 是否有安全隐患）。P1/P2 only。

## 自检证据

### Spec 合规
- 愿景覆盖：auto-open 在任何面板模式下工作 ✅ | HMR 通过 gateway 正常工作 ✅
- 设计稿对照：无 .pen 文件，无 UI 布局改动 ➖
- 根目录媒体垃圾：无 ✅

### 测试结果
- Frontend preview tests → 16/16 pass ✅（preview-auto-open-store + preview-url-utils）
- Backend preview tests → 35/35 pass ✅（preview-gateway + port-validator）
- pnpm lint → 0 errors in changed files ✅
- pnpm check → 0 errors ✅

### 相关文档
- Feature: `docs/features/F120-hub-embedded-browser.md`
- 前次修复: PR #472（port validation + Hub URL warning）
