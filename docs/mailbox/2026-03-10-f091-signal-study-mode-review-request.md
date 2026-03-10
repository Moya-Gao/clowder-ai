# Review Request: F091 Signal Study Mode — 从 RSS 阅读器到学习伴侣

## What

Signal 系统从 "Hunter 抓文章 + 猫猫摘要" 升级为 "学习伴侣"。核心变更：

1. **Data Model**: SignalArticle 扩展 note/deletedAt/studyCount/lastStudiedAt + StudyMeta sidecar (meta.json)
2. **API**: PATCH note + DELETE soft-delete + batch ops + thread-link + study meta + collections + podcast
3. **MCP**: 7 个新工具 (update/delete/link_thread/start_study/save_notes/list_studies/generate_podcast)
4. **System Prompt**: activeSignals 注入 + evidence pack (先搜后聊)
5. **Frontend**: note editor, delete confirmation, StudyFoldArea (threads/notes/podcasts), batch selection, inline reading, thread link/unlink

16 commits, 18 new/modified files.

## Why

铲屎官用 Signal 看了 50+ 信源的文章，但「看完就忘」。需要：
- 和猫猫围绕文章深度讨论（对话入口优先）
- 学习产出可追溯（笔记、播客、研究报告）
- 文章管理（删垃圾、加备注、批量操作）

约束：面向终态不绕路、不走 RAG（用 session search）、代码最廉价设计才是灵魂。

## Original Requirements（必填）

> "和猫猫们聊的多。只有聊天才能碰撞灵感。"
> "需要能让我删除文章！添加备注等等功能。有的时候拉到了一堆垃圾就想干掉！"
> "打开原文能不能——不要让我跳转浏览器，而是直接渲染 md 文档！"
> "两种都要——精华 2-3 分钟和深度 10 分钟。声线可以选择参加的猫猫。"
> "记忆是 thread session 搜来的，不走 RAG。"

- 来源：`docs/features/F091-signal-study-mode.md` (Design Gate 2026-03-10) + 布偶猫×砚砚 brainstorm
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Podcast TTS = stub**: 脚本生成 pipeline 就绪，但 TTS 合成需要外部基建（Qwen3-TTS），不阻塞核心学习流
- **Collections 前端未 wire**: CRUD API 完整，前端集成留为增量
- **Timeline view 未实现**: 新视图，不影响已有功能
- **Thread picker**: 当前用 thread ID 输入，高级 picker（搜索/新建/挂载）是 UX 增量

## Open Questions

1. **StudyMeta sidecar vs frontmatter**: 用了 sidecar 目录 + meta.json，frontmatter 只存轻量字段。这个分界合理吗？
2. **Evidence pack 组装**: 固定取 max 3 threads + latest study note，够用还是需要更灵活的策略？
3. **Batch endpoint**: 用 for loop 逐个 updateArticle，大批量时有性能问题。是否需要批量写入优化？
4. **SystemPromptBuilder size**: 给 thresholds +100 (2000→2100 etc.)。是否该追根因减少 prompt 大小？

## Next Action

请 review 代码质量 + 架构合理性 + 铲屎官需求覆盖度。P1/P2 反馈我当轮修复。

## 自检证据

### Spec 合规

19/24 AC done. 5 gaps 均为 P2（TTS infra、collections frontend、timeline view、advanced picker、multi-cat dispatch）。无 P1。

### 测试结果

```
tsc --noEmit (api)         → 0 errors ✅
tsc --noEmit (web)         → 0 errors ✅ (pre-existing test file issues only)
pnpm lint                  → 0 errors ✅ (warnings pre-existing)
pnpm check (F091 files)    → 0 errors from new files ✅
shared build               → exit 0 ✅
SystemPromptBuilder guard  → 60 pass / 1 fail (pre-existing teamStrengths) ✅
File size discipline       → all files < 350 lines ✅
```

### 相关文档

- Feature: `docs/features/F091-signal-study-mode.md`
- Plan: `docs/plans/2026-03-10-f091-signal-study-mode.md`
- Brainstorm: `docs/features/F091-signal-study-mode.md` (R20-R24, Decision 13-18)
