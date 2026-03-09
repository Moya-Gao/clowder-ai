---
capsule_id: "F088-MVP-2026-03-09"
context: "Multi-Platform Chat Gateway Phase 1 MVP — Telegram + Feishu DM-only"
feature_ids: [F088]
doc_kind: capsule
created: 2026-03-09
---

## What Worked
- Connector 基座设计（ConnectorRouter + ThreadBinding + OutboundHook）与现有 ConnectorInvokeTrigger 自然衔接，复用了 GitHub Review Watcher 的 invoke 管道
- 缅因猫 4 轮本地 review 把实际生产 bug 揪出来了：Fastify 路由时序、Telegram dedup 键碰撞、Feishu 认证 fail-open，都是测试覆盖不到的接线层问题
- fail-closed 设计（Feishu 必须配 verification token 才启动）是 review 驱动出来的正确决策
- TDD 流程有效：每个 review finding 都先写红测试再修绿

## What Failed
- 初版 Feishu webhook 没做任何认证就提 review，被缅因猫从 P0 一路追到 R4 才彻底关闭（3 轮修 1 个问题）
- Fastify 路由注册时序问题（routes MUST be before listen）本应在开发阶段发现，但单元测试没覆盖 Fastify lifecycle
- rebase main 时 index.ts 冲突解决比预期复杂，因为 main 在开发期间有大量变动
- 云端 Codex review 只发现了 1 个 P2（BACKLOG 格式），对核心逻辑的审查深度不如本地缅因猫

## Trigger Missed
- 应该在设计阶段就触发"安全边界"思考：webhook = 公网入口 = 必须认证，不应该等 review 才补
- 应该在 wiring index.ts 时触发"Fastify lifecycle 文档查阅"，而不是靠 reviewer 发现
- CI 失败（pnpm 版本不匹配）虽然不是 F088 引入的，但合入时应该注意到并报告

## Doc Links
- Feature spec: `docs/features/F088-multi-platform-chat-gateway.md`
- Implementation plan: `docs/plans/2026-03-09-f088-chat-gateway.md`
- PR: https://github.com/zts212653/cat-cafe/pull/328
- Review request: `docs/mailbox/2026-03-09-f088-chat-gateway-review-request.md`

## Rule Update Target
- `MEMORY.md`: 添加 "Fastify 路由必须在 listen 之前注册" 经验
- `shared-rules.md §安全`: 补充 "webhook = 公网入口 = 必须认证，fail-closed 为默认策略"
- `MEMORY.md`: 添加 "Feishu webhook 用 verification token 不是 encrypt key" 技术细节
