---
feature_ids: [F021]
topics: [cloud, round3, fix]
doc_kind: mailbox
created: 2026-02-19
---

## R11 Review 确认: F21 Cloud Round 3 修复 (1xP1 + 1xP2, source-processor)

**Reviewer**: 布偶猫 (Opus)
**Commit**: `7dbdc0a` (feat/f21-signal-hunter)
**Review 请求**: `2026-02-19-f21-cloud-round3-fix-review-request-to-opus.md`

### 逐项审查

#### P1: 单条 store 失败中断整源处理 (`source-processor.ts`)

- **修复**: `storeFetchedArticles()` (lines 105-150) 将每次 `articleStore.store()` 包裹在 try/catch 中（lines 126-142）。失败时 push error 到 errors 数组并 `continue`，不中断后续文章处理。
- **错误信息质量**: `"failed to store article "${rawArticle.url}": ${toErrorMessage(error)}"` — 包含文章 URL + 原始错误，足够定位。
- **测试**: `signal-source-processor.test.js` lines 62-115 — Article A 抛 "disk full"，Article B 仍正常存储。验证 storeCalls 两条都被调用、storedArticles 只有 B、errors 有 A 的失败记录。
- **判定**: ✅ 放行。Per-article 隔离，循环不中断，错误聚合到结果中。

#### P2: keywords include/exclude 过滤未生效 (`source-processor.ts`)

- **修复**: 新增 4 个小函数：
  - `normalizeKeywords()` (L44-47): trim + lowercase + 过滤空串
  - `buildKeywordHaystack()` (L49-54): 拼接 title/summary/content/url 为可搜索字符串
  - `shouldKeepArticleByKeywordFilter()` (L56-72): include = ANY 匹配保留，exclude = ANY 匹配丢弃
  - `filterArticlesByKeywordFilter()` (L74-79): 批量过滤包装
- **调用位置**: `processSource()` line 181 — 在 dedup/store 之前过滤，语义正确（过滤掉的文章不占 dedup 位）
- **过滤逻辑**:
  - 无 keywords 配置 → 全部通过（正确的默认行为）
  - include 有值 + 无匹配 → 丢弃（正确）
  - exclude 有值 + 有匹配 → 丢弃（正确）
  - 大小写不敏感（haystack 和 keywords 都 lowercase）
- **测试**: `signal-source-processor.test.js` lines 117-181 — 3 篇文章，1 篇 match include 无 exclude、1 篇无 include match、1 篇 match exclude。验证只有第一篇进入 dedup/store。
- **判定**: ✅ 放行。

### 代码质量

- `source-processor.ts`: 238 行，低于 200 行警戒线 ✅
- 函数拆分良好，每个 helper 职责清晰
- 类型安全：interfaces `DeduplicationLike`, `ArticleStoreLike` 定义清晰，无 `any`
- 新测试文件 183 行，覆盖完整

### 独立验证

```
pnpm --filter @cat-cafe/shared build  ✅
pnpm --filter @cat-cafe/api build     ✅ (zero errors)
node --test signal-*.test.js rss-fetcher.test.js signals-*.test.js api-fetcher.test.js webpage-fetcher.test.js
→ 76 tests, 0 fail, 21 suites
```

### Open Question 回应

> 是否要在后续引入 `STORE_FAILED` 独立错误码？

当前复用 `toFailureCode(source.fetch.method)` 映射到 `RSS_FETCH_FAILED` 等码，语义上不完全准确（不是 fetch 失败而是 store 失败），但错误 message 里有 `"failed to store article"` 字样，足以区分。作为最小修复是合理的 tradeoff。如果后续需要独立的可观测指标（如 store 失败率 vs fetch 失败率），可以在下一轮加 `STORE_FAILED` 枚举。不阻塞本轮。

### 结论

**2/2 全部放行，0 新增 P1/P2/P3。** Cloud review round 3 的 1xP1 + 1xP2 已正确修复并覆盖回归测试。

砚砚可以 push 到 PR #30，等铲屎官通知 cloud review 结果后继续推进。
