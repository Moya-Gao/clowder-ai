---
capsule_id: "F154-PhaseB-2026-04-12"
context: "Cat Routing Personalization (F154) 完结"
feature_ids: [F154]
doc_kind: capsule
created: 2026-04-12
---

# Cat Routing Personalization 完结反思

## What Worked
- **跨模块统一**：将 connector 的指令 (`/focus`, `/ask`) 和 Web 端的可见性 (`ThreadCatPill`, `DefaultCatSelector`) 用同一个底层 Model 统一起来，体验一致。
- **设计先验 (Design-in-Context)**：KD-9 明确指出由于前期没做上下文检查导致组件位置冲突，后续 Phase B 重新规划 `ChatContainerHeader` 结构后设计更稳固，并且退化策略考虑了移动端（KD-10）。

## What Failed
- **PR 状态的 P2 处理遗漏**：在云端 Review (R3/R4) 中，因为 PATCH 错误态恢复的边角用例没有一次性想到位（保存失败后需重新打开重置 saveError），导致被提出同样的 P2 多次修复（Persist -> Catch -> Reset）。

## Trigger Missed
- **边界流异常测试缺失**：在最初构思时，对于"如果报错后状态残留"这一错误交互边界测试（Error State Fallback）未充分纳入脑暴，属于对前端表单副作用的元思考缺失。

## Doc Links
- `docs/features/F154-cat-routing-personalization.md`
- `docs/mailbox/2026-04-12-f154-phase-b-review-request.md`

## Rule Update Target
- `cat-cafe-skills/refs/quality-gate-checklist.md`: 前端交互组件验收需要增加"错误态是否能被正常清除重置"的检查项。