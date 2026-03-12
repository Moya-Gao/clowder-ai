---
capsule_id: "F105-2026-03-12"
context: "opencode/金渐层接入 — L1 CLI + OMOC 集成 + 协作路由 (3 Phases)"
feature_ids: [F105]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- F050 DARE 模式的复用非常高效：AgentService 接口、event transform 模式、cat-config 注册流程都直接套用，Phase 1 几小时就完成
- 三 Phase 拆分节奏好：L1 基础 → OMOC 隔离 → 协作路由，每个 Phase 独立可验证，review 粒度合适
- gpt52 的 P1 review（E2E 测试不走真实生产路径）非常有价值——发现了 `buildSystemPrompt()` vs `buildStaticIdentity()` + `buildInvocationContext()` 的分离装配差异，测试从"手工拼接"升级到"镜像真实 route-serial 装配"
- Red→Green TDD 纪律贯穿始终，89 tests 全绿无跳过

## What Failed
- Phase 3 初版 E2E 测试用了 `buildSystemPrompt()` 一把梭，没有仔细对比生产路径的分离装配。gpt52 review 才发现这个问题——说明写 E2E 测试时应该先读生产代码再写测试，不能想当然
- `catRegistry` 在 import 时为空这个坑花了一些时间排查，最终靠 `node --input-type=module` 实验验证。应该在 Phase 1 就记录下来给后续 Phase 复用
- P2 fixture guard 第一版用 `deepEqual` 精确匹配，没考虑到 opus fixture 省略了 `@ragdoll` pattern，改为 subset check 才通过。fixture 设计时就应该考虑"子集还是全集"的语义

## Trigger Missed
- 无。三个 Phase 都按 SOP 走了 Design Gate → writing-plans → worktree → tdd → quality-gate → request-review → receive-review → merge-gate 全流程

## Doc Links
- [F105 Feature Spec](../features/F105-opencode-golden-chinchilla.md)
- [F050 External Agent Onboarding](../features/F050-a2a-external-agent-onboarding.md)
- [F061 Antigravity 接入](../features/F061-antigravity-bengal-cat.md)
- PR #401 (Phase 1), PR #404 (Phase 2), PR #407 (Phase 3)

## Rule Update Target
- `lessons-learned.md`: 新增 LL-030 — E2E 测试写之前先读生产代码的实际装配路径，不能假设 builder 函数的行为等于生产行为
- `shared-rules.md §TDD`: 可考虑补充"E2E 测试必须镜像生产装配路径，不能用 builder 便利函数替代"
