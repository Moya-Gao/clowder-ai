---
feature_ids: [F088]
phase: D
doc_kind: review-request
created: 2026-03-10
author: opus
reviewer: codex
---

# Review Request: F088 Phase D — `/use` 模糊匹配

## What

ConnectorCommandLayer 的 `/use` 命令从"只支持 thread ID 前缀"升级为四级级联匹配：

1. **feat号匹配** `/use F088` → 扫描 backlogStore tags → 关联 threads → 按 lastActiveAt 取最新
2. **列表序号匹配** `/use 3` → 对应 `/threads` 输出的第 3 行
3. **ID前缀匹配** `/use thread-abc` → 保持现有行为
4. **title关键词匹配** `/use 飞书` → substring, case-insensitive, 多匹配取最新

同时 `/threads` 输出升级，展示 feat badge（如 `[F088]`）。

## Why

铲屎官原话："用户鬼记得住你的 thread id 啊，这完全不现实"。Phase C 做完跨平台 thread 后，`/use` 的可用性成为瓶颈。

## Original Requirements（必填）

> "用户鬼记得住你的thread id啊这完全不现实"
> "改 /use 支持三种匹配模式：/use F088 按 feat 号匹配...最后说话的大猫猫时间最靠近现在的"
> "有的 thread 绑定了好几个 feat，有的 feat 绑定了好几个 thread"

- 来源：Cat Café thread 对话（铲屎官 2026-03-10）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **BacklogStore N+1 查询**: 每个有 backlogItemId 的 thread 都要 `get()` 一次。MVP 可接受（<10 threads），后续可加 batch 接口或缓存。
- **没有 import `getFeatureTagId()`**: 该函数在 route 文件里不便 import，内联了 3 行 `tag.startsWith('feature:')` 匹配。

## Open Questions

1. **cascade 优先级是否合理？** feat号 → 列表序号 → ID前缀 → title关键词。纯数字（如 `/use 3`）先匹配列表序号而非 ID 前缀——这是有意设计。
2. **backlogStore 接口最小化**: 只用了 `get(itemId, userId?)` 而非 `listByUser()`，避免拉全量。是否足够？

## Next Action

请 review 代码变更，重点关注：
- 四级匹配的边界条件和优先级
- backlogStore optional dep 的 graceful degradation
- `/threads` feat badge 逻辑

## 自检证据

### Spec 合规

Plan 8 项 AC 全部覆盖（见 quality gate report）。

### 测试结果

```
node --test (3 files) → 43 passed, 0 failed ✅
pnpm lint             → 0 errors ✅
pnpm build            → exit 0 ✅
```

### 变更文件

| 文件 | 行数 | 改动 |
|------|------|------|
| `ConnectorCommandLayer.ts` | 240L | +backlogStore dep, +4 matching helpers, +feat badge |
| `connector-gateway-bootstrap.ts` | 241L | +backlogStore optional dep + wiring |
| `connector-command-layer.test.js` | 490L | +10 new Phase D tests |

### 相关文档

- Plan: `docs/plans/2026-03-10-f088-phase-d-use-fuzzy-matching.md`
- Feature: F088 / `docs/features/F088-multi-platform-chat-gateway.md`
