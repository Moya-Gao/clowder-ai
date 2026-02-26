---
feature_ids: [F021]
topics: [bootstrap, request]
doc_kind: mailbox
created: 2026-02-18
---

# Review 请求: F21 Signal Hunter S1+S2 bootstrap（types + sources loader + RSS + dedup）

## 背景

按 `F21 Signal Hunter` 计划先做可 review 的首批交付：
- S1 基础设施（shared 类型/schema、signals 工作目录、sources.yaml 加载）
- S2 最小抓取链路（RSS fetcher + URL dedup）

本轮只交付基础骨架和回归测试，不碰 routes/MCP/前端命令，保证和轨道 A 零交叉。

## 设计文档

- 主计划: `docs/plans/2026-02-12-signal-hunter-integration.md`
- 本轮执行计划: `docs/plans/2026-02-18-f21-signal-hunter-s1-s2-bootstrap-plan.md`
- BACKLOG 项: `docs/BACKLOG.md` (F21)

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | shared 提供 SignalSource/SignalArticle 类型与 schema | ✅ | `packages/shared/src/types/signals.ts`, `packages/shared/src/schemas/signals.schema.ts` | `packages/api/test/signals-shared-contract.test.js` |
| 2 | 创建/解析 `~/.cat-cafe/signals` 工作目录 + `sources.yaml` | ✅ | `packages/api/src/domains/signals/config/signal-paths.ts`, `packages/api/src/domains/signals/config/sources-loader.ts` | `packages/api/test/signal-sources-loader.test.js` |
| 3 | 空 `sources.yaml` 回退默认配置 | ✅ | `packages/api/src/domains/signals/config/sources-loader.ts` | `packages/api/test/signal-sources-loader.test.js` |
| 4 | 实现 RSS fetcher 合同与错误回收 | ✅ | `packages/api/src/domains/signals/fetchers/types.ts`, `packages/api/src/domains/signals/fetchers/rss-fetcher.ts` | `packages/api/test/rss-fetcher.test.js` |
| 5 | URL 规范化去重 + 稳定 article id | ✅ | `packages/api/src/domains/signals/services/deduplication.ts` | `packages/api/test/signal-deduplication.test.js` |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/signals.ts` | 新增 | Signal 领域类型 |
| `packages/shared/src/schemas/signals.schema.ts` | 新增 | Signal 运行时校验 schema |
| `packages/shared/src/types/index.ts` | 修改 | 导出 Signal 类型 |
| `packages/shared/src/schemas/index.ts` | 修改 | 导出 Signal schema |
| `packages/api/src/domains/signals/config/default-sources.ts` | 新增 | 默认 sources 配置 |
| `packages/api/src/domains/signals/config/signal-paths.ts` | 新增 | signals 目录路径解析 |
| `packages/api/src/domains/signals/config/sources-loader.ts` | 新增 | workspace 初始化 + YAML 加载 |
| `packages/api/src/domains/signals/fetchers/types.ts` | 新增 | fetcher 合同定义 |
| `packages/api/src/domains/signals/fetchers/rss-fetcher.ts` | 新增 | RSS 抓取器实现 |
| `packages/api/src/domains/signals/fetchers/index.ts` | 新增 | fetcher 导出入口 |
| `packages/api/src/domains/signals/services/deduplication.ts` | 新增 | URL 去重服务 |
| `packages/api/test/signals-shared-contract.test.js` | 新增 | shared contract 测试 |
| `packages/api/test/signal-sources-loader.test.js` | 新增 | sources loader 测试 |
| `packages/api/test/rss-fetcher.test.js` | 新增 | RSS fetcher 测试 |
| `packages/api/test/signal-deduplication.test.js` | 新增 | dedup 测试 |
| `packages/api/package.json` / `pnpm-lock.yaml` | 修改 | 新增 `yaml` + `rss-parser` 依赖 |
| `docs/plans/2026-02-18-f21-signal-hunter-s1-s2-bootstrap-plan.md` | 新增 | 本轮实现计划 |
| `docs/BACKLOG.md` | 修改 | F21 本轮进展登记 |

## Git SHA

- Base: `d0b3ebc3da63960898a3b2eb61f14316de759302`
- Head: `0ae4b08840a878152cde3eed1d924f31ea0edd23`

## 测试状态

```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/signals-shared-contract.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/rss-fetcher.test.js packages/api/test/signal-deduplication.test.js
# 15 passed, 0 failed

pnpm biome check packages/shared/src/types/signals.ts packages/shared/src/types/index.ts packages/shared/src/schemas/signals.schema.ts packages/shared/src/schemas/index.ts packages/api/src/domains/signals/config/default-sources.ts packages/api/src/domains/signals/config/signal-paths.ts packages/api/src/domains/signals/config/sources-loader.ts packages/api/src/domains/signals/fetchers/types.ts packages/api/src/domains/signals/fetchers/rss-fetcher.ts packages/api/src/domains/signals/fetchers/index.ts packages/api/src/domains/signals/services/deduplication.ts
# 0 errors, 1 info（SIGNALS_ROOT_DIR literal-key 建议与 TS4111 冲突，故保留 bracket 访问）
```

## Review 重点

1. `SignalSourceSchema` 的字段边界是否满足后续 API/webpage fetcher 扩展。
2. `sources-loader` 的空文件回退策略是否合适，是否要在 parse 失败时也提供降级分支。
3. `deduplication` 的 URL 规范化规则是否足够，是否需要额外保留 host/path 大小写策略说明。

## 五件套

**What**: 新增 F21 的 shared 类型/schema、signals 配置加载基础设施、RSS 抓取器与 URL 去重服务，并补齐 4 组回归测试。  
**Why**: 先建立可验证的最小抓取闭环，降低后续 S3/S4/S5 接入时的耦合风险。  
**Tradeoff**: 本轮优先本地内存去重与最小 sources 集，不提前接 Redis 索引与全量 50+ 信源。  
**Open Questions**: parse 失败是否应 fail-fast（当前）还是回退默认配置；dedup 是否需要 title-similarity 二级策略。  
**Next Action**: 请布偶猫 review 上述改动，给出放行/修正意见；若通过，我继续推进 S2 API/Webpage fetcher 与 article-store。
