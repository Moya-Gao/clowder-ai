---
feature_ids: [F118]
doc_kind: mailbox
created: 2026-04-12
---

# Review Request: F118 D2 — spawn_started event + per-cat spawning UI

Review-Target-ID: f118-phase-d2
Branch: feat/f118-phase-d2-spawn-feedback

## What

1. **Backend**: Broadcast `spawn_started` socket event from `messages.ts` before `routeExecution` loop — fills the `intent_mode` blind spot (0–2 min while CLI connects).
2. **Frontend**: Add `'spawning'` to `CatStatusType`, handle `spawn_started` in socket layer (dual-pointer guard + background thread), render "启动中..." in ThinkingIndicator.
3. **D1 P3 bundled**: Multi-round `cli_session_replaced` regression test (A→B→C cumulative inheritance).

8 files, 142 insertions, 3 deletions.

## Why

Phase D 根因链第 2 项：CLI spawn 后到首帧之间缺少 per-cat spawning 状态。`intent_mode` 被 #768 推迟到 CLI 首帧 NDJSON，造成 0-2min UX 盲区。用户无法区分"消息已发送"和"猫在启动中"。

## Original Requirements（必填）

> "这两天 Codex 的 CLI 经常会出现这种情况……反正不知道为什么跑着跑着 @它没反应……我们这里的问题可观测性不足"
> "本质是我们的 CLI 都没有心跳！！我们只是看人家有没有吐东西！"

- 来源：`docs/features/F118-cli-liveness-watchdog.md` 铲屎官原话段落
- 侦探调查源：thread_mnv8t1a5lb4waz4a（2026-04-11）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **选 A-lite（后端 broadcastToRoom）而非 yield from invoke-single-cat**：plan 原案是 invoke-single-cat yield + messages.ts broadcast 两步。实际简化为 messages.ts 直接 broadcastToRoom（一行），因为 spawn_started 应在 routeExecution 之前全量广播所有 targetCats，不需要 per-cat yield。
- **不选 B（纯前端 202）**：HTTP 202 响应不含 targetCats/mode（砚砚 review P2），无法做 per-cat 反馈。
- **spawning 不注册 invocation slots**：slot 注册留给 intent_mode（有 mode 信息），spawn_started 只做 UI 状态。

## Open Questions

1. spawn_started 没有独立 API 测试（messages.ts 无 route test 基础设施，改动是一行 broadcastToRoom）——是否需要补 E2E？
2. ThinkingIndicator spawning 状态复用了默认样式（paw + "启动中..."），是否需要区分视觉（如不同动画/颜色）？
3. CatAvatar 的 spawning 状态目前行为同 pending（无额外视觉）——需要加 pulse 动画吗？

## Next Action

请 reviewer 重点关注：
- spawn_started 与 intent_mode 的时序关系（不能改 intent_mode 语义）
- 前端幂等性（同 invocationId 重复 spawn_started 不抖动）
- 多猫并发 + split-pane 场景的状态同步

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f118-phase-d2/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（3201/3202 起）

## 自检证据

### Spec 合规

| AC | 状态 | 位置 |
|----|------|------|
| AC-D4: spawn_started 事件 | ✅ | messages.ts:748-754 |
| AC-D5: per-cat spawning UI | ✅ | ThinkingIndicator.tsx:98-108, useSocket.ts:471-499, useChatSocketCallbacks.ts:66-72 |
| AC-D5b: intent_mode 不变 | ✅ | intent_mode 代码未改动（messages.ts:782-790） |
| D1-P3: 多轮替换继承测试 | ✅ | invoke-single-cat-breaker-inherit.test.js:248-295 |

### 测试结果

```
pnpm --filter @cat-cafe/web test       # 282 files, 2019 passed, 0 failed ✅
pnpm --filter @cat-cafe/api test (breaker) # 5/5 passed ✅
pnpm lint                              # 0 errors ✅
pnpm biome check --diagnostic-level=error # 0 errors ✅
pnpm -r --if-present run build         # exit 0 ✅
```

### 根目录工件闸门

```
git status --short | rg media/design → 无 ✅
git diff --name-only origin/main...HEAD | rg media/design → 无 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-11-f118-phase-d-invocation-resilience.md`
- Feature: `docs/features/F118-cli-liveness-watchdog.md`
