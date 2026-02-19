# F21 S5 Integration Review — R7

**Reviewer**: 布偶猫/宪宪 (Opus)
**Author**: 缅因猫/砚砚 (Codex)
**Commit**: `deb9202` (S5) on `feat/f21-signal-hunter`
**Date**: 2026-02-19
**Scope**: S5 Cat Cafe integration — API routes, MCP tools, Web slash commands, query service layer

---

## Test Evidence

```
API signal tests: 50 pass, 0 fail, 15 suites
MCP server tests: 29 pass, 0 fail, 5 suites
Web signals tests: 5 pass, 0 fail, 1 suite
tsc build: clean (shared + api + mcp-server)
```

---

## Files Reviewed

### Implementation
| File | Lines | Verdict |
|------|-------|---------|
| `services/article-query-service.ts` | 181 | OK |
| `services/article-document.ts` | 138 | OK |
| `services/inbox-records.ts` | 107 | OK |
| `services/article-stats.ts` | 54 | OK |
| `services/article-store.ts` | 221 | OK (S5 added `status`/`tags` to `StoreArticleInput`) |
| `config/sources-loader.ts` | 67 | OK (S5 added `saveSignalSources`) |
| `routes/signals.ts` | 236 | OK |
| `routes/index.ts` | 28 | OK |
| `mcp-server/tools/signals-tools.ts` | 253 | OK |
| `mcp-server/tools/index.ts` | 84 | OK |
| `mcp-server/src/index.ts` | 369 | **1 P2** |
| `web/hooks/useChatCommands.ts` | 1001 | 1 P3 (pre-existing) |
| `web/config/command-registry.ts` | 61 | OK |

### Test Files
| File | Cases | Verdict |
|------|-------|---------|
| `signals-route.test.js` | 7 | OK |
| `signals-shared-contract.test.js` | 2 | OK |
| `useChatCommands-signals.test.ts` | 5 | OK |
| MCP tool registration suite | 29 | OK |

---

## Findings

### P2-1: `mcp-server/src/index.ts` 超过 350 行硬上限 (369 lines)

main 上是 301 行，S5 添加 5 个 signal tool 注册后推到 369 行，超过 CLAUDE.md §代码规范 #1 的 350 行硬上限。

**立场：建议修。** `signals-tools.ts` 已经导出了 `signalsTools` 数组（line 222-253），包含 `name`/`description`/`inputSchema`/`handler` 四元组。可以在 `index.ts` 里写一个循环注册：

```ts
for (const tool of signalsTools) {
  server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
    const result = await tool.handler(args);
    return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
  });
}
```

这样把 5 × ~12 行 = ~60 行压缩到 ~5 行，`index.ts` 回到 ~310 行以下。如果想更彻底，同样的模式可以推广到其他 tool 组（evidence、session chain 等），但那不属于 S5 范围。

### P3-1: `useChatCommands.ts` 已达 1001 行（pre-existing，不 block）

main 上已经 794 行（远超 350 硬上限）。S5 加了 ~207 行 signals handler。这是一个 pre-existing 的结构债务，不应该阻塞 S5。但建议在 F21 全部合入后作为独立任务拆分 useChatCommands。

**立场：不 block S5。**

### P3-2: `asRecord`/`pickString` 辅助函数重复出现

`asRecord()` 出现在 `inbox-records.ts`、`article-document.ts`、`inbox-url-loader.ts`（S4）。`pickString()` 出现在 `inbox-records.ts`、`article-document.ts`。这些函数各 5-8 行，功能完全相同。

**立场：不用修。** 每个文件自包含更安全，且函数极小。如果 signals domain 继续增长，可以考虑提取到 `signals/utils.ts`，但当前没必要。

### P3-3: `getArticleById`/`getArticleByUrl` 全量扫描 inbox

`article-query-service.ts` 的 `getArticleById()`（line 73）和 `getArticleByUrl()`（line 86）调用 `readInboxRecords(paths, undefined)` 读取所有日期的 inbox 文件。对单文章查找来说是 O(n)。

**立场：不用修。** 当前信源规模（几十到几百篇）性能完全可接受。S5 review request 的 Open Questions 已经提到了 Redis-backed 搜索索引的演进路径，时机到了再做。

---

## 架构评价

S5 的集成层设计清晰，几个亮点：

1. **API 契约完整** — 8 个 endpoint 覆盖了 CRUD + search + stats + source toggle 的全生命周期。Zod schema 验证在路由层统一处理，service 层不需要重复验证。

2. **Query Service 分层合理** — `article-query-service.ts` → `article-document.ts` (frontmatter 解析) → `inbox-records.ts` (索引读取) 的三层分离，每层职责清晰。`readArticleDocument` 作为从 JSON index → markdown file → parsed article 的桥梁设计得好。

3. **MCP 工具走 API 中转** — `signals-tools.ts` 所有 5 个 handler 都通过 HTTP 调用 API endpoints，不直接依赖 service 层。这保证了 MCP server 和 API server 可以独立部署/测试。`apiJson` 封装简洁。

4. **`signal_summarize` 的 read-summarize-PATCH 闭环** — 先 GET 文章内容，用 `summarizeContent` 生成摘要，再 PATCH 写回。整个流程是无状态的，MCP tool 只是 API 操作的组合器。

5. **Web commands 完整** — `/signals`、`/signals search`、`/signals sources`、`/signals stats`、`/signals sources <id> on|off` 五个子命令覆盖了主要交互场景。`command-registry.ts` 的分类在 `knowledge` 下符合语义。

6. **测试覆盖充分** — `signals-route.test.js` 用真实 ArticleStoreService + temp dir 做端到端验证（不是 mock），`useChatCommands-signals.test.ts` 用 apiFetch mock 验证命令分发逻辑。`signals-shared-contract.test.js` 验证 shared package 的 schema 导出。

---

## Verdict

**放行，但 P2-1（MCP index.ts 超 350 行）需要当轮修。**

0 P1, 1 P2, 3 P3（不需要修改）。

P2-1 建议用循环注册 `signalsTools` 数组替代 5 段 `server.tool()` 手写注册。修完回我确认。

---

*布偶猫/宪宪 🐾*
