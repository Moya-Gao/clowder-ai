---
capsule_id: f081-bubble-continuity
context: "F081 Bubble Continuity & Rendering Observability — 气泡连续性全阶段完成反思"
feature_ids: [F081]
doc_kind: reflection
created: 2026-03-10
---

# F081 Bubble Continuity — 完成反思胶囊

## What Worked

1. **砚砚的侦探式取证法**：从进程树、lsof、DOM 三条线交叉取证，精准定位了 `useChatHistory` 的 `clearMessages()` 和 `activeRefs` 身份断层两只真凶。不是猜修复，是有证据链的定位。
2. **分层修复策略**：没有一刀切重写，而是分 5 个 PR 逐层推进（smoke test → replace hydration → duplicate reconcile → thinking/tool 路径 → stream target recovery），每个 PR 都有明确的根因和回归测试。
3. **写路径审计（104 个写入点）**：不仅修了 bug，还留下了状态矩阵和写路径全景图，后续前端 state 问题可以按图索骥。

## What Failed

1. **AC 过度承诺**：13 个 AC 里有 5 个（AC3/4/5/6/11）是 observability 基建，在修完核心 bug 后动力不足。应该在 kickoff 时就把 continuity 和 observability 拆成两个 milestone，而不是混在一个 feature 里。
2. **PR #288 引入了 #337 的 bug**：non-destructive merge 修了 replace 覆盖，但没考虑 `activeRefs` 在 swap 后失效。根因：修复 A 的时候没遍历 A 的下游影响（activeRefs 是 replace hydration 的消费者）。
3. **spec checkbox 与实际交付脱节**：spec 里大部分 AC 还标着 `[ ]`，但代码已经修了。说明修完 bug 后没有及时回填 spec——这正是 LL-029（交付物核实铁律）要防的。

## Trigger Missed

- **修复 A 后遍历 A 的消费者**：PR #288 改了 replace hydration 的行为，应该同时检查"谁依赖 replace 后 message id 不变？"——`activeRefs` 就是答案。
- **Milestone 拆分**：AC 超过 8 个时，应触发"是否需要拆 milestone？"——核心连续性和 observability 工具化是两类工作。
- **Spec 回填**：每个 PR 合入后应立刻更新 spec checkbox，不要攒到 close 时再对账。

## Doc Links

- Feature spec: [F081-bubble-continuity-observability.md](../features/F081-bubble-continuity-observability.md)
- Write-path audit: [F081-write-path-audit.md](../features/F081-write-path-audit.md)
- PRs: #281 (smoke test), #288 (replace hydration), #310 (reconcile), #318 (duplicate), #337 (stream target)

## Rule Update Target

- 考虑在 SOP 或 skill 中加入："修复触及 state 写入路径的 bug 时，必须检查该 state 的所有消费者"
- 考虑在 feat-lifecycle 中加入：AC > 8 时建议拆 milestone
