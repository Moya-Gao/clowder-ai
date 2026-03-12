---
type: review-request
feature: F106
author: opus
reviewer: codex
date: 2026-03-12
---

# Review Request: F106 Multi-Bootcamp List Modal + CTA Adaptation

## What

Multi-bootcamp support: users can create and manage multiple bootcamp threads through a new list modal.

**Changed files** (5 files, +314 -23):
- `packages/api/src/routes/bootcamp.ts` — new `GET /api/bootcamp/threads` endpoint
- `packages/api/test/bootcamp-env-check.test.js` — 4 new tests (F106 suite)
- `packages/web/src/components/BootcampListModal.tsx` — **new file**: modal with phase progress, navigation, creation
- `packages/web/src/components/ChatContainer.tsx` — render modal + CTA three-path logic
- `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` — 🎓 button delegates to `onBootcampClick` prop

## Why

铲屎官发现训练营候选任务很好玩，想同时开多个。当前限制：前端 CTA 用 `find()` 找第一个就停了，不让开新的。后端已支持多个。

## Original Requirements（必填）

> "我们能开多个训练营吗？好像很多都很好玩。我们的训练营好像现在只开一个？"
> "我希望训练营列表页，展示每个训练营的 phase 进度，然后点击训练营应该不是新建新的而是选择新的还是去哪个老的。"

- 来源：铲屎官直接对话（2026-03-12 05:38-05:40）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选了 Modal 而非独立 `/bootcamp` 页面 — 更轻量，不需要新路由
- `leadCat` + 创建日期行（设计稿有）暂未实现 — API 未暴露 leadCat，标记为 P3 polish
- 保留了 `GET /api/bootcamp/thread`（单个）做向后兼容，新增 `/threads`（复数）

## Open Questions

1. **leadCat 行**：设计稿有"引导猫: 宪宪 · 3月12日"，但实现中 API 未返回 leadCat。是否本轮补上？
2. **侧栏按钮 fallback**：`onBootcampClick ?? createBootcampThread` — 如果上层没传 prop，退化为直接创建。这个 fallback 合理吗？

## Next Action

请 review 代码质量 + 愿景对照，重点关注 BootcampListModal 组件设计和 CTA 三路逻辑。

## 自检证据

### Spec 合规

| AC | 状态 | 位置 |
|----|------|------|
| A1: 多训练营创建 | ✅ | BootcampListModal:65-83 |
| A2: 列表展示 phase 进度 | ✅ | BootcampListModal:116-175 |
| A3: 点击跳转 | ✅ | BootcampListModal:60-63 |
| A4: 创建入口 | ✅ | BootcampListModal:174-193 |
| A5: CTA 适配 | ✅ | ChatContainer ~L393+ |

### 设计稿对照

- `designs/f106-multi-bootcamp-ux.pen` ✅ 已对照
- 一处有意差异：leadCat 行（P3 polish）

### 测试结果

```
node --test test/bootcamp-env-check.test.js  # 13 passed, 0 failed ✅
tsc --noEmit (web)                           # 0 errors in changed files ✅
tsc --noEmit (api)                           # 0 errors ✅
pnpm lint                                    # 0 errors ✅
pnpm --filter @cat-cafe/api build            # exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F106-multi-bootcamp.md`
- Design: `designs/f106-multi-bootcamp-ux.pen`
- Evolved from: F087 (CVO Bootcamp)
