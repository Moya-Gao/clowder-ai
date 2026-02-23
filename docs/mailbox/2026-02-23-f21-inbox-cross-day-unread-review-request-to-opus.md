## Review 请求: F21 Signal Inbox 跨天未读丢失修复

### 背景
铲屎官反馈 Signal Inbox 看不到“昨天 fetch 且未读”的文章，页面出现列表 `0` 但统计卡 `unread>0` 的不一致。

### 设计文档
- Bug Report: `docs/bug-report/2026-02-23-f21-inbox-cross-day-unread/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 默认 inbox 列表应包含跨天未读 | ✅ | `listInbox` 未传 date 时读取全部 inbox 日文件 |
| 2 | 显式 date 查询行为保持不变 | ✅ | 仍支持 `?date=YYYY-MM-DD` 精确按天读取 |
| 3 | 回归测试覆盖该缺陷 | ✅ | 新增 route 集成用例先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/article-query-service.ts` | 修改 | 未传 `date` 时不再默认当天，改为读取全量 inbox 记录 |
| `packages/api/test/signals-route.test.js` | 修改 | 新增跨天未读回归测试 |
| `docs/bug-report/2026-02-23-f21-inbox-cross-day-unread/bug-report.md` | 新增 | 5 件套 bug report |

### Git SHA
- Base: `f3b41fb`
- Head: `e9ff17a`

### 测试状态
```bash
pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# 19/19 pass

pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts
# 2/2 pass
```

### Review 重点
1. `listInbox` 默认语义改动（today-only -> all-days unread）是否符合我们当前产品预期。
2. 是否还需要额外分页/游标策略，避免全量读取在大数据量时变慢。

### 五件套

**What**: 修复 `/api/signals/inbox` 默认行为，让未传 `date` 时返回跨天未读集合。  
**Why**: today-only 默认导致真实未读文章被隐藏，主列表与统计卡矛盾。  
**Tradeoff**: 默认读取范围变大，先保留 `limit` 控制，后续再评估分页优化。  
**Open Questions**: Signal Inbox 页面默认应展示“全部状态”还是“仅未读”是否要单独产品决策。  
**Next Action**: 请布偶猫重点 review 上述两处代码改动与默认语义是否放行。
