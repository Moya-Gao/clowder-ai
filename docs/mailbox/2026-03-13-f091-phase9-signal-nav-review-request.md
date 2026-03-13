---
doc_kind: review-request
created: 2026-03-13
feature_ids: [F091]
---

# Review Request: F091 Phase 9 — Signal 返回导航修复 + 学习笔记可查看

## What

三项修复：

1. **返回导航修复**: Signal 页面 "Chat" 入口改为 Mission Hub 风格的"返回线程"按钮，通过 `?from=threadId` 记住来源线程
2. **讨论链接修复**: "在对话中讨论"/"开始学习"/"多猫研究"使用关联的 study thread，不再硬编码 `/thread/default`
3. **学习笔记可查看**: notes 从纯文本 ID 改为可点击展开内容的按钮，后端新增 `GET /api/signals/articles/:id/notes/:noteId` endpoint

改动文件：
- `ChatContainerHeader.tsx` — Signal 入口传 `?from=threadId`
- `SignalNav.tsx` — 读 `?from=` 参数，Mission Hub 风格返回按钮，`?from=` 透传到 Signals/Sources 子页
- `StudyFoldArea.tsx` — `resolveDiscussThread()` 用关联 thread 替代 default，notes 可展开
- `SignalArticleDetail.tsx` — `discussedLink` 用 study meta 的关联 thread
- `signal-study-routes.ts` — 新增 note content API endpoint

## Why

铲屎官 01:22 报告两个 bug：
1. 学习笔记只列了 study ID，点不了看不了内容
2. 从 thread A → Signal 页面 → 点返回 → 跳到默认 thread 而不是 thread A，容易发错消息

## Original Requirements（必填）

> 你这里列的几个学习笔记 请问我怎么看的？ 你的返回chat 返回默认的thread也很离谱，难道不是我从哪里来 回哪里去吗？ 点击返回还直接给我切thread了，这不会让我发错消息吗？

> 我原来在thread a 去了Signal 页面 点击返回chat 我不是应该回去thread a吗？ 你这先给我丢回默认thread 现在又想干啥？

> Chat -》这个显示也改一下和mission hub的显示方式一样可能好点

- 来源：铲屎官 thread 对话 01:22-01:36
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `?from=` 方案复用了 MissionHub 已有模式（PR #422），而非 `history.back()`，因为 SPA 内 `history.back()` 可能回到非预期页面
- Note 内容用 lazy fetch 而非 study meta 一次性带回，避免 meta 接口膨胀

## Open Questions

1. `resolveDiscussThread` 取第一个 non-stale thread — 如果有多个关联 thread 是否需要让用户选？（当前场景基本只有一个）
2. Note 内容用 `<pre>` 渲染 — 如果笔记是 markdown 格式是否需要 MarkdownContent？

## Next Action

请 review 代码质量 + 导航逻辑正确性。

## 自检证据

### Spec 合规
- [x] 返回导航：`?from=threadId` 透传 + fallback to chatStore
- [x] "Chat" 改为 Mission Hub 风格返回按钮（`<` 图标 + "返回线程"）
- [x] 讨论链接使用关联 thread 而非 default
- [x] 学习笔记可点击展开查看内容
- [x] Note content API endpoint 读取 filePath

### 测试结果
- `signal-nav-back.test.ts` — 5/5 passed（返回按钮渲染、默认回退、?from= 读取、store fallback、参数透传）
- `study-fold-nav.test.ts` — 4/4 passed（关联 thread 使用、default 回退、stale 跳过、note toggle 按钮）
- `signal-note-content.test.js` — 3/3 passed（读文件、缺失文件错误、空文件）
- `pnpm check` — PASS
- `pnpm lint` — 0 errors

### 相关文档
- Feature: F091 Signal Study Mode
- Phase 8 PR: #405（刚合入的上下文注入）
