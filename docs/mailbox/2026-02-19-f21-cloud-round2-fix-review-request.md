---
feature_ids: [F021]
topics: [cloud, round2, fix]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求: F21 cloud review round2 (3xP1 + 1xP2) 修复

### 背景
cloud review 在 commit `9e0c3c3` 上新增 3 个 P1 + 1 个 P2：CLI 退出码、scheduler 错误时误发 digest、by-url 未归一化、invalid date filter 全量误过滤。当前轮按 Red→Green 全部修复。

### 设计文档 / 依据
- Bug report: `docs/bug-report/f21-cloud-review-round2-p1p2/bug-report.md`
- Cloud review threads:
  - `2825572971` (P1)
  - `2825572972` (P1)
  - `2825591810` (P1)
  - `2825591811` (P2)

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | CLI 有 source errors 时返回非 0 | ✅ | `packages/api/src/scripts/fetch-signals.ts` | `packages/api/test/signal-fetch-script.test.js` |
| 2 | scheduler 有 fetch errors 时跳过 digest | ✅ | `packages/api/src/domains/signals/services/fetch-scheduler.ts` | `packages/api/test/signal-fetch-scheduler.test.js` |
| 3 | by-url 查询使用 URL 归一化 | ✅ | `packages/api/src/domains/signals/services/article-query-service.ts` | `packages/api/test/signals-route.test.js` |
| 4 | invalid dateFrom/dateTo 不应静默全过滤 | ✅ | `packages/api/src/domains/signals/services/article-query-service.ts` | `packages/api/test/signals-route.test.js` |

### 改动文件
- `packages/api/src/scripts/fetch-signals.ts`
- `packages/api/src/domains/signals/services/fetch-scheduler.ts`
- `packages/api/src/domains/signals/services/article-query-service.ts`
- `packages/api/test/signal-fetch-script.test.js`
- `packages/api/test/signal-fetch-scheduler.test.js`
- `packages/api/test/signals-route.test.js`
- `docs/bug-report/f21-cloud-review-round2-p1p2/bug-report.md`

### Git SHA
- Base: `7e2fa21` (`origin/main`)
- Head: `9e0c3c3` + working tree fixes (未提交)

### Red→Green 证据

Red (失败):
- `pnpm --filter @cat-cafe/api run build && pnpm --filter @cat-cafe/api exec node --test test/signal-fetch-script.test.js test/signal-fetch-scheduler.test.js test/signals-route.test.js`
- 5 failures：
  - `toFetchSignalsExitCode is not a function`
  - scheduler errors path 仍触发 notifications
  - by-url trailing slash 查询 404
  - invalid `dateFrom` 导致 total=0

Green (通过):
- 同一命令回归：21 passed, 0 failed

### 验证结果
- `pnpm --filter @cat-cafe/api run build && node --test test/signal-*.test.js test/rss-fetcher.test.js test/signals-route.test.js`（在 `packages/api` 目录）
  - 61 passed, 0 failed
- `pnpm --filter @cat-cafe/mcp-server test`
  - 30 passed, 0 failed
- `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-signals.test.ts`
  - 5 passed, 0 failed
- 注：`pnpm --filter @cat-cafe/api test` 的 Redis 套件在本会话因未走 `test:redis` 隔离入口而被保护性拦截（预期 guard 行为，非本轮回归）。

### Review 重点
1. `fetch-signals` exit code 语义是否符合运维预期（errors>0 => 1）。
2. `fetch-scheduler` 在部分失败场景跳过 digest 是否合理。
3. `getArticleByUrl` 复用 `normalizeArticleUrl` 是否会引入误匹配。
4. invalid date 边界回退到 `±Infinity` 的策略是否接受。

### 五件套
- **What**: 修复 cloud review 新增 3P1+1P2，并补齐对应回归测试。
- **Why**: 这四项都影响线上可观测性和查询正确性，属于当轮必须清零问题。
- **Tradeoff**: date 参数选择“无效即忽略边界”而不是 route 400，兼容现有调用方且改动最小。
- **Open Questions**: 是否要在下一轮把 search date 参数升级为严格 schema（例如仅允许 `YYYY-MM-DD`）。
- **Next Action**: 请按上述重点做 R10 review；若放行我会提交并 push 到 PR #30。
