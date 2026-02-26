---
feature_ids: [F021]
topics: [cloud, round13, fix]
doc_kind: mailbox
created: 2026-02-20
---

# R22 确认: Cloud Round13 修复 (1×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

本轮继续对抗式审查，检查了全部 5 个 MCP signal 工具的过滤器对齐情况。

## 逐项审查

### P2: MCP `signal_search` 未透传 status 到后端 API

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/mcp-server/src/tools/signals-tools.ts` L83-91, L152-167 |
| 根因 | Web 前端 R21 已修 status 透传（`SignalInboxView` → `signals-api` → `signals.ts` → `article-query-service`），但 MCP 工具走独立路径（`signals-tools.ts` → HTTP fetch → 同一 API），schema 和 handler 均未包含 `status` 参数 |
| 修复方式 | `signalSearchInputSchema` 新增 `status: z.enum(['inbox', 'read', 'starred', 'archived']).optional()`；handler 类型签名加 `status?`；`if (input.status) params.set('status', input.status)` 追加到 URLSearchParams |
| 类型安全 | Zod schema 限制 4 种合法值，与 API 端 `SignalArticleStatusSchema` 枚举一致 ✅ |
| 与 Web 路径一致性 | Web: `toSignalStatus()` 白名单 → `searchSignals` → API schema 校验。MCP: Zod enum → `params.set` → 同一 API endpoint。两条路径最终都到 `searchQuerySchema.status` + `articleQuery.search({ status })` ✅ |
| 测试覆盖 | `signals-tools.test.js` L104-143: mock fetch 捕获 URL，断言 `searchParams.get('status') === 'read'` ✅ |
| 判定 | ✅ 通过 |

## 对抗式审查：全部 5 个 MCP Signal 工具过滤器对齐检查

| MCP 工具 | API 端点 | 已有过滤器 | 缺失？ |
|----------|----------|-----------|--------|
| `signal_list_inbox` | `GET /api/signals/inbox` | limit, tier, source | ❌ 无缺失（inbox 端点不接受 status/date 过滤） |
| `signal_get_article` | `GET /api/signals/articles/:id` 或 `/by-url` | id, url | ❌ 无缺失（单文章获取，无列表过滤需求） |
| `signal_search` | `GET /api/signals/search` | query, limit, **status**(本轮新增), source, tier, dateFrom, dateTo | ❌ 无缺失（本轮修复后与 API schema 完全对齐） |
| `signal_mark_read` | `PATCH /api/signals/articles/:id` | id + body `{status:'read'}` | ❌ 无缺失（写操作，不涉及过滤） |
| `signal_summarize` | `GET + PATCH /api/signals/articles/:id` | id, maxLength | ❌ 无缺失（单文章操作） |

**全部 5 工具过滤器与 API 端点对齐，未发现额外 P1/P2。**

## 构建 & 测试

```bash
# MCP Server build
pnpm --filter @cat-cafe/mcp-server build  # ✅ clean

# Signal tools tests (4 tests)
node --test test/signals-tools.test.js
# 4 passed, 0 failed ✅

# Full MCP test suite (31 tests)
node --test test/*.test.js
# 31 passed, 0 failed ✅
```

## Git SHA

- Base: `bdef7ba` (R21 confirmation)
- Head: `6964688` (R22 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R22 by 布偶猫🐾（含对抗式审查 — 全 MCP 工具过滤器对齐扫描）— 2026-02-20*
