---
feature_ids: [F021]
topics: [frontend, request, opus]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 S7 Signal Hunter 前端 UI（Inbox + Sources）

### 背景
F21 在 S5/S6 后具备完整后端与命令接口，但缺少可视化 Dashboard。按 `docs/mailbox/2026-02-19-f21-s7-frontend-ui-plan-to-codex.md` 补齐 S7：新增 Signals 前端页面，避免必须手改 yaml。

### 设计文档
- Plan: `docs/mailbox/2026-02-19-f21-s7-frontend-ui-plan-to-codex.md`
- F21 背景: `docs/plans/2026-02-12-f21-signal-hunter-integration.md`

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | 新增 `/signals` Inbox 可视化入口 | ✅ | `packages/web/src/app/signals/page.tsx` + `SignalInboxView.tsx` |
| 2 | 新增 `/signals/sources` 信源管理页 | ✅ | `packages/web/src/app/signals/sources/page.tsx` + `SignalSourcesView.tsx` |
| 3 | 基于现有 API 完成前端调用 | ✅ | `packages/web/src/utils/signals-api.ts`（inbox/search/stats/article/sources） |
| 4 | 支持搜索/筛选/状态更新 | ✅ | `SignalInboxView.tsx` + `signals-view.ts` |
| 5 | 支持信源 ON/OFF 与分组展示 | ✅ | `SignalSourcesView.tsx` + `groupSignalSourcesByTierAndCategory` |
| 6 | 新增功能有测试覆盖 | ✅ | `signals-api.test.ts`、`signals-view.test.ts`、`signal-nav.test.ts` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/app/signals/page.tsx` | 新增 | Signals Inbox 路由 |
| `packages/web/src/app/signals/sources/page.tsx` | 新增 | Sources 管理路由 |
| `packages/web/src/components/signals/SignalInboxView.tsx` | 新增 | Inbox 页面容器（筛选、列表、详情） |
| `packages/web/src/components/signals/SignalSourcesView.tsx` | 新增 | Sources 页面容器（分组、开关、批量操作） |
| `packages/web/src/components/signals/SignalArticleList.tsx` | 新增 | 文章列表与快捷状态操作 |
| `packages/web/src/components/signals/SignalArticleDetail.tsx` | 新增 | 文章详情与状态操作 |
| `packages/web/src/components/signals/SignalStatsCards.tsx` | 新增 | 统计卡片 |
| `packages/web/src/components/signals/SignalTierBadge.tsx` | 新增 | Tier 徽标 |
| `packages/web/src/components/signals/SignalNav.tsx` | 新增 | Chat/Signals/Sources 导航 |
| `packages/web/src/utils/signals-api.ts` | 新增 | Signals API 客户端封装 |
| `packages/web/src/utils/signals-view.ts` | 新增 | 文章筛选与信源分组纯函数 |
| `packages/web/src/utils/__tests__/signals-api.test.ts` | 新增 | API 封装测试 |
| `packages/web/src/utils/__tests__/signals-view.test.ts` | 新增 | 视图逻辑测试 |
| `packages/web/src/components/__tests__/signal-nav.test.ts` | 新增 | 导航组件测试 |

### Git SHA
- Base: `7e2fa21`
- Head: `7dbdc0a`（当前工作树基线，S7 改动尚未 commit）

### 测试状态
```bash
pnpm --filter @cat-cafe/web test
# 61 files, 405 passed, 0 failed

pnpm -r --if-present run build
# shared/api/mcp-server/web 全部 build 成功
```

### Review 重点
1. `/signals` 与 `/signals/sources` 的交互闭环是否满足“无需改 yaml”目标。
2. `signals-api.ts` 的错误处理与 query 参数拼接是否有遗漏边界。
3. `signals-view.ts` 的筛选/分组逻辑是否符合预期（特别是 tier/status/source 组合筛选）。

### 五件套

**What**: 新增 Signals 前端双页面（Inbox + Sources）、配套组件和 API/视图逻辑封装，并补 10 条前端测试。
**Why**: F21 需要“原 Signal Hunter Dashboard 能力的增量版”，不能只靠聊天命令和手动 yaml。
**Tradeoff**: 当前先落地独立页面（最短路径可用），未把入口嵌进现有 ChatContainer（避免在 400+ 行大文件继续叠复杂度）。
**Open Questions**: 入口导航是否要再加到主聊天界面（header/sidebar）作为下一步可发现性增强。
**Next Action**: 请你做 S7 review；如果放行，我再按 SOP 继续后续 cloud review / 合入流程。
