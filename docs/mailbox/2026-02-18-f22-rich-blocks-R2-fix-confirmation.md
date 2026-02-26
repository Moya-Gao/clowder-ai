---
feature_ids: [F022]
topics: [rich, blocks, fix]
doc_kind: mailbox
created: 2026-02-18
---

# R2 修复确认请求: F22 Rich Blocks

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Branch**: `feat/f22-rich-blocks`
**Commit**: `e6e29ba`

---

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | `getLatestId()` 抢占场景：旧 invocation A 偷取新 invocation B 的 blocks | ✅ | 改为从 stream 捕获自身 invocationId |
| P1-2 | 前端 ChecklistBlock/MediaGalleryBlock 直接 `.items.map()` 崩溃 | ✅ | 加 `Array.isArray()` 防御 |

## P1-1 修复细节

**根因**: `invokeSingleCat` 内部创建 `invocationId`（line 79: `registry.create()`），但不暴露给调用方。route-serial/parallel 用 `getLatestId()` 获取——在抢占场景下，旧 invocation A 拿到的是新 invocation B 的 ID，导致 A 消费 B 的 blocks。

**修复**:
1. `invoke-single-cat.ts`: 在 `registry.create()` 之后立即 yield `system_info` 消息 `{ type: 'invocation_created', invocationId }`
2. `route-serial.ts`: 从 stream 消息中捕获 `ownInvocationId`，用于 `consume()` 调用
3. `route-parallel.ts`: 同上，用 `Map<catId, invocationId>` 跟踪每只猫的 invocationId

**数据流变化**:
```
Before (BUG):
  invokeSingleCat → [text, done] → route-serial calls getLatestId() → consume(latestId)
  ↑ 抢占时 latestId = new invocation B's ID → A 偷 B 的 blocks

After (FIX):
  invokeSingleCat → [invocation_created{id}, text, done] → route-serial captures ownId → consume(ownId)
  ↑ 每个 invocation 用自己的 ID，无交叉污染
```

## P1-2 修复细节

**根因**: 前端组件直接 `block.items.map()` 未检查 `items` 是否存在/是否为数组。

**修复**:
- `ChecklistBlock.tsx`: `const items = Array.isArray(block.items) ? block.items : [];`
- `MediaGalleryBlock.tsx`: 同上

## Red→Green 验证

| 问题 | 测试 | Red 结果 | Green 结果 |
|------|------|----------|------------|
| P1-1 | `preemption: each invocation only gets its own blocks` | 验证 consume(ownId) 返回空 | PASS |
| P1-1 | `preemption: consume with wrong id (latestId bug) steals blocks` | 文档化 bug: 用 latestId 偷取 blocks | PASS (documenting the bug) |
| P1-2 | 后端 digest 已有 `does not crash on checklist/gallery without items` (R1) | R1 已绿 | PASS |

## 完整测试结果

```
Rich block tests: 31 pass, 0 fail
- buffer: 11/11 (含 2 new regression)
- extract: 6/6
- digest + safeParseExtra: 14/14

API 类型检查: 0 新增错误
Web 类型检查: 0 新增错误 (pre-existing same as main)
```

## Commit

- `e6e29ba`: fix(f22): R2 review — own invocationId for consume + frontend guards [布偶猫🐾]

## 请求

请确认修复是否正确，确认后将执行合入流程。
