---
capsule_id: "F180-CLOSE-2026-06-28"
context: "F180 Agent CLI Hook Health and Sync feat close"
feature_ids: [F180]
doc_kind: capsule
created: 2026-06-28
---

## What Worked
- 四 Phase 拆分合理：contract → API → install coverage → in-app surface，每个 Phase 独立可验收
- 砚砚一天内完成 Phase A-D 主体开发（4/29），执行力强
- PR #1484~#1487 的 callback dedup 问题被云端 review 连续抓出 4 轮，每轮都 Red→Green 闭环，最终收敛到正确的 FIFO + 队首 post evidence 坐标系
- agent-hooks 模块复用 `buildTargets()` 单一真相源，CLI 和 API 零重复
- `request.ip` 替代 Host header 做 loopback 判定是被云端 review P1 逼出来的正确方向

## What Failed
- 愿景守护走了草率版本：5/30 出了 verdict 但没有证物对照表、没有 Close Gate Report、没有反思胶囊、没有跨猫交叉验证——漏了 feat-lifecycle 的大半步骤
- BACKLOG 应该移除行而不是改状态，说明没认真读 skill
- AC-D4 拖了 29 天才 close，原因是 #618 全量 sync PR 被关后没有人追踪后续 sync 是否已经带出 F180 内容
- 我（opus-46）同时是 reviewer 和 guardian，角色冲突——应该一开始就让另一只猫做守护
- PR #1485 review 时接受了错误的 tradeoff（"不丢数据"实际会丢回复持久化），被云端 catch 后才纠正

## Trigger Missed
- feat close 时应该立刻加载 `feat-lifecycle` skill 而不是凭记忆操作——CLAUDE.md 反复写了"Skill 不是可选——适用就必须加载"
- AC-D4 在 5/30 条件放行后没有设 follow-up 提醒，导致 29 天无人追踪
- 跨猫交叉验证应该在出 verdict 时就发起，不是等铲屎官催

## Doc Links
- Feature spec: `docs/features/F180-agent-cli-hook-health.md`
- Community issue: `https://github.com/zts212653/clowder-ai/issues/614`
- PRs: #1476 (Phase A+B), #1477 (AC-C5), #1478 (AC-C1~C3), #1479 (AC-C4 + Phase D), #1484~#1487 (intake + review fixes)
- ADR: `docs/decisions/019-user-level-hooks-architecture.md`

## Rule Update Target
- `feat-lifecycle` skill: 无需更新规则本身，问题是我没加载就操作
- MEMORY.md: 应记录"feat close 必须加载 feat-lifecycle skill，不能凭记忆走流程"
