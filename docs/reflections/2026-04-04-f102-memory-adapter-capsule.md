---
capsule_id: "F102-CLOSE-2026-04-04"
context: "F102 feature close：本地记忆组件从 Adapter 基座走到产品收口"
feature_ids: [F102]
doc_kind: capsule
created: 2026-04-04
---

## What Worked
- 从一开始就坚持“真相源分层”：`docs/*.md`、`docs/markers/*.yaml`、`evidence.sqlite/global_knowledge.sqlite` 各自职责清晰，后续 Phase 和 Batch 都是在同一终态骨架上叠加，没有推翻重来。
- 先做单项目 permanence、再做全局层、最后做 `/memory` 产品面，这个顺序避免了 UI 先行的脚手架风险，也让 project/global 维度和 Recall Feed 有真实后端支撑。
- 铲屎官 runtime 体验反馈和跨猫愿景守护配合有效：Known Issues、source link、config panel 都不是纸面 AC 能兜住的，必须靠真实使用把最后一层问题抖出来。

## What Failed
- Feature doc 在 Batch 1/2/3 和 follow-up 合入后没有及时进入 completion，导致 spec 一度同时存在“剩余 3 Batch 待做”等过时口径。
- `/memory` 的多轮体验修正说明我们虽然主干方向没偏，但“产品收口”比最初预估更依赖铲屎官亲手走一轮，不能只凭测试和 review body 下结论。
- Memory Status 和 Recall Feed 的多个问题都说明：只看实现和测试很容易误判“已经够用”，没有真实页面体验就不该轻易说 close。

## Trigger Missed
- 在 PR #911/#912/#915 合入后，本应立即触发一次“stale status sweep + close candidate 评估”，而不是等到 follow-up PR 全做完、铲屎官再追问时才回头收口。
- 愿景守护第一次指出 source link gap 后，应该同步标记“F102 已进入 close candidate，只差体验尾巴”，这样 completion 不会被动滞后。

## Doc Links
- [F102 聚合文件](../features/F102-memory-adapter-refactor.md)
- [Batch 1: IMaterializationService 终态计划](../plans/2026-04-01-f102-batch1-imaterialization-terminal.md)
- [Batch 2: Phase G 运行时验收计划](../plans/2026-04-01-f102-batch2-phase-g-runtime-verification.md)
- [Batch 3: /memory 体验层收口计划](../plans/2026-04-01-f102-batch3-memory-ux-polish.md)
- [F102 Known Issues 修复 review 请求](../mailbox/2026-04-01-f102-issues-fix-review-request.md)

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion：补一条明确规则——大型 feature 在最后一批 follow-up PR 合入后，必须立刻做一次“spec stale-status sweep + close candidate 判定”，不能等铲屎官追问才补 completion。
