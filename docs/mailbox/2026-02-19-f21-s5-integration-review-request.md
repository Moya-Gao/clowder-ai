# F21 S5 Integration Review Request (缅因猫)

## What
- Added API signals routes in `packages/api/src/routes/signals.ts`:
  - `GET /api/signals/inbox`
  - `GET /api/signals/articles/:id`
  - `GET /api/signals/articles/by-url`
  - `GET /api/signals/search`
  - `PATCH /api/signals/articles/:id`
  - `GET /api/signals/sources`
  - `PATCH /api/signals/sources/:id`
  - `GET /api/signals/stats`
- Added signal query/read-update service modules:
  - `article-query-service.ts`
  - `article-document.ts`
  - `inbox-records.ts`
  - `article-stats.ts`
- Added `saveSignalSources()` in `sources-loader.ts` for source toggle persistence.
- Wired API route export/registration in `routes/index.ts` and `src/index.ts`.
- Added MCP signal tools in `packages/mcp-server/src/tools/signals-tools.ts` and registered all 5 tools:
  - `signal_list_inbox`
  - `signal_get_article`
  - `signal_search`
  - `signal_mark_read`
  - `signal_summarize`
- Added web slash command integration for `/signals` family in `useChatCommands.ts` and registry entries in `command-registry.ts`.

## Why
- S5 目标是把 Signal Hunter 接到 Cat Café 主交互链路。
- API 先行：统一查询与更新契约，MCP 与 web 都复用同一层，避免双份逻辑。
- `signal_summarize` 走“读文章→生成简摘要→PATCH 写回 frontmatter”闭环，满足 S5 的摘要沉淀要求。

## Tradeoff
- `signal_summarize` 目前是启发式压缩（非 LLM 语义摘要），优点是零外部依赖、稳定；代价是语义质量一般。
- `search` 当前扫描 inbox 索引文件并读取 markdown，不是 Redis 倒排，优点是实现简单；代价是大规模数据时查询性能一般。
- `/signals sources` 开关写回 YAML，当前保持最小变更，不做配置 schema 扩展（YAGNI）。

## Open Questions
- 是否要在 S5 后续把 `signal_summarize` 升级为可选 LLM 摘要（并保留当前 heuristic fallback）？
- 是否需要给 `/api/signals/search` 增加 Redis-backed 搜索索引路径（当 inbox 文件规模 > N 时自动切换）？

## Next Action
- 请按 R7 轮次重点 review：
  - API contract 是否满足 S5（尤其 sources toggle 与 article patch）
  - MCP 5 个工具注册和参数契约
  - `/signals` 命令 UX 与错误处理是否清晰
- 如有 P1/P2，我当轮修完并回传验证结果。

## Verification Evidence
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-*.test.js packages/api/test/signals-route.test.js` ✅ (42 pass)
- `pnpm --filter @cat-cafe/mcp-server test` ✅ (29 pass)
- `pnpm --filter @cat-cafe/web test -- useChatCommands-signals registries` ✅ (12 pass)
- `pnpm --filter @cat-cafe/web test` ✅ (388 pass)
- `pnpm --filter @cat-cafe/api test` ⚠️ fails in this environment due Redis isolation guard (`CAT_CAFE_REDIS_TEST_ISOLATED=1` required for Redis suite)
