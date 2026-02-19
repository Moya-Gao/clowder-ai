# R21 确认: Cloud Round12 修复 (2×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

本轮增加了对抗式审查（铲屎官要求），主动检查了非修复范围内的潜在隐患，未发现额外 P1/P2。

## 逐项审查

### P2-A: 搜索 status 未透传到后端（客户端 limit 后过滤丢数据）

| 项目 | 结果 |
|------|------|
| 修复链路 | `SignalInboxView.tsx` → `signals-api.ts` → `signals.ts` → `article-query-service.ts` (4 文件) |
| 根因 | `handleSearchSubmit` 只传 source/tier 到 `searchSignals`，不传 status → 服务端返回 limit=80 不分 status → 客户端再 filter 会丢数据 |
| 修复方式 | 前端新增 `toSignalStatus()` 白名单收口 → `searchSignals` 加 `status` 参数 → 路由 schema 用 `SignalArticleStatusSchema` 校验 → service `search()` 加 status filter |
| 类型安全 | 前端 `toSignalStatus` switch 白名单（不接受 'all'）→ API 层 Zod schema 校验 → 非法值 400 |
| 对抗性检查 | `status='all'` → `toSignalStatus` 返回 undefined → 不过滤 ✅；客户端 `filteredItems` 双重过滤冗余但无害 ✅ |
| 测试覆盖 | web: form 提交断言 `searchSignals` 含 `status: 'read'`；api-util: URL 编码 `status=read`；api-route: PATCH→search status=read 断言 total=1 |
| 判定 | ✅ 通过 |

### P2-B: `dateTo=YYYY-MM-DD` 被当作当天零点，排除当天所有文章

| 项目 | 结果 |
|------|------|
| 修复文件 | `article-query-service.ts` L41-72 |
| 根因 | `Date.parse('YYYY-MM-DD')` 返回 UTC 午夜零点 → `<=` 比较排除当天所有文章 |
| 修复方式 | 新增 `toDateBound(value, fallback, mode)` 工具函数：当 `mode='end'` 且输入匹配 `ISO_DAY_PATTERN` 时，加 `DAY_IN_MS - 1` (23:59:59.999) |
| 时区一致性 | `Date.parse('YYYY-MM-DD')` → UTC midnight；`fetchedAt` 也是 ISO UTC → 比较双方同时区，无漂移 |
| 精度边界 | 23:59:59.999 → `2026-02-20T00:00:00.000Z` 不被 `dateTo='2026-02-19'` 包含（下一天）✅ |
| dateFrom 不扩展 | `mode='start'` 直接用 `Date.parse` 结果（午夜零点 = 当天起点）✅ |
| 带时间的 dateTo | `dateTo='2026-02-19T12:00:00Z'` → `ISO_DAY_PATTERN` 不匹配 → 不扩展 → 返回原始 parse 结果 ✅ |
| 无效日期兜底 | NaN → fallback `+Infinity` → 等于无上界 → 不过滤（与已有行为一致）✅ |
| 测试覆盖 | api-route: `dateTo=${today}` 断言 total=2（含当天文章）|
| 判定 | ✅ 通过 |

## 对抗式审查补充

本轮额外检查了以下方向（非本次 P2 修复范围）：

| 检查点 | 结论 |
|--------|------|
| `requireIdentity` 401 响应模式 | 正确（Fastify reply.status + return body） |
| `toSignalTier` 类型安全 | schema z.enum 保证输入范围，cast 安全 |
| `params.id` 类型断言 | 路由 `:id` 保证存在，`.trim()` 兜底 |
| `filePath` 字段暴露 | 单用户项目可接受，多用户时需移除（P3 级别备注） |
| `dateFrom/dateTo` 无格式约束 | `z.string().optional()` 接受任意字符串，`toDateBound` graceful fallback |

**未发现额外 P1/P2。**

## 构建 & 测试

```bash
# Build (all clean)
pnpm --filter @cat-cafe/shared build    # ✅
pnpm --filter @cat-cafe/api build       # ✅
pnpm --filter @cat-cafe/web build       # ✅

# API signal tests (8 suites)
node --test test/signal-*.test.js test/signals-*.test.js
# 50 passed, 0 failed ✅

# Web tests
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts src/utils/__tests__/signals-api.test.ts
# 6 passed, 0 failed ✅
```

## Git SHA

- Base: `8bb6187` (R20 confirmation)
- Head: `c154a14` (R21 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R21 by 布偶猫🐾（含对抗式审查）— 2026-02-20*
