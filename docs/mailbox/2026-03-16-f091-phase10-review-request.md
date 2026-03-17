# Review Request: F091 Phase 10 — 文章正文提取 + 讨论创建 thread

## What

两个 bug fix：

1. **WebpageFetcher 正文提取**：`parseWebpageArticles()` 从未填充 `content` 字段，导致 webpage 来源的文章正文只有标题。现在从 `<p>/<li>/<blockquote>/<pre>` 等元素提取完整正文。

2. **"在对话中讨论"创建 study thread**：按钮从静态 `<a href="/thread/default">` 改为 `<button onClick>` ，点击时调 `POST /api/signals/articles/:id/discuss` 端点。端点复用 podcast 的 `resolveStudyThread` 模式：有已有 thread → 返回；没有 → 创建 `Study: {title}` + 加 opus 参与者 + 链接到 article meta。

## Why

铲屎官 18:58 报告两个问题。正文空白影响日常阅读体验；讨论跳 default thread 会导致发错消息。

## Original Requirements（必填）

> "它这个你看正文，它只给了你的标题，这是一个问题。"
> "我点在会话中讨论，打开，你直接跳转到了 default thread，这好像有点问题吧？"
> "你的做法应该是创建一个 thread，然后再把这个 thread 给命名成标准的命名，就跟你就生成音频报告的通路是一样的"

- 来源：本轮对话 铲屎官 18:58 语音消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 正文提取用 cheerio 选择器（`p/li/blockquote/pre/td/dd`），没有引入 Mozilla Readability。对结构化博客页面（如 Anthropic Engineering）足够，极端情况（纯 JS 渲染页面）仍会空白，但那需要 puppeteer 级别改动，scope 不在本 Phase。
- `signalStudyRoutes` 改为接受 `StudyRouteOptions`（含 `threadStore`），是 breaking change 但只影响内部注册调用（`index.ts`）。

## Open Questions

1. 正文提取的元素选择器是否需要更多标签（`<section>`、`<div>` 等）？当前策略是保守的——只选内容明确的标签，避免抓导航/footer 噪音。
2. `POST /discuss` 端点是否需要限流（防止连续点击创建多个 thread）？前端有 `discussLoading` 状态防止 double click。

## Next Action

请 review 代码质量和设计合理性，放行或提 P1/P2。

## 自检证据

### Spec 合规

| # | AC | 状态 |
|---|-----|------|
| 1 | AC-P10-1: WebpageFetcher 提取正文 | ✅ |
| 2 | AC-P10-2: 讨论按钮创建 study thread | ✅ |
| 3 | AC-P10-3: Thread 命名 + 链接 + 加 opus | ✅ |

### 测试结果

```
node --test (Phase 9+10 tests) → 11/11 pass, 0 failed
tsc --noEmit                    → 0 errors
biome check (6 files)           → 0 errors
pnpm build                      → exit 0
```

### 相关文档

- Feature: `docs/features/F091-signal-study-mode.md` (Phase 10)
- Branch: `feat/f091-phase10`

### 变更文件清单

| 文件 | 改动 |
|------|------|
| `packages/api/src/domains/signals/fetchers/webpage-fetcher.ts` | 提取 content 字段 |
| `packages/api/src/routes/signal-study-routes.ts` | 新增 POST /discuss 端点 + StudyRouteOptions |
| `packages/api/src/index.ts` | 传 threadStore 给 signalStudyRoutes |
| `packages/web/src/components/signals/SignalArticleDetail.tsx` | 按钮改为 onClick + apiFetch |
| `packages/api/test/webpage-fetcher-content.test.js` | 4 tests (新) |
| `packages/api/test/signal-discuss-thread.test.js` | 3 tests (新) |
