---
capsule_id: "F075-A-2026-03-11"
context: "F075 Phase A 排行榜基础盘面实现后的愿景守护与真相源同步"
feature_ids: [F075]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- Phase A 的后端统计骨架是成立的：共享类型、纯函数统计、Fastify route、前端 tab 组件形成了可扩展基座。
- 本地 review 链路有效，布偶猫修掉了 `timestamp` / `userId` / `range` 这些真实 correctness 问题后再合入，基础代码质量过关。
- 这次愿景守护及时拦住了“把 Phase A 当整 feat close”的漂移，避免 F075 在真相源里被误标 done。

## What Failed
- Spec/plan/merge 三者没有在 merge 后自动同步，导致 F075 文档仍停在整 feat `spec`，BACKLOG 也没有反映 Phase A 已交付。
- 运行态验证缺位：当前本地 `Cat Café Hub` 仍看不到「排行榜」tab，API runtime 也还是旧版本，但这件事在 merge 前没有被收口。
- 入口命名发生漂移：原话和 spec 写的是 Mission Hub，新实现落在 `Cat Café Hub` modal，产品入口没有二次拍板。

## Trigger Missed
- `feat-lifecycle` completion 的“不是整 feat 就不能 close”应该在 PR merge 后立刻触发，而不是等铲屎官追问才补。
- `quality-gate` 的前端运行态证据应该在 merge 前固化，不该只停留在代码和测试层。
- `merge-gate` Step 7.5 的 Phase/AC/Timeline 真相源同步漏做了，导致 Mission Hub 列表继续显示 F075 为待建议。

## Doc Links
- `docs/features/F075-cat-leaderboard.md`
- `docs/plans/2026-03-11-f075-cat-leaderboard-phase-a.md`
- `docs/BACKLOG.md`
- `docs/features/assets/F075/phase-a-vision-guard-runtime-stale.png`

## Rule Update Target
- `cat-cafe-skills/quality-gate/SKILL.md`：补一条“前端功能 merge 前必须确认运行态已吃到新代码；若 runtime 仍旧，不能声称用户已可见”
- `cat-cafe-skills/feat-lifecycle/SKILL.md`：补一条“Phase merge 后若非整 feat 完成，必须同步成 `phase-x-done`，禁止停留在 `spec`”
- `cat-cafe-skills/refs/shared-rules.md`：补一条“Mission Hub / Cat Café Hub 这类入口名变更必须显式拍板，不能实现时悄悄换位置”
