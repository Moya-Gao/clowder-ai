# Review Request: F120 Phase C — Auto-Open Browser + html_widget Rich Block

## What

两个核心改动：

1. **AC-C1: `preview:auto-open`** — 猫通过 `POST /api/preview/auto-open` 触发 socket 事件，前端直接打开 browser panel（跳过 toast）
   - 后端：preview routes 新增 `socketEmit` DI + auto-open endpoint（端口校验 + audit）
   - 前端：WorkspacePanel 监听 `preview:auto-open`，直接 `setViewMode('browser')`

2. **AC-C2: `html_widget` rich block** — 新的第 7 种 rich block，在聊天中用 sandboxed iframe srcdoc 渲染猫生成的 HTML/JS
   - shared + web 类型定义（`RichHtmlWidgetBlock`）
   - `HtmlWidgetBlock` 组件：`sandbox="allow-scripts"` **禁止** `allow-same-origin`
   - RichBlocks dispatcher 接线

## Why

铲屎官看到 Claude.ai 的 `visualize:show_widget`（聊天中内联渲染可交互 HTML），要求 Cat Café 也做。同时要求猫能主动打开浏览器面板，不需要用户手动操作。

## Original Requirements（必填）

> "我希望的是你打开那个浏览器不是我手动输入...别手动让我输入，你最好打开浏览器，把页面放出来"
> "简单的用富文本，复杂的用猫主动打开浏览器"
> "这种能力我们能搞吗？"（指 Claude.ai `visualize:show_widget`）
> "你不是120就是这些？120的 Phase 3 你都没做！"

- 来源：F120 spec `docs/features/F120-hub-embedded-browser.md` Phase C 讨论段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- html_widget 用 `srcdoc` 而非 Preview Gateway 提供服务 → 零网络请求、更简单，但无法访问外部资源（CDN 等）
- sandbox 禁止 `allow-same-origin` → 比 BrowserPanel 更严格，widget 无法访问 Hub 存储（安全优先）
- auto-open 通过 `socketEmit` DI 注入 → 避免 preview routes 直接依赖 SocketManager 单例

## Open Questions

1. **安全审查**：`html_widget` 的 `sandbox="allow-scripts"` 是否足够？是否需要额外的 CSP header？
2. **html_widget 内容大小**：是否需要限制 `html` 字段长度？当前无限制
3. **auto-open 权限**：是否需要鉴权（当前任何 POST 都能触发 auto-open）？

## Next Action

请 review 代码安全性 + 类型设计合理性。放行后走 merge-gate。

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|---|---|---|
| C1: auto-open API + 前端 | ✅ | `preview.ts:84-100` + `WorkspacePanel.tsx:213-216` + 3 tests |
| C2: html_widget rich block | ✅ | `rich.ts` type + `HtmlWidgetBlock.tsx` component + 6 tests |

### 测试结果

```
Preview API tests → 63/63 pass, 0 fail ✅
HtmlWidgetBlock tests → 6/6 pass ✅
pnpm lint → 0 errors (warnings pre-existing) ✅
biome check (our 7 files) → 0 errors ✅
shared + API build → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F120-hub-embedded-browser.md`
- Plan: `docs/plans/2026-03-14-f120-phase-c.md`
- Decisions: KD-6 (两层策略), KD-7 (srcdoc 沙箱)
