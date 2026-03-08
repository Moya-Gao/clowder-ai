# Review Request: F081 瞬时双影气泡 reconcile 修复

## What

这轮把 `F081` 第一刀后残留的“瞬时双影”收成了一个可审切片，修了两条具体身份断层：

1. user optimistic bubble 现在会在 `/api/messages` 返回 `userMessageId` 后，对位成真实 message id，不再和 persisted history 短暂共存。
2. background callback assistant bubble 现在优先使用后端真实 `messageId`，不再无条件自造 `bg-cb-*` synthetic id。

同时补了：
- `chatStore.replaceMessageId / replaceThreadMessageId`
- 对应的 web/api 回归测试
- `F081` 现场证据、bug report、discussion 摘录

## Why

铲屎官继续观测到另一种 `F081` 症状：主区有时会短暂出现两条自己的消息，或者两条同样的 assistant 回复，但 `F5` 之后又只剩一条。这个现象说明：

- 服务器真相源通常没有真的存重
- 重复更像前端本地 optimistic / placeholder 和正式历史消息没有正确 reconcile

这轮不扩锅做新 feature，只把已经坐实的两条 identity 缺口补齐。

## Original Requirements（必填）

> “有的时候我会发现，我在前端出现了我的两条消息！或者你两次同样的回复！但是 F5 之后又变成一条了，这是为什么？”

- 来源：[2026-03-08-f081-transient-duplicate-bubbles/README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-duplicate-reconcile/docs/discussions/2026-03-08-f081-transient-duplicate-bubbles/README.md)
- 请对照上面的摘录判断这轮交付物是否真的解决了铲屎官说的“瞬时双影，刷新后恢复单条”问题

## Tradeoff

- 这轮只修已经坐实的 identity 缺口，不顺手做内容级模糊去重。
- user 侧用 `userMessageId` 精确对位；assistant 侧这轮只补 background callback 这条 concrete root cause，不假装已经兜住所有未来可能的 assistant duplicate race。
- `replaceThreadMessageId` 走的是“改 id / 若 canonical 已存在则删临时 duplicate”语义，故意保持最小切面，不碰 message richness 合并策略。

## Open Questions

1. 这轮把 duplicate 范围收在“已坐实的身份断层”而不是内容级 dedup，你觉得切面够不够稳？
2. background callback assistant 改用真实 `messageId` 后，是否还有你担心的 id 语义冲突点？
3. `replaceThreadMessageId` 现在只做 canonicalize/drop-duplicate，不做 merge richer fields；对这轮目标是否足够？

## Next Action

请你 review 这条 `fix/f081-duplicate-reconcile` 分支；如果放行，我就按 `merge-gate` 开 PR 和云端 review。

## 自检证据

### Spec 合规

- Feature: [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-duplicate-reconcile/docs/features/F081-bubble-continuity-observability.md)
- 本轮覆盖：
  - `Why#9` 新增的“瞬时双影”症状
  - Timeline 里 2026-03-08 的两条新证据/修复记录
- 交付切片与铲屎官原话一致：修“前端短暂两条、刷新后只剩一条”的本地 reconcile 缺口，不声称已经治完 F081 全部场景

### 测试结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-thread-source.test.ts src/hooks/__tests__/useSocket-background.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/hooks/__tests__/useChatHistory-replace-hydration.test.ts src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/hooks/__tests__/useAgentMessages-invocation-created.test.ts src/hooks/__tests__/useSocket-background-system-info-web-search.test.ts
# 98 passed, 0 failed

pnpm --filter @cat-cafe/api run build && node --test packages/api/test/messages-delivery-mode.test.js
# 11 passed, 0 failed

pnpm --filter @cat-cafe/api run build
# success

pnpm --filter @cat-cafe/web build
# success

pnpm lint
# success (existing warnings only)
```

### 相关文档

- Feature: [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-duplicate-reconcile/docs/features/F081-bubble-continuity-observability.md)
- Bug report: [bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-duplicate-reconcile/docs/bug-report/f081-transient-duplicate-bubbles/bug-report.md)
- Discussion: [2026-03-08-f081-transient-duplicate-bubbles/README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-duplicate-reconcile/docs/discussions/2026-03-08-f081-transient-duplicate-bubbles/README.md)
