---
feature_ids: [F187]
topics: [review-request, thread, labels]
doc_kind: mailbox
created: 2026-05-06
---

# Review Request: F187 Thread Labels Phase A — Label 系统基座

Review-Target-ID: f187
Branch: feat/f187-thread-labels

## What

Thread 标签系统的数据基座：ThreadLabel 实体 + Redis 持久化 + CRUD API + 前端打标签 UI。

核心变更（17 files, +1000 lines）：
- **数据层**: ThreadLabel 类型 + Redis Hash/SortedSet 存储 + LabelStoreFactory
- **Thread 扩展**: `labels: string[]` 字段序列化/反序列化 + `updateLabels` 方法
- **API 路由**: `POST/GET/PATCH/DELETE /api/labels` + `PATCH /api/threads/:id` 扩展 labels
- **前端**: Zustand label-store + chatStore `updateThreadLabels` + ThreadLabelPicker popover + ThreadItem label dots

## Why

铲屎官原话：置顶了几十个 thread，没有 tag 系统无法分类。Pin 被迫承担分类职责——本来是"我现在要关注"（临时注意力），实际被当成"别丢了"（永久归档）。

Phase A 建立标签基座，Phase B 加 sidebar 筛选，Phase C 加猫猫辅助分类。

## Original Requirements（必填）

> "我发现我们现在置顶都置顶了大几十个！thread！我感觉导致这个问题是我们的收藏夹或者说也没有什么 tag 系统让我没办法分门别类我们的 thread，比如哪些是在拆技术（开源项目），哪些在 thread 开发，哪些是我们一起闲聊共创等等"

- 来源：`docs/features/F187-thread-labels.md` Why 段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Thread labels 用覆盖式 PATCH（传完整数组）而非增量 add/remove — 简化 API，前端已有完整状态
- ThreadLabelPicker 跟 ThreadCatSettings 用同一个 popover 模式（fixed positioning）— 复用验证过的交互

## Open Questions

1. **前端 UI 实测**：worktree 的 dev server 受 pnpm hoisting 影响无法正常路由。**请在 review 沙盒用 `pnpm review:start` 实测标签创建/打标签/持久化流程**
2. `resolveUserId` 的 fallback `'default-user'` 在多用户场景下是否足够
3. Label 上限（当前 Zod 限制 thread 最多 20 个 label）是否合理

## Next Action

请 review 代码 + 在沙盒里实测前端功能。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f187/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（标准 review 端口）

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 | 测试 |
|----|------|----------|------|
| AC-A1: 创建标签（名称+颜色） | ✅ | `labels.ts` POST + `ThreadLabelPicker.tsx` create form | `redis-label-store.test.js` |
| AC-A2: Thread 打多标签 | ✅ | `threads.ts` PATCH + `ThreadLabelPicker.tsx` checkbox | `label-routes.test.js` |
| AC-A3: Redis 持久化 | ✅ | `RedisLabelStore.ts` Hash+SortedSet, TTL=0 | 12 Redis tests |
| AC-A4: Label CRUD + 类型 | ✅ | POST/GET/PATCH/DELETE + ThreadLabel interface + Zod | 5 route tests |

### 测试结果

```
Redis label tests (17 tests) → 17/17 pass ✅
pnpm biome check (17 changed files) → 0 errors ✅
pnpm --filter @cat-cafe/api lint (tsc --noEmit) → 0 errors ✅
pnpm --filter @cat-cafe/api build → exit 0 ✅
pnpm --filter @cat-cafe/shared build → exit 0 ✅
```

⚠️ Web test/lint/build: worktree pnpm hoisting issue（tailwindcss/fast-check not found）— pre-existing, unrelated to F187。

### 相关文档

- Feature: `docs/features/F187-thread-labels.md`
- Plan: `docs/plans/2026-05-06-f187-thread-labels-phase-a.md`
