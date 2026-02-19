## Review 请求: F21 Cloud Round12（2×P2）

### 背景
cloud round12 在 PR #30（base `8bb6187`）新增 2 条 P2：
1. 搜索提交未透传 `status` 到后端，`limit=80` 后客户端再过滤会丢数据。
2. `dateTo=YYYY-MM-DD` 被当作当天 00:00，导致当天文章被排除。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round12-p2-status-date-boundary/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 搜索 status 过滤端到端生效 | ✅ | `SignalInboxView` → `signals-api` → route schema → query service 全链路透传与执行 |
| 2 | `dateTo` 按当日包含处理 | ✅ | `YYYY-MM-DD` 上界扩展到 `23:59:59.999` |
| 3 | Red→Green 回归覆盖 | ✅ | web + api 集成测试先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/web/src/components/signals/SignalInboxView.tsx` | 修改 | 表单搜索透传 `status`，并对 status 值做类型收口 |
| `packages/web/src/utils/signals-api.ts` | 修改 | 搜索接口增加 `status` query 参数 |
| `packages/api/src/routes/signals.ts` | 修改 | `search` query schema 支持 `status` 并透传 service |
| `packages/api/src/domains/signals/services/article-query-service.ts` | 修改 | 搜索增加 status 过滤；`dateTo` 当日上界修正 |
| `packages/web/src/components/__tests__/signal-inbox-view.test.ts` | 修改 | 增加 status 透传断言 |
| `packages/web/src/utils/__tests__/signals-api.test.ts` | 修改 | 断言 `status` 被编码到 query |
| `packages/api/test/signals-route.test.js` | 修改 | 新增 status 过滤与 dateTo 当日包含两个集成测试 |
| `docs/bug-report/f21-cloud-round12-p2-status-date-boundary/bug-report.md` | 新增 | round12 双 P2 bug report |

### Git SHA
- Base: `8bb61872710c55ae09de1af33f0866b2cae99ac7`
- Head: `working tree (R21 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| status 未透传 | `packages/web/src/components/__tests__/signal-inbox-view.test.ts` | FAIL: `searchSignals` 参数缺少 `status` | PASS |
| status 后端未过滤 | `packages/api/test/signals-route.test.js` | FAIL: 期望 `1` 实际 `2` | PASS |
| dateTo 当日排除 | `packages/api/test/signals-route.test.js` | FAIL: 期望 `2` 实际 `0` | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts src/utils/__tests__/signals-api.test.ts
# => 6/6 pass

pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# => 14/14 pass

pnpm --filter @cat-cafe/web run build
# => build success（仅既有 lint warnings）
```

### 五件套
**What**: 修复 round12 两个 P2：搜索 status 透传与服务端过滤、`dateTo` 当日边界包含；并补齐回归测试。  
**Why**: 防止搜索结果因客户端后过滤产生截断漏项，且确保日期上界语义与用户预期一致。  
**Tradeoff**: 采用最小改动补齐现有链路与日期边界逻辑，不引入额外日期库或重构搜索架构。  
**Open Questions**: 后续是否需要把 `dateFrom/dateTo` 格式严格收敛为 `YYYY-MM-DD`（当前仍允许可解析时间串）。  
**Next Action**: 请做 R21 review；若放行，我就提交并 push，触发下一轮 cloud review（一次）。
