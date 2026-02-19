## R12 Re-check: S7 前端 P2 修复确认

**Reviewer**: 布偶猫 (Opus)
**Commit**: `5921fe7` (feat/f21-signal-hunter)
**对照基准**: R12-revised 的 5 个 P2

---

### 逐项复核

#### P2-1: 打开原文链接 — PASS

`SignalArticleDetail.tsx` L93-100: `<a href={article.url} target="_blank" rel="noopener noreferrer">打开原文 ↗</a>`

测试: `signal-article-detail.test.ts` L63-65 — 查询 `a[href="https://example.com/article"]`，断言含"打开原文"。

#### P2-2: 在对话中讨论桥接 — PASS

`SignalArticleDetail.tsx` L33-42: `discussedLink` memo 生成 `/thread/default?signal=${article.id}&source=${article.source}`。
L101-106: `<a href={discussedLink}>在对话中讨论</a>`。

测试: L67-69 — 查询 `a[href^="/thread/default?signal="]`，断言含"在对话中讨论"。

路由方案合理：复用现有 `/thread/default` 页面 + query params 传文章上下文，无需新建路由。

#### P2-3: Markdown 渲染 — PASS

`SignalArticleDetail.tsx` L5: import MarkdownContent。
L117: `<MarkdownContent content={article.content || '（无正文）'} />`。

测试: L55 传入 `**重点内容**`，L71-72 断言 `<strong>` 元素含 "重点内容"。

#### P2-4: Tag 展示 + 编辑 — PASS

展示: L126-134 — pill badges，`.rounded-full .border-codex-light .bg-codex-bg`，设计语言一致。
输入: L137-149 — controlled input + Enter 快捷键 (L141-146)。
添加: L150-156 — "添加标签" 按钮 + `addPendingTag` callback (L44-64)。
去重: L54 — case-insensitive 比较，已有标签不重复添加。
数据流: `SignalInboxView.tsx` L108-117 — `handleTagsChange` 调用 `updateSignalArticle(articleId, { tags })` + 乐观更新 `setItems` 和 `setSelectedArticle`。

测试: L74-96 — badge 展示 → input 输入 → click → 断言 `onTagsChange('article-1', ['existing', 'new-tag'])`。

#### P2-5: 信源访问外链 — PASS

`SignalSourcesView.tsx` L113-120: URL 显示为 `<a href={source.url} target="_blank" rel="noopener noreferrer">`（可点击）。
L121-128: 额外 "访问 ↗" 按钮（同一 URL，更醒目的入口）。

测试: `signal-sources-view.test.ts` L65-68 — mock 一个 source，断言含 `a[href="..."]` 且文本包含 "访问"。

---

### 测试结果

```
Test Files  63 passed (63)
Tests       407 passed (407)
Duration    3.26s
```

Web build: 成功（shared build → web build → 0 error）。

---

### 总结

**R12 Re-check: 5/5 P2 全部修复，放行。**

砚砚干得漂亮——5 个 P2 全改到位，每个都有测试覆盖，代码风格和设计语言一致。SignalArticleDetail 从 92 行涨到 185 行（在 200 行警告线内），结构合理不需要拆分。

F21 S7 前端 UI 现在功能完整，可以进入 Step 5 云端 review 流程。
