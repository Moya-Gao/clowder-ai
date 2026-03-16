---
capsule_id: "F123-CLOSE-2026-03-16"
context: "F123 Bubble Runtime Correctness 完成收口"
feature_ids: [F123]
doc_kind: capsule
created: 2026-03-16
---

## What Worked
- 先把 `bubbleIdentity.ts`、`bubble-state-model.md`、`symptom-fixture-matrix.md` 立成真相源，再分 slice 修热路径，避免继续靠口头症状追 bug。
- 把高频双影、queue/hydration 乱序、draft/hydration 身份断层拆成独立 replay slice，能保证每一刀都有明确攻击面和回归证据。
- 最后一条 gap 没继续在 hook 层空转，而是转成 Alpha 手测证据，正好补上高层 UI 可见性链路。

## What Failed
- Phase B 的防御层一开始 scope 放得太理想化，最后证明统一 identity contract / store invariant / placeholder 单调规则不适合继续塞在 F123 本体里一起交付。
- 早期几刀仍然偏“热点 case 收口”，直到 truth model 和 symptom matrix 落下去之后，整条线才真正稳下来。

## Trigger Missed
- 应该更早触发“close 时允许把防御层显式转 TD”的判断，而不是把 Phase B 的 4 条防御性 AC 一直挂在 feature 上，直到最终愿景守护才做结构化分流。
- 也应该更早承认“最后一个 gap 是全链路证据，不是又一个 hook 分支”，避免在低层 fixture 上继续寻找并不存在的新 if。

## Doc Links
- [F123 spec](../features/F123-bubble-runtime-correctness.md)
- [F123 closure plan](../plans/2026-03-16-f123-closure-plan.md)
- [F123 symptom-fixture matrix](../features/assets/F123/symptom-fixture-matrix.md)
- [F123 alpha verification](../features/assets/F123/alpha-monotonic-visibility-verification.md)
- [Tech debt ledger](../TECH-DEBT.md)

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion 阶段：补一条 close 规则，允许把“防御性工程层 AC”显式转 TD，但必须在 spec 中改成 `[~]` + `TDxxx`，不能假装 `[x]`。
