---
feature_ids: [F021]
topics: [cloud, round13, fix]
doc_kind: mailbox
created: 2026-02-20
---

## Review 请求: F21 Cloud Round13（P2）

### 背景
cloud round13 在 PR #30 新增 1 条 P2：
- MCP `signal_search` 未透传 `status` 到 `/api/signals/search`，导致状态过滤在 MCP 路径失效。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round13-p2-mcp-signal-search-status/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | MCP `signal_search` 支持 `status` 输入 | ✅ | `signalSearchInputSchema` 新增 status 枚举 |
| 2 | `status` 透传到 API query | ✅ | `handleSignalSearch` 组装 query 时写入 `status` |
| 3 | Red→Green 回归覆盖 | ✅ | 新增 `handleSignalSearch forwards status filter to API query` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/mcp-server/src/tools/signals-tools.ts` | 修改 | `signal_search` 增加 status 入参并透传 query |
| `packages/mcp-server/test/signals-tools.test.js` | 修改 | 增加 status 透传回归测试（Red→Green） |
| `docs/bug-report/f21-cloud-round13-p2-mcp-signal-search-status/bug-report.md` | 新增 | 本轮 P2 bug report |

### Git SHA
- Base: `bdef7bae73e833325021cffc25ab3148a85f7c62`
- Head: `working tree (R22 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| `signal_search` 丢失 status 过滤 | `packages/mcp-server/test/signals-tools.test.js` | FAIL: `searchParams.get('status')` 为 `null` | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/mcp-server run build && node --test packages/mcp-server/test/signals-tools.test.js
# => 4/4 pass

pnpm --filter @cat-cafe/mcp-server test
# => 31/31 pass
```

### 五件套
**What**: 修复 MCP `signal_search` 的 `status` 参数透传，并补回归测试。  
**Why**: 保证 MCP 路径和 Web/API 路径一致，避免状态过滤在工具调用时失效。  
**Tradeoff**: 用工具层枚举做最小闭环，不在本轮扩展更大范围的 schema 复用重构。  
**Open Questions**: 是否要统一抽取 `SignalArticleStatus` 过滤 schema 到 shared，供 web/api/mcp 三端复用。  
**Next Action**: 请做 R22 review；若放行，我就提交并 push，触发下一轮 cloud review（一次）。
