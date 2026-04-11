---
doc_kind: review-request
feature_ids: [F156]
created: 2026-04-10
---

# Review Request: F156 Phase D-3/D-5/D-6 — XSS 基线 + preview-gateway Origin + DNS Rebinding 防御

Review-Target-ID: f156
Branch: feat/f156-phase-d356

## What

三个安全加固子项，全部是防御性基础设施：

1. **D-5: preview-gateway Origin 校验** — HTTP 和 WS upgrade 均校验 Origin header（复用 `isOriginAllowed`），恶意 Origin 拒绝，无 Origin（curl）放行
2. **D-6: DNS Rebinding 防御** — `security-headers` 插件增加 `onRequest` hook 校验 Host header，只允许 `localhost`/`127.0.0.1`/`[::1]`
3. **D-3: 前端 XSS 基线** — HtmlWidgetBlock 加 DOMPurify 消毒（`<form>`/`<meta>`/`<base>` 剥离，`<script>` 保留）；Next.js CSP 增加 `script-src 'self' 'unsafe-inline'` + `object-src 'none'`

## Why

F156 三猫安全审计产出。D-1/D-2（session auth + anti-clickjacking）已合入 main（PR #1054）。这三个是剩余 P1/P2 项（D-4 Prompt Injection 暂缓，需设计讨论）。

## Original Requirements（必填）

> 铲屎官原话：
> "我们的 websockets 是不是有被钓鱼的风险？"
> "先修自己家的，然后自己家验证没问题再帮他们 officeclaw 修复一下"
> "D-3/D-5/D-6 都是纯基础设施改动，相对直接。要我先把这三个推了"
> "走起 改起来 让砚砚帮你review"
- 来源：本会话铲��官消息 + `docs/features/F156-websocket-security-hardening.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- D-3 CSP 使用 `'unsafe-inline'` 而非 nonce — Next.js 水合需要 inline scripts，nonce 方案需要 middleware 支持（future work）。显式禁了 `unsafe-eval` 和 `object-src`
- D-3 DOMPurify 保留 `<script>` — widget 需要 JS 运行（图表/交互），iframe sandbox 无 `allow-same-origin` 已隔离 cookie/storage
- D-6 Host 白名单硬编码 localhost 系列 — 自定义 FRONTEND_URL 场景可能需要额外配置（但当前所有用户都是本地访问）

## Open Questions

1. D-6 Host 校验是否应该读取 `FRONTEND_URL` 环境变量动态扩展白名单？当前仅允许 localhost 系列
2. D-3 CSP `script-src` 长期应迁移到 nonce-based，是否要在 BACKLOG 登记？

## Next Action

请 review 代码和测试覆盖，放行或提修改意见。

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试 |
|---|------|------|----------|------|
| D-3a | HtmlWidgetBlock 加 DOMPurify | ✅ | `sanitize-widget-html.ts` | HtmlWidgetBlock.test.tsx: 4 new tests |
| D-3b | 严格 CSP (禁 unsafe-inline JS) | ⚠️ 部分 | `next.config.js:33` — 加了 script-src + object-src，但 Next.js 需要 unsafe-inline | — |
| D-5 | preview-gateway WS upgrade 校验 Origin | ✅ | `preview-gateway.ts:212-219,142` | preview-gateway.test.js: 6 new tests |
| D-6 | HTTP 请求校验 Host header | ✅ | `security-headers.ts:17-26` | security-headers.test.js: 6 new tests |

### 测试结果

```
pnpm test (web)                          → 1997 passed, 1 failed (pre-existing SessionChainPanel)
preview-gateway.test.js                  → 18/18 pass ✅
security-headers.test.js                 → 10/10 pass ✅
HtmlWidgetBlock.test.tsx                 → 10/10 pass ✅
pnpm lint                                → 0 errors ✅
pnpm check                              → 0 errors ✅ (biome)
pnpm --filter @cat-cafe/web build        → exit 0 ✅
pnpm --filter @cat-cafe/api build        → exit 0 ✅
```

### 设计稿对照
glob designs/**/*.pen 匹配 F156: 无匹配 ➖ 无 UI 改动

### Artifact Hygiene
仓库根目录未跟踪媒体文件: 无 ✅

### 相关文档
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Commit: `64d78942e`
