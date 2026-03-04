# Review Request: F051 v3 OAuth API — 砍浏览器，对齐 ClaudeBar

## What

将 F051 Real Quota Dashboard 的数据源从 Puppeteer/CDP 浏览器抓取 **完全替换为** OAuth API 直调：
- Claude: Anthropic OAuth API (`GET https://api.anthropic.com/api/oauth/usage`)
- Codex: OpenAI Wham API (`GET https://chatgpt.com/backend-api/wham/usage`)

核心变更：
- 新增 `parseClaudeOAuthUsageResponse` + `parseCodexWhamUsageResponse` 解析器
- 新增 `refreshOfficialQuotaViaOAuth` 编排器（并行 fetch + 错误隔离）
- 重写 `POST /api/quota/refresh/official` 路由
- **删除** ~442 行浏览器代码（CDP helpers、页面文本解析器、auto-start 逻辑等）
- 更新 probe descriptor: `sourceKind: 'cli'`, `requiresInteractive: false`

## Why

v2 的 CDP 浏览器方案在隔离 Chrome 中解析失败——即使页面正确加载、已登录、显示额度数据，`innerText` 的实际格式与正则不匹配。这是架构层面的脆弱性，不值得继续修补。

ClaudeBar（开源 macOS 菜单栏工具）已验证 OAuth API 方案的可行性，F051 spec 本就引用了它。

## Original Requirements（必填）

> 铲屎官："为什么我们不直接抄开源他们的实现呢？ClaudeBar 人家能解析吧？"
> 铲屎官："你这猫猫！我让你对齐愿景 看这个！你竟然到现在没看过？"

- 来源：2026-03-04 对话（本 session 铲屎官口头指令）
- 参考：`docs/features/F051-real-quota-dashboard.md` v3 数据源架构决策
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃 | 选择 | 理由 |
|------|------|------|
| Puppeteer/CDP 浏览器抓取 | OAuth API 直调 | 浏览器方案脆弱且 ClaudeBar 已验证 API 可行 |
| 页面文本解析（正则匹配） | 结构化 JSON 解析 | JSON 格式稳定，不受 UI 渲染变化影响 |
| 保留 puppeteer 依赖可移除 | 保留 puppeteer | ImageExporter.ts 仍需要 |

## Open Questions

1. **Codex OAuth 凭据存储路径**：目前 `loadCodexCredentials` 从环境变量指定路径读取。实际部署时凭据文件在哪？
2. **Token 刷新**：当前只做了读取 accessToken，没做 refresh token 自动刷新。是否需要？
3. **Gemini / Antigravity**：本次只覆盖了 Claude + Codex。Gemini 和 Antigravity 的 OAuth API 留待后续 phase。

## Next Action

请砚砚 review 以下重点：
- OAuth 解析器对 API 响应格式的健壮性
- 凭据加载的安全性（文件读取 vs 环境变量）
- 编排器的错误隔离是否充分
- 删除的浏览器代码是否有遗漏（残留引用）

## 自检证据

### Spec 合规
Quality Gate 已通过（本轮）：
- 愿景覆盖：4/4 项 ✅（砍 CDP、Claude OAuth、Codex Wham、对齐 ClaudeBar）
- 功能验收：7/7 项 ✅

### 测试结果
```
node --test test/quota-api.test.js    # 39 passed, 0 failed ✅
pnpm lint (tsc --noEmit)              # 0 errors ✅
pnpm build                            # exit 0 ✅
```

### Diff 统计
```
packages/api/src/routes/quota.ts    | +248 / -442 (net -194)
packages/api/test/quota-api.test.js | +281 / -486 (net -205)
pnpm-lock.yaml                      | lockfile sync
```

### 相关文档
- Feature: `docs/features/F051-real-quota-dashboard.md`
- Branch: `feat/f051-v3-oauth-api`
- Commit: `dd9d2876`
