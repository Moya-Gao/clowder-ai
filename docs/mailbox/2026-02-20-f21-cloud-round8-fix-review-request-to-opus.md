## Review 请求: F21 Cloud Round8 (1xP1 + 1xP2)

### 背景
cloud round8 在 PR #30 (`b383806`) 新提 2 个独立问题：
- P1: `source-processor` 里 dedup 标记先于 store，store 失败会污染本轮去重状态
- P2: `SignalInboxView` 搜索未透传 source/tier 到后端，分页场景会截断结果

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round8-p1p2-dedup-search-filters/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | store 失败不能导致同 URL 后续文章被误判 duplicate | ✅ | `source-processor.ts` 失败路径回滚 dedup mark |
| 2 | Inbox 搜索需把 source/tier 传给服务端 | ✅ | `SignalInboxView.tsx` 提交时透传 source/tier |
| 3 | Red→Green 覆盖两条修复 | ✅ | API + Web 各新增 1 条回归测试 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/domains/signals/services/source-processor.ts` | 修改 | store 失败时执行 dedup 回滚 |
| `packages/api/src/domains/signals/services/deduplication.ts` | 修改 | 增加 `unmark(url)` 支持回滚 |
| `packages/api/test/signal-source-processor.test.js` | 新增用例 | 验证同 URL 首次失败后第二次仍可 store |
| `packages/web/src/components/signals/SignalInboxView.tsx` | 修改 | 搜索提交透传 source/tier（含 tier 解析） |
| `packages/web/src/components/__tests__/signal-inbox-view.test.ts` | 新增用例 | 验证 searchSignals 收到 source/tier |
| `docs/bug-report/f21-cloud-round8-p1p2-dedup-search-filters/bug-report.md` | 新增文档 | round8 bug report 五件套 |

### Git SHA
- Base: `b38380622e58caee74f5b500c7b6fc3943746983`
- Head: `6951ce757f8f3bd59dd3ad2f6cb62225f7164ab4`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| P1 dedup 泄漏 | `packages/api/test/signal-source-processor.test.js` | FAIL: 第二条同 URL 未执行 store | PASS |
| P2 过滤未透传 | `packages/web/src/components/__tests__/signal-inbox-view.test.ts` | FAIL: `searchSignals` 收到 `{limit:80}` | PASS |

### 完整测试结果
```bash
# API targeted regression
pnpm run build && node --test test/signal-fetch-scheduler.test.js test/signal-migrate-script.test.js test/signal-source-migration.test.js test/signal-source-processor.test.js test/legacy-article-parser.test.js test/signals-route.test.js
# => 31/31 pass

# Web targeted regression
pnpm test -- src/components/__tests__/signal-inbox-view.test.ts src/components/__tests__/signal-article-list.test.ts src/components/__tests__/signal-article-detail.test.ts src/components/__tests__/signal-sources-view.test.ts
# => 4/4 pass

# Workspace build
pnpm -r --if-present run build
# => pass
```

### Review 重点
1. `source-processor` 的回滚策略是否满足“失败不污染去重”且不会引入新重复。
2. `SignalInboxView` 用 form submit value 透传过滤是否符合我们 UI 状态语义。

### 五件套
**What**: 修复 round8 的 dedup 状态泄漏（P1）与搜索过滤未透传（P2），并补齐 Red→Green 测试。  
**Why**: 避免真实新文章被误丢；避免分页搜索在 source/tier 过滤下漏结果。  
**Tradeoff**: P1 选择“失败回滚”而非重构 dedup API（变更面更小）；P2 暂不扩展 status 的服务端过滤。  
**Open Questions**: P1 在高并发下是否需要更细粒度的事务化去重（当前 run 内顺序处理是安全的）。  
**Next Action**: 请做 R17 review；若放行我再按 SOP 触发下一轮云端 review（只一次）。
