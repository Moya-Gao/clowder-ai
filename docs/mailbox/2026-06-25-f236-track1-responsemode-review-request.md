---
feature_ids: [F236]
topics: [track-1, responseMode, anchor, review-request]
doc_kind: mailbox
created: 2026-06-25
---

# Review Request: F236 Track-1 — responseMode=anchor|full on MCP projection points

Review-Target-ID: f236
Branch: feat/f236-track1-responsemode

## What

Add `responseMode=anchor|full` parameter to the two MCP projection points:
1. `get_thread_context` — anchor (default): token-lean previews + drillDown pointers; full: complete message bodies
2. `get_pending_mentions` — anchor (default): head+tail excerpt + requiresDrill; full: complete mention content

Three files changed:
- `packages/api/src/routes/callbacks.ts` — schema + handler branching for both tools
- `packages/api/test/callback-routes.test.js` — 6 new invariant tests
- `packages/mcp-server/src/tools/callback-tools.ts` — input schema + handler + tool description

## Why

Phase A/B anchor-first is always-on — cats can't opt out per-call when they know they need full content (bulk analysis, context rebuild, export). Track-1 gives each cat per-situation control without a global `set_read_mode` that bleeds across tools.

Per design spec line 204: "① `get_thread_context.responseMode` → ② `get_pending_mentions.responseMode` → `get_message` 保持现状 → 其余不动"

## Original Requirements（必填）
> 铲屎官 2026-06-24: "嗯？那你为什么不直接开始！走起" (approving Track-1 implementation)
> 铲屎官 2026-06-24 pivot: 猫显式选 mode、系统零任务分类 / 零意图猜测
> opus-48 + 砚砚 grounded analysis: "只加在投影点，不是所有 read 工具"
- 来源：`docs/features/F236-anchor-first-context-entry.md` lines 183-204 (Track-1 design)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Not adding `responseMode` to all tools** — only projection points (get_thread_context, get_pending_mentions). Tools with existing equivalent controls (get_message.mode, search_evidence.depth) keep their names to avoid field collision.
- **Not using `mode` as field name** — `mode` already taken by get_message and search_evidence with different semantics (砚砚 catch).
- **Default is `anchor`** — preserves Phase A/B behavior, no breaking change.

## Architecture Ownership（必填）
Architecture cell: callback-routes (projection layer)
Map delta: none
Why: Additive parameter to existing route handlers. No new Store/Queue/Router/Adapter. Same projection layer, same anchor helpers.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. Full mode 的 thread-context response 用 `content` field (not `preview`) — 这是有意的 shape 差异 (anchor 用 `preview`, full 用 `content`) 来让消费方知道拿到的是什么。是否合理？
2. Full mode pending-mentions 的 `message` 字段保持不变（都叫 `message`）但 `requiresDrill=false` — 这样处理和 thread-context 不同，因为 pending-mentions 的 `message` field 已被消费方依赖。

### 价值 OQ（给 CVO，如有）
无。可逆（≤1 commit 回滚），不影响外部用户/数据/契约。

## Next Action
请 review 代码变更，重点关注：
- response shape 在 anchor/full 两种 mode 下的一致性和合理性
- telemetry 记录是否正确（full mode 的 returnedChars 计算）
- tool description 是否足够让猫知道参数存在和使用时机

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f236/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: auto-assigned by review:start

## 自检证据

### Spec 合规
- AC per design spec line 188: ✅ `get_thread_context` + `get_pending_mentions` 加 `responseMode=anchor|full`
- AC per design spec line 192: ✅ 字段叫 `responseMode` 不叫 `mode`
- AC per design spec line 195: ✅ 软层 tool description 写明何时用
- AC per design spec line 196: ✅ 硬层 invariant tests: anchor returns locator not synopsis / full bypasses / default=anchor

### 测试结果
```
pnpm --filter @cat-cafe/api test (callback-routes + anchor tests)  # 182 passed, 0 failed
pnpm build                                                          # 成功
pnpm check                                                          # PASS (biome + features + skills)
```

### 相关文档
- Feature: `docs/features/F236-anchor-first-context-entry.md`
- Design: Track-1 section lines 183-204

[宪宪/claude-opus-4-6🐾]
