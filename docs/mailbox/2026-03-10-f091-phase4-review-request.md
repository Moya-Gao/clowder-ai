---
doc_kind: review-request
created: 2026-03-10
feature_ids: [F091]
topics: [signal, study, podcast, memory, collection, timeline]
---

# Review Request: F091 Phase 4 — Signal Study Mode 剩余 7 AC

## What

F091 Phase 4 完成 GPT-5.4 愿景守护审查后标记的 7 个剩余 AC：

1. **AC-10**: 记忆对接 — `createSignalArticleLookup` 注入 `TranscriptReader`，讨论前搜索 session history 获取相关历史片段（先搜后聊）
2. **AC-5**: 播客前端播放器 — `PodcastPlayer.tsx` 组件：segment viewer + speaker 色标 + 精华/深度生成按钮 + GET endpoint 读取脚本
3. **AC-6**: 多猫研究派发 — StudyFoldArea "多猫研究" 按钮，打开 thread 带预组装 multi_mention 研究请求
4. **AC-18**: 学习集前端 — collection pills 展示 + 下拉加入 + 创建新学习集
5. **AC-19**: 学习时间线 — `StudyTimeline.tsx` + `/api/signals/timeline` endpoint，7/14/30 天回顾
6. **AC-12/13/17**: Phase 1-3 已完成，本轮无新代码

14 files changed, +615 -25 lines.

## Why

GPT-5.4 愿景守护判定 F091 不能 close（17/24 AC done），需要完成剩余 AC 才能关闭 feature。铲屎官原话"来走起！！我们要继续！"。

## Original Requirements（必填）
> "和猫猫们聊的多，聊天才能碰撞灵感" — 对话入口优先
> "记忆是 thread session 搜来的" — 用 cat-cafe-memory，不走 RAG
> "两种都要" — 精华 2-3 分钟 + 深度 10 分钟
> "上周学了什么" — 学习时间线回顾
> "相关文章绑成学习集" — 文章关联/collection

- 来源：`docs/features/F091-signal-study-mode.md` (AC 列表 + Why 章节)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- AC-6 multi-cat dispatch 是前端 link→thread 方案（非直接 API 调用），因为 multi_mention 是 callback-only API（需要 invocationId + callbackToken），前端无法直接调用
- AC-5 播客播放器是脚本阅读器（segment viewer），实际音频播放依赖 F066 TTS pipeline 未来集成
- StudyFoldArea 达到 235 行（超 200 警告线但未触 350 硬限），PodcastPlayer 已提取为独立组件

## Open Questions

1. AC-10 `TranscriptReader.search` 的 `scope: 'digests'` 是否足够？还是应该同时搜 transcripts？
2. AC-6 的 link→thread 方案是否符合预期？还是需要后端 API 支持直接从前端触发 multi_mention？
3. PodcastPlayer 目前是纯文本 segment viewer，TTS 集成时是否需要额外 UI 改动？

## Next Action

请 review 代码质量 + 愿景对齐，特别关注：
- AC-10 memory integration 的正确性（`signal-thread-lookup.ts`）
- 新组件（`PodcastPlayer.tsx`, `StudyTimeline.tsx`）的 UX 合理性
- API endpoint 安全性（`signal-podcast-routes.ts`, `signal-study-routes.ts`）

## 自检证据

### Spec 合规
Phase 4 所有 7 AC 已实现，quality gate 通过。

### 测试结果
```
pnpm --filter @cat-cafe/mcp-server test  # 54 passed, 0 failed
pnpm --filter @cat-cafe/web test         # 925 passed, 1 failed (pre-existing: mission-control button text)
pnpm lint                                # 0 errors (warnings only, all pre-existing)
pnpm --filter @cat-cafe/shared build     # exit 0
pnpm --filter @cat-cafe/api exec tsc     # exit 0
```

### 相关文档
- Feature: `docs/features/F091-signal-study-mode.md`
- Branch: `feat/f091-phase4` (5 commits)
