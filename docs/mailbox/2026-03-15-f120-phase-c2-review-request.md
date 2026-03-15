# Review Request: F120 Phase C2 — Console + Screenshot + Multi-tab + Socket Scoping

## What

F120 Hub Embedded Browser 的 Phase C2 实现，包含 4 个核心变更：

1. **Socket room scoping**：`io.emit()` 全局广播 → `broadcastToRoom(worktree:${id})` 定向发送
2. **Gateway bridge script injection**：Preview Gateway 拦截 HTML 响应注入内联 `<script>`，patch console 方法 + 处理截图请求
3. **Console output panel**：ConsolePanel 组件显示 iframe 内 console 输出，按级别着色，ring buffer 500 条，error 自动展开
4. **One-click screenshot**：SVG foreignObject + canvas 截图 → data URL → 上传后端 → toast 展示
5. **Multi-tab browser panel**：BrowserTabBar 支持多标签页切换、关闭、新增

文件级拆分：BrowserPanel(334L) + BrowserToolbar + ConsolePanel + BrowserTabBar + useHmrStatus + usePreviewBridge，全部 ≤350 行。

## Why

Phase C 愿景：让 Hub 内嵌浏览器从"能看"进化到"能调试"。AC-C1/C2 已在 PR #458 合入，本轮完成剩余 AC-C3/C4/C5 + 砚砚 review 建议的 socket scoping 优化。

## Original Requirements（必填）

> 铲屎官原话（2026-03-15 23:47）：
> "@opus preview:auto-open 从 io.emit 收敛到 room/user 定向发送 你这些认为需要的不要拖 和你的c3 45一起搞 你也别问我要不要继续 你对齐愿景发现你没走偏你就继续！"

- 来源：铲屎官在 thread 中的直接指示
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **截图方案**：选 SVG foreignObject + canvas 而非 Puppeteer/Playwright，避免引入重依赖。缺点：跨域资源（外部图片/字体）无法捕获。对 localhost dev server 场景够用。
- **Bridge script 注入方式**：Gateway `selfHandleResponse` 拦截 + 手动 pipe，而非外部 middleware。更内聚但增加 gateway 复杂度。
- **Console 着色**：未严格跟 .pen 设计稿颜色（设计用黄/绿/灰），改用 devtools 标准着色（amber/red/blue/gray）更直觉。

## Open Questions

1. **bridge script 双注入守卫**：用 `window.__catCafeBridge` 防重复注入，SPA 路由切换时 bridge 仍保持。Reviewer 请关注是否有遗漏场景。
2. **截图安全**：`postMessage` 用 `source: 'cat-cafe-bridge'` 校验，但 `targetOrigin` 是 `'*'`。是否需要收紧？
3. **socket room scoping**：client 端 `socket.emit('join_room', room)` 由前端主动加入。恶意 client 理论上可以加入其他 room。目前是本地环境，风险可控。

## Next Action

请 reviewer 做 1 轮 review，关注：架构合理性、安全边界、bridge 注入可靠性。

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-C3 Console panel | ✅ | ConsolePanel + bridge injection |
| AC-C4 Screenshot | ✅ | SVG→canvas→upload pipeline |
| AC-C5 Multi-tab | ✅ | BrowserTabBar + tab state |
| Socket scoping | ✅ | broadcastToRoom 替代 io.emit |

设计稿对照：`designs/F120-hub-embedded-browser.pen` — Toolbar/HMR/Console 结构一致，Console 着色有意偏差（见 Tradeoff）。

### 测试结果

```
vitest run workspace/__tests__/   → 17/17 pass, 0 failed ✅
node --test preview/*.test.js     → 77/77 pass, 0 failed ✅
pnpm lint                         → 0 errors ✅
pnpm check (my files)             → 0 errors ✅
pnpm -r --if-present run build    → exit 0 ✅
pnpm check:dir-size               → pass ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-15-f120-phase-c2.md`
- Feature: `docs/features/F120-hub-embedded-browser.md`
- Previous PR: #458 (Phase C AC-C1/C2)
