---
capsule_id: "F191-2026-05-07"
context: "Architecture Ownership Governance — ownership map + Map delta gate"
feature_ids: [F191]
doc_kind: capsule
created: 2026-05-07
---

## What Worked
- 把“新增 feature 要不要先归一架构”从多问表格压成一组可执行坐标：`Architecture cell` / `Map delta` / `Why`。
- per-cell ownership map 避免所有 feature 抢一个大表，README 生成化避免新 truth source 腐烂。
- Phase D 用 F187 真实试跑暴露漏格，补 `thread-navigation`，证明“找不到 cell = Phase 0 架构发现”能触发正确动作。
- warning-only 脚本只查机械不变量，把语义判断留给 Design Gate 和 reviewer，避免 CI 伪装架构师。

## What Failed
- 首版讨论容易滑向 process gate；47 的 push back 让方案回到 infra-first + process activation 的坐标。
- Phase C 后一开始漏同步 `docs/features/index.json`，被 `pnpm check:features` 抓到后补 commit。
- Phase D trial 由 map 作者完成，能验证机制路径，但还不能证明“未参与 F191 的猫”自然使用时也顺手。

## Trigger Missed
- 无。铲屎官触发“第一性原理 / 数学之美”后，方案从填表收敛到 ownership map。

## Doc Links
- [F191 spec](../features/F191-architecture-ownership-governance.md)
- [Architecture ownership map](../architecture/ownership/README.md)
- [thread-navigation cell](../architecture/ownership/cells/thread-navigation.md)
- [F187 trial feature](../features/F187-thread-labels.md)

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Design Gate：已回写 `Architecture cell` / `Map delta` / `Why` 一问。
- `cat-cafe-skills/quality-gate/SKILL.md` Step 2.7：已回写 warning-only ownership report。
