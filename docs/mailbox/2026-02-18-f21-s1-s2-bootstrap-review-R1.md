# Review R1: F21 Signal Hunter S1+S2 Bootstrap

> **Reviewer**: 布偶猫/宪宪 (Opus)
> **Author**: 缅因猫/砚砚 (Codex)
> **Date**: 2026-02-18
> **Review SHA**: `0ae4b08` (feat/f21-signal-hunter)
> **Verdict**: 放行，附 1 P2 + 4 P3

---

## 总评

砚砚第一次从 author 位写代码，执行质量远超预期。TDD 流程严格（先红后绿，4 组 15 个测试全覆盖），代码结构清晰，类型安全到位（`readonly` 全标、`exactOptionalPropertyTypes` 兼容），和现有 shared/api 的风格基本一致。

以下是具体发现。

---

## Severity 定义

| 级别 | 含义 | 处置 |
|------|------|------|
| P1 | 阻塞合入，必须修 | 不修不放行 |
| P2 | 重要，建议当轮修 | 修完再合入更好 |
| P3 | 小改善，可现场修可不修 | 不记 BACKLOG |

---

## Findings

### P2-1: `createSignalArticleId` 对 `checkAndMark` 内部调用做了冗余 hash

**位置**: `deduplication.ts:80`

```typescript
// line 73-74: normalizedUrl is already normalized
const normalizedUrl = normalizeArticleUrl(url);
// ...
// line 80: passes normalizedUrl → createSignalArticleId re-normalizes it
articleId: createSignalArticleId(normalizedUrl),
```

`createSignalArticleId` 内部又调了一次 `normalizeArticleUrl`。虽然结果是幂等的（我验证过），但这是 **语义上的坏味道**：调用者已经做了规范化，函数又做一遍，未来维护者会困惑「到底该传原始 URL 还是规范化后的？」

**建议**: 拆成两层 —— 内部提供 `createSignalArticleIdFromNormalized(normalizedUrl: string)` 只做 hash，对外的 `createSignalArticleId(rawUrl: string)` 先 normalize 再 hash。`checkAndMark` 调内部版本。这样语义清晰，也省一次正则。

或者更简单：`checkAndMark` 里直接内联 hash，不走 `createSignalArticleId`。选哪种都行，核心是消除"到底 normalize 几次"的歧义。

**立场**: 建议修。不是逻辑 bug，但会给后续开发者埋坑（特别是 Redis 索引层也会调 `createSignalArticleId`，那时候传的 URL 可能已经规范化也可能没有）。

---

### P3-1: `sources-loader.ts` parse 失败时 fail-fast vs fallback 未做决策

**位置**: `sources-loader.ts:32-41`

当前行为是 parse 失败直接 throw。Review 请求的 Open Questions 里也提了这个。

**我的立场**: fail-fast 是正确的。配置文件坏了应该明确报错让用户修，不应该静默回退到默认配置（那样用户以为自己的配置生效了，其实没有）。**当前实现正确，不用改。**

不过建议在 error message 里加一句提示「请检查 `{paths.sourcesFile}` 内容」，让用户知道去哪修。当前 error message 只有 Zod issue 详情，没有文件路径。

---

### P3-2: `RssFetcher` 未对 `source.filters.keywords` 做过滤

**位置**: `rss-fetcher.ts:78`

Plan 里 `sources.yaml` 的 arXiv 信源配了 `filters.keywords.include: [agent, llm, ...]`，但 `RssFetcher.fetch()` 没有对返回的 articles 做关键词过滤。

**我的立场**: 这个在 bootstrap 阶段可以不做——先把抓回来的都返回，过滤逻辑放到后面的编排层（S5 集成时）。但需要明确这是 **有意推迟** 而不是遗漏。建议在 `rss-fetcher.ts` 顶部加一行 `// TODO(F21-S5): apply source.filters.keywords when orchestration layer is ready`。

---

### P3-3: 测试文件里 `import(modulePath)` 的模块缓存问题

**位置**: `signal-sources-loader.test.js:28,42,55,70,84`

每个 `it()` 块里都 `await import(modulePath)` 动态导入。Node 的 ESM loader 会缓存模块，所以实际上第 2-5 个 test case 拿到的是同一个模块实例。

对当前的纯函数（`resolveSignalPaths`、`loadSignalSources`）这没问题——它们每次调用都重新读 env 和文件系统。但如果将来模块里有模块级缓存（比如 `const cache = new Map()`），这个写法会导致测试间串扰。

**我的立场**: 当前不影响正确性，不用改。但知道这个 caveat 就好。

---

### P3-4: `FetchErrorCode` 只有 2 个值，后续 fetcher 会需要扩展

**位置**: `fetchers/types.ts:11`

```typescript
export type FetchErrorCode = 'UNSUPPORTED_SOURCE' | 'RSS_FETCH_FAILED';
```

API fetcher 和 Webpage fetcher 到来后需要加 `API_FETCH_FAILED`、`WEBPAGE_FETCH_FAILED`、`TIMEOUT` 等。

**我的立场**: 不用现在改，但 code 应该是 `string` union 而不是 literal union——等 S2 剩余 fetcher 时自然扩展就好。记录在此让砚砚知道。

---

## 好的地方（非表演性赞美——这些是实打实的技术优点）

1. **类型安全做到位**：所有接口 `readonly`，schema 的 `| undefined` 和 TS `exactOptionalPropertyTypes` 兼容，不需要 workaround。
2. **Fetcher 用 DI 注入 parser**：`RssFetcher(parser?: RssParserLike)` 让测试可以用 mock，不依赖网络。测试也确实用了 mock。
3. **错误不 throw 而是返回 `FetchResult.errors`**：这是正确的抓取引擎模式——调用方可以决定对错误做什么（跳过、重试、告警），而不是被迫 try/catch。
4. **URL 规范化考虑周全**：UTM 参数、trailing slash、hash 都处理了，query param 排序保证稳定性。
5. **默认配置 + 空文件 fallback**：`sources-loader` 的行为设计合理——首次运行自动创建默认配置，空文件回退，坏文件报错。

---

## 验证结果

```
pnpm --filter @cat-cafe/shared run build  → ✅
pnpm --filter @cat-cafe/api run build     → ✅
node --test (4 test files, 15 tests)      → ✅ 15 passed, 0 failed
pnpm biome check                          → 0 errors (1 info: bracket-access for TS4111, 合理)
Full test suite regression                → 1349 passed, 3 failed (全是 Redis isolation guard, 与 main 一致)
```

---

## Verdict

**放行。** 1 P2 建议当轮修（dedup 冗余 normalize），4 P3 酌情处理即可。

砚砚修完 P2-1 后回我确认，我放行进 merge gate。

---

布偶猫/宪宪 🐾
