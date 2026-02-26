---
feature_ids: [F021]
topics: [cloud, round5, fix]
doc_kind: mailbox
created: 2026-02-20
---

## R14: Cloud Round5 两个 P1 修复确认

**Reviewer**: 布偶猫 (Opus)
**Commit**: `e51c23d` (feat/f21-signal-hunter)
**对照基准**: Cloud review round5 的 2 个 P1

---

### P1-A: 坏文章文件不再拖垮 inbox/search/stats — PASS

**修复逻辑** (`article-query-service.ts` L60-63):

```typescript
async function readArticleDetailsSafely(records): Promise<ParsedArticleDocument[]> {
  const settled = await Promise.allSettled(records.map(r => readArticleDocument(r)));
  return settled.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
}
```

Review 要点：
- `Promise.allSettled` + `flatMap` 过滤 rejected，惯用且简洁
- L75 `listInbox`、L131 `search`、L191 `getStats` 全部改用 `readArticleDetailsSafely` ✅
- L87-98 `getArticleById` 和 L101-118 `getArticleByUrl` 保留直接 `readArticleDocument`——单条查询应当暴露 error，语义正确
- "跳过坏记录"是可用性优先的合理策略，与 source-processor 的 per-article try/catch 一致

**测试覆盖** (`signals-route.test.js` L315-350):
- `unlinkSync(secondArticle.filePath)` 模拟文件损坏
- 逐一验证 inbox (200 + firstArticle 在 / secondArticle 不在)、search (200 + 同)、stats (200 + todayCount >= 1)
- 三个端点全覆盖

---

### P1-B: SignalSource.id 安全 slug 校验 — PASS

**修复逻辑** (`signals.schema.ts` L32-34):

```typescript
id: z.string().regex(
  /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
  'source id must be a safe slug (letters, numbers, "_" or "-")'
)
```

Review 要点：
- 正则 `^[A-Za-z0-9][A-Za-z0-9_-]*$` — 首字符必须字母/数字，后续允许 `_` `-`
- 完全阻断 `../`、`/`、`\`、`.`（不能以 `.` 开头）等路径穿越字符
- `^...$` 锚定防止部分匹配绕过
- 下游 `ArticleStoreService.store()` 用 `join(paths.libraryDir, source.id)` 构建路径，此校验在 schema 层 fail-fast，安全边界正确

**测试覆盖** (`signals-shared-contract.test.js` L69-89):
- 5 个非法 ID 全部断言 throws：`'../outside'`, `'..'`, `'/tmp/evil'`, `'signals/news'`, `'news\\archive'`
- 覆盖了 `..` 穿越、绝对路径、正斜杠、反斜杠

---

### 测试结果

```
# P1 目标测试
signals-route + signals-shared-contract: 13/13 pass

# Signal 全量回归
signal-*.test.js: 50/50 pass

# Build
shared ✅  |  api ✅
```

---

### 总结

**R14: 2/2 P1 全部修复，放行。**

批量读取容错隔离干净（allSettled + flatMap），source id 安全校验在 schema 层 fail-fast 彻底。两个修复都有针对性测试且回归全绿。
