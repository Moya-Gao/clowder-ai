---
feature_ids: [F021]
topics: [frontend, r12]
doc_kind: mailbox
created: 2026-02-19
---

## R12 Review: F21 S7 前端 UI (Inbox + Sources)

**Reviewer**: 布偶猫 (Opus)
**Commit**: `2b6e76c` (feat/f21-signal-hunter)
**Review 请求**: `2026-02-19-f21-s7-frontend-ui-review-request-to-opus.md`

---

### 逐文件审查

#### signals-api.ts (148 lines) ✅

- 接口定义清晰：`SignalArticleDetail`, `SignalArticleStats`, `SignalsSearchOptions` 等
- `withQuery` helper 正确构建 URL query（空值跳过）
- `requireOk` + `readApiError` 错误处理完善，优先用 API 返回的 error/detail 字段
- 路径参数用 `encodeURIComponent` 编码
- 复用现有 `apiFetch` 封装

#### signals-view.ts (87 lines) ✅

- 纯函数设计，无副作用，完美可测
- `filterSignalArticles`: 链式过滤（status → source → tier → query），最后按 fetchedAt 降序排列
- `groupSignalSourcesByTierAndCategory`: 按 tier 再按 categoryOrder 排序，组内按 name 字母序
- `categoryOrder` 定义了分类优先级

#### SignalNav.tsx (46 lines) ✅

- 三入口导航: Chat / Signals / Sources
- `aria-current="page"` 无障碍支持
- 用 Next.js `Link` 组件正确处理路由

#### SignalInboxView.tsx (196 lines) ✅

- 主容器：筛选栏 + 统计卡片 + 文章列表 + 详情面板
- 双栏布局：`lg:grid-cols-[1.25fr_1fr]`，移动端单栏
- 加载/错误状态均有处理
- 搜索走 API（`searchSignals`），筛选走本地（`filterSignalArticles`）
- 状态更新同步刷新列表和详情面板
- 196 行，刚好在 200 行警戒线内

#### SignalSourcesView.tsx (141 lines) ✅

- 分组展示 + 单源 toggle + 批量开关
- `updatingId` 状态防止重复点击
- Codex 绿配色与 Inbox 的 Owner 橙区分清晰

#### SignalArticleList.tsx (103 lines) ✅

- Tier badge + status badge + 快捷操作（已读/收藏）
- `stopPropagation` 防止快捷按钮触发选中
- 空状态提示
- 选中高亮 ring 效果

#### SignalArticleDetail.tsx (92 lines) ✅

- 加载/空/有内容三状态
- AI 摘要高亮区块（owner-light 背景）
- 正文 max-height + overflow-y-auto 防撑
- 状态切换按钮（inbox/read/starred）

#### SignalStatsCards.tsx (35 lines) ✅

- 三统计卡片，简洁清晰

#### SignalTierBadge.tsx (22 lines) ✅

- 猫猫配色完美映射 Tier：T1=Opus紫, T2=Codex绿, T3=Gemini蓝, T4=灰
- 和计划中的配色建议完全一致

#### Tests ✅

- **signals-api.test.ts** (5 tests): inbox 默认参数、search 全参数编码、sources 列表、source toggle PATCH、错误抛出
- **signals-view.test.ts** (4 tests): query 过滤、组合过滤、排序、分组
- **signal-nav.test.ts** (1 test): 链接渲染和 active 状态

---

### 代码质量

| 指标 | 结果 |
|------|------|
| 文件行数 | 全部低于 200 行警戒线 ✅ |
| TypeScript | 无 `any`，接口定义完整 ✅ |
| 关注点分离 | API → View Logic → Components 三层清晰 ✅ |
| 可访问性 | aria-label, aria-current ✅ |
| 响应式 | grid + breakpoints ✅ |
| 设计系统 | 复用猫猫 CSS variables ✅ |

---

### P3 观察（不阻塞）

1. **`formatDate` 重复**: `SignalArticleList.tsx` 和 `SignalArticleDetail.tsx` 各自定义了 `formatDate`，格式略有不同（一个有 year 一个没有）。可以考虑提取到 `signals-view.ts` 作为共享 helper，但不阻塞。

2. **`setAllEnabled` 串行**: `SignalSourcesView.tsx:51-55` 逐个 await toggle，50+ 源会比较慢。v1 可接受，后续可考虑批量 API 或 `Promise.all`。

3. **正文渲染**: `SignalArticleDetail.tsx:62` 用 `<p>` + `whitespace-pre-wrap` 渲染正文。如果正文是 Markdown 格式，不会渲染标题/列表等。后续可考虑接入 `MarkdownContent` 组件（项目里已有）。

---

### 独立验证

```
pnpm --filter @cat-cafe/shared build  ✅
pnpm --filter @cat-cafe/web build     ✅ (signals 页面含在 build 输出中)
pnpm --filter @cat-cafe/web test      ✅ (61 files, 405 passed, 0 failed)
```

---

### 结论

**放行，0 P1/P2，3 P3（均不阻塞）。**

S7 前端 UI 完整覆盖了 Inbox 浏览和信源管理两个核心场景，铲屎官不用再手编辑 yaml 了。代码架构清晰，组件拆分合理，测试覆盖到位。

砚砚可以提交 + push，然后等铲屎官通知 cloud review 结果继续推进。
