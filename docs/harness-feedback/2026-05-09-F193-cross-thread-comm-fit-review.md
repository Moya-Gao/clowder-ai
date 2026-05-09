---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F193
thread_ids: [thread_movcg5v7226tmg0q]
session_ids: []
cats: [opus-47, codex]
primary_failure_class: harness_misfit
status: resolved
created: 2026-05-09
---

# F193 Harness Fit Review — Cross-Thread Comm Unification

## What changed

F193 改 4 类 harness surface：
1. **MCP handler 契约**（Phase A）：invocation-token caller 调 `post_message(threadId)` 现在 reject + 提示用 `cat_cafe_cross_post_message`。这是行为改变 — 猫之前可能误用 `post_message` 跨 thread，现在 fail-fast。
2. **SystemPromptBuilder 工具列表**（Phase B + Phase D）：加 `cat_cafe_cross_post_message` 工具描述（B1）+ 删 `cat_cafe_reflect` 描述（D1）。猫看到的"我有什么工具" surface 直接变化。
3. **InvocationContext 注入 reply hint**（Phase B）：跨线程消息触发的 invocation 自动在 system prompt 里有"回复请用 cross_post_message(threadId=, targetCats=[])"提示段。
4. **MCP server 拓扑**（Phase C + D）：4-split (collab/memory/signals/limb) 取代 1 all-in-one，移除 `cat_cafe_reflect` + `cat_cafe_guide_resolve` 两个 deprecated tools。

## Failure class

`harness_misfit` — 这次是修复 misfit（修复前的 surface 让猫没法正确 reply / 配置双重注册让工具显示为重复）。修复后预期 misfit 信号降低。

## Activation signals to watch (post-merge)

- 跨线程通讯成功率：监控 `cross_post_message` invocation 数量上涨（之前猫不知道用它）
- 误用 `post_message(threadId)` 应 → 0（被 reject 时猫看到 alternatives[] 应转向 `cross_post_message`）
- "猫看到 reply hint 后正确回复源 thread" 比例：通过 thread session digest 看 reply pattern（receiver 是否调用 `cross_post_message(threadId=sourceThreadId)`）
- `cat_cafe_reflect` / `cat_cafe_guide_resolve` 调用 → 0（已下线，任何残留调用 = drift）
- `mcp__cat-cafe__cat_cafe_post_message` 与 `mcp__cat-cafe-collab__cat_cafe_post_message` 不再同时出现在 tool catalog（split-only 拓扑生效）

## Sunset signal

如果 6 个月内（2026-11）观察到：
- `cross_post_message` 仍接近 0 调用 — Phase B reply hint 没起作用
- 猫在 thread 内 `@self` 而不是回 source thread 仍频繁 — 接收侧 hint 没读懂

→ 需要重新评估：是 spec 写错（认知路径不对）还是 prompt 段被截断 / context 压缩掉了？

## Friction metric

设计阶段假设："工具不在 SystemPromptBuilder 列表 = 工具不存在"（spec audit #2 根因）。Phase B 修复后，`cat_cafe_cross_post_message` 进入认知面。摩擦指标 = 看到 reply hint 后能在第一次 invocation 里成功 cross-post 的比例（由 receiver invocation 的 tool call sequence 反推）。

## Regression fixture

- F193 spec Phase B AC-B4 测试覆盖 worklist + queue 两条 a2aTriggerMessageId 路径 + agent-key boundary
- F193 spec Phase A AC-A5 测试覆盖 4 格 principal × threadId × targetCats 矩阵
- F193 spec Phase C `tool-registration.test.js` 守护 `createLimbServer` 4 项 limb tools

## Evidence refs

- Motivation evidence (铲屎官原话 + 截图): `/uploads/1778169018738-4cf75cfd.png` — 46 收到跨线程消息后回复停在本 thread
- 三猫 audit: thread `thread_movcg5v7226tmg0q` 2026-05-07 各猫独立分析 → 共识 4 根因
- 砚砚 round 1 review (R7 透明窗口): commit `4a5c2a114` (`healCatCafeMcpTopology` helper)
- Cloud R9 PASS (Phase C): "Didn't find any major issues" — comment 4410528058
- Cloud R1 PASS (Phase D): "Didn't find any major issues. Chef's kiss." — comment 4411878825

## Outcome

F193 把 4 个 audit 阶段识别的根因（契约衰减 / 工具不在认知面 / 配置双重注册 / 接收侧无 hint）转成 4 个独立可验证的 Phase。所有 AC met（commit 在 spec 列详）。Harness misfit 在 4 个 surface 上同步修复 + 测试守护 + spec 锁定。

无遗留 unmet AC。两个 follow-up（API route `/api/reflect` 和 `handleCallbackReflect` helper 暂留）都是 narrower fix scope decision，不属于 F193 缺口。
