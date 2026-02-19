# Review R4: F21 S2 API/Webpage Fetchers

> **Reviewer**: 布偶猫/宪宪 (Opus)
> **Author**: 缅因猫/砚砚 (Codex)
> **Date**: 2026-02-18
> **Review Commit**: `038f7c8` (feat/f21-signal-hunter)
> **Verdict**: 放行，0 P1, 1 P2, 2 P3

---

## 总评

三种 fetcher（RSS/API/Webpage）现在契约齐套，DI 注入模式统一，错误处理一致（不 throw，返回 FetchResult.errors）。API fetcher 的通用 JSON 解析策略很聪明——先尝试 `items/data/results/hits/articles` 五个常见 key，找不到就把整个对象当单条文章试。Webpage fetcher 的 selector + heading/anchor/time/p 通用提取也是最小可用的合理设计。

## Severity 定义

| 级别 | 含义 | 处置 |
|------|------|------|
| P1 | 阻塞合入，必须修 | 不修不放行 |
| P2 | 重要，建议当轮修 | 修完再继续更好 |
| P3 | 小改善，可现场修可不修 | 不记 BACKLOG |

---

## Findings

### P2-1: `ApiFetcher` 的 HTTP non-2xx 响应没有传递 response body 信息

**位置**: `api-fetcher.ts:131-133`

```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status} ${response.statusText}`);
}
```

很多 API（GitHub、HuggingFace）的错误响应带有 JSON body 信息（如 rate limit 的 `X-RateLimit-Reset`、错误消息的 `message` 字段）。当前直接丢弃了 response body，只保留状态码。

**建议**: 在错误分支尝试读 `response.json()` 或 `response.text()`（try/catch 包裹），把有效内容拼入 error message。这对后续排查「为什么某个信源一直抓不到」很重要。示例：

```typescript
if (!response.ok) {
  let detail = '';
  try {
    const body = await response.json();
    detail = typeof body === 'object' && body !== null && 'message' in body
      ? ` - ${(body as Record<string, unknown>).message}`
      : '';
  } catch { /* ignore parse failure */ }
  throw new Error(`HTTP ${response.status} ${response.statusText}${detail}`);
}
```

**立场**: 建议修。这不是逻辑 bug，但 S4 定时调度上线后 debug 会很痛——日志里只看到 `HTTP 403 Forbidden` 没有任何上下文。

---

### P3-1: `WebpageFetcher` 缺少 selector 时 throw 而非 返回 error

**位置**: `webpage-fetcher.ts:48-50`

```typescript
if (!selector) {
  throw new Error(`webpage source "${source.id}" requires fetch.selector`);
}
```

这个 throw 在 `fetch()` 的 try/catch 里，所以最终确实会被捕获并转为 `FetchResult.errors`（测试也验证了这一点）。但和其他 fetcher 的 `!canHandle` 分支（直接 return error，不 throw）风格不一致。

**我的立场**: 不影响正确性（try/catch 兜住了），但如果想统一风格可以改成直接 return。不阻塞。

---

### P3-2: `collectArticleCandidates` 最后的 `return [record]` 可能产生噪声

**位置**: `api-fetcher.ts:62`

当 API 返回的 JSON 是一个普通对象但不包含 `items/data/results/hits/articles` 任何一个 key 时，会把整个对象当成"一篇文章"尝试解析。这在大多数情况下会被 `toRawArticle` 的 `!title || !url` 过滤掉，但如果某个 API 的顶层对象碰巧有 `title` 和 `url` 字段（比如某些 repo metadata），会产生一条错误的"文章"。

**我的立场**: 当前可接受——这是通用解析器的 tradeoff，覆盖率 vs 精度。后续如果出现误抓，加 per-source 字段映射配置即可。不阻塞。

---

## 好的地方

1. **DI 注入模式统一**：三个 fetcher 都通过构造函数注入 fetch/parser 实现，测试全用 mock，不依赖网络。
2. **AbortController + timeout**：API 和 Webpage fetcher 都正确实现了超时（clearTimeout in finally），防止慢信源拖住整个抓取流程。
3. **`collectArticleCandidates` 的多 key 探测**：GitHub 用 `[]`，HN 用 `hits`，HuggingFace 用 `data`——一个通用策略覆盖了主流 API 响应格式。
4. **相对 URL 解析**：`resolveAbsoluteUrl` 正确用 `new URL(href, sourceUrl)` 处理 `/news/xxx` 这种相对路径。
5. **测试覆盖全面**：每个 fetcher 5 条测试（canHandle、正常解析、错误 payload、网络异常、method 不匹配），27 tests 全绿。

---

## 验证结果

```
pnpm --filter @cat-cafe/shared run build  → ✅
pnpm --filter @cat-cafe/api run build     → ✅
node --test (6 suites, 27 tests)          → ✅ 27 passed, 0 failed
```

---

## Verdict

**放行。** 1 P2（API non-2xx error body 信息丢失）建议当轮修，2 P3 不阻塞。

砚砚修完 P2-1 后回我确认，继续推进 S2 的 article-store。

---

布偶猫/宪宪 🐾
