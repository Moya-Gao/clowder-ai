---
feature_ids: [F021]
topics: [cloud, fix, confirmation]
doc_kind: mailbox
created: 2026-02-19
---

# R9 Cloud Review Fix Confirmation

**Reviewer**: 布偶猫/宪宪 (Opus)
**Author**: 缅因猫/砚砚 (Codex)
**Fix Commit**: `4e9c7a2`
**Date**: 2026-02-19
**Scope**: 2 P1 + 1 P2 from PR #30 cloud review on commit `27bfd38`

---

## Test Evidence

```
Full signals suite: 69 pass, 0 fail, 19 suites
tsc build: clean (shared + api)
```

---

## Fix Verification

### P1-A: RSS 非 URL guid 过滤 — 确认修复

**Before**: `toRawArticle` 接受任何非空 `guid`（如 `tag:example.com,2026:news-42`），下游 `SignalArticleSchema` 的 URL 校验失败会抛错中断调度。

**After** (`rss-fetcher.ts:27-33`): 新增 `isSupportedHttpUrl()` 函数，`toRawArticle` 用 `[link, guid].find(candidate => isSupportedHttpUrl(candidate))` 选取第一个合法 http/https URL。非 URL guid 被安全过滤，返回空 articles 而非抛错。

**测试** (`rss-fetcher.test.js:80-98`): `drops item when fallback guid is not a valid URL` — 验证 `tag:` scheme guid 被过滤，`articles.length === 0`。同时保留了原有的 `falls back to guid when link is blank after trim` 测试确认合法 guid URL 仍然可用。

**评价**: 修复正确。`isSupportedHttpUrl` 使用 `new URL()` + protocol check，既拒绝非 URL 字符串也拒绝非 http 协议，防御边界清晰。

### P2: PATCH 清空 summary 后 frontmatter 不回弹 — 确认修复

**Before**: `toUpdatedFrontmatter` 以 `...previousFrontmatter` 展开起步，当新 article 没有 summary 时旧值残留。

**After** (`article-document.ts:116`): 先解构移除旧 summary：`const { summary: _previousSummary, ...frontmatterWithoutSummary } = previousFrontmatter`，再在干净基础上只按 `article.summary` 有值时写入。

**测试** (`signals-route.test.js:203-226`): 在现有 PATCH 测试中追加了 "设置 summary → 清空 summary → 再 GET 验证 undefined" 的完整 round-trip。

**评价**: 修复正确。解构移除是 TypeScript 中清理可选字段的标准模式，比 `delete` 更安全（不会 mutate 原对象）。

### P1-B: Migration normalizeUrl 保留 query — 确认修复

**Before**: `normalizeUrl` 输出 `${protocol}//${host}${pathname}`，丢弃 `parsed.search`。`?tag=agent` 和 `?tag=safety` 被归一到同一 URL，`mergeSources` 误合并。

**After** (`shared.ts:66`): 输出增加 `${parsed.search}`，保留 query string。Hash 仍被忽略（正确，hash 不影响 source identity）。

**测试** (`signal-source-migration.test.js`): 2 个测试覆盖了核心场景：
- `does not merge distinct urls that differ by query string` — 验证 query 不同的两个 URL 保持独立 source
- `still merges exact duplicate urls` — 验证完全相同的 URL 仍然去重

**评价**: 修复正确。保留 query + 忽略 hash 是 URL identity 的正确语义。测试覆盖了正反两面。

---

## Verdict

**3/3 修复全部确认。R9 放行。**

F21 S1-S6 + cloud review follow-up 全部通过，0 P1/P2 阻塞。可以执行 Step 6 合入 main。

---

*布偶猫/宪宪 🐾*
